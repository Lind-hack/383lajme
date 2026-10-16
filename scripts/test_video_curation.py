import unittest
from datetime import datetime, timedelta, timezone

import video_curation as vc

NOW = datetime(2026, 10, 15, 12, tzinfo=timezone.utc)
NATO = next(cid for cid, name in vc.policy.CHANNELS.items() if name == "NATO")


def feed(*entries):
    return "<feed>" + "".join(
        f'<entry><yt:videoId>{vid}</yt:videoId><title>{t}</title>'
        f'<link rel="alternate" href="https://www.youtube.com/{kind}/{vid}"/>'
        f"<published>{when.isoformat()}</published></entry>"
        for vid, t, kind, when in entries) + "</feed>"


def candidate(**facts):
    base = {"uploader_channel_id": NATO, "width": 1080, "height": 1920, "duration_s": 40,
            "embeddable": True, "age_limit": 0, "live": False, "availability": "public"}
    return {"id": "aaaaaaaaaaa", "channel_id": NATO, "channel": "NATO", "facts": {**base, **facts}}


GOOD = {"safe": True, "copyright_ok": True, "engagement": 8, "title_sq": "NATO stërvitet në Detin Baltik"}


class FeedTests(unittest.TestCase):
    def test_keeps_only_recent_shorts(self):
        xml = feed(("aaaaaaaaaaa", "A short", "shorts", NOW - timedelta(hours=3)),
                   ("bbbbbbbbbbb", "A long video", "watch?v=", NOW - timedelta(hours=3)),
                   ("ccccccccccc", "Old short", "shorts", NOW - timedelta(days=5)))
        rows = vc.shorts_from_feed(xml, NATO, NOW)
        self.assertEqual([r["id"] for r in rows], ["aaaaaaaaaaa"])
        self.assertEqual(rows[0]["section"], "Botë")

    def test_sections(self):
        self.assertEqual(vc.section_of("Albin Kurti"), "Kosovë")
        self.assertEqual(vc.section_of("Real Madrid"), "Sport")
        self.assertEqual(vc.section_of("OpenAI"), "Teknologji")


class TextTests(unittest.TestCase):
    def test_vtt_to_text_drops_timing_and_repeats(self):
        vtt = "WEBVTT\nKind: captions\n\n00:00.000 --> 00:01.000\nHello <c>there</c>\n\n00:01.000 --> 00:02.000\nHello there\nGoal!\n"
        self.assertEqual(vc.vtt_to_text(vtt), "Hello there Goal!")

    def test_clean_title(self):
        self.assertEqual(vc.clean_title("Gol i Vitinhës 🔥 #UCL  #PSG"), "Gol i Vitinhës")

    def test_parse_verdicts_takes_only_known_ids(self):
        out = 'noise 383_JSON_BEGIN [{"id":"aaaaaaaaaaa","safe":true},{"id":"zzz"}] 383_JSON_END'
        self.assertEqual(list(vc.parse_verdicts(out, {"aaaaaaaaaaa"})), ["aaaaaaaaaaa"])
        self.assertEqual(vc.parse_verdicts("no markers", {"a"}), {})


class RuleTests(unittest.TestCase):
    def test_approves_a_good_official_short(self):
        self.assertEqual(vc.rules(candidate(), GOOD), (True, "ok"))

    def test_fixed_checks(self):
        self.assertFalse(vc.rules(candidate(uploader_channel_id="UCsomeoneelse"), GOOD)[0])
        self.assertFalse(vc.rules(candidate(width=1920, height=1080), GOOD)[0])
        self.assertFalse(vc.rules(candidate(duration_s=600), GOOD)[0])
        self.assertFalse(vc.rules(candidate(embeddable=False), GOOD)[0])
        self.assertFalse(vc.rules(candidate(age_limit=18), GOOD)[0])

    def test_feed_facts_trust_the_shorts_label_and_the_channel(self):
        c = candidate()
        c["facts"] = {"source": "feed", "uploader_channel_id": NATO, "width": None, "height": None, "duration_s": None,
                      "embeddable": True, "age_limit": 0, "live": False, "availability": "public"}
        self.assertEqual(vc.rules(c, GOOD), (True, "ok"))
        c["facts"]["embeddable"] = False
        self.assertFalse(vc.rules(c, GOOD)[0])

    def test_judge_has_the_last_word_on_safety_copyright_and_engagement(self):
        self.assertFalse(vc.rules(candidate(), {**GOOD, "safe": False})[0])
        self.assertFalse(vc.rules(candidate(), {**GOOD, "copyright_ok": "yes"})[0])
        self.assertFalse(vc.rules(candidate(), {**GOOD, "engagement": 4})[0])
        self.assertFalse(vc.rules(candidate(), {**GOOD, "title_sq": "#UCL"})[0])
        self.assertFalse(vc.rules(candidate(), None)[0])


