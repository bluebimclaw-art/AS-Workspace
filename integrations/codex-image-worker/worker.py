"""Subscription-only native Codex image engine; no HTTP service or API fallback."""

import json
import os
from pathlib import Path
import stat
import uuid

MAX_IMAGE = 5 * 1024 * 1024


def resolve_image(home, stdout, started, *, existing_threads=()):
    try:
        threads = [e['thread_id'] for line in stdout.splitlines() if (e := json.loads(line)).get('type') == 'thread.started']
        if len(threads) != 1 or str(uuid.UUID(threads[0])) != threads[0]:
            raise ValueError()
        if threads[0] in existing_threads:
            raise ValueError()
        home = Path(home).absolute()
        folder = home / 'generated_images' / threads[0]
        for node in (home, home / 'generated_images', folder):
            info = node.lstat()
            if node.is_symlink() or getattr(info, 'st_file_attributes', 0) & 0x400:
                raise ValueError()
        if not folder.resolve().is_relative_to(home.resolve()):
            raise ValueError()
        files = list(folder.iterdir())
        if len(files) != 1:
            raise ValueError()
        image = files[0]
        info = image.lstat()
        if not stat.S_ISREG(info.st_mode) or image.is_symlink() or getattr(info, 'st_file_attributes', 0) & 0x400:
            raise ValueError()
        if not image.resolve().is_relative_to(folder.resolve()) or info.st_mtime < started or not 8 < info.st_size <= MAX_IMAGE:
            raise ValueError()
        data = image.read_bytes()
        if len(data) > MAX_IMAGE or not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError()
        return data
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        raise WorkerError('invalid_native_image') from None


import base64
import tempfile
import time
import threading


def run_child(argv, cwd, env, timeout):
    """One owned subprocess; bounded private-file stdout, no retries/tree kills."""
    import subprocess
    process = None
    overflow = threading.Event()
    reader = None
    try:
        with tempfile.TemporaryFile(mode='w+b', dir=cwd) as output:
            process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                       shell=False, close_fds=True)
            def drain():
                total = 0
                try:
                    while chunk := process.stdout.read(65536):
                        total += len(chunk)
                        if total > 1024 * 1024:
                            overflow.set()
                            return
                        output.write(chunk)
                except (OSError, ValueError):
                    overflow.set()
            reader = threading.Thread(target=drain, daemon=True)
            reader.start()
            deadline = time.monotonic() + timeout
            while process.poll() is None:
                if overflow.is_set() or time.monotonic() >= deadline:
                    process.kill()
                    process.wait(timeout=5)
                    raise WorkerError('upstream_completion_uncertain')
                time.sleep(.01)
            reader.join(timeout=1)
            if reader.is_alive() or overflow.is_set():
                raise WorkerError('upstream_completion_uncertain')
            if process.returncode != 0:
                raise WorkerError('upstream_failed')
            output.seek(0)
            return output.read(1024 * 1024 + 1).decode('utf-8', errors='strict').replace('\r\n', '\n')
    except WorkerError:
        raise
    except Exception:
        raise WorkerError('upstream_completion_uncertain') from None
    finally:
        if process is not None:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=5)
            if reader is not None:
                reader.join(timeout=1)
            if process.stdout is not None:
                process.stdout.close()


def fetch_usage(auth, *, transport=None):
    """Authenticated GET only; no proxies, redirects, refresh, or paid fallback."""
    import urllib.request
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    try:
        request = urllib.request.Request('https://chatgpt.com/backend-api/wham/usage', headers={
            'Authorization': 'Bearer ' + auth['tokens']['access_token'],
            'ChatGPT-Account-Id': auth['tokens']['account_id'],
            'User-Agent': 'codex-cli', 'Accept': 'application/json'}, method='GET')
        open_request = transport or urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()).open
        with open_request(request, timeout=15) as response:
            body = response.read(65537)
        if len(body) > 65536:
            raise ValueError()
        result = json.loads(body)
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except Exception:
        raise WorkerError('quota_unknown') from None


