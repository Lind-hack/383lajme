import json
import tempfile
import unittest
from pathlib import Path

import originality_gate as gate


class OriginalityGateTests(unittest.TestCase):
    def test_long_unquoted_source_sentence_is_rejected(self):
        source = "Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor pas përfundimit të procedurave."
        article = {"body": "<p>Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor pas përfundimit të procedurave.</p>"}
        errors = gate.originality_errors(article, {"evidence": {"text": source}})
        self.assertTrue(any("exact source overlap" in error for error in errors))

    def test_short_quoted_excerpt_is_allowed(self):
        source = "Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor."
        article = {"body": "<p>Ministria tha: “projekti do të nisë në Prishtinë më 1 tetor”.</p>"}
        self.assertEqual(gate.originality_errors(article, {"evidence": {"text": source}}), [])

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