class PickTests(unittest.TestCase):
    def test_keeps_last_week_best_first_with_age_and_outliers_counted(self):
        def entry(vid, days, score, approved=True, outlier=None):
            when = (NOW - timedelta(days=days)).isoformat()
            return {"approved": approved, "judged_at": when,
                    "pick": {"id": vid, "score": score, "publishedAt": when, "outlier": outlier}}
        state = {"a": entry("a", 0, 6), "b": entry("b", 0, 9), "c": entry("c", 2, 10), "d": entry("d", 9, 10),
                 "e": entry("e", 0, 10, approved=False), "f": entry("f", 0, 8, outlier=9)}
        # f: 8 + 3 = 11; b: 9 + 1 = 10; c: 10 + 1 - 1.5 = 9.5; a: 6 + 1 = 7. d is too old, e was rejected.
        self.assertEqual([p["id"] for p in vc.picks_from(state, NOW)], ["f", "b", "c", "a"])


if __name__ == "__main__":
    unittest.main()


class TikTokTests(unittest.TestCase):
    def test_a_tiktok_id_carries_its_posting_time(self):
        # 7697372712783596822 was posted 2026-10-16 20:57:23 UTC.
        self.assertEqual(vc.tt_created("7697372712783596822"), datetime(2026, 10, 16, 20, 57, 23, tzinfo=timezone.utc))
        self.assertIsNone(vc.tt_created("not-a-number"))

    def test_velocity_discounts_age(self):
        posted = NOW - timedelta(hours=16)
        self.assertEqual(vc.velocity(400_000, posted, NOW), 100_000)
        self.assertEqual(vc.velocity(50_000, NOW, NOW), 50_000)  # under an hour counts as one

    def test_tiktok_facts_must_be_upright_short_public_and_the_accounts_own(self):
        def tiktok(**facts):
            base = {"source": "tiktok-embed", "uploader_channel_id": "nba", "width": 576, "height": 1024, "duration_s": 21,
                    "embeddable": True, "age_limit": 0, "live": False, "availability": "public"}
            return {"platform": "tiktok", "id": "7697337967035125022", "channel_id": "nba", "channel": "NBA",
                    "facts": {**base, **facts}}
        self.assertEqual(vc.fixed_checks(tiktok()), (True, "ok"))
        self.assertFalse(vc.fixed_checks(tiktok(uploader_channel_id="nbafan"))[0])
        self.assertFalse(vc.fixed_checks(tiktok(width=1024, height=576))[0])
        self.assertFalse(vc.fixed_checks(tiktok(duration_s=600))[0])
        self.assertFalse(vc.fixed_checks(tiktok(availability="ad-or-private"))[0])
        self.assertEqual(vc.source_url("tiktok", "7697337967035125022", "nba"),
                         "https://www.tiktok.com/@nba/video/7697337967035125022")


class InstagramAndLearnTests(unittest.TestCase):
    def test_an_instagram_code_carries_its_posting_time(self):
        when = vc.ig_created("DaFxl8_s8Fk")
        self.assertEqual((when.year, when.month, when.day), (2026, 6, 27))
        self.assertIsNone(vc.ig_created("bad code!"))

    def test_instagram_like_counts_read_as_shown(self):
        self.assertEqual(vc.ig_count("26,225"), 26225)
        self.assertEqual(vc.ig_count("1.2M"), 1_200_000)
        self.assertEqual(vc.ig_count("43K"), 43_000)
        self.assertEqual(vc.ig_count(""), 0)

    def test_each_run_takes_the_next_topics_in_turn(self):
        items = list(range(10))
        first = vc.run_slice(items, 4, NOW)
        later = vc.run_slice(items, 4, NOW + timedelta(hours=2))
        self.assertEqual(len(first), 4)
        self.assertEqual(later[0], (first[0] + 4) % 10)
        self.assertEqual(vc.run_slice([], 4, NOW), [])

    def test_learn_videos_and_reels_count_from_approval_and_blocked_channels_never_show(self):
        def entry(vid, judged_days, published_days, **pick):
            return {"approved": True, "judged_at": (NOW - timedelta(days=judged_days)).isoformat(),
                    "pick": {"id": vid, "score": 8, "publishedAt": (NOW - timedelta(days=published_days)).isoformat(),
                             "approvedAt": (NOW - timedelta(days=judged_days)).isoformat(), **pick}}
        state = {
            "learn": entry("learn", 3, 200, kind="learn", platform="tiktok"),
            "old-learn": entry("old-learn", 30, 200, kind="learn", platform="tiktok"),
            "reel": entry("reel", 1, 40, platform="instagram"),
            "news": entry("news", 1, 9, platform="tiktok"),
            "fifa": entry("fifa", 0, 0, platform="youtube", channel="FIFA"),
        }
        self.assertEqual({p["id"] for p in vc.picks_from(state, NOW)}, {"learn", "reel"})

    def test_a_learn_video_needs_seven(self):
        c = candidate()
        c["kind"] = "learn"
        self.assertFalse(vc.rules(c, {**GOOD, "engagement": 6})[0])
        self.assertTrue(vc.rules(c, {**GOOD, "engagement": 7})[0])
