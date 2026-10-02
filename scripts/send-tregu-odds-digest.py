#!/usr/bin/env python3
"""Email every market whose persisted primary probability moved since the last digest."""

import argparse
import fcntl
import html
import importlib.util
import json
import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import quote

import requests


RECIPIENT = 'lindsylqa@gmail.com'
STATE = Path('/opt/data/state/tregu-odds-digest')
PAGE_SIZE = 1000


def utc(value):
    return datetime.fromisoformat(str(value).replace('Z', '+00:00')).astimezone(timezone.utc)


def get_rows(rest, headers, table, params):
    response = requests.get(rest + '/' + table, headers=headers, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def snapshots_in_window(rest, headers, start, end):
    offset = 0
    while True:
        rows = get_rows(rest, headers, 'market_snapshots', {
            'select': 'id,market_id,created_at,market_prob,market_prob_before,oracle_kind',
            'created_at': f'gte.{start.isoformat()}',
            'and': f'(created_at.lt.{end.isoformat()})',
            'order': 'created_at.asc,id.asc', 'limit': str(PAGE_SIZE), 'offset': str(offset),
        })
        yield from rows
        if len(rows) < PAGE_SIZE:
            break
        offset += len(rows)


def probability(value):
    try:
        number = float(value)
        return number if 0 <= number <= 1 else None
    except (TypeError, ValueError):
        return None


def group_movements(rows, before_by_market=None):
    grouped = {}
    for row in rows:
        market_id = str(row.get('market_id') or '')
        value = probability(row.get('market_prob'))
        if not market_id or value is None:
            continue
        grouped.setdefault(market_id, []).append((str(row['created_at']), value, row))
    result = []
    for market_id, points in grouped.items():
        points.sort(key=lambda item: utc(item[0]))
        first = points[0][2]
        previous = probability((before_by_market or {}).get(market_id))
        if previous is None:
            previous = probability(first.get('market_prob_before'))
        if previous is None:
            previous = points[0][1]
        values = [previous] + [item[1] for item in points]
        changes = sum(abs(right - left) > 0.0000001 for left, right in zip(values, values[1:]))
        result.append({
            'market_id': market_id, 'before': previous, 'after': values[-1],
            'low': min(values), 'high': max(values), 'changes': changes,
            'last_at': points[-1][0], 'last_kind': str(points[-1][2].get('oracle_kind') or ''),
            'kinds': [str(row.get('oracle_kind') or 'recorded update') for _, _, row in points],
            'points': [(points[0][0], previous)] + [(timestamp, value) for timestamp, value, _ in points],
        })
    return sorted(result, key=lambda item: (-abs(item['after'] - item['before']), item['market_id']))


def decorate(rest, headers, movements, start):
    ids = [item['market_id'] for item in movements]
    markets = {}
    for index in range(0, len(ids), 50):
        for row in get_rows(rest, headers, 'markets', {
            'select': 'id,slug,question,category,market_type,status',
            'id': 'in.(' + ','.join(ids[index:index + 50]) + ')',
        }):
            markets[str(row['id'])] = row
    for item in movements:
        market_id = item['market_id']
        item['market'] = markets.get(market_id, {})
        previous = get_rows(rest, headers, 'market_snapshots', {
            'select': 'created_at,market_prob', 'market_id': 'eq.' + market_id,
            'created_at': 'lt.' + start.isoformat(), 'order': 'created_at.desc', 'limit': '1',
        })
        if previous:
            prior = probability(previous[0].get('market_prob'))
            if prior is not None:
                item['before'] = prior
                item['low'] = min(item['low'], prior)
                item['high'] = max(item['high'], prior)
                item['points'][0] = (str(previous[0]['created_at']), prior)
        item['detail'] = {}
    return movements


def source_links(detail):
    links = []
    for source in detail.get('evidence') or []:
        if not isinstance(source, dict):
            continue
        url = str(source.get('url') or '')
        if url.startswith('https://'):
            links.append((str(source.get('title') or source.get('source') or url), url))
    return links[:5]


def build_message(movements, start, end, chart_png):
    message = EmailMessage()
    message['From'] = os.environ['GMAIL_USER']
    message['To'] = RECIPIENT
    message['Subject'] = f'383 Tregu — ndryshimet e gjasave në {len(movements)} tregje'
    message['Message-ID'] = f'<tregu-odds-{end.strftime("%Y%m%dT%H%M%SZ")}@383ks.com>'
    plain = [f'383 Tregu odds changes, {start.isoformat()} to {end.isoformat()}',
             f'Markets with recorded price changes: {len(movements)}', '']
    cards = []
    images = []
    for index, item in enumerate(movements):
        market = item['market']
        title = str(market.get('question') or market.get('slug') or item['market_id'])
        slug = str(market.get('slug') or '')
        url = 'https://383ks.com/tregu/' + quote(slug, safe='') if slug else 'https://383ks.com/tregu'
        before, after = item['before'] * 100, item['after'] * 100
        delta = after - before
        relative = f'{delta / before * 100:+.2f}%' if before else 'n/a'
        reasoning = str(item['detail'].get('oracle_reasoning') or '')
        kind = str(item['detail'].get('oracle_kind') or item['last_kind'] or 'recorded update')
        causes = ', '.join(f'{count} {name}' for name, count in sorted(item.get('causes', {}).items()))
        cid = f'tregu-digest-{index}-{end.strftime("%Y%m%d")}@383ks.com'
        # The chart has at most 40 exact persisted observations plus the prior
        # state. Never interpolate an unrecorded price into the report.
        points = item['points']
        if len(points) > 41:
            step = (len(points) - 1) / 39
            points = [points[0]] + [points[round(i * step)] for i in range(1, 39)] + [points[-1]]
        images.append((cid, chart_png(points, item['before'], item['after'])))
        plain.extend([title, f'{before:.2f}% → {after:.2f}% ({delta:+.2f} percentage points; {relative} relative)',
                      f'Intraday range: {item["low"] * 100:.2f}%–{item["high"] * 100:.2f}%; recorded moves: {item["changes"]}',
                      f'Change types: {causes}', f'Latest update: {kind} at {item["last_at"]}', reasoning, url, ''])
        links = source_links(item['detail'])
        sources = ''.join('<li><a href="' + html.escape(link, quote=True) + '">' + html.escape(label) + '</a></li>' for label, link in links)
        cards.append('<section style="padding:20px;border:1px solid #dce2ea;border-radius:14px;margin:16px 0">'
                     '<h2 style="font-size:19px">' + html.escape(title) + '</h2>'
                     f'<p style="font-size:23px">{before:.2f}% → <strong>{after:.2f}%</strong></p>'
                     f'<p>{delta:+.2f} percentage points · {html.escape(relative)} relative<br>'
                     f'Range: {item["low"] * 100:.2f}%–{item["high"] * 100:.2f}% · {item["changes"]} recorded moves<br>'
                     'Change types: ' + html.escape(causes) + '</p>'
                     '<img src="cid:' + cid + '" width="640" alt="Persisted probability graph" style="display:block;max-width:100%;height:auto">'
                     '<p style="font-size:12px;color:#667085">Latest: ' + html.escape(kind) + ' · ' + html.escape(item['last_at']) + '</p>'
                     + ('<p>' + html.escape(reasoning) + '</p>' if reasoning else '')
                     + ('<ul>' + sources + '</ul>' if sources else '')
                     + '<a href="' + html.escape(url, quote=True) + '">Hap tregun →</a></section>')
    message.set_content('\n'.join(plain))
    message.add_alternative('<main style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033">'
                            '<h1>383 Tregu — lëvizjet e gjasave</h1><p>Intervali: ' + html.escape(start.isoformat()) + ' → ' + html.escape(end.isoformat()) + '. Të gjitha tregjet me ndryshime të regjistruara në këtë interval. Grafiqet përdorin pikat e ruajtura në bazën e të dhënave.</p>'
                            + ''.join(cards) + '</main>', subtype='html')
    html_part = message.get_body(preferencelist=('html',))
    for cid, png in images:
        html_part.add_related(png, maintype='image', subtype='png', cid='<' + cid + '>', filename='tregu-odds.png')
    return message


def main(now=None, state=STATE, dry_run=False):
    from codex_automation_support import load_env
    load_env()
    spec = importlib.util.spec_from_file_location('tregu_news_email', Path(__file__).with_name('send-tregu-news-movement.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    now = now or datetime.now(timezone.utc)
    state.mkdir(parents=True, exist_ok=True)
    with (state / 'sender.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        marker = state / 'last-sent-end'
        start = utc(marker.read_text().strip()) if marker.exists() else now - timedelta(hours=24)
        if start >= now:
            return {'markets_changed': 0, 'reason': 'already_processed'}
        rest = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1'
        key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
        headers = {'apikey': key, 'Authorization': 'Bearer ' + key}
        movements = group_movements(snapshots_in_window(rest, headers, start, now))
        if movements:
            decorate(rest, headers, movements, start)
            # A prior snapshot may reveal a single first movement. Keep the
            # emitted count and range aligned with the actual baseline.
            for item in movements:
                values = [item['before']] + [value for _, value in item['points'][1:]]
                changed = [abs(right - left) > 0.0000001 for left, right in zip(values, values[1:])]
                item['changes'] = sum(changed)
                item['causes'] = {}
                for kind, is_change in zip(item['kinds'], changed):
                    if is_change:
                        item['causes'][kind] = item['causes'].get(kind, 0) + 1
                item['low'], item['high'] = min(values), max(values)
            movements = [item for item in movements if item['changes']]
        if movements:
            for item in movements:
                latest = get_rows(rest, headers, 'market_snapshots', {
                    'select': 'oracle_reasoning,evidence,evidence_sources,oracle_kind',
                    'market_id': 'eq.' + item['market_id'], 'created_at': 'lt.' + now.isoformat(),
                    'order': 'created_at.desc', 'limit': '1',
                })
                item['detail'] = latest[0] if latest else {}
            message = build_message(movements, start, now, module.chart_png)
            if not dry_run:
                password = os.environ.get('GMAIL_APP_PASSWORD') or os.environ.get('GMAIL_PASSWORD')
                with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=45) as smtp:
                    smtp.login(os.environ['GMAIL_USER'], password)
                    refused = smtp.send_message(message)
                    if refused:
                        raise RuntimeError('SMTP refused a digest recipient')
        if not dry_run:
            marker.write_text(now.isoformat())
        result = {'markets_changed': len(movements), 'window_start': start.isoformat(),
                  'window_end': now.isoformat(), 'recipient': RECIPIENT,
                  'email_sent': bool(movements) and not dry_run, 'dry_run': dry_run}
        print(json.dumps(result))
        return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    main(dry_run=args.dry_run)
