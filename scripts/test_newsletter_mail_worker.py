import importlib.util
import smtplib
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('worker', Path(__file__).with_name('newsletter_mail_worker.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class MailWorkerTests(unittest.TestCase):
    def test_decrypts_node_aes_gcm_with_job_identity(self):
        job = {'id': 'test-job', 'payload': {'iv': 'z6Zc90F1/d5Ta26i',
            'ciphertext': '+Yq8z0D2tuv/7fA9z2btY2pKECDXJCOoX4vUFFHx', 'tag': 'uuBfc/2v/e0I5taeHxaiBw=='}}
        self.assertEqual(worker.decode_job(job, 'test-secret'), {'text': 'cross-language-test'})
        job['id'] = 'wrong-job'
        with self.assertRaises(Exception): worker.decode_job(job, 'test-secret')

    def test_uncertain_smtp_is_held_but_explicit_rejection_can_retry(self):
        self.assertEqual(worker.failure_status(TimeoutError()), 'held')
        self.assertEqual(worker.failure_status(smtplib.SMTPDataError(451, b'try later')), 'pending')
        self.assertEqual(worker.failure_status(smtplib.SMTPRecipientsRefused({'x': (550, b'rejected')})), 'failed')

    def test_consent_is_rechecked_before_any_provider_contact(self):
        job = {'id': 'a'*64, 'subscriber_id': 'id', 'issue_id': '2026-10-18'}
        calls = []
        def api(config, path, body=None):
            calls.append((path, body))
            if path == 'rpc/claim_newsletter_mail':
                return [job]
            if path.startswith('newsletter_subscribers'):
                return [{'email': 'test@example.invalid', 'status': 'unsubscribed'}]
        with patch.object(worker, 'api', side_effect=api), patch.object(worker, 'decode_job', return_value={'to': 'test@example.invalid'}), patch.object(worker, 'deliver') as send:
            worker.run({'NEWSLETTER_SECRET': 'secret'}, limit=1)
            send.assert_not_called()
            self.assertEqual(calls[-1][1]['p_status'], 'cancelled')

    def test_receipt_failure_does_not_issue_a_second_smtp_send(self):
        job = {'id': 'a'*64, 'subscriber_id': 'id', 'issue_id': '2026-10-18'}
        def api(config, path, body=None):
            if path == 'rpc/claim_newsletter_mail': return [job]
            if path.startswith('newsletter_subscribers'): return [{'email': 'test@example.invalid', 'status': 'active'}]
            raise RuntimeError('database unavailable')
        with patch.object(worker, 'api', side_effect=api), patch.object(worker, 'decode_job', return_value={'to': 'test@example.invalid'}), patch.object(worker, 'deliver', return_value='receipt') as send:
            with self.assertRaises(RuntimeError): worker.run({'NEWSLETTER_SECRET': 'secret'}, limit=1)
            self.assertEqual(send.call_count, 1)


if __name__ == '__main__': unittest.main()
