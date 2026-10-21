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
    def test_no_high_override_is_required_for_max_effort_model_notes(self):
        facts = ["Këshilli votoi të martën", "Ura mbyllet për riparime", "Punimet mbarojnë në mars", "Kryetari foli pas seancës"]
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows", return_value=[{"pair_id": "Kosovë-1", "facts": facts}]) as model:
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
                                                                   return_value=[{"pair_id": "Kosovë-1", "facts": facts}]):
            paths = sheets.build_fact_sheets([lead(1)], Path(folder))
            kept = json.loads(paths["Kosovë-1"].read_text(encoding="utf-8"))["facts"]
        self.assertEqual(len(kept), 4)
        self.assertNotIn(facts[-1], kept)

    def test_too_few_clean_notes_leave_the_story_without_a_sheet(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(sheets, "ask_rows",
                                                                   return_value=[{"pair_id": "Kosovë-1", "facts": ["Vetëm një fakt"]}]):
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
