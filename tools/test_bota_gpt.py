import unittest
import json,tempfile,sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import bota_gpt as b

class BotaTests(unittest.TestCase):
 def fixture(self):
  text=('This is original test material written for testing Kosovo reporting with 25 verified facts. ')*12
  source={'title':'Kosovo','sourceParagraphs':[text,text]}
  result={'relevant':True,'sentiment':'neutral','reason':'Raportim faktik neutral.','albanianTitle':'Raportim për Kosovën','blurb':'Paraqiten faktet.','evidence':'','paragraphs':[text,text]}
  return source,result
 def test_full_translation_alignment_and_numbers(self):
  s,r=self.fixture();self.assertIs(b.validate_editorial(r,s),r)
  for change in [lambda r:r.update(paragraphs=['summary']),lambda r:r.update(paragraphs=['summary','summary']),lambda r:r.update(paragraphs=[p.replace('25','') for p in r['paragraphs']]),lambda r:r.update(evidence='invented quotation')]:
   s,r=self.fixture();change(r)
   with self.assertRaises(ValueError):b.validate_editorial(r,s)
 def test_non_neutral_evidence_is_required(self):
  s,r=self.fixture();r['sentiment']='negative'
  with self.assertRaises(ValueError):b.validate_editorial(r,s)
  r['evidence']='25 verified facts';self.assertIsNotNone(b.validate_editorial(r,s))
 def test_private_source_rejected_before_request(self):
  with patch('socket.getaddrinfo',return_value=[(2,1,6,'',('127.0.0.1',443))]):
   with self.assertRaises(ValueError):b.public_url('https://publisher.test/news')
  for url in ['http://example.org','https://user:pass@example.org','https://example.org:8080']:
   with self.assertRaises(ValueError):b.public_url(url)
 def test_saved_publication_retries_without_gpt_and_survives_http_failure(self):
  day=b.datetime.now(b.ZoneInfo('Europe/Belgrade')).date().isoformat()
  packet={'date':day,'model':b.MODEL,'reasoningEffort':b.EFFORT,'articles':[{'id':'verified'}]}
  report={'date':day,'articleCount':1,'responses':[{'actualModel':b.MODEL,'actualReasoningEffort':b.EFFORT}]}
  class Response:
   status_code=200
   text='Përkthim në shqip'
   def __init__(self,data):self.data=data
   def raise_for_status(self):pass
   def json(self):return self.data
  def get(url,**kwargs):return Response({'date':day,'alreadyPublished':False} if '/automation/' in url else {'outlets':{'lastUpdated':day}})
  from unittest.mock import Mock
  post=Mock(side_effect=[RuntimeError('Temporary publishing failure'),Response({'articleIds':['verified']})])
  with tempfile.TemporaryDirectory() as folder,patch.object(b,'RUN_STATE',Path(folder)),patch.object(b,'secret',return_value='test-secret'),patch.object(b,'resolve_runtime',side_effect=AssertionError('GPT must not be called')),patch.dict(sys.modules,{'httpx':SimpleNamespace(get=get,post=post)}):
   pending=Path(folder)/(day+'-pending.json');b.save_pending(packet,report,pending)
   with self.assertRaises(RuntimeError):b.run()
   self.assertTrue(pending.exists())
   result=b.run();self.assertEqual(result['result'],'published_verified');self.assertFalse(pending.exists())
   self.assertEqual(post.call_args.kwargs['json'],packet)
   self.assertEqual(json.loads((Path(folder)/'last-run.json').read_text())['articleCount'],1)
 def test_editorial_output_must_also_pass_actual_publisher_validator(self):
  day=b.datetime.now(b.ZoneInfo('Europe/Belgrade')).date().isoformat();source,result=self.fixture()
  article={**result,'url':'https://example.org/kosovo','title':'Kosovo','outlet':'Example','country':'Britani','date':day,'sourceHash':'a'*64,'complete':True,'actualModel':b.MODEL,'actualReasoningEffort':b.EFFORT}
  b.validate_publishable(article,day)
  article.pop('evidence')
  with self.assertRaisesRegex(ValueError,'Evidence'):b.validate_publishable(article,day)
if __name__=='__main__':unittest.main()
