"""Public article dates must not come from a sidebar or an unrelated story."""
import json
import unittest
from unittest.mock import Mock, patch

from read_news_source import extract, read


BODY = "The council approved a public transport proposal after a recorded debate with residents. " * 20


class ArticleDateTests(unittest.TestCase):
    def test_top_channel_visible_date_recovers_public_article(self):
        page = f'<h1>Tiranë: këshilli miraton planin</h1><div class="date col-xs-6">20/10/2026 21:07</div><article><p>{BODY}</p></article><aside><div class="date">21/10/2026 09:00</div></aside>'
        result = extract(page, "https://top-channel.tv/2026/10/20/public-transport/")
        self.assertEqual(result["published"], "2026-10-20T21:07:00+02:00")
        self.assertEqual(result["published_source"], "publisher:top-channel.tv:.date")
        self.assertGreaterEqual(result["word_count"], 140)

    def test_top_channel_visible_date_uses_winter_offset(self):
        result = extract(f'<h1>Tiranë</h1><div class="date">20/12/2026 21:07</div><article><p>{BODY}</p></article>', "https://www.top-channel.tv/2026/12/20/story/")
        self.assertEqual(result["published"], "2026-12-20T21:07:00+01:00")

    def test_generic_date_class_is_not_trusted_on_other_hosts(self):
        result = extract(f'<h1>Story</h1><div class="date">20/10/2026 21:07</div><article><p>{BODY}</p></article>', "https://example.com/story")
        self.assertEqual(result["published"], "")

    def test_top_channel_date_is_not_read_from_footer_or_listing(self):
        for page in [f'<h1>Story</h1><article><p>{BODY}</p></article><footer><div class="date">20/10/2026 21:07</div></footer>', '<div class="date">20/10/2026 21:07</div><a href="/story">Story</a>']:
            with self.subTest(page=page):
                self.assertEqual(extract(page, "https://top-channel.tv/2026/10/20/story/")["published"], "")

    def test_blog_posting_date_and_full_schema_type_are_supported(self):
        for kind in ["BlogPosting", "LiveBlogPosting", "https://schema.org/BlogPosting"]:
            schema = {"@type": kind, "datePublished": "2026-10-20T18:00:00Z", "dateModified": "2026-10-21T18:00:00Z", "url": "https://example.com/story"}
            result = extract(f'<script type="application/ld+json">{json.dumps(schema)}</script><article><p>{BODY}</p></article>', "https://example.com/story")
            with self.subTest(kind=kind):
                self.assertEqual(result["published"], "2026-10-20T18:00:00Z")

    def test_schema_date_must_belong_to_the_requested_article(self):
        schemas = [{"@type": "NewsArticle", "url": "https://example.com/other", "datePublished": "2026-10-21T12:00:00Z"}, {"@type": "BlogPosting", "mainEntityOfPage": {"@id": "https://example.com/story#webpage"}, "datePublished": "2026-10-20T18:00:00Z"}]
        result = extract(f'<script type="application/ld+json">{json.dumps(schemas)}</script><article><p>{BODY}</p></article>', "https://example.com/story")
        self.assertEqual(result["published"], "2026-10-20T18:00:00Z")

    def test_unrelated_or_ambiguous_article_schema_does_not_supply_date(self):
        for schemas in [[{"@type": "NewsArticle", "url": "https://example.com/other", "datePublished": "2026-10-21T12:00:00Z"}], [{"@type": "NewsArticle", "datePublished": "2026-10-21T12:00:00Z"}, {"@type": "BlogPosting", "datePublished": "2026-10-20T18:00:00Z"}]]:
            result = extract(f'<script type="application/ld+json">{json.dumps(schemas)}</script><article><p>{BODY}</p></article>', "https://example.com/story")
            self.assertEqual(result["published"], "")

    def test_article_time_beats_sidebar_time_and_survives_header_removal(self):
        page = f'<aside><time datetime="2026-10-21T12:00:00Z"></time></aside><article><header><time datetime="2026-10-20T18:00:00Z"></time></header><p>{BODY}</p></article>'
        self.assertEqual(extract(page, "https://example.com/story")["published"], "2026-10-20T18:00:00Z")

    def test_publication_microdata_beats_modified_time(self):
        page = f'<article><time itemprop="dateModified" datetime="2026-10-21T18:00:00Z"></time><meta itemprop="datePublished" content="2026-10-20T18:00:00Z"><p>{BODY}</p></article>'
        self.assertEqual(extract(page, "https://example.com/story")["published"], "2026-10-20T18:00:00Z")

    def test_updated_time_is_not_a_publication_date_fallback(self):
        page = f'<article><time itemprop="dateModified" datetime="2026-10-21T18:00:00Z"></time><p>{BODY}</p></article><footer><time datetime="2026-10-20T18:00:00Z"></time></footer>'
        self.assertEqual(extract(page, "https://example.com/story")["published"], "")

    def test_event_time_inside_article_prose_is_not_publication(self):
        page = f'<article><p>{BODY}<time datetime="2026-10-21T18:00:00Z">Tomorrow evening</time></p></article>'
        self.assertEqual(extract(page, "https://example.com/story")["published"], "")

    def test_site_header_clock_is_not_an_article_date(self):
        page = f'<header><time datetime="2026-10-21T18:00:00Z"></time></header><div class="entry-content"><p>{BODY}</p></div>'
        self.assertEqual(extract(page, "https://example.com/story")["published"], "")

    def test_short_readable_source_is_reported_without_being_discarded(self):
        text = "A named institution announced a short verified development during the public meeting today."
        result = extract(f'<article><p>{text}</p></article>', "https://example.com/story")
        self.assertEqual(result["status"], "text_extracted")
        self.assertEqual(result["text"], text)
        self.assertEqual(result["word_count"], len(text.split()))
        self.assertEqual(result["content_diagnostic"], "insufficient_content")

    def test_restriction_and_destination_guards_are_not_bypassed(self):
        page = f'<script type="application/ld+json">{{"@type":"BlogPosting","isAccessibleForFree":false}}</script><article><p>{BODY}</p></article>'
        self.assertEqual(extract(page, "https://example.com/story")["status"], "restricted")
        response = Mock(status=302, headers={"Location": "http://127.0.0.1/private"})
        pool = Mock()
        pool.urlopen.return_value = response
        with patch("read_news_source.check_public", side_effect=["93.184.216.34", ValueError("non-public destination")]) as checked, patch("read_news_source.urllib3.HTTPSConnectionPool", return_value=pool):
            with self.assertRaisesRegex(ValueError, "non-public destination"):
                read("https://example.com/story")
        self.assertEqual(checked.call_count, 2)
        pool.urlopen.assert_called_once()


if __name__ == "__main__":
    unittest.main()
