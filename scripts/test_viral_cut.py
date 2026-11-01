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

    def test_without_the_model_the_loudest_go_in_order(self):
        plan = vc.plan_cut("Sherri në shtëpi", [{"headline": "Sherri i madh në shtëpinë e Big Brother sonte"}] * 2, self.analyses, key="")
        starts = [(u["src"], u["start"]) for u in plan["pieces"]]
        self.assertEqual(starts, sorted(starts))
        self.assertLessEqual(sum(vc.length(u) for u in plan["pieces"]), vc.TOTAL[1])
        self.assertEqual(plan["hook"], "Sherri i madh në shtëpinë e Big Brother sonte")
        self.assertIn(plan["kicker"], vc.KICKERS)


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

    def test_the_subtitle_file_has_the_hook_credits_and_closing_question(self):
        p = self.pieces()
        doc = vc.ass_doc(p, vc.timeline(p), 7.0, {"hook": "Sherr {i madh}", "kicker": "Kush ka të drejtë?", "origin": "Big Brother VIP Kosova"},
                         [], "Anton")
        self.assertIn("SHERR I MADH", doc)
        self.assertNotIn("{i madh}", doc)
        self.assertIn("Big Brother VIP Kosova · @a · TikTok", doc)
        self.assertIn("KUSH KA TË DREJTË?", doc)


@unittest.skipUnless(shutil.which("ffmpeg"), "needs ffmpeg")
class RenderTests(unittest.TestCase):
    def test_a_cut_renders_upright_with_sound(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            for name, size in (("a.mp4", "720x1280"), ("b.mp4", "1280x720")):
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc2=s={size}:r=30:d=12", "-f", "lavfi",
                                "-i", "sine=f=440:d=12", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
                                str(work / name)], check=True)
            sources = [{"file": work / "a.mp4", "author": "a", "platform": "tiktok", "headline": "Një moment i jashtëzakonshëm sot"},
                       {"file": work / "b.mp4", "author": "b", "platform": "x"}]
            out = vc.make_cut("test", sources, work / "out", key="", lib={"root": str(work)})
            self.assertIsNotNone(out)
            info = vc.probe(out["hd"])
            self.assertEqual((info["width"], info["height"]), (1080, 1920))
            self.assertTrue(info["audio"])
            self.assertAlmostEqual(info["duration"], out["duration"], delta=0.3)
            self.assertEqual(vc.probe(out["sd"])["width"], 720)
            self.assertTrue(out["thumb"].exists())


if __name__ == "__main__":
    unittest.main()
