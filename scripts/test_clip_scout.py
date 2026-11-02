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

    def test_the_site_gets_only_finds_passed_for_it(self):
        def entry(i, **kw):
            return {"id": f"tt:{i}", "site": True, "status": "ready", "file": f"https://s/{i}.mp4", "score": 10 - i,
                    "found_at": NOW.isoformat(), "duration": 30, "headline": "h", **kw}
        state = {"queued": {e["id"]: e for e in [
            entry(1), entry(2, site=False), entry(3, status="ready (no text)"), entry(4, found_at=(NOW - timedelta(hours=30)).isoformat()),
            entry(5), entry(6, duration=400), entry(7, site=None), entry(8, file="")]}}
        got = cs.on_site(state, NOW, removed={"tt:5"})
        self.assertEqual([e["id"] for e in got], ["tt:1", "tt:6"])
        self.assertEqual(got[1]["duration"], 180)

    def test_the_take_down_link_is_signed_for_one_find(self):
        import os
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "k"
        # The same sum as app/api/virale/hiq (Node: createHmac("sha256","k").update("clip-scout-remove:tt:1")).
        self.assertEqual(cs.sign("tt:1"), "389ab0f8b463f31d93ce49b2a0c35f7e")
        self.assertNotEqual(cs.sign("tt:1"), cs.sign("tt:2"))
        self.assertIn("/api/virale/hiq?id=tt%3A1&t=", cs.remove_link("tt:1"))

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


