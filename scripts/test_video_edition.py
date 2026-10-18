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


SHORT = GOOD.replace(" gjatë ditës së 17 tetorit", "")


class ScriptCheckTests(unittest.TestCase):
    def test_a_script_hard_to_follow_by_ear_fails(self):
        long = GOOD.replace("Kryeministri Lecornu tha se autoritetet druheshin nga dhuna",
                            "Kryeministri Lecornu tha se autoritetet e Francës dhe policia e Parisit druheshin shumë nga dhuna "
                            "e mundshme në rrugët e kryeqytetit francez gjatë gjithë kohës")
        ok, why = ve.check_script(long, STORY)
        self.assertFalse(ok)
        self.assertIn("sentence", why)
        story = {**STORY, "body": STORY["body"] + " Ishin 12 grupe dhe 9 sindikata."}
        ok, why = ve.check_script(GOOD + " Ishin 12 grupe.", story)
        self.assertFalse(ok)
        self.assertIn("numbers", why)

    def test_a_script_from_the_story_passes(self):
        self.assertEqual(ve.check_script(GOOD, STORY), (True, ""))

    def test_a_number_the_story_does_not_have_fails(self):
        ok, why = ve.check_script(GOOD.replace("600", "700"), STORY)
        self.assertFalse(ok)
        self.assertIn("700", why)

    def test_numbers_match_however_they_are_grouped(self):
        story = {**STORY, "body": "Çmimi arriti 1.250 euro."}
        self.assertEqual(ve.numbers_in("1 250"), ve.numbers_in("1.250"))
        self.assertTrue(ve.check_script(SHORT + " Çmimi arriti 1.250 euro.", {**story, "body": story["body"] + STORY["body"]})[0])

    def test_a_number_the_story_spells_out_counts(self):
        story = {**STORY, "body": STORY["body"] + " Ai pezulloi dy dispozita."}
        self.assertTrue(ve.check_script(SHORT + " Ai pezulloi 2 dispozita.", story)[0])

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

    def test_a_number_card_lands_with_a_hit(self):
        kinds = {s["kind"] for s in self.cues()["sfx"] if 6.0 <= s["at"] <= 7.0}
        self.assertIn("impact", kinds)

    def test_sounds_are_few_spread_out_and_under_the_voice(self):
        sfx = [s for s in self.cues()["sfx"] if s["kind"] != "riser"]  # a riser is the boom's lead-in
        self.assertLessEqual(len(sfx), max(4, int(22.0 / render.SFX_EVERY)))
        hits = sorted(s["at"] for s in sfx)
        self.assertTrue(all(b - a >= render.SFX_GAP - 0.6 for a, b in zip(hits, hits[1:])), hits)
        self.assertTrue(all(s["db"] <= -20 for s in self.cues()["sfx"]))
        self.assertEqual(sum(s["kind"] == "riser" for s in self.cues()["sfx"]), 1)

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


GAME = {
    "slug": "gjakove-ylli-mposht-vellaznimin-100-86", "category": "Sport",
    "title": "Golden Eagle Ylli mposht Vëllaznimin 100:86 në Gjakovë",
    "excerpt": "Ylli mori fitoren e tretë radhazi.",
    "body": "Ylli fitoi 100:86. Çereku i dytë përfundoi 29 me 22. Davontrey Thomas shënoi 26 pikë, Kentrell Pullian 28.",
}
GAME_SCRIPT = ("Golden Eagle Ylli fitoi 100:86 në Gjakovë. Në çerekun e dytë Ylli shënoi 29 pikë kundrejt 22. "
               "Davontrey Thomas udhëhoqi Yllin me 26 pikë.")


