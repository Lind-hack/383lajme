"""Exercise the real failure handlers; no model, email or database requests."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNNER = (ROOT/'scripts/run-hourly-news.sh').read_text(encoding='utf-8')


@unittest.skipUnless(os.name != 'nt' and shutil.which('bash'), 'native worker shell required')
class QuotaErrorRoutingTests(unittest.TestCase):
    def run_handler(self, quota, *, extra=False, published=False):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)/'state.json'
            state.write_text(json.dumps({'status': 'complete' if published else 'running'}))
            functions = RUNNER[RUNNER.index('fail_run() {'):RUNNER.index('exec 9>')]
            script = '''
quota_hit() { [ "$TEST_QUOTA" = 1 ]; }
fake_python() {
  if [ "$1" = scripts/news_run_state.py ]; then
    "$TEST_PYTHON" "$TEST_ROOT/scripts/news_run_state.py" "${@:2}"
  else
    printf 'helper=%s\\n' "$*"
  fi
}
record_state() { fake_python scripts/news_run_state.py save "$STATE" --status "$1" --stage "$stage" --batch "$BATCH"; }
alert_failure() { printf 'failure=%s\\n' "$1"; }
PYTHON_BIN=fake_python
stage=writer-source-fetch
alerting=0
QA_ONLY=0
''' + functions + '\nfalse\non_error\n'
            result = subprocess.run(['bash', '-c', script], capture_output=True, text=True, timeout=10,
                env={**os.environ, 'STATE': str(state), 'BATCH': str(Path(folder)/'batch.json'),
                     'TEST_QUOTA': str(int(quota)), 'IN_EXTRA_REVIEW': str(int(extra)),
                     'TEST_PYTHON': sys.executable, 'TEST_ROOT': str(ROOT)})
            return result, json.loads(state.read_text())

    def test_bare_model_quota_error_uses_existing_completion_path(self):
        result, state = self.run_handler(True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((state['status'], state['stage']), ('no_news', 'model-quota'))
        self.assertIn('--status model_quota', result.stdout)
        self.assertIn('send-status-report --phase completed', result.stdout)
        self.assertNotIn('failure=', result.stdout)

    def test_other_errors_and_extra_review_keep_their_failure_semantics(self):
        for quota, extra in ((False, False), (True, True)):
            result, state = self.run_handler(quota, extra=extra)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertEqual(state['status'], 'failed')
            self.assertNotIn('send-status-report', result.stdout)

    def test_quota_never_relabels_an_already_published_batch_as_no_news(self):
        result, state = self.run_handler(True, published=True)
        self.assertEqual(result.returncode, 75, result.stderr)
        self.assertEqual(state['status'], 'published')
        self.assertNotIn('model_quota', result.stdout)
        self.assertNotIn('send-status-report', result.stdout)


if __name__ == '__main__':
    unittest.main()
