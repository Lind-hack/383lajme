import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import news_repair_preserve as repair


class RepairPreservationTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        root = Path(self.folder.name)
        self.before, self.after, self.evidence = root / "before.json", root / "after.json", root / "evidence.json"
        self.good = {"url": "https://example.com/good", "slug": "good", "body": "Original checked prose",
                     "image_rights": {"creator": "Photographer"}, "score_breakdown": {"impact": 8}}
        self.bad = {"url": "https://example.com/bad", "slug": "bad", "body": "Copied source sentence"}
        self.before.write_text(json.dumps([self.good, self.bad]), encoding="utf-8")
        self.evidence.write_text(json.dumps([{"slug": article["slug"], "source_url": article["url"]}
                                            for article in [self.good, self.bad]]), encoding="utf-8")
        checks = patch.multiple(repair,
            originality_errors=Mock(side_effect=lambda article, record: ["source overlap"] if article["slug"] == "bad" else []),
            journalism_errors=Mock(return_value=[]), article_errors=Mock(return_value=[]), evidence_errors=Mock(return_value=[]))
        checks.start()
        self.addCleanup(checks.stop)

    def test_model_cannot_change_previously_passing_prose_rights_or_scores(self):
        fixed = {**self.bad, "body": "New original prose"}
        self.after.write_text(json.dumps([{**self.good, "body": "New copied prose", "image_rights": {}}, fixed]), encoding="utf-8")
        repair.preserve(self.before, self.after, self.evidence)
        self.assertEqual(json.loads(self.after.read_text(encoding="utf-8")), [self.good, fixed])

    def test_model_cannot_drop_passing_drafts_but_may_drop_unrepairable_ones(self):
        self.after.write_text("[]", encoding="utf-8")
        repair.preserve(self.before, self.after, self.evidence)
        self.assertEqual(json.loads(self.after.read_text(encoding="utf-8")), [self.good])

    def test_new_or_duplicate_source_is_never_merged(self):
        for rows in ([{**self.bad, "url": "https://unknown.example/new"}], [self.bad, self.bad]):
            self.after.write_text(json.dumps(rows), encoding="utf-8")
            before = self.after.read_bytes()
            with self.assertRaises(ValueError):
                repair.preserve(self.before, self.after, self.evidence)
            self.assertEqual(self.after.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
