import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from news_reader_interest import MIN_INTEREST, prompt, rank


def lead(n, title, source='A'):
    return dict(url=f'https://example.com/{n}', source=source, category='Ekonomi', title=title)


LEADS = [lead(1, 'Lidl extends potato deal with Meade Farm'),
         lead(2, 'Kosovo raises the minimum wage to 500 euros'),
         lead(3, 'Gold falls below 3,900 dollars'),
         lead(4, 'ASIC reviews 45 pension administrators')]


def scores(values):
    """A judge that answers with the given score per position, and counts its calls."""
    calls = []

    def judge(items, category, deadline):
        calls.append([item['id'] for item in items])
        return [dict(id=item['id'], score=values[item['title']], known=True, stake=True, reason='test')
                for item in items if item['title'] in values]
    judge.calls = calls
    return judge


class ReaderInterestTests(unittest.TestCase):
    def run_rank(self, leads, judge, folder, **options):
        with patch('builtins.print'):
            return rank(leads, {}, 'Ekonomi', Path(folder), judge=judge, **options)

    def test_stories_most_readers_care_about_come_first_and_fillers_are_held(self):
        judge = scores({LEADS[0]['title']: 1, LEADS[1]['title']: 5, LEADS[2]['title']: 3, LEADS[3]['title']: 2})
        with tempfile.TemporaryDirectory() as folder:
            kept, held = self.run_rank([dict(row) for row in LEADS], judge, folder)
        self.assertEqual([row['url'][-1] for row in kept], ['2', '3'])
        self.assertEqual({row['url'][-1] for row in held}, {'1', '4'})
        self.assertEqual(kept[0]['reader_interest'], 5)
        self.assertTrue(all(row['reader_interest'] < MIN_INTEREST for row in held))

    def test_equal_scores_keep_the_order_they_arrived_in(self):
        judge = scores({row['title']: 4 for row in LEADS})
        with tempfile.TemporaryDirectory() as folder:
            kept, held = self.run_rank([dict(row) for row in LEADS], judge, folder)
        self.assertEqual([row['url'][-1] for row in kept], ['1', '2', '3', '4'])
        self.assertEqual(held, [])

    def test_a_failed_judge_changes_nothing(self):
        def broken(items, category, deadline):
            raise ValueError('model returned no complete JSON')
        with tempfile.TemporaryDirectory() as folder:
            kept, held = self.run_rank([dict(row) for row in LEADS], broken, folder)
        self.assertEqual([row['url'] for row in kept], [row['url'] for row in LEADS])
        self.assertEqual(held, [])
        self.assertNotIn('reader_interest', kept[0])

    def test_a_story_the_judge_skipped_is_kept_behind_the_scored_ones(self):
        judge = scores({LEADS[1]['title']: 4, LEADS[0]['title']: 1})
        with tempfile.TemporaryDirectory() as folder:
            kept, held = self.run_rank([dict(row) for row in LEADS], judge, folder)
        self.assertEqual([row['url'][-1] for row in kept], ['2', '3', '4'])
        self.assertEqual([row['url'][-1] for row in held], ['1'])

    def test_invalid_scores_and_unknown_ids_are_ignored(self):
        def judge(items, category, deadline):
            return [dict(id=items[0]['id'], score=9), dict(id='nope', score=5), 'junk',
                    dict(id=items[1]['id'], score=True), dict(id=items[2]['id'], score=5)]
        with tempfile.TemporaryDirectory() as folder:
            kept, held = self.run_rank([dict(row) for row in LEADS], judge, folder)
        self.assertEqual(kept[0]['url'][-1], '3')
        self.assertEqual(len(kept), 4)
        self.assertEqual(held, [])

    def test_a_scored_headline_is_not_judged_again(self):
        judge = scores({row['title']: 4 for row in LEADS})
        with tempfile.TemporaryDirectory() as folder:
            self.run_rank([dict(row) for row in LEADS], judge, folder)
            self.run_rank([dict(row) for row in LEADS] + [lead(5, 'Bitcoin passes 100,000 dollars')], judge, folder)
            saved = json.loads((Path(folder) / 'reader-interest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(judge.calls), 2)
        self.assertEqual(len(judge.calls[1]), 1)
        self.assertEqual(len(saved), 4)

    def test_a_changed_headline_is_judged_again(self):
        judge = scores({LEADS[0]['title']: 1, 'Lidl recalls potatoes sold in Kosovo': 5})
        with tempfile.TemporaryDirectory() as folder:
            self.run_rank([dict(LEADS[0])], judge, folder)
            kept, held = self.run_rank([dict(LEADS[0], title='Lidl recalls potatoes sold in Kosovo')], judge, folder)
        self.assertEqual(len(kept), 1)
        self.assertEqual(kept[0]['reader_interest'], 5)

    def test_one_call_judges_at_most_the_batch_and_the_rest_wait_their_turn(self):
        many = [lead(n, f'Story number {n}') for n in range(10)]
        judge = scores({row['title']: 4 for row in many})
        with tempfile.TemporaryDirectory() as folder:
            kept, held = self.run_rank(many, judge, folder, batch=6)
        self.assertEqual(len(judge.calls[0]), 6)
        self.assertEqual(len(kept), 10)
        self.assertEqual([row.get('reader_interest') for row in kept], [4] * 6 + [None] * 4)

    def test_only_showbiz_is_told_that_small_local_celebrity_news_counts(self):
        self.assertIn('named Albanian or Kosovo celebrity', prompt('Showbiz'))
        self.assertIn('scores at least 3', prompt('Showbiz'))
        for desk in ('Ekonomi', 'Botë'):
            self.assertNotIn('celebrity did', prompt(desk))
            self.assertNotIn('desk_note', prompt(desk))

    def test_switched_off_changes_nothing(self):
        judge = scores({row['title']: 1 for row in LEADS})
        with tempfile.TemporaryDirectory() as folder, patch.dict('os.environ', {'L383_READER_INTEREST': '0'}):
            kept, held = self.run_rank([dict(row) for row in LEADS], judge, folder)
        self.assertEqual(len(kept), 4)
        self.assertEqual(judge.calls, [])


if __name__ == '__main__':
    unittest.main()
