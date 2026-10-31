import tempfile
import time
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
from pathlib import Path

from news_ingestion import collect, seed_routes
from news_ingestion_store import Inventory, collector_lock
from read_news_source import PublicHTTPError, extract

PUBLISHER={'source':'TechCrunch','category':'Teknologji','domains':['techcrunch.com']}
MANIFEST={'publishers':[PUBLISHER],'feeds':[{'source':'TechCrunch','category':'Teknologji','url':'https://techcrunch.com/feed/'}],'browser_lanes':[]}
NOW=datetime(2026,10,25,12,tzinfo=timezone.utc)


def page(numbers,next_url=''):
    body=''.join(f'<article><h2><a href="/story-{i}">AI {i}</a></h2></article>' for i in numbers)
    return body+(f'<a rel="next" href="{next_url}">Next</a>' if next_url else '')


def fixture_fetch(url,**kwargs):
    if url.endswith('/feed/'):
        body='<rss version="2.0"><channel>'+''.join(f'<item><title>AI {i}</title><link>https://techcrunch.com/story-{i}</link><pubDate>Sun, 25 Oct 2026 11:00:00 GMT</pubDate></item>' for i in range(175))+'</channel></rss>'
    elif url.endswith('/robots.txt'):
        body='Sitemap: https://techcrunch.com/news.xml'
    elif url.endswith('/news.xml'):
        body='<urlset>'+''.join(f'<url><loc>https://techcrunch.com/story-{i}</loc><lastmod>2026-10-25T11:00:00Z</lastmod></url>' for i in range(175,200))+'</urlset>'
    elif url=='https://techcrunch.com/':
        body=page(range(20),'/news?page=2')
    elif url=='https://techcrunch.com/news?page=2':
        body=page(range(200,225))
    elif '/story-' in url:
        body='<html><head><title>OpenAI announces a new model</title><meta property="article:published_time" content="2026-10-25T11:00:00Z"></head><body><article>'+''.join('<p>'+('Verified public reporting about the new OpenAI model. '*25)+'</p>' for _ in range(3))+'</article></body></html>'
    else:
        raise PublicHTTPError(404)
    return {'url':url,'payload':body.encode(),'status':200,'headers':{}}


