import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cloud_news_discovery import select_hourly_leads
from news_ingestion import _execute, _snapshot
from news_ingestion_store import Inventory
from prepare_editor_sources import prioritize_grounded_leads


NOW = datetime.now(timezone.utc)
PUB = {'source': 'TechCrunch', 'category': 'Teknologji', 'domains': ['techcrunch.com']}


def lead(path, **extra):
    return dict(url='https://techcrunch.com/'+path, source='TechCrunch',
                category='Teknologji', title='OpenAI launches '+path+' model',
                published=NOW.isoformat(), **extra)


def observation(position, **extra):
    return dict(url='https://techcrunch.com/', position=position, article_count=120,
                observed_at=NOW.isoformat(), method='public_html_dom_order', **extra)


class HomepagePriorityTests(unittest.TestCase):
    def test_rendered_priority_is_cached_without_renewing_capture_time_or_losing_dynamic_urls(self):
        from news_homepage_priority import homepage_weight
        top = dict(url='https://techcrunch.com/dynamic', title='Dynamic headline news', published='',
                   geometry=dict(top=40,left=0,width=600,height=400))
        viewport = dict(width=1440,height=1000)
        with tempfile.TemporaryDirectory() as folder:
            store = Inventory(Path(folder)/'inventory.sqlite')
            try:
                store.save_homepage(PUB['source'],'https://techcrunch.com/',[top],NOW,
                                    method='public_browser_geometry',viewport=viewport)
                cached = store.cached_homepage('https://techcrunch.com/',NOW+timedelta(minutes=5))
                self.assertEqual(cached['captured_at'],NOW.timestamp())
                self.assertIsNone(store.cached_homepage('https://techcrunch.com/',NOW+timedelta(minutes=16)))
                observation = store.homepage_observations(NOW)[top['url']]
                self.assertGreater(homepage_weight({'homepage':observation},NOW),0)
                task = dict(source=PUB['source'],kind='listing',url='https://techcrunch.com/',
                            hint={},homepage_cached=cached)
                result = _execute(task,{PUB['source']:PUB},{},NOW,
                    lambda url,**kw:dict(url=url,payload=b'<html></html>',headers={}),
                    renderer=lambda *args: self.fail('cached page must not relaunch browser'))
                self.assertIn(top['url'],[row['url'] for row in result['articles']])
                self.assertNotIn('geometry',result['articles'][0])
                self.assertEqual(result['homepage']['captured_at'],NOW.timestamp())
            finally:
                store.close()

    def test_renderer_failure_keeps_html_and_explicit_diagnostic(self):
        task = dict(source=PUB['source'],kind='listing',url='https://techcrunch.com/',hint={})
        def unavailable(*args):
            raise ValueError('renderer deadline')
        result = _execute(task,{PUB['source']:PUB},{},NOW,
            lambda url,**kw:dict(url=url,payload=b'<h2><a href="/fallback">Fallback headline news</a></h2>',headers={}),
            renderer=unavailable)
        self.assertEqual(result['homepage']['method'],'public_html_dom_order')
        self.assertEqual(result['homepage']['render_error'],'renderer deadline')
        self.assertEqual(len(result['articles']),1)

    def test_homepage_order_survives_selection_and_grounded_preparation(self):
        lower = lead('Atlas', homepage=observation(90))
        top = lead('Orion', homepage=observation(1))
        # Deliberately dissimilar event terms prevent event collapse.
        lower['title'] = 'Microsoft fixes Windows security vulnerability'
        selected = select_hourly_leads([lower, top], now=NOW)
        self.assertEqual(selected[0]['url'], top['url'])
        self.assertEqual({r['url'] for r in selected}, {lower['url'], top['url']})
        for row in (lower, top):
            row['primary_evidence'] = {'status': 'text_extracted', 'text': 'Verified fact. '*160}
        self.assertEqual(prioritize_grounded_leads([lower, top], now=NOW)[0]['url'], top['url'])

    def test_stale_or_future_homepage_cannot_promote_a_story(self):
        from news_homepage_priority import homepage_weight
        for age in (-60, 3601):
            row = lead('old', homepage={**observation(1),
                       'observed_at': (NOW-timedelta(seconds=age)).isoformat()})
            self.assertEqual(homepage_weight(row, NOW), 0)
        self.assertGreater(homepage_weight(lead('fresh', homepage=observation(1)), NOW), 0)
        for bad in ('unverified', [], {'position': True}, {**observation(1), 'method': 'claimed_visual_order'}):
            self.assertEqual(homepage_weight(lead('bad', homepage=bad), NOW), 0)

    def test_top_opinion_remains_reserve_and_cannot_jump_a_grounded_report(self):
        top = lead('Orion', homepage=observation(1), tags=['opinion'])
        report = lead('Atlas')
        report['title'] = 'Microsoft fixes Windows security vulnerability'
        self.assertEqual(select_hourly_leads([top, report], now=NOW)[0]['url'], report['url'])
        for row in (top, report):
            row['primary_evidence'] = {'status': 'text_extracted', 'text': 'Verified fact. '*160}
        self.assertEqual(prioritize_grounded_leads([top, report], now=NOW)[0]['url'], report['url'])

    def test_replacing_homepage_removes_old_promotions_without_deleting_inventory(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Inventory(Path(folder)/'inventory.sqlite')
            one, two = lead('Orion'), lead('Atlas')
            store.save_homepage(PUB['source'], 'https://techcrunch.com/', [one, two], NOW)
            store.save_homepage(PUB['source'], 'https://techcrunch.com/', [two], NOW)
            observed = store.homepage_observations(NOW)
            self.assertNotIn(one['url'], observed)
            self.assertEqual(observed[two['url']]['position'], 1)
            self.assertEqual(observed[two['url']]['article_count'], 1)
            store.close()

    def test_only_root_page_supplies_prominence_and_hidden_cards_do_not_count(self):
        html = ('<nav><a href="/menu">News menu</a></nav>'
                '<div><a href="/category">Latest news</a></div>'
                '<article hidden><h2><a href="/hidden">Hidden news headline</a></h2></article>'
                '<article><a href="/category">Category name</a><h2><a href="/top">Top news headline</a></h2></article>'
                '<article><h2><a href="/bottom">Lower news headline</a></h2></article>')
        fetcher = lambda url, **kw: dict(url=url, payload=html.encode(), headers={})
        task = dict(source=PUB['source'], kind='listing', url='https://techcrunch.com/', hint={})
        result = _execute(task, {PUB['source']: PUB}, {}, NOW, fetcher)
        self.assertEqual([r['url'].split('/')[-1] for r in result['homepage']['articles']], ['top', 'bottom'])
        self.assertIn('https://techcrunch.com/hidden', [r['url'] for r in result['articles']])
        task['url'] = 'https://techcrunch.com/news/page/2'
        self.assertIsNone(_execute(task, {PUB['source']: PUB}, {}, NOW, fetcher)['homepage'])

    def test_owned_edition_redirect_preserves_homepage_order(self):
        from news_source_policy import publisher_for
        publisher = publisher_for('https://www.theguardian.com/')
        html = '<article><h2><a href="/world/2026/oct/30/story">Verified news headline</a></h2></article>'
        fetcher = lambda url, **kw: dict(url='https://www.theguardian.com/international',
                                         payload=html.encode(), headers={})
        task = dict(source=publisher['source'], kind='listing', url='https://www.theguardian.com/', hint={})
        result = _execute(task, {publisher['source']: publisher}, {}, NOW, fetcher)
        self.assertEqual(len(result['homepage']['articles']), 1)

    def test_snapshot_joins_homepage_without_changing_article_cache_hints(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Inventory(Path(folder)/'inventory.sqlite')
            row = lead('Orion')
            evidence = dict(url=row['url'], title=row['title'], status='text_extracted',
                            published=NOW.isoformat(), text='OpenAI launches a new AI model. '*60)
            store.save_evidence(PUB['source'], row['url'], row, evidence)
            alias = {**row, 'url':row['url'].replace('https://','https://www.')+'?utm_source=home'}
            store.save_homepage(PUB['source'], 'https://techcrunch.com/', [alias,row], NOW)
            leads = _snapshot(store, {PUB['source']: PUB}, NOW, {}, NOW.timestamp(), checkpoint=False)[0]
            self.assertEqual(leads[0]['homepage']['position'], 1)
            self.assertEqual(leads[0]['homepage']['article_count'], 1)
            self.assertEqual(store.evidence(row['url'], row), evidence)
            store.close()

    def test_discovery_duplicate_alias_preserves_strongest_observation(self):
        first = lead('Orion')
        second = {**first, 'url':first['url'].replace('https://','https://www.'),
                  'homepage':observation(1)}
        selected = select_hourly_leads([first, second], now=NOW)
        self.assertEqual(len(selected),1)
        self.assertEqual(selected[0]['homepage']['position'],1)


if __name__ == '__main__':
    unittest.main()
