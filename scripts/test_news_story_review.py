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
    def test_published_source_urls_do_not_consume_ranking_or_visual_calls(self):
        from io import BytesIO
        raw=BytesIO();Image.new('RGB',(600,400),'blue').save(raw,format='PNG')
        cases=[('Showbiz','Consequence','consequence.net','Dua Lipa announces an album','Dua Lipa confirms a concert in Pristina'),
               ('Ekonomi','Monitor','monitor.al','Kosovo approves a pension increase','Albania approves a wage increase'),
               ('Botë','DW','dw.com','France announces a border agreement','Japan announces a new national park')]
        for category,source,host,old_title,new_title in cases:
            with self.subTest(category=category),tempfile.TemporaryDirectory() as folder,patch('builtins.print'), \
                    patch('news_image_policy.photo_payload',return_value=raw.getvalue()):
                old=f'https://www.{host}/published/?utm_source=homepage#lead';new=f'https://{host}/new-development'
                leads=[dict(url=url,title=title,source=source,category=category,published=NOW.isoformat()) for url,title in ((old,old_title),(new,new_title))]
                evidence={lead['url']:dict(status='text_extracted',url=lead['url'],requested_url=lead['url'],title=lead['title'],
                    published=NOW.isoformat(),fetched_at=NOW.isoformat(),image_url='https://images.example/photo.jpg',text=(lead['title']+'. ')*30) for lead in leads}
                ranked=[];captured=[];reviewed=[]
                def interest(items,category,deadline):
                    ranked.extend(item['title'] for item in items)
                    return [dict(n=item['n'],score=8,reason='A current supported public announcement.') for item in items]
                def pixels(url,publisher,path,**kwargs):
                    if url in evidence:
                        captured.append(url)
                        return dict(fake_capture(url,publisher,path,**kwargs),evidence=evidence[url])
                    return fake_capture(url,publisher,path,**kwargs)
                def reviewer(brief,image,deadline):
                    payload=json.loads(Path(brief).read_text(encoding='utf-8'));reviewed.append(payload['url'])
                    return verdict(published_event=dict(verdict='distinct',reason='This separate public decision establishes a different development.',source_span=payload['complete_article_text'].split('. ')[0]+'.'))
                records,report=review_inventory(leads,evidence,[],folder,category=category,now=NOW,capturer=pixels,reviewer=reviewer,interest=interest,
                    published_articles=[dict(id='old',url=f'https://{host}/published',category=category,title=old_title,body=old_title+'.',published_at=NOW.isoformat())])
                self.assertEqual(ranked,[new_title])
                self.assertEqual(captured,[new],records)
                self.assertEqual(reviewed,[new])
                self.assertEqual(set(records),{new})
                self.assertEqual(report['summary']['excluded_published_urls'],1)

    def test_luna_visual_call_can_use_two_hundred_seconds_within_its_review_window(self):
        import io,os,subprocess,time
        from news_showbiz_batch_review import native_batch_review
        from news_story_review import story_id
        class Process:
            pid=99999999
            returncode=0
            def __init__(self,command,**kwargs):
                self.command=command;self.stdout=io.StringIO();self.stderr=io.StringIO()
            def poll(self):return self.returncode
            def terminate(self):pass
            def kill(self):pass
            def wait(self,timeout=None):return self.returncode
            def communicate(self,timeout):
                if timeout<200:raise subprocess.TimeoutExpired(self.command,timeout)
                image=Path(self.command[self.command.index('--image')+1])
                proof=dict(provider='openai-codex',model='gpt-6-luna',effort='max',wire_requests=1,image_sha256=hashlib.sha256(image.read_bytes()).hexdigest())
                row=dict(verdict()[0],review_id=story_id(URL))
                return '383_JSON_BEGIN '+json.dumps([row])+' 383_JSON_END','383_NATIVE_PIXELS_VERIFIED '+json.dumps(proof)
        with tempfile.TemporaryDirectory() as temp,patch('builtins.print'),patch('subprocess.Popen',side_effect=Process),patch.dict(os.environ,{
                'L383_MODEL_SLOT_DB':str(Path(temp)/'slots.sqlite'),'L383_MODEL_QUOTA_FILE':str(Path(temp)/'quota'),
                'L383_MODEL_DEADLINE_EPOCH':str(time.time()+1000)}):
            records,_=review_inventory([dict(LEAD)],{URL:dict(EVIDENCE)},[],temp,budget_seconds=360,
                capturer=fake_capture,batch_reviewer=native_batch_review,now=NOW)
        self.assertEqual(records[URL]['status'],'reviewed',records[URL].get('error'))

    def test_source_triage_holds_retellings_but_preserves_a_distinct_update(self):
        history=[dict(id='old',category='Showbiz',title='Dua Lipa announces a new album',
                      body='Dua Lipa announced a new album today. The singer confirmed its release date.',
                      url='https://383ks.com/article/album',published_at=NOW.isoformat())]
        calls=[]
        def reviewer(brief,pixels,deadline):
            payload=json.loads(Path(brief).read_text(encoding='utf-8'));calls.append(payload)
            self.assertEqual(payload['published_articles'][0]['body'],history[0]['body'])
            row=verdict()[0]
            row['published_event']=dict(verdict='retelling' if len(calls)==1 else 'distinct',
                reason='The announcement is already published.' if len(calls)==1 else 'The new concert schedule is a separate subsequent announcement.',
                source_span='Dua Lipa announced a new album today.',against_id='old',
                against_span='Dua Lipa announced a new album today.')
            return [row]
        with tempfile.TemporaryDirectory() as temp,patch('builtins.print'):
            records,_=review_inventory([dict(LEAD)],{URL:dict(EVIDENCE)},[],temp,
                capturer=fake_capture,reviewer=reviewer,now=NOW,published_articles=history)
            self.assertEqual(records[URL]['review']['decision'],'hold')
            records,_=review_inventory([dict(LEAD)],{URL:dict(EVIDENCE)},[],temp,
                capturer=fake_capture,reviewer=reviewer,now=NOW,published_articles=history)
            self.assertEqual(len(calls),1,'unchanged retelling proof should be reused')
            changed=dict(EVIDENCE,text=EVIDENCE['text']+' Dua Lipa separately announced a new concert schedule.')
            def changed_pixels(url,publisher,folder,**kwargs):
                return dict(fake_capture(url,publisher,folder,**kwargs),evidence=changed)
            records,_=review_inventory([dict(LEAD)],{URL:changed},[],temp,
                capturer=changed_pixels,reviewer=reviewer,now=NOW,published_articles=history)
            self.assertEqual(records[URL]['review']['decision'],'consider')
            self.assertEqual(len(calls),2)

    def test_completed_second_attempt_is_reused_after_a_restart(self):
        self.review_retry_waves(retry_succeeds=True)

    def test_failed_visual_reviews_rotate_alternatives_and_stop_after_two_dispatches(self):
        self.review_retry_waves()

    def review_retry_waves(self,retry_succeeds=False):
        other = dict(LEAD, url='https://consequence.net/2026/11/rita-concert/', title='Rita Ora announces a concert')
        evidence = {URL:dict(EVIDENCE), other['url']:dict(EVIDENCE, url=other['url'], title=other['title'])}
        dispatched = []
        def batch(brief, pixels, deadline):
            items = json.loads(Path(brief).read_text(encoding='utf-8'))
            dispatched.extend(item['url'] for item in items)
            if items[0]['url'] == URL and (not retry_succeeds or dispatched.count(URL)==1):
                raise TimeoutError('model review timed out')
            return [dict(verdict()[0], review_id=item['review_id']) for item in items]
        def pixels(url, publisher, folder, **kwargs):
            return dict(fake_capture(url, publisher, folder, **kwargs), evidence=evidence.get(url, EVIDENCE))
        with tempfile.TemporaryDirectory() as temp, patch('builtins.print'):
            folder = Path(temp)
            attempted = folder/'completed.json'
            attempted.write_text('[]', encoding='utf-8')
            with patch.dict('os.environ', {'L383_RELIABLE_REVIEW_WAVE_SIZE':'1',
                    'L383_RELIABLE_REVIEW_ATTEMPTED':str(attempted),
                    'L383_RELIABLE_REVIEW_ATTEMPTS':str(folder/'attempts.json')}):
                results = []
                for wave in range(4):
                    records, report = review_inventory([dict(LEAD),dict(other)], evidence, [], folder,
                        capturer=pixels,batch_reviewer=batch,now=NOW)
                    results.append(records)
                    completed = [url for url,row in records.items() if row['status']=='reviewed']
                    if completed and other['url'] in completed: attempted.write_text(json.dumps([other['url']]),encoding='utf-8')
        self.assertEqual(dispatched, [URL,other['url'],URL])
        self.assertEqual(results[0][URL]['status'], 'pending_review')
        if retry_succeeds:
            self.assertEqual(results[-1][URL]['status'],'reviewed')
            self.assertTrue(results[-1][URL]['review_reused'])
        else:
            self.assertEqual(report['summary']['review_retry_exhausted'], 1)

    def test_ranking_can_outlast_visual_window_without_exceeding_global_deadline(self):
        clock = [0.0]
        filler = dict(LEAD, url='https://consequence.net/2026/11/old-b-side/', title='Obscure band reissues an old b-side')
        evidence = {URL:EVIDENCE, filler['url']:dict(EVIDENCE, url=filler['url'], title=filler['title'])}
        def interest(items, category, deadline):
            if deadline < clock[0] + 200:
                raise TimeoutError('ranking requires 200 seconds')
            clock[0] += 200
            return [dict(n=item['n'], score=1 if 'b-side' in item['title'] else 5, reason='test') for item in items]
        def reviewer(brief, pixels, deadline):
            self.assertLessEqual(deadline, 300)
            clock[0] += 50
            return verdict()
        with tempfile.TemporaryDirectory() as folder, patch('builtins.print'), \
                patch('news_story_review.time.monotonic', side_effect=lambda:clock[0]), \
                patch('news_story_review.time.time', side_effect=lambda:1000+clock[0]), \
                patch.dict('os.environ', {'L383_MODEL_DEADLINE_EPOCH':'1300'}):
            records, result = review_inventory([dict(LEAD), filler], evidence, [], folder,
                budget_seconds=180, capturer=fake_capture, reviewer=reviewer, interest=interest, now=NOW)
        self.assertEqual(list(records), [URL])
        self.assertEqual(records[URL]['status'], 'reviewed')
        self.assertEqual(result['summary']['held_low_reader_interest'], 1)

    def test_a_readable_page_without_a_publication_date_is_never_reviewed(self):
        undated=dict(EVIDENCE,published='')
        with tempfile.TemporaryDirectory() as folder,patch('builtins.print'):
            records,result=review_inventory([dict(LEAD)],{URL:undated},[],folder,capturer=fake_capture,
                                            reviewer=lambda *args:verdict(),now=NOW)
        self.assertEqual(records,{})
        self.assertEqual(result['excluded_off_topic'][0]['reason'],'no_publication_date')

    def test_fillers_are_held_before_review_and_the_report_says_so(self):
        filler=dict(url='https://consequence.net/2026/11/b-side/',source='Consequence',category='Showbiz',
                    title='Obscure band reissues a 1991 b-side',published=NOW.isoformat())
        evidence={URL:EVIDENCE,filler['url']:dict(EVIDENCE,url=filler['url'],title=filler['title'])}
        def interest(items,category,deadline):
            return [dict(n=item['n'],score=1 if 'b-side' in item['title'] else 5,reason='test')
                    for item in items]
        with tempfile.TemporaryDirectory() as folder,patch('builtins.print'):
            leads=[dict(filler),dict(LEAD)]
            records,result=review_inventory(leads,evidence,[],folder,capturer=fake_capture,
                                            reviewer=lambda *args:verdict(),interest=interest,now=NOW)
        self.assertEqual(list(records),[URL])
        self.assertEqual(records[URL]['status'],'reviewed')
        self.assertEqual(result['summary']['held_low_reader_interest'],1)
        self.assertEqual(result['held_low_reader_interest'][0]['url'],filler['url'])
        self.assertEqual(leads[1]['reader_interest'],5)

    def test_a_test_double_never_reaches_the_ranking_model(self):
        # Before 11 Nov 2026 a review started with an injected capturer or batch reviewer still
        # called the real ranking model, so unit tests spent model usage and gave changing results.
        import news_reader_interest
        def batch(brief,image,deadline):return []
        with tempfile.TemporaryDirectory() as folder,patch('builtins.print'), \
                patch.object(news_reader_interest,'model_judge',side_effect=AssertionError('real model called')) as judge:
            review_inventory([dict(LEAD)],{URL:EVIDENCE},[],folder,capturer=fake_capture,batch_reviewer=batch,now=NOW)
        judge.assert_not_called()

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
                capturer=fake_capture,reviewer=lambda *args:verdict(score=3),now=NOW)
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
