import unittest
from unittest.mock import patch, MagicMock
import operator_mail_worker as worker

class OperatorMailTests(unittest.TestCase):
 def test_sends_from_own_gmail_and_rejects_other_recipients(self):
  config={'GMAIL_USER':'lindsylqa@gmail.com','GMAIL_APP_PASSWORD':'secret'}
  payload={'to':'lindsylqa@gmail.com','subject':'Report','html':'<p>Report</p>'}
  with patch.object(worker.smtplib,'SMTP_SSL') as smtp:
   smtp.return_value.send_message.return_value={}
   smtp.return_value.quit.side_effect=worker.smtplib.SMTPResponseException(451,b'quit failed')
   smtp.return_value.close.side_effect=OSError('close failed after DATA')
   worker.send(payload,config,'test')
   smtp.return_value.quit.assert_not_called()
   message=smtp.return_value.send_message.call_args.args[0]
   self.assertIn('lindsylqa@gmail.com',message['From'])
   self.assertEqual(message['To'],'lindsylqa@gmail.com')
   self.assertEqual(smtp.call_args.args[:2],('smtp.gmail.com',465))
   with self.assertRaises(ValueError):worker.send({**payload,'to':'other@example.com'},config,'test')
 def test_failed_receipt_never_repeats_accepted_smtp(self):
  def api(config,path,body):
   if path.endswith('claim_site_smtp_mail'):return [{'id':'test','payload':{}}]
   raise OSError('receipt unavailable')
  sender=MagicMock()
  with patch.object(worker,'decode_job',return_value={}):
   with self.assertRaises(OSError):worker.run({'NEWSLETTER_SECRET':'secret'},api_call=api,sender=sender)
  sender.assert_called_once()
 def test_uncertain_smtp_is_held(self):
  results=[];claims=iter([[{'id':'test','payload':{}}],[]])
  def api(config,path,body):
   if path.endswith('claim_site_smtp_mail'):return next(claims)
   results.append(body)
  with patch.object(worker,'decode_job',return_value={}):
   worker.run({'NEWSLETTER_SECRET':'secret'},api_call=api,sender=MagicMock(side_effect=OSError('connection lost')))
  self.assertEqual(results[0]['p_status'],'held')
if __name__=='__main__':unittest.main()
