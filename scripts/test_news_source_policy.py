"""Cross-category and adversarial evals for the actual publication registry."""
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from news_source_policy import MANIFEST, CATEGORIES, independent, source_error, topic_error, load_manifest, article_source_errors
from news_run_state import completed, save


class SourceIsolation(unittest.TestCase):
    def test_every_registered_domain_in_every_category(self):
        for publisher in MANIFEST["publishers"]:
            for domain in publisher["domains"]:
                for category in CATEGORIES:
                    with self.subTest(domain=domain, category=category):
                        error = source_error(category, f"https://www.{domain}/news/story")
                        self.assertEqual(error is None, category == publisher["category"])

    def test_spoofed_hosts_unknown_sources_and_missing_category(self):
        for publisher in MANIFEST["publishers"]:
            domain = publisher["domains"][0]
            for url in (f"https://{domain}.evil.test/story", f"https://{domain}@evil.test/story",
                        f"https://evil.test/{domain}/story", f"file://{domain}/story"):
                self.assertIsNotNone(source_error(publisher["category"], url))
        self.assertIsNotNone(source_error("", "https://techcrunch.com/story"))

    def test_sister_outlets_are_not_independent(self):
        from editorial_rules_v2 import independent_source_error
        self.assertIsNone(independent_source_error({"url": "https://techcrunch.com/one",
            "corroborating_sources": [{"url": "https://therundown.ai/two"}]}))
        self.assertIsNotNone(independent_source_error({"url": "https://variety.com/one",
            "corroborating_sources": [{"url": "https://deadline.com/two"}]}))
        for a, b in (("balkanweb.com", "news24.al"), ("kallxo.com", "prishtinainsight.com"),
                     ("variety.com", "deadline.com"), ("bbc.com", "bbc.co.uk")):
            self.assertFalse(independent(f"https://{a}/one", f"https://{b}/two"))
        self.assertTrue(independent("https://therundown.ai/a", "https://techcrunch.com/b"))

    def test_bad_registry_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "registry.json"
            data = json.loads(json.dumps(MANIFEST))
            data["feeds"][0]["category"] = "Sport"
            path.write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                load_manifest(path)


class TopicBoundary(unittest.TestCase):
    def test_final_gate_rejects_cross_category_secondary(self):
        from editorial_rules_v2 import title_errors
        self.assertEqual(title_errors({"category": "Ekonomi", "title": "Bitcoin bie nën 84 mijë dollarë pas rritjes së naftës"}), [])
        self.assertEqual(title_errors({"category": "Teknologji", "title": "OpenAI publikon modelin e ri për agjentët"}), [])
        self.assertTrue(article_source_errors({"category": "Teknologji", "title": "OpenAI releases a model",
            "url": "https://techcrunch.com/one", "corroborating_sources": [{"url": "https://reuters.com/two"}]}))
        self.assertTrue(article_source_errors({"category": "Ekonomi", "title": "Trump signs immigration order",
            "url": "https://ekonomiaonline.com/one"}))

    def test_public_schema_date_and_restricted_body(self):
        from read_news_source import extract
        html = '<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","datePublished":"2026-10-07T12:00:00Z"}]}</script><article><p>' + 'Public article text. '*20 + '</p></article>'
        self.assertEqual(extract(html, "https://tvprizreni.net/one")["published"], "2026-10-07T12:00:00Z")
        self.assertEqual(extract(html.replace('"@type":"NewsArticle"', '"@type":"NewsArticle","isAccessibleForFree":false'), "https://tvprizreni.net/one")["status"], "restricted")

    def test_redirect_cannot_cross_category(self):
        from topic_selection_gate import evidence_errors
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "evidence.json"
            path.write_text(json.dumps([{"slug": "one", "source_url": "https://techcrunch.com/one",
                "evidence": {"status": "text_extracted", "url": "https://reuters.com/one"}, "corroborating": []}]))
            errors = evidence_errors([{"slug": "one", "category": "Teknologji", "url": "https://techcrunch.com/one"}], path)
            self.assertTrue(any("redirected" in e for e in errors))

    def test_finance_is_not_technology(self):
        for title in ("Nvidia earnings beat Wall Street expectations", "Bitcoin climbs after ETF approval",
                      "Nasdaq stocks fall", "Ethereum crypto exchange faces investigation"):
            self.assertIsNotNone(topic_error("Teknologji", title))
            self.assertIsNone(topic_error("Ekonomi", title))
        self.assertIsNone(topic_error("Teknologji", "OpenAI releases a new AI model"))

    def test_local_portals_cannot_supply_sport_showbiz_or_world(self):
        cases = [
            ("Kosovë", "Muriqi shënon dy gola për Kosovën", "Sport"),
            ("Kosovë", "Dua Lipa publikon albumin e ri në Kosovë", "Showbiz"),
            ("Shqipëri", "Big Brother Albania nis sezonin e ri", "Showbiz"),
            ("Kosovë", "Trump announces new immigration rules", "Botë"),
            ("Shqipëri", "Prishtina proteston kundër vendimit", "Kosovë"),
            ("Botë", "Bitcoin price jumps after crypto ETF approval", "Ekonomi"),
        ]
        for category, title, _ in cases:
            with self.subTest(title=title):
                self.assertIsNotNone(topic_error(category, title))

    def test_civic_mention_of_match_stays_local(self):
        self.assertIsNone(topic_error("Kosovë", "Prishtinë: mbyllen rrugët për ndeshjen e sotme"))
        self.assertIsNone(topic_error("Kosovë", "Kurti përballet me akuza për tenderin në Prishtinë"))
        self.assertIsNone(topic_error("Shqipëri", "Tiranë: SPAK heton tenderin e bashkisë"))