class GraphicsTests(unittest.TestCase):
    def test_graphics_keep_only_the_storys_numbers_and_names(self):
        got = ve.check_graphics([
            {"type": "score", "teams": [{"name": "Ylli", "score": "100"}, {"name": "Vëllaznimi", "score": "86"}], "note": "Superliga"},
            {"type": "compare", "label": "pikë në çerekun e dytë", "items": [{"name": "Ylli", "value": "29"}, {"name": "Vëllaznimi", "value": "22"}]},
            {"type": "compare", "label": "pikë në çerekun e tretë", "items": [{"name": "Ylli", "value": "31"}, {"name": "Vëllaznimi", "value": "22"}]},
            {"type": "person", "name": "Davontrey Thomas", "role": "26 pikë për Yllin"},
            {"type": "person", "name": "Kentrell Pullian", "role": "28 pikë"},
            {"type": "person", "name": "Luka Dončić", "role": "lojtar"},
        ], GAME_SCRIPT, GAME)
        self.assertEqual([g["type"] for g in got], ["score", "compare", "person"])
        self.assertEqual(got[0]["note"], "")  # one word: too short to say anything
        self.assertEqual(got[2]["name"], "Davontrey Thomas")

    def test_a_scoreboard_is_for_sport_only(self):
        score = [{"type": "score", "teams": [{"name": "Ylli", "score": "100"}, {"name": "Vëllaznimi", "score": "86"}]}]
        self.assertEqual(ve.check_graphics(score, GAME_SCRIPT, {**GAME, "category": "Politikë"}), [])

    def test_a_game_filed_under_another_section_is_still_sport(self):
        story = {**GAME, "category": "Kosovë", "body": GAME["body"] + " Ndeshja u luajt në palestrën e qytetit, në kampionat."}
        self.assertTrue(media.is_sport(story))
        self.assertFalse(media.is_sport({"category": "Kosovë", "title": "Qeveria miratoi buxhetin", "body": "Opozita kundër."}))

    def test_graphics_land_when_said_and_stay_off_the_cards(self):
        words = said(GAME_SCRIPT, 0.45)
        beats = [{"at": 0.0, "kind": "video"}, {"at": 3.0, "kind": "video"}, {"at": 7.0, "kind": "fact", "value": "26 pikë", "label": "x y"},
                 {"at": 10.4, "kind": "video"}, {"at": 13.0, "kind": "video"}]
        graphics = ve.check_graphics([
            {"type": "score", "teams": [{"name": "Ylli", "score": "100"}, {"name": "Vëllaznimi", "score": "86"}]},
            {"type": "person", "name": "Davontrey Thomas", "role": "26 pikë për Yllin"}], GAME_SCRIPT, GAME)
        out = media.build_overlays(beats, 16.0, words, graphics)
        kinds = [o["kind"] for o in out]
        self.assertIn("score", kinds)
        self.assertIn("bug", kinds)
        for o in out:
            self.assertFalse(o["at"] < 10.4 and o["at"] + o["len"] > 7.0, f"{o['kind']} over the card")
        main = [o for o in out if o["kind"] != "bug"]
        self.assertTrue(all(b["at"] >= a["at"] + a["len"] for a, b in zip(main, main[1:])))

    def test_the_climax_slams_and_the_words_below_give_way(self):
        words = said("Qeveria miratoi sot buxhetin e ri dhe opozita tha se kjo është një fitore e madhe për të gjithë sot")
        beats = [{"at": 0.0, "kind": "photo", "src": "a", "move": "in"}, {"at": 4.0, "kind": "photo", "src": "a", "move": "out"}]
        climax = render._word_at(words, "një fitore e madhe")
        out = media.build_overlays(beats, 9.0, words, [], climax)
        self.assertEqual([o["kind"] for o in out], ["slam"])
        cues = render.build_cues(beats, 9.0, words, {}, LIB, "s", out)
        page = render.compose({"duration": 9.0, "words": words, "title": "t", "category": "Politikë"}, beats, cues, {}, {"a": "img0.jpg"}, out)
        self.assertIn('class="slam"', page)
        self.assertEqual(page.count('class="hot"'), 1)

    def test_rich_footage_carries_the_clip(self):
        foot = [{"file": f"/f{i}.mp4", "credit": "Video: FBK · YouTube", "duration": media.CUT} for i in range(8)]
        photos = [{"src": "p.jpg", "credit": ""}]
        beats = media.build_beats(36.0, WORDS * 2, photos, [], None, None, foot)
        videos = [b for b in beats if b["kind"] == "video"]
        self.assertGreater(len(videos), 2 * sum(b["kind"] == "photo" for b in beats))
        self.assertEqual(len({b["file"] for b in videos}), min(8, len(videos)))
        ends = [b["at"] for b in beats[1:]] + [36.5]
        for b, e in zip(beats, ends):
            if b["kind"] == "video":
                self.assertLessEqual(e - b["at"] + 0.7, media.CUT + 1e-6)

    def test_moments_are_spread_and_start_on_new_shots(self):
        starts = media.pick_moments(120.0, [30.0, 47.3, 80.1], 6)
        self.assertEqual(len(starts), 6)
        self.assertTrue(all(b - a >= media.CUT for a, b in zip(starts, starts[1:])))
        self.assertIn(30.12, starts)
        self.assertGreaterEqual(starts[0], 120 * 0.06)


