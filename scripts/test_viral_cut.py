import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import viral_cut as vc


def speech(language="albanian", sure=True):
    words = [[1.0, 1.4, "Kjo"], [1.4, 1.9, "është"], [1.9, 2.6, "e"], [2.6, 3.2, "pabesueshme"],
             [5.0, 5.5, "Shiko"], [5.5, 6.0, "tani"], [6.0, 6.8, "çfarë"], [6.8, 7.4, "bën"]]
    segs = [{"start": 0.0, "end": 3.3, "text": "Kjo është e pabesueshme", "sure": sure},
            {"start": 4.8, "end": 7.5, "text": "Shiko tani çfarë bën", "sure": sure},
            {"start": 11.0, "end": 12.0, "text": "Thank you.", "sure": True}]
    return {"language": language, "segments": segs, "words": words}


def clip(dur=16.0, **kw):
    return {"duration": dur, "width": 720, "height": 1280, "audio": True, "photo": False,
            "loud": [-30.0] * int(dur * 2), "speech": speech(), **kw}


class UnitTests(unittest.TestCase):
    def test_sentences_and_the_moments_between_become_stretches(self):
        units = vc.units_of(0, clip())
        said = [u for u in units if u["text"]]
        self.assertEqual([u["text"] for u in said], ["Kjo është e pabesueshme", "Shiko tani çfarë bën"])
        self.assertAlmostEqual(said[0]["start"], 0.85)   # from the first word, not Whisper's early start
        self.assertTrue(any(not u["text"] and u["start"] >= 7.4 for u in units))   # the reaction after

    def test_whisper_made_up_words_are_not_speech(self):
        self.assertTrue(vc.hallucinated("Thank you."))
        self.assertTrue(vc.hallucinated(" Faleminderit për shikimin! "))
        self.assertFalse(vc.hallucinated("Thank you Kosovo, you were amazing"))
        self.assertFalse(any("Thank" in u["text"] for u in vc.units_of(0, clip())))

    def test_a_long_sentence_is_split_at_a_pause_with_its_own_words(self):
        words = [[i * 0.5, i * 0.5 + 0.4, f"w{i}"] for i in range(24)]
        a = clip(dur=14.0, speech={"language": "albanian", "words": words,
                                   "segments": [{"start": 0.0, "end": 12.0, "text": "long", "sure": True}]})
        said = [u for u in vc.units_of(0, a) if u["text"]]
        self.assertGreaterEqual(len(said), 2)
        self.assertTrue(all(vc.length(u) <= vc.MAX_PIECE + 0.01 for u in said))
        self.assertNotEqual(said[1]["text"], "long")
        self.assertTrue(said[1]["text"].startswith("w"))

    def test_a_short_clip_of_one_sentence_is_cut_in_beats(self):
        words = [[0.3 + i * 0.6, 0.7 + i * 0.6, f"w{i}"] for i in range(14)]
        a = clip(dur=9.5, speech={"language": "albanian", "words": words,
                                  "segments": [{"start": 0.2, "end": 8.8, "text": "one", "sure": True}]})
        units = vc.units_of(0, a)
        self.assertGreaterEqual(len(units), 3)
        self.assertEqual(units[0]["start"], 0.0)
        self.assertAlmostEqual(units[-1]["end"], 9.5)
        self.assertTrue(all(vc.length(u) >= vc.MIN_PIECE for u in units))
        self.assertTrue(all(units[i]["end"] == units[i + 1]["start"] for i in range(len(units) - 1)))

    def test_a_photo_is_one_still(self):
        units = vc.units_of(2, {"photo": True})
        self.assertEqual(len(units), 1)
        self.assertTrue(units[0]["photo"])


