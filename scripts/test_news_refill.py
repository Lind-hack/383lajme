import unittest
from news_refill import replacements, merge


class RefillTests(unittest.TestCase):
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
