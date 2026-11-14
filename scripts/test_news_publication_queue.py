"""Publication queue contract, using fake external review/database commands."""
import json,os,subprocess,sys,tempfile,time,unittest
from pathlib import Path


@unittest.skipUnless(os.name=='posix','Production publication flock requires Linux')
class PublicationQueueTests(unittest.TestCase):
    def test_model_review_never_holds_the_publication_lock_but_commit_does(self):
        calls=self.exercise()
        self.assertEqual(calls.count('model-unlocked'),1)
        self.assertEqual(calls.count('commit-locked'),1)
        self.assertIn('validate',calls);self.assertIn('copyright-verify',calls);self.assertIn('source-mix',calls)

    def test_changed_history_releases_lock_before_a_fresh_review_and_commits_once(self):
        calls=self.exercise(race=True)
        self.assertEqual(calls.count('model-unlocked'),2)
        self.assertEqual(calls.count('commit-locked'),1)

    def test_dry_run_checks_history_without_database_publication(self):
        calls=self.exercise(qa=True)
        self.assertIn('history-locked',calls)
        self.assertNotIn('commit-locked',calls)

    def test_repeated_history_changes_stop_after_two_comparisons_without_insertion(self):
        calls=self.exercise(race='always',expected=75)
        self.assertEqual(calls.count('model-unlocked'),2)
        self.assertNotIn('commit-locked',calls)

    def test_invalid_proof_does_not_trigger_a_new_model_call_or_publication(self):
        calls=self.exercise(race='invalid',expected=2)
        self.assertEqual(calls.count('model-unlocked'),1)
        self.assertNotIn('commit-locked',calls)

    def exercise(self,race=False,qa=False,expected=0):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);scripts=root/'scripts';scripts.mkdir();batch=root/'batch.json'
            batch.write_text(json.dumps([dict(id='one',slug='one')]))
            stub='''from pathlib import Path
import os,sys,fcntl,json
root=Path(os.environ['QUEUE_TEST_ROOT']);name=Path(__file__).name
def locked():
 with (root/'publication.lock').open('a') as handle:
  try:fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB);return False
  except BlockingIOError:return True
def record(value):
 with (root/'calls').open('a') as log:log.write(value+'\\n')
if name=='news_context_review.py':
 if '--verify' in sys.argv:
  assert locked(),'history check must be locked';record('history-locked')
  if os.environ.get('QUEUE_TEST_RACE')=='invalid':raise SystemExit(2)
  if os.environ.get('QUEUE_TEST_RACE')=='always':raise SystemExit(75)
  if os.environ.get('QUEUE_TEST_RACE')=='1' and not (root/'raced').exists():
   (root/'raced').touch();raise SystemExit(75)
 else:
  assert not locked(),'model review held the publication lock';record('model-unlocked')
elif name=='news_copyright_review.py':record('copyright-verify')
elif name=='validate_source_mix.py':record('source-mix')
elif 'publish-supabase' in sys.argv:
 assert locked(),'commit must be locked';record('commit-locked')
else:record('validate')
'''
            for name in ('news_context_review.py','news_copyright_review.py','validate_source_mix.py','codex_automation_support.py'):
                (scripts/name).write_text(stub)
            env=dict(os.environ,L383_PYTHON_BIN=sys.executable,QUEUE_TEST_ROOT=str(root),
                QUEUE_TEST_RACE='1' if race is True else str(race),L383_PUBLICATION_DEADLINE_EPOCH=str(int(time.time())+30))
            result=subprocess.run(['bash',str(Path(__file__).with_name('publish-reviewed-news.sh')),str(batch),str(root),'1' if qa else '0',str(root/'publication.lock')],env=env,capture_output=True,text=True,timeout=20)
            self.assertEqual(result.returncode,expected,result.stdout+result.stderr)
            return (root/'calls').read_text().splitlines()
