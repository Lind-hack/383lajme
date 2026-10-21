import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import news_image_policy as policy


class PlanningBudgetTests(unittest.TestCase):
    def test_expired_wikipedia_budget_never_starts_a_request(self):
        policy._NETWORK_BUDGET.deadline = 1
        try:
            with patch.object(policy.time, 'monotonic', return_value=2), patch.object(policy.requests, 'get') as get:
                with self.assertRaises(policy.requests.Timeout):
                    policy.api_get('https://en.wikipedia.org/w/api.php', {})
                get.assert_not_called()
        finally:
            del policy._NETWORK_BUDGET.deadline

    def test_wikipedia_and_model_planning_share_the_same_stage_budget(self):
        seen = []
        def wiki(lead):
            seen.append(policy._NETWORK_BUDGET.deadline)
            return None
        with tempfile.TemporaryDirectory() as folder, patch('news_model.stage_deadline', return_value=100), \
                patch.object(policy.time, 'monotonic', return_value=90), \
                patch.object(policy, 'wiki_plan', side_effect=wiki), \
                patch.object(policy, '_plan_chunk', return_value={}) as model:
            self.assertEqual(policy.plan_subjects([{'pair_id': 'a'}, {'pair_id': 'b'}], Path(folder)), {})
        self.assertEqual(seen, [100, 100])
        self.assertEqual(model.call_args.kwargs['deadline'], 100)


if __name__ == '__main__':
    unittest.main()
