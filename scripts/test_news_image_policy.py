import json
import os
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
    def test_normalizer_restores_prepared_photo_without_fetching_model_url(self):
        from codex_automation_support import normalize_batch
        photo = {**policy.candidate_photo(page(), plan()), "image_width": 1920, "image_height": 1280}
        draft = {"url": "https://techcrunch.com/story", "slug": "qa-original-article", "title": "Apple hap zyrën",
                 "category": "Teknologji", "body": "<p>Fakte të verifikuara.</p>",
                 "image_url": "https://publisher.example/copied.jpg"}
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, "CATALOG", Path(folder) / "catalog.json"), patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}):
            policy.CATALOG.write_text(json.dumps({draft["url"]: photo}), encoding="utf-8")
            batch = Path(folder) / "2026-10-11T22.json"
            batch.write_text(json.dumps([draft]), encoding="utf-8")
            with patch("codex_automation_support._fetch_image_dimensions", return_value=(1920, 1280)) as decoder:
                rows = normalize_batch(batch)
                self.assertEqual(rows[0]["image_url"], photo["image_url"])
                self.assertEqual(rows[0]["image_rights"], photo["image_rights"])
                decoder.assert_called_once_with(photo["image_url"])

    def test_single_word_named_subject_is_grounded_and_invented_evidence_fails(self):
        leads = [{"pair_id": "one", "title": "OpenAI releases a model", "primary_evidence": {"text": "OpenAI announced a new release."}}]
        rows = [{"pair_id": "one", "subject": "OpenAI", "subject_evidence": "OpenAI", "queries": ["OpenAI office"], "caption": "Zyra e OpenAI."}]
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, "wiki_plan", return_value=None), patch.object(policy.subprocess, "run") as model:
            model.return_value = SimpleNamespace(returncode=0, stdout="383_JSON_BEGIN" + json.dumps(rows) + "383_JSON_END")
            self.assertIn("one", policy.plan_subjects(leads, Path(folder)))
            command = model.call_args.args[0]
            self.assertIn("openai-codex", command)
            self.assertIn("gpt-6-luna", command)
            rows[0]["subject_evidence"] = "Invented evidence"
            model.return_value.stdout = "383_JSON_BEGIN" + json.dumps(rows) + "383_JSON_END"
            self.assertEqual(policy.plan_subjects(leads, Path(folder)), {})

    def test_a_timed_out_planner_chunk_costs_only_its_own_leads(self):
        leads = [{"pair_id": f"lead-{n}", "title": f"OpenAI story {n}", "primary_evidence": {"text": "OpenAI announced a new release."}}
                 for n in range(policy.PLAN_CHUNK + 1)]
        def answer(command, **_):
            brief = json.loads(Path(command[-1].split("Read ", 1)[1].split(". ", 1)[0]).read_text(encoding="utf-8"))
            if len(brief) > 1:
                raise policy.subprocess.TimeoutExpired(command, 240)
            rows = [{"pair_id": brief[0]["pair_id"], "subject": "OpenAI", "subject_evidence": "OpenAI",
                     "queries": ["OpenAI office"], "caption": "Zyra e OpenAI."}]
            return SimpleNamespace(returncode=0, stdout="383_JSON_BEGIN" + json.dumps(rows) + "383_JSON_END")
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, "wiki_plan", return_value=None), patch.object(policy.subprocess, "run", side_effect=answer):
            plans = policy.plan_subjects(leads, Path(folder))
            self.assertEqual(list(plans), [f"lead-{policy.PLAN_CHUNK}"])
            self.assertTrue((Path(folder) / "news-photo-plan.json").exists())

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

    def test_recent_reviewed_wide_photo_outranks_the_first_search_hit(self):
        def ranked(title, year, categories="", size=(1600, 1000)):
            entry = page()
            entry["title"] = f"File:{title}.jpg"
            info = entry["imageinfo"][0]
            info.update(url=f"https://upload.wikimedia.org/wikipedia/commons/a/ab/{title}.jpg",
                        descriptionurl=f"https://commons.wikimedia.org/wiki/File:{title}.jpg", width=size[0], height=size[1])
            info["extmetadata"].update(DateTimeOriginal={"value": f"{year}-05-01"}, Categories={"value": categories})
            return entry
        now = datetime(2026, 10, 12, tzinfo=timezone.utc)
        old_scan = ranked("Apple Park old", 1998, size=(900, 1400))
        fresh = ranked("Apple Park fresh", 2025, "Quality images|Apple Park")
        self.assertGreater(policy.hook_score(fresh, now), policy.hook_score(old_scan, now))
        with patch.object(policy, "commons_candidates", return_value=[old_scan, fresh]), \
                patch.object(policy, "photo_fingerprint", return_value=(1600, 1000, "photo", 255)):
            self.assertIn("fresh", policy.select_photo({"photo_plan": plan()}, {}, {})["image_url"])

    def test_already_reserved_photo_does_not_repeat_in_the_run(self):
        with patch.object(policy, "commons_candidates", return_value=[page()]), patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "photo", 255)):
            self.assertEqual(policy.select_photo({"photo_plan": plan(), "_reserve_photo": lambda url: False}, {}, {}), {})

    def test_expired_research_budget_does_not_start_more_network_requests(self):
        with patch.object(policy, "commons_candidates") as search, patch.object(policy, "photo_fingerprint") as fetch:
            self.assertEqual(policy.select_photo({"photo_plan": plan(), "_photo_deadline": 0}, {}, {}), {})
            search.assert_not_called()
            fetch.assert_not_called()

    def test_unreadable_source_image_does_not_cost_the_story_its_licensed_photo(self):
        def fingerprint(url):
            if "publisher.example" in url:
                raise ValueError("refused")
            return (1600, 900, "licensed", 255)
        with patch.object(policy, "photo_fingerprint", side_effect=fingerprint), patch.object(policy, "commons_candidates", return_value=[page()]):
            photo = policy.select_photo({"photo_plan": plan()}, {"image_url": "https://publisher.example/photo.jpg"}, {})
            self.assertEqual(photo["image_rights"]["provider"], "wikimedia-commons")
        # The same file at the publisher's own URL is still refused by identity.
        same = page()
        same["imageinfo"][0]["url"] = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Apple_Park.jpg"
        with patch.object(policy, "photo_fingerprint", side_effect=fingerprint), patch.object(policy, "commons_candidates", return_value=[same]):
            self.assertEqual(policy.select_photo({"photo_plan": plan()}, {"image_url": same["imageinfo"][0]["url"]}, {}), {})

    def test_story_names_skip_sentence_openers_and_rank_by_mentions(self):
        names = policy.story_names("Failure to fit tags left offenders unmonitored in England",
                                   "Kelly Osbourne spoke. The Ministry said Kelly Osbourne was right, as Kelly Osbourne knew. Footage shows England.")
        self.assertEqual(names, ["England", "Kelly Osbourne"])  # the headline's subject first
        swift = policy.story_names("Taylor Swift Spends Her 100th Week at No. 1",
                                   "Taylor Swift broke a record held by The Beatles. The Beatles had 99 weeks. Kelly said.")
        self.assertEqual(swift[0], "Taylor Swift")

    def test_wikipedia_plan_needs_the_page_named_in_the_story_and_a_free_lead_photo(self):
        def wiki(url, params, **_):
            pages = {"1": {"index": 1, "title": "Kelly Osbourne", "pageimage": "Kelly_Osbourne_2010.jpg"},
                     "2": {"index": 2, "title": "Ozzy Osbourne", "pageimage": "Ozzy.jpg"}}
            if params["gsrsearch"] == "Paris Hilton":
                pages = {"1": {"index": 1, "title": "Paris", "pageimage": "Paris.jpg"}}
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"query": {"pages": pages}})
        lead = {"title": "Kelly Osbourne says she gained weight", "category": "Showbiz", "primary_evidence": {"text": "The singer Kelly Osbourne spoke."}}
        with patch.object(policy.requests, "get", side_effect=wiki) as get:
            plan_row = policy.wiki_plan(lead)
            self.assertEqual((plan_row["subject"], plan_row["files"]), ("Kelly Osbourne", ["Kelly_Osbourne_2010.jpg"]))
            self.assertEqual(get.call_args.kwargs["params"]["pilicense"], "free")
            # A namesake page that does not cover the whole name is refused.
            self.assertIsNone(policy.wiki_plan({**lead, "title": "Paris Hilton speaks",
                                                "primary_evidence": {"text": "Then Paris Hilton spoke."}}))

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
            wrong_image = {**article, "image_url": "https://publisher.example/photo.jpg"}
            self.assertIsNone(policy.trusted_photo(wrong_image))
            self.assertEqual(policy.trusted_photo(wrong_image, require_image_match=False), photo)
            self.assertTrue(policy.image_errors({**article, "image_subject": "Invented subject"}))
            photo["image_rights"]["verified_at"] = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
            policy.CATALOG.write_text(json.dumps({article["url"]: photo}), encoding="utf-8")
            self.assertTrue(policy.image_errors(article))


if __name__ == "__main__":
    unittest.main()
