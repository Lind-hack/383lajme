"""Durable, content-bound approvals; no model call is needed to reuse them."""
from datetime import datetime, timezone
import json
import os
import hashlib
from pathlib import Path
import re

from news_copyright_review import article_digest, digest, approved, POLICY as COPYRIGHT
from news_desk_policy import DESKS, POLICY
from news_json_state import atomic, age


class PublicationHistoryChanged(ValueError):
    """An approved copy needs a fresh independent context comparison."""


class Reserve:
    def __init__(self, root, category):
        if category not in DESKS:
            raise ValueError('reserves only belong to Showbiz and Economy')
        self.path = Path(root) / {'Showbiz': 'showbiz', 'Ekonomi': 'ekonomi', 'Botë': 'bote'}[category]
        self.category = category

    def valid(self, entry, *, now=None):
        now = now or datetime.now(timezone.utc)
        try:
            a, evidence = entry['article'], entry['evidence']
            receipt, context = entry['originality'], entry['context']
            proof = receipt['articles'][a['slug']]
            context_proof = context['articles'][a['slug']]
            from news_context_review import POLICY as CONTEXT
            from news_source_policy import needs_corroboration
            source_date = evidence['evidence'].get('published')
            limit = 3600 if entry['time_sensitive'] else 21600
            return (entry['policy'] == POLICY and a['category'] == self.category
                    and 0 <= age(source_date, now) < 86400
                    and 0 <= age(receipt['reviewed_at'], now) < limit
                    and 0 <= age(context['reviewed_at'], now) < limit
                    and receipt['policy'] == COPYRIGHT and context['policy'] == CONTEXT
                    and all(r.get('model') == 'gpt-6-luna' and r.get('provider') == 'openai-codex'
                            for r in (receipt, context))
                    and proof['article_sha256'] == article_digest(a)
                    and proof['evidence_sha256'] == digest(evidence) and approved(proof['decision'])
                    and context_proof['article_sha256'] == article_digest(a)
                    and len(context_proof['decisions']) == 1
                    and context_proof['decisions'][0]['verdict'] == 'distinct'
                    and isinstance(context['history'], dict)
                    and entry['image_sha256'] == a['image_rights']['sha256']
                    and entry['snapshot_sha256'] == digest({k: v for k, v in entry.items() if k != 'snapshot_sha256'})
                    and (not needs_corroboration(a) or bool(evidence.get('corroborating'))))
        except (KeyError, TypeError, ValueError):
            return False

    def store(self, article, evidence, originality, context, *, now=None, time_sensitive=False):
        now = now or datetime.now(timezone.utc)
        if (self.path / 'confirmed' / (digest(article['url']) + '.json')).exists():
            raise ValueError('article was already confirmed published')
        text = ' '.join(str(article.get(k) or '') for k in ('title', 'excerpt', 'body')).casefold()
        sensitive_time = (time_sensitive or article.get('breaking') in {True, 'fresh_development', 'publisher_label'}
                          or article.get('is_breaking') is True
                          or article['category'] == 'Ekonomi' and bool(re.search(
                              r'\b(?:stocks?|bitcoin|ethereum|crypto|aksion\w*|burs\w*|intraday|wall street|naft\w*|oil)\b', text)))
        entry = dict(policy=POLICY, article=article, evidence=evidence, originality=originality,
                     context=context, image_sha256=article.get('image_rights', {}).get('sha256'),
                     time_sensitive=sensitive_time, stored_at=now.isoformat())
        entry['snapshot_sha256'] = digest(entry)
        if not self.valid(entry, now=now):
            raise ValueError('only complete, unchanged approvals may enter the reserve')
        for path in self.path.glob('*.json'):
            try:
                if not self.valid(json.loads(path.read_text(encoding='utf-8')), now=now):
                    path.unlink()
            except (OSError, ValueError):
                continue
        key = digest(article['url'])
        atomic(self.path / (key + '.json'), entry)
        entries = self.available(now=now)
        for overflow in entries[10:]:
            (self.path / (digest(overflow['article']['url']) + '.json')).unlink(missing_ok=True)
        return entry

    def available(self, *, now=None):
        entries = []
        for path in self.path.glob('*.json'):
            try:
                entry = json.loads(path.read_text(encoding='utf-8'))
                if self.valid(entry, now=now):
                    entries.append(entry)
            except (OSError, ValueError):
                continue
        return sorted(entries, key=lambda e: e['stored_at'], reverse=True)

    def confirm(self, entry):
        atomic(self.path / 'confirmed' / (digest(entry['article']['url']) + '.json'),
               {'url': entry['article']['url'], 'confirmed_at': datetime.now(timezone.utc).isoformat()})
        (self.path / (digest(entry['article']['url']) + '.json')).unlink(missing_ok=True)


