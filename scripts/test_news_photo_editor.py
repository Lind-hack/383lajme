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
    def setUp(self):
        def contact(by_id, folder, index, deadline):
            path=folder/f'contact-{index}.jpg';path.write_bytes(b'unit fixture')
            for story in by_id.values():
                for item in story['options']:item['_visual_source_sha256']='a'*64
            return path,{key:list(range(1,len(story['options'])+1)) for key,story in by_id.items()}
        patcher=patch.object(editor,'prepare_contact',side_effect=contact)
        patcher.start();self.addCleanup(patcher.stop)
    def test_ascii_ids_and_retry_recover_only_the_missing_photo_decision(self):
        stories = [story("Teknologji-03"), story("Kosove-07")]
        responses = [[{"pair_id": "story-001", "picks": [1]}, {"pair_id": "story-OO2", "picks": [2]}],
                     [{"pair_id": "story-001", "picks": [2]}]]
        with tempfile.TemporaryDirectory() as folder, patch.object(editor, "ask_rows", side_effect=responses) as model:
            result = editor.choose(stories, Path(folder))
            brief = (Path(folder) / "news-photo-editor-0.md").read_text(encoding="utf-8")
        self.assertEqual(result, {"Teknologji-03": [0], "Kosove-07": [1]})
        self.assertEqual(model.call_count, 2)
        self.assertIn("pair_id: story-001", brief)
        self.assertNotIn("pair_id: Kosove-07", brief)

    def test_picks_are_kept_in_order_and_invented_numbers_ignored(self):
        answer = [{"pair_id": "story-001", "picks": [3, 1, 3, 9, "2"]}, {"pair_id": "story-002", "picks": []}, {"pair_id": "ghost", "picks": [1]}]
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"WRITER_EFFORT_FLAG": "--ignore-user-config"}), \
                patch.object(editor, "ask_rows", return_value=answer) as model:
            picks = editor.choose([story("a"), story("b")], Path(folder))
            self.assertNotIn("--ignore-user-config", model.call_args.args[2])
            self.assertIsNotNone(model.call_args.kwargs["deadline"])
            brief = (Path(folder) / "news-photo-editor-0.md").read_text(encoding="utf-8")
        self.assertEqual(picks, {"a": [2, 0], "b": []})
        self.assertIn("[fresh] photo, taken 2026-10-15: photo 0", brief)

    def test_max_effort_without_high_override_still_gets_photo_judgment(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"WRITER_EFFORT_FLAG": ""}), patch.object(editor, "ask_rows", return_value=[{"pair_id": "story-001", "picks": [1]}]):
            self.assertEqual(editor.choose([story("a")], Path(folder)), {"a": [0]})

    def test_a_failed_pixel_chunk_refuses_its_stories(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"WRITER_EFFORT_FLAG": "--ignore-user-config"}), \
                patch.object(editor, "ask_rows", side_effect=editor.subprocess.TimeoutExpired("hermes", 240)):
            self.assertEqual(editor.choose([story("a")], Path(folder)), {'a':[]})

    def test_trimmed_keeps_the_best_few_of_each_tier(self):
        options = [option("fresh", str(n)) for n in range(5)] + [option("video", "v")] + [option("place", str(n)) for n in range(3)]
        kept = editor.trimmed(options)
        self.assertEqual([item["tier"] for item in kept], ["fresh"] * 3 + ["video", "place", "place", "place"])


if __name__ == "__main__":
    unittest.main()
