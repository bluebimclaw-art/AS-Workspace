import base64
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
import uuid

import worker


class WorkerTests(unittest.TestCase):
    def test_real_chatgpt_auth_null_api_key_is_not_api_login(self):
        auth = {'auth_mode':'chatgpt','OPENAI_API_KEY':None,'tokens':{'access_token':'fixture','account_id':'fixture-account'}}
        usage = {'rate_limit':{'allowed':True,'limit_reached':False,'primary_window':{'limit_window_seconds':18000,'used_percent':20,'reset_at':9999999999}}}
        self.assertEqual(worker.admit(auth, usage, 100, token_expiry=200)['remainingPercent'],80)
        auth['OPENAI_API_KEY']='test-nonempty-must-reject'
        with self.assertRaises(worker.WorkerError):
            worker.admit(auth, usage, 100, token_expiry=200)

    def test_direct_native_cli_has_no_node_launcher_child(self):
        fixture=Path(__file__).parent.parent.parent.joinpath('fixtures','native-teapot.png').read_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp)/'home';home.mkdir();calls=[]
            def runner(argv,cwd,env,timeout):
                self.assertEqual(argv[:2],['official-codex.exe','exec'])
                calls.append(argv);thread=str(uuid.uuid4());folder=home/'generated_images'/thread;folder.mkdir(parents=True)
                (folder/'fixture.png').write_bytes(fixture)
                return json.dumps({'type':'thread.started','thread_id':thread})
            engine=worker.Engine(home,'official-codex.exe',None,job_root=tmp,runner=runner)
            engine._check=lambda:{'remainingPercent':80,'resetAt':9999999999}
            self.assertEqual(base64.b64decode(engine.generate({'model':'gpt-image-2','prompt':'Existing artifact fixture only'})['base64']),fixture)
            self.assertEqual(len(calls),1)

    def test_request_is_strict_text_only(self):
        self.assertEqual(worker.validate_request({'model': 'gpt-image-2', 'prompt': 'teapot', 'references': []}), 'teapot')
        for request in ({}, {'model': 'other', 'prompt': 'x'}, {'model': 'gpt-image-2', 'prompt': ''}, {'model': 'gpt-image-2', 'prompt': 'x'*8001}, {'model': 'gpt-image-2', 'prompt': 'x', 'extra': 1}, {'model': 'gpt-image-2', 'prompt': 'x', 'references': ['data:image/png;base64,eA==']}):
            with self.assertRaises(worker.WorkerError):
                worker.validate_request(request)

    def test_subscription_admission_fails_closed(self):
        auth = {'auth_mode': 'chatgpt', 'tokens': {'access_token': 'opaque', 'account_id': 'private'}}
        usage = {'rate_limit': {'allowed': True, 'limit_reached': False, 'primary_window': {'limit_window_seconds': 18000, 'used_percent': 50, 'reset_at': 9999999999}}}
        public = worker.admit(auth, usage, 100, token_expiry=200)
        self.assertEqual(public, {'remainingPercent': 50.0, 'resetAt': 9999999999})
        import copy
        for kind in ('mode', 'api', 'expired', 'unknown', 'floor', 'blocked', 'window'):
            a, u, exp = copy.deepcopy(auth), copy.deepcopy(usage), 200
            if kind == 'mode': a['auth_mode'] = 'apikey'
            if kind == 'api': a['OPENAI_API_KEY'] = 'synthetic-nonempty-must-reject'
            if kind == 'expired': exp = 99
            if kind == 'unknown': u = {}
            if kind == 'floor': u['rate_limit']['primary_window']['used_percent'] = 50.01
            if kind == 'blocked': u['rate_limit']['allowed'] = False
            if kind == 'window': u['rate_limit']['primary_window']['limit_window_seconds'] = 604800
            with self.subTest(kind=kind), self.assertRaises(worker.WorkerError):
                worker.admit(a, u, 100, token_expiry=exp)

    def test_exact_fresh_thread_png_only(self):
        fixture = Path('D:/AS-Workspace-Delivery/reports/CODEX_IMAGE/native-teapot.png').read_bytes()
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            home = Path(tmp)
            thread = str(uuid.uuid4())
            folder = home / 'generated_images' / thread
            folder.mkdir(parents=True)
            image = folder / 'exec-existing-fixture.png'
            image.write_bytes(fixture)
            log = json.dumps({'type': 'thread.started', 'thread_id': thread}) + '\n' + json.dumps({'type': 'item.completed', 'text': 'C:/untrusted.png'})
            self.assertEqual(worker.resolve_image(home, log, 0), fixture)
            with self.assertRaises(worker.WorkerError): worker.resolve_image(home, log, 0, existing_threads={thread})
            image.write_bytes(b'\x89PNG\r\n\x1a\n' + b'x' * (5*1024*1024))
            with self.assertRaises(worker.WorkerError): worker.resolve_image(home, log, 0)
            image.write_bytes(fixture)
            with self.assertRaises(worker.WorkerError): worker.resolve_image(home, log+'\n'+log, 0)
            with self.assertRaises(worker.WorkerError): worker.resolve_image(home, log, time.time()+5)
            (folder / 'second.png').write_bytes(fixture)
            with self.assertRaises(worker.WorkerError): worker.resolve_image(home, log, 0)
            (folder / 'second.png').unlink()
            image.write_bytes(b'not png')
            with self.assertRaises(worker.WorkerError): worker.resolve_image(home, log, 0)
            with self.assertRaises(worker.WorkerError): worker.resolve_image(home, json.dumps({'type':'thread.started','thread_id':'../escape'}), 0)

    def test_engine_one_job_pre_post_checks_clean_environment(self):
        fixture = Path('D:/AS-Workspace-Delivery/reports/CODEX_IMAGE/native-teapot.png').read_bytes()
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            home = Path(tmp) / 'home'
            home.mkdir()
            payload = base64.urlsafe_b64encode(json.dumps({'exp': time.time()+600, 'https://api.openai.com/auth': {'chatgpt_account_id':'test-only-account'}}).encode()).decode().rstrip('=')
            auth = {'auth_mode': 'chatgpt', 'tokens': {'access_token': 'x.'+payload+'.x', 'account_id': 'test-only-account'}}
            (home/'auth.json').write_text(json.dumps(auth))
            quota_calls, runs = [], []
            def quota(credentials):
                quota_calls.append(credentials)
                return {'rate_limit': {'allowed': True, 'limit_reached': False, 'primary_window': {'limit_window_seconds':18000, 'used_percent':20, 'reset_at':time.time()+600}}}
            def runner(argv, cwd, env, timeout):
                runs.append(argv)
                self.assertEqual(env['CODEX_HOME'], str(home.resolve()))
                self.assertNotIn('OPENAI_API_KEY', env)
                self.assertNotIn('HTTPS_PROXY', env)
                self.assertNotIn('NODE_OPTIONS', env)
                self.assertIn('gpt-6.1-sol', argv)
                self.assertNotIn('gpt-image-2', argv)
                self.assertIn('--strict-config', argv)
                self.assertIn('features.browser_use=false', argv)
                self.assertNotIn('--sandbox', argv)
                self.assertIn('default_permissions="image-only"', argv)
                self.assertIn('permissions.image-only.network.enabled=false', argv)
                self.assertNotIn('features.browser=false', argv)
                self.assertNotEqual(Path(cwd), home)
                thread = str(uuid.uuid4())
                folder = home/'generated_images'/thread
                folder.mkdir(parents=True)
                (folder/'exec-existing-fixture.png').write_bytes(fixture)
                return json.dumps({'type':'thread.started','thread_id':thread})
            engine = worker.Engine(home, 'node.exe', 'codex.js', job_root=tmp, quota=quota, runner=runner,
                                   environment={'SYSTEMROOT':'C:/Windows','OPENAI_API_KEY':'do-not-forward','HTTPS_PROXY':'bad','NODE_OPTIONS':'bad'})
            result = engine.generate({'model':'gpt-image-2','prompt':'Existing fixture test only'})
            self.assertEqual(base64.b64decode(result['base64']), fixture)
            self.assertEqual(set(result), {'mime','base64','quotaBefore','quotaAfter'})
            self.assertEqual(len(runs), 1)
            self.assertEqual(len(quota_calls), 2)
            def failure(*args):
                runs.append('timeout')
                raise worker.WorkerError('upstream_completion_uncertain')
            engine.runner = failure
            with self.assertRaisesRegex(worker.WorkerError, '^upstream_completion_uncertain$'):
                engine.generate({'model':'gpt-image-2','prompt':'Never generated'})
            self.assertEqual(len(runs), 2)
            self.assertEqual(len(quota_calls), 4)

    def test_real_child_bounded_output_timeout_and_safe_errors(self):
        import sys
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as cwd:
            env = dict(os.environ)
            self.assertEqual(worker.run_child([sys.executable, '-c', 'print("ok")'], cwd, env, 3), 'ok\n')
            with self.assertRaisesRegex(worker.WorkerError, '^upstream_completion_uncertain$'):
                worker.run_child([sys.executable, '-c', 'import time;time.sleep(30)'], cwd, env, .1)
            with self.assertRaisesRegex(worker.WorkerError, '^upstream_completion_uncertain$'):
                worker.run_child([sys.executable, '-c', 'import sys;sys.stdout.write("x"*2000000)'], cwd, env, 3)
            with self.assertRaisesRegex(worker.WorkerError, '^upstream_failed$'):
                worker.run_child([sys.executable, '-c', 'import sys;print("secret-prompt");sys.exit(1)'], cwd, env, 3)

    def test_usage_transport_fixed_endpoint_account_no_redirects(self):
        import io
        seen = []
        def transport(request, timeout):
            seen.append(request)
            self.assertEqual(request.full_url, 'https://chatgpt.com/backend-api/wham/usage')
            self.assertEqual(request.get_method(), 'GET')
            self.assertEqual(request.get_header('Chatgpt-account-id'), 'test-account')
            self.assertEqual(request.get_header('Authorization'), 'Bearer test-token')
            return io.BytesIO(b'{"rate_limit": {}}')
        auth = {'tokens': {'access_token':'test-token','account_id':'test-account'}}
        self.assertEqual(worker.fetch_usage(auth, transport=transport), {'rate_limit':{}})
        self.assertEqual(len(seen), 1)
        def broken(*args, **kwargs): raise RuntimeError('secret-token')
        with self.assertRaisesRegex(worker.WorkerError, '^quota_unknown$'):
            worker.fetch_usage(auth, transport=broken)

    def test_invalid_auth_never_queries_or_launches(self):
        import copy
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            home = Path(tmp)
            calls = []
            def forbidden(*args, **kwargs):
                calls.append(True)
                raise RuntimeError('must not call upstream')
            engine = worker.Engine(home, 'node', 'cli', job_root=tmp, quota=forbidden, runner=forbidden)
            for change in ('mismatched_account', 'expired', 'nested_api_key', 'nan_expiry'):
                claims = {'exp':time.time()+600, 'https://api.openai.com/auth': {'chatgpt_account_id':'expected'}}
                account = 'expected'
                if change == 'mismatched_account': account = 'other'
                if change == 'expired': claims['exp'] = 1
                if change == 'nan_expiry': claims['exp'] = float('nan')
                payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip('=')
                auth = {'auth_mode':'chatgpt','tokens':{'access_token':'x.'+payload+'.x','account_id':account}}
                if change == 'nested_api_key': auth['tokens']['api_key'] = 'not-a-real-key'
                (home/'auth.json').write_text(json.dumps(auth))
                with self.subTest(change=change), self.assertRaises(worker.WorkerError):
                    engine.generate({'model':'gpt-image-2','prompt':'must not run'})
            self.assertEqual(calls, [])

    def test_postcheck_failure_preserves_uncertainty(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            claims = {'exp':time.time()+600,'https://api.openai.com/auth':{'chatgpt_account_id':'test'}}
            payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip('=')
            (Path(tmp)/'auth.json').write_text(json.dumps({'auth_mode':'chatgpt','tokens':{'access_token':'x.'+payload+'.x','account_id':'test'}}))
            checks = []
            def quota(auth):
                checks.append(True)
                if len(checks) == 2: raise RuntimeError('private details')
                return {'rate_limit': {'allowed':True,'limit_reached':False,'primary_window':{'limit_window_seconds':18000,'used_percent':1,'reset_at':time.time()+600}}}
            def timeout(*args): raise worker.WorkerError('upstream_completion_uncertain')
            engine = worker.Engine(tmp,'node','cli',job_root=tmp,quota=quota,runner=timeout)
            with self.assertRaisesRegex(worker.WorkerError, '^upstream_completion_uncertain$'):
                engine.generate({'model':'gpt-image-2','prompt':'fixture only'})
            self.assertEqual(len(checks), 2)


if __name__ == '__main__':
    unittest.main()
