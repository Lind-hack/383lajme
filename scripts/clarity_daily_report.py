"""Email aggregate Clarity insights; never log tokens or raw visitor data."""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import html
import json
import math
import os
import re
import urllib.error
import urllib.parse
import urllib.request

RECIPIENT = 'lindsylqa@gmail.com'
API = 'https://www.clarity.ms/export-data/api/v1/project-live-insights'


def normalize(value):
    return re.sub(r'[^a-z0-9]', '', str(value).lower())


def field(row, *names):
    values = {normalize(k): v for k, v in row.items()}
    return next((values[normalize(n)] for n in names if normalize(n) in values), None)


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) and result >= 0 else None
    except (ValueError, TypeError):
        return None


def rows(data, name):
    return [row for metric in data if normalize(metric.get('metricName')) == normalize(name)
            for row in metric.get('information', []) if isinstance(row, dict)]


def display(value):
    parsed = number(value)
    return f'{parsed:,.1f}'.removesuffix('.0') if parsed is not None else 'not available'


def public_path(value):
    parsed = urllib.parse.urlsplit(str(value or ''))
    if parsed.hostname and parsed.hostname.lower() not in {'383ks.com', 'www.383ks.com'}:
        return None
    path = parsed.path or '/'
    if not path.startswith('/') or any(path == p or path.startswith(p + '/') for p in
                                       ('/admin', '/api', '/auth', '/hyr', '/profili')):
        return None
    return path  # Drop query strings and fragments, which may contain private values.


def feature_name(path):
    section = path.strip('/').split('/')[0]
    return {'': 'Homepage', 'tregu': 'Tregu', 'per-ty': 'Për Ty', 'kuiz': 'Quiz',
            'bota-per-kosoven': 'Bota për Kosovën', 'dosje': 'Dosje', 'kerko': 'Search',
            'xhep': 'Kosova në Xhep', 'visit': 'Visit / travel', 'article': 'Articles',
            'kategori': 'News categories', 'video': 'Video'}.get(section, 'Other public pages')


def build_report(overall, by_url):
    traffic = rows(overall, 'Traffic')
    total = traffic[0] if traffic else {}
    lines = ['383ks.com — daily usage report',
             'Reporting window: the rolling 24 hours before this report (Clarity API).',
             f'Total sessions: {display(field(total, "totalSessionCount"))}',
             f'Unique users: {display(field(total, "distinctUserCount", "distantUserCount"))}',
             '', 'MOST-USED SECTIONS']
    pages = defaultdict(float)
    for row in rows(by_url, 'Traffic'):
        path = public_path(field(row, 'URL'))
        count = number(field(row, 'totalSessionCount'))
        if path and count is not None and count > 0:
            pages[path] += count
    sections = defaultdict(float)
    for path, count in pages.items():
        sections[feature_name(path)] += count
    ranked_sections = sorted(sections.items(), key=lambda x: (-x[1], x[0]))
    for name, count in ranked_sections[:10]:
        lines.append(f'{name}: {display(count)} page sessions')
    if not sections:
        lines.append('No measured page sessions are available in this export.')
    lines += ['', 'A page session is a session that viewed a page. Section totals add page sessions, '
              'not unique feature users; a visitor viewing several pages can count several times.',
              '', 'MOST-VISITED PAGES']
    for path, count in sorted(pages.items(), key=lambda x: (-x[1], x[0]))[:10]:
        lines.append(f'{path}: {display(count)} page sessions')
    lines += ['', 'ENGAGEMENT & FRICTION']
    for metric, label, keys in [
        ('EngagementTime', 'Active engagement seconds', ('activeTime',)),
        ('ScrollDepth', 'Average scroll depth', ('averageScrollDepth',)),
        ('DeadClickCount', 'Dead clicks', ('subTotal',)),
        ('RageClickCount', 'Rage clicks', ('subTotal',)),
        ('QuickbackClick', 'Quick backs', ('subTotal',)),
        ('ScriptErrorCount', 'Script errors', ('subTotal',)),
    ]:
        values = rows(overall, metric)
        value = field(values[0], *keys) if values else None
        lines.append(f'{label}: {display(value)}')
    lines += ['', 'WHAT TO LOOK AT NEXT']
    if ranked_sections:
        name, count = ranked_sections[0]
        lines.append(f'{name} has the most measured page sessions ({display(count)}). '
                     'Review its Clarity heatmaps and recordings before changing its placement.')
    else:
        lines.append('Check traffic and analytics consent before drawing conclusions from this report.')
    lines += ['Review dead clicks and rage clicks for confusing controls. Clicks can indicate frustration '
              'as well as interest.', '', 'MEASUREMENT LIMITS',
              'Exact button-click rankings, repeat use of individual features, and day-over-day changes '
              'are not available in this report. These require additional event tracking and historical data.',
              'Only consenting visitors are measured. These results indicate usage, not proven usefulness.',
              'Open Clarity: https://clarity.microsoft.com/projects/view/yxa7ek3m9v/dashboard']
    text = '\n'.join(lines)
    markup = ('<html><body style="font-family:Arial,sans-serif;line-height:1.6;max-width:760px;'
              'margin:24px auto;padding:20px"><div style="white-space:pre-wrap">'
              + html.escape(text) + '</div></body></html>')
    return text, markup


def fetch_export(token, dimension=None):
    params = {'numOfDays': '1'}
    if dimension:
        params['dimension1'] = dimension
    request = urllib.request.Request(API + '?' + urllib.parse.urlencode(params), headers={
        'Authorization': 'Bearer ' + token, 'Accept': 'application/json',
        'User-Agent': '383-daily-clarity-report/1.0'})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Clarity export HTTP {error.code}; no email sent. Check token and daily quota.') from None
    if not isinstance(data, list) or any(not isinstance(m, dict) or not isinstance(m.get('information', []), list) for m in data):
        raise RuntimeError('Unexpected Clarity export structure; no email sent.')
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inspect', action='store_true', help='Print metric/field names only; do not send email.')
    args = parser.parse_args()
    token = os.environ.get('CLARITY_EXPORT_TOKEN', '').strip()
    if not token:
        raise RuntimeError('CLARITY_EXPORT_TOKEN is missing; no email sent.')
    overall = fetch_export(token)
    by_url = fetch_export(token, 'URL')
    if args.inspect:
        for label, export in [('overall', overall), ('by_url', by_url)]:
            print(json.dumps({'export': label, 'schema': [
                {'metric': m.get('metricName'), 'fields': sorted({k for r in m.get('information', []) for k in r})}
                for m in export]}))
        return
    _, markup = build_report(overall, by_url)
    # Reuse the repository's established email providers and secret handling.
    from codex_automation_support import _send_resend_report, _send_gmail_report
    day = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    subject = f'383 — Daily website usage — {day}'
    resend = os.environ.get('RESEND_API_KEY', '').strip()
    if resend and _send_resend_report(resend, RECIPIENT, subject, markup) == 0:
        return
    user = os.environ.get('GMAIL_USER', '').strip()
    password = os.environ.get('GMAIL_APP_PASSWORD', '').replace(' ', '').strip()
    if user and password and _send_gmail_report(user, password, RECIPIENT, subject, markup) == 0:
        return
    raise RuntimeError('Email delivery failed; see provider status above.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not print response bodies, authenticated requests, or raw export data.
        print('ERROR: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__))
        raise SystemExit(1)
