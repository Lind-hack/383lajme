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


if __name__ == "__main__":
    unittest.main()
