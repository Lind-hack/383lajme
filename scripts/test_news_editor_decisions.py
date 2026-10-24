import json
import tempfile
import unittest
import io
from contextlib import redirect_stdout
from pathlib import Path

from news_editor_decisions import CHECKS, apply_decisions
from news_model_response import save_response


class EditorialDecisionsTests(unittest.TestCase):
    def test_drops_and_invalid_corrections_leave_actionable_audit_reasons(self):
        dropped = {"url": self.article["url"], "action": "drop", "reason": "No independently readable confirmation\nfor this allegation."}
        output = io.StringIO()
        with redirect_stdout(output):
            self.assertEqual(apply_decisions([self.article], [dropped]), [])
        self.assertIn("reason=No independently readable confirmation for this allegation.", output.getvalue())
        output = io.StringIO()
        with redirect_stdout(output), self.assertRaises(ValueError):
            apply_decisions([self.article], [])
        with redirect_stdout(output), self.assertRaises(ValueError):
            apply_decisions([self.article], [{**self.keep, "checks": {}}])
        self.assertIn("retained copy requires every editorial check", output.getvalue())

    def setUp(self):
        self.article = {"url": "https://techcrunch.com/verified", "slug": "verified", "category": "Teknologji",
                        "title": "Titull i verifikuar", "excerpt": "Përmbledhje e verifikuar.",
                        "body": "<p>Fjalia e parë. Një pohim i gabuar.</p><p>Fakti tjetër.</p>",
                        "image_url": "https://upload.wikimedia.org/verified.jpg", "published_at": "2026-10-23T16:00:00Z"}
        self.keep = {"url": self.article["url"], "action": "keep", "checks": dict.fromkeys(CHECKS, True)}

    def test_keep_preserves_every_character_and_all_metadata(self):
        self.assertEqual(apply_decisions([self.article], [self.keep]), [self.article])

    def test_only_the_explicit_defective_span_changes_and_identity_photo_time_stay_exact(self):
        correction = {**self.keep, "action": "correct", "edits": [{"field": "body", "before": "Një pohim i gabuar.",
                      "after": "Pohimi i mbështetur.", "defect": "factual", "reason": "The fetched evidence states the corrected fact."}]}
        result = apply_decisions([self.article], [correction])[0]
        expected = {**self.article, "body": self.article["body"].replace("Një pohim i gabuar.", "Pohimi i mbështetur.")}
        self.assertEqual(result, expected)
        self.assertEqual(self.article["body"], "<p>Fjalia e parë. Një pohim i gabuar.</p><p>Fakti tjetër.</p>")

    def test_invalid_or_ambiguous_edits_cannot_change_or_publish_an_unreviewed_article(self):
        for edit in ({"field": "image_url", "before": self.article["image_url"], "after": "invented"},
                     {"field": "body", "before": "not in the draft", "after": "invented"},
                     {"field": "body", "before": "p>", "after": "invented"}):
            decision = {**self.keep, "action": "correct", "edits": [{**edit, "defect": "factual", "reason": "A sufficiently specific defect explanation."}]}
            with self.assertRaises(ValueError):
                apply_decisions([self.article], [decision])

    def test_missing_checks_duplicate_identities_and_unrelated_decisions_fail_closed(self):
        for decisions in ([{**self.keep, "checks": {}}], [self.keep, self.keep],
                          [{**self.keep, "url": "https://unknown.example/new"}], []):
            with self.assertRaises(ValueError):
                apply_decisions([self.article], decisions)

    def test_bad_decision_is_isolated_and_only_explicitly_checked_copy_survives(self):
        other = {**self.article, "url": "https://techcrunch.com/other", "slug": "other"}
        self.assertEqual(apply_decisions([self.article, other], [self.keep]), [self.article])
        dropped = {"url": other["url"], "action": "drop", "reason": "The independently prepared photograph depicts another person."}
        self.assertEqual(apply_decisions([self.article, other], [self.keep, dropped]), [self.article])

    def test_scoring_updates_do_not_rewrite_prose_or_allow_identity_changes(self):
        updated = {**self.keep, "metadata": {"score_reason": "Verified evidence supports this individual rating."}}
        self.assertEqual(apply_decisions([self.article], [updated]), [{**self.article, **updated["metadata"]}])
        with self.assertRaises(ValueError):
            apply_decisions([self.article], [{**self.keep, "metadata": {"published_at": "invented"}}])

    def test_atomic_response_wrapper_preserves_input_on_invalid_decisions(self):
        with tempfile.TemporaryDirectory() as directory:
            batch = Path(directory)/"batch.json"
            batch.write_text(json.dumps([self.article]), encoding="utf-8")
            before = batch.read_bytes()
            with self.assertRaises(ValueError):
                save_response('383_JSON_BEGIN [] 383_JSON_END', batch, 'editor-decisions')
            self.assertEqual(batch.read_bytes(), before)
            output = '383_JSON_BEGIN '+json.dumps([self.keep])+' 383_JSON_END'
            self.assertEqual(save_response(output, batch, 'editor-decisions'), 1)
            self.assertEqual(json.loads(batch.read_text(encoding="utf-8")), [self.article])


if __name__ == "__main__":
    unittest.main()
