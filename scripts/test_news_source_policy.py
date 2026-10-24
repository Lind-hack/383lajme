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
    def test_explicit_publisher_gaming_labels_are_excluded_before_expensive_preparation(self):
        self.assertIsNotNone(topic_error('Teknologji','Valve developer mentions HLX',url='https://arstechnica.com/gaming/2026/10/example'))
        self.assertIsNotNone(topic_error('Teknologji','New product announced',tags=['gaming']))
        self.assertIsNone(topic_error('Sport','Olympic Games announce the final schedule'))
        self.assertIsNone(topic_error('Teknologji','Nvidia announces a new data-centre processor','The announcement also mentions gaming.'))

    def test_local_publisher_geography_path_is_explicit_location_evidence(self):
        self.assertIsNone(topic_error('Shqipëri','Ministry building damaged during protest',url='https://a2news.com/shqiperia/aktualitet/example'))
        self.assertIsNotNone(topic_error('Shqipëri','Ministry building damaged during protest',url='https://a2news.com/bota/aktualitet/example'))
        self.assertIsNotNone(topic_error('Kosovë','Ministry building damaged during protest',url='https://a2news.com/shqiperia/aktualitet/example'))

    def test_expanded_publishers_remain_locked_to_their_desk_and_sister_family(self):
        for category,url in [('Teknologji','https://www.bleepingcomputer.com/news/example'),('Shqipëri','https://a2news.com/shqiperia/example'),('Ekonomi','https://cryptoslate.com/example'),('Showbiz','https://consequence.net/example')]:
            self.assertIsNone(source_error(category,url))
            for other in CATEGORIES:
                if other!=category:self.assertIsNotNone(source_error(other,url))
        self.assertFalse(independent('https://cbssports.com/example','https://cbsnews.com/example'))
        self.assertFalse(independent('https://news.mit.edu/example','https://technologyreview.com/example'))

    def test_literary_awards_remain_culture_after_a_headline_edit(self):
        self.assertIsNone(topic_error("Showbiz", "Lezhë: Marku, Açka, Tufa, Përgega fitojnë çmimet e Fishtës",
                                      "Juria shpalli fituesit e çmimeve letrare të këtij edicioni."))
        self.assertIsNone(topic_error("Showbiz", "Shkrimtarët marrin çmimet e jurisë"))
        self.assertIsNotNone(topic_error("Showbiz", "Juria shpall fituesit e tenderit të bankës"))
        self.assertIsNotNone(source_error("Shqipëri", "https://kultplus.com/awards"))

    def test_albanian_singing_and_television_terms_identify_culture_without_a_name_whitelist(self):
        for title in ("Phoebe Bridgers këndon solo në SNL më 14 nëntor",
                      "Phoebe Bridgers do të këndojë në SNL më 14 nëntor",
                      "Publikohet programi televiziv i fundjavës"):
            self.assertIsNone(topic_error("Showbiz", title))
        self.assertIsNotNone(topic_error("Showbiz", "Banka shpall fitimin tremujor"))
        self.assertIsNotNone(source_error("Showbiz", "https://cnbc.com/business/announcement"))

    def test_music_publishers_stay_in_showbiz_and_keep_real_owner_families(self):
        for domain in ("nme.com", "pitchfork.com"):
            self.assertIsNone(source_error("Showbiz", f"https://{domain}/news/announcement"))
            for category in CATEGORIES:
                if category != "Showbiz":
                    self.assertIsNotNone(source_error(category, f"https://{domain}/news/announcement"))
        self.assertFalse(independent("https://pitchfork.com/news/announcement", "https://arstechnica.com/story"))
        self.assertTrue(independent("https://nme.com/news/announcement", "https://pitchfork.com/news/announcement"))

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
    def test_explicit_music_path_stays_out_of_world_even_without_a_named_star(self):
        self.assertIsNotNone(topic_error('Botë', 'Sam Fender fans question high ticket prices',
                                        url='https://www.theguardian.com/music/2026/oct/24/sam-fender'))
        self.assertIsNone(topic_error('Botë', 'Government announces public transport investment',
                                     url='https://www.theguardian.com/world/2026/oct/24/transport'))

    def test_showbiz_rejects_unrelated_general_feed_stories_before_photo_work(self):
        for title in ("Oregon school shooting: calls to suspect's home", "Studentet duan te qeverisin Serbine",
                      "Cilat jane frutat e thata me te shendetshme?",
                      "Authorities announce police operation in Romania", "Company unveils new AI model"):
            self.assertIsNotNone(topic_error("Showbiz", title))
        for title in ("Jane Krakowski reprises theatre role in London", "ReMusica Festival rikthehet ne tetor",
                      "Kim Kardashian shares Halloween costumes", "Botohet libri i autores Fatmire Halili"):
            self.assertIsNone(topic_error("Showbiz", title))

    def test_local_desks_include_verified_entertainment_and_company_news(self):
        cases = [
            ("Kosov\u00eb", "Dua Lipa njofton koncertin e ri n\u00eb Prishtin\u00eb"),
            ("Shqip\u00ebri", "Aktori hap kompanin\u00eb e re n\u00eb Tiran\u00eb"),
            ("Kosov\u00eb", "Kompania n\u00eb Prizren prezanton softuerin e ri"),
            ("Shqip\u00ebri", "Bursa n\u00eb Tiran\u00eb publikon raportin e aksioneve"),
        ]
        for category, title in cases:
            with self.subTest(category=category, title=title):
                self.assertIsNone(topic_error(category, title))
        self.assertIsNotNone(topic_error("Kosov\u00eb", "Taylor Swift announces a new album"))
        self.assertIsNotNone(topic_error("Bot\u00eb", "Dua Lipa announces a new album"))
        self.assertTrue(article_source_errors({"category": "Kosov\u00eb", "title": cases[0][1],
                                               "url": "https://variety.com/one"}))

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

    def test_local_portals_exclude_sport_and_unrelated_world_stories(self):
        cases = [
            ("Kosovë", "Muriqi shënon dy gola për Kosovën", "Sport"),
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
        self.assertEqual([lead["url"] for lead in leads], ["https://koha.net/a", "https://koha.net/d"])
        self.assertEqual(audit["old_or_undated"], 2)
        self.assertEqual(audit["off_lane"], 1)


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