def verify_saved(batch, articles, records=None, recent=None):
    """Verify originals, not a newly manufactured model attestation.

    Changed history that might concern this story is held for another model
    review. Disjoint history can be excluded conservatively in code.
    """
    from news_context_review import history_records
    from codex_automation_support import _same_story, _story_overlap
    entries = json.loads(batch.with_suffix('.reserve-proof.json').read_text(encoding='utf-8'))
    by_slug = {entry['article']['slug']: entry for entry in entries}
    for article in articles:
        entry = by_slug[article['slug']]
        if not Reserve(batch.parent, article['category']).valid(entry):
            raise ValueError('saved approval is expired or changed')
        if article_digest(article) != article_digest(entry['article']):
            raise ValueError('reserve copy changed after approval')
        if records is not None and digest(records.get(article['slug'])) != digest(entry['evidence']):
            raise ValueError('reserve evidence changed after approval')
        if recent is not None:
            for row in history_records(recent, batch):
                old = entry['context']['history'].get(str(row['id']))
                if old == digest(row):
                    continue
                # Retain the stricter independent comparison for related copy.
                words = lambda r: set(re.findall(r'\b[^\W\d_]{5,}\b', ' '.join(
                    str(r.get(k) or '') for k in ('title', 'excerpt', 'body')).casefold()))
                if (_same_story(article, row) or _story_overlap(article, row) >= .18
                        or len(words(article) & words(row)) >= 3):
                    raise PublicationHistoryChanged('changed related publication history needs a new comparison')
    return entries


def saved_photo(article):
    try:
        batch = Path(os.environ['L383_RESERVE_PUBLICATION_BATCH'])
        entries = verify_saved(batch, [article])
        original = next(e['article'] for e in entries if e['article']['slug'] == article['slug'])
        return {k: v for k, v in original.items() if k.startswith('image_') or k == 'video_clip_url'}
    except (OSError, ValueError, KeyError, StopIteration):
        return None


def verify_pixels(article, *, fetcher=None):
    if fetcher is None:
        from news_image_policy import photo_payload
        fetcher = photo_payload
    if hashlib.sha256(fetcher(article['image_url'])).hexdigest() != article['image_rights']['sha256']:
        raise ValueError('current image pixels differ from the approved pixels')


def recover_approvals(root, reserve):
    """Recover the crash window between saved final receipts and reserve.store."""
    recovered = 0
    receipts = list(Path(root).glob('*/wave-*/draft-*/*.context-review.json'))
    if reserve.category == 'Botë':
        receipts += list(Path(root).glob('*/wave-*/parallel-*/draft-*/*.context-review.json'))
        receipts += list(Path(root).glob('*/context-refresh/*/*.context-review.json'))
    for receipt_file in receipts:
        batch = receipt_file.with_name(receipt_file.name.removesuffix('.context-review.json') + '.json')
        try:
            articles = json.loads(batch.read_text(encoding='utf-8'))
            evidence = json.loads(batch.with_suffix('.editor-sources.json').read_text(encoding='utf-8'))
            originality = json.loads(batch.with_suffix('.copyright-review.json').read_text(encoding='utf-8'))
            context = json.loads(receipt_file.read_text(encoding='utf-8'))
            selection_file = batch.with_suffix('.selection.json')
            selected = json.loads(selection_file.read_text(encoding='utf-8')) if selection_file.exists() else {}
            for article in articles:
                if article.get('category') != reserve.category:
                    continue
                record = next(e for e in evidence if e['slug'] == article['slug'])
                reserve.store(article, record, originality, context,
                              time_sensitive=selected.get('time_sensitive', True))
                recovered += 1
        except (OSError, ValueError, KeyError, TypeError, StopIteration):
            continue  # Partial, expired or changed approvals remain unavailable.
    return recovered
