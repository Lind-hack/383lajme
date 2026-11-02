import json,tempfile,unittest
from pathlib import Path
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
from news_homepage_priority import is_homepage,publisher_frontpage
from news_economy_policy import review_queue,selection_order
from news_ingestion import seed_routes,_execute
from news_source_policy import load_manifest

NOW=datetime.now(timezone.utc)
def lead(source,url,position=None,title='Prices rise for consumers'):
 row=dict(source=source,url=url,category='Ekonomi',published=NOW.isoformat(),title=title)
 if position is not None:row['homepage']=dict(position=position,article_count=60,observed_at=NOW.isoformat(),method='public_html_dom_order')
 return row
class EconomyHomepageTests(unittest.TestCase):
 def test_configured_business_frontpage_is_exactly_scoped(self):
  pub=dict(source='CNBC',category='Ekonomi',domains=['cnbc.com'],homepage_urls=['https://www.cnbc.com/economy/'])
  self.assertTrue(is_homepage('https://www.cnbc.com/economy',pub))
  self.assertTrue(is_homepage('https://www.cnbc.com/',pub))
  for url in ['https://www.cnbc.com/economy/article','https://attacker.example/economy','https://www.cnbc.com/economy?claimed=1','https://name@www.cnbc.com/economy']:
   self.assertFalse(is_homepage(url,pub),url)
  self.assertEqual(publisher_frontpage(pub),'https://www.cnbc.com/economy/')

 def test_frontpage_collection_precedes_rss_without_starving_existing_desks(self):
  economy=dict(source='CNBC',category='Ekonomi',domains=['cnbc.com'],homepage_urls=['https://www.cnbc.com/economy/'])
  other=dict(source='Anabel',category='Showbiz',domains=['anabelmagazine.com'])
  m=dict(publishers=[economy,other],feeds=[dict(source='CNBC',url='https://www.cnbc.com/feed')],browser_lanes=[dict(source='Anabel',url='https://anabelmagazine.com/')])
  routes=seed_routes(m);front=next(r for r in routes if r['url']==economy['homepage_urls'][0])
  self.assertTrue(front['hint']['_homepage_root'])
  self.assertLess(front['priority'],next(r['priority'] for r in routes if r['kind']=='feed'))
  self.assertEqual([r['priority'] for r in routes if r['source']=='Anabel' and r['kind']=='listing'],[0,-1])

 def test_business_frontpage_saves_real_rendered_order(self):
  pub=dict(source='CNBC',category='Ekonomi',domains=['cnbc.com'],homepage_urls=['https://www.cnbc.com/economy/'])
  url=pub['homepage_urls'][0];article='https://www.cnbc.com/2026/11/02/wages.html'
  task=dict(source='CNBC',kind='listing',url=url,hint={'_homepage_root':True})
  with patch('news_ingestion.is_homepage',wraps=is_homepage):
   result=_execute(task,{'CNBC':pub},{},NOW,lambda *a,**kw:dict(url=url,payload=f'<h2><a href="{article}">Wages rise after new release</a></h2>'.encode(),headers={}),renderer=lambda *a,**kw:dict(url=url,articles=[dict(url=article,geometry=dict(top=20,left=10,width=400,height=200))],method='public_browser_geometry',viewport=dict(width=1440,height=1000)))
  self.assertEqual(result['homepage']['method'],'public_browser_geometry')
  self.assertEqual(result['homepage']['articles'][0]['url'],article)

 def test_top_three_get_turns_before_backlog_with_local_sources_first(self):
  lower=lead('CNBC','https://cnbc.com/lower',12)
  local=lead('Monitor','https://monitor.al/local',2)
  first=lead('CNBC','https://cnbc.com/first',1)
  backup=lead('CNBC','https://cnbc.com/second',3)
  unfeatured=lead('Monitor','https://monitor.al/unfeatured')
  rows=review_queue([lower,unfeatured,backup,first,local],NOW)
  self.assertEqual([r['url'] for r in rows[:3]],[local['url'],first['url'],backup['url']])
  self.assertLess(rows.index(lower),rows.index(unfeatured))

 def test_stale_homepage_does_not_promote_and_sponsored_stays_reserve(self):
  top=lead('CNBC','https://cnbc.com/top',1)
  stale=lead('CNBC','https://cnbc.com/old',1)
  stale['homepage']['observed_at']=(NOW-timedelta(hours=2)).isoformat()
  sponsored=dict(top,url='https://cnbc.com/sponsored',tags=['sponsored'])
  self.assertEqual(review_queue([sponsored,stale,top],NOW),[top,stale,sponsored])

 def test_off_topic_pages_do_not_consume_native_review_calls(self):
  from news_story_review import review_inventory
  off=lead('Ekonomia Online','https://ekonomiaonline.com/dua-lipa',1,'Dua Lipa shfaqet me fustan në koncert')
  with tempfile.TemporaryDirectory() as root,patch('builtins.print'):
   records,report=review_inventory([off],{off['url']:dict(text='The singer performed music at a concert.',status='text_extracted')},[],root,category='Ekonomi',budget_seconds=.001,capturer=lambda *a,**kw:(_ for _ in ()).throw(ValueError('no capture needed')),reviewer=lambda *a:(_ for _ in ()).throw(AssertionError('off-topic article must not be reviewed')))
  self.assertFalse(records)
  self.assertEqual(report['summary']['excluded_off_topic_articles'],1)

 def test_preparation_keeps_prominent_short_update_before_unfeatured_length(self):
  from prepare_editor_sources import prioritize_grounded_leads
  top=lead('CNBC','https://cnbc.com/top',1);top['primary_evidence']=dict(status='text_extracted',text='Grounded fact. '*30)
  lower=lead('CNBC','https://cnbc.com/lower',20);lower['primary_evidence']=dict(status='text_extracted',text='Grounded fact. '*300)
  self.assertEqual(prioritize_grounded_leads([lower,top],now=NOW),[top,lower])
 def test_guardian_business_does_not_take_over_world_articles(self):
  from news_source_policy import publisher_for,source_error,independent
  self.assertEqual(publisher_for('https://theguardian.com/business/2026/nov/02/company')['source'],'The Guardian Business')
  self.assertEqual(publisher_for('https://theguardian.com/world/2026/nov/02/event')['source'],'The Guardian')
  self.assertEqual(publisher_for('https://theguardian.com/businesslike/story')['source'],'The Guardian')
  self.assertIsNone(source_error('Ekonomi','https://theguardian.com/money/2026/nov/02/prices'))
  self.assertIsNotNone(source_error('Botë','https://theguardian.com/business/2026/nov/02/company'))
  self.assertFalse(independent('https://theguardian.com/business/a','https://theguardian.com/world/b'))
  pub=next(p for p in load_manifest()['publishers'] if p['source']=='The Guardian Business')
  routes=seed_routes(dict(publishers=[pub],feeds=[],browser_lanes=[]))
  self.assertEqual([r['url'] for r in routes],pub['homepage_urls'])
  self.assertFalse(is_homepage('https://theguardian.com/',pub))

 def test_overlapping_sections_and_foreign_frontpages_are_rejected(self):
  m=load_manifest();business=next(p for p in m['publishers'] if p['source']=='The Guardian Business')
  for change in ({'source':'Duplicate section','path_prefixes':['/business/economics/']},{'source':'Foreign frontpage','domains':['another.example'],'homepage_urls':['https://theguardian.com/business/']}):
   copy=json.loads(json.dumps(m));copy['publishers'].append(dict(business,**change))
   with tempfile.TemporaryDirectory() as folder:
    p=Path(folder)/'manifest.json';p.write_text(json.dumps(copy),encoding='utf-8')
    with self.assertRaises(ValueError):load_manifest(p)

 def test_consumer_cost_and_income_news_remain_eligible(self):
  from news_source_policy import topic_error
  for title in ['Consumer prices rise in October','Wages increase across private employers','Shtesat për fëmijë rriten nga janari','GDP grows after stronger household spending']:
   self.assertIsNone(topic_error('Ekonomi',title),title)

 def test_six_story_batch_preserves_each_complete_source_and_identity(self):
  import hashlib
  from PIL import Image
  from news_story_review import review_inventory
  rows=[lead('CNBC',f'https://www.cnbc.com/wages-{n}',n+1,f'Wages rise for company {n}') for n in range(6)]
  texts={r['url']:'New published salary figures. '*60+f' LAST UNIQUE FACT {n}.' for n,r in enumerate(rows)}
  evidence={r['url']:dict(url=r['url'],status='text_extracted',published=r['published'],text=texts[r['url']]) for r in rows}
  def capture(url,pub,folder,**kw):
   folder.mkdir(parents=True,exist_ok=True);pic=folder/'pixels.png';Image.new('RGB',(200,120),'white').save(pic)
   sha=hashlib.sha256(pic.read_bytes()).hexdigest()
   return dict(url=url,screenshot=str(pic),full_screenshot=str(pic),screenshot_sha256=sha,full_screenshot_sha256=sha,
    captured_at=NOW.isoformat(),evidence=evidence.get(url,{}),visual_layout_complete=True,visual_page_complete=True)
  lengths=[]
  def batch(brief,image,deadline):
   payload=json.loads(brief.read_text());lengths.append(len(payload))
   for item in payload:self.assertEqual(item['complete_article_text'],texts[item['url']])
   return [dict(review_id=r['review_id'],decision='consider',score=5,reason='A dated new income figure.',new_development='New salary release.',audience_fit='Income news.',breaking='fresh_development',same_event_urls=[]) for r in payload]
  with tempfile.TemporaryDirectory() as folder,patch('builtins.print'):
   records,report=review_inventory(rows,evidence,[],folder,category='Ekonomi',capturer=capture,batch_reviewer=batch,now=NOW)
  self.assertEqual(lengths,[6])
  self.assertEqual(report['summary']['reviewed_articles'],6)
  self.assertTrue(all(r['review']['decision']=='consider' for r in records.values()))

 def test_each_active_publisher_gets_a_lead_before_busy_source_extras(self):
  busy=[lead('CNBC',f'https://cnbc.com/company-{n}',n+1) for n in range(8)]
  guardian=lead('The Guardian Business','https://theguardian.com/business/latest',18)
  rows=review_queue([*busy,guardian],NOW)
  self.assertEqual([r['source'] for r in rows[:2]],['CNBC','The Guardian Business'])
  self.assertEqual(rows[2:],busy[1:])

if __name__=='__main__':unittest.main()