class PhotoTimingTests(unittest.TestCase):
    def test_a_persons_photo_comes_up_when_they_are_named(self):
        words = said("Presidenti Trump pezulloi sanksionet sot dhe pastaj sekretari Marco Rubio tha se do të shohë "
                     "ndikimin ndërsa presidenti Zelenskyy e quajti gabim këtë vendim të ri sot", 0.5)
        photos = [{"src": "trump.jpg", "who": "Donald Trump"}, {"src": "rubio.jpg", "who": "Marco Rubio"},
                  {"src": "zel.jpg", "who": "Volodymyr Zelenskyy"}]
        beats = media.build_beats(15.0, words, photos, [], None, None, [])
        def shown_at(t):
            return [b for b in beats if b["at"] <= t][-1]["src"]
        rubio, zel = render._word_at(words, "Rubio")[0], render._word_at(words, "Zelenskyy")[0]
        self.assertEqual(shown_at(rubio + 1.0), "rubio.jpg")
        self.assertEqual(shown_at(zel + 1.5), "zel.jpg")


class OfficialFootageTests(unittest.TestCase):
    def test_a_story_finds_the_channels_of_the_people_it_speaks_of(self):
        text = "Presidenti Donald Trump shtyu sanksionet. Zelenskyy e kritikoi. Rubio tha se do të vlerësojë."
        names = [n for _, n, _ in media.channels_for(text)]
        self.assertIn("The White House", names)
        self.assertIn("U.S. Department of State", names)
        self.assertTrue(any("Ukraine" in n or "Zelenskyy" in n for n in names))
        self.assertEqual(media.channels_for("Moti në Prishtinë sot ishte i ngrohtë."), [])

    def test_a_video_must_share_the_topic_not_just_the_name(self):
        keys = media.story_keys("Trump shtyn sanksionet ndaj Rusisë Russia sanctions delay")
        own = {"trump"}
        on_topic = media.story_keys("President Trump on Russia sanctions") & keys - own
        off_topic = media.story_keys("President Trump hosts first responders") & keys - own
        self.assertTrue(on_topic)
        self.assertFalse(off_topic)

    def test_without_a_judge_only_strong_official_uploads_are_kept(self):
        ve.ask_model = lambda prompt, label: ""  # the model is out of quota
        try:
            import tempfile, pathlib
            found = {"s": [{"id": "a", "channel": "News TV", "posted": "2026-10-18", "title": "x"},
                           {"id": "b", "channel": "The White House", "posted": "2026-10-18", "title": "y", "official": True, "score": 2},
                           {"id": "c", "channel": "The White House", "posted": "2026-10-18", "title": "z", "official": True, "score": 1}]}
            with tempfile.TemporaryDirectory() as d:
                got = ve.pick_footage(found, pathlib.Path(d), [])
            self.assertEqual([c["id"] for c in got["s"]], ["b"])
        finally:
            import importlib
            importlib.reload(ve)


class CoverTests(unittest.TestCase):
    def test_the_cover_keeps_only_the_storys_names_and_numbers(self):
        self.assertEqual(ve.check_cover("Ylli mposht Vëllaznimin 100:86", GAME), "Ylli mposht Vëllaznimin 100:86")
        self.assertEqual(ve.check_cover("Ylli fiton 110:86", GAME), "")
        self.assertEqual(ve.check_cover("Ylli mposht Partizanin", GAME), "")
        self.assertEqual(ve.check_cover("Ylli", GAME), "")
        self.assertEqual(ve.check_cover("A do ta besoni çfarë ndodhi sonte?", GAME), "")

    def test_without_a_cover_the_scoreboard_or_the_headline_says_it(self):
        look = {"graphics": [{"type": "score", "teams": [{"name": "Ylli", "score": "100"}, {"name": "Vëllaznimi", "score": "86"}]}], "facts": []}
        self.assertEqual(ve.fallback_cover(GAME, look), "Ylli 100:86")
        self.assertLessEqual(len(ve.fallback_cover(GAME, {"graphics": [], "facts": []})), 32)

    def test_the_strongest_word_is_orange(self):
        self.assertEqual(render.cover_words("Ylli fiton 100:86"), "Ylli fiton <b>100:86</b>")
        self.assertEqual(render.cover_words("Paqe në <Gaza>"), "Paqe në <b>&lt;Gaza&gt;</b>")


if __name__ == "__main__":
    unittest.main()
