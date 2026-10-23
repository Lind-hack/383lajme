import os as _os
_os.environ["L383_GEMINI_KEY"] = ""  # never the real Gemini API in tests
import re
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import news_fact_sheets as sheets

SOURCE = ("The city council voted on Tuesday to close the old bridge for repairs that will last "
          "until the end of March, the mayor told reporters after the session.")


def lead(n):
    return {"pair_id": f"Kosovë-{n}", "title": f"Story {n}", "text": SOURCE}


def reply(rows):
    return SimpleNamespace(returncode=0, stdout="383_JSON_BEGIN" + json.dumps(rows) + "383_JSON_END")


class FactSheetTests(unittest.TestCase):
    def test_notes_from_a_superseded_composition_policy_are_rebuilt(self):
        item = lead(1)
        facts = ["Keshilli | vendimi", "Ura | riparime", "Afati | mars", "Kryetari | deklarata"]
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows",
                return_value=[{"pair_id": "story-001", "facts": facts}]) as model:
            cache = Path(folder) / "reporter-notes-cache.json"
            cache.write_text(json.dumps({"version": 2, "entries": {sheets.evidence_key(item): {
                "at": sheets.time.time(), "facts": ["Old source analysis"] * 4}}}), encoding="utf-8")
            paths = sheets.build_fact_sheets([item], Path(folder))
            model.assert_called_once()
            self.assertNotIn("Old source analysis", paths[item["pair_id"]].read_text(encoding="utf-8"))

    def test_partial_model_notes_retry_only_the_missing_story_with_ascii_id(self):
        facts = ["Keshilli | vendimi", "Ura | riparime", "Afati | mars", "Kryetari | deklarata"]
        answers = [[{"pair_id": "story-001", "facts": facts}, {"pair_id": "story-OO2", "facts": facts}],
                   [{"pair_id": "story-001", "facts": facts}]]
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows", side_effect=answers) as model:
            result = sheets.build_fact_sheets([lead(1), lead(2)], Path(folder))
            self.assertEqual(set(result), {lead(1)["pair_id"], lead(2)["pair_id"]})
            self.assertEqual(model.call_count, 2)
            self.assertIn("pair_id: story-001", (Path(folder) / "news-fact-briefs-0.md").read_text(encoding="utf-8"))

    def test_verified_notes_follow_exact_evidence_across_hourly_pair_ids(self):
        facts = ["Keshilli | votimi | marte", "Ura | statusi | mbyllur", "Punimet | afati | mars", "Kryetari | deklarata | pas mbledhjes"]
        original = {**lead(1), "source_url": "https://example.com/story"}
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows",
                return_value=[{"pair_id": "story-001", "facts": facts}]) as model:
            sheets.build_fact_sheets([original], Path(folder))
            renamed = {**original, "pair_id": "Kosove-99"}
            paths = sheets.build_fact_sheets([renamed], Path(folder))
            self.assertIn(renamed["pair_id"], paths)
            self.assertEqual(model.call_count, 1)
            cache = json.loads((Path(folder) / "reporter-notes-cache.json").read_text(encoding="utf-8"))
            self.assertEqual(len(cache["entries"]), 1)
            self.assertNotEqual(sheets.evidence_key(original), sheets.evidence_key({**original, "text": SOURCE + "Changed fact."}))
            self.assertNotEqual(sheets.evidence_key(original), sheets.evidence_key({**original, "source_url": "https://other.example/story"}))

    def test_expired_malformed_or_copied_cached_notes_are_not_reused(self):
        item = lead(1)
        key = sheets.evidence_key(item)
        valid = {"at": sheets.time.time(), "facts": ["Fakt | nje", "Fakt | dy", "Fakt | tre", "Fakt | kater"]}
        self.assertIn(item["pair_id"], sheets.cached_notes([item], {key: valid}))
        for entry in ("invalid", {**valid, "at": 0}, {**valid, "facts": [SOURCE] * 4}):
            self.assertEqual(sheets.cached_notes([item], {key: entry}), {})

    def test_fragment_fallback_never_enters_the_verified_notes_cache(self):
        text = "First distinct factual clause with names. Second different factual clause with dates. Third unique factual clause with numbers. Fourth separate factual clause with places."
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows", return_value=[]):
            paths = sheets.build_fact_sheets([{**lead(1), "text": text}], Path(folder))
            self.assertTrue(paths)
            cache = json.loads((Path(folder) / "reporter-notes-cache.json").read_text(encoding="utf-8"))
            self.assertEqual(cache["entries"], {})

    def test_no_high_override_is_required_for_max_effort_model_notes(self):
        facts = ["Këshilli votoi të martën", "Ura mbyllet për riparime", "Punimet mbarojnë në mars", "Kryetari foli pas seancës"]
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows", return_value=[{"pair_id": "story-001", "facts": facts}]) as model:
            paths = sheets.build_fact_sheets([lead(1)], Path(folder))
            self.assertIn("Kosovë-1", paths)
            args = model.call_args.args[2]
            self.assertNotIn("--ignore-user-config", args)
            self.assertEqual(args[args.index("--model") + 1], "gpt-6-luna")
            self.assertIsNotNone(model.call_args.kwargs["deadline"])

    def test_notes_that_copy_the_source_are_dropped(self):
        facts = ["Këshilli votoi të martën", "Ura e vjetër mbyllet për riparime", "Punimet zgjasin deri në fund të marsit",
                 "Kryetari foli pas seancës", "the old bridge for repairs that will last until the end"]
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows",
                                                                   return_value=[{"pair_id": "story-001", "facts": facts}]):
            paths = sheets.build_fact_sheets([lead(1)], Path(folder))
            kept = json.loads(paths["Kosovë-1"].read_text(encoding="utf-8"))["facts"]
        self.assertEqual(len(kept), 4)
        self.assertNotIn(facts[-1], kept)

    def test_too_few_clean_notes_leave_the_story_without_a_sheet(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows",
                                                                   return_value=[{"pair_id": "story-001", "facts": ["Vetëm një fakt"]}]):
            self.assertEqual(sheets.build_fact_sheets([lead(1)], Path(folder)), {})

    def test_a_failed_chunk_costs_only_its_own_leads(self):
        leads = [lead(n) for n in range(sheets.CHUNK + 1)]
        good = ["Fakt i parë", "Fakt i dytë", "Fakt i tretë", "Fakt i katërt"]
        def answer(prompt, path, args, **_):
            brief = re.findall(r"## pair_id: (\S+)", path.read_text(encoding="utf-8"))
            if len(brief) > 1:
                raise sheets.subprocess.TimeoutExpired("hermes", 360)
            return [{"pair_id": brief[0], "facts": good}]
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows", side_effect=answer):
            self.assertEqual(list(sheets.build_fact_sheets(leads, Path(folder))), [f"Kosovë-{sheets.CHUNK}"])


if __name__ == "__main__":
    unittest.main()
