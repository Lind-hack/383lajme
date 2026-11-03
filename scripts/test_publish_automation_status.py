import importlib.util
import os
import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('publisher', root / 'scripts/publish-automation-status.py')
publisher = importlib.util.module_from_spec(spec)
with patch.dict(os.environ, {'L383_REPO': str(root)}):
    spec.loader.exec_module(publisher)


class StatusTests(unittest.TestCase):
    def setup_desks(self, root):
        from news_batch_identity import DESKS
        for slug, category in DESKS.items():
            desk = root / 'desks' / slug
            (desk / 'hourly-runs').mkdir(parents=True)
            (desk / 'runtime/data/auto-articles').mkdir(parents=True)
            self.save_state(root, slug, 'no_news')

    def save_state(self, root, slug, status, rows=None):
        desk = root / 'desks' / slug
        batch = desk / 'runtime/data/auto-articles/2026-11-03T19.json'
        if rows is not None:
            batch.write_text(json.dumps(rows), encoding='utf-8')
        (desk / 'hourly-runs/2026-11-03T19-mode0.json').write_text(json.dumps({
            'status': status, 'stage': status, 'batch': str(batch), 'updated_at': '2026-11-03T20:10:00+00:00'}))

    def test_category_snapshot_verifies_completed_copy_and_never_publishes_drafts(self):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            self.setup_desks(state)
            rows = [{'title':'Verified headline', 'slug':'verified', 'category':'Kosovë', 'body':'PRIVATE FULL COPY'}]
            self.save_state(state, 'kosove', 'complete', rows)
            self.save_state(state, 'sport', 'running', [{'title':'Draft', 'slug':'draft', 'category':'Sport'}])
            discovery = state / 'desks/kosove/runtime/.last30days/cloud-news-discovery-current.json'
            discovery.parent.mkdir()
            discovery.write_text(json.dumps({'leads': [], 'sources': [{'status':'incomplete', 'eligible':1}]}))
            with patch.object(publisher, '_verify_batch_readback') as verify:
                snapshot = publisher.category_snapshot(state, verify)
                verify.assert_called_once_with('2026-11-03T19-kosove', rows)
                batches = {batch['category']: batch for batch in snapshot['news']['batches']}
                self.assertTrue(batches['Kosovë']['published'])
                self.assertFalse(batches['Sport']['published'])
                self.assertEqual(snapshot['news']['working_feeds'], 1)
                self.assertNotIn('PRIVATE FULL COPY', json.dumps(snapshot))
                publisher.category_snapshot(state, verify)
                self.assertEqual(verify.call_count, 1)
            rows[0]['title'] = 'Changed after verification'
            self.save_state(state, 'kosove', 'complete', rows)
            with patch.object(publisher, '_verify_batch_readback', side_effect=ValueError('copy mismatch')):
                snapshot = publisher.category_snapshot(state, publisher._verify_batch_readback)
                self.assertFalse(next(b for b in snapshot['news']['batches'] if b['category']=='Kosovë')['published'])

    def test_recovered_desk_updates_parent_result_without_hiding_an_unrecovered_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            self.setup_desks(state)
            self.save_state(state, 'kosove', 'complete', [{'title':'Published', 'slug':'published', 'category':'Kosovë'}])
            self.save_state(state, 'sport', 'failed')
            with patch.object(publisher, '_verify_batch_readback') as verify:
                snapshot = publisher.category_snapshot(state, verify)
                report = {'jobs':[{'id':'383-production','status':'failed','enabled':True,'error':'first attempt failed'}]}
                publisher.apply_category_status(report, snapshot)
                self.assertEqual(report['jobs'][0]['status'], 'failed')
                self.assertIn('1 artikuj', report['jobs'][0]['result'])
                self.save_state(state, 'sport', 'complete', [{'title':'Recovered', 'slug':'recovered', 'category':'Sport'}])
                snapshot = publisher.category_snapshot(state, verify)
                report = {'jobs':[{'id':'383-production','status':'failed','enabled':True,'error':'first attempt failed'}]}
                publisher.apply_category_status(report, snapshot)
                self.assertEqual(report['jobs'][0]['status'], 'success')
                self.assertEqual(report['jobs'][0]['attempt_status'], 'failed')
                self.assertEqual(len(report['jobs']), 8)
                self.assertIn('2 artikuj', report['jobs'][0]['result'])

    def test_copy_changed_during_database_readback_is_never_attested(self):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            self.setup_desks(state)
            rows = [{'title':'Original', 'slug':'original', 'category':'Kosovë'}]
            self.save_state(state, 'kosove', 'complete', rows)
            def mutate(key, articles):
                self.save_state(state, 'kosove', 'complete', [{**rows[0], 'title':'Changed'}])
            snapshot = publisher.category_snapshot(state, mutate)
            self.assertFalse(snapshot['news']['batches'][0]['published'])
            self.assertFalse((state / 'status-readbacks').exists())

    def test_live_verified_publication_survives_mail_failure_but_error_stays_visible(self):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            self.setup_desks(state)
            self.save_state(state, 'kosove', 'published', [{'title':'Live article', 'slug':'live', 'category':'Kosovë'}])
            path = state / 'desks/kosove/hourly-runs/2026-11-03T19-mode0.json'
            row = json.loads(path.read_text()); row['stage'] = 'report-delivery'; path.write_text(json.dumps(row))
            with patch.object(publisher, '_verify_batch_readback') as verify:
                snapshot = publisher.category_snapshot(state, verify)
                self.assertTrue(snapshot['news']['batches'][0]['published'])
                report = {'jobs':[{'id':'383-production','status':'failed','enabled':True}]}
                publisher.apply_category_status(report, snapshot)
                self.assertEqual(report['jobs'][0]['status'], 'failed')
                self.assertEqual(report['jobs'][1]['status'], 'failed')
                self.assertIn('1 artikuj', report['jobs'][1]['result'])

    def test_stopped_worker_is_not_running_forever_and_newer_retry_is_not_failed(self):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            self.setup_desks(state)
            self.save_state(state, 'kosove', 'running')
            outcomes = state / 'hourly-runs/2026-11-03T19-desks-mode0/outcomes.json'
            outcomes.parent.mkdir(parents=True)
            outcomes.write_text(json.dumps({'kosove':{'returncode':124, 'updated_at':'2026-11-03T20:10:00+00:00'}}))
            snapshot = publisher.category_snapshot(state, lambda *_: None)
            self.assertEqual(snapshot['desks'][0]['state'], 'failed')
            path = state / 'desks/kosove/hourly-runs/2026-11-03T19-mode0.json'
            row = json.loads(path.read_text()); row['updated_at']='2026-11-03T20:11:00+00:00'; path.write_text(json.dumps(row))
            snapshot = publisher.category_snapshot(state, lambda *_: None)
            self.assertEqual(snapshot['desks'][0]['state'], 'running')
    def test_private_storage_override_avoids_public_edge_filter(self):
        env = {'AUTOMATION_STATUS_SUPABASE_URL': 'http://supabase-envoy:8000/',
               'NEXT_PUBLIC_SUPABASE_URL': 'https://public.example'}
        self.assertEqual(publisher.storage_base(env), 'http://supabase-envoy:8000/storage/v1')

    def test_public_storage_is_used_only_without_an_override(self):
        self.assertEqual(publisher.storage_base({'NEXT_PUBLIC_SUPABASE_URL': 'https://public.example/'}),
                         'https://public.example/storage/v1')


if __name__ == '__main__':
    unittest.main()
