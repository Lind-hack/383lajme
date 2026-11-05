"""World desk behavior at the agreed public boundaries."""
import unittest

class WorldRankingTests(unittest.TestCase):
    def test_english_match_report_does_not_use_world_review_capacity(self):
        from news_desk_policy import select_candidates
        from datetime import datetime,timezone
        row=dict(url='https://www.france24.com/en/live-news/20261104-valverde-blast-snatches-real-madrid-late-win-at-aek-athens',
                 source='France 24',category='Botë',title='Valverde blast snatches Real Madrid late win at AEK Athens',
                 published=datetime.now(timezone.utc).isoformat())
        evidence={row['url']:dict(text='Federico Valverde scored the winner in Champions League football against AEK Athens.')}
        self.assertEqual(select_candidates([row],evidence),[])

    def test_fresh_homepage_observation_does_not_make_old_world_news_current(self):
        from datetime import datetime, timedelta, timezone
        from news_story_review import story_current
        now = datetime.now(timezone.utc)
        lead = dict(category='Botë', published=(now-timedelta(hours=30)).isoformat(),
                    homepage=dict(position=1, article_count=10, observed_at=now.isoformat(), method='public_html_dom_order'))
        self.assertFalse(story_current(lead, now))

    def test_full_text_regional_preference_has_no_reserved_quota(self):
        from news_desk_policy import select_candidates
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        rows = [dict(url=f'https://www.bbc.com/news/story-{i}', source='BBC World',
                     category='Botë', title='Officials announce new border rules',
                     published=now.isoformat()) for i in range(6)]
        evidence = {rows[-1]['url']: {'text': 'The European Union announced new entry rules for Kosovo and the Balkans.'}}
        result = select_candidates(rows, evidence, limit=5, now=now)
        self.assertEqual(result[0]['url'], rows[-1]['url'])
        self.assertEqual(len(result), 5)
        self.assertEqual(len(select_candidates(rows[:-1], limit=5, now=now)), 5)

    def test_world_brief_survives_hourly_content_validation(self):
        import os
        import json
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from test_codex_automation_support import load_support, make_article
        with patch.dict(os.environ, {'L383_HOURLY_NEWS':'1', 'L383_NEWS_CATEGORIES':'Botë'}):
            support = load_support()
            article = make_article(1, 'Botë')
            article.update(body='<p>' + ' '.join(['Lajmi']*50) + '</p>', reading_time=1)
            with tempfile.TemporaryDirectory() as root, patch.object(support, '_fetch_image_dimensions', return_value=(1400,800)), \
                    patch('news_image_policy.image_errors', return_value=[]):
                batch = Path(root)/'2026-11-04T17.json'
                batch.write_text(json.dumps([article]), encoding='utf-8')
                self.assertEqual(len(support.validate_batch(batch)), 1)

    def test_world_brief_also_passes_the_mandatory_journalism_gate(self):
        from journalism_quality_gate import journalism_errors
        article = dict(category='Botë', source='BBC World', title='BE miraton rregulla kufitare',
                       excerpt='Vendimi hyn në fuqi sot.', body='<p>'+' '.join(['Lajmi']*50)+'</p>')
        self.assertEqual(journalism_errors(article), [])


