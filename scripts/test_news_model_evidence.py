import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from news_model_evidence import write_readable_evidence
from prepare_editor_sources import prepare


class ReadableEvidenceTests(unittest.TestCase):
    def test_long_source_and_body_survive_line_clipping_without_losing_characters(self):
        value = [{"body": "<p>" + "Fakte të verifikuara. " * 600 + "END_BODY</p>",
                  "text": "Source sentence. " * 900 + "END_SOURCE",
                  "url": "https://example.com/" + "a" * 500}]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.md"
            write_readable_evidence(path, value)
            lines = path.read_text(encoding="utf-8").splitlines()[3:]
        self.assertLessEqual(max(map(len, lines)), 160)
        # Wrapping introduces only newlines, including for long URLs.
        self.assertEqual("".join(lines), "".join(json.dumps(value, ensure_ascii=False, indent=2).splitlines()))
        self.assertIn("END_SOURCE", "\n".join(lines))
        self.assertIn("END_BODY", "\n".join(lines))

    def test_editor_gets_complete_primary_and_secondary_views_with_original_json_intact(self):
        article = {"slug": "story", "url": "https://example.com/primary",
                   "corroborating_sources": [{"url": "https://example.org/secondary"}]}
        def fetched(url):
            return {"url": url, "status": "text_extracted", "text": "Grounded fact. " * 500 + url}
        with tempfile.TemporaryDirectory() as folder:
            batch = Path(folder) / "batch.json"
            batch.write_text(json.dumps([article]), encoding="utf-8")
            with patch("prepare_editor_sources.fetch_url", side_effect=fetched):
                evidence = prepare(batch)
            original = json.loads(evidence.read_text(encoding="utf-8"))
            view = batch.with_suffix(".editor-sources.md").read_text(encoding="utf-8")
            self.assertEqual(original[0]["evidence"], fetched(article["url"]))
            self.assertIn("https://example.org/secondary", view)
            self.assertIn("https://example.com/primary", view)
            self.assertLessEqual(max(map(len, view.splitlines())), 160)


if __name__ == "__main__":
    unittest.main()
