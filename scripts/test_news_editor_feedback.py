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
