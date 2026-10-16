import unittest
from clarity_daily_report import build_report
from usage_email import heat_color, duration, HEAT


class ClarityReportTests(unittest.TestCase):
    def test_heatmap_uses_actual_clicks_and_time_not_page_views(self):
        overall = [{'metricName': 'Traffic', 'information': [{'totalSessionCount': '900', 'distinctUserCount': '6'}]}]
        usage = {'features': [{'feature': 'tregu', 'visits': 20, 'clicks': 4, 'seconds': 240},
                              {'feature': 'perty', 'visits': 5, 'clicks': 9, 'seconds': 30}],
                 'buttons': [{'feature': 'tregu', 'action': 'button:buy', 'clicks': 3}],
                 'pages': [{'path': '/tregu', 'clicks': 4, 'seconds': 240}],
                 'destinations': [{'path': '/per-ty', 'clicks': 8}]}
        text, markup = build_report(overall, [], usage)
        self.assertIn('Për Ty led clicks with 9', markup)
        self.assertIn('Tregu held attention for 4m 00s', markup)
        self.assertIn('Tregu: 20 visits · 4 clicks · 4m 00s active', text)
        self.assertIn('Tregu · Buy: 3', text)
        for section in ('Feature activity heatmap', 'Buttons people pressed', 'Pages people clicked into', 'Where people spent time'):
            self.assertIn(section, markup)
        self.assertEqual(heat_color(10, 10), HEAT[-1])
        self.assertNotEqual(heat_color(1, 10), HEAT[-1])

    def test_missing_data_is_not_reported_as_zero_or_fake_heat(self):
        text, markup = build_report([], [], {})
        self.assertIn('warming up', text)
        self.assertIn('not evidence that nobody used', markup)
        self.assertNotIn('held attention for', text)
        self.assertEqual(heat_color(0, 0), HEAT[0])

    def test_private_paths_and_query_tokens_do_not_reach_email(self):
        overall = [{'metricName': 'PopularPages', 'information': [
            {'url': 'https://383ks.com/tregu?token=SECRET', 'visitsCount': '5'},
            {'url': 'https://383ks.com/admin', 'visitsCount': '90'},
            {'url': 'https://other.example/tregu', 'visitsCount': '100'},
            {'url': 'https://383ks.com/visit/r/SECRET', 'visitsCount': '1'},
        ]}]
        text, markup = build_report(overall, [])
        for forbidden in ('SECRET', 'other.example', '/admin'):
            self.assertNotIn(forbidden, text + markup)
        self.assertIn('/visit/r/[invite]', markup)

    def test_html_escapes_paths_and_keeps_plain_text_alternative(self):
        usage = {'pages': [{'path': '/<script>', 'clicks': 1, 'seconds': 15}]}
        text, markup = build_report([], [], usage)
        self.assertNotIn('<script>', markup)
        self.assertIn('&lt;script&gt;', markup)
        self.assertIn('/<script>: 15s', text)

    def test_clarity_average_is_separate_from_measured_total_time(self):
        by_url = [{'metricName': 'EngagementTime', 'information': [
            {'Url': '/per-ty', 'activeTime': '65'}, {'Url': '/tregu', 'activeTime': 'NaN'}]}]
        _, markup = build_report([], by_url, {})
        self.assertIn('1m 05s', markup)
        self.assertIn('Clarity average active time per session', markup)
        self.assertNotIn('NaN', markup)
        self.assertEqual(duration(3725), '1h 02m')

    def test_query_variants_are_combined_before_popular_page_ranking(self):
        overall = [{'metricName': 'PopularPages', 'information': [
            {'url': '/tregu?a=1', 'visitsCount': 40}, {'url': '/tregu?a=2', 'visitsCount': 40},
            {'url': '/per-ty', 'visitsCount': 60}]}]
        _, markup = build_report(overall, [])
        popular_section = markup.split('Popular pages across the day', 1)[1].split('Pages that held attention', 1)[0]
        self.assertLess(popular_section.index('/tregu'), popular_section.index('/per-ty'))
        self.assertIn('80', popular_section)


if __name__ == '__main__':
    unittest.main()
