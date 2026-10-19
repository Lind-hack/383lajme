import unittest
from unittest.mock import Mock
from run_weekly_newsletter import run


class WeeklySchedulerTests(unittest.TestCase):
    settings = {'SITE_URL': 'https://383ks.com', 'CRON_SECRET': 'x' * 32}

    def test_drains_sent_and_queued_batches(self):
        call = Mock(side_effect=[{'sent': 0, 'queued': 5, 'pending': 1}, {'sent': 1, 'pending': 0}])
        run(self.settings, call)
        self.assertEqual(call.call_count, 2)

    def test_outside_window_and_waiting_lease_stop_without_spinning(self):
        for result in [{'skipped': 'outside_weekly_window', 'sent': 0}, {'sent': 0, 'pending': 4}]:
            call = Mock(return_value=result)
            run(self.settings, call)
            self.assertEqual(call.call_count, 1)

    def test_held_and_failed_work_is_not_reported_as_success(self):
        for field in ['held', 'failed']:
            with self.assertRaises(RuntimeError):
                run(self.settings, Mock(return_value={'sent': 0, field: 1}))

    def test_wrong_origin_and_malformed_response_are_rejected(self):
        with self.assertRaises(ValueError): run({**self.settings, 'SITE_URL': 'https://example.com'})
        with self.assertRaises(ValueError): run(self.settings, Mock(return_value={'message': 'ok'}))
        with self.assertRaises(ValueError): run(self.settings, Mock(return_value={'sent': '5'}))


if __name__ == '__main__': unittest.main()
