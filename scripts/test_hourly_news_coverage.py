import os as _os
_os.environ["L383_GEMINI_KEY"] = ""  # never the real Gemini API in tests
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cloud_news_discovery import select_hourly_leads
from editorial_rules_v2 import independent_source_error, article_errors, title_errors
from news_source_policy import CATEGORIES, hourly_targets, topic_error, needs_corroboration
from news_coverage import balance, deficits, replacement_plan
from prepare_editor_sources import coverage_plan, discovery, fetch, ready_image


class HourlyCoverageTests(unittest.TestCase):
    def test_invalid_discovery_slugs_are_repaired_before_editing(self):
        from codex_automation_support import normalize_batch
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}), patch("news_image_policy.trusted_photo", return_value={"image_subject": "Verified subject"}):
            batch = Path(folder) / "2026-10-11T22.json"
            rows = [{"url": f"https://techcrunch.com/story-{index}", "slug": slug,
                     "title": "Apple hap zyrën në Kaliforni", "category": "Teknologji", "body": "<p>Fakte të verifikuara.</p>"}
                    for index, slug in enumerate(("Botë-02", "", "x" * 140))]
            batch.write_text(json.dumps(rows), encoding="utf-8")
            normalized = normalize_batch(batch)
            self.assertEqual(len({row["slug"] for row in normalized}), 3)
            for row in normalized:
                self.assertRegex(row["slug"], r"^[a-z0-9-]{8,120}$")
                self.assertTrue(row["slug"].startswith("apple-hap-zyren-ne-kaliforni-"))
            self.assertEqual([row["slug"] for row in normalize_batch(batch)], [row["slug"] for row in normalized])

    def test_hourly_identity_survives_tracker_changes_and_avoids_ordinal_collisions(self):
        from codex_automation_support import normalize_batch
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}), patch("news_image_policy.trusted_photo", return_value={"image_subject": "Verified subject"}):
            batch = Path(folder) / "2026-10-08T14.json"
            rows = [{"id": "Botë-26", "url": url, "slug": "kievi-robërit-luftes", "category": "Botë", "body": "<p>Original report.</p>"}
                    for url in ("https://bbc.com/story-one?utm_source=test", "https://bbc.com/story-two")]
            batch.write_text(json.dumps(rows), encoding="utf-8")
            normalized = normalize_batch(batch)
            self.assertNotEqual(normalized[0]["id"], normalized[1]["id"])
            self.assertEqual(normalized[0]["slug"], "kievi-roberit-luftes")
            first_id = normalized[0]["id"]
            normalized[0]["url"] = "https://www.bbc.com/story-one/"
            batch.write_text(json.dumps(normalized), encoding="utf-8")
            self.assertEqual(normalize_batch(batch)[0]["id"], first_id)

    def test_hourly_image_selection_never_uses_publisher_fallback(self):
        evidence = {"image_url": "https://euronews.al/wp-content/uploads/story.jpg"}
        with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}), patch("news_image_policy.photo_options", return_value=[]) as selector,                 patch("news_gallery_photos.gallery_options", return_value=[]) as gallery, patch("news_press_photos.press_options", return_value=[]),                 patch("news_video_policy.video_options", return_value=[]) as video,                 patch("codex_automation_support._fetch_image_dimensions", side_effect=AssertionError("publisher fallback must not run")):
            self.assertEqual(ready_image({"title": "A verified story"}, evidence, {}), {})
            # Recent visuals, then the dated archive photo of the person, then of the topic.
            self.assertEqual([call.args[3] for call in selector.call_args_list], ["fresh", "older", "place"])
            gallery.assert_called_once()
            video.assert_called_once()

    def test_the_photo_editor_order_wins_and_an_empty_verdict_means_no_photo(self):
        options = [{"tier": "fresh", "name": "a"}, {"tier": "video", "name": "b"}, {"tier": "older", "name": "c"}]
        def photo(lead, option):
            return {"image_url": option["name"]}
        with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}), patch("news_image_policy.finalize_photo", side_effect=photo),                 patch("news_video_policy.finalize_video", side_effect=photo):
            self.assertEqual(ready_image({"_visual_options": options}, {}, {})["image_url"], "a")
            self.assertEqual(ready_image({"_visual_options": options, "_visual_choice": [2, 0]}, {}, {})["image_url"], "c")
            self.assertEqual(ready_image({"_visual_options": options, "_visual_choice": []}, {}, {}), {})

    def test_replacements_never_hide_short_desks_with_extra_world_stories(self):
        approved = [{"category": category, "url": f"https://example.com/{index}"}
                    for index, category in enumerate(CATEGORIES)]
        attempted = [row["url"] for row in approved]
        ready = approved + [{"category": "Botë", "url": f"https://bbc.com/new-{i}"} for i in range(25)]
        plan = replacement_plan(approved, ready, attempted)
        self.assertEqual(sum(plan.values()), 9)
        self.assertTrue(all(plan[category] >= 1 for category in CATEGORIES))
        self.assertEqual(plan["Botë"], 3)
        approved = [{"category": category, "url": f"https://example.com/approved-{i}"}
                    for i, category in enumerate(["Botë"] * 3 + ["Sport"] * 3 + ["Shqipëri", "Teknologji", "Ekonomi", "Showbiz"])]
        ready = [{"category": category, "url": f"https://example.com/new-{category}-{i}"}
                 for category in CATEGORIES if category != "Kosovë" for i in range(20)]
        plan = replacement_plan(approved, ready, [row["url"] for row in approved])
        self.assertEqual(sum(plan.values()), 18)
        self.assertEqual(plan["Botë"], 3)
        self.assertGreaterEqual(plan["Sport"], 3)

    def test_hourly_titles_accept_new_entities_and_real_albanian_verbs(self):
        with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}):
            for title in ("PepsiCo ul parashikimin e fitimit për 2026", "Britney Spears viziton Dollywood me djemtë", "Greqia propozon taksë mbi kriptovalutat"):
                self.assertEqual(title_errors({"title": title, "category": "Botë"}), [])
        self.assertFalse(needs_corroboration({"title": "Microsoft pretendon se kompjuteri është më i shpejtë"}))
        self.assertTrue(needs_corroboration({"title": "Pretendime për korrupsion ndaj ministrit"}))
        self.assertFalse(needs_corroboration({"title": "Fury synon kurorën e padiskutueshme"}))
        self.assertTrue(needs_corroboration({"title": "Gjykata pranon padinë ndaj kompanisë"}))
        self.assertTrue(needs_corroboration({"title": "Kompania paditi ish-drejtorin"}))

    def test_prepared_evidence_avoids_a_second_transient_source_fetch(self):
        url = "https://techcrunch.com/story"
        evidence = {"status": "text_extracted", "url": url, "text": "Original source text"}
        with patch("prepare_editor_sources.fetch_url", side_effect=AssertionError("unexpected refetch")):
            result = fetch({"url": url, "slug": "story"}, {url: evidence})
        self.assertEqual(result["evidence"], evidence)

    def test_routine_stories_are_not_lost_without_matching_headlines(self):
        leads = [{"category": "Teknologji", "url": "https://techcrunch.com/one", "title": "OpenAI releases a new model"},
                 {"category": "Teknologji", "url": "https://therundown.ai/two", "title": "Apple unveils a security camera"}]
        ready = select_hourly_leads(leads)
        self.assertEqual(len(ready), 2)
        self.assertTrue(all(not lead["corroborates_url"] for lead in ready))
        self.assertEqual(len(select_hourly_leads(leads, {leads[0]["url"]})), 1)

    def test_publishers_that_block_the_server_take_no_slots(self):
        leads = [{"category": "Sport", "url": "https://www.motorsport.com/f1/news/one/1", "title": "Verstappen hits back at critics"},
                 {"category": "Sport", "url": "https://www.skysports.com/football/news/two", "title": "Arsenal beat Lille in Paris"}]
        self.assertEqual([lead["url"] for lead in select_hourly_leads(leads)], ["https://www.skysports.com/football/news/two"])

    def test_distinct_numbered_events_are_not_collapsed(self):
        leads = [{"category": "Teknologji", "url": f"https://techcrunch.com/model-{i}",
                  "title": f"OpenAI releases agent model {i:03d}"} for i in range(20)]
        self.assertEqual(len(select_hourly_leads(leads)), 20)

    def test_plan_reserves_all_seven_desks_before_redistributing(self):
        leads = [{"category": category} for category in CATEGORIES for _ in range(30)]
        self.assertEqual(coverage_plan(leads), hourly_targets())
        self.assertEqual(sum(coverage_plan(leads).values()), 20)
        sparse = [{"category": category} for category in CATEGORIES] + [{"category": "Botë"}] * 30
        plan = coverage_plan(sparse)
        self.assertEqual(sum(plan.values()), 9)
        self.assertTrue(all(plan[category] >= 1 for category in CATEGORIES))
        self.assertTrue(all(plan[category] <= 3 for category in CATEGORIES))

    def test_excess_world_drafts_cannot_displace_other_desks(self):
        plan = hourly_targets()
        articles = [{"category": "Botë"}] * 20 + [{"category": category} for category in CATEGORIES]
        result = balance(articles, plan)
        self.assertEqual(sum(item["category"] == "Botë" for item in result), plan["Botë"])
        self.assertTrue(all(any(item["category"] == category for item in result) for category in CATEGORIES))
        self.assertGreater(deficits(result, plan)["Teknologji"], 0)

    def test_sensitive_single_source_is_rejected_but_routine_is_allowed(self):
        with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}):
            routine = {"url": "https://techcrunch.com/model", "title": "OpenAI publikon modelin e ri"}
            self.assertIsNone(independent_source_error(routine))
            allegation = {"url": "https://koha.net/tender", "title": "Prishtinë: akuza për tenderin"}
            self.assertIsNotNone(independent_source_error(allegation))
            allegation["corroborating_sources"] = [{"url": "https://telegrafi.com/tender"}]
            self.assertIsNone(independent_source_error(allegation))
        with patch.dict(os.environ, {"L383_HOURLY_NEWS": "0"}):
            self.assertIsNotNone(independent_source_error(routine))

    def test_neutral_ranking_is_not_confused_with_source_verification(self):
        article = {"category": "Teknologji", "url": "https://techcrunch.com/model",
                   "title": "OpenAI publikon modelin e ri", "score_breakdown": {"relevance": 5},
                   "corroborating_sources": [{"url": "https://therundown.ai/model"}]}
        with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}):
            self.assertEqual(article_errors(article), [])
        with patch.dict(os.environ, {"L383_HOURLY_NEWS": "0"}):
            self.assertTrue(any("relevance score" in message for message in article_errors(article)))
        self.assertIsNone(topic_error("Ekonomi", "Samsung parashikon 80.2 mld dollarë fitim operativ rekord"))

    def test_inventory_filters_unreadable_sensitive_and_missing_images(self):
        leads = [{"category": "Teknologji", "source": "TechCrunch", "url": f"https://techcrunch.com/{slug}",
                  "title": title, "pair_id": slug} for slug, title in
                 [("good", "OpenAI releases a model"), ("blocked", "Apple releases camera"),
                  ("sensitive", "Microsoft faces fraud allegations"), ("no-image", "Google releases model"),
                  ("wrong-topic", "Nasdaq stocks and crypto markets surge")]]
        leads.append({"category": "Kosovë", "source": "Telegrafi", "url": "https://telegrafi.com/ffk-orari",
                      "title": "Kosovë: FFK publikon orarin e ndeshjeve të Superligës", "pair_id": "wrong-sports-lane"})
        def fetch(url):
            return {"status": "unavailable" if url.endswith("blocked") else "text_extracted", "url": url,
                    "text": "Original reporting text", "image_url": "https://cdn.example/photo.jpg"}
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "discovery.md"
            path.write_text("# Discovery", encoding="utf-8")
            path.with_suffix(".json").write_text(json.dumps({"leads": leads}), encoding="utf-8")
            with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}), patch("news_image_policy.plan_subjects", return_value={}), patch("news_image_policy.CATALOG", Path(folder) / "image-provenance.json"), patch("prepare_editor_sources.fetch_url", side_effect=fetch), patch("prepare_editor_sources.visual_options", return_value=[]), patch("news_fact_sheets.build_fact_sheets", return_value={}), \
                 patch("prepare_editor_sources.ready_image", side_effect=lambda lead, *_: {} if lead["pair_id"] == "no-image" else
                       {"image_url": "https://cdn.example/photo.jpg", "image_width": 1200, "image_height": 675}):
                discovery(path)
            data = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
            # No photo of today's events: the story is dropped (owner, 2026-10-17 evening).
            self.assertEqual([lead["pair_id"] for lead in data["ready_leads"]], ["good"])
            self.assertEqual(data["rejected_inventory"]["Teknologji"],
                             {"unreadable": 1, "needs_corroboration": 1, "topic_mismatch": 1, "rejected_twice": 0,
                              "no_fresh_photo": 1})
            self.assertEqual(data["rejected_inventory"]["Kosovë"]["topic_mismatch"], 1)


if __name__ == "__main__":
    unittest.main()
