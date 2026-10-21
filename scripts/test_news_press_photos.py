import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import news_press_photos as press

NOW = datetime.now(timezone.utc)
RSS = f"""<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item><title>Presidentja Osmani pret ambasadorin e Gjermanisë</title><link>https://president-ksgov.net/osmani-gjermani/</link>
<pubDate>{NOW.strftime('%a, %d %b %Y %H:%M:%S +0000')}</pubDate><description>Takim në Prishtinë</description>
<media:content url="https://president-ksgov.net/wp-content/uploads/{NOW:%Y/%m}/takim.jpg"/></item>
</channel></rss>""".encode()


def item(title, image="https://president-ksgov.net/wp-content/uploads/x.jpg", credit="Presidenca e Kosovës"):
    return {"title": title, "summary": "", "link": "https://president-ksgov.net/post/", "when": NOW,
            "image": image, "credit": credit, "feed": "https://president-ksgov.net/feed/"}


class PressPhotoTests(unittest.TestCase):
    def test_rss_items_keep_their_own_image_and_date(self):
        [found] = press.parse_feed(RSS, "rss")
        self.assertEqual(found["link"], "https://president-ksgov.net/osmani-gjermani/")
        self.assertTrue(found["image"].endswith("takim.jpg"))
        self.assertLess(abs((found["when"] - NOW).total_seconds()), 2)

    def test_reused_logos_and_old_uploads_are_not_event_photos(self):
        self.assertTrue(press.stock_image("https://asp.gov.al/wp-content/uploads/2025/07/LOGO.jpg", NOW))
        self.assertFalse(press.stock_image(f"https://asp.gov.al/wp-content/uploads/{NOW:%Y/%m}/event.jpg", NOW))
        self.assertFalse(press.stock_image("https://www.apple.com/newsroom/images/a.jpg", NOW))

    def test_the_story_must_name_the_person_and_the_event(self):
        lead = {"title": "Osmani pret ambasadorin e Gjermanisë në Prishtinë",
                "primary_evidence": {"text": "Presidentja Vjosa Osmani priti ambasadorin e Gjermanisë."}}
        with patch.object(press, "press_items", return_value=[item("Presidentja Osmani pret ambasadorin e Gjermanisë"),
                                                              item("Presidentja Osmani uron kombëtaren")]):
            options = press.press_options(lead)
        self.assertEqual(len(options), 1)
        rights = options[0]["photo"]["image_rights"]
        self.assertEqual((rights["provider"], rights["creator"], rights["license"]),
                         ("official-press", "Presidenca e Kosovës", press.LICENSE))

    def test_hosts_compare_by_site(self):
        self.assertEqual(press.site("https://www.kosovopolice.com/a"), "kosovopolice.com")
        self.assertEqual(press.site("https://asp.gov.al/a"), "asp.gov.al")
        self.assertEqual(press.site("https://audiovisual.ec.europa.eu/a"), press.site("https://ec.europa.eu/b"))


if __name__ == "__main__":
    unittest.main()
