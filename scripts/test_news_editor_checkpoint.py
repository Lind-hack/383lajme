import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from editor_completion import acknowledge, verify, receipt_path
from news_editor_checkpoint import checkpoint, pending_path
from news_editor_decisions import editor_batches


class EditorCheckpointTests(unittest.TestCase):
    def test_only_completed_unchanged_scopes_survive_and_pending_copy_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rows = [dict(url=f'https://example.com/{n}', slug=f'slug-{n}', category='Ekonomi',
                         title=f'Draft {n}', body='Full original draft') for n in range(4)]
            batch = root/'batch.json'
            work = root/'work'; work.mkdir()
            (work/'input.json').write_text(json.dumps(rows))
            for n, row in enumerate(rows):
                folder = work/f'chunk-{n:02d}'; folder.mkdir()
                (folder/'input.json').write_text(json.dumps([row]))
                path = folder/batch.name
                path.write_text(json.dumps([row]))
                if n != 1: acknowledge(path)
                if n == 2: path.write_text(json.dumps([{**row, 'body':'Edited after receipt'}]))
                if n == 3:
                    path.write_text(json.dumps([{**row, 'category':'Botë'}])); acknowledge(path)
            self.assertEqual(checkpoint(batch,work),1)
            verify(batch)
            self.assertEqual(json.loads(batch.read_text()), rows[:1])
            self.assertEqual(json.loads(pending_path(batch).read_text()), rows[1:])
            self.assertNotIn(pending_path(batch),list(batch.parent.glob('*.json')))
            # A later checkpoint adds newly completed work without losing the first.
            acknowledge(work/'chunk-01'/batch.name)
            self.assertEqual(checkpoint(batch,work),2)
            self.assertEqual(json.loads(batch.read_text()), rows[:2])

    def test_economy_briefs_share_calls_without_mixing_desks_or_losing_order(self):
        rows=[{'category':c,'url':str(n)} for n,c in enumerate(['Ekonomi']*5+['Showbiz']*2+['Botë']*3)]
        groups=editor_batches(rows)
        self.assertEqual([a for group in groups for a in group],rows)
        self.assertEqual([len(g) for g in groups],[2,2,1,1,1,3])

    @unittest.skipUnless(os.name=='posix' and shutil.which('timeout'), 'Linux worker signal integration')
    def test_real_stage_timeout_preserves_verified_sibling_and_never_approves_sleeper(self):
        source=Path(__file__).resolve().parent
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); scripts=root/'scripts'; scripts.mkdir()
            for name in ('news_editor_decisions.py','news_model_evidence.py','editor_completion.py','news_editor_checkpoint.py'):
                shutil.copyfile(source/name,scripts/name)
            # The first independent call finishes. A sibling exceeds the enclosing
            # deadline, reproducing the failed hourly run without any model calls.
            (scripts/'run-news-editor.sh').write_text('''#!/usr/bin/env bash
set -eu
if [[ "$2" == *chunk-00* ]]; then
  "$L383_PYTHON_BIN" "$3/scripts/editor_completion.py" acknowledge "$2"
else
  sleep 30
fi
''')
            rows=[dict(url=f'https://example.com/{n}',slug=f'slug-{n}',category='Showbiz',body='Evidence checked') for n in range(2)]
            batch=root/'batch.json'; batch.write_text(json.dumps(rows))
            batch.with_suffix('.editor-sources.json').write_text(json.dumps(rows))
            env={**os.environ,'L383_PYTHON_BIN':sys.executable}
            result=subprocess.run(['timeout','--kill-after=5s','2s','bash',str(source/'run-news-editor-parallel.sh'),
                                   'gpt-6-luna',str(batch),str(root)],env=env,capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,124,result.stdout+result.stderr)
            verify(batch)
            self.assertEqual(json.loads(batch.read_text()),rows[:1])
            self.assertEqual(json.loads(pending_path(batch).read_text()),rows[1:])


if __name__=='__main__': unittest.main()
