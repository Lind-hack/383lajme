import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cloud_news_discovery import select_leads
from prepare_editor_sources import discovery
import editorial_rules_v2 as rules


def technology_inventory():
    return [{"title": f"OpenAI launches agent model {index:03d}", "category": "Teknologji",
             "url": f"https://{host}/story-{index}", "published": "2026-10-07"}
            for index in range(20) for host in ("techcrunch.com", "therundown.ai")]


class HourlyCapacityTests(unittest.TestCase):
    def test_discovery_can_supply_twenty_distinct_independent_pairs(self):
        paired = select_leads(technology_inventory())
        self.assertEqual(len(paired), 40)
        self.assertEqual(len({item["pair_id"] for item in paired}), 20)
        for index in range(0, len(paired), 2):
            self.assertEqual(paired[index]["title"], paired[index + 1]["title"])

    def test_evidence_preparation_does_not_truncate_the_twenty_pair_queue(self):
        paired = select_leads(technology_inventory())
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "discovery.md"
            path.write_text("# Discovery\n")
            path.with_suffix(".json").write_text(json.dumps({"leads": paired}))
            with patch("prepare_editor_sources.fetch_url", side_effect=lambda url: {"status": "text_extracted", "url": url, "text": "Verified evidence"}) as reader:
                discovery(path)
            result = json.loads(path.with_suffix(".json").read_text())
            self.assertEqual(len(result["verified_pair_ids"]), 20)
            self.assertEqual(result["source_ready_categories"]["Teknologji"], 20)
            self.assertEqual(reader.call_count, 40)

    def test_twenty_is_allowed_but_twenty_one_stays_rejected(self):
        with patch.object(rules, "HOURLY_NEWS_MODE", True), patch.object(rules, "article_errors", return_value=[]):
            self.assertEqual(rules.validate_run([{"category": "Botë"}] * 20), [])
            self.assertTrue(any("caps the run" in message for message in rules.validate_run([{"category": "Botë"}] * 21)))


if __name__ == "__main__":
    unittest.main()