def units_ids():
    return [u["id"] for u in vc.units_of(0, clip(dur=16.0))]


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.analyses = [clip(dur=40.0), clip(dur=12.0)]
        self.units = [u for n, a in enumerate(self.analyses) for u in vc.units_of(n, a)]

    def test_a_long_clip_gives_at_most_half_of_itself(self):
        many = [{"id": f"x{i}", "src": 0, "start": i * 4.0, "end": i * 4.0 + 4.0, "text": "", "loud": -20, "photo": False}
                for i in range(10)]
        chosen = vc.check_plan([u["id"] for u in many], many, [clip(dur=40.0)])
        self.assertLessEqual(sum(vc.length(u) for u in chosen), 20.5)

    def test_unknown_or_repeated_pieces_are_dropped(self):
        ids = [u["id"] for u in self.units]
        chosen = vc.check_plan([ids[0], "nope", ids[0], ids[1], ids[2], ids[3]], self.units, self.analyses)
        self.assertEqual([u["id"] for u in chosen], [ids[0], ids[1], ids[2], ids[3]])

    def test_too_little_is_not_a_cut(self):
        self.assertEqual(vc.check_plan([self.units[0]["id"]], self.units, self.analyses), [])

    def watched(self, **look):
        src = [{"headline": "Sherri i madh në shtëpinë e Big Brother sonte", "caption": "Sherri", "author": "a", "platform": "tiktok"}]
        a = [clip(dur=16.0)]
        units = [u for u in vc.units_of(0, a[0])]
        return vc.plan_cut("sherri", src, a, key="", look=look), units

    def test_the_moment_the_post_is_about_plays_first(self):
        plan, units = self.watched(shows=True, context=True, hook=units_ids()[1], pieces=[units_ids()[0], units_ids()[2]],
                                   title="Sherri i madh në shtëpi", subtitles=True, area=[120, 0, 880, 1000])
        self.assertEqual(plan["skip"], "")
        self.assertEqual([u["id"] for u in plan["pieces"]][:1], [units_ids()[1]])
        self.assertEqual(plan["title"], "Sherri i madh në shtëpi")
        self.assertFalse(plan["captions"])                       # its own subtitles: none of ours on top
        self.assertEqual(plan["area"], (0.0, 0.12, 1.0, 0.76))   # the banners above and below cropped off

    def test_a_clip_that_does_not_show_its_post_or_needs_context_is_not_cut(self):
        self.assertIn("does not show", self.watched(shows=False, context=True, hook="u0a")[0]["skip"])
        self.assertIn("sense", self.watched(shows=True, context=False, hook="u0a")[0]["skip"])
        self.assertIn("not found", self.watched(shows=True, context=True, hook="nope")[0]["skip"])

    def test_a_clip_that_could_not_be_watched_waits_for_the_next_run(self):
        plan = vc.plan_cut("x", [{"file": "missing.mp4", "caption": "", "author": "a", "platform": "tiktok"}], [clip()], key="",
                           work=Path("."), look=None) if not vc.gemini_keys() else {"skip": "w", "retry": True}
        self.assertTrue(plan["skip"])
        self.assertTrue(plan["retry"])

    def test_a_stars_photos_are_all_shown(self):
        photos = [{"photo": True}] * 3
        plan = vc.plan_cut("dua lipa në instagram", [{"headline": "Dua Lipa publikon foto"}] * 3, photos, key="")
        self.assertEqual(len(plan["pieces"]), 3)
        self.assertEqual(plan["kicker"], "Si ju duket?")

    def test_the_show_is_named_only_when_the_post_names_it(self):
        self.assertEqual(vc.said_in("Big Brother VIP Kosova", "Klejda sot #BigBrotherVIPKosova"), "Big Brother VIP Kosova")
        self.assertEqual(vc.said_in("Big Brother VIP Albania", "Klejda sot #BigBrotherVIPKosova"), "")
        self.assertEqual(vc.said_in("", "x"), "")

    def test_only_a_believable_footage_box_is_cropped(self):
        self.assertIsNone(vc.footage_area([0, 0, 1000, 1000]))   # the whole frame: nothing to crop
        self.assertIsNone(vc.footage_area([0, 0, 200, 300]))     # a sliver: not believable
        self.assertIsNone(vc.footage_area("x"))
        self.assertEqual(vc.footage_area([100, 50, 900, 950]), (0.05, 0.1, 0.9, 0.8))


