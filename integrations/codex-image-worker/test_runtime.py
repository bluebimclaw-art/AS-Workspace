import tempfile,unittest
from pathlib import Path
import runtime
class RuntimeTests(unittest.TestCase):
 def test_runtime_requires_explicit_unsandboxed_consent(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);exe=root/'native.exe';exe.touch();home=root/'home';home.mkdir()
   with self.assertRaises(ValueError):runtime.create_runtime(home,exe,root/'state',port=0)
   server,engine=runtime.create_runtime(home,exe,root/'state',port=0,accept_unsandboxed=True)
   try:
    self.assertEqual(server.server_address[0],'127.0.0.1')
    self.assertEqual(engine.execution_mode,'summit-unsandboxed');self.assertEqual(engine.minimum_remaining,20)
    token=(root/'state'/'worker-access.key').read_text();self.assertGreaterEqual(len(token),24)
    self.assertTrue((root/'state'/'jobs').is_dir())
   finally:server.server_close()
