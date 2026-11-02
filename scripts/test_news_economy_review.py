import hashlib
import tempfile
import unittest
from datetime import datetime,timezone
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from news_story_review import review_inventory,selection_ready,editorial_prompt,review_policy,source_digest
from news_source_policy import MANIFEST,load_manifest
from news_ingestion import seed_routes
from news_coverage import plan_counts,balance,batch_ceiling
from journalism_quality_gate import journalism_errors
from news_showbiz_article_visual import capture_article_photo
from news_image_policy import publisher_photo_allowed

class EconomyReviewTests(unittest.TestCase):
 def test_every_economy_publisher_enabled_with_explicit_discovery_route(self):
  manifest=load_manifest(); pubs=[p for p in manifest['publishers'] if p['category']=='Ekonomi']
  self.assertEqual(len(pubs),14)
  for pub in pubs:
   self.assertTrue(pub.get('hourly_primary',True),pub['source'])
   self.assertTrue(any(r['source']==pub['source'] for r in manifest['browser_lanes']),pub['source'])
   self.assertTrue(any(r['source']==pub['source'] for r in seed_routes(manifest)))

 def test_economy_visual_verdict_is_source_bound_and_other_desks_stay_out(self):
  now=datetime.now(timezone.utc);url='https://monitor.al/rriten-pagat/'
  lead=dict(category='Ekonomi',source='Monitor',url=url,title='Pagat rriten në shtator',published=now.isoformat())
  evidence=dict(status='text_extracted',url=url,title=lead['title'],text='Salary data increased this September. '*100,published=lead['published'])
  def capture(url,publisher,folder,**kwargs):
   folder.mkdir(parents=True,exist_ok=True);p=folder/'pixels.png';Image.new('RGB',(500,350),'white').save(p)
   return dict(url=url,screenshot=str(p),full_screenshot=str(p),screenshot_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),full_screenshot_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),captured_at=now.isoformat(),evidence=evidence,visual_layout_complete=True,visual_page_complete=True)
  def verdict(*args):
   return [dict(decision='consider',score=5,reason='A specific dated income change.',new_development='New wage release.',audience_fit='Albanian income data.',breaking='fresh_development',same_event_urls=[])]
  with tempfile.TemporaryDirectory() as root,patch('builtins.print'):
   records,report=review_inventory([lead,dict(lead,category='Showbiz',url='https://prive.al/story')],{url:evidence},[],root,category='Ekonomi',now=now,capturer=capture,reviewer=verdict)
   self.assertEqual(list(records),[url]);self.assertEqual(report['summary']['registered_publishers'],14)
   self.assertEqual(records[url]['review']['policy'],review_policy('Ekonomi'))
   self.assertTrue(selection_ready(lead,records[url],evidence,now))
   self.assertFalse(selection_ready(lead,records[url],dict(evidence,text='Changed facts'),now))

 def test_economy_source_image_has_exact_source_bound_provenance(self):
  from io import BytesIO
  now=datetime.now(timezone.utc);url='https://monitor.al/rriten-pagat/'
  publisher=next(p for p in MANIFEST['publishers'] if p['source']=='Monitor')
  evidence=dict(url=url,requested_url=url,status='text_extracted',text='Readable article. '*80,published=now.isoformat(),fetched_at=now.isoformat(),image_url='https://monitor.al/image.jpg')
  raw=BytesIO();Image.new('RGB',(800,600),'white').save(raw,format='JPEG')
  with tempfile.TemporaryDirectory() as folder:
   record=capture_article_photo(url,publisher,Path(folder),public_evidence=evidence,image_fetcher=lambda _:raw.getvalue())
   self.assertEqual(record['visual_evidence_kind'],'source_article_image')
   self.assertFalse(record['visual_layout_complete'])
   self.assertTrue(publisher_photo_allowed(dict(category='Ekonomi',url=url),dict(image_rights=dict(provider='publisher-article',source_page=url,reuse_basis='owner_requested_source_image',license='Not established',license_url=''))))

 def test_economy_photo_policy_does_not_allow_different_publisher_or_other_desk(self):
  from news_image_policy import article_photo_options
  lead=dict(category='Ekonomi',url='https://monitor.al/wages',title='Pagat rriten')
  evidence=dict(status='text_extracted',url=lead['url'],image_url='https://monitor.al/wages.jpg',title='Wages')
  options=article_photo_options(lead,evidence)
  self.assertTrue(options)
  self.assertEqual(options[0]['photo']['image_rights']['license'],'Not established')
  self.assertFalse(article_photo_options(lead,dict(evidence,url='https://cnbc.com/another-story')))
  self.assertFalse(article_photo_options(dict(lead,category='Botë'),evidence))
  from codex_automation_support import image_minimum
  from news_image_policy import finalize_photo
  self.assertEqual(image_minimum({**lead,**options[0]['photo']}),(600,350))
  with patch.dict('os.environ',{'L383_HOURLY_NEWS':'1'}):
   self.assertEqual(finalize_photo(lead,options[0]),{})  # Pixels are still mandatory.


 def test_native_batch_uses_economy_rules_instead_of_celebrity_rules(self):
  import json
  from news_showbiz_batch_review import native_batch_review
  with tempfile.TemporaryDirectory() as folder:
   brief=Path(folder)/'brief.json';brief.write_text(json.dumps([{'category':'Ekonomi'}]))
   with patch('news_showbiz_batch_review.ask_rows',return_value=[]) as ask:
    native_batch_review(brief,Path(folder)/'pixels.png',123)
   prompt=ask.call_args.args[0]
   self.assertIn('percentage points',prompt)
   self.assertIn('review_id: string',prompt)
   self.assertNotIn('tattoo',prompt)

 def test_economy_can_expand_without_expanding_world(self):
  plan=plan_counts({'Ekonomi':12,'Botë':10,'Showbiz':4})
  self.assertEqual(plan['Ekonomi'],12);self.assertEqual(plan['Botë'],3)
  rows=[dict(category='Ekonomi')]*12+[dict(category='Botë')]*10
  self.assertEqual(len(balance(rows,plan)),15)
  self.assertEqual(batch_ceiling(rows),29)

 def test_short_economy_brief_allowed_but_world_keeps_length_floor(self):
  article=dict(category='Ekonomi',body='<p>'+('Të dhënat e reja tregojnë ndryshime të pagave gjatë muajit. '*6)+'</p>')
  self.assertFalse(any('words' in e or 'paragraph' in e for e in journalism_errors(article)))
  self.assertTrue(any('words' in e or 'paragraph' in e for e in journalism_errors(dict(article,category='Botë'))))
  prompt=editorial_prompt('Ekonomi')
  self.assertIn('percentage points',prompt);self.assertIn('at least 5',prompt)
  self.assertNotIn('tattoo',prompt)

if __name__=='__main__':unittest.main()
