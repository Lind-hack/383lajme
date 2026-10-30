import unittest
from unittest.mock import Mock
import httpx
from automation_http import retry_http


class RetryTests(unittest.TestCase):
    def response(self, status):
        return httpx.Response(status, request=httpx.Request('GET', 'https://example.org'))

    def test_transient_status_and_connection_loss_retry_same_packet(self):
        packet = {'date': '2026-10-30', 'articles': [{'url': 'https://example.org/story'}]}
        bad, good = self.response(503), self.response(200)
        call = Mock(side_effect=[httpx.ReadTimeout('lost response'), bad, good])
        sleep = Mock()
        self.assertIs(retry_http(call, json=packet, sleep=sleep), good)
        self.assertTrue(bad.is_closed)
        self.assertEqual([c.kwargs['json'] for c in call.call_args_list], [packet] * 3)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [1, 2])

    def test_auth_and_validation_failures_are_not_retried(self):
        for status in (400, 401, 403, 409, 422):
            call, sleep = Mock(return_value=self.response(status)), Mock()
            self.assertEqual(retry_http(call, sleep=sleep).status_code, status)
            call.assert_called_once()
            sleep.assert_not_called()

    def test_retries_stop_and_preserve_failure(self):
        call = Mock(side_effect=httpx.ConnectError('offline'))
        with self.assertRaises(httpx.ConnectError):
            retry_http(call, sleep=Mock())
        self.assertEqual(call.call_count, 3)
        call = Mock(side_effect=[self.response(429) for _ in range(3)])
        with self.assertRaises(httpx.HTTPStatusError):
            retry_http(call, sleep=Mock()).raise_for_status()
        self.assertEqual(call.call_count, 3)


if __name__ == '__main__':
    unittest.main()
