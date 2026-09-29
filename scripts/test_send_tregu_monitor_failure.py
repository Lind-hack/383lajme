import importlib.util
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


spec = importlib.util.spec_from_file_location('monitor_alert', Path(__file__).with_name('send-tregu-monitor-failure.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MonitorAlertTests(unittest.TestCase):
    def test_failure_mail_is_throttled_and_retries_after_interval(self):
        sent = []
        now = datetime(2026, 9, 30, 8, 0, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            options = {'state_dir': Path(directory), 'send': lambda *args: sent.append(args)}
            self.assertTrue(module.alert('383-tregu-research.service', now=now, **options))
            self.assertFalse(module.alert('383-tregu-research.service', now=now + timedelta(minutes=5), **options))
            self.assertTrue(module.alert('383-tregu-research.service', now=now + timedelta(minutes=31), **options))
        self.assertEqual(len(sent), 2)
        self.assertEqual(sent[0][0], 'lindsylqa@gmail.com')
        self.assertIn('journalctl -u 383-tregu-research.service', sent[0][2])

    def test_unknown_service_cannot_send_mail(self):
        with self.assertRaises(ValueError):
            module.alert('unrelated.service', send=lambda *args: self.fail('unexpected send'))

    def test_failed_smtp_does_not_suppress_retry(self):
        now = datetime(2026, 9, 30, 8, 0, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            def fail(*args): raise RuntimeError('SMTP unavailable')
            with self.assertRaisesRegex(RuntimeError, 'SMTP unavailable'):
                module.alert('383-tregu-reprice.service', now=now, state_dir=state, send=fail)
            self.assertTrue(module.alert('383-tregu-reprice.service', now=now,
                state_dir=state, send=lambda *args: None))


if __name__ == '__main__': unittest.main()
