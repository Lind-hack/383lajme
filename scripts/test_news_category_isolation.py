"""Desk isolation must preserve each real editorial policy."""
import unittest
import os
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import time
import threading
from unittest.mock import patch

from news_story_review import editorial_prompt
from news_batch_identity import DESKS, batch_key
from news_category_runs import run_desks
from news_context_review import history_records
from news_model_slots import model_slot, connect
import news_model
import codex_automation_support as support


class CategoryPromptTests(unittest.TestCase):
    def test_showbiz_and_economy_prompts_do_not_shadow_each_other(self):
        showbiz = editorial_prompt('Showbiz')
        economy = editorial_prompt('Ekonomi')
        self.assertIn('young Albanian-speaking readers in Kosovo', showbiz)
        self.assertIn('Review Ekonomi news', economy)
        self.assertEqual(editorial_prompt('Showbiz'), showbiz)

    def test_publication_identity_excludes_only_this_desk_from_history(self):
        path = Path('2026-11-03T14.json')
        history = [{'id': 'a', 'batch_key': path.stem},
                   {'id': 'b', 'batch_key': path.stem + '-showbiz'},
                   {'id': 'c', 'batch_key': path.stem + '-ekonomi'}]
        with patch.dict(os.environ, {'L383_RUN_DESK': 'showbiz'}):
            self.assertEqual(batch_key(path), path.stem + '-showbiz')
            self.assertEqual([row['id'] for row in history_records(history, path)], ['a', 'c'])
        with patch.dict(os.environ, {'L383_RUN_DESK': ''}):
            self.assertEqual(batch_key(path), path.stem)
        with patch.dict(os.environ, {'L383_RUN_DESK': '../bad'}), self.assertRaises(ValueError):
            batch_key(path)

    def test_desk_report_labels_only_its_own_publication_plan(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / '.last30days').mkdir()
            (root / '.last30days/cloud-news-discovery-current.json').write_text(
                json.dumps({'publication_plan': {'Showbiz': 7}}))
            env = {'L383_RUN_DESK': 'showbiz', 'L383_NEWS_CATEGORIES': 'Showbiz',
                   'L383_REPO': str(root), 'L383_HOURLY_NEWS': '1',
                   'GMAIL_USER': 'fixture', 'GMAIL_APP_PASSWORD': 'fixture'}
            with patch.dict(os.environ, env), patch.object(support, 'load_env'), \
                    patch.object(support, 'read_articles', return_value=[{'category': 'Showbiz'}]), \
                    patch.object(support, '_verify_batch_readback') as verified, \
                    patch.object(support, 'validate_batch', side_effect=ValueError('Later desk changed publication history')) as validate, \
                    patch.object(support, '_article_card', return_value='<p>Fixture article link</p>'), \
                    patch.object(support, '_send_gmail_report', return_value=0) as send:
                self.assertEqual(support.send_report(root / '2026-11-03T14.json'), 0)
                self.assertTrue(send.call_args.args[3].startswith('[Showbiz]'))
                self.assertIn('Showbiz: 1/7', send.call_args.args[4])
                self.assertNotIn('Kosovë: 0/', send.call_args.args[4])
                verified.assert_called_once_with('2026-11-03T14-showbiz', [{'category':'Showbiz'}])
                validate.assert_not_called()

    def test_desk_report_cannot_send_unpublished_or_changed_copy(self):
        for articles in ([], [{'category':'Showbiz'}]):
            with self.subTest(articles=articles), patch.dict(os.environ, {'L383_RUN_DESK':'showbiz'}), \
                    patch.object(support, 'load_env'), patch.object(support, 'read_articles', return_value=articles), \
                    patch.object(support, '_verify_batch_readback', side_effect=ValueError('No matching published copy')), \
                    patch.object(support, '_send_gmail_report') as send:
                with self.assertRaises(ValueError):
                    support.send_report(Path('2026-11-03T14.json'))
                send.assert_not_called()

    @unittest.skipUnless(os.name == 'posix', 'Runtime directory symlinks run on Linux')
    def test_seven_real_processes_have_independent_artifacts_and_one_failure_does_not_abort_others(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            code = root / 'code'
            for name in ('scripts', 'docs'):
                (code / name).mkdir(parents=True)
            fake = root / 'worker.py'
            fake.write_text('''import os,json,time
from pathlib import Path
slug=os.environ['L383_RUN_DESK']
time.sleep(.3 if slug=='showbiz' else .05)
Path('.last30days/evidence.json').write_text(json.dumps({'desk':slug}))
state=Path(os.environ['L383_STATE_ROOT']);state.mkdir(parents=True)
(state/(os.environ['STAMP']+'-mode1.json')).write_text(json.dumps({'status':'qa_complete','desk':slug}))
raise SystemExit(75 if slug=='sport' else 0)
''', encoding='utf-8')
            results = run_desks(code, root / 'state', '2026-11-03T14',
                                {**os.environ, 'L383_QA_ONLY': '1'}, [sys.executable, str(fake)])
            self.assertEqual(set(results), set(DESKS))
            self.assertEqual(results['sport']['returncode'], 75)
            self.assertEqual(results['sport']['status'], 'failed')
            for slug in DESKS:
                if slug != 'sport':
                    self.assertEqual(results[slug]['status'], 'qa_complete')
                evidence = root / 'state' / 'desks' / slug / 'runtime/.last30days/evidence.json'
                self.assertEqual(json.loads(evidence.read_text())['desk'], slug)
            self.assertEqual(len(list((root / 'state/desks').glob('*/hourly-runs/*.json'))), 7)

    @unittest.skipUnless(os.name == 'posix', 'Production flock runs on Linux')
    def test_actual_final_phase_lock_prevents_sibling_history_changes(self):
        script = Path(__file__).with_name('run-hourly-news.sh').read_text(encoding='utf-8')
        start = script.index('stage="publication-lock"')
        end = script.index('stage="independent-event-context-review"', start)
        release = script.index('flock -u 8', end)
        self.assertLess(script.index('publish-supabase --file', end), release)
        self.assertLess(release, script.index('stage="news-cache-refresh"', end))
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            history = root / 'history'
            history.write_text('')
            acquire = script[start:end].replace('/tmp/383-news-publication.lock', str(root / 'publish.lock'))
            harness = '''set -e
START_EPOCH=$(date +%s)
fail_run() { exit 75; }
''' + acquire + '''
snapshot=$(cat "$TEST_HISTORY")
sleep .05
test "$snapshot" = "$(cat "$TEST_HISTORY")" || exit 9
printf '%s\\n' "$L383_RUN_DESK" >> "$TEST_HISTORY"
'''
            children = [subprocess.Popen(['bash', '-c', harness], env={**os.environ,
                        'L383_RUN_DESK': slug, 'TEST_HISTORY': str(history)}) for slug in DESKS]
            for child in children:
                self.assertEqual(child.wait(timeout=10), 0)
            self.assertEqual(set(history.read_text().splitlines()), set(DESKS))


class ModelCapacityTests(unittest.TestCase):
    def test_cancellation_removes_queued_work_without_starting_it(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
                'L383_MODEL_SLOT_DB': str(Path(folder) / 'slots.sqlite')}):
            from contextlib import ExitStack
            with ExitStack() as stack:
                for _ in range(5):
                    stack.enter_context(model_slot([], time.monotonic() + 5))
                cancel = threading.Timer(.1, news_model._TERMINATING.set)
                cancel.start()
                try:
                    with patch.object(news_model.subprocess, 'Popen') as spawn:
                        with self.assertRaises(subprocess.TimeoutExpired):
                            news_model.run_process(['cancelled'], 5)
                        spawn.assert_not_called()
                    with connect(os.environ['L383_MODEL_SLOT_DB']) as db:
                        self.assertEqual(db.execute('SELECT count(*) FROM requests').fetchone()[0], 5)
                finally:
                    cancel.join()
                    news_model._TERMINATING.clear()

    def test_idle_desk_gets_free_capacity_before_an_already_busy_desk(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
                'L383_MODEL_SLOT_DB': str(Path(folder) / 'slots.sqlite'), 'L383_RUN_DESK': 'kosove'}):
            # Initialize the schema, then represent four in-flight Economy calls
            # and its earlier queued fifth call. Kosovo must get the free slot.
            with model_slot([], time.monotonic() + 2):
                pass
            with connect(os.environ['L383_MODEL_SLOT_DB']) as db:
                db.executemany('INSERT INTO requests VALUES (?, ?, ?, ?, ?, NULL)',
                               [(str(n), 'ekonomi', os.getpid(), 0, int(n < 4)) for n in range(5)])
            with model_slot([], time.monotonic() + 1):
                with connect(os.environ['L383_MODEL_SLOT_DB']) as db:
                    self.assertEqual(db.execute("SELECT count(*) FROM requests WHERE active=1 AND desk='kosove'").fetchone()[0], 1)

    def test_queue_wait_consumes_deadline_without_starting_model(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
                'L383_MODEL_SLOT_DB': str(Path(folder) / 'slots.sqlite'), 'L383_RUN_DESK': 'showbiz'}):
            from contextlib import ExitStack
            with ExitStack() as stack:
                for _ in range(5):
                    stack.enter_context(model_slot([], time.monotonic() + 5))
                with patch.object(news_model.subprocess, 'Popen') as spawn:
                    with self.assertRaises(subprocess.TimeoutExpired):
                        news_model.run_process(['do-not-start'], .15)
                    spawn.assert_not_called()
                with connect(os.environ['L383_MODEL_SLOT_DB']) as db:
                    self.assertEqual(db.execute('SELECT count(*) FROM requests').fetchone()[0], 5)

    @unittest.skipUnless(os.name == 'posix', 'Linux cross-process worker capacity')
    def test_global_capacity_across_processes_and_dead_owner_recovery(self):
        with tempfile.TemporaryDirectory() as folder:
            database = Path(folder) / 'slots.sqlite'
            env = {**os.environ, 'L383_MODEL_SLOT_DB': str(database),
                   'PYTHONPATH': str(Path(__file__).resolve().parent)}
            code = '''import os,time,sqlite3
from news_model_slots import model_slot
with model_slot([],time.monotonic()+10):
 with sqlite3.connect(os.environ['L383_MODEL_SLOT_DB']) as db:
  count=db.execute('SELECT count(*) FROM requests WHERE active=1').fetchone()[0]
 print(count,flush=True)
 time.sleep(.2)
'''
            children = [subprocess.Popen([sys.executable, '-c', code], env={**env, 'L383_RUN_DESK': slug},
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for slug in list(DESKS) * 2]
            counts = []
            for child in children:
                out, err = child.communicate(timeout=15)
                self.assertEqual(child.returncode, 0, err)
                counts.append(int(out))
            self.assertTrue(all(1 <= count <= 5 for count in counts))
            with connect(database) as db:
                self.assertEqual(db.execute('SELECT count(*) FROM requests').fetchone()[0], 0)
                db.executemany('INSERT INTO requests VALUES (?, ?, ?, ?, 1, NULL)',
                               [(str(n), 'dead', 99999999, 0) for n in range(5)])
            with patch.dict(os.environ, env), model_slot([], time.monotonic() + 2):
                with connect(database) as db:
                    self.assertEqual(db.execute('SELECT count(*) FROM requests').fetchone()[0], 1)


if __name__ == '__main__':
    unittest.main()
