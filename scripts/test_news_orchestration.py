"""Exercise isolated shell helpers; never launch the production pipeline."""
import os
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

RUNNER = Path(__file__).with_name("run-hourly-news.sh").read_text(encoding="utf-8")
GIT_BASH = Path("C:/Program Files/Git/bin/bash.exe")
BASH = str(GIT_BASH) if GIT_BASH.exists() else shutil.which("bash")


@unittest.skipUnless(BASH, "bash is required for shell control-flow regressions")
class NewsOrchestrationTests(unittest.TestCase):
    def invoke(self, script):
        return subprocess.run([BASH, "-c", script], capture_output=True, text=True, timeout=10)

    def test_extra_editor_can_run_at_minute_forty_four_while_initial_editor_cannot(self):
        budget = RUNNER[RUNNER.index("model_budget() {"):RUNNER.index("track_attempted() {")]
        start = RUNNER.index("review_candidates() {")
        header = RUNNER[start:RUNNER.index('stage="normalize"', start)]
        script = budget + '\n' + header + 'model_budget 900 "$editorial_phase_end"\n}\n' + '''
START_EPOCH=1000
date() { printf 3640; }
IN_EXTRA_REVIEW=1
review_candidates
unset IN_EXTRA_REVIEW
if review_candidates; then exit 1; fi
'''
        result = self.invoke(script)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), ["240"])

    def test_preparation_model_deadline_reserves_writer_time_without_shortening_later_review(self):
        start = RUNNER.index('env L383_MODEL_DEADLINE_EPOCH="$((START_EPOCH + 1200))"')
        end = RUNNER.index('--discovery', start) + len('--discovery')
        command = RUNNER[start:end]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "scripts").mkdir()
            (root / "scripts/prepare_editor_sources.py").write_text(
                'import os; print(os.environ["L383_MODEL_DEADLINE_EPOCH"])', encoding="utf-8")
            script = 'START_EPOCH=1000\nexport L383_MODEL_DEADLINE_EPOCH=4000\n' + command + '\nprintf "%s\\n" "$L383_MODEL_DEADLINE_EPOCH"\n'
            result = subprocess.run([BASH, "-c", script], cwd=root, capture_output=True, text=True, timeout=10,
                                    env={**os.environ, "PYTHON_BIN": sys.executable, "DISCOVERY": "unused.md"})
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.splitlines(), ["2200", "4000"])

    def test_fresh_candidates_are_attempted_before_rewrites_and_failures_preserve_approved_copy(self):
        self.exercise_recovery(1000)

    def test_late_first_review_can_still_start_a_bounded_replacement_at_minute_forty(self):
        self.exercise_recovery(2400)

    def test_no_new_optional_writer_starts_at_minute_forty_two(self):
        self.exercise_recovery(2520)

    def exercise_recovery(self, elapsed):
        start = RUNNER.index("track_attempted\nreview_candidates\n")
        core = RUNNER[start:RUNNER.index('stage="independent-originality-review"', start)]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            batch, discovery, attempted, rejected = [root / name for name in ("batch.json", "discovery.json", "attempted.json", "rejected.json")]
            approved = [{"url": "https://skysports.com/approved", "category": "Sport", "body": "Exact approved copy"}]
            batch.write_text(json.dumps(approved), encoding="utf-8")
            discovery.write_text(json.dumps({"publication_plan": {"Sport": 1, "Teknologji": 2},
                "ready_leads": [{"url": "https://techcrunch.com/fresh", "category": "Teknologji", "pair_id": "tech", "evidence_path": "/verified/evidence.json"}]}), encoding="utf-8")
            attempted.write_text(json.dumps([approved[0]["url"]]), encoding="utf-8")
            rejected.write_text(json.dumps([{"url": "https://techcrunch.com/rejected", "slug": "rejected", "category": "Teknologji"}]), encoding="utf-8")
            script = '''
set -e
START_EPOCH=1000
FULL_TARGET=20
PRIMARY_WRITER_MODEL=gpt-6-luna
STAMP=2026-10-23T07
date() { printf "$TEST_NOW"; }
track_attempted() { :; }
review_candidates() { :; }
model_budget() { test "$1" -le 180 && test "$2" -eq 2700 || return 1; printf 100; }
on_error() { :; }
mktemp() {
 if [ "$1" = "-d" ]; then command mktemp -d "$TEST_TEMP/${2##*/}";
 else command mktemp "$TEST_TEMP/${1##*/}"; fi
}
timeout() {
 case " $* " in
  *"--mode append"*) printf 'fresh\\n' >> "$TEST_EVENTS";;
  *"--mode replace"*) printf 'rewrite\\n' >> "$TEST_EVENTS";;
 esac
 return 1
}
''' + core
            events = root / "events.txt"
            exercise = root / "exercise.sh"
            exercise.write_text(script, encoding="utf-8", newline="\n")
            result = subprocess.run([BASH, exercise.as_posix()], cwd=Path(__file__).resolve().parent.parent,
                                    capture_output=True, text=True, timeout=10, env={**os.environ,
                                    "PYTHON_BIN": sys.executable, "BATCH": batch.as_posix(),
                                    "DISCOVERY": discovery.with_suffix(".md").as_posix(), "ATTEMPTED": attempted.as_posix(),
                                    "L383_REVIEW_REJECTED": rejected.as_posix(), "WRITER_BRIEF": (root / "brief.md").as_posix(),
                                    "TEST_EVENTS": events.as_posix(), "TEST_TEMP": root.as_posix(), "TEST_NOW": str(1000 + elapsed)})
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            self.assertEqual(events.read_text(encoding="utf-8").splitlines() if events.exists() else [],
                             ["fresh", "rewrite"] if elapsed < 2520 else [])
            self.assertEqual(json.loads(batch.read_text(encoding="utf-8")), approved)

    def test_writer_snapshot_preserves_exact_copy_and_evidence_outside_publication_data(self):
        start = RUNNER.index("review_candidates() {")
        helper = RUNNER[start:RUNNER.index('EDITOR_CHECK=', start)] + "\n}\n"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            batch = root / "batch.json"
            evidence = batch.with_suffix(".editor-sources.json")
            articles = [{"slug": "verified", "body": "Original writer prose"}]
            records = [{"slug": "verified", "evidence": {"text": "Exact fetched original"}}]
            batch.write_text(json.dumps(articles), encoding="utf-8")
            evidence.write_text(json.dumps(records), encoding="utf-8")
            script = helper + '''
PYTHON_BIN=fake_python
fake_python() { if [ "$1" = "-" ]; then "$REAL_PYTHON" "$@"; fi; }
review_candidates
'''
            result = subprocess.run([BASH, "-c", script], capture_output=True, text=True, timeout=10,
                                    env={**os.environ, "REAL_PYTHON": sys.executable, "BATCH": batch.as_posix(),
                                         "STATE_ROOT": (root / "private-state").as_posix(),
                                         "STAMP": "2026-10-23T07", "QA_ONLY": "1"})
            self.assertEqual(result.returncode, 0, result.stderr)
            snapshot = root / "private-state/2026-10-23T07-mode1-writer-snapshot.json"
            self.assertEqual(json.loads(snapshot.read_text(encoding="utf-8")), {"articles": articles, "evidence": records})
            self.assertEqual(json.loads(batch.read_text(encoding="utf-8")), articles)

    def test_call_budget_cannot_exceed_phase_remaining_time(self):
        helper = RUNNER[RUNNER.index("model_budget() {"):RUNNER.index("track_attempted() {")]
        result = self.invoke(helper + '\nSTART_EPOCH=1000; date() { printf 2400; }; model_budget 600 1500')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "100")
        result = self.invoke(helper + '\nSTART_EPOCH=1000; date() { printf 2500; }; model_budget 600 1500')
        self.assertEqual(result.returncode, 75, result.stderr)

    def test_expired_editor_budget_keeps_the_outer_failure_guards(self):
        start = RUNNER.index("review_candidates() {")
        end = RUNNER.index('timeout --signal=TERM --kill-after=15s "$((editor_budget + 5))s"', start)
        helper = RUNNER[start:end] + "\n}\n"
        script = helper + '''
set -e
trap 'printf OUTER_ERROR' ERR
BATCH=$(mktemp)
printf '[]' > "$BATCH"
PYTHON_BIN=fake_python
fake_python() { :; }
model_budget() { return 75; }
review_candidates
[[ $- == *e* ]]
trap -p ERR
rm -f "$BATCH"
'''
        result = self.invoke(script)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("OUTER_ERROR", result.stdout)

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
