import unittest
from unittest.mock import patch
from datetime import datetime, timezone
from types import SimpleNamespace

import news_social_accounts as nsa


def at(text):
    return datetime.fromisoformat(text).replace(tzinfo=timezone.utc)


class Window(unittest.TestCase):
    def test_only_posts_around_the_story_are_kept(self):
        posts = [{"url": "https://x.com/a/status/1", "date": "2026-11-05T10:00:00+00:00"},
                 {"url": "https://x.com/a/status/2", "date": "2026-10-20T10:00:00+00:00"},
                 {"url": "https://x.com/a/status/3", "date": "2026-11-09T10:00:00+00:00"},
                 {"url": "https://x.com/a/status/4", "date": "not a date"}]
        got = nsa.in_window(posts, at("2026-11-02T00:00:00"), at("2026-11-07T00:00:00"))
        self.assertEqual([p["url"] for p in got], ["https://x.com/a/status/1"])


class Shapes(unittest.TestCase):
    def test_a_tweet_becomes_a_public_post_link(self):
        tw = SimpleNamespace(id=2114324613949751655, date=at("2026-11-05T10:00:00"), rawContent="Protestat e dhunshme",
                             user=SimpleNamespace(username="ediramaal", displayname="Edi Rama"), retweetedTweet=None)
        self.assertEqual(nsa.x_post(tw), {"url": "https://x.com/ediramaal/status/2114324613949751655", "date": "2026-11-05T10:00:00+00:00",
                                          "text": "Protestat e dhunshme", "author": "Edi Rama"})

    def test_a_repost_is_someone_else_and_is_skipped(self):
        tw = SimpleNamespace(id=1, date=at("2026-11-05T10:00:00"), rawContent="RT", user=SimpleNamespace(username="a", displayname="A"),
                             retweetedTweet=object())
        self.assertIsNone(nsa.x_post(tw))

    def test_a_graph_api_media_becomes_a_post_link(self):
        # Meta's official business_discovery reply: the VPS's data-centre address is refused by Instagram's own pages.
        media = {"permalink": "https://www.instagram.com/reel/DfXUHn9jjJY/", "timestamp": "2026-11-05T15:06:53+0000",
                 "caption": "Takim me ambasadoren", "like_count": 1400, "username": "albinkurti_", "id": "18073334450499749"}
        self.assertEqual(nsa.graph_post(media), {"url": "https://www.instagram.com/reel/DfXUHn9jjJY/", "date": "2026-11-05T15:06:53+00:00",
                                                 "text": "Takim me ambasadoren", "author": "albinkurti_", "likes": 1400})
        self.assertIsNone(nsa.graph_post({"permalink": "https://example.com/p/x/", "timestamp": "2026-11-05T15:06:53+0000"}))
        self.assertEqual(nsa.graph_post({**media, "like_count": None})["likes"], 0)

    def test_the_request_names_our_account_the_wanted_account_and_the_fields(self):
        url = nsa.discovery_url("17841432997458571", "albinkurti_", "TOKEN")
        self.assertTrue(url.startswith("https://graph.facebook.com/v27.0/17841432997458571?"))
        self.assertIn("business_discovery.username%28albinkurti_%29", url)
        self.assertIn("permalink", url)
        self.assertTrue(url.endswith("&access_token=TOKEN"))

    def test_an_expired_token_says_how_to_fix_it_and_reads_nothing(self):
        import io
        import urllib.error
        err = urllib.error.HTTPError("u", 400, "Bad", {}, io.BytesIO(b'{"error":{"code":190,"message":"Session has expired"}}'))
        with patch.object(nsa, "meta_config", return_value={"token": "T", "ig_user_id": "1"}), \
             patch.object(nsa.urllib.request, "urlopen", side_effect=err), patch.object(nsa.sys, "stderr", new=io.StringIO()) as log:
            self.assertEqual(nsa.read_ig(["albinkurti_"]), [])
        self.assertIn("ctx.sh meta", log.getvalue())

    def test_no_token_installed_reads_nothing(self):
        import io
        with patch.object(nsa, "meta_config", return_value=None), patch.object(nsa.sys, "stderr", new=io.StringIO()):
            self.assertEqual(nsa.read_ig(["albinkurti_"]), [])

class Search(unittest.TestCase):
    """Anyone's photo or video of the event from X search, most liked first."""

    def tweet(self, id_, likes, photos=(), videos=()):
        return SimpleNamespace(id=id_, date=at("2026-11-05T10:00:00"), rawContent="Zjarri në Gjilan", likeCount=likes,
                               user=SimpleNamespace(username="witness", displayname="Witness"), retweetedTweet=None,
                               media=SimpleNamespace(photos=list(photos), videos=list(videos)))

    def test_the_query_asks_for_media_and_some_reach_within_the_days(self):
        q = nsa.search_query("zjarr Gjilan", at("2026-11-04T10:00:00"), at("2026-11-07T10:00:00"))
        self.assertEqual(q, "zjarr Gjilan filter:media -filter:retweets min_faves:50 since:2026-11-04 until:2026-11-08")

    def test_a_searched_tweet_needs_a_photo_or_video_and_carries_its_likes(self):
        self.assertIsNone(nsa.searched_x_post(self.tweet(1, 900)))
        got = nsa.searched_x_post(self.tweet(2, 900, videos=[object()]))
        self.assertEqual((got["url"], got["likes"]), ("https://x.com/witness/status/2", 900))

    def test_most_liked_first_and_each_post_once(self):
        posts = [{"url": "a", "likes": 5}, {"url": "b", "likes": 50}, {"url": "a", "likes": 5}, {"url": "c"}]
        self.assertEqual([p["url"] for p in nsa.most_liked(posts)], ["b", "a", "c"])



if __name__ == "__main__":
    unittest.main()
