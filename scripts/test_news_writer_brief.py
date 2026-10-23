import json
import tempfile
import unittest
from pathlib import Path

from news_writer_brief import build


class WriterBriefTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.discovery, self.output = self.root / "discovery.json", self.root / "brief.md"
        self.notes = self.root / "facts.json"
        self.notes.write_text(json.dumps({"pair_id": "Kosovë-01", "facts": [
            "Institucioni | vendimi i verifikuar", "Afati | tetor", "Fusha | shërbimi publik", "Hapi tjetër | votimi"]}), encoding="utf-8")
        self.lead = {"pair_id": "Kosovë-01", "category": "Kosovë", "source": "Koha", "url": "https://koha.net/example",
                     "title": "ORIGINAL_HEADLINE_SENTINEL", "summary": "ORIGINAL_PROSE_SENTINEL " * 400,
                     "facts_path": str(self.notes), "evidence_path": "/private/original-source-prose.json",
                     "image_subject": "Prishtina", "published": "2026-10-22T12:00:00Z"}

    def write(self, rows=None):
        self.discovery.write_text(json.dumps({"publication_plan": {"Kosovë": 2, "Shqipëri": 2},
                                              "ready_leads": rows if rows is not None else [self.lead],
                                              "leads": [{"summary": "UNREADY_SOURCE_SENTINEL"}]}), encoding="utf-8")

    def test_composer_gets_exact_notes_and_provenance_without_original_headlines_or_summaries(self):
        self.write()
        original = self.discovery.read_bytes()
        self.assertEqual(build(self.discovery, self.output), 1)
        brief = self.output.read_text(encoding="utf-8")
        for prohibited in ("ORIGINAL_HEADLINE_SENTINEL", "ORIGINAL_PROSE_SENTINEL", "UNREADY_SOURCE_SENTINEL", self.lead["evidence_path"]):
            self.assertNotIn(prohibited, brief)
        for retained in ("vendimi i verifikuar", "https://koha.net/example", "Prishtina", "Publication plan"):
            self.assertIn(retained, brief)
        self.assertLessEqual(max(map(len, brief.splitlines())), 160)
        self.assertEqual(self.discovery.read_bytes(), original)

    def test_long_source_url_is_preserved_as_one_exact_value(self):
        self.write([{**self.lead, "url": "https://koha.net/" + "a" * 210}])
        build(self.discovery, self.output)
        self.assertIn("url: https://koha.net/" + "a" * 210 + "\n", self.output.read_text(encoding="utf-8"))

    def test_each_group_sees_only_its_allocations_and_story_notes(self):
        self.write([self.lead, {**self.lead, "category": "Shqipëri", "url": "https://lapsi.al/another"}])
        build(self.discovery, self.output, "Kosovë")
        brief = self.output.read_text(encoding="utf-8")
        self.assertNotIn("lapsi.al", brief)
        self.assertNotIn("Shqipëri", brief)
        self.assertIn('"Kosovë": 2', brief)

    def test_wrong_story_notes_and_wrong_category_sources_fail_closed(self):
        self.write()
        self.notes.write_text(json.dumps({"pair_id": "another-story", "facts": ["fact"] * 4}), encoding="utf-8")
        with self.assertRaises(ValueError):
            build(self.discovery, self.output)
        self.write([{**self.lead, "url": "https://variety.com/wrong-category"}])
        with self.assertRaises(ValueError):
            build(self.discovery, self.output)

    def test_no_notes_retains_only_the_existing_verified_evidence_fallback(self):
        self.write([{key: value for key, value in self.lead.items() if key != "facts_path"}])
        build(self.discovery, self.output)
        brief = self.output.read_text(encoding="utf-8")
        self.assertIn(self.lead["evidence_path"], brief)
        self.assertNotIn("ORIGINAL_PROSE_SENTINEL", brief)


if __name__ == "__main__":
    unittest.main()
