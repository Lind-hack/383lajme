import json
import tempfile
import unittest
from pathlib import Path

from prepare_editor_sources import join_reporter_notes, reporter_note_candidates
from news_writer_brief import build


class ReserveInventoryTests(unittest.TestCase):
    def test_unrequested_qualified_reserves_survive_partial_notes_without_restoring_requested_failures(self):
        ready = [{"pair_id": f"tech-{i}", "category": "Teknologji", "image_url": f"https://images.example/{i}.jpg",
                  "evidence_path": f"/verified/{i}.json", "url": f"https://techcrunch.com/item-{i}"}
                 for i in range(10)]
        requested = reporter_note_candidates(ready, {"Teknologji": 3, "Kosovë": 0, "Shqipëri": 0,
                                                    "Sport": 0, "Ekonomi": 0, "Botë": 0, "Showbiz": 0})
        self.assertEqual(len(requested), 6)
        result = join_reporter_notes(ready, requested, {"tech-0": Path("/notes/tech-0.json")})
        self.assertEqual([a['pair_id'] for a in result], ['tech-0', 'tech-6', 'tech-7', 'tech-8', 'tech-9'])
        self.assertEqual(result[1:], ready[6:])
        self.assertEqual(Path(result[0]['facts_path']), Path('/notes/tech-0.json'))
        self.assertEqual(join_reporter_notes(ready, requested, {}), ready)

    def test_an_unused_unrequested_reserve_can_fill_an_empty_desk_from_its_exact_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            ready = [{"pair_id": f"tech-{i}", "category": "Teknologji", "source": "TechCrunch",
                      "title": "A public model announcement", "url": f"https://techcrunch.com/item-{i}",
                      "evidence_path": f"/verified/evidence-{i}.json", "image_subject": "OpenAI"}
                     for i in range(7)]
            # All six scheduled sources were already tried; the seventh has
            # an independently prepared image/evidence record but no notes request.
            result = join_reporter_notes(ready, ready[:6], {'tech-0':Path('/notes/tech-0.json')})
            discovery, approved, attempted, brief = [root/name for name in ('discovery.json','approved.json','attempted.json','brief.md')]
            discovery.write_text(json.dumps({'ready_leads':result,'publication_plan':{'Teknologji':3}}))
            approved.write_text('[]')
            attempted.write_text(json.dumps([a['url'] for a in ready[:6]]))
            self.assertEqual(build(discovery,brief,'Teknologji',approved=approved,attempted=attempted,limit=1),1)
            content = brief.read_text()
            self.assertIn(ready[6]['url'], content)
            self.assertIn(ready[6]['evidence_path'], content)
            self.assertNotIn(ready[0]['url'], content)


if __name__ == '__main__':
    unittest.main()
