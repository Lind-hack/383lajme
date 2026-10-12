import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import news_video_policy as video

NOW = datetime.now(timezone.utc)


def feed(*entries):
    rows = "".join(
        f"<entry><yt:videoId>{vid}</yt:videoId><title>{title}</title><published>{when.isoformat()}</published></entry>"
        for vid, title, when in entries)
    return ('<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">'
            + rows + "</feed>").encode()


LEAD = {"title": "Verstappen wins the race in Singapore",
        "primary_evidence": {"text": "Max Verstappen won the race. Max Verstappen led every lap."}}


class VideoTests(unittest.TestCase):
    def setUp(self):
        video._FEED = None

    def test_feed_keeps_only_recent_well_formed_uploads(self):
        content = feed(("aaaaaaaaaaa", "Max Verstappen wins", NOW - timedelta(hours=5)),
                       ("bbbbbbbbbbb", "Old highlights", NOW - timedelta(days=9)),
                       ("bad", "Broken id", NOW))
        with patch.object(video.requests, "get", return_value=SimpleNamespace(content=content, raise_for_status=lambda: None)):
            rows = video.channel_videos("UCB_qr75-ydFVKSF9Dmo6izg", NOW)
        self.assertEqual([row["video_id"] for row in rows], ["aaaaaaaaaaa"])

    def test_official_video_naming_the_person_becomes_the_story_visual(self):
        video._FEED = [{"video_id": "aaaaaaaaaaa", "title": "Max Verstappen's winning lap | Singapore",
                        "published": NOW.isoformat(), "channel_id": "UCB_qr75-ydFVKSF9Dmo6izg", "channel": "Formula 1"},
                       {"video_id": "ccccccccccc", "title": "Season review", "published": NOW.isoformat(),
                        "channel_id": "UCB_qr75-ydFVKSF9Dmo6izg", "channel": "Formula 1"}]
        with patch.object(video, "embeddable", return_value=True), \
                patch("news_image_policy.photo_fingerprint", return_value=(1280, 720, "digest", 0)):
            chosen = video.select_video(LEAD)
        self.assertEqual(chosen["video_clip_url"], "https://www.youtube.com/watch?v=aaaaaaaaaaa")
        self.assertEqual(chosen["image_rights"]["provider"], "youtube-embed")
        self.assertEqual(chosen["image_subject"], "Max Verstappen")

    def test_blocked_embeds_and_unrelated_videos_give_nothing(self):
        video._FEED = [{"video_id": "aaaaaaaaaaa", "title": "Max Verstappen's winning lap", "published": NOW.isoformat(),
                        "channel_id": "x", "channel": "Formula 1"}]
        with patch.object(video, "embeddable", return_value=False):
            self.assertEqual(video.select_video(LEAD), {})
        video._FEED = [{"video_id": "aaaaaaaaaaa", "title": "Lewis Hamilton interview", "published": NOW.isoformat(),
                        "channel_id": "x", "channel": "Formula 1"}]
        with patch.object(video, "embeddable", return_value=True):
            self.assertEqual(video.select_video(LEAD), {})


if __name__ == "__main__":
    unittest.main()
