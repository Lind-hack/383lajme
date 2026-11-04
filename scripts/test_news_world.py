"""World desk behavior at the agreed public boundaries."""
import unittest

class WorldRankingTests(unittest.TestCase):
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

    def test_successful_page_review_also_counts_the_original_photo(self):
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
                        visual_page_complete=True, visual_layout_complete=True)
        with tempfile.TemporaryDirectory() as root, patch('news_image_policy.photo_payload', return_value=raw.getvalue()):
            records, report = review_inventory([lead], {url:evidence}, [], root, capturer=page,
                                              capture_only=True, category='Botë', now=now)
        self.assertEqual(report['summary']['article_images_captured'], 1)
        self.assertEqual(report['summary']['article_pages_captured'], 1)

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