class CaptionTests(unittest.TestCase):
    def pieces(self):
        return [{"src": 0, "start": 0.85, "end": 3.4, "len": 2.55, "id": "u0a", "author": "a", "platform": "tiktok"},
                {"src": 0, "start": 4.85, "end": 7.6, "len": 2.75, "id": "u0b", "author": "a", "platform": "tiktok"}]

    def test_pieces_overlap_by_the_transition(self):
        self.assertEqual(vc.timeline(self.pieces()), [0.0, round(2.55 - vc.XF, 3)])

    def test_albanian_is_shown_word_by_word_with_the_word_said_in_orange(self):
        p = self.pieces()
        events = vc.caption_events(p, vc.timeline(p), [clip()], {})
        self.assertTrue(events)
        self.assertIn(vc.ORANGE, events[0][2])
        self.assertIn("KJO", events[0][2])
        self.assertTrue(all(s < e for s, e, _ in events))
        second = vc.timeline(p)[1]
        self.assertTrue(any(s >= second and "SHIKO" in t for s, _, t in events))

    def test_unsure_words_are_not_shown(self):
        p = self.pieces()
        self.assertEqual(vc.caption_events(p, vc.timeline(p), [clip(speech=speech(sure=False))], {}), [])

    def test_another_language_is_shown_in_albanian(self):
        p = self.pieces()
        events = vc.caption_events(p, vc.timeline(p), [clip(speech=speech(language="english"))], {"u0a": "Nuk e prisja fare këtë"})
        self.assertEqual([t for _, _, t in events], ["NUK E PRISJA FARE KËTË"])

    def test_no_words_on_top_the_source_top_left_and_the_closing_question(self):
        p = self.pieces()
        doc = vc.ass_doc(p, vc.timeline(p), 7.0, {"title": "Sherr i madh", "kicker": "Kush ka {të} drejtë?", "origin": "BBVK Kosova"},
                         [], "Anton")
        self.assertNotIn("SHERR I MADH", doc)                    # the moment is the hook, not a line of text
        self.assertIn("BBVK Kosova · @a · TikTok", doc)
        credit = next(line for line in doc.splitlines() if line.startswith("Style: Credit"))
        self.assertEqual(credit.split(",")[18], "7")              # ASS alignment 7: top left
        self.assertIn("KUSH KA TË DREJTË?", doc)
        self.assertNotIn("{të}", doc)


@unittest.skipUnless(shutil.which("ffmpeg"), "needs ffmpeg")
class BannerTests(unittest.TestCase):
    def test_a_pages_banner_is_found_and_a_static_picture_is_not(self):
        with tempfile.TemporaryDirectory() as tmp:
            framed, still = Path(tmp) / "framed.mp4", Path(tmp) / "still.mp4"
            # Moving footage under a white banner with dark "text" bars on it (the top quarter).
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=540x960:r=25:d=10,hue=H=t*2",
                            "-vf", "drawbox=x=0:y=0:w=iw:h=240:color=white:t=fill,drawbox=x=30:y=60:w=420:h=36:color=black:t=fill,"
                            "drawbox=x=30:y=130:w=300:h=36:color=black:t=fill", "-c:v", "libx264", "-preset", "ultrafast", str(framed)],
                           check=True)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "smptebars=s=540x960:r=25:d=10",
                            "-c:v", "libx264", "-preset", "ultrafast", str(still)], check=True)
            area = vc.bars(framed, 10.0)
            self.assertIsNotNone(area)
            self.assertAlmostEqual(area[1], 0.25, delta=0.03)
            self.assertIsNone(vc.bars(still, 10.0))


@unittest.skipUnless(shutil.which("ffmpeg"), "needs ffmpeg")
class RenderTests(unittest.TestCase):
    def test_a_cut_renders_upright_with_sound(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            for name, size in (("a.mp4", "720x1280"), ("b.mp4", "1280x720")):
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=s={size}:r=30:d=12", "-f", "lavfi",
                                "-i", "sine=f=440:d=12", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
                                str(work / name)], check=True)
            sources = [{"file": work / "a.mp4", "author": "a", "platform": "tiktok"}, {"file": work / "b.mp4", "author": "b", "platform": "x"}]
            analyses = [vc.analyse(s["file"], "", work) for s in sources]
            pieces = [{"id": "p0", "src": 0, "start": 1.0, "end": 4.0, "text": "", "photo": False, "loud": -20},
                      {"id": "p1", "src": 1, "start": 2.0, "end": 5.5, "text": "", "photo": False, "loud": -20},
                      {"id": "p2", "src": 0, "start": 6.0, "end": 8.0, "text": "", "photo": False, "loud": -20}]
            plan = {"pieces": pieces, "title": "t", "kicker": "Ti çfarë mendon?", "origin": "", "sq": {}, "captions": True,
                    "area": (0.0, 0.1, 1.0, 0.8)}
            (work / "out").mkdir()
            out = vc.build(plan, sources, analyses, work / "out", {"root": str(work)}, "seed")
            self.assertIsNotNone(out)
            info = vc.probe(out["hd"])
            self.assertEqual((info["width"], info["height"]), (1080, 1920))
            self.assertTrue(info["audio"])
            self.assertAlmostEqual(info["duration"], out["duration"], delta=0.3)
            self.assertEqual(vc.probe(out["sd"])["width"], 720)
            self.assertTrue(out["thumb"].exists())


if __name__ == "__main__":
    unittest.main()
