import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from io import BytesIO
from PIL import Image

import news_image_policy as policy


def plan():
    return {"subject": "Apple Park", "subject_evidence": "Apple", "queries": ["Apple Park"],
            "caption": "Selia e Apple në Kaliforni."}


def page(license_name="CC BY-SA 4.0"):
    return {"title": "File:Apple Park.jpg", "imageinfo": [{
        "url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Apple_Park.jpg",
        "descriptionurl": "https://commons.wikimedia.org/wiki/File:Apple_Park.jpg",
        "extmetadata": {"LicenseShortName": {"value": license_name},
                        "LicenseUrl": {"value": policy.LICENSES.get(license_name, "")},
                        "Artist": {"value": "<a>Jane Photographer</a>"},
                        "Copyrighted": {"value": "True"},
                        "ImageDescription": {"value": "Apple Park in Cupertino"}}
    }]}


class NewsPhotoTests(unittest.TestCase):
    def test_single_word_named_subject_is_grounded_and_invented_evidence_fails(self):
        leads = [{"pair_id": "one", "title": "OpenAI releases a model", "primary_evidence": {"text": "OpenAI announced a new release."}}]
        rows = [{"pair_id": "one", "subject": "OpenAI", "subject_evidence": "OpenAI", "queries": ["OpenAI office"], "caption": "Zyra e OpenAI."}]
        with tempfile.TemporaryDirectory() as folder, patch.object(policy.subprocess, "run") as model:
            model.return_value = SimpleNamespace(returncode=0, stdout="383_JSON_BEGIN" + json.dumps(rows) + "383_JSON_END")
            self.assertIn("one", policy.plan_subjects(leads, Path(folder)))
            command = model.call_args.args[0]
            self.assertIn("openai-codex", command)
            self.assertIn("gpt-6-luna", command)
            rows[0]["subject_evidence"] = "Invented evidence"
            model.return_value.stdout = "383_JSON_BEGIN" + json.dumps(rows) + "383_JSON_END"
            self.assertEqual(policy.plan_subjects(leads, Path(folder)), {})

    def test_photo_connection_uses_validated_ip_and_original_tls_hostname(self):
        payload = BytesIO()
        Image.new("RGB", (1200, 630), "red").save(payload, format="JPEG")
        with patch("read_news_source.check_public", return_value="203.0.113.10"), patch.object(policy.urllib3, "HTTPSConnectionPool") as connection:
            connection.return_value.urlopen.return_value = SimpleNamespace(status=200, read=lambda count: payload.getvalue(), close=lambda: None)
            self.assertEqual(policy.photo_fingerprint("https://publisher.example/photo.jpg")[:2], (1200, 630))
            self.assertEqual(connection.call_args.args[0], "203.0.113.10")
            self.assertEqual(connection.call_args.kwargs["server_hostname"], "publisher.example")
            self.assertEqual(connection.return_value.urlopen.call_args.kwargs["headers"]["Host"], "publisher.example")

    def test_license_creator_and_story_context_are_preserved(self):
        photo = policy.candidate_photo(page(), plan())
        self.assertEqual(photo["image_rights"]["creator"], "Jane Photographer")
        self.assertEqual(photo["image_rights"]["license"], "CC BY-SA 4.0")
        self.assertEqual(photo["image_subject"], "Apple Park")

    def test_unlicensed_nc_nd_missing_credit_and_unrelated_photos_fail(self):
        for license_name in ("", "Fair use", "CC BY-NC 4.0", "CC BY-ND 4.0"):
            self.assertIsNone(policy.candidate_photo(page(license_name), plan()))
        candidate = page()
        candidate["imageinfo"][0]["extmetadata"].pop("Artist")
        self.assertIsNone(policy.candidate_photo(candidate, plan()))
        self.assertIsNone(policy.candidate_photo(page(), {**plan(), "subject": "Microsoft headquarters"}))

    def test_public_domain_requires_explicit_status_and_no_extra_restrictions(self):
        candidate = page("Public domain")
        self.assertIsNone(policy.candidate_photo(candidate, plan()))
        candidate["imageinfo"][0]["extmetadata"]["Copyrighted"]["value"] = "False"
        self.assertIsNotNone(policy.candidate_photo(candidate, plan()))
        candidate["imageinfo"][0]["extmetadata"]["Restrictions"] = {"value": "Personality rights"}
        self.assertIsNone(policy.candidate_photo(candidate, plan()))

    def test_same_photo_at_another_url_is_rejected_but_different_photo_is_kept(self):
        lead = {"photo_plan": plan()}
        evidence = {"image_url": "https://publisher.example/copied.jpg"}
        with patch.object(policy, "commons_candidates", return_value=[page()]), patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "identical", 0)):
            self.assertEqual(policy.select_photo(lead, evidence, {}), {})
        with patch.object(policy, "commons_candidates", return_value=[page()]), patch.object(policy, "photo_fingerprint", side_effect=[(1600, 900, "source", 0), (1600, 900, "different", (1 << 256) - 1)]):
            photo = policy.select_photo(lead, evidence, {})
            self.assertTrue(photo["image_rights"]["distinct_from_source"])

    def test_already_reserved_photo_does_not_repeat_in_the_run(self):
        with patch.object(policy, "commons_candidates", return_value=[page()]), patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "photo", 255)):
            self.assertEqual(policy.select_photo({"photo_plan": plan(), "_reserve_photo": lambda url: False}, {}, {}), {})

    def test_expired_research_budget_does_not_start_more_network_requests(self):
        with patch.object(policy, "commons_candidates") as search, patch.object(policy, "photo_fingerprint") as fetch:
            self.assertEqual(policy.select_photo({"photo_plan": plan(), "_photo_deadline": 0}, {}, {}), {})
            search.assert_not_called()
            fetch.assert_not_called()

    def test_source_photo_failure_cannot_enable_an_unchecked_replacement(self):
        with patch.object(policy, "photo_fingerprint", side_effect=ValueError("unavailable")), patch.object(policy, "commons_candidates") as search:
            self.assertEqual(policy.select_photo({"photo_plan": plan()}, {"image_url": "https://publisher.example/photo.jpg"}, {}), {})
            search.assert_not_called()

    def test_commons_thumbnail_and_original_have_same_identity(self):
        original = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Apple_Park.jpg"
        thumb = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Apple_Park.jpg/1600px-Apple_Park.jpg"
        self.assertEqual(policy.image_identity(original), policy.image_identity(thumb))
        self.assertEqual(policy.image_identity(original), policy.image_identity(thumb.replace("upload.wikimedia.org", "thumb.wikimedia.org")))

    def test_provenance_cannot_be_self_declared_altered_or_stale(self):
        photo = policy.candidate_photo(page(), plan())
        article = {"url": "https://techcrunch.com/story", **photo}
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, "CATALOG", Path(folder) / "catalog.json"):
            self.assertTrue(policy.image_errors(article))
            policy.CATALOG.write_text(json.dumps({article["url"]: photo}), encoding="utf-8")
            self.assertEqual(policy.image_errors(article), [])
            self.assertTrue(policy.image_errors({**article, "image_subject": "Invented subject"}))
            photo["image_rights"]["verified_at"] = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
            policy.CATALOG.write_text(json.dumps({article["url"]: photo}), encoding="utf-8")
            self.assertTrue(policy.image_errors(article))


if __name__ == "__main__":
    unittest.main()
