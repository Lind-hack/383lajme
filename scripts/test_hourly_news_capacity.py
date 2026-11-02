import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cloud_news_discovery import select_leads
from prepare_editor_sources import discovery
import editorial_rules_v2 as rules
from news_source_policy import hourly_targets


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

    def test_source_mix_gate_accepts_expanded_showbiz_only_in_hourly_mode(self):
        import contextlib,io,os
        from validate_source_mix import validate
        rows=[{'category':'Showbiz','url':f'https://host{n%5}.example/story-{n}'} for n in range(24)]
        with tempfile.TemporaryDirectory() as folder,contextlib.redirect_stdout(io.StringIO()):
            batch=Path(folder)/'batch.json';batch.write_text(json.dumps(rows))
            with patch.dict(os.environ,{'L383_HOURLY_NEWS':'1'}):self.assertEqual(validate(batch),0)
            with patch.dict(os.environ,{'L383_HOURLY_NEWS':'0'}):self.assertEqual(validate(batch),1)

    def test_showbiz_can_expand_above_twenty_other_desks_keep_three(self):
        with patch.object(rules, "HOURLY_NEWS_MODE", True), patch.object(rules, "article_errors", return_value=[]):
            balanced = [{"category": category} for category, target in hourly_targets().items()
                        for _ in range(target)]
            self.assertEqual(len(balanced), 20)
            self.assertEqual(rules.validate_run(balanced), [])
            self.assertEqual(rules.validate_run(balanced + [{"category": "Showbiz"}] * 30), [])
            self.assertTrue(any("caps the run" in message for message in rules.validate_run(balanced + [{"category": "Sport"}])))
            self.assertTrue(any("each category" in message for message in rules.validate_run([{"category": "Botë"}] * 20)))


if __name__ == "__main__":
    unittest.main()
