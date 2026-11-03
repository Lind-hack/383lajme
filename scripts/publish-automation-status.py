#!/usr/bin/env python3
"""Upload a bounded, secret-free snapshot to private Supabase Storage."""
import hashlib
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import urllib.request

SOURCE_ROOT = Path(os.environ.get('L383_REPO', '/opt/data/workspaces/383lajme-tregu-main'))
ROOT = Path(os.environ.get('L383_NEWS_REPO', '/opt/data/workspaces/383lajme-news-current'))
sys.path.insert(0, str(SOURCE_ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts'))
from codex_automation_support import load_env, ENV_FILES, _verify_batch_readback
# Read protected current database credentials before any legacy checkout env.
ENV_FILES.insert(0, Path(os.environ.get('L383_AUTOMATION_ENV', '/opt/data/automation/tregu.env')))
from prepare_social_native_candidates import _records


def read(path, default):
    try: return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError): return default


def fields(item, names):
    return {key: str(item.get(key) or '')[:500] for key in names}


def storage_base(environ):
    return (environ.get('AUTOMATION_STATUS_SUPABASE_URL') or environ['NEXT_PUBLIC_SUPABASE_URL']).rstrip('/') + '/storage/v1'


def category_snapshot(state_root, verify):
    """Observe independent desks without treating an approved draft as published."""
    from news_batch_identity import DESKS
    latest, discoveries, candidates = {}, [], []
    for slug, category in DESKS.items():
        root = state_root / 'desks' / slug
        states = sorted((root / 'hourly-runs').glob('*-mode0.json'), reverse=True)
        if states:
            path = states[0]
            latest[slug] = {**read(path, {}), 'hour': path.name.removesuffix('-mode0.json'), 'category': category}
            row = latest[slug]
            attempts = read(state_root / 'hourly-runs' / (row['hour'] + '-desks-mode0') / 'outcomes.json', {})
            attempt = attempts.get(slug, {})
            row['attempt_failed'] = bool(attempt.get('returncode') and
                attempt.get('updated_at', '') >= row.get('updated_at', ''))
            if row['attempt_failed'] and row.get('status') == 'running':
                row['status'] = 'failed'
        discovery = read(root / 'runtime/.last30days/cloud-news-discovery-current.json', {})
        if discovery:
            discoveries.append(discovery)
        candidates.extend((path, slug, category, root) for path in
                          sorted((root / 'runtime/data/auto-articles').glob('*.json'), reverse=True)[:12]
                          if len(path.stem) == 13 and path.stem[10] == 'T')
    if not latest:
        return None
    hour = max(row['hour'] for row in latest.values())
    counts = {slug: 0 for slug in DESKS}
    batches = []
    for path, slug, category, root in sorted(candidates, key=lambda item: (item[0].stem, item[1]), reverse=True)[:12]:
        try:
            raw = path.read_bytes()
            articles = json.loads(raw)
        except (OSError, ValueError):
            continue
        if not isinstance(articles, list):
            continue
        state = read(root / 'hourly-runs' / (path.stem + '-mode0.json'), {})
        key = path.stem + '-' + slug
        checksum = hashlib.sha256(raw).hexdigest()
        proof = state_root / 'status-readbacks' / (key + '-' + checksum + '.json')
        published = False
        live_checked = state.get('status') == 'complete' or (
            state.get('status') == 'published' and state.get('stage') in {'report-delivery','live-verified'})
        if (articles and live_checked
                and Path(state.get('batch', '')).resolve() == path.resolve()):
            cached = read(proof, {})
            published = cached.get('sha256') == checksum and cached.get('batch_key') == key
            if not published:
                try:
                    verify(key, articles)
                    if path.read_bytes() != raw:
                        raise ValueError('Completed copy changed during status readback')
                    proof.parent.mkdir(parents=True, exist_ok=True)
                    proof.write_text(json.dumps({'batch_key': key, 'sha256': checksum,
                        'verified_at': datetime.now(timezone.utc).isoformat()}) + '\n', encoding='utf-8')
                    published = True
                except Exception:
                    # A failed monitoring readback must never confer publication.
                    published = False
        if published and path.stem == hour:
            counts[slug] = len(articles)
        batches.append({'id': key, 'hour': path.stem, 'category': category, 'count': len(articles),
                        'published': published,
                        'articles': [fields(a, ('title','slug','category')) for a in articles[:32] if isinstance(a,dict)]})
    desks = []
    for slug, category in DESKS.items():
        row = latest.get(slug, {})
        if row.get('hour') != hour:
            row = {}
        desks.append({'id': 'news-' + slug, 'name': 'Lajme · ' + category, 'category': category,
                      'state': row.get('status', 'idle'), 'stage': row.get('stage', ''), 'updated_at': row.get('updated_at'),
                      'attempt_failed': row.get('attempt_failed', False),
                      'published_count': counts[slug]})
    leads = [lead for discovery in discoveries for lead in discovery.get('leads', [])[:40]]
    categories = {}
    for discovery in discoveries:
        for name, count in discovery.get('categories', {}).items():
            categories[name] = categories.get(name, 0) + count
    sources = [source for discovery in discoveries for source in discovery.get('sources', [])]
    return {'hour': hour, 'desks': desks, 'news': {
        'discovered_at': max((d.get('generated_at', '') for d in discoveries), default=None),
        'leads': sum(len(d.get('leads', [])) for d in discoveries), 'categories': categories,
        'working_feeds': sum(s.get('status') == 'ok' or s.get('eligible', 0) > 0 for s in sources),
        'total_feeds': len(sources),
        'stories': [fields(a, ('title','url','category','source')) for a in leads], 'batches': batches}}


def apply_category_status(report, snapshot):
    parent = next((job for job in report.get('jobs', []) if job['id'] == '383-production'), {})
    rows = snapshot['desks']
    total = sum(row['published_count'] for row in rows)
    if parent:
        parent['result'] = f"{total} artikuj të publikuar e të verifikuar në {snapshot['hour']}; rezultatet sipas kategorisë më poshtë."
        if any(row['state'] == 'running' for row in rows):
            parent['status'] = 'running'
            parent['stage'] = 'Pipeline të pavarura sipas kategorisë'
        elif len(rows) == 7 and all(row['state'] in {'complete','no_news'} for row in rows):
            if parent['status'] == 'failed':
                parent['result'] += ' Përpjekja fillestare pati dështime; kategoritë u rikuperuan.'
                parent['attempt_status'] = 'failed'
            parent.update(status='success', error=None, stage='Kategoritë përfunduan')
    for row in rows:
        state = row['state']
        delivery_failed = state == 'published' and (row['attempt_failed'] or
            row['stage'] in {'report-delivery','news-cache-refresh','live-readback'})
        report['jobs'].append({'id': row['id'], 'name': row['name'], 'schedule': 'Çdo orë, 07:00–23:00',
            'enabled': parent.get('enabled', False),
            'status': 'failed' if delivery_failed else 'running' if state in {'running','published'} else 'failed' if state == 'failed' else
                      'success' if state in {'complete','no_news'} else 'idle',
            'started_at': row['updated_at'] if state == 'running' else None,
            'finished_at': row['updated_at'] if state in {'complete','no_news','failed'} else None,
            'next_run': parent.get('next_run'), 'stage': row['category'],
            'result': f"{row['published_count']} artikuj të publikuar e të verifikuar në këtë orar.",
            'error': 'Artikujt janë ruajtur; konfirmimi përfundimtar kërkon kontroll.' if delivery_failed else
                     'Ekzekutimi i kategorisë dështoi; shih logun e kësaj kategorie.' if state == 'failed' else None})
    report['news'] = snapshot['news']


def main():
    report = json.load(sys.stdin)
    os.chdir(ROOT)
    load_env()
    discovery = read(ROOT / '.last30days/cloud-news-discovery-current.json', {})
    leads = discovery.get('leads', [])
    sources = discovery.get('sources', [])
    batches = []
    for path in sorted((ROOT / 'data/auto-articles').glob('*.json'), reverse=True)[:12]:
        articles = read(path, [])
        if not isinstance(articles, list): continue
        receipt = read(Path('/opt/data/qa/383/quality') / (path.stem + '-published.json'), {})
        published = receipt.get('status') == 'published' and receipt.get('sha256') == hashlib.sha256(path.read_bytes()).hexdigest()
        batches.append({'hour':path.stem, 'count':len(articles), 'published':published,
                        'articles':[fields(a, ('title', 'slug', 'category')) for a in articles[:32] if isinstance(a, dict)]})
    health = read(Path('/opt/data/cron/health/social-research.json'), {})
    artifact = ROOT / '.last30days/agent-social-research-current.md'
    videos = _records(artifact.read_text(encoding='utf-8')) if artifact.exists() else []
    report['news'] = dict(discovered_at=discovery.get('generated_at'), leads=len(leads), categories=discovery.get('categories', {}),
        working_feeds=sum(s.get('status') == 'ok' for s in sources), total_feeds=len(sources),
        stories=[fields(a, ('title', 'url', 'category', 'source')) for a in leads[:280]], batches=batches)
    snapshot = category_snapshot(Path(os.environ.get('L383_DESK_STATE_ROOT', '/opt/data/news-pipeline-state')), _verify_batch_readback)
    if snapshot:
        apply_category_status(report, snapshot)
    report['social'] = dict(checked_at=health.get('checked_at'), usable=health.get('usable', 0), watchlists=health.get('watchlists', 0),
        videos=[fields(v, ('title', 'url', 'publisher', 'published')) for v in videos[:40]])
    os.chdir(ROOT)
    load_env()
    base = storage_base(os.environ)
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    headers = {'Authorization':'Bearer ' + key, 'apikey':key, 'Content-Type':'application/json', 'User-Agent':'383-automation-status/1.0'}
    if '--setup' in sys.argv:
        req = urllib.request.Request(base + '/bucket', json.dumps({'id':'automation-status','name':'automation-status','public':False}).encode(), headers, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=15): pass
        except urllib.error.HTTPError as error:
            if error.code not in (400, 409): raise
        req = urllib.request.Request(base + '/bucket/automation-status', headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            assert json.load(response).get('public') is False, 'Status bucket must be private'
    req = urllib.request.Request(base + '/object/automation-status/latest.json', json.dumps(report, ensure_ascii=False).encode(),
                                 {**headers, 'x-upsert':'true', 'Cache-Control':'no-store'}, method='POST')
    with urllib.request.urlopen(req, timeout=15): pass
    print('Automation snapshot uploaded: ' + report['generated_at'])


if __name__ == '__main__': main()
