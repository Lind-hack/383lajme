import json
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch

import news_copyright_review as review
from originality_gate import originality_errors


def decision(article, verdict="approve", **checks):
    return {"slug": article["slug"], "url": article["url"], "verdict": verdict,
            "reason": "Compared the source and draft composition, claims, attribution and photo rights independently.",
            "checks": {**dict.fromkeys(review.CHECKS, True), **checks}}


class CopyrightReviewTests(unittest.TestCase):
    def test_invalid_review_identity_is_retried_without_losing_good_decisions(self):
        from types import SimpleNamespace
        other = {**self.article, "slug": "other-story", "url": "https://koha.net/other"}
        articles = [self.article, other]
        records = {self.article["slug"]: self.record, other["slug"]: {**self.record, "slug": other["slug"]}}
        bad = {**decision(other), "review_id": "story-999"}
        replies = [[{**decision(self.article), "review_id": "story-001"}, bad], [bad]]
        def respond(command, **kwargs):
            return SimpleNamespace(returncode=0, stdout="383_REVIEW_BEGIN" +
                                   json.dumps(replies.pop(0)) + "383_REVIEW_END")
        with patch("news_model.run_process", side_effect=respond) as model:
            result = review._review_with_retry(self.batch, articles, records, 0)
        self.assertEqual(result, [decision(self.article)])
        self.assertEqual(model.call_count, 2)

    def test_partially_unavailable_reviews_preserve_only_explicit_valid_approvals(self):
        other = {**self.article, "slug": "other-story", "url": "https://koha.net/other"}
        self.batch.write_text(json.dumps([self.article, other]), encoding="utf-8")
        self.evidence.write_text(json.dumps([self.record, {**self.record, "slug": other["slug"]}]), encoding="utf-8")
        with patch.object(review, "_review_with_retry", return_value=[decision(self.article)]):
            review.review(self.batch)
        self.assertEqual(json.loads(self.batch.read_text(encoding="utf-8")), [self.article])
        review.verify_review(self.batch, [self.article], review.evidence_records(self.evidence))

    def test_reviewer_receives_unclipped_article_and_source_text(self):
        from types import SimpleNamespace
        article = {**self.article, "body": "<p>Original prose. " * 300 + "END_ARTICLE</p>"}
        record = {**self.record, "evidence": {**self.record["evidence"],
                                             "text": "Verified evidence. " * 800 + "END_EVIDENCE"}}
        def respond(command, **kwargs):
            view = self.batch.with_suffix(".copyright-input-0.md").read_text(encoding="utf-8")
            self.assertLessEqual(max(map(len, view.splitlines())), 160)
            self.assertIn("END_ARTICLE", view)
            self.assertIn("END_EVIDENCE", view)
            self.assertIn("offset", command[-1])
            return SimpleNamespace(returncode=0, stdout="383_REVIEW_BEGIN" +
                                   json.dumps([{**decision(article), "review_id": "story-001"}]) + "383_REVIEW_END")
        with patch("news_model.run_process", side_effect=respond):
            self.assertEqual(review._review_chunk(self.batch, [article], {article["slug"]: record}, 0),
                             [decision(article)])

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.batch = Path(self.folder.name) / "2026-10-12T05.json"
        self.evidence = self.batch.with_suffix(".editor-sources.json")
        self.article = {"slug": "kosove-original-story", "url": "https://koha.net/story", "category": "Kosovë",
                        "title": "Prishtinë cakton afatin e konsultimit", "excerpt": "Konsultimi mbyllet të premten.",
                        "body": "<p>Banorët kanë afat deri të premten për të dërguar propozimet e tyre.</p>"}
        self.record = {"slug": self.article["slug"], "source_url": self.article["url"],
                       "evidence": {"status": "text_extracted", "url": self.article["url"],
                                    "text": "The council will accept public comments until Friday."}}
        self.batch.write_text(json.dumps([self.article]), encoding="utf-8")
        self.evidence.write_text(json.dumps([self.record]), encoding="utf-8")

    def save(self, decisions):
        return review.save_review(self.batch, self.evidence,
                                  "383_REVIEW_BEGIN" + json.dumps(decisions) + "383_REVIEW_END")

    def test_close_translation_can_be_rejected_even_without_exact_overlap(self):
        self.assertEqual(originality_errors(self.article, self.record), [])
        self.assertEqual(self.save([decision(self.article, not_close_translation=False)]), 0)
        self.assertEqual(json.loads(self.batch.read_text()), [])

    def test_a_rejection_is_kept_for_one_rewrite_and_twice_rests_the_story_a_day(self):
        drafts, ledger = Path(self.folder.name) / "rejected.json", Path(self.folder.name) / "ledger.json"
        with patch.dict(review.os.environ, {"L383_REVIEW_REJECTED": str(drafts), "L383_REJECTION_LEDGER": str(ledger)}):
            rejected = {**decision(self.article, "reject", not_close_translation=False),
                        "reason": "The lead closely translates the source's first sentence about the Friday deadline."}
            self.save([rejected])
            rows = json.loads(drafts.read_text(encoding="utf-8"))
            self.assertEqual((rows[0]["url"], rows[0]["rejection_reason"][:9]), (self.article["url"], "The lead "))
            self.assertFalse(review.cooling_down(self.article["url"]))
            self.batch.write_text(json.dumps([self.article]), encoding="utf-8")
            self.save([rejected])
            self.assertTrue(review.cooling_down(self.article["url"]))
            self.assertEqual(len(json.loads(drafts.read_text(encoding="utf-8"))), 1)  # one row per story
            stale = (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat()
            ledger.write_text(json.dumps({self.article["url"]: [stale, stale]}), encoding="utf-8")
            self.assertFalse(review.cooling_down(self.article["url"]))

    def test_a_failed_review_chunk_holds_back_only_its_own_articles(self):
        articles = [{**self.article, "slug": f"kosove-original-story-{n}", "url": f"https://koha.net/story-{n}"} for n in range(8)]
        records = [{**self.record, "slug": a["slug"], "source_url": a["url"]} for a in articles]
        self.batch.write_text(json.dumps(articles), encoding="utf-8")
        self.evidence.write_text(json.dumps(records), encoding="utf-8")
        def chunk(batch, todo, records, index):
            if index == 1:
                raise review.subprocess.TimeoutExpired("hermes", 360)
            return [decision(article) for article in todo]
        drafts = Path(self.folder.name) / "rejected.json"
        with patch.object(review, "_review_chunk", side_effect=chunk), \
                patch.dict(review.os.environ, {"L383_REVIEW_REJECTED": str(drafts)}):
            review.review(self.batch)
        kept = [article["slug"] for article in json.loads(self.batch.read_text(encoding="utf-8"))]
        self.assertEqual(kept, [article["slug"] for article in articles[:review.REVIEW_CHUNK]])
        self.assertFalse(drafts.exists())

    def test_changes_while_reviewer_runs_cannot_receive_old_approval(self):
        snapshot = review.snapshot_digest([self.article], {self.article["slug"]: self.record})
        self.article["body"] = "An entirely different article after the review started."
        self.batch.write_text(json.dumps([self.article]), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "changed during"):
            review.save_review(self.batch, self.evidence,
                "383_REVIEW_BEGIN" + json.dumps([decision(self.article)]) + "383_REVIEW_END",
                reviewed_snapshot=snapshot)
        self.assertFalse(self.batch.with_suffix(".copyright-review.json").exists())

    def test_unavailable_new_reviews_preserve_matching_prior_approvals(self):
        self.save([decision(self.article)])
        second = {**self.article, "slug": "kosove-unreviewed-story", "url": "https://koha.net/new"}
        self.batch.write_text(json.dumps([self.article, second]), encoding="utf-8")
        self.evidence.write_text(json.dumps([self.record, {**self.record, "slug": second["slug"],
                                                         "source_url": second["url"]}]), encoding="utf-8")
        with patch.object(review, "_review_chunk", side_effect=review.subprocess.TimeoutExpired("hermes", 360)):
            self.assertEqual(review.review(self.batch), 0)
        kept = json.loads(self.batch.read_text(encoding="utf-8"))
        self.assertEqual(kept, [self.article])
        review.verify_review(self.batch, kept, review.evidence_records(self.evidence))

    def test_refill_rounds_share_one_receipt_and_skip_articles_already_approved(self):
        shared = Path(self.folder.name) / "full.copyright-review.json"
        with patch.dict(review.os.environ, {"L383_REVIEW_RECEIPT": str(shared)}):
            self.save([decision(self.article)])
            self.assertIn(self.article["slug"], json.loads(shared.read_text())["articles"])
            # The same article in a later round costs no model call.
            with patch("news_model.run_process") as model:
                self.assertEqual(review.review(self.batch), 0)
            model.assert_not_called()
            # A new round's article is reviewed alone; the earlier approval stays.
            second = {**self.article, "slug": "kosove-second-story", "url": "https://koha.net/second"}
            self.batch.write_text(json.dumps([second]), encoding="utf-8")
            self.evidence.write_text(json.dumps([{**self.record, "slug": second["slug"], "source_url": second["url"]}]), encoding="utf-8")
            prior, when = review.prior_approvals(self.batch, [second], review.evidence_records(self.evidence))
            self.assertEqual(prior, {})
            review.save_review(self.batch, self.evidence, "383_REVIEW_BEGIN" + json.dumps([decision(second)]) + "383_REVIEW_END",
                               prior=prior, prior_reviewed_at=json.loads(shared.read_text())["reviewed_at"])
            self.assertEqual(set(json.loads(shared.read_text())["articles"]), {self.article["slug"], second["slug"]})

    def test_empty_candidates_finish_without_model_call(self):
        self.batch.write_text("[]", encoding="utf-8")
        with patch("news_model.run_process") as model:
            self.assertEqual(review.review(self.batch), 0)
        model.assert_not_called()

    def test_approval_is_bound_to_prose_photo_rights_and_evidence(self):
        self.save([decision(self.article)])
        records = review.evidence_records(self.evidence)
        review.verify_review(self.batch, [self.article], records)
        for field in ("body", "excerpt", "title", "required_attribution", "image_rights"):
            with self.subTest(field=field), self.assertRaises(ValueError):
                review.verify_review(self.batch, [{**self.article, field: "changed"}], records)
        changed_record = {**self.record, "evidence": {"text": "changed source"}}
        with self.assertRaises(ValueError):
            review.verify_review(self.batch, [self.article], {self.article["slug"]: changed_record})

    def test_site_timestamp_and_derived_scores_do_not_invalidate_review(self):
        self.save([decision(self.article)])
        review.verify_review(self.batch, [{**self.article, "published_at": "2026-10-12T05:05:00Z", "engagement_score": 7}],
                             review.evidence_records(self.evidence))

    def test_incomplete_unknown_and_duplicate_decisions_preserve_original_batch(self):
        before = self.batch.read_bytes()
        for rows in ([], [decision({**self.article, "slug": "unknown"})], [decision(self.article)] * 2):
            with self.assertRaises(ValueError):
                self.save(rows)
            self.assertEqual(self.batch.read_bytes(), before)

    def test_failed_checks_string_booleans_and_expired_receipts_cannot_pass(self):
        self.assertEqual(self.save([decision(self.article, attribution_supported="true")]), 0)
        self.batch.write_text(json.dumps([self.article]), encoding="utf-8")
        self.save([decision(self.article)])
        receipt_path = self.batch.with_suffix(".copyright-review.json")
        receipt = json.loads(receipt_path.read_text())
        receipt["reviewed_at"] = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        receipt_path.write_text(json.dumps(receipt))
        with self.assertRaises(ValueError):
            review.verify_review(self.batch, [self.article], review.evidence_records(self.evidence))

    def test_exact_copy_is_rechecked_even_if_semantic_reviewer_approved(self):
        text = "Ministria njoftoi sot se projekti do të nisë në Prishtinë më 1 tetor pas përfundimit të procedurave."
        self.article["body"] = "<p>" + text + "</p>"
        self.record["evidence"]["text"] = text
        self.batch.write_text(json.dumps([self.article]), encoding="utf-8")
        self.evidence.write_text(json.dumps([self.record]), encoding="utf-8")
        self.save([decision(self.article)])
        with patch("topic_selection_gate.evidence_errors", return_value=[]), patch("editorial_rules_v2.article_errors", return_value=[]), \
             patch("news_image_policy.image_errors", return_value=[]), patch("journalism_quality_gate.journalism_errors", return_value=[]):
            with self.assertRaisesRegex(ValueError, "exact source overlap"):
                review.validate_for_publication(self.batch)


if __name__ == "__main__":
    unittest.main()
