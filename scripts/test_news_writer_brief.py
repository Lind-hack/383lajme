import json
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timedelta, timezone

from news_writer_brief import build


class WriterBriefTests(unittest.TestCase):
    def test_fresh_homepage_priority_survives_initial_writer_cap(self):
        now = datetime.now(timezone.utc)
        top = {**self.lead, 'pair_id':'Kosovë-top', 'url':'https://koha.net/top',
               'published':now.isoformat(), 'title':'Government announces next meeting',
               'homepage':{'url':'https://koha.net/', 'position':1, 'article_count':30,
                           'observed_at':now.isoformat(), 'method':'public_html_dom_order'}}
        other = {**self.lead, 'pair_id':'Kosovë-other', 'url':'https://koha.net/other',
                 'published':now.isoformat(), 'title':'Urgent pension tax reform announced'}
        for row in (top, other):
            row.pop('facts_path',None)
        self.write([other, top])
        build(self.discovery,self.output,'Kosovë',cap=1,spares=0)
        result = self.output.read_text(encoding='utf-8')
        self.assertIn(top['url'],result)
        self.assertNotIn(other['url'],result)
        self.assertIn('public_html_dom_order',result)
        self.assertIn('not measured visual position',result)
        build(self.discovery,self.output,'Kosovë',cap=1,spares=1)
        self.assertIn(other['url'],self.output.read_text(encoding='utf-8'))

    def test_showbiz_homepage_lead_precedes_higher_scored_generic_story(self):
        now=datetime.now(timezone.utc).isoformat()
        top={**self.lead,'category':'Showbiz','pair_id':'Showbiz-top','source':'People','url':'https://people.com/top',
             'published':now,'title':'Heidi Klum reveals her new look','editorial_review':{'score':5},
             'homepage':{'position':1,'article_count':30,'observed_at':now,'method':'public_html_dom_order'}}
        other={**top,'pair_id':'Showbiz-other','url':'https://people.com/other','title':'A band announces its album',
               'homepage':{},'editorial_review':{'score':9}}
        for row in (top,other):row.pop('facts_path',None)
        self.write([other,top])
        data=json.loads(self.discovery.read_text(encoding='utf-8'));data['publication_plan']['Showbiz']=2
        self.discovery.write_text(json.dumps(data),encoding='utf-8')
        build(self.discovery,self.output,'Showbiz',cap=1,spares=0)
        text=self.output.read_text(encoding='utf-8')
        self.assertIn(top['url'],text)
        self.assertNotIn(other['url'],text)

    def test_fresh_ready_story_is_not_displaced_by_an_older_widely_covered_reserve(self):
        now = datetime.now(timezone.utc)
        older = {**self.lead, 'pair_id': 'Kosovë-old', 'url': 'https://koha.net/older',
                 'published': (now-timedelta(hours=20)).isoformat(), 'coverage_family_count': 4}
        fresh = {**self.lead, 'pair_id': 'Kosovë-new', 'url': 'https://koha.net/new',
                 'published': (now-timedelta(hours=1)).isoformat()}
        for lead in (older, fresh):
            lead.pop('facts_path')
        self.write([older, fresh])
        build(self.discovery, self.output, 'Kosovë', cap=1, spares=0)
        result = self.output.read_text(encoding='utf-8')
        self.assertIn(fresh['url'], result)
        self.assertNotIn(older['url'], result)
        build(self.discovery, self.output, 'Kosovë', cap=1, spares=1)
        self.assertIn(older['url'], self.output.read_text(encoding='utf-8'))

    def test_widely_covered_ready_event_precedes_singleton_without_becoming_verification(self):
        first={**self.lead,'pair_id':'Kosovë-single','url':'https://kallxo.com/single'}
        event={**self.lead,'pair_id':'Kosovë-event','url':'https://gazetaexpress.com/event',
               'coverage_family_count':4,'evidence_path':'/private/event-evidence.json'}
        event.pop('facts_path',None)
        self.write([first,event])
        build(self.discovery,self.output,'Kosovë',cap=1,spares=0)
        result=self.output.read_text(encoding='utf-8')
        self.assertIn(event['url'],result)
        self.assertNotIn(first['url'],result)
        self.assertIn('coverage_family_count: 4',result)
        self.assertIn('never call it breaking or confirmed solely from that count',result)

    def test_public_fact_candidate_precedes_risky_cached_notes_and_warning_remains_visible(self):
        risky = {**self.lead, 'source_basis_warning':'Interview material needs a separate public basis.'}
        public = {key:value for key,value in {**self.lead, 'pair_id':'Kosovë-public',
                  'url':'https://koha.net/public', 'evidence_path':'/private/public-evidence.json'}.items() if key!='facts_path'}
        self.write([risky,public])
        build(self.discovery,self.output,'Kosovë',cap=1,spares=0)
        self.assertIn(public['url'],self.output.read_text(encoding='utf-8'))
        self.assertNotIn(risky['url'],self.output.read_text(encoding='utf-8'))
        build(self.discovery,self.output,'Kosovë',cap=1,spares=1)
        self.assertIn(risky['source_basis_warning'],self.output.read_text(encoding='utf-8'))

    def test_identity_manifest_contains_only_the_scoped_prepared_pool(self):
        leads=[{**self.lead, 'pair_id':f'Kosovë-{i}', 'url':f'https://koha.net/slot-{i}',
                'evidence_path':'/private/evidence.json'} for i in range(4)]
        leads=[{k:v for k,v in lead.items() if k!='facts_path'} for lead in leads]
        self.write(leads)
        manifest=self.root/'identity.json'
        build(self.discovery,self.output,'Kosovë',cap=1,spares=1,desk_slot=1,identity_output=manifest)
        records=json.loads(manifest.read_text(encoding='utf-8'))
        self.assertEqual(records,[{key:leads[i][key] for key in ('pair_id','url','category')} for i in (0,2)])
        self.assertIn('source_pair_id',self.output.read_text(encoding='utf-8'))

    def test_three_allocated_slots_partition_all_six_sources_without_overlap(self):
        leads=[{**self.lead, 'pair_id':f'Kosovë-{i}', 'url':f'https://koha.net/slot-{i}'} for i in range(6)]
        leads=[{k:v for k,v in lead.items() if k!='facts_path'} for lead in leads]
        self.write(leads)
        data=json.loads(self.discovery.read_text())
        data['publication_plan']['Kosovë']=3
        self.discovery.write_text(json.dumps(data),encoding='utf-8')
        seen=set()
        for slot in (1,2,3):
            self.assertEqual(build(self.discovery,self.output,'Kosovë',cap=1,spares=1,desk_slot=slot),2)
            pool={line for line in self.output.read_text(encoding='utf-8').splitlines() if line.startswith('url: ')}
            self.assertFalse(seen & pool)
            seen |= pool
        self.assertEqual(len(seen),6)

    def test_third_slot_is_not_created_for_a_two_story_desk(self):
        self.write()
        with self.assertRaises(ValueError):
            build(self.discovery,self.output,'Kosovë',cap=1,spares=1,desk_slot=3)

    def test_two_single_article_slots_have_disjoint_sources_and_spares(self):
        leads=[{**self.lead,'pair_id':'Kosovë-'+str(i),'url':'https://koha.net/slot-'+str(i)} for i in range(6)]
        # No note files: this fixture tests complete evidence fallback pools.
        leads=[{k:v for k,v in lead.items() if k!='facts_path'} for lead in leads]
        self.write(leads)
        pools=[]
        for slot in (1,2):
            self.assertEqual(build(self.discovery,self.output,'Kosovë',cap=1,spares=1,desk_slot=slot),2)
            pools.append({line for line in self.output.read_text(encoding='utf-8').splitlines() if line.startswith('url: ')})
            self.assertIn('"Kosovë": 1',self.output.read_text(encoding='utf-8'))
        self.assertFalse(pools[0] & pools[1])
        self.assertEqual(len(pools[0] | pools[1]),4)

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.discovery, self.output = self.root / "discovery.json", self.root / "brief.md"
        self.notes = self.root / "facts.json"
        self.notes.write_text(json.dumps({"pair_id": "Kosovë-01", "facts": [
            "Institucioni | vendimi i verifikuar", "Afati | tetor", "Fusha | shërbimi publik", "Hapi tjetër | votimi"]}), encoding="utf-8")
        self.lead = {"pair_id": "Kosovë-01", "category": "Kosovë", "source": "Koha", "url": "https://koha.net/example",
                     "title": "ORIGINAL_HEADLINE_SENTINEL", "summary": "ORIGINAL_PROSE_SENTINEL " * 400,
                     "facts_path": str(self.notes), "evidence_path": "/private/original-source-prose.json",
                     "image_subject": "Prishtina", "published": "2026-10-22T12:00:00Z"}

    def write(self, rows=None):
        rows=rows if rows is not None else [self.lead]
        for lead in rows:
            evidence=self.root/(lead['pair_id']+'.evidence.json')
            evidence.write_text(json.dumps({'source_url':lead['url'],'evidence':{
                'url':lead['url'],'status':'text_extracted',
                'text':'Verified municipal decision on 25 October. Council approval starts a new public service. '
                       'The published timetable lists three routes. The budget contains 20 vehicles. '
                       'Residents can apply on Monday. The authority published the exact implementation date.'}}),encoding='utf-8')
            lead['evidence_path']=str(evidence)
        self.discovery.write_text(json.dumps({"publication_plan": {"Kosovë": 2, "Shqipëri": 2},
                                              "ready_leads": rows,
                                              "leads": [{"summary": "UNREADY_SOURCE_SENTINEL"}]}), encoding="utf-8")

    def test_composer_gets_exact_notes_and_provenance_without_original_headlines_or_summaries(self):
        self.write()
        original = self.discovery.read_bytes()
        self.assertEqual(build(self.discovery, self.output), 1)
        brief = self.output.read_text(encoding="utf-8")
        for prohibited in ("ORIGINAL_HEADLINE_SENTINEL", "ORIGINAL_PROSE_SENTINEL", "UNREADY_SOURCE_SENTINEL", self.lead["evidence_path"]):
            self.assertNotIn(prohibited, brief)
        for retained in ("vendimi i verifikuar", "https://koha.net/example", "Prishtina", "Publication plan"):
            self.assertIn(retained, brief)
        self.assertLessEqual(max(map(len, brief.splitlines())), 160)
        self.assertEqual(self.discovery.read_bytes(), original)

    def test_long_source_url_is_preserved_as_one_exact_value(self):
        self.write([{**self.lead, "url": "https://koha.net/" + "a" * 210}])
        build(self.discovery, self.output)
        self.assertIn("url: https://koha.net/" + "a" * 210 + "\n", self.output.read_text(encoding="utf-8"))

    def test_each_group_sees_only_its_allocations_and_story_notes(self):
        self.write([self.lead, {**self.lead, "category": "Shqipëri", "url": "https://lapsi.al/another"}])
        build(self.discovery, self.output, "Kosovë")
        brief = self.output.read_text(encoding="utf-8")
        self.assertNotIn("lapsi.al", brief)
        self.assertNotIn("Shqipëri", brief)
        self.assertIn('"Kosovë": 2', brief)

    def test_initial_composer_gets_one_spare_per_desk_without_losing_later_inventory(self):
        rows = []
        for category, host in (("Kosovë", "koha.net"), ("Shqipëri", "lapsi.al")):
            for index in range(6):
                pair = f"{category}-{index}"
                notes = self.root / f"{pair}.json"
                notes.write_text(json.dumps({"pair_id": pair, "facts": ["A distinct verified fact"] * 4}), encoding="utf-8")
                rows.append({**self.lead, "category": category, "url": f"https://{host}/item-{index}",
                             "pair_id": pair, "facts_path": str(notes)})
        self.write(rows)
        original = self.discovery.read_bytes()
        self.assertEqual(build(self.discovery, self.output, spares=1), 6)
        self.assertNotIn("/item-3", self.output.read_text(encoding="utf-8"))
        self.assertEqual(self.discovery.read_bytes(), original)
        self.assertEqual(build(self.discovery, self.output), 12)
        self.assertIn("/item-5", self.output.read_text(encoding="utf-8"))

    def test_initial_spares_cannot_silently_limit_replacement_selection(self):
        self.write()
        with self.assertRaises(ValueError):
            build(self.discovery, self.output, spares=-1)
        with self.assertRaises(ValueError):
            build(self.discovery, self.output, approved=self.root / "approved.json",
                  attempted=self.root / "attempted.json", spares=1)

    def test_initial_selection_prefers_verified_model_outlines_and_labels_fragment_backups(self):
        rows = []
        for index, origin in enumerate(("fragments", "fragments", "fragments", "model", "cache")):
            pair = f"Kosovë-{index}"
            notes = self.root / f"{index}.facts.json"
            notes.write_text(json.dumps({"pair_id": pair, "facts": ["A distinct fact"] * 4, "origin": origin}), encoding="utf-8")
            rows.append({**self.lead, "pair_id": pair, "url": f"https://koha.net/item-{index}", "facts_path": str(notes)})
        self.write(rows)
        self.assertEqual(build(self.discovery, self.output, "Kosovë", spares=1), 3)
        brief = self.output.read_text(encoding="utf-8")
        for index in (3, 4, 0):
            self.assertIn(f"https://koha.net/item-{index}", brief)
        for index in (1, 2):
            self.assertNotIn(f"https://koha.net/item-{index}", brief)
        self.assertIn("Source-fragment fallback", brief)
        self.assertEqual(build(self.discovery, self.output), 5)

    def test_desk_floor_changes_only_the_reading_view_and_retains_one_unused_backup(self):
        self.write([{**self.lead, "url": f"https://koha.net/item-{i}"} for i in range(5)])
        data = json.loads(self.discovery.read_text(encoding="utf-8")); data["publication_plan"]["Kosovë"] = 3
        self.discovery.write_text(json.dumps(data), encoding="utf-8")
        before = self.discovery.read_bytes()
        self.assertEqual(build(self.discovery, self.output, "Kosovë", cap=2, spares=1), 3)
        self.assertIn('"Kosovë": 2', self.output.read_text(encoding="utf-8"))
        self.assertEqual(self.discovery.read_bytes(), before)
        self.assertEqual(build(self.discovery, self.output), 5)
        self.assertIn('"Kosovë": 3', self.output.read_text(encoding="utf-8"))
        with self.assertRaises(ValueError):
            build(self.discovery, self.output, cap=0)

    def test_wrong_story_notes_and_wrong_category_sources_fail_closed(self):
        self.write()
        self.notes.write_text(json.dumps({"pair_id": "another-story", "facts": ["fact"] * 4}), encoding="utf-8")
        with self.assertRaises(ValueError):
            build(self.discovery, self.output)
        self.write([{**self.lead, "url": "https://variety.com/wrong-category"}])
        with self.assertRaises(ValueError):
            build(self.discovery, self.output)

    def test_no_notes_inlines_verified_evidence_without_requiring_a_file_tool(self):
        self.write([{key: value for key, value in self.lead.items() if key != "facts_path"}])
        build(self.discovery, self.output)
        brief = self.output.read_text(encoding="utf-8")
        self.assertIn('The budget contains 20 vehicles',brief)
        self.assertIn('Verified source fragments',brief)
        self.assertNotIn(self.lead["evidence_path"], brief)
        self.assertNotIn("ORIGINAL_PROSE_SENTINEL", brief)

    def test_fallback_rejects_restricted_or_mismatched_source_evidence(self):
        row={key:value for key,value in self.lead.items() if key!='facts_path'}
        self.write([row])
        path=Path(row['evidence_path'])
        original=json.loads(path.read_text())
        for invalid in ({**original,'source_url':'https://koha.net/another'},
                        {**original,'evidence':{**original['evidence'],'status':'restricted'}},
                        {**original,'evidence':{**original['evidence'],'url':'https://telegrafi.com/another'}}):
            path.write_text(json.dumps(invalid))
            with self.assertRaises(ValueError):
                build(self.discovery,self.output)

    def test_fallback_inlines_the_required_independent_corroboration(self):
        row={key:value for key,value in self.lead.items() if key!='facts_path'}
        row.update(corroborates_url='https://telegrafi.com/confirmation',requires_corroboration=True)
        self.write([row])
        path=Path(row['evidence_path'])
        record=json.loads(path.read_text())
        record['corroborating']=[{'url':row['corroborates_url'],'evidence':{
            'url':row['corroborates_url'],'status':'text_extracted',
            'text':'The independent confirmation lists 20 vehicles and the same council decision.'}}]
        path.write_text(json.dumps(record))
        build(self.discovery,self.output)
        text=self.output.read_text(encoding='utf-8')
        self.assertIn('independent corroboration',text)
        self.assertIn('20 vehicles',text)
        self.assertNotIn(str(path),text)

    def test_replacement_brief_limits_work_and_excludes_used_or_full_categories(self):
        approved, attempted = self.root / "approved.json", self.root / "attempted.json"
        approved.write_text(json.dumps([{"url": f"https://lapsi.al/old-{i}", "category": "Shqipëri"}
                                        for i in range(3)]), encoding="utf-8")
        attempted.write_text(json.dumps([self.lead["url"]]), encoding="utf-8")
        self.write([self.lead, {**self.lead, "url": "https://koha.net/new-1"},
                    {**self.lead, "url": "https://koha.net/new-2"},
                    {**self.lead, "category": "Shqipëri", "url": "https://lapsi.al/full"}])
        self.assertEqual(build(self.discovery, self.output, approved=approved, attempted=attempted, limit=1), 1)
        brief = self.output.read_text(encoding="utf-8")
        self.assertIn("https://koha.net/new-1", brief)
        self.assertNotIn("https://koha.net/new-2", brief)
        self.assertNotIn("https://koha.net/example", brief)
        self.assertNotIn("https://lapsi.al/full", brief)
        self.assertIn('"Kosovë": 1', brief)
        self.assertIn('"Shqipëri": 0', brief)

    def test_replacement_brief_fills_an_empty_category_before_a_third_story(self):
        approved, attempted = self.root / "approved.json", self.root / "attempted.json"
        approved.write_text(json.dumps([{"url": f"https://koha.net/old-{i}", "category": "Kosovë"}
                                        for i in range(2)]), encoding="utf-8")
        attempted.write_text("[]", encoding="utf-8")
        self.write([self.lead, {**self.lead, "category": "Shqipëri", "url": "https://lapsi.al/new"}])
        build(self.discovery, self.output, approved=approved, attempted=attempted, limit=1)
        brief = self.output.read_text(encoding="utf-8")
        self.assertIn("https://lapsi.al/new", brief)
        self.assertNotIn(self.lead["url"], brief)

    def test_replacement_brief_requires_both_control_records(self):
        self.write()
        with self.assertRaises(ValueError):
            build(self.discovery, self.output, approved=self.root / "missing.json")


if __name__ == "__main__":
    unittest.main()
