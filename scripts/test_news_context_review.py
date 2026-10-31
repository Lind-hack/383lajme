import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import codex_automation_support as support
import news_context_review as review
from news_image_policy import batch_image_errors


def article(number, **fields):
    return {"id": str(number), "slug": f"context-story-{number}", "category": "Shqipëri",
            "title": "Rama paraqet paketën për taksat",
            "body": "<p>Kryeministri prezantoi masat tatimore gjatë mbledhjes së sotme.</p>",
            "url": f"https://example.org/story-{number}", **fields}


def distinct(row, **extra):
    return {"review_id": "draft-0", "verdict": "distinct", "article_span": row["title"],
            "reason": "This separate decision introduces a materially different public outcome.", **extra}


class ContextReviewTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.batch = Path(self.folder.name) / "2026-10-28T12.json"
        def select(batch, articles, history, deadline):
            count = (len(history) + review.CATALOGUE_CHUNK - 1) // review.CATALOGUE_CHUNK
            return ({row['slug']: history for row in articles},
                    {row['slug']: [{'related_ids': [], 'reason': 'A complete catalogue comparison selected the supplied related records.'}] * count
                     for row in articles})
        selector = patch.object(review, 'select_comparisons', side_effect=select)
        selector.start()
        self.addCleanup(selector.stop)

    def save(self, articles):
        self.batch.write_text(json.dumps(articles), encoding="utf-8")

    def test_missing_verdict_retries_but_valid_uncertainty_is_not_retried(self):
        row=article(1)
        self.save([row])
        with patch.object(review,'ask_rows',side_effect=[[],[distinct(row)]]) as model:
            self.assertEqual(review.review(self.batch,[]),1)
        self.assertEqual(model.call_count,2)
        review.verify(self.batch,[row],[])
        self.save([row])
        with patch.object(review,'ask_rows',return_value=[distinct(row,verdict='uncertain')]) as model:
            with self.assertRaises(ValueError):review.review(self.batch,[])
        self.assertEqual(model.call_count,1)

    def test_each_initial_target_gets_a_turn_before_retrying_missing_verdicts(self):
        import threading
        drafts=[article(i) for i in range(1,8)]
        self.save(drafts)
        order=[];calls={};lock=threading.Lock()
        def compare(batch,articles,history,index,deadline,targets):
            with lock:
                order.append(index);calls[index]=calls.get(index,0)+1
                first=calls[index]==1
            if index<6 and first:return {}
            return {row['slug']:distinct(row) for row in articles if row['slug'] in targets}
        # Test FIFO submission policy deterministically, independently of OS
        # preemption between a worker entering the callback and recording it.
        executor=review.concurrent.futures.ThreadPoolExecutor
        with patch.object(review.concurrent.futures,'ThreadPoolExecutor',side_effect=lambda **kw:executor(max_workers=1)), \
                patch.object(review,'review_chunk',side_effect=compare):
            self.assertEqual(review.review(self.batch,[]),7)
        self.assertEqual(set(order[:7]),set(range(7)))

    def test_target_group_keeps_every_preceding_sibling_without_supplying_later_copy(self):
        drafts = [article(i, body=f'<p>Complete comparison prose for unique story {i}.</p>')
                  for i in range(1, 7)]
        old = article(20, batch_key='older')
        def compare(prompt, brief, *args, **kwargs):
            text = brief.read_text(encoding='utf-8')
            for row in [*drafts[:4], old]:
                self.assertIn(row['body'], text)
            for row in drafts[4:]:
                self.assertNotIn(row['body'], text)
            return [distinct(drafts[i], review_id=f'draft-{i}') for i in (1, 3)]
        with patch.object(review, 'ask_rows', side_effect=compare):
            decisions = review.review_chunk(self.batch, drafts, [old], 0, float('inf'),
                                           {drafts[1]['slug'], drafts[3]['slug']})
        self.assertEqual(set(decisions), {drafts[1]['slug'], drafts[3]['slug']})

    def test_one_slow_comparison_holds_only_its_target(self):
        drafts = [article(i) for i in range(1, 5)]
        self.save(drafts)
        def compare(batch, articles, history, index, deadline, targets=None):
            self.assertEqual(len(targets), 1)
            target = next(iter(targets))
            if target == drafts[1]['slug']:
                raise subprocess.TimeoutExpired('independent comparison', 1)
            return {row['slug']: distinct(row, review_id=f'draft-{i}')
                    for i, row in enumerate(articles) if row['slug'] in targets}
        with patch.object(review, 'review_chunk', side_effect=compare):
            self.assertEqual(review.review(self.batch, []), 3)
        kept = [drafts[i] for i in (0, 2, 3)]
        self.assertEqual(json.loads(self.batch.read_text(encoding='utf-8')), kept)
        review.verify(self.batch, kept, [])

    def test_low_overlap_paraphrase_is_compared_with_complete_history_across_categories(self):
        old = article(1, category="Ekonomi", title="Qeveria ul barrën fiskale për shportën bazë",
                      body="<p>Vendimi përfshin 54 ushqime dhe rritjen me një pikë të normës standarde.</p>",
                      batch_key="older")
        new = article(2, title="Rama propozon rritjen e TVSH-së jashtë shportës në Shqipëri",
                      body="<p>Norma për produktet e tjera shtohet me një pikë sipas paketës së re.</p>")
        self.assertFalse(support._same_story(new, old))
        self.save([new])
        decision = distinct(new, verdict="retelling", against_id="published-0", against_span=old["body"])
        def compare(prompt, brief, *args, **kwargs):
            text = brief.read_text(encoding="utf-8")
            for row in (old, new):
                self.assertIn(row["body"], text)
            self.assertIn("EVERY supplied published article", prompt)
            self.assertIn("openai-codex", args[0])
            self.assertIn("gpt-6-luna", args[0])
            return [decision]
        with patch.object(review, "ask_rows", side_effect=compare):
            self.assertEqual(review.review(self.batch, [old]), 0)
        self.assertEqual(json.loads(self.batch.read_text(encoding="utf-8")), [])

    def test_sibling_angles_are_reviewed_without_a_word_overlap_requirement(self):
        first = article(1, title="Rama propozon uljen e TVSH-së për 54 ushqime bazë")
        second = article(2, title="Norma standarde e tatimit shtohet me një pikë")
        self.save([first, second])
        replies = [distinct(first), distinct(second, review_id="draft-1", verdict="retelling",
                                            against_id="draft-0", against_span=first["title"])]
        with patch.object(review, "ask_rows", return_value=replies):
            self.assertEqual(review.review(self.batch, []), 1)
        review.verify(self.batch, [first], [])
        self.assertEqual(json.loads(self.batch.read_text(encoding="utf-8")), [first])

    def test_real_subsequent_development_is_kept_and_receipt_binds_copy_and_history(self):
        old = article(1, batch_key="yesterday")
        new = article(2, title="Parlamenti rrëzon sot propozimin për ndryshimin e taksave")
        self.save([new])
        with patch.object(review, "ask_rows", return_value=[distinct(new)]):
            self.assertEqual(review.review(self.batch, [old]), 1)
        review.verify(self.batch, [new], [old])
        for changed in ({**new, "body": "Changed article copy"}, {**new, "image_url": "https://new.example/image.jpg"}):
            with self.assertRaises(ValueError):
                review.verify(self.batch, [changed], [old])
        with self.assertRaises(ValueError):
            review.verify(self.batch, [new], [old, article(3)])
        review.verify(self.batch, [new], [])  # An unchanged publication can age out of the 36-hour window.
        # Timestamp/ranking updates after publication do not change the prose.
        review.verify(self.batch, [{**new, "published_at": "2026-10-28T12:30:00Z"}],
                      [old, {**new, "batch_key": self.batch.stem}])

    def test_missing_duplicate_fabricated_or_unavailable_decisions_hold_copy(self):
        new = article(1)
        good = distinct(new)
        answers = [[], [good, good], [distinct(new, verdict=[])],
                   [distinct(new, article_span="An invented span that is not in this article")],
                   [distinct(new, verdict="retelling", against_id="draft-5", against_span=new["title"])],
                   [distinct(new, verdict="uncertain")]]
        for rows in answers:
            self.save([new])
            with self.subTest(rows=rows), patch.object(review, "ask_rows", return_value=rows), self.assertRaises(ValueError):
                review.review(self.batch, [])
            self.assertEqual(json.loads(self.batch.read_text(encoding="utf-8")), [new])
        self.save([new])
        with patch.object(review, "ask_rows", side_effect=ValueError("unavailable")), self.assertRaises(ValueError):
            review.review(self.batch, [])

    def test_late_semantic_matches_and_paginated_history_are_not_truncated(self):
        new = article(1)
        history = [article(i, batch_key="older") for i in range(2, 29)]
        self.save([new])
        def compare(prompt, brief, *args, **kwargs):
            return [distinct(new, verdict="retelling", against_id="published-25", against_span=history[25]["title"])]
        with patch.object(review, "ask_rows", side_effect=compare) as model:
            self.assertEqual(review.review(self.batch, history), 0)
        self.assertEqual(model.call_count, 1)
        with patch.object(support, "_supabase_request", side_effect=[[{}] * 500, [history[-1]]]) as request:
            rows = support._recently_published()
        self.assertEqual(len(rows), 501)
        self.assertEqual(request.call_args_list[1].kwargs["query"]["offset"], "500")

    def test_late_additions_and_unreviewed_sibling_reordering_cannot_reuse_approval(self):
        first, second = article(1), article(2)
        self.save([first, second])
        with patch.object(review, "ask_rows", return_value=[distinct(first), distinct(second, review_id="draft-1")]):
            review.review(self.batch, [])
        review.verify(self.batch, [first, second], [])
        review.verify(self.batch, [second], [])  # Later copyright rejection may remove the first.
        with self.assertRaises(ValueError):
            review.verify(self.batch, [second, first], [])
        with self.assertRaises(ValueError):
            review.verify(self.batch, [first, second, article(3)], [])

    def test_concurrent_copy_change_is_never_approved(self):
        new = article(1)
        self.save([new])
        def compare(*args, **kwargs):
            self.save([{**new, "body": "Changed during review"}])
            return [distinct(new)]
        with patch.object(review, "ask_rows", side_effect=compare), self.assertRaises(ValueError):
            review.review(self.batch, [])
        self.assertFalse(review.receipt_path(self.batch).exists())

    def test_incomplete_catalogue_never_reaches_approval_or_reports_no_news(self):
        row = article(1)
        self.save([row])
        with patch.object(review, 'select_comparisons', return_value=({}, {})), \
                patch.object(review, 'ask_rows') as model, self.assertRaises(ValueError):
            review.review(self.batch, [article(2)])
        model.assert_not_called()
        self.assertEqual(json.loads(self.batch.read_text(encoding='utf-8')), [row])

    def test_duplicate_refill_photo_is_held_before_final_review_and_good_drafts_remain_unchanged(self):
        first = article(1, image_url='https://first.example/photo.jpg', image_rights={'sha256':'a'*64})
        alias = article(2, image_url='https://alias.example/photo.jpg', image_rights={'sha256':'a'*64})
        other = article(3, image_url='https://other.example/photo.jpg', image_rights={'sha256':'b'*64})
        self.save([first,alias,other])
        def approved(batch, articles, history, index, deadline, targets=None):
            return {row['slug']:distinct(row,review_id=f'draft-{i}') for i,row in enumerate(articles)
                    if targets is None or row['slug'] in targets}
        with patch.object(review,'review_chunk',side_effect=approved):
            self.assertEqual(review.review(self.batch, []), 2)
        kept = json.loads(self.batch.read_text(encoding='utf-8'))
        self.assertEqual(kept,[first,other])
        review.verify(self.batch,kept,[])


