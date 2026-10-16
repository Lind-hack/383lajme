import unittest
from clarity_daily_report import build_report, feature_name


class ClarityReportTests(unittest.TestCase):
    def test_section_boundaries(self):
        self.assertEqual(feature_name('/tregu/example'), 'Tregu')
        self.assertEqual(feature_name('/tregu-preview'), 'Other public pages')
        self.assertEqual(feature_name('/per-ty'), 'Për Ty')

    def test_rankings_are_page_sessions_not_unique_feature_users(self):
        overall = [{'metricName': 'Traffic', 'information': [{'totalSessionCount': '10', 'distinctUserCount': '6'}]}]
        pages = [{'metricName': 'Traffic', 'information': [
            {'URL': 'https://383ks.com/tregu/a?token=private', 'totalSessionCount': '4'},
            {'URL': 'https://www.383ks.com/tregu/b', 'totalSessionCount': '3'},
            {'URL': 'https://383ks.com/per-ty', 'totalSessionCount': '2'},
            {'URL': 'https://383ks.com/admin', 'totalSessionCount': '90'},
            {'URL': 'https://other.example/tregu', 'totalSessionCount': '100'},
        ]}]
        text, markup = build_report(overall, pages)
        self.assertIn('Tregu: 7 page sessions', text)
        self.assertIn('Për Ty: 2 page sessions', text)
        self.assertNotIn('private', text + markup)
        self.assertNotIn('other.example', text + markup)
        self.assertNotIn('/admin', text + markup)
        self.assertIn('not unique feature users', text)
        self.assertIn('not available', text)

    def test_missing_data_is_not_reported_as_zero(self):
        text, _ = build_report([], [])
        self.assertIn('No measured page sessions', text)
        self.assertIn('Total sessions: not available', text)

    def test_escapes_untrusted_paths(self):
        pages = [{'metricName': 'Traffic', 'information': [
            {'URL': 'https://383ks.com/<script>', 'totalSessionCount': '1'},
        ]}]
        _, markup = build_report([], pages)
        self.assertNotIn('<script>', markup)
        self.assertIn('&lt;script&gt;', markup)

    def test_bad_counts_do_not_create_fake_rankings(self):
        pages = [{'metricName': 'Traffic', 'information': [
            {'URL': 'https://383ks.com/tregu', 'totalSessionCount': 'NaN'},
            {'URL': 'https://383ks.com/per-ty', 'totalSessionCount': '-1'},
        ]}]
        text, _ = build_report([], pages)
        self.assertIn('No measured page sessions', text)


if __name__ == '__main__':
    unittest.main()
