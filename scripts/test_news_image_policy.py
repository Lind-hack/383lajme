import os as _os
_os.environ["L383_GEMINI_KEY"] = ""  # never the real Gemini API in tests
import re
import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from io import BytesIO
from PIL import Image

import news_image_policy as policy


def plan():
    return {"subject": "Apple Park", "subject_evidence": "Apple", "queries": ["Apple Park"],
            "caption": "Selia e Apple në Kaliforni."}


def page(license_name="CC0"):
    return {"title": "File:Apple Park.jpg", "imageinfo": [{
        "url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Apple_Park.jpg",
        "descriptionurl": "https://commons.wikimedia.org/wiki/File:Apple_Park.jpg",
        "extmetadata": {"LicenseShortName": {"value": license_name},
                        "LicenseUrl": {"value": policy.LICENSES.get(license_name, "")},
                        "Artist": {"value": "<a>Jane Photographer</a>"},
                        "Copyrighted": {"value": "False"},
                        "ImageDescription": {"value": "Apple Park in Cupertino"},
                        "DateTimeOriginal": {"value": (datetime.now(timezone.utc).date() - timedelta(days=90)).isoformat()}}
    }]}


class NewsPhotoTests(unittest.TestCase):
    def setUp(self):
        policy._wiki_search.cache_clear()
        policy._identity_claims.cache_clear()
        policy.commons_candidates.cache_clear()
        policy._entity_label.cache_clear()

    def test_cc0_waiver_is_not_overridden_by_commons_copyrighted_flag(self):
        singer = {"subject": "Raye", "subject_evidence": "Raye", "kind": "person",
                  "qid": "Q28071144", "caption": "Raye, foto arkivore"}
        portrait = page()
        portrait.update(title="File:Raye8888.jpg", pageid=123)
        portrait["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Raye performing"}
        portrait["imageinfo"][0]["extmetadata"]["Copyrighted"] = {"value": "True"}
        with patch.object(policy, "depicted", return_value={"Q28071144"}):
            self.assertIsNotNone(policy.candidate_photo(portrait, singer))
            portrait["imageinfo"][0]["extmetadata"]["LicenseUrl"] = {"value": "https://example.com/unverified"}
            self.assertIsNone(policy.candidate_photo(portrait, singer))
        portrait["imageinfo"][0]["extmetadata"]["LicenseUrl"] = {"value": policy.LICENSES["CC0"]}
        with patch.object(policy, "depicted", return_value=set()):
            self.assertIsNone(policy.candidate_photo(portrait, singer))
        public = page("Public domain")
        public["imageinfo"][0]["extmetadata"]["Copyrighted"] = {"value": "True"}
        self.assertIsNone(policy.candidate_photo(public, plan()))

    def test_mononym_category_requires_exact_identity_and_a_named_photo(self):
        singer = {"subject": "Raye", "subject_evidence": "Raye", "kind": "person",
                  "qid": "Q28071144", "caption": "Raye, foto arkivore"}
        concert = page("CC BY 4.0")
        concert.update(title="File:Raye performing at Glastonbury 2025.jpg", pageid=123,
                       _category_subject_qid="Q28071144")
        concert["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Raye performing"}
        with patch.object(policy, "depicted", return_value=set()):
            self.assertIsNotNone(policy.candidate_photo(concert, singer))
            self.assertIsNone(policy.candidate_photo({**concert, "_category_subject_qid": "Q108106738"}, singer))
            self.assertIsNone(policy.candidate_photo({**concert, "title": "File:Support act on Raye tour.jpg"}, singer))
            self.assertIsNone(policy.candidate_photo({**concert, "title": "File:Empty stage.jpg"}, singer))
        with patch.object(policy, "depicted", return_value={"Q108106738"}):
            self.assertIsNone(policy.candidate_photo(concert, singer))

    def test_undersized_original_cannot_occupy_the_photo_editor_shortlist(self):
        candidate = page()
        candidate["imageinfo"][0].update(width=949, height=1098, thumbwidth=1600, thumbheight=1851)
        self.assertIsNone(policy.candidate_photo(candidate, plan()))

    def test_mononym_research_attests_only_the_wikidata_linked_category(self):
        singer = {"subject": "Raye", "subject_evidence": "Raye", "kind": "person", "queries": ["Raye"],
                  "qid": "Q28071144", "caption": "Raye, foto arkivore"}
        concert = {**page(), "title": "File:Raye performing.jpg", "pageid": 123}
        claims = {"P373": [{"mainsnak": {"datavalue": {"value": "Raye"}}}]}
        with patch.object(policy, "_identity_claims", return_value=claims) as identity, \
                patch.object(policy, "commons_candidates", return_value=[concert]) as search, \
                patch.object(policy, "prefetch_depicted"):
            research = policy._research({}, {}, {}, singer, policy.time.monotonic() + 5)
        identity.assert_called_once_with("Q28071144", "P373")
        self.assertIn('deepcat:"Raye"', [call.args[0] for call in search.call_args_list])
        self.assertEqual(len(research[2]), 1)
        self.assertEqual(research[2][0]["_category_subject_qid"], "Q28071144")
        self.assertNotIn("_category_subject_qid", concert)  # shared search-cache rows remain unchanged
        with patch.object(policy, "_identity_claims", return_value={}), \
                patch.object(policy, "commons_candidates", return_value=[concert]), \
                patch.object(policy, "prefetch_depicted"):
            unlinked = policy._research({}, {}, {}, singer, policy.time.monotonic() + 5)
        self.assertNotIn("_category_subject_qid", unlinked[2][0])

    def test_named_headquarters_is_an_institution_photo_without_a_commons_depicts_tag(self):
        company = {"subject": "Microsoft", "subject_evidence": "Microsoft", "qid": "Q2283",
                   "kind": "thing", "archive_institution": True, "caption": "Selia e Microsoft"}
        headquarters = page()
        headquarters.update(title="File:Microsoft headquarters in Redmond.jpg", pageid=123)
        headquarters["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Microsoft headquarters in Redmond"}
        with patch.object(policy, "depicted", return_value=set()):
            self.assertIsNotNone(policy.candidate_photo(headquarters, company))
            self.assertIsNone(policy.candidate_photo(headquarters, {**company, "archive_institution": False}))
        unrelated = page()
        unrelated["title"] = "File:Microsoft GitHub Copilot conference.jpg"
        unrelated["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Microsoft hackathon participants"}
        self.assertFalse(policy.institution_building(unrelated, company))

    def test_spanish_headquarters_description_reaches_the_editor_without_relaxing_identity_or_rights(self):
        company = {"subject": "PLD Space", "subject_evidence": "PLD Space", "qid": "Q21076153",
                   "kind": "thing", "archive_institution": True, "caption": "Selia e PLD Space"}
        office = page("CC BY-SA 4.0")
        office.update(title="File:PLD Space, Elche, Alicante, España, 2018 05.jpg", pageid=123, lead_image=False)
        meta = office["imageinfo"][0]["extmetadata"]
        meta["ImageDescription"] = {"value": "Sede de PLD Space en Elche, Alicante, España."}
        meta["DateTimeOriginal"] = {"value": "2018-06-07 13:00:41"}
        with patch.object(policy, "_research", return_value=([], [], [office])), patch.object(policy, "depicted", return_value=set()):
            self.assertEqual(len(policy._photo_options_for_plan({}, {}, {}, "place", company)), 1)
            self.assertEqual(policy._photo_options_for_plan({}, {}, {}, "place", {**company, "archive_institution": False}), [])
            meta["ImageDescription"] = {"value": "Sede de Otra Empresa en Elche, Alicante, España."}
            self.assertEqual(policy._photo_options_for_plan({}, {}, {}, "place", company), [])
            meta["ImageDescription"] = {"value": "Sede de PLD Space en Elche."}
            meta["LicenseShortName"] = {"value": "All rights reserved"}
            self.assertEqual(policy._photo_options_for_plan({}, {}, {}, "place", company), [])

    def test_verified_company_lead_headquarters_may_tag_its_building_and_neighborhood(self):
        company = {"subject": "OpenAI", "subject_evidence": "OpenAI", "qid": "Q21708200",
                   "kind": "thing", "archive_institution": True, "caption": "OpenAI"}
        office = page("CC BY 4.0")
        office.update(title="File:1515 Third Street.jpg", pageid=123, lead_image=True)
        office["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Office building, headquarters of OpenAI in 2025"}
        with patch.object(policy, "depicted", return_value={"Q124605186", "Q6878535"}), \
                patch.object(policy, "is_place", return_value=True), patch.object(policy, "is_person", return_value=False):
            self.assertIsNotNone(policy.candidate_photo(office, company))
            self.assertIsNone(policy.candidate_photo({**office, "lead_image": False}, company))
        for geographic, human in ((False, False), (True, True)):
            with patch.object(policy, "depicted", return_value={"Qsomeone_else"}), \
                    patch.object(policy, "is_place", return_value=geographic), patch.object(policy, "is_person", return_value=human), \
                    patch.object(policy, "_organization_named", return_value=False):
                self.assertIsNone(policy.candidate_photo(office, company))
        with patch.object(policy, "depicted", return_value={"Q124605186", "Q6878535"}), \
                patch.object(policy, "is_place", side_effect=lambda qid: qid == "Q6878535"), \
                patch.object(policy, "is_person", return_value=False), \
                patch.object(policy, "_organization_named", side_effect=lambda qid, name: qid == "Q124605186" and name == "openai"):
            self.assertIsNotNone(policy.candidate_photo(office, company))

    def test_same_name_headquarters_tag_must_be_a_verified_exact_business_name(self):
        business = {"P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q4830453"}}}}]}
        with patch.object(policy, "_identity_claims", return_value=business), \
                patch.object(policy, "_entity_label", return_value="OpenAI"):
            self.assertTrue(policy._organization_named("Q124605186", "openai"))
            self.assertFalse(policy._organization_named("Q124605186", "another company"))
        with patch.object(policy, "_identity_claims", return_value={}), \
                patch.object(policy, "_entity_label", return_value="OpenAI"):
            self.assertFalse(policy._organization_named("Qsomeone", "openai"))

    def test_osm_map_and_underscored_map_filename_are_not_photographs(self):
        candidate = page()
        candidate.update(title="File:Saint-Mitre-les-Remparts_OSM_01.png")
        candidate["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Carte de Saint-Mitre-les-Remparts"}
        self.assertIsNone(policy.candidate_photo(candidate, plan()))
        candidate["title"] = "File:Apple_Park_map.png"
        candidate["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Apple Park"}
        self.assertIsNone(policy.candidate_photo(candidate, plan()))

    def test_archive_building_reaches_editor_before_unrelated_recent_events(self):
        company = {"subject": "Microsoft", "subject_evidence": "Microsoft", "qid": "Q2283", "files": [],
                   "queries": ["Microsoft"], "kind": "thing", "archive_institution": True, "caption": "Microsoft"}
        headquarters = page()
        headquarters.update(title="File:Microsoft headquarters.jpg", pageid=123)
        event = page()
        event.update(title="File:Microsoft hackathon.jpg", pageid=456)
        with patch.object(policy, "_research", return_value=([], [], [event, headquarters])), \
                patch.object(policy, "depicted", return_value={"Q2283"}):
            options = policy._photo_options_for_plan({}, {}, {}, "place", company)
        self.assertEqual(options[0]["page"]["pageid"], 123)

    def test_normalizer_restores_prepared_photo_without_fetching_model_url(self):
        from codex_automation_support import normalize_batch
        photo = {**policy.candidate_photo(page(), plan()), "image_width": 1920, "image_height": 1280}
        draft = {"url": "https://techcrunch.com/story", "slug": "qa-original-article", "title": "Apple hap zyrën",
                 "category": "Teknologji", "body": "<p>Fakte të verifikuara.</p>",
                 "image_url": "https://publisher.example/copied.jpg"}
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, "CATALOG", Path(folder) / "catalog.json"), patch.dict(os.environ, {"L383_HOURLY_NEWS": "1"}):
            policy.CATALOG.write_text(json.dumps({draft["url"]: photo}), encoding="utf-8")
            batch = Path(folder) / "2026-10-11T22.json"
            batch.write_text(json.dumps([draft]), encoding="utf-8")
            with patch("codex_automation_support._fetch_image_dimensions", return_value=(1920, 1280)) as decoder:
                rows = normalize_batch(batch)
                self.assertEqual(rows[0]["image_url"], photo["image_url"])
                self.assertEqual(rows[0]["image_rights"], photo["image_rights"])
                decoder.assert_called_once_with(photo["image_url"])

    def test_single_word_named_subject_is_grounded_and_invented_evidence_fails(self):
        leads = [{"pair_id": "one", "title": "OpenAI releases a model", "primary_evidence": {"text": "OpenAI announced a new release."}}]
        rows = [{"pair_id": "story-001", "subject": "OpenAI", "subject_evidence": "OpenAI", "queries": ["OpenAI office"], "caption": "Zyra e OpenAI."}]
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, "wiki_plan", return_value=None), patch("news_model.run_process") as model:
            model.return_value = SimpleNamespace(returncode=0, stdout="383_JSON_BEGIN" + json.dumps(rows) + "383_JSON_END")
            self.assertIn("one", policy.plan_subjects(leads, Path(folder)))
            command = model.call_args.args[0]
            self.assertIn("openai-codex", command)
            self.assertIn("gpt-6-luna", command)
            rows[0]["subject_evidence"] = "Invented evidence"
            model.return_value.stdout = "383_JSON_BEGIN" + json.dumps(rows) + "383_JSON_END"
            self.assertEqual(policy.plan_subjects(leads, Path(folder)), {})

    def test_a_timed_out_planner_chunk_costs_only_its_own_leads(self):
        leads = [{"pair_id": f"lead-{n}", "title": f"OpenAI story {n}", "primary_evidence": {"text": "OpenAI announced a new release."}}
                 for n in range(policy.PLAN_CHUNK + 1)]
        def answer(command, *_args, **_):
            brief = re.findall(r"## pair_id: (\S+)", Path(command[-1].split("Read ", 1)[1].split(". ", 1)[0]).read_text(encoding="utf-8"))
            if len(brief) > 1:
                raise policy.subprocess.TimeoutExpired(command, 240)
            rows = [{"pair_id": brief[0], "subject": "OpenAI", "subject_evidence": "OpenAI",
                     "queries": ["OpenAI office"], "caption": "Zyra e OpenAI."}]
            return SimpleNamespace(returncode=0, stdout="383_JSON_BEGIN" + json.dumps(rows) + "383_JSON_END")
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, "wiki_plan", return_value=None), patch("news_model.run_process", side_effect=answer):
            plans = policy.plan_subjects(leads, Path(folder))
            self.assertEqual(list(plans), [f"lead-{policy.PLAN_CHUNK}"])
            self.assertTrue((Path(folder) / "news-photo-plan.json").exists())

    def test_photo_connection_uses_validated_ip_and_original_tls_hostname(self):
        payload = BytesIO()
        Image.new("RGB", (1200, 630), "red").save(payload, format="JPEG")
        with patch("read_news_source.check_public", return_value="203.0.113.10"), patch.object(policy.urllib3, "HTTPSConnectionPool") as connection:
            connection.return_value.urlopen.return_value = SimpleNamespace(status=200, read=lambda count: payload.getvalue(), close=lambda: None)
            self.assertEqual(policy.photo_fingerprint("https://publisher.example/photo.jpg")[:2], (1200, 630))
            self.assertEqual(connection.call_args.args[0], "203.0.113.10")
            self.assertEqual(connection.call_args.kwargs["server_hostname"], "publisher.example")
            self.assertEqual(connection.return_value.urlopen.call_args.kwargs["headers"]["Host"], "publisher.example")

    def test_license_creator_and_story_context_are_preserved(self):
        photo = policy.candidate_photo(page(), plan())
        self.assertEqual(photo["image_rights"]["creator"], "Jane Photographer")
        self.assertEqual(photo["image_rights"]["license"], "CC0")
        self.assertEqual(photo["image_subject"], "Apple Park")

    def test_unlicensed_nc_nd_missing_credit_and_unrelated_photos_fail(self):
        for license_name in ("", "Fair use", "CC BY-NC 4.0", "CC BY-ND 4.0"):
            self.assertIsNone(policy.candidate_photo(page(license_name), plan()))
        # Credited licences pass only with a named creator for the credit line.
        for license_name in ("CC BY 4.0", "CC BY-SA 4.0"):
            credited = page(license_name)
            credited["imageinfo"][0]["extmetadata"]["Artist"] = {"value": "Jane Photographer"}
            self.assertEqual(policy.candidate_photo(credited, plan())["image_rights"]["creator"], "Jane Photographer")
            credited["imageinfo"][0]["extmetadata"].pop("Artist")
            self.assertIsNone(policy.candidate_photo(credited, plan()))
        candidate = page()
        candidate["imageinfo"][0]["extmetadata"].pop("Artist")
        self.assertIsNotNone(policy.candidate_photo(candidate, plan()))
        self.assertIsNone(policy.candidate_photo(page(), {**plan(), "subject": "Microsoft headquarters"}))

    def test_uk_open_government_licence_needs_its_url_and_a_credit(self):
        # As Commons reports a Number 10 photo (2026-10-17).
        ogl = page("OGL 3")
        meta = ogl["imageinfo"][0]["extmetadata"]
        meta.update(LicenseUrl={"value": "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3"},
                    Copyrighted={"value": "True"}, AttributionRequired={"value": "true"}, Artist={"value": "Number 10"})
        photo = policy.candidate_photo(ogl, plan())
        self.assertEqual((photo["image_rights"]["license"], photo["image_rights"]["creator"]), ("OGL 3", "Number 10"))
        meta.pop("Artist")
        self.assertIsNone(policy.candidate_photo(ogl, plan()))

    def test_public_domain_requires_explicit_status_and_no_extra_restrictions(self):
        candidate = page("Public domain")
        candidate["imageinfo"][0]["extmetadata"]["Copyrighted"]["value"] = "True"
        self.assertIsNone(policy.candidate_photo(candidate, plan()))
        candidate["imageinfo"][0]["extmetadata"]["Copyrighted"]["value"] = "False"
        self.assertIsNotNone(policy.candidate_photo(candidate, plan()))
        candidate["imageinfo"][0]["extmetadata"]["Restrictions"] = {"value": "Personality rights"}
        self.assertIsNone(policy.candidate_photo(candidate, plan()))

    def test_same_photo_at_another_url_is_rejected_but_different_photo_is_kept(self):
        evidence = {"image_url": "https://publisher.example/copied.jpg"}
        with patch.object(policy, "commons_candidates", return_value=[page()]), patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "identical", 0)):
            self.assertEqual(policy.select_photo({"photo_plan": plan()}, evidence, {}), {})
        # A new story: the research cache lives on the lead for one run.
        with patch.object(policy, "commons_candidates", return_value=[page()]), patch.object(policy, "photo_fingerprint", side_effect=[(1600, 900, "source", 0), (1600, 900, "different", (1 << 256) - 1)]):
            photo = policy.select_photo({"photo_plan": plan()}, evidence, {})
            self.assertTrue(photo["image_rights"]["distinct_from_source"])

    def test_commons_real_licence_url_formats_are_accepted(self):
        # As Commons actually reports them (2026-10-13): CC0 with a deed
        # language suffix, public domain with no URL at all.
        cc0 = page("CC0")
        cc0["imageinfo"][0]["extmetadata"]["LicenseUrl"] = {"value": "http://creativecommons.org/publicdomain/zero/1.0/deed.en"}
        cc0["imageinfo"][0]["extmetadata"]["Copyrighted"] = {"value": "False"}
        self.assertIsNotNone(policy.candidate_photo(cc0, plan()))
        public = page("Public domain")
        public["imageinfo"][0]["extmetadata"].pop("LicenseUrl")
        public["imageinfo"][0]["extmetadata"]["Copyrighted"] = {"value": "False"}
        self.assertIsNotNone(policy.candidate_photo(public, plan()))
        wrong = page("CC BY 4.0")
        wrong["imageinfo"][0]["extmetadata"]["LicenseUrl"] = {"value": "https://creativecommons.org/licenses/by-nc/4.0/"}
        self.assertIsNone(policy.candidate_photo(wrong, plan()))

    def test_searched_place_requires_exact_depicts_identity_and_still_rejects_maps(self):
        paris = {"subject": "Paris", "subject_evidence": "Paris", "kind": "place", "qid": "Q90",
                 "queries": [], "caption": "Pamje arkivore nga Parisi."}
        city = page()
        city.update(title="File:Paris cityscape 2025.jpg", pageid=123)
        city["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Paris cityscape"}
        for tags in (set(), {"Q47899"}):  # Paris Hilton is not the city.
            with patch.object(policy, "depicted", return_value=tags):
                self.assertIsNone(policy.candidate_photo(city, paris, policy.PLACE_MAX_YEARS))
        with patch.object(policy, "depicted", return_value={"Q90"}):
            self.assertIsNotNone(policy.candidate_photo(city, paris, policy.PLACE_MAX_YEARS))
            city["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Paris locator map"}
            self.assertIsNone(policy.candidate_photo(city, paris, policy.PLACE_MAX_YEARS))

    def test_place_research_queries_exact_depicts_without_loose_name_search(self):
        paris = {"subject": "Paris", "subject_evidence": "Paris", "kind": "place", "qid": "Q90",
                 "queries": [], "caption": "Pamje arkivore nga Parisi."}
        with patch.object(policy, "commons_candidates", return_value=[]) as search, \
                patch.object(policy, "prefetch_depicted"):
            policy._research({}, {}, {}, paris, policy.time.monotonic() + 5)
        self.assertEqual([call.args[0] for call in search.call_args_list],
                         ["haswbstatement:P180=Q90"] * 2)

    def test_place_tier_accepts_exact_tagged_search_result_when_lead_photo_is_unusable(self):
        paris = {"subject": "Paris", "subject_evidence": "Paris", "kind": "place", "qid": "Q90",
                 "queries": [], "caption": "Pamje arkivore nga Parisi."}
        city = page()
        city.update(title="File:Paris cityscape 2025.jpg", pageid=123)
        city["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Paris cityscape"}
        with patch.object(policy, "_research", return_value=([], [], [city])), \
                patch.object(policy, "depicted", return_value={"Q90"}):
            self.assertEqual(len(policy._photo_options_for_plan({}, {}, {}, "place", paris)), 1)
        with patch.object(policy, "_research", return_value=([], [], [city])), \
                patch.object(policy, "depicted", return_value={"Q47899"}):
            self.assertEqual(policy._photo_options_for_plan({}, {}, {}, "place", paris), [])

    def test_institution_archive_requires_verified_type_and_exact_identity(self):
        company = {**plan(), "subject": "Apple", "qid": "Q312", "kind": "thing",
                   "archive_institution": True, "files": [], "queries": ["Apple headquarters"]}
        building = page()
        building.update(title="File:Apple headquarters.jpg", pageid=123)
        with patch.object(policy, "_research", return_value=([], [], [building])), \
                patch.object(policy, "depicted", return_value={"Q312"}):
            self.assertEqual(len(policy._photo_options_for_plan({}, {}, {}, "place", company)), 1)
            self.assertEqual(policy._photo_options_for_plan({}, {}, {}, "place", {**company, "archive_institution": False}), [])
        with patch.object(policy, "_research", return_value=([], [], [building])), \
                patch.object(policy, "depicted", return_value={"Q90"}):
            self.assertEqual(policy._photo_options_for_plan({}, {}, {}, "place", company), [])

    def test_old_photos_and_charts_maps_logos_are_refused(self):
        old = page()
        old["imageinfo"][0]["extmetadata"]["DateTimeOriginal"] = {"value": "2014-07-01"}
        self.assertIsNone(policy.candidate_photo(old, plan()))
        chart = page()
        chart["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Apple Park ranking chart"}
        self.assertIsNone(policy.candidate_photo(chart, plan()))
        self.assertIsNotNone(policy.candidate_photo(page(), plan()))

    def test_time_series_filename_is_a_graph_even_without_the_word_chart(self):
        title = "File:Inflation rate, United States and eurozone, January 2018 through November 2024.png"
        graphic = page()
        graphic['title'] = title
        graphic['imageinfo'][0]['extmetadata']['ImageDescription'] = {'value': title}
        with patch.object(policy, 'depicted', return_value={'Q47583'}):
            self.assertIsNone(policy.candidate_photo(graphic, {'subject': 'Federal Reserve', 'qid': 'Q47583', 'caption': 'Federal Reserve'}))
        self.assertFalse(policy.non_photographic_asset('File:Federal Reserve headquarters, 2018 and 2024.jpg', 'Headquarters building.'))

    def test_prepared_graph_cannot_pass_final_photo_validation_after_model_approval(self):
        photo = policy.candidate_photo(page(), plan())
        title = 'Inflation_rate,_United_States_and_eurozone,_January_2018_through_November_2024.png'
        photo = {**photo, 'image_url': 'https://upload.wikimedia.org/wikipedia/commons/3/31/'+title,
                 'image_rights': {**photo['image_rights'], 'source_page': 'https://commons.wikimedia.org/wiki/File:'+title,
                                  'description': title}}
        article = {'url': 'https://cnbc.com/bonds', **photo}
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, 'CATALOG', Path(folder)/'catalog.json'):
            policy.CATALOG.write_text(json.dumps({article['url']: photo}), encoding='utf-8')
            self.assertEqual(policy.image_errors(article), ['prepared image depicts a chart, map or other non-photographic asset'])

    def test_subject_must_appear_as_a_phrase_and_personality_tag_is_allowed(self):
        person = {**plan(), "subject": "Ella Langley", "qid": "Q1"}
        road = page()
        road["title"] = "File:Ella Bank Road, Langley.jpg"
        road["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Ella Bank Road in Langley"}
        self.assertIsNone(policy.candidate_photo(road, person))
        singer = page()
        singer["title"] = "File:Concert 2025.jpg"
        singer["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Ella Langley performing in 2025"}
        singer["imageinfo"][0]["extmetadata"]["Restrictions"] = {"value": "personality"}
        singer["pageid"] = 7
        # Named only in the description: refused unless Commons tags it as depicting her.
        with patch.object(policy, "depicted", return_value=set()):
            self.assertIsNone(policy.candidate_photo(singer, person))
        with patch.object(policy, "depicted", return_value={"Q1"}):
            self.assertIsNotNone(policy.candidate_photo(singer, person))
        singer["imageinfo"][0]["extmetadata"]["Restrictions"] = {"value": "personality|trademarked"}
        with patch.object(policy, "depicted", return_value={"Q1"}):
            self.assertIsNone(policy.candidate_photo(singer, person))

    def test_bare_headline_surname_resolves_to_the_full_name_in_the_text(self):
        names = policy.story_names("Verstappen wins in Singapore Grand Prix",
                                   "Max Verstappen won the race. The Singapore Grand Prix ended late. Max Verstappen led.")
        self.assertEqual(names[0], "Max Verstappen")

    def test_recent_reviewed_wide_photo_outranks_the_first_search_hit(self):
        def ranked(title, year, categories="", size=(1600, 1000)):
            entry = page()
            entry["title"] = f"File:{title}.jpg"
            info = entry["imageinfo"][0]
            info.update(url=f"https://upload.wikimedia.org/wikipedia/commons/a/ab/{title}.jpg",
                        descriptionurl=f"https://commons.wikimedia.org/wiki/File:{title}.jpg", width=size[0], height=size[1])
            info["extmetadata"].update(DateTimeOriginal={"value": f"{year}-05-01"}, Categories={"value": categories})
            return entry
        now = datetime(2026, 10, 12, tzinfo=timezone.utc)
        old_scan = ranked("Apple Park old", 1998, size=(900, 1400))
        fresh = ranked("Apple Park fresh", 2026, "Quality images|Apple Park")
        self.assertGreater(policy.hook_score(fresh, now), policy.hook_score(old_scan, now))
        with patch.object(policy, "commons_candidates", return_value=[old_scan, fresh]), \
                patch.object(policy, "photo_fingerprint", return_value=(1600, 1000, "photo", 255)):
            self.assertIn("fresh", policy.select_photo({"photo_plan": plan()}, {}, {})["image_url"])

    def test_already_reserved_photo_does_not_repeat_in_the_run(self):
        with patch.object(policy, "commons_candidates", return_value=[page()]), patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "photo", 255)):
            self.assertEqual(policy.select_photo({"photo_plan": plan(), "_reserve_photo": lambda url: False}, {}, {}), {})

    def test_expired_research_budget_does_not_start_more_network_requests(self):
        with patch.object(policy, "commons_candidates") as search, patch.object(policy, "photo_fingerprint") as fetch:
            self.assertEqual(policy.select_photo({"photo_plan": plan(), "_photo_deadline": 0}, {}, {}), {})
            search.assert_not_called()
            fetch.assert_not_called()

    def test_unreadable_source_image_does_not_cost_the_story_its_licensed_photo(self):
        def fingerprint(url):
            if "publisher.example" in url:
                raise ValueError("refused")
            return (1600, 900, "licensed", 255)
        with patch.object(policy, "photo_fingerprint", side_effect=fingerprint), patch.object(policy, "commons_candidates", return_value=[page()]):
            photo = policy.select_photo({"photo_plan": plan()}, {"image_url": "https://publisher.example/photo.jpg"}, {})
            self.assertEqual(photo["image_rights"]["provider"], "wikimedia-commons")
        # The same file at the publisher's own URL is still refused by identity.
        same = page()
        same["imageinfo"][0]["url"] = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Apple_Park.jpg"
        with patch.object(policy, "photo_fingerprint", side_effect=fingerprint), patch.object(policy, "commons_candidates", return_value=[same]):
            self.assertEqual(policy.select_photo({"photo_plan": plan()}, {"image_url": same["imageinfo"][0]["url"]}, {}), {})

    def test_story_names_skip_sentence_openers_and_rank_by_mentions(self):
        names = policy.story_names("Failure to fit tags left offenders unmonitored in England",
                                   "Kelly Osbourne spoke. The Ministry said Kelly Osbourne was right, as Kelly Osbourne knew. Footage shows England.")
        self.assertEqual(names, ["England", "Kelly Osbourne"])  # the headline's subject first
        swift = policy.story_names("Taylor Swift Spends Her 100th Week at No. 1",
                                   "Taylor Swift broke a record held by The Beatles. The Beatles had 99 weeks. Kelly said.")
        self.assertEqual(swift[0], "Taylor Swift")

    def test_wikipedia_plan_needs_the_page_named_in_the_story_and_a_free_lead_photo(self):
        def wiki(url, params, **_):
            pages = {"1": {"index": 1, "title": "Kelly Osbourne", "pageimage": "Kelly_Osbourne_2010.jpg"},
                     "2": {"index": 2, "title": "Ozzy Osbourne", "pageimage": "Ozzy.jpg"}}
            if params["gsrsearch"] == "Paris Hilton":
                pages = {"1": {"index": 1, "title": "Paris", "pageimage": "Paris.jpg"}}
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"query": {"pages": pages}})
        lead = {"title": "Kelly Osbourne says she gained weight", "category": "Showbiz", "primary_evidence": {"text": "The singer Kelly Osbourne spoke."}}
        with patch.object(policy.requests, "get", side_effect=wiki) as get, patch.object(policy, "is_person", return_value=True):
            plan_row = policy.wiki_plan(lead)
            self.assertEqual((plan_row["subject"], plan_row["files"]), ("Kelly Osbourne", ["Kelly_Osbourne_2010.jpg"]))
            self.assertEqual(get.call_args.kwargs["params"]["pilicense"], "free")
            # A namesake page that does not cover the whole name is refused.
            self.assertIsNone(policy.wiki_plan({**lead, "title": "Paris Hilton speaks",
                                                "primary_evidence": {"text": "Then Paris Hilton spoke."}}))
        # A page with coordinates is the place plan (lead photo only, tried
        # last); any other page is an organisation or product, whose photos
        # must also show the story's topic.
        with patch.object(policy.requests, "get", side_effect=wiki), patch.object(policy, "is_person", return_value=False),                 patch.object(policy, "is_place", return_value=True):
            self.assertEqual((policy.wiki_plan(lead)["kind"], policy.wiki_plan(lead)["queries"]), ("place", []))
        with patch.object(policy.requests, "get", side_effect=wiki), patch.object(policy, "is_person", return_value=False),                 patch.object(policy, "is_place", return_value=False):
            self.assertEqual(policy.wiki_plan(lead)["kind"], "thing")

    def test_person_plan_keeps_the_story_place_for_the_last_tier(self):
        def wiki(url, params, **_):
            pages = {"Robert Fico": {"1": {"index": 1, "title": "Robert Fico", "pageimage": "Robert_Fico_2023.jpg",
                                           "pageprops": {"wikibase_item": "Q57606"}}},
                     "Novi Sad": {"1": {"index": 1, "title": "Novi Sad", "pageimage": "Novi_Sad_panorama.jpg",
                                        "pageprops": {"wikibase_item": "Q55630"}}}}.get(params["gsrsearch"], {})
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"query": {"pages": pages}})
        lead = {"title": "Robert Fico backs Vucic at the Novi Sad rally", "category": "Botë",
                "primary_evidence": {"text": "Slovak prime minister Robert Fico spoke in Novi Sad. Robert Fico said the rally in Novi Sad was large."}}
        with patch.object(policy.requests, "get", side_effect=wiki), patch.object(policy, "is_person", side_effect=lambda qid: qid == "Q57606"),                 patch.object(policy, "is_place", side_effect=lambda qid: qid == "Q55630"):
            plan_row = policy.wiki_plan(lead)
        self.assertEqual((plan_row["subject"], plan_row["kind"]), ("Robert Fico", "person"))
        self.assertEqual(plan_row["place"]["subject"], "Novi Sad")
        self.assertIn("Novi Sad", plan_row["context"])

    def test_taken_date_reads_the_forms_commons_uses(self):
        from datetime import date
        for raw, expected in (("2026-10-14 09:12:00", date(2026, 10, 14)), ("2026:10:14", date(2026, 10, 14)),
                              ("<div>Taken on 14 October 2026</div>", date(2026, 10, 14)),
                              ("October 4, 2026", date(2026, 10, 4)), ("2026", None), ("", None)):
            self.assertEqual(policy.taken_date({"DateTimeOriginal": {"value": raw}}), expected, raw)

    def test_a_photo_from_this_week_beats_a_better_older_portrait(self):
        today = datetime.now(timezone.utc).date()
        def dated(title, days, categories=""):
            entry = page()
            entry["title"] = f"File:{title}.jpg"
            info = entry["imageinfo"][0]
            info.update(url=f"https://upload.wikimedia.org/wikipedia/commons/a/ab/{title.replace(' ', '_')}.jpg",
                        descriptionurl=f"https://commons.wikimedia.org/wiki/File:{title.replace(' ', '_')}.jpg", width=2400, height=1400)
            info["extmetadata"].update(DateTimeOriginal={"value": (today - timedelta(days=days)).isoformat()},
                                       Categories={"value": categories})
            return entry
        portrait = dated("Apple Park portrait", 500, "Featured pictures")
        this_week = dated("Apple Park opening", 2)
        with patch.object(policy, "commons_candidates", return_value=[portrait, this_week]), \
                patch.object(policy, "photo_fingerprint", return_value=(2400, 1400, "photo", 255)):
            photo = policy.select_photo({"photo_plan": plan(), "title": "Apple opens its campus"}, {}, {})
        self.assertIn("opening", photo["image_url"])
        self.assertEqual(photo["image_rights"]["photo_tier"], "fresh")

    def test_an_older_photo_must_show_the_story_context(self):
        story = {"photo_plan": plan(), "title": "Apple campus hosts the iPhone launch event"}
        unrelated = page()  # 'Apple Park in Cupertino' names no launch, event or iPhone
        launch = page()
        launch["title"] = "File:Apple Park iPhone launch event.jpg"
        launch["imageinfo"][0]["url"] = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Apple_Park_iPhone_launch.jpg"
        launch["imageinfo"][0]["descriptionurl"] = "https://commons.wikimedia.org/wiki/File:Apple_Park_iPhone_launch.jpg"
        with patch.object(policy, "commons_candidates", return_value=[unrelated]), \
                patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "photo", 255)):
            self.assertEqual(policy.select_photo(dict(story), {}, {}), {})
        with patch.object(policy, "commons_candidates", return_value=[unrelated, launch]), \
                patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "photo", 255)):
            photo = policy.select_photo(dict(story), {}, {})
        self.assertIn("launch", photo["image_url"])
        self.assertEqual(photo["image_rights"]["photo_tier"], "older")

    def test_an_archive_photo_is_at_most_two_years_old_and_says_so(self):
        player = {**plan(), "subject": "Bukayo Saka", "qid": "Q1", "kind": "person"}
        old = page()
        old["title"] = "File:Bukayo Saka Arsenal v Lille.jpg"
        old["imageinfo"][0]["extmetadata"]["DateTimeOriginal"] = {
            "value": (datetime.now(timezone.utc).date() - timedelta(days=800)).isoformat()}
        with patch.object(policy, "commons_candidates", return_value=[old]), patch.object(policy, "depicted", return_value=set()), \
                patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "photo", 255)):
            lead = {"photo_plan": player, "title": "Saka scores against Lille", "category": "Sport"}
            self.assertEqual(policy.select_photo(lead, {}, {}, "older"), {})
        old["imageinfo"][0]["extmetadata"]["DateTimeOriginal"] = {"value": "2026-03-14"}
        with patch.object(policy, "commons_candidates", return_value=[old]), patch.object(policy, "depicted", return_value=set()),                 patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "photo", 255)),                 patch.object(policy, "datetime", wraps=datetime) as clock:
            clock.now.return_value = datetime(2026, 10, 18, tzinfo=timezone.utc)
            photo = policy.select_photo({**lead, "_photo_research": {}}, {}, {}, "older")
        self.assertTrue(photo["image_caption"].startswith("Foto nga arkivi (mars 2026). "))

    def test_research_also_searches_files_tagged_as_depicting_the_subject(self):
        person = {**plan(), "subject": "Lewis Hamilton", "qid": "Q9673", "kind": "person"}
        with patch.object(policy, "commons_candidates", return_value=[]) as search,                 patch.object(policy, "commons_files", return_value=[]):
            policy._research({}, {}, {}, person, float("inf"))
        self.assertIn("haswbstatement:P180=Q9673", [call.args[0] for call in search.call_args_list])
        with patch.object(policy, "commons_candidates", return_value=[]) as search:
            policy._research({}, {}, {}, plan(), float("inf"))
        self.assertFalse(any("haswbstatement" in call.args[0] for call in search.call_args_list))

    def test_tagged_in_someone_elses_photo_is_not_a_photo_of_them(self):
        fico = {**plan(), "subject": "Robert Fico", "qid": "Q57606", "kind": "person"}
        visit = page()
        visit["title"] = "File:Visit of Raffaele Fitto, to Slovakia.jpg"
        visit["pageid"] = 9
        with patch.object(policy, "depicted", return_value={"Q57606", "Q1063445"}):
            self.assertIsNone(policy.candidate_photo(visit, fico))
        with patch.object(policy, "depicted", return_value={"Q57606"}):
            self.assertIsNone(policy.candidate_photo(visit, fico))
            visit["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Portrait of Robert Fico at the meeting."}
            self.assertIsNotNone(policy.candidate_photo(visit, fico))
        visit["title"] = "File:Fico and Fitto in Bratislava.jpg"
        with patch.object(policy, "depicted", return_value={"Q57606", "Q1063445"}):
            self.assertIsNotNone(policy.candidate_photo(visit, fico))

    def test_matching_full_name_cannot_override_a_different_persons_structured_identity(self):
        golfer = {**plan(), "subject": "Ian Poulter", "qid": "Q615937", "kind": "person"}
        namesake = page()
        namesake.update(title="File:Ian Poulter MNZM investiture.jpg", pageid=193110045)
        namesake["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Ian Poulter, honoured for services to education in Wellington."}
        with patch.object(policy, "depicted", return_value={"Q17180701", "Q137642272"}):
            self.assertIsNone(policy.candidate_photo(namesake, golfer))
        namesake["title"] = "File:Ian Poulter at a golf tournament.jpg"
        namesake["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "Ian Poulter playing golf."}
        with patch.object(policy, "depicted", return_value={"Q615937"}):
            self.assertIsNotNone(policy.candidate_photo(namesake, golfer))

    def test_sole_person_tag_cannot_turn_a_spacecraft_into_a_portrait(self):
        musk = {**plan(), "subject": "Elon Musk", "qid": "Q317521", "kind": "person"}
        ship = page()
        ship.update(title="File:The SpaceX Dragon spacecraft carrying Axiom Mission 4.jpg", pageid=168694924)
        ship["imageinfo"][0]["extmetadata"]["ImageDescription"] = {"value": "The SpaceX Dragon spacecraft approaches the International Space Station."}
        with patch.object(policy, "depicted", return_value={"Q317521"}):
            self.assertIsNone(policy.candidate_photo(ship, musk))

    def test_place_tier_uses_the_story_place_when_no_person_photo_exists(self):
        fico = {**plan(), "subject": "Robert Fico", "qid": "Q57606", "kind": "person",
                "place": {**plan(), "subject": "Novi Sad", "qid": "Q55630", "kind": "place", "caption": "Novi Sad.",
                          "queries": [], "files": ["Novi Sad panorama.jpg"]}}
        city = page()
        city["title"] = "File:Novi Sad panorama.jpg"
        city["imageinfo"][0]["url"] = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Novi_Sad_panorama.jpg"
        searched = {**city, "title": "File:Novi Sad protest map.jpg"}
        with patch.object(policy, "commons_candidates", return_value=[searched]), \
                patch.object(policy, "commons_files", return_value=[{**city, "lead_image": True}]), \
                patch.object(policy, "depicted", return_value=set()), \
                patch.object(policy, "photo_fingerprint", return_value=(1600, 900, "photo", 255)):
            lead = {"photo_plan": fico, "title": "Fico backs Vucic in Novi Sad"}
            self.assertEqual(policy.select_photo(lead, {}, {}), {})
            photo = policy.select_photo(lead, {}, {}, "place")
        self.assertEqual((photo["image_subject"], photo["image_rights"]["photo_tier"]), ("Novi Sad", "place"))
        # Dated as an archive photo, never passed off as today's event.
        self.assertTrue(photo["image_caption"].startswith("Foto nga arkivi ("))

    def test_text_only_record_passes_only_with_an_empty_image(self):
        record = policy.no_photo()
        article = {"url": "https://techcrunch.com/story", **record}
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, "CATALOG", Path(folder) / "catalog.json"):
            policy.CATALOG.write_text(json.dumps({article["url"]: record}), encoding="utf-8")
            self.assertTrue(policy.is_no_photo(policy.trusted_photo(article)))
            self.assertEqual(policy.image_errors(article), [])
            # A writer cannot slip its own picture into a text-only story.
            self.assertTrue(policy.image_errors({**article, "image_url": "https://publisher.example/photo.jpg"}))
        self.assertTrue(policy.image_errors(article))  # no prepared record at all

    def test_commons_thumbnail_and_original_have_same_identity(self):
        original = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Apple_Park.jpg"
        thumb = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Apple_Park.jpg/1600px-Apple_Park.jpg"
        self.assertEqual(policy.image_identity(original), policy.image_identity(thumb))
        self.assertEqual(policy.image_identity(original), policy.image_identity(thumb.replace("upload.wikimedia.org", "thumb.wikimedia.org")))

    def test_provenance_cannot_be_self_declared_altered_or_stale(self):
        photo = policy.candidate_photo(page(), plan())
        article = {"url": "https://techcrunch.com/story", **photo}
        with tempfile.TemporaryDirectory() as folder, patch.object(policy, "CATALOG", Path(folder) / "catalog.json"):
            self.assertTrue(policy.image_errors(article))
            policy.CATALOG.write_text(json.dumps({article["url"]: photo}), encoding="utf-8")
            self.assertEqual(policy.image_errors(article), [])
            wrong_image = {**article, "image_url": "https://publisher.example/photo.jpg"}
            self.assertIsNone(policy.trusted_photo(wrong_image))
            self.assertEqual(policy.trusted_photo(wrong_image, require_image_match=False), photo)
            self.assertTrue(policy.image_errors({**article, "image_subject": "Invented subject"}))
            photo["image_rights"]["verified_at"] = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
            policy.CATALOG.write_text(json.dumps({article["url"]: photo}), encoding="utf-8")
            self.assertTrue(policy.image_errors(article))


if __name__ == "__main__":
    unittest.main()
