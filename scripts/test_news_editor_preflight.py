import json
import tempfile
import unittest
from pathlib import Path

from news_editor_preflight import diagnostics


class PreflightTests(unittest.TestCase):
    def test_all_known_defects_have_exact_identity_without_mutating_inputs(self):
        with tempfile.TemporaryDirectory() as folder:
            batch, evidence = Path(folder)/'batch.json', Path(folder)/'sources.json'
            copied = 'Ministria publikoi sot të gjitha të dhënat për projektin e ri në Prishtinë.'
            article = {'slug': 'bank', 'url': 'https://consequence.net/2026/10/bank/',
                       'source': 'Consequence', 'category': 'Showbiz', 'title': 'Banka njofton fitimin',
                       'excerpt': 'Njoftimi i bankës.',
                       'body': '<p>'+copied+' Sipas Telegrafit, projekti nis sot.</p><p>'
                               +'Fakt i verifikuar për njoftimin. '*30+'</p><p>Afati u konfirmua.</p>'}
            batch.write_text(json.dumps([article]), encoding='utf-8')
            evidence.write_text(json.dumps([{'slug': 'bank', 'source_url': article['url'],
                                             'evidence': {'status': 'text_extracted', 'text': copied}}]),
                                encoding='utf-8')
            before = (batch.read_bytes(), evidence.read_bytes())
            result = diagnostics(batch, evidence)
            self.assertEqual(len(result), 1)
            self.assertEqual((result[0]['url'], result[0]['title']), (article['url'], article['title']))
            text = ' '.join(result[0]['defects'])
            for error in ('exact source overlap', 'names a publisher', 'explicit entertainment'):
                self.assertIn(error, text)
            self.assertEqual(before, (batch.read_bytes(), evidence.read_bytes()))

    def test_missing_evidence_is_an_error_not_an_empty_clean_diagnostic(self):
        with tempfile.TemporaryDirectory() as folder:
            batch, evidence = Path(folder)/'batch.json', Path(folder)/'sources.json'
            batch.write_text('[{"slug":"missing"}]')
            evidence.write_text('[]')
            with self.assertRaisesRegex(ValueError, 'fetched evidence'):
                diagnostics(batch, evidence)


if __name__ == '__main__':
    unittest.main()
