import tempfile
import unittest
from pathlib import Path

from news_ingestion_store import Inventory


class InventoryTests(unittest.TestCase):
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


if __name__=='__main__':unittest.main()
