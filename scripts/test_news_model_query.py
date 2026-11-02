import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class QueryTransportTests(unittest.TestCase):
    def test_real_process_delivers_oversize_query_and_original_model_flags_to_cli_in_memory(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);package=root/'hermes_cli';package.mkdir()
            (package/'__init__.py').write_text('')
            (package/'main.py').write_text('''import sys
def main():
 assert sys.argv[1:-1]==['chat','--provider','openai-codex','--model','gpt-6-luna','-t','none','-q']
 assert sys.argv[-1].startswith('FULL_SOURCE_BEGIN') and sys.argv[-1].endswith('FULL_SOURCE_END')
 assert len(sys.argv[-1])>131072
 print('complete context received')
''')
            prompt=root/'query.txt';prompt.write_text('FULL_SOURCE_BEGIN'+'ë'*160000+'FULL_SOURCE_END',encoding='utf-8')
            result=subprocess.run([sys.executable,str(Path(__file__).with_name('news_model_query.py')),
                '--query-file',str(prompt),'--','chat','--provider','openai-codex','--model','gpt-6-luna',
                '-t','none','-q'],env={**os.environ,'PYTHONPATH':str(root)},capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIn('complete context received',result.stdout)


if __name__=='__main__':unittest.main()
