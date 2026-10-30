import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


@unittest.skipUnless(os.name != 'nt' and shutil.which('bash'),'native Linux shell coordination')
class IngestionWindowTests(unittest.TestCase):
    def test_source_warmup_window_leaves_publication_schedule_separate(self):
        original = Path(__file__).with_name('run-source-ingestion.sh')
        for clock, expected in [('0634',False),('0635',True),('0659',True),
                                ('0700',True),('2359',True),('0000',False)]:
            with self.subTest(clock=clock), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                runner = root/'runner.sh'
                runner.write_text(original.read_text(),encoding='utf-8',newline='\n')
                commands = {
                    'date':'#!/bin/sh\nprintf "%s\\n" "$FAKE_CLOCK"\n',
                    'timeout':'#!/bin/sh\nprintf "collector\\n" >> "$CALL_LOG"\n',
                    'sleep':'#!/bin/sh\n/bin/sleep .05\nkill -TERM "$PPID"\n',
                }
                for name, body in commands.items():
                    file = root/name
                    file.write_text(body)
                    file.chmod(0o700)
                log = root/'calls.txt'
                env = {**os.environ,'PATH':str(root)+os.pathsep+os.environ['PATH'],
                       'FAKE_CLOCK':clock,'CALL_LOG':str(log),'L383_SOURCE_STATE_ROOT':str(root/'state')}
                result = subprocess.run(['bash',str(runner)],env=env,capture_output=True,text=True,timeout=5)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertEqual(log.exists(),expected)


if __name__ == '__main__':
    unittest.main()
