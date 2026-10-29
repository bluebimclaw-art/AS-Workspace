import unittest
from worker import admit,Engine,WorkerError
class ThresholdTests(unittest.TestCase):
 def test_task_scoped_thirty_percent_boundary(self):
  auth={'auth_mode':'chatgpt','tokens':{'access_token':'synthetic','account_id':'synthetic'}}
  def usage(remaining):return {'rate_limit':{'allowed':True,'limit_reached':False,'primary_window':{'limit_window_seconds':18000,'used_percent':100-remaining,'reset_at':9999999999}}}
  for remaining in (30,30.01,50):
   self.assertAlmostEqual(admit(auth,usage(remaining),1,token_expiry=9999999999,minimum_remaining=30)['remainingPercent'],remaining)
  for remaining in (29.99,0):
   with self.assertRaises(WorkerError):admit(auth,usage(remaining),1,token_expiry=9999999999,minimum_remaining=30)
  for floor in (True,-1,101,float('nan')):
   with self.assertRaises(WorkerError):admit(auth,usage(50),1,token_expiry=9999999999,minimum_remaining=floor)
  e=Engine('.','unused',None,job_root='.',minimum_remaining=30)
  self.assertEqual(e.minimum_remaining,30)
 def test_twenty_percent_boundary_and_unknown_usage_fail_closed(self):
  auth={'auth_mode':'chatgpt','tokens':{'access_token':'synthetic','account_id':'synthetic'}}
  for remaining in (19.99,20,20.01):
   usage={'rate_limit':{'allowed':True,'limit_reached':False,'primary_window':{'limit_window_seconds':18000,'used_percent':100-remaining,'reset_at':9999999999}}}
   with self.subTest(remaining=remaining):
    if remaining<20:
     with self.assertRaises(WorkerError):admit(auth,usage,1,token_expiry=9999999999,minimum_remaining=20)
    else:self.assertAlmostEqual(admit(auth,usage,1,token_expiry=9999999999,minimum_remaining=20)['remainingPercent'],remaining)
  with self.assertRaises(WorkerError):admit(auth,{},1,token_expiry=9999999999,minimum_remaining=20)
