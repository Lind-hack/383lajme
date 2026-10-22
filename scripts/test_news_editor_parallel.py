"""Run the real chunk orchestration with a local editor, without model calls."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from editor_completion import verify

ROOT = Path(__file__).resolve().parent


@unittest.skipUnless(os.name != "nt" and shutil.which("bash"), "native Linux worker shell required")
class ParallelEditorTests(unittest.TestCase):
    def exercise(self, fail_one=False):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            scripts = root / "scripts"
            scripts.mkdir()
            for name in ("news_model_evidence.py", "editor_completion.py"):
                shutil.copy2(ROOT / name, scripts / name)
            (scripts / "run-news-editor.sh").write_text(
                '#!/usr/bin/env bash\nexec "$L383_PYTHON_BIN" "$3/scripts/editor_stub.py" "$2"\n', encoding="utf-8")
            (scripts / "editor_stub.py").write_text('''import json, os, sys, time
from pathlib import Path
batch = Path(sys.argv[1])
rows = json.loads(batch.read_text())
assert 1 <= len(rows) <= 3
evidence = json.loads(batch.with_suffix('.editor-sources.json').read_text())
assert [x['slug'] for x in evidence] == [x['slug'] for x in rows]
started = Path(os.environ['EDITOR_TEST_STARTED'])
(started / rows[0]['slug']).touch()
deadline = time.monotonic() + 5
while len(list(started.iterdir())) < 5 and time.monotonic() < deadline:
 time.sleep(.01)
assert len(list(started.iterdir())) == 5, 'expected five simultaneous editor calls'
if os.environ['EDITOR_TEST_FAIL'] == '1' and rows[0]['slug'] == 's06':
 raise SystemExit(1)
for row in rows: row['checked'] = True
batch.write_text(json.dumps(rows))
''', encoding="utf-8")
            started = root / "started"
            started.mkdir()
            batch = root / "batch.json"
            rows = [{"slug": f"s{index:02d}", "url": f"https://example.com/{index}"} for index in range(15)]
            batch.write_text(json.dumps(rows), encoding="utf-8")
            batch.with_suffix(".editor-sources.json").write_text(json.dumps(rows), encoding="utf-8")
            env = {**os.environ, "L383_PYTHON_BIN": sys.executable,
                   "EDITOR_TEST_STARTED": str(started), "EDITOR_TEST_FAIL": "1" if fail_one else "0"}
            env.pop("L383_EDITOR_CHUNK", None)
            result = subprocess.run(["bash", str(ROOT / "run-news-editor-parallel.sh"), "gpt-6-luna", str(batch), str(root)],
                                    env=env, capture_output=True, text=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            saved = json.loads(batch.read_text(encoding="utf-8"))
            self.assertTrue(all(row.get("checked") for row in saved))
            self.assertEqual([row["slug"] for row in saved],
                             [row["slug"] for row in rows if not fail_one or row["slug"] not in {"s06", "s07", "s08"}])
            verify(batch)

    def test_every_draft_and_its_own_evidence_reaches_one_of_five_editors(self):
        self.exercise()

    def test_failed_chunk_is_excluded_without_losing_other_checked_drafts(self):
        self.exercise(fail_one=True)


if __name__ == "__main__":
    unittest.main()
