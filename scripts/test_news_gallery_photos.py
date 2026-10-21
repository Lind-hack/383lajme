import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import news_gallery_photos as gallery


def photo(title, days=0, license="4", **extra):
    day = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d 10:00:00")
    return {"id": "54001", "title": title, "description": {"_content": ""}, "tags": "", "license": license,
            "datetaken": day, "ownername": "European Parliament", "pathalias": "europeanparliament",
            "url_k": "https://live.staticflickr.com/65535/54001_k.jpg", "institution": "European Parliament", **extra}


LEAD = {"title": "Metsola meets Kurti in Strasbourg", "pair_id": "Botë-01",
        "photo_plan": {"subject": "Roberta Metsola", "caption": "Roberta Metsola", "subject_evidence": "named in lead",
                       "kind": "person", "qid": "Q1"}}


class GalleryPhotoTests(unittest.TestCase):
    def options(self, photos):
        with patch.object(gallery, "streams", return_value={"europeanparliament": photos}):
            return gallery.gallery_options(LEAD)

    def test_todays_photo_naming_the_person_is_offered_with_its_credit(self):
        found = self.options([photo("Roberta Metsola, EP President, at the plenary")])
        self.assertEqual(len(found), 1)
        rights = found[0]["photo"]["image_rights"]
        self.assertEqual((rights["provider"], rights["license"], rights["creator"]),
                         ("flickr-official", "CC BY 2.0", "European Parliament"))
        self.assertEqual(rights["source_page"], "https://www.flickr.com/photos/europeanparliament/54001/")
        self.assertEqual(found[0]["tier"], "fresh")

    def test_old_unnamed_or_foreign_host_photos_are_not_offered(self):
        self.assertEqual(self.options([photo("Roberta Metsola at the plenary", days=5)]), [])
        self.assertEqual(self.options([photo("Plenary session in Strasbourg")]), [])
        self.assertEqual(self.options([photo("Roberta Metsola", url_k="https://example.com/x.jpg")]), [])

    def test_only_free_licences_survive_the_stream_fetch(self):
        self.assertNotIn("2", gallery.FLICKR_LICENSES)  # CC BY-NC
        self.assertNotIn("6", gallery.FLICKR_LICENSES)  # CC BY-ND
        self.assertNotIn("7", gallery.FLICKR_LICENSES)  # "no known restrictions" is not a licence
        self.assertTrue(set(gallery.FLICKR_LICENSES.values()) <= set(gallery.LICENSES))

    def test_no_key_means_no_streams_and_no_calls(self):
        with patch.object(gallery, "_STREAMS", None), patch.object(gallery, "api_key", return_value=""), \
             patch.object(gallery, "_call", side_effect=AssertionError("no call without a key")):
            self.assertEqual(gallery.streams(), {})


if __name__ == "__main__":
    unittest.main()
