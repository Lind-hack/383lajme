"""World's data-only editor keeps complete evidence within a focused request."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


@unittest.skipUnless(os.name == 'posix', 'Production editor shell runs on Linux')
class WorldTextContextTests(unittest.TestCase):
    def test_world_editor_completes_with_full_sources_under_bounded_text_capacity(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); batch = root / '2026-11-05T01.json'; capture = root / 'request.txt'
            article = dict(id='test', slug='test', url='https://www.bbc.com/news/test', category='Botë',
                           title='BE miraton një procedurë të re kufitare', excerpt='Procedura nis muajin tjetër.',
                           body='<p>BE miratoi një procedurë të re kufitare. Rregulli nis muajin tjetër.</p>')
            batch.write_text(json.dumps([article]), encoding='utf-8')
            source = ' '.join(f'FACT_{n:03d} Complete factual evidence about the approved border procedure.' for n in range(30)) + ' SOURCE_END_VISIBLE'
            records = [dict(slug='test', source_url=article['url'], evidence=dict(status='text_extracted', text=source), corroborating=[])]
            batch.with_suffix('.editor-sources.json').write_text(json.dumps(records), encoding='utf-8')
            from news_model_evidence import write_readable_evidence
            write_readable_evidence(batch.with_suffix('.editor-sources.md'), records)
            # Replace only the external model boundary, never source preparation,
            # decision application, immutable identity or completion verification.
            (root / 'sitecustomize.py').write_text('''import os,json,subprocess
from pathlib import Path
import news_model
def call(command,timeout,**kwargs):
    prompt=command[-1]
    Path(os.environ['TEST_REQUEST']).write_text(prompt,encoding='utf-8')
    if len(prompt.encode('utf-8'))>30000:raise subprocess.TimeoutExpired(command,timeout)
    checks=dict.fromkeys(('facts','attribution','originality','photo_fit','language'),True)
    rows=[dict(url='https://www.bbc.com/news/test',action='keep',checks=checks)]
    return subprocess.CompletedProcess(command,0,'383_JSON_BEGIN '+json.dumps(rows)+' 383_JSON_END','')
news_model.run_process=call
''', encoding='utf-8')
            env = dict(os.environ, L383_RUN_DESK='bote', L383_PYTHON_BIN=sys.executable,
                       PYTHONPATH=os.pathsep.join((str(root), str(repo / 'scripts'))), TEST_REQUEST=str(capture))
            result = subprocess.run(['bash', str(repo / 'scripts/run-news-editor.sh'), 'gpt-6-luna', str(batch), str(repo), '30'],
                                    env=env, capture_output=True, text=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(json.loads(batch.read_text()), [article])
            from editor_completion import verify
            verify(batch)
            prompt = capture.read_text(encoding='utf-8')
            self.assertIn('SOURCE_END_VISIBLE', prompt)
            for n in range(30): self.assertIn(f'FACT_{n:03d}', prompt)
            self.assertIn(article['url'], prompt)


if __name__ == '__main__':
    unittest.main()
