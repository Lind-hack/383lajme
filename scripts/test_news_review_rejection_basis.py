import copy
import unittest
from news_review_rejection_basis import grounded_rejection


class RejectionGroundsTests(unittest.TestCase):
    def setUp(self):
        self.article = {"title": "A distinctive headline", "body": "<p>A first copied expression. A second copied expression.</p>"}
        self.record = {"evidence": {"title": "A distinctive headline", "text": "A first source expression. A second source expression."}}
        self.decision = {"verdict": "reject", "checks": {"not_close_translation": False}, "rejection_basis": {
            "kind": "copy_expression", "facts_only": False,
            "why_expression": "These passages repeat the source's distinctive imagery rather than merely reporting its facts.",
            "matches": [{"source_span": "A first source expression.", "article_span": "A first copied expression."},
                        {"source_span": "A second source expression.", "article_span": "A second copied expression."}]}}

    def test_copying_needs_real_distinct_passages_in_both_article_and_source(self):
        self.assertTrue(grounded_rejection(self.decision, self.article, self.record))
        for changed in ([], [self.decision["rejection_basis"]["matches"][0]] * 2,
                        [{"source_span": "An invented source quotation", "article_span": "A first copied expression."}]):
            decision = copy.deepcopy(self.decision); decision["rejection_basis"]["matches"] = changed
            self.assertFalse(grounded_rejection(decision, self.article, self.record))

    def test_facts_only_or_missing_explanations_do_not_establish_copying(self):
        for changes in ({"facts_only": True}, {"facts_only": "false"}, {"why_expression": "Too short"}, {"kind": []}):
            decision = copy.deepcopy(self.decision); decision["rejection_basis"].update(changes)
            self.assertFalse(grounded_rejection(decision, self.article, self.record))
        self.assertFalse(grounded_rejection({"verdict": "approve", **{k:v for k,v in self.decision.items() if k!='verdict'}}, self.article, self.record))

    def test_distinctive_headline_and_exclusive_expression_keep_their_single_passage_rule(self):
        decision = copy.deepcopy(self.decision)
        decision["rejection_basis"].update(kind="copy_headline", matches=[{
            "source_span": "A distinctive headline", "article_span": "A distinctive headline"}])
        self.assertTrue(grounded_rejection(decision, self.article, self.record))
        decision["rejection_basis"].update(kind="borrowed_expression", matches=self.decision["rejection_basis"]["matches"][:1])
        self.assertFalse(grounded_rejection(decision, self.article, self.record))
        decision["checks"]["no_borrowed_exclusive_expression"] = False
        self.assertTrue(grounded_rejection(decision, self.article, self.record))

    def test_factual_rejection_requires_an_actual_claim_and_failed_truth_check(self):
        decision = {"verdict": "reject", "checks": {"claims_supported": False}, "rejection_basis": {
            "kind": "factual", "article_span": "A first copied expression.", "source_span": "A first source expression.",
            "explanation": "The supplied source contradicts the specific claim and does not support its stated number."}}
        self.assertTrue(grounded_rejection(decision, self.article, self.record))
        decision["rejection_basis"]["source_span"] = "Not actually in the source"
        self.assertFalse(grounded_rejection(decision, self.article, self.record))
        decision["rejection_basis"]["support"] = "absent"
        self.assertTrue(grounded_rejection(decision, self.article, self.record))
        decision["checks"]["claims_supported"] = True
        self.assertFalse(grounded_rejection(decision, self.article, self.record))

    def test_missing_or_malformed_grounds_never_imply_approval(self):
        for basis in (None, [], {}, {"kind": "unknown"}):
            self.assertFalse(grounded_rejection({**self.decision, "rejection_basis": basis}, self.article, self.record))

    def test_a_verified_distinctive_passage_still_blocks_copying_when_a_second_quote_has_a_typo(self):
        decision=copy.deepcopy(self.decision)
        decision['checks']['no_borrowed_exclusive_expression']=False
        decision['rejection_basis']['matches'][0]['article_span']='A first copied expressio.'
        self.assertTrue(grounded_rejection(decision,self.article,self.record))
        decision['rejection_basis']['matches'][1]['article_span']='Another invented quotation.'
        self.assertFalse(grounded_rejection(decision,self.article,self.record))


if __name__ == "__main__":
    unittest.main()
