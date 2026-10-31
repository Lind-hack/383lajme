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
    def test_quota_exit_records_zero_outcome_and_only_one_allowed_completion_email(self):
        helper=RUNNER[RUNNER.index('fail_run() {'):RUNNER.index('on_error() {')]
        for qa in (0,1):
            with tempfile.TemporaryDirectory() as folder:
                events=Path(folder)/'events.txt'
                script='''
set -e
quota_hit() { return 0; }
record_state() { printf 'state %s\\n' "$1" >> "$TEST_EVENTS"; }
fake_python() { if [ "$2" = check ]; then return 1; fi; printf '%s\\n' "$*" >> "$TEST_EVENTS"; }
PYTHON_BIN=fake_python
BATCH=/qa/batch.json
STATE=/qa/state.json
IN_EXTRA_REVIEW=0
''' + f'QA_ONLY={qa}\n' + helper + '\nfail_run "known account exhaustion"\n'
                result=subprocess.run([BASH,'-c',script],capture_output=True,text=True,timeout=10,
                                      env={**os.environ,'TEST_EVENTS':events.as_posix()})
                self.assertEqual(result.returncode,0,result.stderr)
                lines=events.read_text(encoding='utf-8').splitlines()
                self.assertEqual(lines[0],'state no_news')
                self.assertTrue(any('--status model_quota' in line for line in lines))
                emails=[line for line in lines if 'send-status-report' in line]
                self.assertEqual(len(emails),0 if qa else 1)
                self.assertTrue(all('--phase completed' in line for line in emails))

    def test_quota_flag_cannot_reclassify_an_already_published_slot_as_zero_news(self):
        helper=RUNNER[RUNNER.index('fail_run() {'):RUNNER.index('on_error() {')]
        script='''
quota_hit() { return 0; }
record_state() { printf 'state %s\\n' "$1"; }
alert_failure() { :; }
fake_python() { if [ "$2" = check ]; then return 0; fi; printf 'unexpected zero-publication path'; }
PYTHON_BIN=fake_python
BATCH=/qa/batch.json
STATE=/qa/state.json
STAMP=slot
IN_EXTRA_REVIEW=0
QA_ONLY=0
''' + helper + '\nfail_run "post-publication readback failure"\n'
        result=self.invoke(script)
        self.assertEqual(result.returncode,75,result.stderr)
        self.assertNotIn('state no_news',result.stdout)
        self.assertNotIn('unexpected zero-publication path',result.stdout)

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

    def test_late_first_review_can_start_fresh_replacements_at_minute_forty_two(self):
        self.exercise_recovery(2520)

    def test_late_first_review_can_start_fresh_replacements_at_minute_forty_three(self):
        self.exercise_recovery(2580)

    def test_no_new_optional_writer_starts_at_minute_forty_four(self):
        self.exercise_recovery(2640)

    def exercise_recovery(self, elapsed):
        start = RUNNER.index("track_attempted\nreview_candidates\n")
        core = RUNNER[start:RUNNER.index('stage="final-deduplication"', start)]
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
run_fresh_replacement_writers() { printf 'fresh\\n' >> "$TEST_EVENTS"; return 75; }
model_budget() { test "$1" -le 180 && test "$2" -eq 2700 || return 1; printf 100; }
on_error() { :; }
mktemp() {
 if [ "$1" = "-d" ]; then command mktemp -d "$TEST_TEMP/${2##*/}";
 else command mktemp "$TEST_TEMP/${1##*/}"; fi
}
timeout() {
 case " $* " in
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
                             (["fresh"] if elapsed < 2640 else []) + (["rewrite"] if elapsed < 2520 else []))
            self.assertEqual(json.loads(batch.read_text(encoding="utf-8")), approved)

    def test_writer_snapshot_preserves_exact_copy_and_evidence_outside_publication_data(self):
        start = RUNNER.index("review_candidates() {")
        helper = RUNNER[start:RUNNER.index('stage="albanian-editor"', start)] + "\n}\n"
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

    def test_missing_desk_recovery_retains_initial_copy_and_only_requests_the_floor_deficit(self):
        self.exercise_missing_desks(1500, False)

    def test_missing_desk_recovery_does_not_start_at_minute_thirty_six(self):
        self.exercise_missing_desks(2160, False)

    def test_missing_desk_recovery_never_starts_more_than_three_account_calls(self):
        self.exercise_missing_desks(1500, True)

    def exercise_missing_desks(self, elapsed, empty):
        from news_source_policy import CATEGORIES
        start = RUNNER.index('recover_missing_writer_desks() {')
        helper = RUNNER[start:RUNNER.index('run_writer_groups() {', start)]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / 'groups'; folder.mkdir()
            # Use registry ownership rather than assuming dictionary order.
            from news_source_policy import MANIFEST
            hosts = {category: next(p['domains'][0] for p in MANIFEST['publishers'] if p['category'] == category) for category in CATEGORIES}
            plan = {category: 2 if empty or category in ('Kosovë','Shqipëri','Sport','Botë') else 0 for category in CATEGORIES}
            prior = [] if empty else [
                {'slug': 'world-'+str(i), 'url': f'https://{hosts["Botë"]}/prior-{i}', 'category': 'Botë', 'body': 'Exact existing copy'} for i in range(2)] + [
                {'slug': 'sport', 'url': f'https://{hosts["Sport"]}/prior', 'category': 'Sport', 'body': 'Exact existing copy'}]
            batch = root / 'batch.json'; batch.write_text(json.dumps(prior), encoding='utf-8')
            (folder / '1.json').write_text(json.dumps(prior), encoding='utf-8')
            discovery = root / 'discovery.json'
            ready=[]
            for category in CATEGORIES:
                for i in range(3):
                    url=f'https://{hosts[category]}/fresh-{i}'
                    evidence=root/f'{category}-{i}.evidence.json'
                    evidence.write_text(json.dumps({'source_url':url,'evidence':{
                        'url':url,'status':'text_extracted','text':
                        'The council approved three routes on Monday. Residents can apply next week. '
                        'The timetable lists 20 vehicles. The decision starts on Tuesday.'}}),encoding='utf-8')
                    ready.append({'pair_id':category+str(i),'category':category,'url':url,'evidence_path':str(evidence)})
            discovery.write_text(json.dumps({'publication_plan': plan, 'ready_leads': [
                lead for lead in ready]}), encoding='utf-8')
            script = helper + '''
set -e
model_budget() { test "$1" -eq 180 && test "$2" -eq 2160 || return 1; if [ "$TEST_ELAPSED" -ge 2160 ]; then return 75; fi; printf 180; }
run_writer() {
 test "$WRITER_PHASE_END" -eq 2160 && test "$L383_WRITER_ATTEMPT_TIMEOUT" -eq 180
 "$PYTHON_BIN" - "$WRITER_BRIEF" "$WRITER_BATCH" "$L383_TARGET_ARTICLES" "$TEST_EVENTS" <<'PY'
import json,re,sys
from pathlib import Path
brief=Path(sys.argv[1]).read_text(encoding='utf-8')
category=re.search(r'^category: (.+)$',brief,re.M).group(1)
urls=re.findall(r'^url: (.+)$',brief,re.M)
needed=int(sys.argv[3]);assert len(urls)==needed and needed<=2
with open(sys.argv[4],'a',encoding='utf-8') as out:out.write(category+'\\t'+str(needed)+'\\n')
Path(sys.argv[2]).write_text(json.dumps([{'slug':category+str(i),'url':url,'category':category,'body':'Recovered draft'} for i,url in enumerate(urls)]),encoding='utf-8')
PY
}
recover_missing_writer_desks "$TEST_FOLDER"
"$PYTHON_BIN" scripts/news_refill.py groups "$TEST_FOLDER" "$BATCH" || true
'''
            events = root / 'events.txt'
            result = subprocess.run([BASH,'-c',script],cwd=Path(__file__).resolve().parent.parent,
                capture_output=True,text=True,timeout=15,env={**os.environ,'PYTHON_BIN':sys.executable,
                'DISCOVERY':discovery.with_suffix('.md').as_posix(),'BATCH':batch.as_posix(),
                'ATTEMPTED':(root/'attempted.json').as_posix(),
                'TEST_FOLDER':folder.as_posix(),'TEST_EVENTS':events.as_posix(),'TEST_ELAPSED':str(elapsed),
                'PRIMARY_WRITER_MODEL':'gpt-6-luna','PYTHONIOENCODING':'utf-8'})
            self.assertEqual(result.returncode,0,result.stderr+result.stdout)
            rows=json.loads(batch.read_text(encoding='utf-8'))
            self.assertEqual(rows[:len(prior)],prior)
            requested=dict(line.split('\t') for line in events.read_text(encoding='utf-8').splitlines()) if events.exists() else {}
            if elapsed>=2160:
                self.assertEqual(requested,{})
                self.assertEqual(rows,prior)
            elif empty:
                self.assertEqual(len(requested),3,result.stdout+result.stderr)
                self.assertEqual(len(rows),6)
            else:
                self.assertEqual(requested,{'Kosovë':'2','Shqipëri':'2','Sport':'1'},result.stdout+result.stderr)
                self.assertEqual(len(rows),8)

    def test_fresh_refill_has_three_minutes_after_a_minute_forty_one_review(self):
        helper = RUNNER[RUNNER.index("model_budget() {"):RUNNER.index("track_attempted() {")]
        command = next(line.strip() for line in RUNNER.splitlines() if line.strip().startswith('writer_budget="$(model_budget'))
        result = self.invoke(helper + '\nL383_WRITER_ATTEMPT_TIMEOUT=180; WRITER_PHASE_END=2700; START_EPOCH=1000; date() { printf 3472; }; ' + command + '\nprintf "%s" "$writer_budget"')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "180")

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
