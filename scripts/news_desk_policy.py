"""Owner-selected audience priorities, never measured popularity."""
from collections import defaultdict, deque
from datetime import datetime, timezone
import re

from news_showbiz_focus import ARTISTS, mentions, LOCAL_PUBLISHERS, fold

DESKS = {'Showbiz', 'Ekonomi', 'Botë'}
TARGET = 5
MINIMUM = 3
POLICY = '383-reliable-desks-v1'
REVIEW_FOLDERS = {'Showbiz': 'showbiz-review', 'Ekonomi': 'economy-review', 'Botë': 'world-review'}


def local_interest(lead, evidence=None):
    text = ' '.join(str(lead.get(k) or '') for k in ('title', 'summary'))
    text += ' ' + str((evidence or lead.get('primary_evidence') or {}).get('text') or '')
    if lead.get('category') == 'Showbiz':
        return lead.get('source') in LOCAL_PUBLISHERS or any(mentions(text, artist) for artist in ARTISTS)
    if lead.get('category') == 'Ekonomi':
        from news_economy_policy import LOCAL_PUBLISHERS as ECONOMY_LOCAL
        return (lead.get('source') in ECONOMY_LOCAL or
                bool(re.search(r'\b(?:kosov\w*|shqiper\w*|albania\w*|prishtin\w*|tirana)\b', fold(text))))
    if lead.get('category') == 'Botë':
        from news_world_policy import regional_interest
        return regional_interest(lead, evidence)
    return False


def select_candidates(leads, evidence=None, *, limit=5, now=None):
    """Three local-interest preferences, source rotation, immediate foreign fallback."""
    from cloud_news_discovery import freshness_bucket, canonical
    from news_homepage_priority import homepage_weight
    from news_reader_value import reader_value
    from news_source_policy import topic_error
    from news_showbiz_focus import focus
    evidence = evidence or {}
    now = now or datetime.now(timezone.utc)
    pools = defaultdict(lambda: defaultdict(list))
    seen = set()
    for lead in leads:
        identity = canonical(lead['url'])
        text = str(evidence.get(lead['url'], lead.get('primary_evidence', {})).get('text') or lead.get('summary') or '')
        if identity in seen or re.search(r'\b(?:fjalekryq\w*|crossword\w*|horoskop\w*|horoscope\w*)\b', fold(lead.get('title', ''))):
            continue
        if topic_error(lead.get('category'), lead.get('title', ''), text,
                       tags=lead.get('tags') or [], url=lead['url']):
            continue
        seen.add(identity)
        local = local_interest(lead, evidence.get(lead['url']))
        pools[local][lead.get('source', '')].append(lead)
    def order(lead):
        if lead.get('category') == 'Botë':
            full = dict(lead, title=lead.get('title', '') + ' ' + str(
                evidence.get(lead['url'], lead.get('primary_evidence', {})).get('text') or ''))
            return (reader_value(lead)['reserve_genre'], bool(lead.get('coverage_already_published')),
                    -lead.get('reader_interest', 0),
                    -int(local_interest(lead, evidence.get(lead['url']))), freshness_bucket(lead, now),
                    -homepage_weight(lead, now), -reader_value(full)['score'], lead['url'])
        return (reader_value(lead)['reserve_genre'], bool(lead.get('coverage_already_published')),
                -lead.get('reader_interest', 0),
                -focus(lead)['priority'], freshness_bucket(lead, now),
                -homepage_weight(lead, now), -reader_value(lead)['score'], lead['url'])
    def rotate(groups):
        queues = {source: deque(sorted(rows, key=order)) for source, rows in groups.items()}
        sources = sorted(queues, key=lambda source: order(queues[source][0]))
        return [queues[source].popleft() for _ in range(max(map(len, queues.values()), default=0))
                for source in sources if queues[source]]
    local, foreign = rotate(pools[True]), rotate(pools[False])
    if leads and all(lead.get('category') == 'Botë' for lead in leads):
        # Regional relevance is a ranking preference, never a three-slot quota.
        groups = defaultdict(list)
        for lead in sorted(local + foreign, key=order):
            groups[lead.get('source', '')].append(lead)
        return rotate(groups)[:limit]
    preferred = local[:min(3, limit)]
    rest = sorted(local[len(preferred):] + foreign, key=order)
    # Rotate again after the preferred local slots to avoid a dominant outlet.
    groups = defaultdict(list)
    for row in rest:
        groups[row.get('source', '')].append(row)
    return (preferred + rotate(groups))[:limit]
