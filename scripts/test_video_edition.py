import unittest
from datetime import datetime, timezone

import video_edition as ve
import video_edition_media as media

STORY = {
    "slug": "france-protesta-paris-600",
    "title": "Paris pret rreth 40 mijë veta në protestën e së shtunës",
    "excerpt": "Policia priste afro 200 mijë pjesëmarrës në Francë, ndërsa organizatorët kishin planifikuar mbi 600 tubime.",
    "body": "Kryeministri Sébastien Lecornu tha se autoritetet druheshin nga dhuna. Protesta mbahet më 17 tetor.",
}

GOOD = ("Rreth 40 mijë veta priteshin në protestën e Parisit të shtunën. Organizatorët planifikuan mbi 600 tubime, "
        "ndërsa policia priste afro 200 mijë pjesëmarrës në Francë. Kryeministri Lecornu tha se autoritetet "
        "druheshin nga dhuna gjatë ditës së 17 tetorit.")


class ScriptCheckTests(unittest.TestCase):
    def test_a_script_from_the_story_passes(self):
        self.assertEqual(ve.check_script(GOOD, STORY), (True, ""))

    def test_a_number_the_story_does_not_have_fails(self):
        ok, why = ve.check_script(GOOD.replace("600", "700"), STORY)
        self.assertFalse(ok)
        self.assertIn("700", why)

    def test_numbers_match_however_they_are_grouped(self):
        story = {**STORY, "body": "Çmimi arriti 1.250 euro."}
        self.assertEqual(ve.numbers_in("1 250"), ve.numbers_in("1.250"))
        self.assertTrue(ve.check_script(GOOD + " Çmimi arriti 1.250 euro.", {**story, "body": story["body"] + STORY["body"]})[0])

    def test_a_number_the_story_spells_out_counts(self):
        story = {**STORY, "body": STORY["body"] + " Ai pezulloi dy dispozita."}
        self.assertTrue(ve.check_script(GOOD + " Ai pezulloi 2 dispozita.", story)[0])

    def test_a_name_the_story_does_not_have_fails(self):
        ok, why = ve.check_script(GOOD.replace("Kryeministri Lecornu", "Kryeministri Macron"), STORY)
        self.assertFalse(ok)
        self.assertIn("Macron", why)

    def test_names_with_albanian_endings_and_spelled_out_names_pass(self):
        story = {**STORY, "body": STORY["body"] + " Kurti foli për SHBA."}
        script = GOOD + " Ai foli edhe për Kurtin dhe për Shtetet e Bashkuara."
        self.assertEqual(ve.check_script(script, story), (True, ""))

    def test_too_short_or_with_symbols_fails(self):
        self.assertFalse(ve.check_script("Paris pret 40 mijë veta.", STORY)[0])
        self.assertFalse(ve.check_script(GOOD + " Rritja ishte 5%.", {**STORY, "body": STORY["body"] + " 5"})[0])

    def test_the_fallback_is_the_story_s_own_words(self):
        self.assertEqual(ve.fallback_script(STORY), f"{STORY['title']}. {STORY['excerpt']}")

    def test_the_voice_gets_signs_in_words(self):
        self.assertEqual(ve.spoken("ra 3,5% në 12€"), "ra 3,5 për qind në 12 euro")

    def test_scripts_are_read_from_the_model_s_markers_only_for_asked_slugs(self):
        out = 'blah 383_JSON_BEGIN\n[{"slug": "a", "script": "Një  dy\\n tre"}, {"slug": "x", "script": "no"}]\n383_JSON_END'
        self.assertEqual(ve.parse_scripts(out, {"a"})["a"]["script"], "Një dy tre")
        self.assertEqual(set(ve.parse_scripts(out, {"a"})), {"a"})
        self.assertEqual(ve.parse_scripts("nothing", {"a"}), {})

    def test_a_story_s_hash_changes_with_its_words(self):
        self.assertNotEqual(ve.story_hash(STORY), ve.story_hash({**STORY, "body": STORY["body"] + " Më shumë."}))