class ViralCutTests(unittest.TestCase):
    """"Virale sot": the day's finds grouped by story for viral_cut.py, and what the site gets."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_raw, cs.RAW = cs.RAW, Path(self.tmp.name)

    def tearDown(self):
        cs.RAW = self.old_raw
        self.tmp.cleanup()

    def found(self, i, story, score=8.0, site=True, hours=2, raw=True, **kw):
        if raw:
            cs.raw_path(f"tt:{i}").write_bytes(b"x")
        return {"id": f"tt:{i}", "platform": "tiktok", "author": f"a{i}", "link": f"https://www.tiktok.com/@a{i}/video/{i}",
                "story": story, "score": score, "site": site, "status": "ready", "kind": "bbk",
                "found_at": (NOW - timedelta(hours=hours)).isoformat(), **kw}

    def state(self, *entries):
        return {"queued": {e["id"]: e for e in entries}}

    def test_clips_of_one_story_are_cut_together_best_story_first(self):
        state = self.state(self.found(1, "sherri i big brother", 9), self.found(2, "sherri i big brother", 7.5),
                           self.found(3, "dua lipa në prishtinë", 8.5))
        groups = cs.cut_groups(state, NOW, set())
        self.assertEqual([g[0] for g in groups], ["sherri i big brother", "dua lipa në prishtinë"])
        self.assertEqual([e["id"] for e in groups[0][1]], ["tt:1", "tt:2"])

    def test_only_what_may_go_up_today_with_its_file_is_cut(self):
        state = self.state(self.found(1, "a", site=False), self.found(2, "b", hours=30), self.found(3, "c", raw=False),
                           self.found(4, "d"))
        self.assertEqual([g[0] for g in cs.cut_groups(state, NOW, set())], ["d"])

    def test_a_cut_or_a_clip_taken_down_stays_down(self):
        state = self.state(self.found(1, "a"), self.found(2, "a"), self.found(3, "b"))
        groups = cs.cut_groups(state, NOW, {"tt:1", cs.cut_id("b")})
        self.assertEqual([(g[0], [e["id"] for e in g[1]]) for g in groups], [("a", ["tt:2"])])

    def test_the_site_never_shows_a_cut_with_a_clip_taken_down(self):
        made = NOW.isoformat()
        state = {"cuts": {"cut:1": {"id": "cut:1", "file": "f", "made_at": made, "score": 9, "sources": [{"id": "tt:1"}], "style": 2},
                          "cut:2": {"id": "cut:2", "file": "f", "made_at": made, "score": 8, "sources": [{"id": "tt:2"}], "style": 2},
                          "cut:3": {"id": "cut:3", "file": "f", "made_at": (NOW - timedelta(hours=30)).isoformat(), "sources": [], "style": 2},
                          "cut:4": {"id": "cut:4", "file": "f", "made_at": made, "score": 9.5, "sources": []}}}   # the old style
        self.assertEqual([c["id"] for c in cs.on_site_cuts(state, NOW, {"tt:1"})], ["cut:2"])
        self.assertEqual([c["id"] for c in cs.on_site_cuts(state, NOW, set())], ["cut:1", "cut:2"])

    def test_a_cut_id_fits_the_take_down_link(self):
        import re
        self.assertRegex(cs.cut_id("sherri i big brother"), re.compile(r"^[a-z]{1,3}:[A-Za-z0-9_-]{3,40}$"))
        self.assertEqual(cs.cut_id("x"), cs.cut_id("x"))

    def test_a_stars_photo_post_is_read_as_stills(self):
        m = {"media_type": 8, "code": "ABC", "taken_at": int(NOW.timestamp()), "user": {"username": "dualipa", "full_name": "Dua Lipa"},
             "like_count": 2_000_000, "carousel_media": [{"media_type": 1, "image_versions2": {"candidates": [{"url": "https://i/1.jpg"}]}},
                                                          {"media_type": 2, "image_versions2": {"candidates": [{"url": "https://i/v.jpg"}]}},
                                                          {"media_type": 1, "image_versions2": {"candidates": [{"url": "https://i/2.jpg"}]}}]}
        p = cs.ig_raw_photos(m, "IG @dualipa")
        self.assertEqual(p["photos"], ["https://i/1.jpg", "https://i/2.jpg"])
        self.assertEqual(p["link"], "https://www.instagram.com/p/ABC/")
        self.assertIsNone(cs.ig_raw_photos({"media_type": 2, "code": "V"}, ""))

    def test_only_what_the_model_clears_as_safe_goes_up(self):
        import os
        replies = {"items": [{"n": 1, "keep": True, "unsafe": False, "story": "sherri i big brother", "kind": "bbk"},
                             {"n": 2, "keep": True, "story": "x"},   # unsafe not said: not cleared
                             {"n": 3, "keep": True, "unsafe": True, "story": "y"}]}
        old_json, old_key = cs.groq_json, os.environ.get("GROQ_API_KEY")
        cs.groq_json, os.environ["GROQ_API_KEY"] = (lambda *a, **k: replies), "k"
        try:
            state = {}
            self.assertTrue(cs.vet([clip(1), clip(2), clip(3)], state, NOW))
        finally:
            cs.groq_json = old_json
            if old_key is None:
                os.environ.pop("GROQ_API_KEY", None)
            else:
                os.environ["GROQ_API_KEY"] = old_key
        v = state["verdicts"]
        self.assertEqual([v[f"tt:{i}"]["site"] for i in (1, 2, 3)], [True, False, False])
        self.assertEqual(v["tt:1"]["kind"], "bbk")

    def test_finds_judged_by_the_old_rule_are_judged_again(self):
        state = self.state(self.found(1, "a", site=False, caption="Sherri në shtëpi"))
        state["verdicts"] = {"tt:1": {"keep": True, "site": False, "story": "a", "at": NOW.isoformat()}}
        old_vet = cs.vet

        def fake_vet(items, st, now):
            for e in items:
                st["verdicts"][e["id"]] = {"keep": True, "site": True, "unsafe": False, "story": "sherri", "kind": "bbk", "at": now.isoformat()}
            return True
        cs.vet = fake_vet
        try:
            cs.recheck(state, NOW)
        finally:
            cs.vet = old_vet
        self.assertEqual((state["queued"]["tt:1"]["site"], state["queued"]["tt:1"]["kind"]), (True, "bbk"))

    def test_a_find_without_its_original_is_fetched_again(self):
        state = self.state(self.found(1, "a", raw=False), self.found(2, "b", raw=False, site=False))
        old_dl = cs.download
        cs.download = lambda c, out: out.write_bytes(b"v" * 10) or True
        try:
            self.assertEqual(cs.backfill_raw(state, NOW, set()), 1)
        finally:
            cs.download = old_dl
        self.assertTrue(cs.raw_path("tt:1").exists())
        self.assertFalse(cs.raw_path("tt:2").exists())

    def test_no_one_kind_fills_the_row(self):
        made = NOW.isoformat()
        cuts = {f"cut:{i}": {"id": f"cut:{i}", "file": "f", "made_at": made, "score": 10 - i, "sources": [], "style": 2,
                             "kind": "bbk" if i < 5 else "sport"} for i in range(7)}
        kinds = [c["kind"] for c in cs.on_site_cuts({"cuts": cuts}, NOW, set())]
        self.assertEqual(kinds, ["bbk", "bbk", "bbk", "sport", "sport"])

    def test_a_pirate_page_already_in_the_queue_is_never_cut_or_shown(self):
        state = self.state(self.found(1, "prank", author="bbvks.com"), self.found(2, "olti"))
        self.assertEqual([g[0] for g in cs.cut_groups(state, NOW, set())], ["olti"])
        made = NOW.isoformat()
        cuts = {"cut:1": {"id": "cut:1", "file": "f", "made_at": made, "score": 9, "style": 2,
                          "sources": [{"id": "tt:1", "author": "bbvks.com"}]}}
        self.assertEqual(cs.on_site_cuts({"cuts": cuts}, NOW, set()), [])

    def test_the_published_email_links_each_cut_its_source_and_its_take_down(self):
        cut = {"id": "cut:0123456789abcdef", "title": "Olti Curri sherr me Antonetën", "kind": "bbk", "duration": 21.4,
               "thumb": "https://s/t.jpg", "sources": [{"author": "fokus.media87", "link": "https://www.tiktok.com/@fokus.media87/video/1"}]}
        subject, text, html = cs.published_mail([cut])
        self.assertEqual(subject, "383 Virale sot: Olti Curri sherr me Antonetën")
        self.assertIn("https://383ks.com/video/virale-cut-0123456789abcdef", html)
        self.assertIn("@fokus.media87", html)
        self.assertIn("/api/virale/hiq?", html)
        self.assertIn("2 të reja", cs.published_mail([cut, {**cut, "id": "cut:1"}])[0])
        self.assertNotIn("<", text)

    def test_apify_items_become_reels_and_star_photo_posts(self):
        reel = {"type": "Video", "shortCode": "R1", "videoUrl": "https://cdn/v.mp4", "videoPlayCount": 120000,
                "likesCount": -1, "timestamp": "2026-11-02T17:00:03.000Z", "ownerUsername": "dualipa", "videoDuration": 14.6}
        c = cs.apify_clip(reel, "IG @dualipa")
        self.assertEqual((c["id"], c["plays"], c["likes"], c["duration"], c["media_url"]), ("ig:R1", 120000, 0, 14, "https://cdn/v.mp4"))
        self.assertTrue(c["created"].startswith("2026-11-02T17:00:03"))
        side = {"type": "Sidecar", "shortCode": "S1", "ownerUsername": "dualipa",
                "childPosts": [{"type": "Image", "displayUrl": f"https://cdn/{i}.jpg"} for i in range(6)] + [{"type": "Video", "displayUrl": "x"}]}
        self.assertEqual(cs.apify_photos(side, "")["photos"], [f"https://cdn/{i}.jpg" for i in range(4)])
        self.assertEqual(cs.apify_photos({"type": "Image", "shortCode": "I1", "displayUrl": "https://cdn/i.jpg"}, "")["photos"], ["https://cdn/i.jpg"])
        self.assertIsNone(cs.apify_clip({"type": "Image", "shortCode": "I1"}, ""))
        self.assertIsNone(cs.apify_photos(reel, ""))

    def test_instagram_is_read_once_a_day_and_never_past_the_free_credit(self):
        now = cs.datetime(2026, 11, 2, 9, tzinfo=cs.timezone.utc)
        calls = []
        def fake(path, token, body=None, timeout=60):
            calls.append(path)
            if path == "users/me/limits":
                return {"data": {"current": {"monthlyUsageUsd": used}}}
            return [{"type": "Video", "shortCode": "R1", "videoUrl": "u", "ownerUsername": "dualipa"},
                    {"type": "Image", "shortCode": "I1", "displayUrl": "d", "ownerUsername": "dualipa"},
                    {"type": "Image", "shortCode": "I2", "displayUrl": "d", "ownerUsername": "service95bookclub"}]
        old = cs.apify
        cs.apify = fake
        try:
            used = 4.9
            self.assertIn("skip", cs.ig_apify({}, "t", now))
            used, state = 0.4, {}
            got = cs.ig_apify(state, "t", now)
            self.assertEqual([c["id"] for c in got["clips"]], ["ig:R1"])
            self.assertEqual([p["id"] for p in got["photos"]], ["ig:I1"])  # another owner's post is no star photo
            n = len(calls)
            self.assertIn("skip", cs.ig_apify(state, "t", now))
            self.assertEqual(len(calls), n)  # nothing asked of Apify the second time today
        finally:
            cs.apify = old

    def social_post(self, **kw):
        base = {"platform": "x", "id": "x:1", "link": "https://x.com/albinkurti/status/1", "author": "albinkurti",
                "author_name": "Albin Kurti", "caption": "Serbia must recognise Kosovo. No more games, no more delays.",
                "created": "2026-11-02T08:00:00+00:00", "likes": 4200, "comments": 300, "plays": 90000, "photos": []}
        return {**base, **kw}

    def test_the_social_desk_takes_only_watched_people_fresh_and_big_once_a_day(self):
        now = cs.datetime(2026, 11, 2, 12, tzinfo=cs.timezone.utc)
        posts = [self.social_post(),
                 self.social_post(id="x:2", author="AlbinKurti_fan", author_name="Albin Kurti fan"),     # not watched
                 self.social_post(id="x:3", author="ediramaal", author_name="Rama Fans"),                # name lacks "Rama"? has it
                 self.social_post(id="x:4", author="vjosaosmani", author_name="Someone else"),           # wrong name
                 self.social_post(id="x:5", likes=10),                                                   # too small
                 self.social_post(id="x:6", created="2026-10-30T08:00:00+00:00"),                        # too old
                 self.social_post(id="ig:A", platform="instagram", author="dualipa", author_name="DUA LIPA", likes=900000,
                                  caption="", photos=["https://cdn/a.jpg"])]
        state = {"social_done": {"x:3": "2026-11-02T09:00:00+00:00"}, "social_people": {"2026-11-02": ["Dua Lipa"]}}
        got = cs.social_candidates(state, posts, now)
        self.assertEqual([c["id"] for c in got], ["x:1"])
        self.assertEqual((got[0]["person"], got[0]["desk"]), ("Albin Kurti", "Kosovë"))
        self.assertEqual([c["id"] for c in cs.social_candidates({}, posts, now)], ["ig:A", "x:1", "x:3"])

    def test_a_social_article_carries_the_post_its_photo_credit_and_html_paragraphs(self):
        now = cs.datetime(2026, 11, 2, 12, tzinfo=cs.timezone.utc)
        post = {**self.social_post(platform="instagram", author="dualipa", author_name="DUA LIPA",
                                   link="https://www.instagram.com/p/A/", likes=1234567), "person": "Dua Lipa", "desk": "Showbiz"}
        w = {"title": "Dua Lipa ndez rrjetin me fotot e reja nga Halloween", "excerpt": "Këngëtarja publikoi fotot e saj të reja.",
             "body": "Paragrafi i parë <b>.\n\nParagrafi i dytë.", "caption": "Dua Lipa në fotot e reja", "score": 7}
        img = {"url": "https://s/news/a.jpg", "width": 1080, "height": 1350,
               "rights": {"creator": "Instagram / @dualipa", "provider": "social-post", "source_page": post["link"]}}
        art = cs.social_article(post, w, img, "social-2026-11-02T1215", now)
        self.assertEqual(art["body"], "<p>Paragrafi i parë &lt;b&gt;.</p><p>Paragrafi i dytë.</p>")
        self.assertTrue(art["slug"].startswith("dua-lipa-ndez-rrjetin-me-fotot-e-reja-nga-halloween-"))
        self.assertEqual((art["category"], art["social_platform"], art["social_post_url"]), ("Showbiz", "instagram", post["link"]))
        self.assertEqual(art["raw_article"]["image_rights"]["creator"], "Instagram / @dualipa")
        self.assertEqual(art["raw_article"]["image_caption"], "Dua Lipa në fotot e reja")
        self.assertEqual(art["score_reason"], "Postim i Dua Lipa në Instagram: 1.234.567 pëlqime")
        self.assertNotIn("raw_article", art["raw_article"])
        json = __import__("json")
        json.dumps(art, ensure_ascii=False)

    def test_the_social_desk_publishes_one_batch_and_remembers_what_it_judged(self):
        now = cs.datetime(2026, 11, 2, 12, tzinfo=cs.timezone.utc)
        posts = [self.social_post(), self.social_post(id="x:9", author="ediramaal", author_name="Edi Rama", likes=8000)]
        calls = []
        olds = (cs.gemini_json, cs.social_image, cs.rest)
        cs.gemini_json = lambda prompt: {"articles": [
            {"id": "x:1", "title": "Kurti: Serbia duhet ta njohë Kosovën, pa më lojëra", "excerpt": "Kryeministri shkroi në X se koha e vonesave ka mbaruar.",
             "body": "Kryeministri Albin Kurti shkroi në X se Serbia duhet ta njohë Kosovën. " * 6, "caption": "Albin Kurti", "score": 8},
            {"id": "x:9", "title": "Rama uron", "excerpt": "x", "body": "y", "score": 3}]}
        cs.social_image = lambda post, stem: {"url": "https://s/c.jpg", "width": 1200, "height": 675,
                                               "rights": {"creator": "383", "provider": "383-card", "source_page": post["link"]}}
        cs.rest = lambda method, table, payload, query="", prefer="": (calls.append((table, payload)), (201, b""))[1]
        try:
            state = {}
            got = cs.social_desk(state, posts, now)
        finally:
            cs.gemini_json, cs.social_image, cs.rest = olds
        self.assertEqual([a["id"][:7] for a in got], ["social-"])
        self.assertEqual([c[0] for c in calls], ["news_batches", "news_articles"])
        self.assertEqual(calls[0][1]["article_count"], 1)
        self.assertEqual(calls[1][1][0]["batch_key"], calls[0][1]["batch_key"])
        self.assertEqual(sorted(state["social_done"]), ["x:1", "x:9"])
        self.assertEqual(state["social_people"], {"2026-11-02": ["Albin Kurti"]})

    def test_a_text_only_x_post_gets_a_383_quote_card(self):
        import shutil
        import tempfile
        if not shutil.which("ffmpeg"):
            self.skipTest("no ffmpeg")
        font = next((f for f in ("C:/Windows/Fonts/arialbd.ttf", cs.FONT) if cs.os.path.exists(f)), None)
        if not font:
            self.skipTest("no font")
        old = cs.FONT
        cs.FONT = font
        try:
            with tempfile.TemporaryDirectory() as tmp:
                work = cs.Path(tmp)
                post = {**self.social_post(caption="Serbia must recognise Kosovo. No more games, no more delays, no more excuses "
                                                   "from Belgrade: the agreement is on the table and it must be implemented now."),
                        "person": "Albin Kurti"}
                out = work / "photo.jpg"
                self.assertTrue(cs.quote_card(post, out, work))
                self.assertEqual(cs.probe_size(out), (1200, 675))
        finally:
            cs.FONT = old

    def test_pages_selling_a_pirate_stream_are_never_sources(self):
        self.assertTrue(cs.pirate({"author": "bbvks.com", "caption": "Prank-u i Fuegos"}))
        self.assertTrue(cs.pirate({"author": "bbk_live", "caption": "SHIKO FALAS BIG BROTHER VIP 24/7"}))
        self.assertFalse(cs.pirate({"author": "fokus.media87", "caption": "Olti Curri i jep Antonetës gjeste"}))

    def test_the_stars_posts_count_as_albanian_showbiz(self):
        self.assertTrue(cs.is_albanian(clip(1, platform="instagram", author="ritaora", caption="London tonight")))
        self.assertFalse(cs.is_albanian(clip(2, platform="instagram", author="someone", caption="London tonight")))


if __name__ == "__main__":
    unittest.main()