class WorldDiscoveryTests(unittest.TestCase):
    def test_source_access_denial_is_reported_separately_from_readable_supply(self):
        import tempfile
        from pathlib import Path
        from news_ingestion import collect
        from read_news_source import PublicHTTPError
        publisher = dict(source='BBC World', category='Botë', domains=['bbc.com'], family='bbc')
        def blocked(*args, **kwargs):
            raise PublicHTTPError(403)
        with tempfile.TemporaryDirectory() as root:
            leads, audits, evidence, report = collect(dict(publishers=[publisher],feeds=[],browser_lanes=[]),
                Path(root)/'state.sqlite',budget_seconds=0,fetcher=blocked)
        self.assertEqual(leads, [])
        self.assertGreater(audits[0]['access_failures']['access_denied'], 0)

    def test_sister_world_publishers_cannot_corroborate_sensitive_claims(self):
        from news_source_policy import independent
        self.assertFalse(independent('https://news.sky.com/story/election', 'https://www.nbcnews.com/world/election'))

    def test_homepage_world_article_requires_current_full_text_not_subscription_preview(self):
        import tempfile
        from pathlib import Path
        from datetime import datetime, timezone
        from news_ingestion import collect
        from read_news_source import PublicHTTPError
        now = datetime.now(timezone.utc)
        publisher = dict(source='BBC World', category='Botë', domains=['bbc.com'], family='bbc')
        manifest = dict(publishers=[publisher], feeds=[], browser_lanes=[])
        def fetch(url, **kwargs):
            if url == 'https://bbc.com/':
                body = '<h2><a href="/news/full">New border rules announced</a></h2><h2><a href="/news/preview">New travel rules announced</a></h2>'
            elif url.endswith('/full'):
                body = '<meta property="article:published_time" content="'+now.isoformat()+'"><article><h1>New border rules announced</h1><p>' + 'Officials announced new border rules today. '*90 + '</p></article>'
            elif url.endswith('/preview'):
                body = '<meta name="robots" content="noarchive"><div>Subscribe to continue reading. Sign in to read this article.</div>'
            else:
                raise PublicHTTPError(404)
            return dict(url=url, payload=body.encode(), headers={})
        with tempfile.TemporaryDirectory() as root:
            leads, audits, evidence, report = collect(manifest, Path(root)/'inventory.sqlite', budget_seconds=0, now=now, fetcher=fetch)
        self.assertEqual([lead['url'] for lead in leads], ['https://bbc.com/news/full'])
        self.assertTrue(leads[0].get('homepage'))
        self.assertGreater(audits[0]['failed_tasks'], 0)

    def test_world_has_twenty_four_discoverable_publishers_and_room_for_180_stories(self):
        from news_source_policy import MANIFEST
        world = [p for p in MANIFEST['publishers'] if p['category'] == 'Botë']
        self.assertEqual(len(world), 24)
        routes = MANIFEST['feeds'] + MANIFEST['browser_lanes']
        self.assertTrue(all(any(r['source'] == p['source'] and r['category'] == 'Botë'
                                for r in routes) for p in world))
        self.assertEqual(MANIFEST['category_limits']['Botë']['discovery_max'], 180)