class BatchImageTests(unittest.TestCase):
    def test_recompressed_same_photo_is_rejected_even_with_different_urls_and_byte_digests(self):
        from io import BytesIO
        from PIL import Image, ImageDraw
        from news_image_policy import photo_fingerprint
        image = Image.new('RGB', (1600, 900), '#6f8a92')
        draw = ImageDraw.Draw(image)
        draw.rectangle((150, 120, 650, 700), fill='#152733')
        draw.ellipse((850, 200, 1450, 800), fill='#dbc276')
        payloads = {}
        for quality in (95, 55):
            output = BytesIO()
            image.save(output, format='JPEG', quality=quality)
            payloads[str(quality)] = output.getvalue()
        with patch('news_image_policy.photo_payload', side_effect=lambda url: payloads[url]):
            first, second = photo_fingerprint('95'), photo_fingerprint('55')
        self.assertNotEqual(first[2], second[2])
        rows = [article(i, image_url=f'https://photo.example/{i}.jpg', image_rights={
                    'sha256': value[2], 'perceptual_hash': f'{value[3]:064x}'})
                for i, value in enumerate((first, second), 1)]
        self.assertTrue(batch_image_errors(rows))

    def test_commons_thumbnail_and_original_and_same_bytes_at_different_hosts_are_duplicates(self):
        rows = [article(1, image_url="https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg"),
                article(2, image_url="https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Photo.jpg/1600px-Photo.jpg")]
        self.assertTrue(batch_image_errors(rows))
        rows = [article(1, image_url="https://one.example/photo.jpg", image_rights={"sha256": "a" * 64}),
                article(2, image_url="https://two.example/copy.jpg", image_rights={"sha256": "a" * 64})]
        self.assertTrue(batch_image_errors(rows))
        self.assertEqual(batch_image_errors(rows[:1]), [])
        self.assertEqual(batch_image_errors(rows[1:]), [])  # Other hourly batches may reuse it.

    def test_shared_subject_and_dynamic_endpoint_do_not_imply_shared_photo(self):
        rows = [article(1, image_url="https://photo.example/view?id=one", image_rights={"sha256": "a" * 64}),
                article(2, image_url="https://photo.example/view?id=two", image_rights={"sha256": "b" * 64})]
        self.assertEqual(batch_image_errors(rows), [])


if __name__ == "__main__":
    unittest.main()