class LookTests(unittest.TestCase):
    def test_a_number_shown_big_must_be_in_the_story_and_said(self):
        facts = [{"value": "40 mijë", "label": "veta në protestë"}, {"value": "70 mijë", "label": "veta në protestë"}]
        self.assertEqual(ve.check_facts(facts, GOOD, STORY), facts[:1])

    def test_a_quote_must_be_word_for_word_in_the_story(self):
        story = {**STORY, "body": 'Lecornu tha: "Ne druhemi nga dhuna sot." Më pas u largua.'}
        self.assertTrue(ve.check_quote({"text": "Ne druhemi nga dhuna sot.", "who": "Sébastien Lecornu"}, story))
        self.assertIsNone(ve.check_quote({"text": "Ne kemi frikë nga dhuna.", "who": "Lecornu"}, story))


class MediaTests(unittest.TestCase):
    def test_the_script_s_words_get_the_times_whisper_heard(self):
        heard = [[0.1, 0.4, "Rreth"], [0.5, 1.2, "40.000"], [1.3, 1.6, "veta"], [1.7, 2.2, "priteshin."]]
        words = media.align("Rreth 40 mijë veta priteshin.", heard, 2.5)
        self.assertEqual([w[2] for w in words], ["Rreth", "40", "mijë", "veta", "priteshin"])
        self.assertEqual(words[0][0], 0.1)
        self.assertTrue(0.5 <= words[1][0] < words[2][0] < 1.3)
        self.assertEqual(words[-1][3], 1)
        self.assertEqual([w[0] for w in words], sorted(w[0] for w in words))

    def test_words_never_heard_sit_between_their_neighbours(self):
        words = media.align("një dy tre katër", [[0.0, 0.3, "një"], [1.5, 1.8, "katër"]], 2.0)
        self.assertTrue(0.3 <= words[1][0] < words[2][0] < 1.5)

    def test_youtube_dates_read_as_shown(self):
        now = datetime(2026, 10, 17, tzinfo=timezone.utc)
        self.assertEqual(media.posted_on("Premiered Oct 16, 2026", now).day, 16)
        self.assertEqual(media.posted_on("Streamed live on Nov 15", now).year, 2025)
        self.assertEqual(media.posted_on("3 hours ago", now).day, 16)
        self.assertEqual(media.posted_on("Streamed 6h ago", now).hour, 18)
        self.assertEqual(media.posted_on("2 weeks ago", now).day, 3)
        self.assertIsNone(media.posted_on("nothing", now))

    def test_beats_change_every_few_seconds_and_show_a_number_when_it_is_said(self):
        words = [[i * 0.4, i * 0.4 + 0.35, w, 0] for i, w in enumerate(("fjalë " * 20 + "40 mijë " + "fjalë " * 50).split())]
        photos = [{"src": f"p{i}.jpg", "credit": ""} for i in range(4)]
        beats = media.build_beats(30.0, words, photos, [{"value": "40 mijë", "label": "veta"}], None, None,
                                  [{"id": "abcdefghijk", "channel": "CDU"}])
        times = [b["at"] for b in beats]
        self.assertEqual(times, sorted(times))
        self.assertEqual(beats[0]["at"], 0)
        self.assertTrue(all(b - a <= 6.0 for a, b in zip(times, times[1:] + [30.0])))
        fact = next(b for b in beats if b["kind"] == "fact")
        self.assertAlmostEqual(fact["at"], 8.0 - 0.15, places=2)
        self.assertTrue(any(b["kind"] == "video" for b in beats))
        shown = [b["src"] for b in beats if b["kind"] == "photo"]
        self.assertTrue(all(a != b for a, b in zip(shown, shown[1:])))



import re  # noqa: E402

import video_edition_render as render  # noqa: E402

