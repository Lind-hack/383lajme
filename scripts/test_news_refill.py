import unittest
from news_refill import replacements, merge, rewrite_input
from news_source_policy import CATEGORIES
from collections import Counter


class RefillTests(unittest.TestCase):
    def test_rewrites_cannot_overfill_an_already_replenished_category_or_repeat_approved_sources(self):
        approved = [{"url": f"https://example.com/approved-{i}", "category": "Sport"} for i in range(3)]
        rejected = [{"url": "https://example.com/new-sport", "category": "Sport"},
                    {"url": "https://example.com/new-tech", "category": "Teknologji", "slug": "tech",
                     "body": "Rejected source-like prose", "title": "Rejected headline", "rejection_reason": "Change structure"},
                    approved[0]]
        selected = rewrite_input(approved, rejected)
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]["slug"], "tech")
        self.assertEqual(selected[0]["rejection_reason"], "Change structure")
        self.assertNotIn("body", selected[0])
        self.assertNotIn("title", selected[0])

    def test_rewrite_selection_fills_empty_desks_before_thirds_and_keeps_the_twenty_cap(self):
        approved = [{"url": f"https://example.com/k-{i}", "category": "Kosovë"} for i in range(2)]
        rejected = [{"url": f"https://example.com/{category}-{i}", "category": category}
                    for category in CATEGORIES for i in range(4)]
        selected = rewrite_input(approved, rejected)
        self.assertNotEqual(selected[0]["category"], "Kosovë")
        counts = Counter(article["category"] for article in approved + selected)
        self.assertEqual(len(approved + selected), 20)
        self.assertTrue(all(2 <= counts[category] <= 3 for category in CATEGORIES))

    def test_replacement_review_preserves_the_exact_approved_body(self):
        approved = [{"url": "https://bbc.com/approved", "body": "Independently verified original writing"}]
        new = {"url": "https://bbc.com/new", "body": "Draft needing review"}
        subset = replacements(approved, approved + [new])
        self.assertEqual(subset, [new])
        reviewed = [{**new, "body": "Corrected, independently verified replacement"}]
        self.assertEqual(merge(approved, reviewed)[0], approved[0])
        self.assertEqual(merge(approved, reviewed)[1], reviewed[0])
        with self.assertRaises(ValueError):
            replacements(approved, [{**approved[0], "body": "Changed approved text"}, new])
        with self.assertRaises(ValueError):
            merge(approved, approved)


if __name__ == "__main__":
    unittest.main()
