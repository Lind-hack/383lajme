import unittest
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
if __name__=='__main__':unittest.main()