class DiscoveryEvals(unittest.TestCase):
    def test_exact_headlines_can_corroborate_across_independent_publishers(self):
        from cloud_news_discovery import select_leads
        title = "OpenAI launches new agent model with improved reasoning"
        leads = [{"title": title, "summary": title, "category": "Teknologji", "published": "2026-10-07",
                  "url": f"https://{host}/article", "source": host}
                 for host in ("techcrunch.com", "therundown.ai")]
        paired = select_leads(leads)
        self.assertEqual(len(paired), 2)
        self.assertEqual(paired[0]["pair_id"], paired[1]["pair_id"])

    def test_unrelated_headlines_are_not_pairs(self):
        from cloud_news_discovery import select_leads
        leads = [{"title": title, "category": "Teknologji", "url": f"https://{host}/article"}
                 for host, title in (("techcrunch.com", "OpenAI launches new model"),
                                     ("therundown.ai", "Apple unveils security camera"))]
        self.assertEqual(select_leads(leads), [])

    def test_freshness_future_dates_and_off_lane_rss(self):
        from cloud_news_discovery import fetch_feed
        now = datetime(2026, 10, 7, 12, tzinfo=timezone.utc)
        def item(title, date, url):
            return f"<item><title>{title}</title><link>{url}</link><pubDate>{date}</pubDate></item>"
        rss = "<rss><channel>" + "".join([
            item("Kurti reagon në Prishtinë", "Wed, 07 Oct 2026 11:00:00 GMT", "https://koha.net/a"),
            item("Kurti reagon në Kosovë", "Tue, 06 Oct 2026 11:00:00 GMT", "https://koha.net/b"),
            item("Kurti reagon në Kosovë", "Wed, 07 Oct 2026 13:00:00 GMT", "https://koha.net/c"),
            item("Dua Lipa publikon albumin në Kosovë", "Wed, 07 Oct 2026 11:00:00 GMT", "https://koha.net/d"),
            item("Kurti reagon në Kosovë", "Wed, 07 Oct 2026 11:00:00 GMT", "https://evil.test/e"),
        ]) + "</channel></rss>"
        with patch("cloud_news_discovery.requests.get") as request:
            request.return_value.content = rss.encode()
            request.return_value.status_code = 200
            leads, audit = fetch_feed({"source": "Koha", "category": "Kosovë", "url": "https://koha.net/rss"}, now)
        self.assertEqual([lead["url"] for lead in leads], ["https://koha.net/a"])
        self.assertEqual(audit["old_or_undated"], 2)
        self.assertEqual(audit["off_lane"], 2)


class HourlyState(unittest.TestCase):
    def test_published_slot_is_not_regenerated_and_failed_slot_can_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "slot.json"
            self.assertFalse(completed(path))
            save(path, "failed", "discovery")
            self.assertFalse(completed(path))
            save(path, "published", "live-readback")
            self.assertTrue(completed(path))
            save(path, "failed", "report-delivery")
            self.assertTrue(completed(path))
            self.assertFalse(path.with_suffix(".tmp").exists())


if __name__ == "__main__":
    unittest.main()
