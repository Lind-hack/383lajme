#!/usr/bin/env python3
"""Upload a bounded, secret-free snapshot to private Supabase Storage."""
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.request

ROOT = Path('/opt/data/workspaces/383lajme-prod-f731569')
sys.path.insert(0, str(ROOT / 'scripts'))
from codex_automation_support import load_env
from prepare_social_native_candidates import _records


def read(path, default):
    try: return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError): return default


def fields(item, names):
    return {key: str(item.get(key) or '')[:500] for key in names}


def main():
    report = json.load(sys.stdin)
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
    report['social'] = dict(checked_at=health.get('checked_at'), usable=health.get('usable', 0), watchlists=health.get('watchlists', 0),
        videos=[fields(v, ('title', 'url', 'publisher', 'published')) for v in videos[:40]])
    os.chdir(ROOT)
    load_env()
    base = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/storage/v1'
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    headers = {'Authorization':'Bearer ' + key, 'apikey':key, 'Content-Type':'application/json'}
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
