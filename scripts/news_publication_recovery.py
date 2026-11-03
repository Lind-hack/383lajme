"""Recover an exact completed insert before retrying a model-free delivery."""
from news_batch_identity import batch_key
from news_copyright_review import article_digest
from news_publication_readback import verify_rows
import json


def delivery_belongs_to_slot(batch, slot):
    try:
        return json.loads(batch.with_suffix('.delivery-attempt.json').read_text(encoding='utf-8'))['run_slot'] == slot
    except (OSError, ValueError, KeyError):
        return False


def recover_persisted(batch, approved, *, request=None):
    from codex_automation_support import _supabase_request, _article_row
    request = request or _supabase_request
    key = batch_key(batch)
    rows = request('GET', 'news_articles', query={'select': '*', 'batch_key': 'eq.' + key, 'limit': '2'})
    if not rows:
        # Caller holds the publication lock. No article exists, so deleting
        # only this empty batch marker allows the same approved insert to retry.
        batches = request('GET', 'news_batches', query={'select': 'batch_key', 'batch_key': 'eq.' + key})
        if batches:
            request('DELETE', 'news_batches', query={'batch_key': 'eq.' + key})
        return None
    if len(rows) != 1 or not isinstance(rows[0].get('raw_article'), dict):
        raise ValueError('recovery found an incomplete publication')
    saved = rows[0]['raw_article']
    if article_digest(saved) != article_digest(approved):
        raise ValueError('persisted copy differs from the approved article')
    # Only publication metadata may have been added/changed by the inserter.
    if any(saved.get(k) != value for k, value in approved.items() if k != 'published_at'):
        raise ValueError('persisted article metadata differs from approval')
    if saved.get('originality_review', {}).get('article_sha256') != article_digest(approved):
        raise ValueError('persisted originality metadata does not match approval')
    verify_rows([_article_row(saved, key)], rows, key)
    return [saved]
