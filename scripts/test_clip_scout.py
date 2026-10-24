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


if __name__ == "__main__":
    unittest.main()
