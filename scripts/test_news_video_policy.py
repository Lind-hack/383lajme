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
    def test_recompressed_video_posters_use_the_same_batch_visual_identity_check(self):
        from news_image_policy import batch_image_errors
        clips = [{'video_id':key, 'title':"Max Verstappen's winning lap", 'published':NOW.isoformat(),
                  'channel_id':'UCB_qr75-ydFVKSF9Dmo6izg', 'channel':'Formula 1'}
                 for key in ('aaaaaaaaaaa','bbbbbbbbbbb')]
        with patch.dict(video.os.environ, {'L383_HOURLY_NEWS':'0'}), \
                patch.object(video, 'embeddable', return_value=True), \
                patch('news_image_policy.photo_fingerprint', side_effect=[(1280,720,'a'*64,123456), (1280,720,'b'*64,123456)]):
            photos = [video.finalize_video(LEAD, {'video':clip,'name':'Max Verstappen'}) for clip in clips]
        self.assertNotEqual(photos[0]['image_url'], photos[1]['image_url'])
        self.assertNotEqual(photos[0]['image_rights']['sha256'], photos[1]['image_rights']['sha256'])
        self.assertTrue(batch_image_errors(photos))

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

    def test_a_one_word_subject_matches_only_its_own_channel(self):
        lead = {"title": "Waymo starts mapping Toronto streets",
                "primary_evidence": {"text": "The company Waymo will map Toronto. Engineers at Waymo then test cars there."}}
        own = {"video_id": "aaaaaaaaaaa", "title": "Mapping Toronto with the Waymo Driver", "published": NOW.isoformat(),
               "channel_id": "UCh5Yo6HN5b2Hco70HosIzZA", "channel": "Waymo"}
        other = {**own, "video_id": "bbbbbbbbbbb", "channel": "Uber", "title": "Waymo rides in Toronto, explained"}
        video._FEED = [other, own]
        self.assertEqual([option["video"]["video_id"] for option in video.video_options(lead)], ["aaaaaaaaaaa"])


if __name__ == "__main__":
    unittest.main()
