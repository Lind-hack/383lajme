import os
import unittest
from unittest.mock import patch
import codex_automation_support as support

class ReportsTests(unittest.TestCase):
 def test_resend_config_cannot_override_smtp_or_become_failure_fallback(self):
  with patch.object(support,'load_env'),patch.dict(os.environ,{'RESEND_API_KEY':'key','EMAIL_PRIMARY':'resend','GMAIL_USER':'lindsylqa@gmail.com','GMAIL_APP_PASSWORD':'pass'}),patch.object(support,'_send_gmail_report',return_value=1) as smtp,patch.object(support.urllib.request,'urlopen',side_effect=AssertionError('HTTP mail forbidden')):
   self.assertEqual(support.send_html_report('lindsylqa@gmail.com','Monitor','<p>Report</p>'),1)
   self.assertEqual(support.send_status_report('No new stories',phase='completed'),1)
   self.assertEqual(smtp.call_count,2)
 def test_resend_key_alone_is_not_a_report_sender(self):
  with patch.object(support,'load_env'),patch.dict(os.environ,{'RESEND_API_KEY':'key','GMAIL_USER':'','GMAIL_APP_PASSWORD':''}),patch.object(support.urllib.request,'urlopen',side_effect=AssertionError('HTTP forbidden')):
   self.assertEqual(support.send_html_report('lindsylqa@gmail.com','Monitor','<p>Report</p>'),2)
if __name__=='__main__':unittest.main()
