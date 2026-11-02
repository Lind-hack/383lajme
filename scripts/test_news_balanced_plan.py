"""Behavioral coverage of the owner's two-to-three-per-desk publication plan."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from news_coverage import balance, deficits, plan_counts, replacement_plan
from news_source_policy import CATEGORIES, hourly_targets


class BalancedPlanTests(unittest.TestCase):
    def test_refill_drops_retried_unready_and_wrong_category_rows_while_preserving_approved(self):
        with tempfile.TemporaryDirectory() as folder:
            batch, discovery, attempted, backup = [Path(folder) / name for name in
                                                   ("batch.json", "discovery.json", "attempted.json", "approved.json")]
            approved = [{"category": "Sport", "url": "https://skysports.com/approved", "body": "Exact approved prose"}]
            retried = {"category": "Teknologji", "url": "https://techcrunch.com/already-tried"}
            fresh = {"category": "Teknologji", "url": "https://techcrunch.com/fresh"}
            unready = {"category": "Teknologji", "url": "https://techcrunch.com/not-prepared"}
            batch.write_text(json.dumps(approved + [retried, unready, {**fresh, "category": "Botë"}, fresh]), encoding="utf-8")
            backup.write_text(json.dumps(approved), encoding="utf-8")
            discovery.write_text(json.dumps({"publication_plan": hourly_targets(), "ready_leads": approved + [retried, fresh]}), encoding="utf-8")
            attempted.write_text(json.dumps([approved[0]["url"], retried["url"]]), encoding="utf-8")
            subprocess.run([sys.executable, str(Path(__file__).with_name("news_coverage.py")), str(batch), str(discovery),
                            "--balance", "--attempted", str(attempted), "--approved", str(backup)],
                           capture_output=True, text=True, check=True)
            self.assertEqual(json.loads(batch.read_text(encoding="utf-8")), approved + [fresh])

    def test_ample_inventory_expands_economy_and_showbiz_preserving_other_desks(self):
        plan = plan_counts(dict.fromkeys(CATEGORIES, 60))
        self.assertEqual(sum(plan.values()), 135)
        self.assertEqual(plan['Ekonomi'],60)
        self.assertEqual(plan['Showbiz'],60)
        self.assertTrue(all(value==3 for category,value in plan.items() if category not in {'Ekonomi','Showbiz'}))

    def test_small_budget_gives_every_desk_second_before_any_third(self):
        plan = plan_counts(dict.fromkeys(CATEGORIES, 20), total=14)
        self.assertTrue(all(value==2 for category,value in plan.items() if category not in {'Ekonomi','Showbiz'}))
        self.assertEqual(plan['Ekonomi'],20);self.assertEqual(plan['Showbiz'],20)
        plan = plan_counts(dict.fromkeys(CATEGORIES, 20), total=7)
        self.assertTrue(all(value==1 for category,value in plan.items() if category not in {'Ekonomi','Showbiz'}))

    def test_missing_inventory_is_a_shortfall_not_fourth_story_elsewhere(self):
        counts = dict.fromkeys(CATEGORIES, 20)
        counts['Kosovë'] = 0
        plan = plan_counts(counts)
        self.assertEqual(sum(plan.values()), 52)
        self.assertEqual(plan['Kosovë'], 0)
        self.assertEqual(deficits([], hourly_targets())['Kosovë'], 3)
        self.assertTrue(all(value<=3 for category,value in plan.items() if category not in {'Ekonomi','Showbiz'}))

    def test_replacement_exhaustion_does_not_mutate_declared_coverage(self):
        with tempfile.TemporaryDirectory() as folder:
            batch = Path(folder) / '2026-10-21T05.json'
            discovery = Path(folder) / 'discovery.json'
            attempted = Path(folder) / 'attempted.json'
            approved = [{'category': 'Botë', 'url': 'https://bbc.com/a'}]
            original = {'ready_leads': approved, 'publication_plan': hourly_targets()}
            batch.write_text(json.dumps(approved))
            discovery.write_text(json.dumps(original))
            attempted.write_text(json.dumps([approved[0]['url']]))
            result = subprocess.run([sys.executable, str(Path(__file__).with_name('news_coverage.py')),
                                     str(batch), str(discovery), '--attempted', str(attempted)],
                                    capture_output=True, text=True, check=True)
            self.assertEqual(sum(json.loads(result.stdout).values()), 0)
            self.assertEqual(json.loads(discovery.read_text()), original)

    def test_refill_retains_newly_feasible_third_story_in_spare_desk(self):
        with tempfile.TemporaryDirectory() as folder:
            paths = [Path(folder) / name for name in ('batch.json', 'discovery.json', 'attempted.json', 'approved.json')]
            batch, discovery, attempted, backup = paths
            approved = [{'category': c, 'url': f'https://example.com/{i}'} for i, c in enumerate(CATEGORIES)]
            additions = [{'category': 'Showbiz', 'url': f'https://example.com/show{i}'} for i in range(2)]
            batch.write_text(json.dumps(approved + additions))
            backup.write_text(json.dumps(approved))
            discovery.write_text(json.dumps({'publication_plan': hourly_targets(), 'ready_leads': approved + additions}))
            attempted.write_text(json.dumps([a['url'] for a in approved]))
            subprocess.run([sys.executable, str(Path(__file__).with_name('news_coverage.py')), str(batch), str(discovery),
                            '--balance', '--attempted', str(attempted), '--approved', str(backup)],
                           capture_output=True, text=True, check=True)
            self.assertEqual(json.loads(batch.read_text(encoding="utf-8")), approved + additions)

    def test_reporter_notes_cover_every_desk_twice_before_backup_work(self):
        from collections import Counter
        from prepare_editor_sources import reporter_note_candidates
        ready = [{"category": category, "url": f"{category}/{index}"}
                 for category in CATEGORIES for index in range(8)]
        rows = reporter_note_candidates(ready, hourly_targets())
        self.assertEqual(Counter(row["category"] for row in rows[:14]), dict.fromkeys(CATEGORIES, 2))
        self.assertEqual(Counter(row["category"] for row in rows),
                         {category: target + 3 for category, target in hourly_targets().items()})

    def test_sparse_notes_queue_still_starts_with_all_available_desks(self):
        from prepare_editor_sources import reporter_note_candidates
        ready = [{"category": CATEGORIES[0], "url": str(index)} for index in range(20)]
        ready += [{"category": category, "url": category} for category in CATEGORIES[1:]]
        rows = reporter_note_candidates(ready, hourly_targets())
        self.assertEqual([row["category"] for row in rows[:7]], list(CATEGORIES))

    def test_overfull_approved_input_cannot_expand_the_hourly_ceiling(self):
        rows = [{'category': 'Botë', 'url': f'https://bbc.com/{n}'} for n in range(4)]
        with self.assertRaises(ValueError):
            replacement_plan(rows, [], [])
        self.assertEqual(len(balance(rows, {'Botë': 20})), 3)


if __name__ == '__main__':
    unittest.main()
