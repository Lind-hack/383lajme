import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import news_model as model
import news_model_quota as quota


class ModelQuotaTests(unittest.TestCase):
    def test_explicit_account_exhaustion_prevents_later_processes_in_the_same_run(self):
        with tempfile.TemporaryDirectory() as folder:
            marker, output = Path(folder)/'slot.quota', Path(folder)/'must-not-exist'
            with patch.dict(os.environ, {'L383_MODEL_QUOTA_FILE':str(marker)}):
                first=model.run_process([sys.executable,'-c',"import sys;print('HTTP 429: The usage limit has been reached');sys.exit(1)"],5)
                self.assertNotEqual(first.returncode,0);self.assertTrue(quota.exhausted())
                with self.assertRaisesRegex(RuntimeError,'MODEL QUOTA'):quota.require_available()
                second=model.run_process([sys.executable,'-c',f"from pathlib import Path;Path({str(output)!r}).touch()"],5)
                self.assertEqual(second.returncode,75);self.assertFalse(output.exists())
            with patch.dict(os.environ, {'L383_MODEL_QUOTA_FILE':str(Path(folder)/'next-slot.quota')}):
                self.assertEqual(model.run_process([sys.executable,'-c','pass'],5).returncode,0)

    def test_transient_throttling_and_successful_source_text_do_not_latch(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'L383_MODEL_QUOTA_FILE':folder+'/quota'}):
            quota.observe_failure('', 'HTTP 429: Rate limit exceeded; retry after 2 seconds')
            self.assertFalse(quota.exhausted())
            quota.require_available()
            result=model.run_process([sys.executable,'-c',"print('HTTP 429: The usage limit has been reached')"],5)
            self.assertEqual(result.returncode,0);self.assertFalse(quota.exhausted())


if __name__=='__main__':unittest.main()
