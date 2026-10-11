import json
import tempfile
import unittest
from pathlib import Path

import originality_gate as gate


class OriginalityGateTests(unittest.TestCase):
    def test_link_attributes_are_not_direct_quotations(self):
        article = {"body": '<p>Lexoni <a href="https://example.com/reports/new-project-consultation-dates">afatin</a>.</p>'}
        self.assertEqual(gate.originality_errors(article, {"evidence": {"text": "Independent source facts."}}), [])

    def test_quoted_word_does_not_exempt_copied_prose(self):
        source = "Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor."
        article = {"body": '<p>“Sot” Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor.</p>'}
        self.assertTrue(gate.originality_errors(article, {"evidence": {"text": source}}))

    def test_secondary_source_headlines_and_excerpt_are_checked(self):
        copied = "Kompania prezantoi një pajisje të re për përdoruesit e saj në Evropë"
        for field in ("body", "title", "excerpt"):
            article = {"body": "Një zhvillim i verifikuar.", field: copied}
            evidence = {"evidence": {"text": "Primary verified facts."},
                        "corroborating": [{"evidence": {"text": copied}}]}
            self.assertTrue(any("corroborating source" in message for message in gate.originality_errors(article, evidence)))

    def test_html_encoded_quotes_and_copy_are_not_a_bypass(self):
        copied = "Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor."
        article = {"body": "<p>&quot;sot&quot; " + copied.replace("ë", "&#235;") + "</p>"}
        self.assertTrue(gate.originality_errors(article, {"evidence": {"text": copied}}))

    def test_many_short_quoted_fragments_do_not_exempt_entire_source(self):
        fragments = [f"Institucioni konfirmoi vendimin numër {index} pas takimit" for index in range(8)]
        article = {"body": " ".join(f'“{fragment}”' for fragment in fragments)}
        self.assertTrue(gate.originality_errors(article, {"evidence": {"text": " ".join(fragments)}}))

    def test_long_unquoted_source_sentence_is_rejected(self):
        source = "Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor pas përfundimit të procedurave."
        article = {"body": "<p>Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor pas përfundimit të procedurave.</p>"}
        errors = gate.originality_errors(article, {"evidence": {"text": source}})
        self.assertTrue(any("exact source overlap" in error for error in errors))
        self.assertTrue(any(source in error for error in errors))

    def test_short_quotation_is_not_an_automatic_permission_exception(self):
        source = "Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor."
        article = {"body": "<p>Ministria tha: “projekti do të nisë në Prishtinë më 1 tetor”.</p>"}
        self.assertTrue(gate.originality_errors(article, {"evidence": {"text": source}}))

    def test_batch_gate_drops_copy_without_replacing_it(self):
        article = {"slug": "copied-story", "title": "Prishtinë nis projektin", "body": "Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor pas përfundimit të procedurave."}
        kept = {"slug": "rewritten-story", "title": "Prishtinë hap projektin më 1 tetor", "body": "Institucioni tha se puna fillon në vjeshtë, pas mbylljes së hapave administrative."}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch = root / "batch.json"
            evidence = root / "batch.editor-sources.json"
            batch.write_text(json.dumps([article, kept]), encoding="utf-8")
            evidence.write_text(json.dumps([
                {"slug": "copied-story", "evidence": {"status": "text_extracted", "text": article["body"]}},
                {"slug": "rewritten-story", "evidence": {"status": "text_extracted", "text": "A different source report."}},
            ]), encoding="utf-8")
            self.assertEqual(gate.validate(batch, evidence), 0)
            self.assertEqual([item["slug"] for item in json.loads(batch.read_text(encoding="utf-8"))], ["rewritten-story"])


if __name__ == "__main__":
    unittest.main()
