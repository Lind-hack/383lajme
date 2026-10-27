import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import clip_scout as cs

NOW = datetime(2026, 10, 25, 12, tzinfo=timezone.utc)


def clip(i, *, author="a", plays=50_000, hours=6, caption="Shiko çfarë ndodhi sot në Prishtinë dhe Tiranë", **kw):
    return {"platform": "tiktok", "id": f"tt:{i}", "vid": str(i), "link": f"https://www.tiktok.com/@{author}/video/{i}",
            "caption": caption, "language": "", "created": (NOW - timedelta(hours=hours)).isoformat(), "author": author,
            "author_name": author, "followers": 20_000, "plays": plays, "likes": 0, "comments": 0, "shares": 0, "saves": 0,
            "duration": 20, "music": "", "cover": "", "found_by": "#kosova", **kw}


class ScoutTests(unittest.TestCase):
    def test_albanian_is_told_from_words_or_language(self):
        self.assertTrue(cs.is_albanian(clip(1)))
        self.assertTrue(cs.is_albanian(clip(2, caption="x", language="sq")))
        self.assertFalse(cs.is_albanian(clip(3, caption="Wait for the end, crazy moment at the stadium")))

    def test_an_outlier_beats_a_bigger_but_ordinary_clip(self):
        state = {"authors": {"small": {"median": 2_000}, "big": {"median": 400_000}}}
        small = clip(1, author="small", plays=80_000)
        big = clip(2, author="big", plays=500_000, caption="Një tjetër video nga Kosova dhe Shqipëria sot")
        ranked = cs.rank([big, small], state, NOW)
        self.assertEqual(ranked[0]["id"], "tt:1")
        self.assertIn("40×", ranked[0]["why"][1])

    def test_old_unseen_and_tiny_clips_are_left_out(self):
        pool = [clip(1, hours=100), clip(2, plays=900), clip(3, caption="English only caption with nothing local")]
        self.assertEqual(cs.rank(pool, {}, NOW), [])

    def test_a_clip_already_on_three_accounts_has_been_seen(self):
        text = "Momenti kur ushtari vrapon drejt nënës pas betimit në Prishtinë"
        pool = [clip(i, author=f"page{i}", caption=f"{text} #kosova #fyp{i}") for i in range(3)]
        self.assertEqual(cs.rank(pool, {}, NOW), [])
        self.assertEqual(len(cs.rank(pool[:2], {}, NOW)), 2)

    def test_queued_clips_are_not_found_twice(self):
        self.assertEqual(cs.rank([clip(1)], {"queued": {"tt:1": {}}}, NOW), [])

    def test_seen_accounts_are_remembered_across_runs(self):
        state = {}
        text = "Momenti kur ushtari vrapon drejt nënës pas betimit në Prishtinë"
        cs.remember_seen(state, [clip(1, author="p1", caption=text), clip(2, author="p2", caption=text)], NOW)
        self.assertEqual(cs.rank([clip(3, author="p3", caption=text)], state, NOW), [])

    def test_trends_become_hashtags(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "t.json"
            p.write_text(json.dumps({"trends": [{"term": "Vincent Kompany"}, {"term": "BE"}, {"term": "Dua Lipa"}]}), encoding="utf-8")
            self.assertEqual(cs.trend_tags(p), ["vincentkompany", "dualipa"])
            self.assertEqual(cs.trend_terms(p)[0], "Vincent Kompany")

    def test_youtube_views_are_read(self):
        self.assertEqual(cs.views_of("1.2M views"), 1_200_000)
        self.assertEqual(cs.views_of("35K views"), 35_000)
        self.assertEqual(cs.views_of("1,234 views"), 1_234)
        self.assertEqual(cs.views_of("No views"), 0)

    def test_the_headline_wraps_and_the_caption_is_cleaned(self):
        self.assertTrue(all(len(line) <= 26 for line in cs.wrap("Ushtari i FSK-së vrapon drejt përqafimit të nënës pas betimit", 26)))
        self.assertEqual(cs.clean_caption("Mes lotësh 😭 #kosova @raporto https://x.co/a"), "Mes lotësh")

    def test_the_watchlist_takes_albanian_creators_with_an_audience(self):
        state = {}
        cs.grow_watchlist(state, [clip(1, author="big"), clip(2, author="tiny", followers=300),
                                  clip(3, author="foreign", caption="Wait for it")])
        self.assertEqual(list(state["watch"]), ["big"])

    def test_a_cookies_txt_is_read_by_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            jar = Path(tmp) / "c.txt"
            jar.write_text("# Netscape HTTP Cookie File\n.x.com\tTRUE\t/\tTRUE\t0\tct0\tabc\n"
                           "#HttpOnly_.x.com\tTRUE\t/\tTRUE\t0\tauth_token\tdef\n", encoding="utf-8")
            self.assertEqual(cs.read_cookies(jar), {"ct0": "abc", "auth_token": "def"})
            self.assertEqual(cs.read_cookies(Path(tmp) / "missing.txt"), {})

    def test_an_x_repost_with_video_is_its_original(self):
        ns = lambda **kw: type("NS", (), kw)()  # noqa: E731
        video = ns(duration=31000, views=0, thumbnailUrl="t.jpg")
        original = ns(id=7, user=ns(username="lajme", displayname="Lajme", followersCount=9000), date=NOW,
                      rawContent="Momenti në Prishtinë", lang="sq", viewCount=120_000, likeCount=4000, replyCount=90,
                      retweetCount=300, quoteCount=20, bookmarkedCount=150, media=ns(videos=[video]), retweetedTweet=None)
        c = cs.x_clip(ns(id=8, retweetedTweet=original), "X: test")
        self.assertEqual((c["id"], c["author"], c["plays"], c["shares"], c["duration"]), ("x:7", "lajme", 120_000, 320, 31))
        self.assertEqual(c["link"], "https://x.com/lajme/status/7")
        self.assertIsNone(cs.x_clip(ns(id=9, retweetedTweet=None, media=ns(videos=[]), user=original.user), ""))

    def test_on_x_an_english_post_about_albania_counts(self):
        self.assertTrue(cs.is_albanian(clip(1, platform="x", language="en", caption="Surreal scenes in Tirana, Albania right now")))
        self.assertFalse(cs.is_albanian(clip(2, platform="x", language="tr", caption="Derbiyi Tugay Kosova anlatacak")))
        self.assertFalse(cs.is_albanian(clip(3, language="en", caption="Surreal scenes in Tirana, Albania right now")))
        # X calls Albanian Estonian: the words decide.
        self.assertTrue(cs.is_albanian(clip(4, platform="x", language="et", caption="Ai i sheh shqiptarët si armiq dhe policia")))

    def test_an_english_x_post_needs_the_place_not_a_word(self):
        self.assertFalse(cs.is_albanian(clip(1, platform="x", language="en", caption="13x faster: 3.4 s per decision, per call")))

    def test_instagram_reels_are_read_from_any_layout(self):
        reel = {"code": "De5", "media_type": 2, "taken_at": int(NOW.timestamp()), "play_count": 196446, "like_count": 1355,
                "comment_count": 158, "reshare_count": 40, "video_duration": 15.02, "user": {"username": "plaka"},
                "caption": {"text": "#kosova"}, "video_versions": [{"url": "https://cdn/v.mp4"}]}
        reply = {"sections": [{"layout_content": {"one_by_two_item": {"clips": {"items": [{"media": reel}]}},
                                                   "fill_items": [{"media": {"code": "P1", "media_type": 1}}]}}]}
        found = [c for m in cs.ig_medias(reply) if (c := cs.ig_raw_clip(m, "IG #kosova"))]
        self.assertEqual([(c["id"], c["plays"], c["author"], c["duration"], c["media_url"]) for c in found],
                         [("ig:De5", 196446, "plaka", 15, "https://cdn/v.mp4")])
        self.assertEqual(found[0]["created"], NOW.isoformat())

    def test_no_platform_takes_the_whole_run(self):
        ranked = [clip(i, platform="x", author=f"x{i}", score=9) for i in range(5)] + \
                 [clip(10 + i, author=f"t{i}", score=9) for i in range(5)]
        self.assertEqual([c["platform"] for c in cs.pick(ranked, {}, NOW)], ["x"] * 3 + ["tiktok"] * 3)

    def test_one_account_and_one_story_do_not_fill_the_run(self):
        ranked = [clip(i, platform="x", author="Tirana_Report", score=9) for i in range(3)] + \
                 [clip(10 + i, author=f"t{i}", score=9) for i in range(4)]
        state = {"verdicts": {f"tt:{10 + i}": {"keep": True, "story": "protesta në tiranë"} for i in range(4)}}
        got = [c["id"] for c in cs.pick(ranked, state, NOW)]
        self.assertEqual(got, ["tt:0", "tt:10", "tt:11"])
        state["queued"] = {f"q{i}": {"story": "protesta në tiranë", "found_at": NOW.isoformat()} for i in range(4)}
        self.assertEqual([c["id"] for c in cs.pick(ranked, state, NOW)], ["tt:0"])

    def test_an_ad_and_a_weak_find_are_not_picked(self):
        ranked = [clip(1, author="home.design", score=10), clip(2, author="news", score=9),
                  clip(3, author="slow", platform="x", score=5.4), clip(4, author="big", platform="x", score=6.3),
                  clip(5, author="yt", platform="youtube", score=3.9)]
        state = {"verdicts": {"tt:1": {"keep": False, "story": ""}}}
        self.assertEqual([c["id"] for c in cs.pick(ranked, state, NOW)], ["tt:2", "tt:4"])
        # Once the model has read the run, a find it did not reach is not picked.
        state["verdicts"]["tt:2"] = {"keep": True, "story": "lajm"}
        self.assertEqual([c["id"] for c in cs.pick(ranked, state, NOW, vetted=True)], ["tt:2"])

    def test_a_trend_is_not_the_country_itself(self):
        talk = [{"author": f"u{i}", "text": "Edi Rama sot #Albania #AlbaniaYouthRiseUp. Rama ikën!"} for i in range(5)]
        got = cs.x_trending(talk, [], {})
        self.assertNotIn("#Albania", got)
        self.assertNotIn("Rama", got)
        self.assertIn("#AlbaniaYouthRiseUp", got)

    def test_albanian_x_trends_are_counted_by_people_not_posts(self):
        talk = [{"author": f"u{i}", "text": f"Bujar Qamili sot në Kuvend #Rinesanca https://t.co/x @user{i}"} for i in range(4)]
        talk += [{"author": "spam", "text": "Shitet Bugatti"} for _ in range(10)]
        browser = [{"topic": "#InterFiorentina"}, {"topic": "Bujar Qamili"}, {"topic": "Tirana protest"}]
        state = {}
        got = cs.x_trending(talk, browser, state)
        self.assertEqual(set(got[:3]), {"Bujar Qamili", "Kuvend", "#Rinesanca"})
        self.assertNotIn("Shitet Bugatti", got)
        self.assertNotIn("#InterFiorentina", got)
        self.assertIn("Tirana protest", got)
        self.assertNotIn("Sot", got)
        # A term Albanian X always talks about is not a trend once it is usual.
        for _ in range(8):
            cs.x_trending(talk, [], state)
        self.assertGreater(state["x_terms"]["bujar qamil"], 3)

    def test_one_name_in_its_forms_is_one_trend(self):
        talk = [{"author": f"u{i}", "text": "Edi Rama foli sot" if i % 2 else "Kundër Edi Ramës. Është turp, Rama"} for i in range(6)]
        got = cs.x_trending(talk, [], {})
        self.assertIn(got[0], ("Edi Rama", "Edi Ramës"))
        self.assertNotIn("Rama", got)
        self.assertNotIn("Është", got)

    def test_instagram_says_what_to_do(self):
        self.assertIn("pass the check", cs.ig_problem('400 Bad Request - "fail" status, message "challenge_required"'))
        self.assertIn("expired", cs.ig_problem("login_required"))
        self.assertIn("expired", cs.ig_problem('403 Forbidden - "fail" status, message "user_has_logged_out"'))
        self.assertEqual(cs.ig_problem("JSON decode error"), "")

    def test_x_trends_become_hashtags(self):
        self.assertEqual(cs.as_tags(["#Kurti", "Real Madrid", "#Kurti", "AB"]), ["kurti", "realmadrid"])

    def test_a_broken_source_is_said_once_a_day(self):
        down = {"X": (False, "cookie expired"), "TikTok": (True, "900 video")}
        self.assertEqual(cs.health_lines(down), ["✗ X: cookie expired", "✓ TikTok: 900 video"])
        self.assertTrue(cs.should_email([], down, {}, NOW))
        self.assertFalse(cs.should_email([], down, {"alerted": (NOW - timedelta(hours=3)).isoformat()}, NOW))
        self.assertFalse(cs.should_email([], {"TikTok": (True, "x")}, {}, NOW))
        self.assertTrue(cs.should_email([{"headline": "h"}], {}, {}, NOW))

    def test_other_platforms_keep_their_own_usual_numbers(self):
        self.assertEqual(cs.author_key(clip(1, author="a")), "a")
        self.assertEqual(cs.author_key(clip(1, author="a", platform="instagram")), "instagram:a")


if __name__ == "__main__":
    unittest.main()
