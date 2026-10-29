"""Explicitly authorized Summit/no-sandbox image worker. No boot/service installation."""
import argparse,json,os,secrets,subprocess,getpass
from pathlib import Path
from worker import Engine,WorkerError
from http_worker import create_server

def create_runtime(home,executable,state,*,port=8648,accept_unsandboxed=False,minimum_remaining=20):
 if accept_unsandboxed is not True:raise ValueError('Explicit unsandboxed execution consent required')
 home,executable,state=Path(home).resolve(),Path(executable).resolve(),Path(state).absolute()
 if not home.is_dir() or not executable.is_file() or state.is_symlink():raise ValueError('Invalid dedicated runtime paths')
 state.mkdir(parents=True,exist_ok=True)
 # Only this dedicated state directory; no new users/firewall/sandbox initialization.
 if os.name=='nt':
  subprocess.run(['icacls',str(state),'/inheritance:r','/grant:r',getpass.getuser()+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=15)
 credential=state/'worker-access.key'
 if credential.is_symlink():raise ValueError('Invalid service credential path')
 if not credential.exists():
  with credential.open('x',encoding='utf-8') as f:f.write(secrets.token_urlsafe(48))
 token=credential.read_text(encoding='utf-8').strip()
 if len(token)<24:raise ValueError('Invalid local service credential')
 jobs=state/'jobs';jobs.mkdir(exist_ok=True)
 engine=Engine(home,executable,None,job_root=jobs,minimum_remaining=minimum_remaining,execution_mode='summit-unsandboxed')
 return create_server(engine,token,port=port),engine

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--accept-summit-unsandboxed',action='store_true',required=True)
 p.add_argument('--home',type=Path,required=True);p.add_argument('--executable',type=Path,required=True);p.add_argument('--state',type=Path,required=True)
 p.add_argument('--preflight',action='store_true')
 p.add_argument('--minimum-remaining',type=float,default=20)
 args=p.parse_args()
 if getpass.getuser().lower()!='summit':raise SystemExit('Expected explicitly authorized Summit identity')
 server,engine=create_runtime(args.home,args.executable,args.state,accept_unsandboxed=args.accept_summit_unsandboxed,minimum_remaining=args.minimum_remaining)
 try:
  admission=engine._check()
  print(json.dumps({'status':'preflight_passed' if args.preflight else 'ready','runAs':'Summit','executionMode':'summit-unsandboxed','minimumRemaining':engine.minimum_remaining,'bind':'127.0.0.1:8648','quota':admission}),flush=True)
  if not args.preflight:server.serve_forever()
 except WorkerError as e:
  print(json.dumps({'status':'admission_denied','error':str(e),'automaticRetry':False}),flush=True);raise SystemExit(3)
 finally:server.server_close()

if __name__=='__main__':main()
