import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import news_image_policy as policy
from news_photo_subjects import grounded, publisher_names, subject_allowed, wiki_identity_allowed


def wiki_page(title, image, description="", qid="Q1"):
    return {"title": title, "pageimage": image, "index": 1,
            "terms": {"description": [description]}, "pageprops": {"wikibase_item": qid}}


class PhotoSubjectGroundingTests(unittest.TestCase):
    def setUp(self):
        policy._wiki_search.cache_clear()
        policy._identity_claims.cache_clear()

    def test_robotaxi_brands_keep_complete_case_and_dot_names(self):
        title = "Uber rival inDrive eyes robotaxi tests with Pony.ai and Nvidia"
        text = ("Ride-hailing company inDrive is working with Pony.ai and Nvidia. "
                "Pony.ai will bring robotaxis to the inDrive platform.")
        names = policy.story_names(title, text)
        self.assertIn("inDrive", names)
        self.assertIn("Pony.ai", names)
        self.assertNotIn("Drive", names)
        self.assertNotIn("Pony", names)

    def test_mixed_case_subjects_still_require_a_name_in_the_source_text(self):
        self.assertIn("eBay", policy.story_names("eBay announces a change", "eBay announced a change."))
        self.assertNotIn("inDrive", policy.story_names("inDrive announces a change", "A company announced a change."))
        self.assertFalse(grounded("Drive", "inDrive is testing robotaxis"))

    def test_identity_requests_are_reused_but_request_failures_are_not_cached(self):
        response = SimpleNamespace(json=lambda: {"claims": {"P31": [
            {"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}]}})
        with patch.object(policy, "api_get", return_value=response) as api:
            self.assertTrue(policy.is_person("Q123"))
            self.assertTrue(policy.is_person("Q123"))
            self.assertEqual(api.call_count, 1)
        policy._identity_claims.cache_clear()
        with patch.object(policy, "api_get", side_effect=[policy.requests.Timeout(), response]) as api:
            self.assertFalse(policy.is_person("Q123"))
            self.assertTrue(policy.is_person("Q123"))
            self.assertEqual(api.call_count, 2)

    def test_rama_and_tusk_namesakes_do_not_become_photo_plans(self):
        fixtures = [
            ("Rama", "Edi Rama", "Edi Ramës i kërkohet përgjigje për protestën.",
             wiki_page("Rama", "Lord_Rama_with_arrows.jpg", "Hindu deity")),
            ("Tusk", "Donald Tusk", "Donald Tusk discussed Poland's government.",
             wiki_page("Tusk", "Xavliodontes.jpg", "elongated continuously growing front teeth")),
        ]
        for searched, person, evidence, wrong in fixtures:
            right = wiki_page(person, person.replace(" ", "_") + ".jpg", "European politician", "Q2")
            response = SimpleNamespace(json=lambda: {"query": {"pages": {"1": wrong, "2": right}}})
            lead = {"title": searched + " answers questions", "category": "Botë",
                    "primary_evidence": {"text": evidence}}
            with self.subTest(searched=searched), patch.object(policy, "api_get", return_value=response), \
                    patch.object(policy, "is_person", side_effect=lambda qid: qid == "Q2"), \
                    patch.object(policy, "is_place", return_value=False):
                found = list(policy._wiki_pages(lead, [searched], set(), set()))
                self.assertEqual([plan["subject"] for _, plan in found], [person])

    def test_okb_does_not_resolve_to_an_aircraft_design_bureau(self):
        page = wiki_page("OKB", "Sukhoi-okb.JPG", "Soviet experimental aircraft design bureau")
        self.assertFalse(wiki_identity_allowed(page, "OKB", "OKB diskuton për Kosovën.", "Kosovë", set()))

    def test_barcelona_team_does_not_resolve_to_the_city(self):
        evidence = "Barcelona won the football match in the Champions League."
        city = wiki_page("Barcelona", "Evening_light_over_Barcelona.jpg", "city in Spain")
        club = wiki_page("FC Barcelona", "Barcelona_team_2026.jpg", "Spanish professional association football club")
        self.assertFalse(wiki_identity_allowed(city, "Barcelona", evidence, "Sport", set()))
        self.assertTrue(wiki_identity_allowed(club, "Barcelona", evidence, "Sport", set()))

    def test_named_person_and_explicit_place_remain_eligible(self):
        evidence = "Robert Fico spoke at the rally in Novi Sad."
        for name, description in [("Robert Fico", "Slovak politician"), ("Novi Sad", "city in Serbia")]:
            self.assertTrue(wiki_identity_allowed(wiki_page(name, name + ".jpg", description),
                                                 name, evidence, "Botë", set()))

    def test_logos_flags_and_signatures_do_not_complete_wikipedia_planning(self):
        for image in ["UN_Emblem.png", "Flag_of_England.svg", "Fatmir_Limaj_signature.png",
                      "Company_logo.jpg", "Gemini_screenshot.png"]:
            self.assertFalse(wiki_identity_allowed(wiki_page("United Nations", image),
                                                  "United Nations", "United Nations met today.", "Botë", set()))

    def test_unrelated_common_words_have_no_concrete_entity_description(self):
        for name, description in [("Clark", "person who keeps records"), ("Slate", "fine grained geological rock"),
                                  ("Pin", "fastening device"), ("Mast", "pole on a sailing vessel")]:
            self.assertFalse(wiki_identity_allowed(wiki_page(name, name + ".jpg", description),
                                                  name, name + " announced a product.", "Teknologji", set()))

    def test_grounding_matches_contiguous_names_and_known_case_endings_only(self):
        self.assertTrue(grounded("Edi Rama", "Deklarata e Edi Ramës u publikua."))
        self.assertFalse(grounded("Donald Trump", "Donald spoke while another person mentioned Trump."))
        self.assertFalse(grounded("Edi Rama", "Edi Rambo spoke."))

    def test_albanian_inflected_full_name_can_resolve_to_canonical_wikipedia_name(self):
        evidence = "Deklarata e Edi Ramës u publikua. Edi Ramës iu kërkua përgjigje."
        self.assertEqual(policy.story_names("Rama përgjigjet për protestën", evidence)[0], "Edi Ramës")
        self.assertTrue(wiki_identity_allowed(wiki_page("Edi Rama", "Edi_Rama_2025.jpg", "Albanian politician"),
                                              "Edi Ramës", evidence, "Shqipëri", set()))

    def test_outlets_and_generic_physical_objects_are_not_fallback_subjects(self):
        outlets = {"BalkanWeb", "Vizion Plus", "balkanweb.com"}
        for subject in ["BalkanWeb", "Vizion Plus", "shopping basket", "Flag of Kosovo"]:
            self.assertFalse(subject_allowed(subject, subject + " appears in the article.", outlets))
        self.assertFalse(subject_allowed("Apple Park", "Apple announced a new product.", outlets))

    def test_official_company_can_be_a_subject_without_admitting_media_outlets(self):
        names = publisher_names([{"source": "TechCrunch", "domains": ["techcrunch.com"]},
                                 {"source": "OpenAI", "domains": ["openai.com"], "role": "official_evidence"}], "OpenAI")
        self.assertNotIn("OpenAI", names)
        self.assertIn("TechCrunch", names)

    def test_logo_identifies_company_without_ever_becoming_the_prepared_photo(self):
        page = wiki_page("Nvidia", "Nvidia_logo.svg", "American semiconductor company")
        self.assertFalse(wiki_identity_allowed(page, "Nvidia", "Nvidia announced a new chip.", "Teknologji", set()))
        self.assertTrue(wiki_identity_allowed(page, "Nvidia", "Nvidia announced a new chip.", "Teknologji", set(), require_photo=False))
        response = SimpleNamespace(json=lambda: {"query": {"pages": {"1": page}}})
        lead = {"category": "Teknologji", "title": "Nvidia announces a new chip",
                "primary_evidence": {"text": "Nvidia announced a new chip."}}
        with patch.object(policy, "api_get", return_value=response), \
                patch.object(policy, "is_person", return_value=False), \
                patch.object(policy, "is_place", return_value=False):
            rows = list(policy._wiki_pages(lead, ["Nvidia"], set(), set()))
        self.assertEqual(rows[0][1]["files"], [])
        self.assertEqual(rows[0][1]["subject"], "Nvidia")
        self.assertEqual(rows[0][1]["kind"], "thing")
        self.assertIs(rows[0][1]["archive_institution"], True)

    def test_corporate_legal_suffix_does_not_hide_grounded_brand_identity(self):
        company = wiki_page("Tesla, Inc.", "Tesla_logo.svg", "American electric vehicle company")
        self.assertTrue(wiki_identity_allowed(company, "Tesla", "Tesla announced Cybercab production.",
                                              "Teknologji", set(), require_photo=False))
        self.assertFalse(wiki_identity_allowed(company, "Tesla", "Tesla announced Cybercab production.",
                                               "Teknologji", set(), require_photo=True))
        self.assertFalse(wiki_identity_allowed(company, "Tesla", "Apple announced a new product.",
                                               "Teknologji", set(), require_photo=False))
        person = wiki_page("Nikola Tesla", "Nikola_Tesla.jpg", "Serbian-American inventor")
        self.assertFalse(wiki_identity_allowed(person, "Tesla", "Tesla announced Cybercab production.",
                                               "Teknologji", set(), require_photo=False))

    def test_company_and_ceo_are_separate_grounded_photo_subjects(self):
        names = policy.story_names("Tesla announces Cybercabs", "Tesla CEO Elon Musk spoke. Elon Musk confirmed production.")
        self.assertEqual(names[0], "Tesla")
        self.assertIn("Elon Musk", names)
        self.assertNotIn("Tesla CEO Elon", names)

    def test_possessive_keeps_the_named_city_separate_from_the_theatre_district(self):
        names = policy.story_names("Jane Krakowski returns to London's West End",
                                   "Jane Krakowski takes the role. The play opens in London's West End.")
        self.assertEqual(names[:2], ["Jane Krakowski", "London"])
        self.assertIn("West End", names)
        crowded = policy.story_names("Jane Krakowski returns to London's West End",
                                     "Jane Krakowski has the role. Other London Marys will join her in the West End.")
        self.assertIn("London", crowded)
        self.assertNotIn("Other London Marys", crowded)
        play = policy.story_names("Jane Krakowski reprises 'Oh, Mary!' on London's West End",
                                  "Jane Krakowski has the role. Other London Marys will join her in the West End.")
        self.assertIn("London", play)

    def test_only_explicit_local_city_or_dateline_can_supply_the_place_fallback(self):
        seen = []
        def pages(lead, names, *args):
            seen.append(names)
            return iter([])
        with patch.object(policy, "_wiki_pages", side_effect=pages):
            policy.wiki_plan({"category": "Kosovë", "title": "Rama shpall kandidaturen",
                              "primary_evidence": {"text": "Kryetari i Prishtines, Perparim Rama, konfirmoi lajmin."}})
            policy.wiki_plan({"category": "Botë", "title": "Macron announces restrictions",
                              "primary_evidence": {"text": "PARIS — President Emmanuel Macron announced restrictions."}})
            policy.wiki_plan({"category": "Kosovë", "title": "Qeveria njofton vendimin",
                              "primary_evidence": {"text": "Qeveria njoftoi vendimin."}})
        self.assertIn("Prishtinë", seen[0])
        self.assertIn("Paris", seen[1])
        self.assertNotIn("Kosovë", seen[2])

    def test_albanian_place_description_and_definite_name_resolve_the_same_local_city(self):
        pristina = wiki_page("Prishtina", "Prishtina_2025.jpg", "Kryeqyteti i Kosovës")
        self.assertTrue(wiki_identity_allowed(pristina, "Prishtinë", "Kryetari i Prishtinës foli sot.", "Kosovë", set()))
        drenas = wiki_page("Drenasi", "Drenasi_2024.jpg", "Komunë në Kosovë")
        self.assertTrue(wiki_identity_allowed(drenas, "Drenas", "Kryetari foli në Drenas.", "Kosovë", set()))
        self.assertFalse(wiki_identity_allowed(drenas, "Drenas", "Kryetari foli në Prishtinë.", "Kosovë", set()))
        person = wiki_page("Drenasi", "Drenasi_2024.jpg", "Albanian actor")
        self.assertFalse(wiki_identity_allowed(person, "Drenas", "Kryetari foli në Drenas.", "Kosovë", set()))

    def test_identity_only_resolution_still_rejects_namesakes_and_media_outlets(self):
        deity = wiki_page("Rama", "Rama_flag.svg", "Hindu deity")
        self.assertFalse(wiki_identity_allowed(deity, "Rama", "Rama spoke in Tirana.", "Shqip\u00ebri", set(), require_photo=False))
        outlet = wiki_page("BBC", "BBC_logo.svg", "British broadcasting corporation")
        self.assertFalse(wiki_identity_allowed(outlet, "BBC", "BBC published the news.", "Bot\u00eb", {"BBC"}, require_photo=False))

    def test_wikipedia_keeps_supported_second_subject_and_place(self):
        rows = [("Robert Fico", {"subject": "Robert Fico", "kind": "person"}),
                ("Novi Sad", {"subject": "Novi Sad", "kind": "place"}),
                ("Donald Tusk", {"subject": "Donald Tusk", "kind": "person"})]
        with patch.object(policy, "_wiki_pages", return_value=iter(rows)):
            plan = policy.wiki_plan({"title": "Robert Fico meets Donald Tusk in Novi Sad",
                                     "primary_evidence": {"text": "Robert Fico met Donald Tusk in Novi Sad."}})
        self.assertEqual(plan["subject"], "Robert Fico")
        self.assertEqual(plan["place"]["subject"], "Novi Sad")
        self.assertEqual([row["subject"] for row in plan["alternatives"]], ["Donald Tusk", "Novi Sad"])

    def test_model_alternative_is_kept_when_primary_subject_is_an_outlet(self):
        lead = {"pair_id": "one", "title": "BalkanWeb reports Edi Rama's announcement",
                "primary_evidence": {"text": "BalkanWeb reports that Edi Rama spoke in Tiranë."}}
        row = {"pair_id": "story-001", "subject": "BalkanWeb", "subject_evidence": "BalkanWeb",
               "queries": ["BalkanWeb"], "caption": "BalkanWeb",
               "alternatives": [{"subject": "Edi Rama", "subject_evidence": "Edi Rama",
                                  "queries": ["Edi Rama"], "caption": "Edi Rama"}]}
        with tempfile.TemporaryDirectory() as folder, patch("news_model.ask_rows", return_value=[row]):
            plan = policy._plan_chunk([lead], Path(folder), 0)["one"]
        self.assertEqual(plan["subject"], "Edi Rama")

    def test_photo_search_tries_validated_alternative_after_empty_first_subject(self):
        main = {"subject": "Robert Fico", "kind": "person", "alternatives": [
            {"subject": "Novi Sad", "kind": "place"}]}
        expected = {"photo": {"image_url": "https://upload.wikimedia.org/Novi_Sad.jpg"}}
        with patch.object(policy, "_photo_options_for_plan", side_effect=[[], [expected]]) as find:
            self.assertEqual(policy.photo_options({"photo_plan": main}, {}, {}, "fresh"), [expected])
            self.assertEqual([call.args[4]["subject"] for call in find.call_args_list], ["Robert Fico", "Novi Sad"])


if __name__ == "__main__":
    unittest.main()
