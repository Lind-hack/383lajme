import hashlib
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from news_story_review import (capture, review_inventory, selection_ready, validate_verdict,
                               digest, reusable, showbiz_inventory, POLICY)

NOW=datetime.now(timezone.utc)
URL='https://consequence.net/2026/11/new-album/'
LEAD=dict(url=URL,source='Consequence',category='Showbiz',title='Dua Lipa announces a new album',
          published=NOW.isoformat())
EVIDENCE=dict(status='text_extracted',url=URL,title=LEAD['title'],published=NOW.isoformat(),
              text='Dua Lipa announced a new album today. '*100+'FINAL VERIFIED FACT.')


def fake_capture(url,publisher,folder,**kwargs):
    folder.mkdir(parents=True,exist_ok=True)
    page=folder/'page.png'; full=folder/'page.full.png'
    Image.new('RGB',(200,150),'white').save(page)
    Image.new('RGB',(200,200),'white').save(full)
    return dict(url=url,screenshot=str(page),full_screenshot=str(full),visual_page_complete=True,
                screenshot_sha256=hashlib.sha256(page.read_bytes()).hexdigest(),
                full_screenshot_sha256=hashlib.sha256(full.read_bytes()).hexdigest(),
                captured_at=NOW.isoformat(),evidence=EVIDENCE)


def verdict(**values):
    row=dict(decision='consider',score=8,reason='A concrete new release by a recognized Albanian artist.',
                 new_development='Album announced today.',audience_fit='Dua Lipa has direct Albanian audience relevance.',
                 breaking='fresh_development',same_event_urls=[])
    row.update(values)
    return [row]


