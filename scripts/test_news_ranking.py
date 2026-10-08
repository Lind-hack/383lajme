import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import codex_automation_support as support
from rerank_recent_news import validate_ratings

class RankingTests(unittest.TestCase):
    def test_weighted_story_factors_and_zero_are_preserved(self):
        routine = dict.fromkeys(support.SCORE_WEIGHTS, 4)
        breaking = dict.fromkeys(support.SCORE_WEIGHTS, 8)
        routine["local_depth"] = 0
        self.assertEqual(support._score_from_breakdown(routine), 3.6)
        self.assertEqual(support._score_from_breakdown(breaking), 8.0)
        self.assertEqual(support._score_from_breakdown(dict.fromkeys(support.SCORE_WEIGHTS, 0)), 0.0)


    def test_backfill_rejects_missing_ids_and_nonfinite_factors(self):
        rating = {"id": "story", "score_breakdown": dict.fromkeys(support.SCORE_WEIGHTS, 7), "score_reason": "Vendimi prek pagat e mijera punonjesve sot."}
        rating["score_breakdown"]["score_formula"] = "misplaced model metadata"
        self.assertEqual(validate_ratings([rating], [{"id": "story"}])[0]["engagement_score"], 7.0)
        self.assertEqual(set(rating["score_breakdown"]), set(support.SCORE_WEIGHTS))
        with self.assertRaises(ValueError):
            validate_ratings([rating], [{"id": "other"}])
        rating["score_breakdown"]["urgency"] = float("nan")
        with self.assertRaises(ValueError):
            validate_ratings([rating], [{"id": "story"}])

    def test_hourly_gate_rejects_unreviewed_neutral_fallback(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict("os.environ", {"L383_HOURLY_NEWS": "1"}):
            path = Path(folder) / "2026-10-08T18.json"
            path.write_text(json.dumps([{"title": "Test", "score_formula": "deterministic neutral baseline; weighted editorial ranking"}]))
            with self.assertRaisesRegex(ValueError, "ranking still uses a neutral fallback"):
                support.validate_batch(path)

if __name__ == "__main__":
    unittest.main()