LIB = {
    "burns": [{"file": f"burns/burn{n:02d}.mp4", "duration": 1.6, "peak": 0.7, "sound": f"burns/burn{n:02d}.wav"} for n in range(2, 6)],
    "sfx": {k: [{"file": f"sfx/{k}-{n}.wav", "duration": 3.0 if k in ("riser", "swell") else 1.0} for n in (1, 2)]
            for k in ("whoosh", "swish", "riser", "swell", "impact", "boom", "pop", "shutter", "tick")},
    "music": {m: [{"file": f"music/{m}-1.m4a", "duration": 60}] for m in render.MOODS},
}


def said(text, step=0.4):
    return [[round(i * step, 2), round(i * step + step - 0.05, 2), w, 0] for i, w in enumerate(text.split())]


WORDS = said("Qeveria miratoi sot buxhetin e ri me 90 mijë vende pune të reja për të rinjtë e Kosovës dhe "
             "opozita tha se kjo është një fitore e madhe për qytetarët por jo e mjaftueshme sipas saj sot")
BEATS = [{"at": 0.0, "kind": "photo", "src": "a", "move": "in"}, {"at": 3.0, "kind": "photo", "src": "b", "move": "left"},
         {"at": 6.0, "kind": "fact", "value": "90 mijë", "label": "vende pune të reja"},
         {"at": 9.2, "kind": "video", "file": "/x.mp4", "credit": "Video: Qeveria · YouTube"},
         {"at": 12.0, "kind": "photo", "src": "c", "move": "out"}, {"at": 15.0, "kind": "map", "src": "m", "label": "Prishtina"},
         {"at": 18.0, "kind": "photo", "src": "a", "move": "right"}]
META = {"mood": "serious", "hook": "Qeveria miratoi sot buxhetin e ri", "climax": "një fitore e madhe", "emphasis": ["90", "opozita"]}


class CueTests(unittest.TestCase):
    def cues(self, **kw):
        return render.build_cues(BEATS, 22.0, WORDS, {**META, **kw}, LIB, "story-slug")

    def test_one_move_per_beat_and_the_clip_opens_on_a_burn(self):
        c = self.cues()
        self.assertEqual(len(c["moves"]), len(BEATS))
        self.assertEqual(c["moves"][0], "burn")

    def test_burns_are_few_and_far_apart(self):
        cuts = [b["cut"] for b in self.cues()["burns"]]
        self.assertLessEqual(len(cuts), render.MAX_BURNS)
        self.assertTrue(all(b - a >= render.BURN_GAP for a, b in zip(cuts, cuts[1:])))

    def test_the_riser_lands_on_the_climax_and_a_boom_hits_it(self):
        c = self.cues()
        start = render._word_at(WORDS, META["climax"])[0]
        risers = [s for s in c["sfx"] if s["kind"] == "riser"]
        self.assertTrue(any(abs(s["at"] + 3.0 - start) < 0.01 for s in risers))
        self.assertTrue(any(s["kind"] == "boom" and abs(s["at"] - start) < 0.01 for s in c["sfx"]))

    def test_a_number_card_ticks_and_hits(self):
        kinds = {s["kind"] for s in self.cues()["sfx"] if 6.0 <= s["at"] <= 7.0}
        self.assertTrue({"tick", "impact"} <= kinds)

    def test_same_story_same_cut(self):
        self.assertEqual(self.cues(), self.cues())

    def test_music_follows_the_mood(self):
        self.assertEqual(self.cues(mood="tense")["music"], "music/tense-1.m4a")
        self.assertEqual(render.mood_for("Sport", ""), "bright")
        self.assertEqual(render.mood_for("Politikë", "calm"), "calm")

    def test_no_sound_before_the_clip_starts(self):
        self.assertTrue(all(s["at"] >= 0 for s in self.cues()["sfx"]))