class StoryReviewTests(unittest.TestCase):
    def test_production_relative_report_folder_accepts_absolute_capture_paths(self):
        from contextlib import chdir
        def absolute_capture(*args,**kwargs):
            record=fake_capture(*args,**kwargs)
            for field in ('screenshot','full_screenshot'):record[field]=str(Path(record[field]).resolve())
            return record
        with tempfile.TemporaryDirectory() as folder,chdir(folder),patch('builtins.print'):
            target=Path('.last30days/showbiz-review')
            records,_=review_inventory([dict(LEAD)],{URL:EVIDENCE},[{'source':'Consequence','category':'Showbiz','status':'incomplete'}],target,
                                      capturer=absolute_capture,reviewer=lambda *args:verdict(),now=NOW)
            self.assertEqual(records[URL]['status'],'reviewed')
            report=(target/'index.html').read_text(encoding='utf-8')
            self.assertIn('src="publishers/',report)
            self.assertIn('src="articles/',report)

    def test_homepage_work_reserves_time_for_article_reviews(self):
        clock=[0.0]
        def slow_home(url,publisher,folder,**kwargs):
            if not kwargs.get('article'): clock[0]+=40
            return fake_capture(url,publisher,folder,**kwargs)
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'), \
                patch('news_story_review.time.monotonic',side_effect=lambda:clock[0]):
            records,result=review_inventory([dict(LEAD)],{URL:EVIDENCE},[],folder,
                budget_seconds=300,capturer=slow_home,reviewer=lambda *args:verdict(score=5),now=NOW)
            self.assertLess(result['summary']['captured_homepages'],14)
            self.assertEqual(records[URL]['status'],'reviewed')
            self.assertTrue(selection_ready(LEAD,records[URL],EVIDENCE,NOW))

    def test_capture_only_resumption_does_not_recapture_already_complete_articles(self):
        articles=[]
        def tracked(url,publisher,folder,**kwargs):
            if kwargs.get('article'): articles.append(url)
            return fake_capture(url,publisher,folder,**kwargs)
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'):
            for _ in range(3):
                records,report=review_inventory([dict(LEAD)],{URL:EVIDENCE},[],folder,
                    capturer=tracked,capture_only=True,now=NOW)
            self.assertEqual(articles,[URL])
            self.assertEqual(report['summary']['reviewed_articles'],0)
            self.assertEqual(records[URL]['status'],'captured')

    def test_readable_showbiz_pages_reach_editor_before_keyword_filtering(self):
        from news_ingestion_store import Inventory
        with tempfile.TemporaryDirectory() as folder:
            state=Path(folder)/'inventory.sqlite'
            store=Inventory(state)
            store.save_evidence('Consequence',URL,{},dict(EVIDENCE,title='A newly reported development',text='No category keywords.'))
            store.save_evidence('Consequence',URL+'old',{},dict(EVIDENCE,published=(NOW-timedelta(days=3)).isoformat()))
            store.close()
            leads,evidence=showbiz_inventory(state,NOW)
            self.assertEqual([lead['url'] for lead in leads],[URL])
            self.assertEqual(evidence[URL]['text'],'No category keywords.')

    def test_low_scoring_consider_decision_cannot_enter_writing(self):
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'):
            records,_=review_inventory([LEAD],{URL:EVIDENCE},[],folder,
                capturer=fake_capture,reviewer=lambda *args:verdict(score=4),now=NOW)
            self.assertFalse(selection_ready(LEAD,records[URL],EVIDENCE,NOW))

    def test_subsequent_preparation_uses_the_exact_recaptured_text(self):
        current=dict(EVIDENCE,text='Updated confirmed event facts. '*100)
        def changed(*args,**kwargs): return {**fake_capture(*args,**kwargs),'evidence':current}
        evidence={URL:EVIDENCE}
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'):
            records,_=review_inventory([dict(LEAD)],evidence,[],folder,
                capturer=changed,reviewer=lambda *args:verdict(),now=NOW)
            self.assertEqual(evidence[URL],current)
            from prepare_editor_sources import prepared_evidence
            with patch('prepare_editor_sources.fetch_url',side_effect=AssertionError('reviewed evidence must not be refetched')):
                self.assertEqual(prepared_evidence(URL,evidence),current)
            self.assertTrue(selection_ready(LEAD,records[URL],current,NOW))
            self.assertFalse(selection_ready(LEAD,records[URL],EVIDENCE,NOW))

    def test_every_discovered_article_is_reviewed_before_selection_caps(self):
        leads=[dict(LEAD,url=URL+str(i)) for i in range(75)]
        evidence={lead['url']:EVIDENCE for lead in leads}
        seen=[]
        def review(brief,pixels,deadline):
            data=json.loads(brief.read_text(encoding='utf-8'))
            self.assertTrue(data['complete_article_text'].endswith('FINAL VERIFIED FACT.'))
            self.assertTrue(pixels.is_file())
            seen.append(data['url'])
            return verdict()
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'):
            records,report=review_inventory(leads,evidence,[],folder,capturer=fake_capture,reviewer=review,now=NOW)
            self.assertEqual(len(seen),75)
            self.assertEqual(report['summary']['reviewed_articles'],75)
            self.assertEqual(len(records),75)
            self.assertFalse(report['summary']['collection_complete'])
            self.assertTrue(selection_ready(leads[0],records[leads[0]['url']],EVIDENCE,NOW))

    def test_pixel_capture_alone_never_becomes_a_completed_review(self):
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'):
            records,report=review_inventory([LEAD],{URL:EVIDENCE},[],folder,
                capturer=fake_capture,capture_only=True,now=NOW)
            self.assertEqual(report['summary']['reviewed_articles'],0)
            self.assertEqual(records[URL]['status'],'captured')
            self.assertFalse(selection_ready(LEAD,records[URL],EVIDENCE,NOW))

    def test_failed_render_is_held_and_does_not_look_reviewed(self):
        def fail(*args,**kwargs): raise ValueError('stylesheet retrieval failed')
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'):
            records,report=review_inventory([LEAD],{URL:EVIDENCE},[],folder,capturer=fail,now=NOW)
            self.assertEqual(records[URL]['status'],'unavailable')
            self.assertIn('stylesheet',records[URL]['error'])
            self.assertEqual(report['summary']['held_articles'],1)

    def test_no_virality_claim_from_newness_or_famous_name(self):
        row=validate_verdict(verdict(),LEAD,[],{'evidence':EVIDENCE,'screenshot_sha256':'abc'},NOW)
        self.assertEqual(row['viral'],'unknown')
        self.assertEqual(row['discussion'],'not_established')
        self.assertEqual(row['social_engagement']['status'],'unavailable')

    def test_sister_publishers_cannot_multiply_discussion_evidence(self):
        urls=['https://variety.com/2026/music/news/album/',
              'https://www.billboard.com/music/album/',
              'https://deadline.com/2026/11/album/']
        row=verdict()[0]; row['same_event_urls']=urls
        result=validate_verdict([row],LEAD,[{'url':url} for url in urls],
                                {'evidence':EVIDENCE,'screenshot_sha256':'abc'},NOW)
        self.assertEqual(result['coverage_families'],2)
        self.assertEqual(result['discussion'],'not_established')

    def test_invented_coverage_url_is_rejected(self):
        row=verdict()[0]; row['same_event_urls']=['https://people.com/not-in-brief/']
        with self.assertRaisesRegex(ValueError,'invented'):
            validate_verdict([row],LEAD,[],{'evidence':EVIDENCE,'screenshot_sha256':'abc'},NOW)

    def test_old_article_cannot_be_called_breaking(self):
        lead=dict(LEAD,published=(NOW-timedelta(hours=5)).isoformat())
        row=validate_verdict(verdict(),lead,[],{'evidence':EVIDENCE,'screenshot_sha256':'abc'},NOW)
        self.assertEqual(row['breaking'],'not_established')

    def test_expired_or_changed_source_or_pixels_require_fresh_review(self):
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'):
            records,_=review_inventory([LEAD],{URL:EVIDENCE},[],folder,
                capturer=fake_capture,reviewer=lambda *args:verdict(),now=NOW)
            record=records[URL]
            self.assertTrue(reusable(record,LEAD,EVIDENCE,NOW))
            self.assertFalse(reusable(record,LEAD,dict(EVIDENCE,text='changed'),NOW))
            self.assertTrue(reusable(record,LEAD,EVIDENCE,NOW+timedelta(hours=2)))
            self.assertFalse(reusable(record,LEAD,EVIDENCE,NOW+timedelta(hours=25)))
            self.assertFalse(reusable(record,LEAD,{**EVIDENCE,'image_url':'https://example.com/changed.jpg'},NOW))
            Path(record['review_image']).write_bytes(b'changed pixels')
            self.assertFalse(reusable(record,LEAD,EVIDENCE,NOW))

    def test_zero_budget_preserves_unreviewed_story_as_pending(self):
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'):
            records,report=review_inventory([LEAD],{URL:EVIDENCE},[],folder,
                budget_seconds=0,capturer=fake_capture,now=NOW)
            self.assertEqual(records[URL]['status'],'pending')
            self.assertFalse(report['summary']['review_complete'])

    def test_rendered_text_must_include_actual_article_body(self):
        def fetcher(*args,**kwargs): return dict(url=URL,payload=b'fixture',headers={})
        def renderer(response,publisher,**kwargs):
            Image.new('RGB',(100,100)).save(kwargs['screenshot'])
            Image.new('RGB',(100,100)).save(kwargs['screenshot'].with_name('page.full.png'))
            return dict(url=URL,method='public_browser_geometry',article_view={'visible_text':'Subscribe to read'},
                        screenshot_height=100)
        with tempfile.TemporaryDirectory() as folder, patch('news_story_review.extract',return_value=EVIDENCE):
            record=capture(URL,{'source':'Consequence','domains':['consequence.net']},Path(folder),article=True,fetcher=fetcher,renderer=renderer)
            self.assertFalse(record['article_text_visible'])
            self.assertTrue(Path(record['screenshot']).is_file())
            self.assertIn('complete readable',record['readability_error'])


if __name__=='__main__': unittest.main()
