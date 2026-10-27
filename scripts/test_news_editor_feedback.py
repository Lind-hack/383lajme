"""Exercise the real shell prompt expansion without an OAuth/model request."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent

@unittest.skipUnless(os.name!='nt' and shutil.which('bash'),'native worker shell required')
class EditorFeedbackTests(unittest.TestCase):
    def test_single_article_repair_chunks_receive_only_their_own_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            scripts=root/'scripts'; scripts.mkdir()
            shutil.copy2(ROOT/'news_model_evidence.py', scripts/'news_model_evidence.py')
            # Exercise the actual parallel coordinator with a deterministic
            # editor in place of OAuth, asserting every request is one story.
            (scripts/'run-news-editor.sh').write_text(
                '#!/usr/bin/env bash\nset -e\n"$L383_PYTHON_BIN" - "$2" <<\'PY\'\n'
                'import json,sys\nfrom pathlib import Path\np=Path(sys.argv[1])\n'
                'a=json.loads(p.read_text()); assert len(a)==1\n'
                'e=json.loads(p.with_suffix(".editor-sources.json").read_text())\n'
                'assert [r["slug"] for r in e]==[a[0]["slug"]]\n'
                'a[0]["body"]="Repaired "+a[0]["slug"]\np.write_text(json.dumps(a))\nPY\n')
            (scripts/'editor_completion.py').write_text('print("test receipt acknowledged")\n')
            batch=root/'repair.json'
            articles=[{'slug':key,'url':'https://example.com/'+key,'body':'Needs repair'} for key in ('one','two')]
            batch.write_text(json.dumps(articles))
            batch.with_suffix('.editor-sources.json').write_text(json.dumps([
                {'slug':a['slug'],'source_url':a['url'],'evidence':{'text':'source '+a['slug']}} for a in articles]))
            result=subprocess.run(['bash',str(ROOT/'run-news-editor-parallel.sh'),'gpt-6-luna',str(batch),str(root)],
                env={**os.environ,'L383_PYTHON_BIN':sys.executable,'L383_EDITOR_CHUNK':'1'},
                capture_output=True,text=True,timeout=15)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            self.assertEqual([a['body'] for a in json.loads(batch.read_text())],['Repaired one','Repaired two'])

    def test_known_originality_defects_are_supplied_in_the_initial_editor_request(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            scripts=root/'scripts'
            scripts.mkdir()
            shutil.copy2(ROOT/'news_model_evidence.py',scripts/'news_model_evidence.py')
            (scripts/'news_model_response.py').write_text(
                'import os,sys\nfrom pathlib import Path\n'
                'Path(os.environ["CAPTURE_PROMPT"]).write_text(sys.argv[-1])\nraise SystemExit(75)\n')
            batch=root/'batch.json'
            batch.write_text(json.dumps([{'slug':'example','url':'https://example.com/story','body':'Public facts'}]))
            captured=root/'prompt.txt'
            diagnostic='candidate Example: exact source overlap of eight words; preserve verified facts'
            result=subprocess.run(['bash',str(ROOT/'run-news-editor.sh'),'gpt-6-luna',str(batch),str(root)],
                env={**os.environ,'L383_PYTHON_BIN':sys.executable,'CAPTURE_PROMPT':str(captured),
                     'L383_EDITOR_GATE_FEEDBACK':diagnostic},capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0) # Stub deliberately stops before editing.
            prompt=captured.read_text()
            self.assertIn(diagnostic,prompt)
            self.assertIn('ignore diagnostics for other chunks',prompt)
            self.assertIn('preserving unaffected text',prompt)

if __name__=='__main__':unittest.main()
