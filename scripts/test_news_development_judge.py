import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import codex_automation_support as support
import news_development_judge as development

PUBLISHED = {"id": "old", "title": "Trump lidh Groenlandën me sigurinë e SHBA-së dhe Evropës",
             "excerpt": "Presidenti amerikan tha se ishulli është çelës për mbrojtjen e aleatëve.",
             "body": "<p>Presidenti Donald Trump deklaroi se Groenlanda lidhet me sigurinë e Shteteve të Bashkuara "
                     "dhe të Evropës, ndërsa Danimarka kundërshtoi deklaratën e tij për ishullin arktik.</p>"}
# Same people and island, a new decision: exploration for oil and minerals.
DEVELOPMENT = {"id": "new", "slug": "trump-kerkime-nafte-groenlande", "url": "https://example.com/new",
               "title": "Trump njofton kërkime nafte e mineralesh në Groenlandë",
               "excerpt": "Presidenti amerikan njoftoi kërkime për naftë, gaz dhe minerale në ishull.",
               "body": "<p>Presidenti Donald Trump njoftoi kërkime për naftë, gaz dhe minerale në Groenlandë, "
                       "ndërsa Danimarka tha se ishulli arktik nuk është në shitje dhe kundërshtoi planin.</p>"}


class DevelopmentTests(unittest.TestCase):
    def run_dedupe(self, articles, verdicts):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "2026-10-17T10.json"
            path.write_text(json.dumps(articles), encoding="utf-8")
            with patch.object(support, "_published_articles", return_value=[]), \
                    patch.object(support, "_published_conflicts", return_value=[]), \
                    patch.object(support, "_recently_published", return_value=[PUBLISHED]), \
                    patch("news_development_judge.judge", return_value=verdicts) as judge:
                self.assertEqual(support.dedupe_published(path, prune=True), 0)
                return [row["id"] for row in json.loads(path.read_text(encoding="utf-8"))], judge

    def test_the_uncertain_band_follows_the_judge(self):
        overlap = support._story_overlap(DEVELOPMENT, PUBLISHED)
        self.assertTrue(support._same_story(DEVELOPMENT, PUBLISHED) and overlap < support.CLEAR_REPEAT, overlap)
        self.assertEqual(self.run_dedupe([DEVELOPMENT], [True])[0], ["new"])
        kept, _ = self.run_dedupe([DEVELOPMENT], [False])
        self.assertEqual(kept, [])

    def test_a_clear_retelling_is_refused_without_asking(self):
        retold = {**PUBLISHED, "id": "again", "slug": "trump-groenlande-siguri", "url": "https://example.com/again"}
        kept, judge = self.run_dedupe([retold], [True])
        self.assertEqual(kept, [])
        judge.assert_not_called()

    def test_failed_model_call_keeps_the_strict_rule(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(development, "ask_rows", side_effect=ValueError("unavailable")):
            self.assertEqual(development.judge([(DEVELOPMENT, PUBLISHED)], Path(folder)), [False])

    def test_verdicts_are_read_per_pair_and_missing_ones_count_as_repeats(self):
        answer = [{"pair_id": "pair-2", "verdict": "new"}, {"pair_id": "pair-1", "verdict": "retelling"}]
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"WRITER_EFFORT_FLAG": "--ignore-user-config"}), \
                patch.object(development, "ask_rows", return_value=answer):
            pairs = [(DEVELOPMENT, PUBLISHED)] * 3
            self.assertEqual(development.judge(pairs, Path(folder)), [False, True, False])


if __name__ == "__main__":
    unittest.main()
