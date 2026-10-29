"""Loopback-only authenticated transport. No paid API fallback or CORS."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json,secrets,threading
from worker import WorkerError

def create_server(engine,token,*,port=8648):
 if not isinstance(token,str) or len(token)<24:raise ValueError('Service access credential required')
 permit=threading.Lock()
 class Handler(BaseHTTPRequestHandler):
  def setup(self):
   super().setup();self.connection.settimeout(5)
  def log_message(self,*args):pass
  def send_json(self,status,data):
   body=json.dumps(data).encode('utf-8')
   self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
  def allowed(self):
   if self.headers.get('Origin') or self.headers.get('Host')!=f'127.0.0.1:{self.server.server_port}':
    self.send_json(403,{'error':'origin_or_host_denied'});return False
   if not secrets.compare_digest(self.headers.get('Authorization',''), 'Bearer '+token):
    self.send_json(401,{'error':'authentication_required'});return False
   return True
  def do_POST(self):
   if not self.allowed():return
   if self.path!='/v1/images/generations':return self.send_json(404,{'error':'unknown_route'})
   if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.send_json(400,{'error':'invalid_request'})
   try:
    length=int(self.headers.get('Content-Length','0'))
    if not 0<length<=40000:return self.send_json(413,{'error':'request_too_large'})
    body=json.loads(self.rfile.read(length))
    if not isinstance(body,dict) or set(body)-{'model','prompt','n','output_format','references'} or type(body.get('n',1)) is not int or body.get('n',1)!=1 or body.get('output_format','png')!='png':raise ValueError()
   except (ValueError,UnicodeError,OSError):return self.send_json(400,{'error':'invalid_request'})
   if not permit.acquire(blocking=False):return self.send_json(409,{'error':'worker_busy_no_retry'})
   try:
    result=engine.generate({'model':body.get('model'),'prompt':body.get('prompt'),'references':body.get('references',[])})
    self.send_json(200,{'data':[{'b64_json':result['base64']}],'quotaBefore':result['quotaBefore'],'quotaAfter':result['quotaAfter']})
   except WorkerError as error:
    code=str(error);known={'subscription_admission_denied','quota_unknown','invalid_request','references_unsupported','upstream_completion_uncertain','postcheck_failed_completion_uncertain','upstream_failed','invalid_native_image','generation_failed_completion_uncertain'}
    code=code if code in known else 'worker_failed'
    self.send_json(429 if code in {'subscription_admission_denied','quota_unknown'} else 400 if code in {'invalid_request','references_unsupported'} else 502,{'error':code,'automaticRetry':False})
   except (BrokenPipeError,ConnectionResetError):pass
   except Exception:self.send_json(502,{'error':'worker_failed_completion_uncertain','automaticRetry':False})
   finally:permit.release()
  def do_GET(self):
   if not self.allowed():return
   if self.path=='/v1/models':return self.send_json(200,{'data':[{'id':'gpt-image-2','object':'model'}]})
   self.send_json(404,{'error':'unknown_route'})
 class Server(ThreadingHTTPServer):
  daemon_threads=True
  request_queue_size=4
 return Server(('127.0.0.1',port),Handler)
