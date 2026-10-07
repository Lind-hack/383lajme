import os
import unittest
from unittest.mock import patch
import codex_automation_support as support


class StartupReportTests(unittest.TestCase):
    def test_started_and_empty_completion_use_existing_template_and_exact_slot(self):
        with patch.object(support, "load_env"), patch.dict(os.environ, {"RESEND_API_KEY": "test", "EMAIL_PRIMARY": "resend", "CRON_SLOT_LABEL": "2026-10-07 23:00 CEST"}), patch.object(support, "_send_resend_report", return_value=0) as sender:
            self.assertEqual(support.send_status_report("Running Sol low", phase="started"), 0)
            args = sender.call_args.args
            self.assertIn("u nis", args[2])
            self.assertIn("23:00 CEST", args[2])
            self.assertIn("background:#0f172a", args[3])
            self.assertIn("Running Sol low", args[3])
            self.assertEqual(support.send_status_report("No fresh news", phase="completed"), 0)
            self.assertIn("përfundoi", sender.call_args.args[2])


if __name__ == "__main__":
    unittest.main()
