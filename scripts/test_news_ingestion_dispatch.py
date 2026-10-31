import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from news_ingestion import next_task, _execute
from news_ingestion_store import Inventory


class DispatchTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name)/'inventory.sqlite'
        self.store = Inventory(self.path)
        self.source = 'TechCrunch'
        self.root = self.store.enqueue(dict(source=self.source,kind='listing',url='https://techcrunch.com/',
            hint={'_homepage_root': True},priority=-1),'fixture')
        for number in range(100):
            self.store.enqueue(dict(source=self.source,kind='sitemap',url=f'https://techcrunch.com/index-{number}.xml',
                hint={},priority=0),'fixture')
        for number in range(12):
            self.store.enqueue(dict(source=self.source,kind='article',url=f'https://techcrunch.com/article-{number}',
                hint={},priority=1),'fixture')
        self.store.save_homepage(self.source,'https://techcrunch.com/',
            [{'url':f'https://techcrunch.com/article-{n}'} for n in (9,8,7,6)],datetime.now(timezone.utc))

    def tearDown(self):
        self.store.close()
        self.folder.cleanup()

    def take(self):
        task=next_task(self.store,set())
        self.store.running(task['id'])
        self.store.finish(task['id'],'test')
        return task

    def test_index_backlog_cannot_starve_homepage_bodies_or_index_refresh(self):
        first=[self.take() for _ in range(3)]
        self.assertEqual([r['url'].rsplit('/',1)[1] for r in first],['article-9','article-8','article-7'])
        # The persisted ratio survives collector restarts and still refreshes
        # the homepage before older source-index pages.
        self.store.close();self.store=Inventory(self.path)
        self.assertEqual(self.take()['id'],self.root)
        remaining=[self.take() for _ in range(8)]
        self.assertTrue(any(r['kind']=='sitemap' for r in remaining))
        self.assertGreaterEqual(sum(r['kind']=='article' for r in remaining),6)

    def test_fifth_article_request_keeps_unfeatured_backlog_alive(self):
        articles=[]
        while len(articles)<5:
            row=self.take()
            if row['kind']=='article':articles.append(row)
        self.assertEqual(articles[-1]['url'],'https://techcrunch.com/article-0')

    def test_busy_renderer_slots_do_not_block_article_fetches(self):
        row=next_task(self.store,set(),allow_homepages=False)
        self.assertEqual(row['kind'],'article')
        self.assertEqual(next_task(self.store,{self.source},allow_homepages=False),None)

    def test_cached_hits_do_not_consume_request_ratio(self):
        row=next_task(self.store,set())
        self.store.finish(row['id'],'cached')
        self.assertFalse(self.store.index_turn(self.source))
        self.assertEqual(next_task(self.store,set())['kind'],'article')

    def test_pagination_does_not_inherit_the_browser_root_marker(self):
        publisher={'source':self.source,'domains':['techcrunch.com']}
        task={'source':self.source,'kind':'listing','url':'https://techcrunch.com/',
              'hint':{'_homepage_root':True}}
        fetch=lambda url,**kw:dict(url=url,payload=b'<a rel="next" href="/page/2">Next</a>',headers={})
        result=_execute(task,{self.source:publisher},{self.source:0},datetime.now(timezone.utc),fetch)
        page=next(row for row in result['tasks'] if row['kind']=='listing')
        self.assertNotIn('_homepage_root',page['hint'])


if __name__=='__main__':unittest.main()
