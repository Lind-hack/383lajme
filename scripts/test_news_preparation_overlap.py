import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from news_fact_sheets import evidence_key
from prepare_editor_sources import prepare_hourly_inventory


class PreparationOverlapTests(unittest.TestCase):
    def exercise(self, warmup_fails=False):
        notes_started, images_finished = threading.Event(), threading.Event()
        lock = threading.Lock()
        finished = 0
        calls = []
        leads = [{"pair_id": name, "url": "https://techcrunch.com/" + name,
                  "title": "OpenAI announces a public model release " + name,
                  "source": "TechCrunch", "category": "Teknologji",
                  "corroborates_url": "https://therundown.ai/good" if name == "good" else ""}
                 for name in ("good", "bad", "none")]

        def fetch(url):
            return {"status": "text_extracted", "url": url,
                    "text": "OpenAI announced a model release with a documented date and public capabilities. " + url}

        def choose(*_):
            self.assertFalse(notes_started.is_set(), "reporter model work must wait for the photo editor")
            return {"good":[0],"bad":[0],"none": []}

        def notes(inputs, folder):
            calls.append(inputs)
            notes_started.set()
            self.assertTrue(images_finished.wait(3), "notes and image finalization must overlap")
            if warmup_fails and len(calls) == 1:
                raise RuntimeError("isolated optional warmup failure")
            result = {}
            for item in inputs:
                target = folder / (item["pair_id"] + ".facts.json")
                target.write_text(json.dumps({"pair_id": item["pair_id"], "facts": [
                    "OpenAI | announcement", "Model | public release", "Date | documented", "Capabilities | documented"]}), encoding="utf-8")
                result[item["pair_id"]] = target
            return result

        def image(lead, *_):
            nonlocal finished
            self.assertTrue(notes_started.wait(3), "photo downloads must not postpone all reporter calls")
            with lock:
                finished += 1
                if finished == len(leads):
                    images_finished.set()
            if lead["pair_id"] != "good":
                return {}
            return {"image_url": "https://upload.wikimedia.org/verified-photo.jpg", "image_width": 1920,
                    "image_height": 1280, "image_subject": "OpenAI"}

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            discovery = root / "discovery.md"
            discovery.write_text("# Discovery", encoding="utf-8")
            with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}), \
                    patch("prepare_editor_sources.fetch_url", side_effect=fetch), \
                    patch("news_copyright_review.cooling_down", return_value=False), \
                    patch("news_image_policy.plan_subjects", return_value={}), \
                    patch("news_image_policy.identity_cache.save"), \
                    patch("news_image_policy.CATALOG", root / "catalog.json"), \
                    patch("prepare_editor_sources.visual_options", return_value=[{"tier": "place"}]), \
                    patch("news_photo_editor.choose", side_effect=choose), \
                    patch("news_fact_sheets.build_fact_sheets", side_effect=notes), \
                    patch("prepare_editor_sources.ready_image", side_effect=image):
                prepare_hourly_inventory(discovery, {"leads": leads})
            data = json.loads(discovery.with_suffix(".json").read_text(encoding="utf-8"))
            self.assertEqual([lead["pair_id"] for lead in data["ready_leads"]], ["good"])
            self.assertEqual(data["publication_plan"]["Teknologji"], 1)
            self.assertEqual({row["pair_id"] for row in calls[0]}, {"good", "bad"})
            self.assertEqual([row["pair_id"] for row in calls[1]], ["good"])
            early_good = next(item for item in calls[0] if item["pair_id"] == "good")
            self.assertEqual(evidence_key(early_good), evidence_key(calls[1][0]))
            self.assertEqual(early_good["source_url"], "https://techcrunch.com/good")
            self.assertEqual(early_good["corroborating"], fetch("https://therundown.ai/good")["text"])

    def test_notes_overlap_only_photo_http_work_and_cannot_restore_failed_or_rejected_photos(self):
        self.exercise()

    def test_failed_warmup_falls_back_to_the_normal_source_bound_notes_step(self):
        self.exercise(warmup_fails=True)


if __name__ == "__main__":
    unittest.main()