class IngestionTests(unittest.TestCase):
    def test_homepage_refresh_is_not_repeated_on_every_collector_pass(self):
        from datetime import timedelta
        roots = []
        def fetcher(url, **kwargs):
            if url == 'https://techcrunch.com/':
                roots.append(url)
                body = '<h2><a href="/one-story">OpenAI launches a model today</a></h2>'
            elif url == 'https://techcrunch.com/one-story':
                body = ('<meta property="article:published_time" content="'+NOW.isoformat()+'">'
                        '<article><h1>OpenAI launches a model today</h1><p>'+('Verified OpenAI model news. '*100)+'</p></article>')
            else:
                raise PublicHTTPError(404)
            return dict(url=url,payload=body.encode(),headers={})
        manifest = {**MANIFEST,'feeds':[]}
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)/'inventory.sqlite'
            for seconds in (0,60,301):
                now = NOW+timedelta(seconds=seconds)
                with patch('time.time',return_value=now.timestamp()):
                    collect(manifest,state,budget_seconds=0,now=now,fetcher=fetcher)
                self.assertEqual(len(roots),2 if seconds == 301 else 1)

    def test_feed_sitemap_and_pagination_all_retrieve_before_any_publication_cap(self):
        with tempfile.TemporaryDirectory() as folder:
            leads,audits,evidence,report=collect(MANIFEST,Path(folder)/'inventory.sqlite',budget_seconds=0,now=NOW,fetcher=fixture_fetch)
        self.assertEqual(len(leads),225)
        self.assertEqual(len(evidence),225)
        self.assertEqual(audits[0]['articles_retrieved'],225)
        self.assertEqual(report['pending_tasks'],0)
        self.assertEqual(report['complete_publishers'],1)
        self.assertEqual(report['publishers_attempted_this_pass'],1)
        promoted = [row for row in leads if row.get('homepage')]
        self.assertEqual(len(promoted),20)
        self.assertEqual({row['homepage']['position'] for row in promoted},set(range(1,21)))
        self.assertTrue(all(row['homepage']['article_count']==20 for row in promoted))

    def test_every_registered_publisher_gets_routes_even_without_a_feed(self):
        manifest={**MANIFEST,'publishers':[PUBLISHER,{'source':'Anthropic','category':'Teknologji','domains':['anthropic.com']} ]}
        self.assertEqual({r['source'] for r in seed_routes(manifest)},{'TechCrunch','Anthropic'})

    def test_budget_expiry_retains_pending_work_and_does_not_claim_complete(self):
        def slow(url,**kwargs):
            time.sleep(.025)
            return fixture_fetch(url,**kwargs)
        with tempfile.TemporaryDirectory() as folder:
            state=Path(folder)/'inventory.sqlite'
            _,_,_,report=collect(MANIFEST,state,budget_seconds=.001,now=NOW,fetcher=slow)
            self.assertEqual(report['complete_publishers'],0)
            self.assertGreater(report['pending_tasks'],0)
            store=Inventory(state)
            self.assertEqual(store.db.execute('SELECT COUNT(*) FROM checkpoints').fetchone()[0],0)
            store.close()

    def test_blocked_sources_remain_incomplete_and_evidence_is_not_fabricated(self):
        def blocked(url,**kwargs):raise PublicHTTPError(403)
        with tempfile.TemporaryDirectory() as folder:
            leads,audits,evidence,report=collect(MANIFEST,Path(folder)/'inventory.sqlite',budget_seconds=0,now=NOW,fetcher=blocked)
        self.assertEqual(leads,[]);self.assertEqual(evidence,{})
        self.assertEqual(report['complete_publishers'],0)
        self.assertGreater(audits[0]['failed_requests'],0)

    def test_full_retrieval_can_preserve_text_beyond_the_legacy_model_excerpt(self):
        raw='<article>'+''.join('<p>'+('Substantial source reporting with verified details. '*100)+'</p>' for _ in range(50))+'</article>'
        bounded=extract(raw,'https://techcrunch.com/article')
        full=extract(raw,'https://techcrunch.com/article',max_text_chars=None)
        self.assertTrue(bounded['truncated'])
        self.assertFalse(full['truncated'])
        self.assertGreater(len(full['text']),len(bounded['text']))

    def test_restricted_article_remains_pending_and_cannot_advance_checkpoint(self):
        def restricted(url,**kwargs):
            result=fixture_fetch(url,**kwargs)
            if '/story-' in url:
                result['payload']=b'<script type="application/ld+json">{"isAccessibleForFree":false}</script>'
            return result
        with tempfile.TemporaryDirectory() as folder:
            state=Path(folder)/'inventory.sqlite'
            leads,audits,evidence,report=collect(MANIFEST,state,budget_seconds=0,now=NOW,fetcher=restricted)
            self.assertEqual(leads,[])
            self.assertEqual(report['complete_publishers'],0)
            self.assertEqual(audits[0]['pending'],225)
            store=Inventory(state)
            self.assertIsNone(store.evidence('https://techcrunch.com/story-0'))
            self.assertEqual(store.db.execute('SELECT COUNT(*) FROM checkpoints').fetchone()[0],0)
            store.close()

    def test_second_run_reuses_unchanged_and_refreshes_enriched_metadata(self):
        with tempfile.TemporaryDirectory() as folder:
            state=Path(folder)/'inventory.sqlite'
            # Keep cache/checkpoint wall time aligned with the fixture's source
            # dates; otherwise it ages out of the queue as the calendar advances.
            with patch('time.time', return_value=NOW.timestamp()):
                collect(MANIFEST,state,budget_seconds=0,now=NOW,fetcher=fixture_fetch)
            from datetime import timedelta
            with patch('time.time', return_value=NOW.timestamp()+60):
                leads,_,_,report=collect(MANIFEST,state,budget_seconds=0,now=NOW+timedelta(minutes=1),fetcher=fixture_fetch)
        self.assertEqual(len(leads),225)
        # The root cooldown also avoids reopening its pagination chain. Those
        # 25 stored articles remain usable without even a new queue-cache check.
        # Interleaving article/index requests can finish a cached task before
        # an unchanged feed rediscovers it; cache-hit counts depend on order.
        self.assertGreater(report['cached_articles'],0)
        self.assertEqual(report['stored_readable_articles'],225)
        # The first three homepage bodies precede feed discovery. The feed
        # later supplies publication dates absent from their original hints;
        # keep the existing rule that changed metadata invalidates evidence.
        self.assertEqual(report['articles_retrieved'],3)

    def test_editor_reuses_fresh_evidence_but_refetches_stale_or_wrong_publisher(self):
        from datetime import timedelta
        from prepare_editor_sources import prepared_evidence
        url='https://techcrunch.com/story'
        fresh={'status':'text_extracted','url':url,'text':'Full source text',
               'fetched_at':datetime.now(timezone.utc).isoformat()}
        with patch('prepare_editor_sources.fetch_url',return_value={'status':'unavailable'}) as fetch:
            self.assertEqual(prepared_evidence(url,{url:fresh}),fresh)
            fetch.assert_not_called()
            for invalid in ({**fresh,'url':'https://therundown.ai/story'},
                            {**fresh,'fetched_at':(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat()},
                            {**fresh,'status':'restricted'}):
                self.assertEqual(prepared_evidence(url,{url:invalid}),{'status':'unavailable'})
            self.assertEqual(fetch.call_count,3)

    def test_publication_reads_committed_inventory_without_competing_with_collector(self):
        with tempfile.TemporaryDirectory() as folder:
            state=Path(folder)/'inventory.sqlite'
            collect(MANIFEST,state,budget_seconds=0,now=NOW,fetcher=fixture_fetch)
            with collector_lock(state) as acquired:
                self.assertTrue(acquired)
                with patch('news_ingestion.fetch_public',side_effect=AssertionError('must not fetch')):
                    leads,_,_,report=collect(MANIFEST,state,now=NOW,
                        fetcher=lambda *a,**k: self.fail('competing collector made a request'))
                self.assertEqual(len(leads),225)
                self.assertTrue(report['collector_active'])

    def test_empty_morning_inventory_waits_for_background_collection(self):
        with tempfile.TemporaryDirectory() as folder:
            state=Path(folder)/'inventory.sqlite'
            Inventory(state).close()
            def populate(_seconds):
                store=Inventory(state)
                for i in range(12):
                    url=f'https://techcrunch.com/story-{i}'
                    evidence=extract(fixture_fetch(url)['payload'],url,max_text_chars=None)
                    store.save_evidence('TechCrunch',url,{},evidence)
                store.close()
            with collector_lock(state), patch('news_ingestion.time.sleep',side_effect=populate) as pause:
                leads,_,_,report=collect(MANIFEST,state,now=NOW,budget_seconds=1,
                    fetcher=lambda *a,**k:self.fail('competing network request'))
            self.assertEqual(len(leads),12)
            self.assertTrue(report['collector_active'])
            pause.assert_called_once()

    def test_collector_window_includes_previous_evening_without_hourly_environment(self):
        import os
        with tempfile.TemporaryDirectory() as folder:
            state=Path(folder)/'inventory.sqlite'
            store=Inventory(state)
            url='https://techcrunch.com/previous-evening'
            evidence=extract(fixture_fetch('https://techcrunch.com/story-1')['payload'],url)
            evidence['published']='2026-10-24T22:00:00Z'
            store.save_evidence('TechCrunch',url,{},evidence)
            store.close()
            with collector_lock(state), patch.dict(os.environ,{'L383_HOURLY_NEWS':'0'}):
                leads,_,_,_=collect(MANIFEST,state,now=NOW,budget_seconds=0)
            self.assertEqual([lead['url'] for lead in leads],[url])

    def test_missing_declared_sitemap_is_not_silently_optional(self):
        def missing(url,**kwargs):
            if url.endswith('/news.xml'):
                raise PublicHTTPError(404)
            return fixture_fetch(url,**kwargs)
        with tempfile.TemporaryDirectory() as folder:
            _,audits,_,report=collect(MANIFEST,Path(folder)/'inventory.sqlite',
                                      now=NOW,budget_seconds=0,fetcher=missing)
        self.assertEqual(report['complete_publishers'],0)
        self.assertGreater(audits[0]['failed_requests'],0)


if __name__=='__main__':unittest.main()
