"""Run the real desk scheduler with local fake writers, never OAuth/model calls."""
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from news_source_policy import CATEGORIES, MANIFEST

RUNNER = Path(__file__).with_name('run-hourly-news.sh').read_text(encoding='utf-8')
GIT_BASH = Path('C:/Program Files/Git/bin/bash.exe')
BASH = str(GIT_BASH) if GIT_BASH.exists() else shutil.which('bash')


@unittest.skipUnless(BASH, 'bash is required for the actual scheduler')
class WriterDeskTests(unittest.TestCase):
    def test_every_available_desk_gets_two_drafts_with_no_more_than_five_active_calls(self):
        self.exercise()

    def test_one_stalled_article_cannot_discard_its_sibling_in_the_same_desk(self):
        self.exercise(failed='Teknologji:1')

    def test_one_failed_desk_cannot_discard_the_other_six_desk_results(self):
        self.exercise(failed='Teknologji')

    def test_zero_inventory_desk_does_not_launch_a_writer_or_get_fabricated_coverage(self):
        self.exercise(zero='Botë')

    def exercise(self, failed='', zero=''):
        start = RUNNER.index('run_writer_groups() {')
        helper = RUNNER[start:RUNNER.index('if [ "$FULL_TARGET" -ge 10 ]; then', start)]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            database = root/'calls.sqlite'
            with sqlite3.connect(database) as db:
                db.executescript('CREATE TABLE load(active INTEGER, peak INTEGER); INSERT INTO load VALUES(0,0); CREATE TABLE calls(category TEXT, target INTEGER, slot INTEGER);')
            hosts = {c:next(p['domains'][0] for p in MANIFEST['publishers'] if p['category']==c) for c in CATEGORIES}
            discovery = root/'discovery.json'; batch = root/'batch.json'
            discovery.write_text(json.dumps({'publication_plan':{c:0 if c==zero else 2 for c in CATEGORIES},
                'ready_leads':[{'pair_id':c+str(i),'category':c,'url':f'https://{hosts[c]}/story-{i}',
                                'evidence_path':'/verified/evidence.json'} for c in CATEGORIES for i in range(4)]}),encoding='utf-8')
            fake = root/'fake_writer.py'
            fake.write_text('''import json,re,sqlite3,sys,time
from pathlib import Path
batch,brief,database,target,phase,cap,failed,slot=sys.argv[1:]
assert int(target)==1 and int(phase)==1980 and int(cap)==240
text=Path(brief).read_text(encoding='utf-8')
categories=re.findall(r'^category: (.+)$',text,re.M)
assert len(set(categories))==1 and len(categories)==2
category=categories[0]
with sqlite3.connect(database,timeout=10) as db:
 db.execute('BEGIN IMMEDIATE');db.execute('UPDATE load SET active=active+1');db.execute('UPDATE load SET peak=max(peak,active)');db.execute('INSERT INTO calls VALUES(?,?,?)',(category,int(target),int(slot)))
time.sleep(0.3)
with sqlite3.connect(database,timeout=10) as db:db.execute('UPDATE load SET active=active-1')
if category==failed or category+':'+slot==failed:raise SystemExit(75)
urls=re.findall(r'^url: (.+)$',text,re.M)[:int(target)]
Path(batch).write_text(json.dumps([{'slug':category+slot+str(i),'category':category,'url':url,'body':'Fake local draft'} for i,url in enumerate(urls)]),encoding='utf-8')
''',encoding='utf-8')
            script = helper + '''
set -e
mktemp() { command mktemp -d "$TEST_TEMP/${2##*/}"; }
recover_missing_writer_desks() { :; }
run_writer() { "$PYTHON_BIN" "$TEST_FAKE" "$WRITER_BATCH" "$WRITER_BRIEF" "$TEST_DB" "$L383_TARGET_ARTICLES" "$WRITER_PHASE_END" "$L383_WRITER_ATTEMPT_TIMEOUT" "$TEST_FAILED" "$WRITER_DESK_SLOT"; }
run_writer_groups
'''
            result = subprocess.run([BASH,'-c',script],cwd=Path(__file__).resolve().parent.parent,capture_output=True,text=True,timeout=25,
                env={**os.environ,'PYTHON_BIN':sys.executable,'DISCOVERY':discovery.with_suffix('.md').as_posix(),'BATCH':batch.as_posix(),
                     'PRIMARY_WRITER_MODEL':'gpt-6-luna','TEST_FAKE':fake.as_posix(),'TEST_DB':database.as_posix(),
                     'TEST_FAILED':failed,'TEST_TEMP':root.as_posix(),'PYTHONIOENCODING':'utf-8'})
            self.assertEqual(result.returncode,0,result.stderr+result.stdout)
            with sqlite3.connect(database) as db:
                active,peak=db.execute('SELECT active,peak FROM load').fetchone()
                calls=db.execute('SELECT category,target,slot FROM calls').fetchall()
            self.assertEqual(active,0);self.assertLessEqual(peak,5)
            self.assertEqual(set(calls),{(c,1,s) for c in CATEGORIES if c!=zero for s in (1,2)})
            rows=json.loads(batch.read_text(encoding='utf-8'))
            expected={c:2 for c in CATEGORIES if c not in {zero,failed}}
            if ':' in failed:
                expected[failed.split(':')[0]]=1
            self.assertEqual({c:sum(a['category']==c for a in rows) for c in expected},expected)
            self.assertEqual(len(rows),sum(expected.values()))


if __name__=='__main__':
    unittest.main()
