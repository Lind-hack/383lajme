import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from news_replacement_jobs import prepare, collect
from news_source_policy import CATEGORIES, MANIFEST, hourly_targets

RUNNER = Path(__file__).with_name('run-hourly-news.sh').read_text(encoding='utf-8')
GIT_BASH = Path('C:/Program Files/Git/bin/bash.exe')
BASH = str(GIT_BASH) if GIT_BASH.exists() else shutil.which('bash')


class ReplacementJobTests(unittest.TestCase):
    def test_one_bounded_round_can_fill_five_floor_deficits_before_thirds(self):
        counts={'Kosovë':3,'Shqipëri':1,'Sport':1,'Teknologji':0,'Ekonomi':2,'Botë':3,'Showbiz':1}
        prior=[{'url':f'https://{self.hosts[c]}/old-{i}','category':c,'body':'Approved copy'}
               for c,n in counts.items() for i in range(n)]
        self.approved.write_text(json.dumps(prior),encoding='utf-8')
        discovery=json.loads(self.discovery.read_text(encoding='utf-8'))
        for c in ('Teknologji','Showbiz'):
            for i in range(3):
                pair=f'{c}-{i}'; notes=self.root/(pair+'.notes.json')
                notes.write_text(json.dumps({'pair_id':pair,'facts':['Verified fact '+str(n) for n in range(4)]}),encoding='utf-8')
                discovery['ready_leads'].append({'pair_id':pair,'category':c,'url':f'https://{self.hosts[c]}/new-{i}','facts_path':str(notes)})
        self.discovery.write_text(json.dumps(discovery),encoding='utf-8')
        jobs=prepare(self.discovery,self.approved,self.attempted,self.folder)
        self.assertEqual(len(jobs),5)
        for job in jobs:counts[job['category']]+=1
        self.assertTrue(all(2<=n<=3 for n in counts.values()))

    def test_more_than_five_requests_is_rejected(self):
        with self.assertRaises(ValueError):
            prepare(self.discovery,self.approved,self.attempted,self.folder,limit=6)

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.discovery, self.approved, self.attempted = [self.root/name for name in ('discovery.json', 'approved.json', 'attempted.json')]
        self.hosts = {c: next(p['domains'][0] for p in MANIFEST['publishers'] if p['category'] == c) for c in CATEGORIES}
        leads = []
        for category in ('Kosovë', 'Shqipëri', 'Sport'):
            for index in range(3):
                pair = category + str(index)
                notes = self.root/(pair+'.notes.json')
                notes.write_text(json.dumps({'pair_id': pair, 'facts': ['Verified fact '+str(i) for i in range(4)]}), encoding='utf-8')
                leads.append({'pair_id': pair, 'category': category, 'url': f'https://{self.hosts[category]}/new-{index}',
                              'facts_path': str(notes), 'source': category})
        self.discovery.write_text(json.dumps({'publication_plan': hourly_targets(), 'ready_leads': leads}), encoding='utf-8')
        self.old = [{'category': c, 'url': f'https://{self.hosts[c]}/old-{i}', 'body': 'Approved copy unchanged', 'immutable': {'number': 19}}
                    for c in CATEGORIES if c != 'Shqipëri' for i in range(2)]
        self.approved.write_text(json.dumps(self.old), encoding='utf-8')
        self.attempted.write_text('[]', encoding='utf-8')
        self.folder = self.root/'jobs'

    def test_empty_desk_gets_two_distinct_sources_before_another_desks_third(self):
        before = self.approved.read_bytes()
        jobs = prepare(self.discovery, self.approved, self.attempted, self.folder)
        self.assertEqual([j['category'] for j in jobs[:2]], ['Shqipëri', 'Shqipëri'])
        self.assertEqual(len({j['url'] for j in jobs}), 5)
        for job in jobs:
            text = Path(job['brief']).read_text(encoding='utf-8')
            self.assertEqual([line[5:] for line in text.splitlines() if line.startswith('url: ')], [job['url']])
            self.assertIn('Reporter notes (complete):', text)
            self.assertNotIn('Approved copy unchanged', text)
        self.assertEqual(self.approved.read_bytes(), before)

    def test_used_sources_never_reappear_in_a_replacement_job(self):
        used = f'https://{self.hosts["Shqipëri"]}/new-0'
        self.attempted.write_text(json.dumps([used]), encoding='utf-8')
        jobs = prepare(self.discovery, self.approved, self.attempted, self.folder)
        self.assertNotIn(used, {j['url'] for j in jobs})

    def test_collection_isolates_missing_or_cross_scope_responses(self):
        jobs = prepare(self.discovery, self.approved, self.attempted, self.folder)
        valid = {'url': jobs[0]['url'], 'category': jobs[0]['category'], 'slug': 'valid-new-story', 'title': 'Valid test title', 'body': 'Fake test copy'}
        Path(jobs[0]['output']).write_text(json.dumps([valid]), encoding='utf-8')
        Path(jobs[1]['output']).write_text(json.dumps([{**valid, 'url': 'https://unregistered.example/wrong'}]), encoding='utf-8')
        self.assertEqual(collect(self.folder, self.root/'collected.json'), [valid])
        self.assertEqual(json.loads(self.approved.read_text(encoding='utf-8')), self.old)

    def test_one_request_cannot_return_two_articles_or_overwrite_approved_output_on_failure(self):
        jobs = prepare(self.discovery, self.approved, self.attempted, self.folder)
        row = {'url': jobs[0]['url'], 'category': jobs[0]['category'], 'slug': 'test-story', 'title': 'Test', 'body': 'Fake'}
        Path(jobs[0]['output']).write_text(json.dumps([row, row]), encoding='utf-8')
        before = self.approved.read_bytes()
        with self.assertRaises(ValueError):
            collect(self.folder, self.approved)
        self.assertEqual(self.approved.read_bytes(), before)

    def test_collector_never_reads_a_manifest_path_outside_its_job_folder(self):
        jobs = prepare(self.discovery, self.approved, self.attempted, self.folder)
        outside = self.root/'private.json'
        jobs[0]['output'] = str(outside)
        (self.folder/'jobs.json').write_text(json.dumps({'jobs': jobs}), encoding='utf-8')
        original = Path.read_text
        def checked(path, *args, **kwargs):
            if path == outside:
                raise AssertionError('collector attempted to read outside its own outputs')
            return original(path, *args, **kwargs)
        with patch.object(Path, 'read_text', checked), self.assertRaises(ValueError):
            collect(self.folder, self.root/'collected.json')

    @unittest.skipUnless(BASH, 'Bash is required for the actual scheduler')
    def test_real_scheduler_runs_five_bounded_calls_and_preserves_approved_articles(self):
        self.exercise_scheduler(False)

    @unittest.skipUnless(BASH, 'Bash is required for the actual scheduler')
    def test_all_failed_replacements_leave_approved_file_byte_for_byte_unchanged(self):
        self.exercise_scheduler(True)

    @unittest.skipUnless(BASH, 'Bash is required for the actual scheduler')
    def test_temporary_directory_failure_starts_no_writer_and_preserves_approved_copy(self):
        self.exercise_scheduler(False, temp_fail=True)

    def exercise_scheduler(self, fail, temp_fail=False):
        database = self.root/'load.sqlite'
        with sqlite3.connect(database) as db:
            db.executescript('CREATE TABLE load(active INTEGER, peak INTEGER); INSERT INTO load VALUES(0,0);')
        fake = self.root/'fake.py'
        fake.write_text('''import json,re,sqlite3,sys,time
from pathlib import Path
output,brief,target,phase,cap,database,fail=sys.argv[1:]
assert (int(target),int(phase),int(cap))==(1,2700,180)
text=Path(brief).read_text(encoding='utf-8')
urls=re.findall(r'^url: (.+)$',text,re.M);categories=re.findall(r'^category: (.+)$',text,re.M)
assert len(urls)==len(categories)==1
with sqlite3.connect(database,timeout=10) as db:
 db.execute('BEGIN IMMEDIATE');db.execute('UPDATE load SET active=active+1');db.execute('UPDATE load SET peak=max(peak,active)')
time.sleep(.2)
with sqlite3.connect(database,timeout=10) as db:db.execute('UPDATE load SET active=active-1')
if fail=='1':raise SystemExit(75)
Path(output).write_text(json.dumps([{'url':urls[0],'category':categories[0],'slug':'fake-test-story','title':'Fake title','body':'Fake test draft'}]),encoding='utf-8')
''', encoding='utf-8')
        batch = self.root/'batch.json'
        batch.write_bytes(self.approved.read_bytes())
        before = batch.read_bytes()
        start = RUNNER.index('run_fresh_replacement_writers() {')
        helper = RUNNER[start:RUNNER.index('\ntrack_attempted\nreview_candidates\n', start)]
        script = helper + '''
set +e
mktemp() { if [ "$TEST_TEMP_FAIL" = 1 ]; then return 1; fi; command mktemp -d "$TEST_TEMP/${2##*/}"; }
run_writer() { "$PYTHON_BIN" "$TEST_FAKE" "$WRITER_BATCH" "$WRITER_BRIEF" "$L383_TARGET_ARTICLES" "$WRITER_PHASE_END" "$L383_WRITER_ATTEMPT_TIMEOUT" "$TEST_DB" "$TEST_FAIL"; }
run_fresh_replacement_writers "$TEST_APPROVED"
exit $?
'''
        result = subprocess.run([BASH, '-c', script], cwd=Path(__file__).resolve().parent.parent,
            env={**os.environ, 'PYTHON_BIN': sys.executable, 'BATCH': batch.as_posix(), 'DISCOVERY': self.discovery.with_suffix('.md').as_posix(),
                 'ATTEMPTED': self.attempted.as_posix(), 'TEST_APPROVED': self.approved.as_posix(), 'TEST_TEMP': self.root.as_posix(),
                 'TEST_FAKE': fake.as_posix(), 'TEST_DB': database.as_posix(), 'TEST_FAIL': str(int(fail)),
                 'TEST_TEMP_FAIL': str(int(temp_fail)),
                 'PRIMARY_WRITER_MODEL': 'gpt-6-luna', 'PYTHONIOENCODING': 'utf-8'}, capture_output=True, text=True, timeout=25)
        self.assertEqual(result.returncode, 75 if fail or temp_fail else 0, result.stderr+result.stdout)
        with sqlite3.connect(database) as db:active, peak = db.execute('SELECT active,peak FROM load').fetchone()
        self.assertEqual(active, 0)
        self.assertLessEqual(peak, 5)
        if temp_fail:
            self.assertEqual(peak, 0)
        else:
            self.assertGreaterEqual(peak, 2)
        if fail or temp_fail:
            self.assertEqual(batch.read_bytes(), before)
        else:
            rows = json.loads(batch.read_text(encoding='utf-8'))
            self.assertEqual(rows[:len(self.old)], self.old)
            self.assertEqual(len(rows), len(self.old)+5)


if __name__ == '__main__':
    unittest.main()