class WorldVisualTests(unittest.TestCase):
    def test_world_starts_native_review_after_two_articles_without_recapturing_homepages(self):
        import json
        import tempfile
        from io import BytesIO
        from datetime import datetime, timezone
        from unittest.mock import patch
        from PIL import Image
        from news_story_review import review_inventory
        now = datetime.now(timezone.utc)
        leads = [dict(url=f'https://www.bbc.com/news/world-event-{i}', source='BBC World', category='Botë',
                      title=f'Officials announce border decision {i}', published=now.isoformat()) for i in range(4)]
        evidence = {lead['url']:dict(status='text_extracted',url=lead['url'],requested_url=lead['url'],
                    title=lead['title'],published=lead['published'],fetched_at=now.isoformat(),
                    text='Officials announced a new border decision today. '*100,
                    image_url='https://ichef.bbci.co.uk/news/1536/world-event.jpg') for lead in leads}
        raw = BytesIO(); Image.new('RGB',(600,400),'blue').save(raw,format='PNG')
        batches, homepages = [], []
        def page(url, publisher, folder, **kwargs):
            if not kwargs.get('article'): homepages.append(url)
            raise ValueError('page capture unavailable')
        def review(brief, pixels, deadline):
            rows = json.loads(brief.read_text(encoding='utf-8')); batches.append(len(rows))
            return [dict(review_id=row['review_id'],decision='consider',score=4,reason='Supported current event.',
                         new_development='A new border decision.',audience_fit='World news.',breaking='fresh_development',
                         same_event_urls=[]) for row in rows]
        with tempfile.TemporaryDirectory() as root, patch('news_image_policy.photo_payload',return_value=raw.getvalue()):
            records, report = review_inventory(leads,evidence,[],root,capturer=page,batch_reviewer=review,category='Botë',now=now)
        self.assertEqual(batches, [2,2])
        self.assertEqual(homepages, [])
        self.assertEqual(report['summary']['reviewed_articles'], 4)

    def _review_page(self, complete):
        import hashlib
        import tempfile
        from io import BytesIO
        from pathlib import Path
        from datetime import datetime, timezone
        from unittest.mock import patch
        from PIL import Image
        from news_story_review import review_inventory
        now = datetime.now(timezone.utc)
        url = 'https://www.bbc.com/news/world-event'
        lead = dict(url=url, source='BBC World', category='Botë', title='EU announces border rules', published=now.isoformat())
        evidence = dict(status='text_extracted', url=url, requested_url=url, title=lead['title'], published=now.isoformat(),
                        text='Officials announced new border rules today. '*100, fetched_at=now.isoformat(),
                        image_url='https://ichef.bbci.co.uk/news/1536/world-event.jpg')
        raw = BytesIO(); Image.new('RGB',(600,400),'blue').save(raw,format='PNG')
        def page(url, publisher, folder, **kwargs):
            image = Path(folder)/'page.png'; image.write_bytes(raw.getvalue())
            sha = hashlib.sha256(image.read_bytes()).hexdigest()
            return dict(screenshot=str(image), full_screenshot=str(image), screenshot_sha256=sha,
                        full_screenshot_sha256=sha, evidence=evidence, captured_at=now.isoformat(),
                        visual_page_complete=complete, visual_layout_complete=complete)
        with tempfile.TemporaryDirectory() as root, patch('news_image_policy.photo_payload', return_value=raw.getvalue()):
            records, report = review_inventory([lead], {url:evidence}, [], root, capturer=page,
                                              capture_only=True, category='Botë', now=now)
        return report

    def test_successful_page_review_also_counts_the_original_photo(self):
        report = self._review_page(True)
        self.assertEqual(report['summary']['article_images_captured'], 1)
        self.assertEqual(report['summary']['article_pages_captured'], 1)

    def test_partial_page_does_not_count_as_a_full_page_capture(self):
        report = self._review_page(False)
        self.assertEqual(report['summary']['article_pages_captured'], 0)
        self.assertEqual(report['summary']['article_images_captured'], 1)

    def test_world_prepares_only_original_publisher_images(self):
        from prepare_editor_sources import visual_options
        from news_image_policy import publisher_photo_allowed
        lead = dict(category='Botë', url='https://www.bbc.com/news/world-event', title='New border rules')
        evidence = dict(status='text_extracted', url=lead['url'], title=lead['title'],
                        image_url='https://ichef.bbci.co.uk/news/1536/world-event.jpg')
        options = visual_options(lead, evidence, {})
        self.assertTrue(options)
        self.assertTrue(all(publisher_photo_allowed(lead, option['photo']) for option in options))
        self.assertTrue(all(option['photo']['image_url'].startswith('https://ichef.bbci.co.uk/') for option in options))

    def test_page_failure_still_reviews_original_photo_and_complete_text(self):
        import hashlib
        import json
        import tempfile
        from pathlib import Path
        from datetime import datetime, timezone
        from unittest.mock import patch
        from PIL import Image
        from news_story_review import review_inventory, selection_ready
        now = datetime.now(timezone.utc)
        url = 'https://www.bbc.com/news/world-event'
        lead = dict(url=url, source='BBC World', category='Botë', title='EU announces border rules', published=now.isoformat())
        evidence = dict(status='text_extracted', url=url, title=lead['title'], published=now.isoformat(),
                        text='Officials announced new border rules today. ' * 12 + 'FINAL SUPPORTED FACT.')
        def photo(url, publisher, folder, **kwargs):
            image = Path(folder) / 'original.png'
            Image.new('RGB', (600, 400), 'blue').save(image)
            sha = hashlib.sha256(image.read_bytes()).hexdigest()
            return dict(screenshot=str(image), full_screenshot=str(image), screenshot_sha256=sha,
                        full_screenshot_sha256=sha, captured_at=now.isoformat(), evidence=evidence,
                        complete_public_text=True, visual_evidence_kind='source_article_photo', visual_page_complete=False)
        def page(*args, **kwargs):
            raise ValueError('page capture unavailable')
        def review(brief, pixels, deadline):
            payload = json.loads(Path(brief).read_text(encoding='utf-8'))
            self.assertTrue(payload['complete_article_text'].endswith('FINAL SUPPORTED FACT.'))
            self.assertEqual(payload['visual_evidence_kind'], 'source_article_photo')
            return [dict(decision='consider', score=4, reason='Specific supported development.',
                         new_development='Border rules announced.', audience_fit='European relevance.',
                         breaking='fresh_development', same_event_urls=[])]
        with tempfile.TemporaryDirectory() as root, patch('news_showbiz_article_visual.capture_article_photo', side_effect=photo):
            records, report = review_inventory([lead], {url:evidence}, [], root, capturer=page,
                                              reviewer=review, category='Botë', now=now)
            self.assertTrue(selection_ready(lead, records[url], evidence, now))
            self.assertEqual(report['summary']['article_pages_captured'], 0)
            self.assertEqual(report['summary']['article_images_captured'], 1)


