import os as _os
_os.environ["L383_GEMINI_KEY"] = ""  # never the real Gemini API in tests
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import news_photo_editor as editor


def option(tier, title):
    if tier == "video":
        return {"tier": "video", "name": "X", "video": {"published": "2026-10-16T10:00:00+00:00", "channel": "Gov", "title": title}}
    return {"tier": tier, "page": {"title": f"File:{title}.jpg", "imageinfo": [{"extmetadata": {}}]},
            "photo": {"image_rights": {"taken": "2026-10-15"}}}


def story(pair_id, count=3):
    return {"pair_id": pair_id, "title": "KFOR merr komandën", "text": "Koloneli amerikan merr komandën.",
            "options": [option("fresh", f"photo {n}") for n in range(count)]}


class PhotoEditorTests(unittest.TestCase):
    def test_picks_are_kept_in_order_and_invented_numbers_ignored(self):
        answer = [{"pair_id": "a", "picks": [3, 1, 3, 9, "2"]}, {"pair_id": "b", "picks": []}, {"pair_id": "ghost", "picks": [1]}]
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"WRITER_EFFORT_FLAG": "--ignore-user-config"}), \
                patch.object(editor, "ask_rows", return_value=answer) as model:
            picks = editor.choose([story("a"), story("b")], Path(folder))
            self.assertNotIn("--ignore-user-config", model.call_args.args[2])
            self.assertIsNotNone(model.call_args.kwargs["deadline"])
            brief = (Path(folder) / "news-photo-editor-0.md").read_text(encoding="utf-8")
        self.assertEqual(picks, {"a": [2, 0], "b": []})
        self.assertIn("[fresh] photo, taken 2026-10-15: photo 0", brief)

    def test_max_effort_without_high_override_still_gets_photo_judgment(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"WRITER_EFFORT_FLAG": ""}), patch.object(editor, "ask_rows", return_value=[{"pair_id": "a", "picks": [1]}]):
            self.assertEqual(editor.choose([story("a")], Path(folder)), {"a": [0]})

    def test_a_failed_chunk_leaves_its_stories_undecided(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"WRITER_EFFORT_FLAG": "--ignore-user-config"}), \
                patch.object(editor, "ask_rows", side_effect=editor.subprocess.TimeoutExpired("hermes", 240)):
            self.assertEqual(editor.choose([story("a")], Path(folder)), {})

    def test_trimmed_keeps_the_best_few_of_each_tier(self):
        options = [option("fresh", str(n)) for n in range(5)] + [option("video", "v")] + [option("place", str(n)) for n in range(3)]
        kept = editor.trimmed(options)
        self.assertEqual([item["tier"] for item in kept], ["fresh"] * 3 + ["video", "place", "place"])


if __name__ == "__main__":
    unittest.main()
