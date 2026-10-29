import importlib.util,json,threading,unittest,urllib.request,urllib.error
from pathlib import Path
class HttpTests(unittest.TestCase):
 def test_authenticated_model_discovery_never_generates(self):
  import http_worker
  class NoGeneration:
   def generate(self,request):raise AssertionError('Discovery must never generate')
  token='synthetic-test-service-access-token';server=http_worker.create_server(NoGeneration(),token,port=0)
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   req=urllib.request.Request(f'http://127.0.0.1:{server.server_port}/v1/models',headers={'Authorization':'Bearer '+token})
   with urllib.request.urlopen(req,timeout=3) as response:result=json.load(response)
   self.assertEqual(result['data'],[{'id':'gpt-image-2','object':'model'}])
  finally:server.shutdown();server.server_close();thread.join()
 def test_authenticated_transport_returns_existing_image_fixture(self):
  import http_worker,base64
  png=Path(__file__).parent.parent.parent.joinpath('fixtures','native-teapot.png').read_bytes();calls=[]
  class FixtureEngine:
   def generate(self,request):
    calls.append(request)
    return {'mime':'image/png','base64':base64.b64encode(png).decode(),'quotaBefore':{'remainingPercent':80},'quotaAfter':{'remainingPercent':80}}
  token='synthetic-test-service-access-token';server=http_worker.create_server(FixtureEngine(),token,port=0)
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   body={'model':'gpt-image-2','prompt':'Existing real fixture replay; no model request','n':1,'output_format':'png'}
   req=urllib.request.Request(f'http://127.0.0.1:{server.server_port}/v1/images/generations',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+token})
   with urllib.request.urlopen(req,timeout=3) as response:result=json.load(response)
   self.assertEqual(base64.b64decode(result['data'][0]['b64_json']),png)
   self.assertEqual(calls,[{'model':body['model'],'prompt':body['prompt'],'references':[]}])
  finally:server.shutdown();server.server_close();thread.join()
 def test_unauthorized_request_never_reaches_engine(self):
  path=Path(__file__).with_name('http_worker.py')
  self.assertTrue(path.is_file(),'HTTP worker authentication boundary is not implemented')
  spec=importlib.util.spec_from_file_location('candidate_http_worker',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  class NoGeneration:
   def generate(self,request):raise AssertionError('Unauthorized generation')
  server=m.create_server(NoGeneration(),'synthetic-test-service-access-token',port=0)
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   url=f'http://127.0.0.1:{server.server_port}/v1/images/generations'
   req=urllib.request.Request(url,data=b'{}',headers={'Content-Type':'application/json'})
   with self.assertRaises(urllib.error.HTTPError) as err:urllib.request.urlopen(req,timeout=3)
   self.assertEqual(err.exception.code,401)
  finally:server.shutdown();server.server_close();thread.join()
