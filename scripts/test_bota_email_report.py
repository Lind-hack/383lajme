import unittest
from unittest.mock import Mock
from bota_email_report import verify_public,render_report,send_report

class EmailTests(unittest.TestCase):
 def outcome(self,result='already_published'):
  return {'status':'ok','result':result,'date':'2026-10-02','articleCount':1,'responses':[{'actualModel':'gpt-6-luna','actualReasoningEffort':'xhigh'}],'public':{'http':200,'articleCount':1,'readerCount':1,'readerUrls':['https://383ks.com/bota-per-kosoven/artikull/'+'a'*64]}}
 def test_reports_distinguish_existing_publication_fresh_test_and_failed_run(self):
  existing=render_report(self.outcome(),'start','finish');self.assertIn('no GPT call needed',existing['text']);self.assertIn('preserved existing batch',existing['text'])
  dry=render_report(self.outcome('dry_run_no_publication'),'start','finish');self.assertIn('TEST PASSED',dry['subject']);self.assertIn('No — test only',dry['text'])
  failed=render_report({'status':'failed','date':'2026-10-02','reason':'TimeoutError'},'start','finish');self.assertIn('FAILED',failed['subject']);self.assertNotIn('SUCCESS',failed['subject'])
  with self.assertRaises(ValueError):render_report({'status':'ok','result':'already_published','date':'2026-10-02'},'start','finish')
 def test_reader_failure_and_wrong_actual_model_cannot_produce_verified_success(self):
  class Response:
   def __init__(self,data=None,text=''):self.data=data;self.text=text
   def raise_for_status(self):pass
   def json(self):return self.data
  card={'id':'a'*64,'firstSeen':'2026-10-02','readerUrl':'/bota-per-kosoven/artikull/'+'a'*64,'albanianTitle':'Kosova & bota'}
  snapshot={'outlets':{'lastUpdated':'2026-10-02','stanceVersion':5,'totalArticles':1,'countries':{'Britani':{'outlets':[{'articles':[card]}]}}}}
  with self.assertRaises(ValueError):verify_public(self.outcome(),get=Mock(side_effect=[Response(snapshot),Response(text='missing reader')]))
  fresh=self.outcome('dry_run_no_publication');fresh['responses'][0]['actualModel']='other-model'
  with self.assertRaises(ValueError):verify_public(fresh,get=Mock(side_effect=[Response(snapshot),Response(text='Përkthim në shqip Kosova &amp; bota')]))
  valid=verify_public(self.outcome(),get=Mock(side_effect=[Response(snapshot),Response(text='Përkthim në shqip Kosova &amp; bota')]));self.assertEqual(valid['readerCount'],1)
 def test_smtp_acceptance_uses_only_configured_sender_and_confirmed_recipient(self):
  server=Mock();server.send_message.return_value={}
  result=send_report(render_report(self.outcome(),'start','finish'),config={'EMAIL_ADDRESS':'sender@example.org','EMAIL_PASSWORD':'test-only'},smtp_factory=Mock(return_value=server))
  self.assertEqual(result['recipient'],'lindsylqa@gmail.com');self.assertEqual(result['status'],'accepted');server.starttls.assert_called_once();server.login.assert_called_once_with('sender@example.org','test-only')
  server.send_message.return_value={'lindsylqa@gmail.com':(550,'refused')}
  with self.assertRaises(RuntimeError):send_report(render_report(self.outcome(),'start','finish'),config={'EMAIL_ADDRESS':'sender@example.org','EMAIL_PASSWORD':'test-only'},smtp_factory=Mock(return_value=server))
if __name__=='__main__':unittest.main()
