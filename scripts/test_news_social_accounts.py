import unittest
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

    def test_an_instagram_app_media_becomes_a_post_link(self):
        # Instagram's app reply, as the clip scout reads it: instaloader's Profile page answers 302 now.
        reel = {"code": "DfXWj20o-te", "media_type": 2, "taken_at": 1793696400, "caption": {"text": "ZURICH - THE HALL 28/NOV"},
                "user": {"username": "noizy"}, "like_count": 4100}
        self.assertEqual(nsa.ig_app_post(reel), {"url": "https://www.instagram.com/reel/DfXWj20o-te/", "date": "2026-11-03T09:00:00+00:00",
                                                 "text": "ZURICH - THE HALL 28/NOV", "author": "noizy", "likes": 4100})
        photo = {"code": "DfABC", "media_type": 8, "taken_at": 1793696400, "caption": None, "user": {}}
        self.assertEqual(nsa.ig_app_post(photo)["url"], "https://www.instagram.com/p/DfABC/")
        self.assertIsNone(nsa.ig_app_post({"media_type": 2}))



class Search(unittest.TestCase):
    """Anyone's photo or video of the event: X search and an Instagram hashtag, most liked first."""

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

    def test_every_media_in_any_reply_layout_is_found_once(self):
        reply = {"data": {"top": {"sections": [{"layout_content": {"medias": [{"media": {"code": "DfAAAAA", "media_type": 2}}]}},
                                               {"layout_content": {"fill_items": [{"media": {"code": "DfBBBBB", "media_type": 1}}]}}]}}}
        self.assertEqual([p["url"] for p in nsa.ig_app_posts(reply)],
                         ["https://www.instagram.com/reel/DfAAAAA/", "https://www.instagram.com/p/DfBBBBB/"])


if __name__ == "__main__":
    unittest.main()