class WorldRunTests(unittest.TestCase):
    def test_world_worker_verifies_the_history_it_reviewed_before_parent_publication(self):
        import tempfile,json
        from pathlib import Path
        from datetime import datetime,timezone
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        lead=dict(url='https://www.bbc.com/news/test',source='BBC World')
        article=dict(lead,slug='test')
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);reserve=Reserve(root/'reserve','Botë')
            port=ProductionPort('Botë',reserve,root/'run',datetime.now(timezone.utc).timestamp()+3000,qa=True);port.data={}
            def python(script,*args,**kwargs):
                if script=='prepare_editor_sources.py' and '--discovery' in args:
                    atomic(Path(args[0]).with_suffix('.json'),dict(ready_leads=[lead]))
                elif script=='prepare_editor_sources.py':
                    batch=Path(args[0]);atomic(batch.with_suffix('.editor-sources.json'),[dict(slug='test')])
                    atomic(batch.with_suffix('.copyright-review.json'),{})
                    atomic(batch.with_suffix('.context-review.json'),{})
            def command(args,**kwargs):
                if '--batch' in args:atomic(Path(args[args.index('--batch')+1]),[article])
            with patch.object(port,'python',side_effect=python),patch.object(port,'command',side_effect=command), \
                    patch('codex_automation_support._recently_published',side_effect=[[],[dict(id='new-sibling')]]), \
                    patch('news_copyright_review.validate_for_publication'),patch('news_context_review.review') as review, \
                    patch('news_context_review.verify') as verify,patch.object(reserve,'store',return_value=dict(article=article)):
                self.assertEqual(len(list(port.produce([lead],5))),1)
            self.assertEqual(review.call_args.args[1],[])
            self.assertEqual(verify.call_args.args[2],[])

    @unittest.skipUnless(__import__('os').name=='posix','Linux worker file locks')
    def test_parallel_world_reviews_preserve_every_rejection_in_shared_history(self):
        import tempfile,os,sys,subprocess,json
        from pathlib import Path
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);ledger=root/'ledger.json'
            code=('import sys;sys.path.insert(0,sys.argv[1]);from news_copyright_review import remember_rejections;'
                  '[remember_rejections([dict(url="https://www.bbc.com/news/"+sys.argv[2]+"-"+str(i))]) for i in range(20)]')
            workers=[]
            for n in range(4):
                env=dict(os.environ,L383_REJECTION_LEDGER=str(ledger),L383_REJECTION_LOCK=str(ledger)+'.lock',L383_REVIEW_REJECTED='')
                workers.append(subprocess.Popen([sys.executable,'-c',code,str(Path(__file__).parent),str(n)],env=env))
            for worker in workers:self.assertEqual(worker.wait(timeout=10),0)
            self.assertEqual(len(json.loads(ledger.read_text())),80)

    def test_world_worker_isolates_rejections_and_saves_approval_before_quota_failure(self):
        import tempfile,json,os
        from pathlib import Path
        from datetime import datetime,timezone
        from unittest.mock import patch
        from news_world_story_worker import run
        from news_json_state import atomic
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);work=root/'parallel-0';request=root/'input.json';response=root/'result.json'
            atomic(request,dict(work=str(work),reserve_root=str(root/'reserve'),deadline=datetime.now(timezone.utc).timestamp()+3000,
                                qa=True,lead={},data={},evidence_folder=str(root/'source-evidence')))
            entry=dict(article=dict(url='https://www.bbc.com/news/approved'))
            def write(*args,**kwargs):
                self.assertEqual(os.environ['L383_REVIEW_REJECTED'],str(work/'copyright-rejected.json'))
                self.assertEqual(os.environ['L383_REJECTION_LOCK'],str(root/'ledger.json')+'.lock')
                yield entry
                raise RuntimeError('model_quota')
            with patch.dict(os.environ,dict(L383_REVIEW_REJECTED=str(root/'shared-rejected.json'),L383_REJECTION_LEDGER=str(root/'ledger.json'))), \
                    patch('codex_automation_support.load_env'),patch('news_reliable_desks.ProductionPort.write_ready',side_effect=write):
                run(request,response)
            saved=json.loads(response.read_text())
            self.assertEqual(saved['entries'],[entry])
            self.assertEqual(saved['error'],'model_quota')

    def test_world_restart_recovers_parallel_story_receipts(self):
        import tempfile
        from pathlib import Path
        from datetime import datetime, timezone
        from news_approved_reserve import Reserve, recover_approvals
        from news_json_state import atomic
        from news_copyright_review import article_digest, digest, POLICY, CHECKS
        now=datetime.now(timezone.utc)
        a=dict(slug='a',url='https://www.bbc.com/news/articles/test',title='EU announces a border procedure',body='Independent prose',category='Botë',published_at=now.isoformat(),image_rights=dict(sha256='a'*64))
        e=dict(slug='a',evidence=dict(status='text_extracted',published=now.isoformat()))
        proof=dict(article_sha256=article_digest(a),evidence_sha256=digest(e),decision=dict(verdict='approve',checks=dict.fromkeys(CHECKS,True),reason='Independent composition and all factual claims are supported.'))
        receipt=dict(policy=POLICY,model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),articles={'a':proof})
        context=dict(policy='383-event-context-v2',model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),history={},articles={'a':dict(article_sha256=article_digest(a),decisions=[dict(verdict='distinct')])})
        with tempfile.TemporaryDirectory() as root:
            root=Path(root)
            batch=root/'run'/'wave-1'/'parallel-0'/'draft-0'/'2026-11-03T22.json'
            atomic(batch,[a]);atomic(batch.with_suffix('.editor-sources.json'),[e])
            atomic(batch.with_suffix('.copyright-review.json'),receipt)
            atomic(batch.with_suffix('.context-review.json'),context)
            reserve=Reserve(root/'reserve','Botë')
            self.assertEqual(recover_approvals(root,reserve),1)
            self.assertEqual(reserve.available()[0]['article']['body'],'Independent prose')

    def test_world_slow_writer_cannot_block_other_prepared_stories(self):
        import tempfile,threading,subprocess
        from pathlib import Path
        from datetime import datetime,timezone
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        leads=[dict(url='https://www.bbc.com/news/'+str(i),source='BBC World') for i in range(3)]
        started=threading.Barrier(3)
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            reserve=Reserve(root/'reserve','Botë')
            port=ProductionPort('Botë',reserve,root/'run',datetime.now(timezone.utc).timestamp()+3000,qa=True)
            port.data={}
            def command(script,*args,**kwargs):
                if script=='prepare_editor_sources.py':
                    atomic(Path(args[0]).with_suffix('.json'),dict(ready_leads=leads))
                elif script=='news_world_story_worker.py':
                    import json
                    job=json.loads(Path(args[0]).read_text());lead=job['lead']
                    started.wait(timeout=2)
                    if lead['url'].endswith('/0'):raise subprocess.TimeoutExpired('writer',180)
                    atomic(args[1],dict(entries=[dict(article=lead)],metrics=dict(saved_drafts=1,approvals=1)))
                else:raise RuntimeError('one slow serial writer')
            with patch.object(port,'python',side_effect=command),patch.object(reserve,'valid',return_value=True):
                entries=list(port.produce(leads,5))
            self.assertEqual({e['article']['url'] for e in entries},{leads[1]['url'],leads[2]['url']})
            self.assertEqual(port.metrics['saved_drafts'],2)
            self.assertEqual(port.metrics['approvals'],2)
            self.assertEqual(port.metrics['writer_ready'],3)

    def test_world_editor_rejection_is_not_a_missing_completion_failure(self):
        import tempfile,json
        from pathlib import Path
        from datetime import datetime,timezone
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            port=ProductionPort('Botë',Reserve(root/'reserve','Botë'),root/'run',datetime.now(timezone.utc).timestamp()+3000,qa=True)
            port.data={};calls=[];batch=[]
            def python(script,*args,**kwargs):
                calls.append(script)
                if script=='prepare_editor_sources.py' and '--discovery' in args:
                    atomic(Path(args[0]).with_suffix('.json'),dict(ready_leads=[dict(url='https://www.bbc.com/news/test',source='BBC World')]))
                if script=='editor_completion.py':raise RuntimeError('No receipt for a rejected draft')
            def command(args,**kwargs):
                if '--batch' in args:
                    target=Path(args[args.index('--batch')+1]);batch.append(target);atomic(target,[dict(url='https://www.bbc.com/news/test')])
                else:atomic(batch[0],[])
            with patch.object(port,'python',side_effect=python),patch.object(port,'command',side_effect=command):
                self.assertEqual(list(port.produce([],5)),[])
            self.assertNotIn('editor_completion.py',calls)
            self.assertIn('review_rejection',port.metrics['failure_reasons'])

    def test_world_resumes_checkpointed_stories_after_preparation_timeout(self):
        import tempfile, subprocess
        from pathlib import Path
        from datetime import datetime, timezone
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            port=ProductionPort('Botë',Reserve(root/'reserve','Botë'),root/'run',datetime.now(timezone.utc).timestamp()+3000,qa=True)
            port.data={}
            calls=[]
            def command(script,*args,**kwargs):
                calls.append(script)
                if script=='prepare_editor_sources.py':
                    atomic(Path(args[0]).with_suffix('.json'),dict(ready_leads=[dict(url='https://www.bbc.com/news/test',source='BBC World')]))
                    raise subprocess.TimeoutExpired('prepare',480)
                raise RuntimeError('writer unavailable')
            with patch.object(port,'python',side_effect=command):
                self.assertEqual(list(port.produce([],5)),[])
            self.assertEqual(port.metrics['writer_ready'],1)
            self.assertIn('news_writer_brief.py',calls)
            self.assertIn('partial_preparation_recovered',port.metrics['failure_reasons'])

    def test_world_minimum_success_requires_five_confirmed_publications(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        class Store:
            def available(self): return []
        class Port:
            def quota_hit(self): return False
            def collect(self, attempted): return []
        with tempfile.TemporaryDirectory() as root:
            world=run_category(Port(),Store(),Path(root)/'world.json','Botë')
            economy=run_category(Port(),Store(),Path(root)/'economy.json','Ekonomi')
        self.assertEqual(world['minimum_count'],5)
        self.assertEqual(economy['minimum_count'],3)

    def test_world_attempted_article_alias_does_not_enter_preparation_again(self):
        import tempfile,json
        from pathlib import Path
        from datetime import datetime,timezone
        from contextlib import chdir
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        with tempfile.TemporaryDirectory() as temp,chdir(temp):
            root=Path(temp);now=datetime.now(timezone.utc)
            url='https://www.politico.eu/article/new-border-plan'
            lead=dict(url=url+'/?utm_source=rss',source='POLITICO Europe',category='Botë',title='EU announces border plan',published=now.isoformat())
            port=ProductionPort('Botë',Reserve(root/'reserve','Botë'),root/'run',now.timestamp()+3000,qa=True)
            port.data={'leads':[lead]}
            def collect(*args,**kwargs):
                atomic(root/'.last30days/cloud-news-discovery-current.json',dict(leads=[],raw_leads=[],retrieved_evidence={}))
            with patch.object(port,'python',side_effect=collect):
                self.assertEqual(port.collect({url}),[])

    def test_completed_photo_evals_survive_later_preparation_failure(self):
        import tempfile
        from pathlib import Path
        from datetime import datetime, timezone
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            port = ProductionPort('Botë', Reserve(root/'reserve','Botë'), root/'run', datetime.now(timezone.utc).timestamp()+3000, qa=True)
            port.data = {}
            def command(*args, **kwargs):
                atomic(root/'run/wave-1/news-photo-outcomes.json', {'first':'fit', 'second':'none_fit', 'third':'verification_unavailable'})
                raise RuntimeError('reporter notes failed')
            with patch.object(port, 'python', side_effect=command), self.assertRaises(RuntimeError):
                list(port.produce([], 5))
            self.assertEqual(port.metrics['completed_image_evaluations'], 2)
            self.assertEqual(port.metrics['unsuitable_images'], 1)
            self.assertEqual(port.metrics['image_verification_unavailable'], 1)

    def test_later_review_waves_preserve_completed_world_evals(self):
        import tempfile
        from pathlib import Path
        from contextlib import chdir
        from datetime import datetime, timezone
        from unittest.mock import patch
        from news_json_state import atomic
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        now = datetime.now(timezone.utc)
        leads = [dict(url=f'https://www.bbc.com/news/event-{i}', source='BBC World', category='Botë',
                      title='EU announces new border rules', published=now.isoformat()) for i in range(2)]
        with tempfile.TemporaryDirectory() as temp, chdir(temp):
            root = Path(temp)
            wave = [0]
            def command(*args, **kwargs):
                index = wave[0]; wave[0] += 1
                atomic(root/'.last30days/cloud-news-discovery-current.json', dict(leads=[leads[index]], raw_leads=leads,
                    retrieved_evidence={lead['url']:dict(status='text_extracted', text='New border rules.') for lead in leads}))
                records = [dict(url=leads[index]['url'], status='reviewed', review=dict(decision='consider', score=4),
                                capture=dict(visual_evidence_kind='source_article_image', visual_page_complete=False))]
                if index:
                    records.append(dict(url=leads[0]['url'], status='pending'))
                atomic(root/'.last30days/world-review/review.json', dict(summary={},articles=records))
            port = ProductionPort('Botë', Reserve(root/'reserve','Botë'), root/'run', now.timestamp()+3000, qa=True)
            with patch.object(port, 'python', side_effect=command):
                first = port.collect(set())
                second = port.collect({first[0]['url']})
            self.assertEqual(second[0]['url'], leads[1]['url'])
            self.assertEqual(port.metrics['visual_review']['new_evals'], 2)
            self.assertEqual(port.metrics['visual_review']['article_images_captured'], 2)

    def test_world_approved_stories_have_distinct_publication_keys(self):
        from pathlib import Path
        from unittest.mock import patch
        import os
        from news_batch_identity import batch_key
        with patch.dict(os.environ, {'L383_RUN_DESK':'bote'}):
            first = batch_key(Path('approved')/('a'*24)/'2026-11-04T17.json')
            second = batch_key(Path('approved')/('b'*24)/'2026-11-04T17.json')
        self.assertNotEqual(first, second)

    def test_world_reserve_storage_is_separate_from_economy(self):
        import tempfile
        from pathlib import Path
        from news_approved_reserve import Reserve
        with tempfile.TemporaryDirectory() as root:
            world = Reserve(Path(root), 'Botë')
            economy = Reserve(Path(root), 'Ekonomi')
            self.assertNotEqual(world.path, economy.path)
            self.assertEqual(world.path.name, 'bote')

    def test_world_collection_reports_its_own_evals_and_unique_readable_sources(self):
        import tempfile
        from pathlib import Path
        from contextlib import chdir
        from datetime import datetime, timezone
        from unittest.mock import patch
        from news_json_state import atomic
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        now = datetime.now(timezone.utc)
        lead = dict(url='https://www.bbc.com/news/world-event', source='BBC World', category='Botë',
                    title='EU announces new border rules', published=now.isoformat())
        with tempfile.TemporaryDirectory() as temp, chdir(temp):
            root = Path(temp)
            def command(*args, **kwargs):
                atomic(root/'.last30days/cloud-news-discovery-current.json', dict(leads=[lead], raw_leads=[lead,lead],
                    sources=[dict(source='BBC World',category='Botë', requests_started=2)],
                    retrieved_evidence={lead['url']:dict(status='text_extracted',text='New border rules.',image_url='https://images.example/photo.jpg')}))
                atomic(root/'.last30days/world-review/review.json', dict(summary={},articles=[dict(url=lead['url'],status='reviewed',
                    capture=dict(visual_evidence_kind='source_article_image', visual_page_complete=False))]))
            port = ProductionPort('Botë', Reserve(root/'reserve','Botë'), root/'run', now.timestamp()+3000, qa=True)
            with patch.object(port, 'python', side_effect=command):
                self.assertEqual(len(port.collect(set())), 1)
            self.assertEqual(port.metrics['readable_candidates'], 1)
            self.assertEqual(port.metrics['readable_publishers'], 1)
            self.assertEqual(port.metrics['attempted_publishers'], 1)
            self.assertEqual(port.metrics['visual_review']['new_evals'], 1)
            self.assertEqual(port.metrics['visual_review']['article_pages_captured'], 0)


if __name__ == '__main__':
    unittest.main()