class Engine:
    """Caller owns dedicated home and OS ACLs. Serializes jobs within this instance."""
    def __init__(self, home, node, cli, *, job_root, quota=None, runner=None, environment=None, timeout=180, minimum_remaining=50, execution_mode="restricted"):
        if execution_mode not in {"restricted","summit-unsandboxed"}:
            raise ValueError("Explicit supported execution mode required")
        self.execution_mode = execution_mode
        self.home = Path(home).resolve()
        self.node, self.cli = str(node), str(cli) if cli is not None else None
        self.job_root = Path(job_root).resolve()
        self.quota, self.runner = quota, runner
        self.environment = dict(os.environ if environment is None else environment)
        self.timeout = min(max(float(timeout), 1), 300)
        self._lock = threading.Lock()
        self.minimum_remaining = minimum_remaining

    def _check(self):
        try:
            auth = json.loads((self.home / 'auth.json').read_text(encoding='utf-8'))
            token = auth['tokens']['access_token']
            payload = token.split('.')[1]
            import math
            claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
            expiry = claims['exp']
            if type(expiry) not in (int, float) or not math.isfinite(expiry):
                raise ValueError()
            if claims['https://api.openai.com/auth']['chatgpt_account_id'] != auth['tokens']['account_id']:
                raise ValueError()
            if any('key' in k.lower() for k in auth['tokens']):
                raise ValueError()
            # Validate local auth before any authenticated network access; quota is never synthesized.
            if auth.get('auth_mode') != 'chatgpt' or any('key' in k.lower() and v not in (None, '') for k, v in auth.items()) or expiry <= time.time():
                raise ValueError()
            if not isinstance(token, str) or not token or not isinstance(auth['tokens']['account_id'], str) or not auth['tokens']['account_id']:
                raise ValueError()
            usage = (self.quota or fetch_usage)(auth)
            return admit(auth, usage, time.time(), token_expiry=expiry, minimum_remaining=self.minimum_remaining)
        except WorkerError:
            raise
        except Exception:
            raise WorkerError('subscription_admission_denied') from None

    def generate(self, request):
        prompt = validate_request(request)
        with self._lock:
            before = self._check()
            try:
                with tempfile.TemporaryDirectory(prefix='image-job-', dir=self.job_root) as cwd:
                    allowed = {'SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE','HOMEDRIVE','HOMEPATH','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA','ALLUSERSPROFILE','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE'}
                    env = {k:v for k,v in self.environment.items() if k.upper() in allowed}
                    env['CODEX_HOME'] = str(self.home)
                    argv = [self.node] + ([self.cli] if self.cli is not None else []) + ['exec', '--json', '--ephemeral', '--ignore-rules', '--skip-git-repo-check', '--strict-config', '--model', 'gpt-6.1-sol', '-C', cwd]
                    if self.execution_mode == "summit-unsandboxed":
                        argv += ["--sandbox", "danger-full-access"]
                        permissions = ()
                    else:
                        permissions = ('default_permissions="image-only"', 'permissions.image-only.network.enabled=false', 'permissions.image-only.filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="read"}}')
                    for config in permissions + ('features.unified_exec=false', 'forced_login_method="chatgpt"', 'features.image_generation=true', 'features.shell_tool=false', 'features.apps=false', 'features.plugins=false', 'features.hooks=false', 'features.browser_use=false', 'features.computer_use=false', 'features.multi_agent=false'):
                        argv += ['-c', config]
                    argv += ['Generate exactly one PNG using the native image generation tool. Do not use shell, APIs, URLs or fallback tools. User image description:\n' + prompt]
                    generated = self.home / 'generated_images'
                    existing_threads = {p.name for p in generated.iterdir()} if generated.exists() else set()
                    # Round down for Windows file timestamp precision; preexisting thread dirs are independently rejected.
                    started = int(time.time())
                    failure = None
                    try:
                        stdout = (self.runner or run_child)(argv, cwd, env, self.timeout)
                    except Exception as error:
                        failure = error
                    try:
                        # Always postcheck once an invocation was attempted, including timeout.
                        after = self._check()
                    except Exception:
                        if isinstance(failure, WorkerError):
                            raise failure from None
                        raise WorkerError('postcheck_failed_completion_uncertain') from None
                    if failure is not None:
                        if isinstance(failure, WorkerError):
                            raise failure from None
                        raise WorkerError('upstream_completion_uncertain') from None
                    data = resolve_image(self.home, stdout, started, existing_threads=existing_threads)
                    return {'mime': 'image/png', 'base64': base64.b64encode(data).decode('ascii'), 'quotaBefore': before, 'quotaAfter': after}
            except WorkerError:
                raise
            except Exception:
                raise WorkerError('generation_failed_completion_uncertain') from None


class WorkerError(Exception):
    """Safe, fixed public error message (never includes upstream exception text)."""


def admit(auth, usage, now, *, token_expiry, minimum_remaining=50):
    import math
    try:
        if type(minimum_remaining) not in (int,float) or not math.isfinite(minimum_remaining) or not 0 <= minimum_remaining <= 100:
            raise ValueError()
        tokens = auth['tokens']
        if auth['auth_mode'] != 'chatgpt' or any('key' in k.lower() and v not in (None, '') for k, v in auth.items()):
            raise ValueError()
        if not tokens['access_token'] or not tokens['account_id'] or token_expiry <= now:
            raise ValueError()
        rate = usage['rate_limit']
        window = rate['primary_window']
        used, reset = window['used_percent'], window['reset_at']
        if rate['allowed'] is not True or rate['limit_reached'] is not False or window['limit_window_seconds'] != 18000:
            raise ValueError()
        if type(used) not in (int, float) or not math.isfinite(used) or not 0 <= used <= 100-minimum_remaining:
            raise ValueError()
        if type(reset) not in (int, float) or not math.isfinite(reset) or reset <= now:
            raise ValueError()
        return {'remainingPercent': 100.0 - used, 'resetAt': reset}
    except (KeyError, TypeError, ValueError):
        raise WorkerError('subscription_admission_denied') from None


def validate_request(request):
    if not isinstance(request, dict) or set(request) - {'model', 'prompt', 'references'}:
        raise WorkerError('invalid_request')
    prompt = request.get('prompt')
    if request.get('model') != 'gpt-image-2' or not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 8000:
        raise WorkerError('invalid_request')
    if request.get('references', []) != []:
        raise WorkerError('references_unsupported')
    return prompt
