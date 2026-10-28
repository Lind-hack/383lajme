import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import news_context_candidates as candidates


class CatalogueTests(unittest.TestCase):
    def test_semantic_selection_reads_every_page_and_keeps_a_late_cross_category_match(self):
        drafts = [{'id':'new','slug':'new-story','title':'Mallrat jashtë shportës do të tatohen më shumë',
                   'body':'The full candidate copy stays available.', 'category':'Shqipëri'}]
        history = [{'id':str(i),'title':f'Published record {i}','excerpt':'Unrelated event summary',
                    'body':'Complete old article', 'category':'Botë'} for i in range(80)]
        history[-1].update(title='Rama prezanton reformën fiskale për vitin e ardhshëm', category='Ekonomi')
        with tempfile.TemporaryDirectory() as folder:
            batch = Path(folder)/'batch.json'
            def respond(prompt, brief, *args, **kwargs):
                text = brief.read_text(encoding='utf-8')
                self.assertIn(drafts[0]['body'], text)
                self.assertIn('high-recall semantic candidate selection', prompt)
                ids = ['published-79'] if brief.name.endswith('catalogue-1.md') else []
                return [{'review_id':'draft-0','related_ids':ids,
                         'reason':'The fiscal package may include the same standard tax rate change; compare its full text.'}]
            with patch.object(candidates, 'ask_rows', side_effect=respond) as model:
                selected, proof = candidates.select_comparisons(batch, drafts, history, 1000)
            self.assertEqual(model.call_count, 2)
            self.assertEqual(selected['new-story'], [history[-1]])
            self.assertEqual(len(proof['new-story']), 2)

    def test_unknown_duplicate_or_missing_id_rows_do_not_approve_catalogue_coverage(self):
        drafts = [{'id':'new','slug':'new-story','title':'A different title'}]
        history = [{'id':'old','title':'An earlier event'}]
        good = {'review_id':'draft-0','related_ids':[], 'reason':'No supplied event appears related after comparing the available titles and excerpts.'}
        with tempfile.TemporaryDirectory() as folder:
            for answer in ([], [good, good], [{**good,'related_ids':['published-unknown']}], [{**good,'related_ids':'published-0'}]):
                with self.subTest(answer=answer), patch.object(candidates,'ask_rows',return_value=answer):
                    self.assertEqual(candidates.select_comparisons(Path(folder)/'batch.json',drafts,history,1000), ({},{}))

    def test_empty_history_still_has_explicit_empty_selection_for_sibling_review(self):
        drafts = [{'id':'new','slug':'new-story'}]
        with patch.object(candidates, 'ask_rows') as model:
            selected, proof = candidates.select_comparisons(Path('unused.json'), drafts, [], 1000)
        model.assert_not_called()
        self.assertEqual(selected, {'new-story':[]})
        self.assertEqual(proof, {'new-story':[]})


if __name__ == '__main__':
    unittest.main()