class ComposeTests(unittest.TestCase):
    def html(self):
        cues = render.build_cues(BEATS, 22.0, WORDS, META, LIB, "story-slug")
        clip = {"duration": 22.0, "words": WORDS, "title": "Qeveria miratoi buxhetin", "category": "Politikë"}
        return render.compose(clip, BEATS, cues, META, {"a": "img0.jpg", "b": "img1.jpg", "c": "img4.jpg", "m": "img5.jpg", "/x.mp4": "foot3.mp4"})

    def test_clips_on_one_track_never_overlap(self):
        spans = {}
        for start, dur, track in re.findall(r'data-start="([\d.]+)" data-duration="([\d.]+)"[^>]*data-track-index="(\d+)"', self.html()):
            spans.setdefault(track, []).append((float(start), float(start) + float(dur)))
        for track, s in spans.items():
            s.sort()
            self.assertTrue(all(b[0] >= a[1] - 1e-6 for a, b in zip(s, s[1:])), f"track {track} overlaps: {s}")

    def test_every_word_is_on_screen_and_the_timeline_is_registered(self):
        page = self.html()
        self.assertEqual(page.count('class="w'), len(WORDS))
        self.assertIn("window.__timelines['root']", page)
        self.assertIn('data-composition-id="root"', page)

    def test_text_is_escaped(self):
        clip = {"duration": 5.0, "words": said("a <b> c"), "title": "<script>x</script>", "category": "A&B"}
        beats = [{"at": 0.0, "kind": "plain"}]
        page = render.compose(clip, beats, {"moves": ["cut"], "burns": [], "sfx": [], "music": ""}, {}, {})
        self.assertNotIn("<script>x", page)
        self.assertIn("&lt;b&gt;", page)

    def test_a_number_counts_up_to_what_is_said(self):
        self.assertEqual(render.count_target("90 mijë"), (90, 0, "", " mijë"))
        self.assertEqual(render.count_target("3,5 për qind"), (3.5, 1, "", " për qind"))
        self.assertEqual(render.count_target("16.000 euro")[0], 16000)
        self.assertIsNone(render.count_target("shumë"))


class FeelTests(unittest.TestCase):
    def test_cues_are_kept_only_when_they_are_the_scripts_words(self):
        script = "Qeveria miratoi sot buxhetin e ri. Opozita tha se kjo është një fitore e madhe."
        got = ve.check_feel({"mood": "serious", "hook": "Qeveria miratoi sot buxhetin e ri.", "climax": "një fitore e madhe",
                             "emphasis": ["Opozita", "Kurti"]}, script)
        self.assertEqual(got["climax"], "një fitore e madhe")
        self.assertEqual(got["emphasis"], ["Opozita"])
        self.assertTrue(got["hook"])
        bad = ve.check_feel({"mood": "angry", "hook": "Diçka tjetër", "climax": "fitore e pamundur"}, script)
        self.assertEqual((bad["mood"], bad["hook"], bad["climax"]), ("", "", ""))


class FillTests(unittest.TestCase):
    def test_a_story_without_photos_fills_with_its_footage_not_a_blank_screen(self):
        foot = [{"file": "/a.mp4", "credit": "Video: FBK · YouTube", "duration": 4.6}]
        beats = media.build_beats(24.0, WORDS, [], [], None, None, foot)
        self.assertFalse([b for b in beats if b["kind"] == "plain"])
        self.assertTrue(all(b["kind"] == "video" for b in beats))

    def test_a_score_is_not_counted_up(self):
        clip = {"duration": 8.0, "words": said("rezultati ishte 100:86 sot"), "title": "t", "category": "Sport"}
        beats = [{"at": 0.0, "kind": "fact", "value": "100:86", "label": "rezultati përfundimtar"}]
        page = render.compose(clip, beats, {"moves": ["cut"], "burns": [], "sfx": [], "music": ""}, {}, {})
        self.assertNotIn('"count"', page)


if __name__ == "__main__":
    unittest.main()
