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
        row = {"pair_id": "one", "subject": "BalkanWeb", "subject_evidence": "BalkanWeb",
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
