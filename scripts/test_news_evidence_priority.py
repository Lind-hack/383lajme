import unittest

from prepare_editor_sources import prioritize_grounded_leads


def lead(name, primary_words, secondary_words=0):
    return {"pair_id": name,
            "primary_evidence": {"status": "text_extracted", "text": "fakt " * primary_words},
            "secondary_evidence": {"status": "text_extracted", "text": "tjetër " * secondary_words}}


class EvidencePriorityTests(unittest.TestCase):
    def test_substantial_reports_precede_clips_without_discarding_brief_sources(self):
        rows = [lead('live commentary', 17), lead('full report', 240), lead('brief report', 126)]
        result = prioritize_grounded_leads(rows)
        self.assertEqual([row['pair_id'] for row in result], ['full report', 'brief report', 'live commentary'])
        self.assertEqual(len(result), len(rows))

    def test_readable_corroboration_can_make_a_brief_primary_usable(self):
        rows = [lead('unsupported clip', 73), lead('paired brief', 73, 90), lead('later full report', 300)]
        self.assertEqual([row['pair_id'] for row in prioritize_grounded_leads(rows)],
                         ['paired brief', 'later full report', 'unsupported clip'])
        rows[1]['secondary_evidence']['status'] = 'restricted'
        self.assertEqual(prioritize_grounded_leads(rows)[0]['pair_id'], 'later full report')


if __name__ == '__main__':
    unittest.main()
