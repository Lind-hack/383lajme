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
    def test_keeps_last_week_newest_day_then_score(self):
        def entry(vid, days, score, approved=True):
            when = (NOW - timedelta(days=days)).isoformat()
            return {"approved": approved, "judged_at": when, "pick": {"id": vid, "score": score, "publishedAt": when}}
        state = {"a": entry("a", 0, 6), "b": entry("b", 0, 9), "c": entry("c", 2, 10), "d": entry("d", 9, 10),
                 "e": entry("e", 0, 10, approved=False)}
        self.assertEqual([p["id"] for p in vc.picks_from(state, NOW)], ["b", "a", "c"])


if __name__ == "__main__":
    unittest.main()
