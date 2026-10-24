import unittest

from prepare_editor_sources import prioritize_grounded_leads, source_basis_warning


def lead(name, primary_words, secondary_words=0):
    return {"pair_id": name,
            "primary_evidence": {"status": "text_extracted", "text": "fakt " * primary_words},
            "secondary_evidence": {"status": "text_extracted", "text": "tjetër " * secondary_words}}


class EvidencePriorityTests(unittest.TestCase):
    def test_explicit_genre_markers_warn_without_discarding_public_facts_or_generic_exclusive_words(self):
        for metadata in [dict(title="Kartik Aaryan movie announced (EXCLUSIVE)"),
                         dict(url="https://variety.com/gallery/red-carpet-celebrity-photos"),
                         dict(tags=["opinion"]), dict(url="https://cbssports.com/betting/news/preview")]:
            risky = {**lead('labelled', 220), **metadata}
            public = lead('public', 220)
            self.assertTrue(source_basis_warning(risky))
            self.assertEqual(prioritize_grounded_leads([risky,public]),[public,risky])
        self.assertFalse(source_basis_warning({**lead('public venue',200), 'title':'Public concert announced at an exclusive venue'}))

    def test_public_facts_precede_outlet_interviews_without_discarding_them(self):
        for signal in ['Në një intervistë për Kubi Sportiv ai u shpreh',
                       'Dubois told Sky Sports he wanted a fight',
                       'Sources at the party tell TMZ the event was private',
                       'Sipas qytetarëve të intervistuar rruga është bllokuar',
                       'A representative told the Journal the deal closed']:
            risky = lead('interview', 240)
            risky['primary_evidence']['text'] += signal
            public = lead('public announcement', 220)
            self.assertTrue(source_basis_warning(risky), signal)
            self.assertEqual(prioritize_grounded_leads([risky, public]), [public, risky])
        public['primary_evidence']['text'] += ' The ministry announced the decision at a public press conference.'
        self.assertFalse(source_basis_warning(public))

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
