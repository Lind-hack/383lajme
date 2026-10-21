"""Exercise isolated shell helpers; never launch the production pipeline."""
import os
import shutil
import subprocess
import unittest
from pathlib import Path

RUNNER = Path(__file__).with_name("run-hourly-news.sh").read_text(encoding="utf-8")
GIT_BASH = Path("C:/Program Files/Git/bin/bash.exe")
BASH = str(GIT_BASH) if GIT_BASH.exists() else shutil.which("bash")


@unittest.skipUnless(BASH, "bash is required for shell control-flow regressions")
class NewsOrchestrationTests(unittest.TestCase):
    def invoke(self, script):
        return subprocess.run([BASH, "-c", script], capture_output=True, text=True, timeout=10)

    def test_call_budget_cannot_exceed_phase_remaining_time(self):
        helper = RUNNER[RUNNER.index("model_budget() {"):RUNNER.index("track_attempted() {")]
        result = self.invoke(helper + '\nSTART_EPOCH=1000; date() { printf 2400; }; model_budget 600 1500')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "100")
        result = self.invoke(helper + '\nSTART_EPOCH=1000; date() { printf 2500; }; model_budget 600 1500')
        self.assertEqual(result.returncode, 75, result.stderr)

    def test_empty_merge_fetches_evidence_without_claiming_editor_completion(self):
        helper = RUNNER[RUNNER.index("refresh_merged_evidence() {"):RUNNER.index("run_writer() {")]
        base = helper + '''
PYTHON_BIN=fake_python
BATCH=/tmp/batch.json
fake_python() { printf '%s\\n' "$*"; }
batch_count() { printf COUNT; }
refresh_merged_evidence
'''
        empty = self.invoke(base.replace("COUNT", "0"))
        self.assertEqual(empty.returncode, 0, empty.stderr)
        self.assertIn("prepare_editor_sources.py", empty.stdout)
        self.assertNotIn(" acknowledge ", empty.stdout)
        retained = self.invoke(base.replace("COUNT", "2"))
        self.assertEqual(retained.returncode, 0, retained.stderr)
        self.assertIn("editor_completion.py acknowledge", retained.stdout)


if __name__ == "__main__":
    unittest.main()
