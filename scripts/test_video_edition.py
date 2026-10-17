import unittest

import video_edition as ve

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
        self.assertEqual(ve.parse_scripts(out, {"a"}), {"a": "Një dy tre"})
        self.assertEqual(ve.parse_scripts("nothing", {"a"}), {})

    def test_a_story_s_hash_changes_with_its_words(self):
        self.assertNotEqual(ve.story_hash(STORY), ve.story_hash({**STORY, "body": STORY["body"] + " Më shumë."}))


if __name__ == "__main__":
    unittest.main()
