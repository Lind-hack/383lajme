"""Run the real bounded initial scheduler with local draft stubs, never models."""
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from news_source_policy import CATEGORIES, hourly_targets, MANIFEST

BASH = shutil.which('bash')
RUNNER = Path(__file__).with_name('run-hourly-news.sh').read_text(encoding='utf-8')


@unittest.skipUnless(BASH, 'Bash required for scheduler test')
class InitialWriterSchedulerTests(unittest.TestCase):
    def test_temp_failure_starts_no_requests(self):
        start=RUNNER.index('run_writer_groups() {')
        helper=RUNNER[start:RUNNER.index('\nif [ "$FULL_TARGET" -ge 10 ]; then',start)]
        script=helper+'\nmktemp() { return 1; }; run_writer() { exit 99; }; run_writer_groups; test "$?" -eq 75\n'
        result=subprocess.run([BASH,'-c',script],capture_output=True,text=True,timeout=5)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_full_allocation_is_round_robin_with_five_call_ceiling_and_isolated_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            discovery=root/'discovery.json'
            targets=hourly_targets()
            hosts={c:next(p['domains'][0] for p in MANIFEST['publishers'] if p['category']==c) for c in CATEGORIES}
            discovery.write_text(json.dumps({'publication_plan':targets,'ready_leads':[
                {'pair_id':f'{c}-{i}', 'category':c, 'url':f'https://{hosts[c]}/{n}/{i}',
                 'evidence_path':'/private/verified-evidence.json'}
                for n,c in enumerate(CATEGORIES) for i in range(6)]}),encoding='utf-8')
            database=root/'load.sqlite'
            with sqlite3.connect(database) as db:
                db.executescript('CREATE TABLE load(active,peak); INSERT INTO load VALUES(0,0);')
            fake=root/'fake.py'
            fake.write_text('''import json,re,sys,sqlite3,time
from pathlib import Path
output,brief,target,phase,cap,database,slot=sys.argv[1:]
assert (int(target),int(phase),int(cap))==(1,1980,240)
text=Path(brief).read_text(encoding='utf-8')
urls=re.findall(r'^url: (.+)$',text,re.M)
category=re.search(r'^category: (.+)$',text,re.M).group(1)
assert len(urls)==2
with sqlite3.connect(database,timeout=10) as db:
 db.execute('BEGIN IMMEDIATE');db.execute('UPDATE load SET active=active+1');db.execute('UPDATE load SET peak=max(peak,active)')
time.sleep(.15)
with sqlite3.connect(database,timeout=10) as db:db.execute('UPDATE load SET active=active-1')
if category=='Kosovë' and slot=='1':raise SystemExit(75)
Path(output).write_text(json.dumps([{'slug':urls[0].rsplit('/',2)[-2]+'-'+slot,'url':urls[0],'category':category,'body':'Local test draft'}]),encoding='utf-8')
''',encoding='utf-8')
            start=RUNNER.index('run_writer_groups() {')
            helper=RUNNER[start:RUNNER.index('\nif [ "$FULL_TARGET" -ge 10 ]; then',start)]
            script=helper+'''
set -e
mktemp() { command mktemp -d "$TEST_TEMP/${2##*/}"; }
recover_missing_writer_desks() { :; }
run_writer() { "$PYTHON_BIN" "$TEST_FAKE" "$WRITER_BATCH" "$WRITER_BRIEF" "$L383_TARGET_ARTICLES" "$WRITER_PHASE_END" "$L383_WRITER_ATTEMPT_TIMEOUT" "$TEST_DB" "$WRITER_DESK_SLOT"; }
run_writer_groups
'''
            batch=root/'batch.json'
            result=subprocess.run([BASH,'-c',script],cwd=Path(__file__).resolve().parent.parent,
                env={**os.environ,'PYTHON_BIN':sys.executable,'DISCOVERY':discovery.with_suffix('.md').as_posix(),
                     'BATCH':batch.as_posix(),'TEST_TEMP':root.as_posix(),'TEST_FAKE':fake.as_posix(),
                     'TEST_DB':database.as_posix(),'PRIMARY_WRITER_MODEL':'gpt-6-luna','PYTHONIOENCODING':'utf-8'},
                capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            calls=[line for line in result.stdout.splitlines() if line.startswith('383 DESK WRITER:')]
            self.assertEqual(len(calls),20)
            self.assertTrue(all('slot=1 ' in line for line in calls[:7]))
            self.assertTrue(all('slot=2 ' in line for line in calls[7:14]))
            self.assertTrue(all('slot=3 ' in line for line in calls[14:]))
            rows=json.loads(batch.read_text(encoding='utf-8'))
            self.assertEqual(len(rows),19)
            self.assertEqual(len({r['url'] for r in rows}),19)
            with sqlite3.connect(database) as db: active,peak=db.execute('SELECT active,peak FROM load').fetchone()
            self.assertEqual(active,0)
            self.assertLessEqual(peak,5)
            self.assertGreater(peak,1)
