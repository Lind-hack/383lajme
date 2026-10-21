"""Source health must explain unavailable inventory without rejecting thin sources."""
import os
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

import requests

from cloud_news_discovery import fetch_listing


class ListingDiagnosticsTests(unittest.TestCase):
    @patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"})
    def test_listing_exposes_rejection_reasons_and_retains_short_grounding(self):
        urls = [f"https://top-channel.tv/2026/10/20/article-{i}/" for i in range(8)]
        response = Mock(url="https://top-channel.tv/", content="".join(f'<a href="{u}">Tiranë: institucioni publikon vendimin e verifikuar sot {i}</a>' for i,u in enumerate(urls)), status_code=200)
        evidence = [
            ValueError("HTTP 403"),
            {"status":"restricted"},
            {"status":"no_article_text"},
            {"status":"text_extracted", "published":""},
            {"status":"text_extracted", "published":"invalid"},
            {"status":"text_extracted", "published":"2026-10-18T18:00:00Z"},
            {"status":"text_extracted", "published":"2026-10-20T18:00:00Z", "title":"Foreign headline", "text":"Other country " * 75},
            {"status":"text_extracted", "published":"2026-10-20T18:00:00Z", "title":"Tiranë: bashkia publikon vendimin", "text":"Tiranë ka publikuar një vendim të shkurtër për banorët.", "word_count":9, "content_diagnostic":"insufficient_content"},
        ]
        for item in evidence:
            if isinstance(item, dict) and item.get("status") == "text_extracted":
                item.setdefault("text", "Tiranë publikon vendimin për banorët. " * 30)
        with patch("cloud_news_discovery.requests.get", return_value=response), patch("read_news_source.read", side_effect=evidence):
            leads, audit = fetch_listing({"source":"Top Channel", "category":"Shqipëri", "url":"https://top-channel.tv/"}, datetime(2026,10,20,21,tzinfo=timezone.utc))
        self.assertEqual(len(leads),1)
        self.assertEqual(audit["attempted"],8)
        for reason in ["unreadable", "restricted", "no_article_text", "undated", "invalid_date", "old_or_future", "off_lane", "insufficient_content"]:
            with self.subTest(reason=reason):self.assertEqual(audit[reason],1)
        self.assertEqual(leads[0]["source_word_count"],9)

    def test_bounded_listing_reports_attempts_separately_from_candidate_links(self):
        response = Mock(url="https://top-channel.tv/", content="".join(f'<a href="/2026/10/20/article-{i}/">Tiranë: institucioni publikon një njoftim për banorët {i}</a>' for i in range(5)), status_code=200)
        with patch("cloud_news_discovery.requests.get", return_value=response), patch("read_news_source.read", return_value={"status":"no_article_text"}) as reader:
            _, audit = fetch_listing({"source":"Top Channel", "category":"Shqipëri", "url":"https://top-channel.tv/", "listing_limit":2})
        self.assertEqual(audit["entries"],5)
        self.assertEqual(audit["attempted"],2)
        self.assertEqual(reader.call_count,2)

    def test_blocked_listing_retains_status_and_error_type(self):
        response = Mock(status_code=403)
        response.raise_for_status.side_effect=requests.HTTPError("403 Forbidden")
        with patch("cloud_news_discovery.requests.get", return_value=response):
            leads,audit=fetch_listing({"source":"Top Channel", "category":"Shqipëri", "url":"https://top-channel.tv/"})
        self.assertEqual(leads,[])
        self.assertEqual(audit["http_status"],403)
        self.assertEqual(audit["error"],"HTTPError")
        self.assertEqual(audit["attempted"],0)


if __name__ == "__main__":
    unittest.main()
