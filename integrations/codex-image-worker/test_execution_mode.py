import tempfile,unittest
from worker import Engine,WorkerError
class ExecutionModeTests(unittest.TestCase):
 def test_unsandboxed_is_explicit_and_keeps_non_image_tools_disabled(self):
  with tempfile.TemporaryDirectory() as t:
   calls=[]
   def runner(argv,cwd,env,timeout):calls.append(argv);raise WorkerError('upstream_failed')
   e=Engine(t,'official-native.exe',None,job_root=t,runner=runner,minimum_remaining=30,execution_mode='summit-unsandboxed')
   e._check=lambda:{'remainingPercent':40,'resetAt':9999999999}
   with self.assertRaises(WorkerError):e.generate({'model':'gpt-image-2','prompt':'Synthetic argv test, no generation'})
   self.assertEqual(len(calls),1)
   argv=calls[0];self.assertEqual(argv[argv.index('--sandbox')+1],'danger-full-access')
   self.assertNotIn('default_permissions="image-only"',argv)
   for setting in ('features.shell_tool=false','features.browser_use=false','features.multi_agent=false','features.unified_exec=false'):self.assertIn(setting,argv)
   with self.assertRaises(ValueError):Engine(t,'unused',None,job_root=t,execution_mode='unspecified')
