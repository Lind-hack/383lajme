import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from news_ingestion_store import Inventory


class InventoryTests(unittest.TestCase):
    def test_root_refresh_cooldown_survives_reseeding_without_blocking_other_work(self):
        now = datetime.now(timezone.utc).timestamp()
        with tempfile.TemporaryDirectory() as folder:
            store = Inventory(Path(folder)/'inventory.sqlite')
            try:
                task = dict(source='TechCrunch',kind='listing',url='https://techcrunch.com/',priority=0)
                identity = store.enqueue(task,'run')
                store.finish(identity,'run',next_try=now+1200)
                store.enqueue(task,'later-pass',refresh=True)
                store.enqueue(dict(source='TechCrunch',kind='article',url='https://techcrunch.com/lower',priority=1),'run')
                self.assertEqual(store.ready(now=now+60)[0]['kind'],'article')
                self.assertEqual(store.ready(now=now+1201)[0]['kind'],'listing')
            finally:
                store.close()

    def test_interrupted_identity_backfill_resumes_without_changing_task_or_hint(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'inventory.sqlite'
            store = Inventory(path)
            url = 'https://www.techcrunch.com/lead?utm_source=home'
            hint = {'title':'Preserved source headline'}
            identity = store.enqueue(dict(source='TechCrunch',kind='article',url=url,hint=hint),'run')
            store.db.execute("UPDATE tasks SET url_identity='' WHERE id=?",(identity,))
            store.db.commit()
            store.close()
            store = Inventory(path)
            try:
                store.save_homepage('TechCrunch','https://techcrunch.com/',
                                    [{'url':'https://techcrunch.com/lead'}],datetime.now(timezone.utc))
                task = store.homepage_task()
                self.assertEqual(task['id'],identity)
                self.assertEqual(task['url'],url)
                self.assertEqual(task['hint'],hint)
                self.assertEqual(task['url_identity'],'https://techcrunch.com/lead')
            finally:
                store.close()

    def test_homepage_dispatch_precedes_newer_feed_articles_without_losing_backlog(self):
        from news_ingestion import next_task
        now = datetime.now(timezone.utc)
        with tempfile.TemporaryDirectory() as folder:
            store = Inventory(Path(folder)/'inventory.sqlite')
            try:
                urls = [f'https://techcrunch.com/story-{i}' for i in range(7)]
                for i,url in enumerate(urls):
                    store.enqueue(dict(source='TechCrunch',kind='article',url=url,priority=1,
                        hint={'published':(now-timedelta(minutes=7-i)).isoformat()}),'run')
                # Top article is undated in discovery; retrieval verifies its date.
                top = 'https://www.techcrunch.com/lead?utm_source=homepage'
                store.enqueue(dict(source='TechCrunch',kind='article',url=top,priority=2,hint={}), 'run')
                store.save_homepage('TechCrunch','https://techcrunch.com/',
                                    [{'url':'https://techcrunch.com/lead'}],now)
                self.assertEqual(next_task(store,set())['url'],top)
                self.assertEqual(next_task(store,{'TechCrunch'}),None)
                self.assertEqual(store.homepage_task(source='Other'),None)
                for _ in range(4):
                    task = next_task(store,set())
                    store.running(task['id'])
                    store.finish(task['id'],'run')
                self.assertEqual(next_task(store,set())['url'],urls[0])
                self.assertEqual(len(store.ready()),4)
            finally:
                store.close()

    def test_page_replacement_expiry_and_backoff_remove_only_promotions(self):
        from news_ingestion import next_task
        now = datetime.now(timezone.utc)
        with tempfile.TemporaryDirectory() as folder:
            store = Inventory(Path(folder)/'inventory.sqlite')
            try:
                for i in range(3):
                    store.enqueue(dict(source='TechCrunch',kind='article',url=f'https://techcrunch.com/{i}',
                        priority=1,hint={'published':(now-timedelta(minutes=3-i)).isoformat()}),'run')
                home = 'https://techcrunch.com/'
                top = [{'url':'https://techcrunch.com/0'}]
                store.save_homepage('TechCrunch',home,top,now-timedelta(seconds=3601))
                self.assertEqual(next_task(store,set())['url'],'https://techcrunch.com/2')
                store.save_homepage('TechCrunch',home,top,now)
                self.assertEqual(next_task(store,set())['url'],'https://techcrunch.com/0')
                blocked = store.homepage_task()
                store.fail(blocked['id'],'HTTP 429',retry_after=120)
                self.assertEqual(next_task(store,set())['url'],'https://techcrunch.com/2')
                store.save_homepage('TechCrunch',home,[],now)
                self.assertIsNone(store.homepage_task())
                self.assertEqual(store.source_status('TechCrunch')['pending'],3)
            finally:
                store.close()

    def test_homepage_promotion_does_not_delay_index_refresh_or_change_article_cache_hints(self):
        from news_ingestion import next_task
        now = datetime.now(timezone.utc)
        with tempfile.TemporaryDirectory() as folder:
            store = Inventory(Path(folder)/'inventory.sqlite')
            try:
                url = 'https://techcrunch.com/lead'
                hint = {'title':'Known headline','published':now.isoformat()}
                store.enqueue(dict(source='TechCrunch',kind='article',url=url,priority=1,hint=hint),'run')
                store.save_evidence('TechCrunch',url,hint,{'status':'text_extracted','text':'verified facts'})
                store.save_homepage('TechCrunch','https://techcrunch.com/',[{'url':url}],now)
                self.assertIsNotNone(store.evidence(url,hint))
                self.assertEqual(store.homepage_task()['hint'],hint)
                store.enqueue(dict(source='TechCrunch',kind='feed',url='https://techcrunch.com/feed/',priority=0),'run')
                self.assertEqual(next_task(store,set())['kind'],'feed')
            finally:
                store.close()

    def test_undated_recent_sightings_keep_index_priority_and_backlog(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Inventory(Path(folder)/'inventory.sqlite')
            for url, run, priority in [('archive', '2026-10-25', 2),
                                       ('fresh', '2026-10-27', 2),
                                       ('feed', '2026-10-25', 0)]:
                store.enqueue(dict(source='TechCrunch', kind='feed' if url == 'feed' else 'article',
                                   url=url, priority=priority), run)
            self.assertEqual([r['url'] for r in store.ready(recent=True)], ['feed', 'fresh', 'archive'])
            feed = store.ready(recent=True)[0]
            store.running(feed['id'])
            store.finish(feed['id'], 'run2')
            self.assertIsNone(store.db.execute('SELECT * FROM dispatches').fetchone())
            queries = []
            store.db.set_trace_callback(queries.append)
            store.ready(recent=True, limit=1)
            store.db.set_trace_callback(None)
            plan = str([tuple(r) for r in store.db.execute('EXPLAIN QUERY PLAN '+queries[-1])])
            self.assertIn('task_recent', plan)
            self.assertNotIn('TEMP B-TREE', plan)
            store.close()

    def test_fifth_article_request_drains_backlog_even_after_restart(self):
        from news_ingestion import next_task
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'inventory.sqlite'
            store = Inventory(path)
            for i in range(7):
                store.enqueue(dict(source='TechCrunch', kind='article', url=str(i), priority=1,
                                   hint={'published':f'2026-10-27T{10+i:02d}:00:00Z'}), 'run1')
            selected = []
            for _ in range(4):
                task = next_task(store, set())
                selected.append(task['url'])
                store.running(task['id'])
                store.finish(task['id'], 'run1')
            self.assertEqual(selected, ['6', '5', '4', '3'])
            store.close()
            store = Inventory(path)
            task = next_task(store, set())
            self.assertEqual(task['url'], '0')
            store.running(task['id'])
            store.finish(task['id'], 'run2')
            self.assertEqual(next_task(store, set())['url'], '2')
            self.assertFalse(store.checkpoint('TechCrunch', 123))
            self.assertEqual(len(store.ready()), 2)
            self.assertIsNone(next_task(store, {'TechCrunch'}))
            self.assertFalse(store.backlog_turn('Other'))
            store.close()

    def test_recent_dispatch_orders_dates_as_instants_and_preserves_retry_and_source_filters(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Inventory(Path(folder)/'inventory.sqlite')
            for name, published in [('old', '2026-10-25T12:00:00Z'),
                                    ('new', '2026-10-27T12:00:00Z'),
                                    ('offset', '2026-10-27T13:00:00+02:00')]:
                store.enqueue(dict(source='TechCrunch', kind='article', url=name,
                                   priority=1, hint={'published': published}), 'run1')
            blocked = store.enqueue(dict(source='Other', kind='article', url='blocked', priority=0), 'run1')
            store.fail(blocked, 'HTTP429', retry_after=120)
            self.assertEqual([r['url'] for r in store.ready(recent=True)], ['new', 'offset', 'old'])
            self.assertEqual([r['url'] for r in store.ready()], ['old', 'new', 'offset'])
            self.assertEqual(store.ready(recent=True, exclude_sources=('TechCrunch',)), [])
            self.assertEqual(store.ready(recent=True, source='Other'), [])
            self.assertEqual(len(store.ready(recent=True, source='TechCrunch', limit=1)), 1)
            store.close()

    def test_all_urls_survive_a_restart_and_a_small_publication_shortlist(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'inventory.sqlite';store=Inventory(path)
            for i in range(175):store.enqueue({'source':'TechCrunch','kind':'article','url':f'https://techcrunch.com/{i}'},'run1')
            store.close();store=Inventory(path)
            self.assertEqual(len(store.ready()),175)
            for task in store.ready()[:20]:store.finish(task['id'],'run1')
            self.assertEqual(len(store.ready()),155)
            self.assertFalse(store.checkpoint('TechCrunch',123))
            store.close()

    def test_failures_are_retained_for_retry_and_never_advance_checkpoint(self):
        with tempfile.TemporaryDirectory() as folder:
            store=Inventory(Path(folder)/'inventory.sqlite')
            identity=store.enqueue({'source':'TechCrunch','kind':'feed','url':'https://techcrunch.com/feed/'},'run1')
            store.fail(identity,'HTTP429',retry_after=120)
            self.assertEqual(store.ready(),[])
            self.assertEqual(store.source_status('TechCrunch')['pending'],1)
            self.assertFalse(store.checkpoint('TechCrunch',123))
            self.assertEqual(len(store.ready(now=10**12)),1)
            store.finish(identity,'run2')
            self.assertTrue(store.checkpoint('TechCrunch',456))
            store.close()

    def test_changed_source_metadata_invalidates_evidence_and_requeues_a_completed_url(self):
        with tempfile.TemporaryDirectory() as folder:
            store=Inventory(Path(folder)/'inventory.sqlite')
            task={'source':'TechCrunch','kind':'article','url':'https://techcrunch.com/a','hint':{'updated':'first'}}
            identity=store.enqueue(task,'run1');store.finish(identity,'run1')
            store.save_evidence('TechCrunch',task['url'],task['hint'],{'status':'text_extracted','text':'fetched facts'})
            self.assertIsNotNone(store.evidence(task['url'],task['hint']))
            changed={**task,'hint':{'updated':'second'}}
            store.enqueue(changed,'run2')
            self.assertIsNone(store.evidence(task['url'],changed['hint']))
            self.assertEqual(len(store.ready()),1)
            store.close()

    def test_unchanged_old_archive_article_is_not_downloaded_on_every_poll(self):
        with tempfile.TemporaryDirectory() as folder:
            store=Inventory(Path(folder)/'inventory.sqlite')
            task={'source':'TechCrunch','kind':'article','url':'https://techcrunch.com/archive','hint':{}}
            identity=store.enqueue(task,'run1')
            store.save_evidence('TechCrunch',task['url'],{}, {'status':'text_extracted',
                'published':(datetime.now(timezone.utc)-timedelta(days=2)).isoformat(),'text':'Original reporting'})
            store.finish(identity,'run1')
            store.enqueue(task,'run2',refresh=True)
            self.assertEqual(store.ready(),[])
            store.enqueue({**task,'hint':{'updated':'changed'}},'run3',refresh=True)
            self.assertEqual(len(store.ready()),1)
            store.close()


if __name__=='__main__':unittest.main()
