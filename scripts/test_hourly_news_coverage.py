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
    def test_native_open_graph_image_is_accepted_for_hourly_without_upscaling(self):
        evidence = {"image_url": "https://euronews.al/wp-content/uploads/story.jpg"}
        with patch("codex_automation_support._fetch_image_dimensions", return_value=(1200, 630)), patch("codex_automation_support._larger_image_candidates", return_value=[]):
            with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}):
                self.assertEqual(ready_image({}, evidence, {})["image_height"], 630)
            with patch.dict(os.environ, {"L383_HOURLY_NEWS": "0"}):
                self.assertEqual(ready_image({}, evidence, {}), {})

    def test_replacements_keep_available_desks_and_reassign_exhausted_slots(self):
        approved = [{"category": category, "url": f"https://example.com/{index}"}
                    for index, category in enumerate(CATEGORIES)]
        attempted = [row["url"] for row in approved]
        ready = approved + [{"category": "Botë", "url": f"https://bbc.com/new-{i}"} for i in range(25)]
        plan = replacement_plan(approved, ready, attempted)
        self.assertEqual(sum(plan.values()), 20)
        self.assertTrue(all(plan[category] >= 1 for category in CATEGORIES))
        self.assertEqual(plan["Botë"], 14)

    def test_hourly_titles_accept_new_entities_and_real_albanian_verbs(self):
        with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}):
            for title in ("PepsiCo ul parashikimin e fitimit për 2026", "Britney Spears viziton Dollywood me djemtë", "Greqia propozon taksë mbi kriptovalutat"):
                self.assertEqual(title_errors({"title": title, "category": "Botë"}), [])
        self.assertFalse(needs_corroboration({"title": "Microsoft pretendon se kompjuteri është më i shpejtë"}))
        self.assertTrue(needs_corroboration({"title": "Pretendime për korrupsion ndaj ministrit"}))

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
        self.assertEqual(sum(plan.values()), 20)
        self.assertTrue(all(plan[category] >= 1 for category in CATEGORIES))

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
                  ("sensitive", "Microsoft faces fraud allegations"), ("no-image", "Google releases model")]]
        def fetch(url):
            return {"status": "unavailable" if url.endswith("blocked") else "text_extracted", "url": url,
                    "text": "Original reporting text", "image_url": "https://cdn.example/photo.jpg"}
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "discovery.md"
            path.write_text("# Discovery", encoding="utf-8")
            path.with_suffix(".json").write_text(json.dumps({"leads": leads}), encoding="utf-8")
            with patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}), patch("prepare_editor_sources.fetch_url", side_effect=fetch), \
                 patch("prepare_editor_sources.ready_image", side_effect=lambda lead, *_: {} if lead["pair_id"] == "no-image" else
                       {"image_url": "https://cdn.example/photo.jpg", "image_width": 1200, "image_height": 675}):
                discovery(path)
            data = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
            self.assertEqual([lead["pair_id"] for lead in data["ready_leads"]], ["good"])
            self.assertEqual(data["rejected_inventory"]["Teknologji"],
                             {"unreadable": 1, "needs_corroboration": 1, "image_unavailable": 1})


if __name__ == "__main__":
    unittest.main()
