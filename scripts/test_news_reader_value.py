import unittest
from datetime import datetime, timezone

from cloud_news_discovery import select_hourly_leads
from prepare_editor_sources import prioritize_grounded_leads
from news_reader_value import reader_value


class ReaderValueTests(unittest.TestCase):
    def test_concrete_reader_consequences_across_desks(self):
        cases = [('Kosovë', 'Prishtina publikon orarin e ndërprerjes së ujit'),
                 ('Shqipëri', 'Shqipëria ndryshon taksat për pagat'),
                 ('Teknologji', 'Microsoft releases security patch for Windows'),
                 ('Ekonomi', 'Wall Street stocks rise after interest rate decision'),
                 ('Botë', 'Court blocks new visa law'),
                 ('Sport', 'Kosova fiton dhe kualifikohet në finale'),
                 ('Showbiz', 'Dua Lipa shpall datat dhe biletat e koncerteve')]
        for category, title in cases:
            self.assertGreater(reader_value(dict(category=category, title=title))['score'], 0, title)
        self.assertEqual(reader_value({'title': 'You will never believe what happened'})['score'], 0)
        self.assertLess(reader_value({'title': 'What is Bitcoin?', 'category': 'Ekonomi'})['score'], 0)

    def test_priority_survives_preparation_without_discarding_reserves(self):
        now = datetime(2026, 10, 27, 8, tzinfo=timezone.utc)
        base = {'category': 'Teknologji', 'published': now.isoformat(),
                'primary_evidence': {'status': 'text_extracted', 'text': 'facts '*200}}
        launch = dict(base, title='Company announces a new device', url='https://techcrunch.com/device')
        safety = dict(base, title='Microsoft releases Windows security patch', url='https://engadget.com/security')
        chosen = select_hourly_leads([launch, safety], now=now)
        self.assertEqual(chosen[0]['url'], safety['url'])
        self.assertEqual(len(chosen), 2)
        self.assertEqual(prioritize_grounded_leads([launch, safety], now=now)[0], safety)
        self.assertNotIn('viral', chosen[0]['reader_value'])

    def test_metadata_cannot_forge_a_precomputed_value_or_measured_popularity(self):
        lead = {'title': 'A generic company announcement', 'reader_value': {'score': 999}}
        value = reader_value(lead)
        self.assertEqual(value['score'], 0)
        self.assertEqual(value['basis'], 'headline_and_genre_signals_not_measured_engagement')


if __name__ == '__main__':
    unittest.main()
