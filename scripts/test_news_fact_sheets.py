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
    def setUp(self):
        # Model notes run only with the high-effort config; these tests cover them.
        patcher = patch.object(sheets, "high_effort_flag", return_value=["--ignore-user-config"])
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_without_the_high_config_stories_get_scrambled_fragment_notes_and_no_model_call(self):
        text = ("The council voted on Tuesday to close the old Ibar bridge. Repairs will cost 2.4 million euros, "
                "the mayor Arben Gashi said. Work starts in March and ends in December. Residents can use the "
                "new crossing near the stadium, according to the municipal transport office.")
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "high_effort_flag", return_value=[]),                 patch.object(sheets.subprocess, "run") as model:
            paths = sheets.build_fact_sheets([{"pair_id": "Kosovë-9", "title": "t", "text": text}], Path(folder))
            facts = json.loads(paths["Kosovë-9"].read_text(encoding="utf-8"))["facts"]
        model.assert_not_called()
        self.assertGreaterEqual(len(facts), 4)
        self.assertTrue(all(len(fact.split()) <= sheets.MAX_FACT_WORDS for fact in facts))
        self.assertTrue(any("2.4" in fact for fact in facts[:3]))  # fact-bearing fragments lead

    def test_notes_that_copy_the_source_are_dropped(self):
        facts = ["Këshilli votoi të martën", "Ura e vjetër mbyllet për riparime", "Punimet zgjasin deri në fund të marsit",
                 "Kryetari foli pas seancës", "the old bridge for repairs that will last until the end"]
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets.subprocess, "run",
                                                                   return_value=reply([{"pair_id": "Kosovë-1", "facts": facts}])):
            paths = sheets.build_fact_sheets([lead(1)], Path(folder))
            kept = json.loads(paths["Kosovë-1"].read_text(encoding="utf-8"))["facts"]
        self.assertEqual(len(kept), 4)
        self.assertNotIn(facts[-1], kept)

    def test_too_few_clean_notes_leave_the_story_without_a_sheet(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets.subprocess, "run",
                                                                   return_value=reply([{"pair_id": "Kosovë-1", "facts": ["Vetëm një fakt"]}])):
            self.assertEqual(sheets.build_fact_sheets([lead(1)], Path(folder)), {})

    def test_a_failed_chunk_costs_only_its_own_leads(self):
        leads = [lead(n) for n in range(sheets.CHUNK + 1)]
        good = ["Fakt i parë", "Fakt i dytë", "Fakt i tretë", "Fakt i katërt"]
        def answer(command, **_):
            brief = re.findall(r"## pair_id: (\S+)", Path(command[-1].split("Read ", 1)[1].split(". ", 1)[0]).read_text(encoding="utf-8"))
            if len(brief) > 1:
                raise sheets.subprocess.TimeoutExpired(command, 360)
            return reply([{"pair_id": brief[0], "facts": good}])
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets.subprocess, "run", side_effect=answer):
            self.assertEqual(list(sheets.build_fact_sheets(leads, Path(folder))), [f"Kosovë-{sheets.CHUNK}"])


if __name__ == "__main__":
    unittest.main()
