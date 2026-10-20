"""Email aggregate Clarity insights; never log tokens or raw visitor data."""
import argparse
from datetime import datetime, timezone
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


def build_report(overall, by_url, usage=None):
    from usage_email import render_email
    return render_email(overall, by_url, usage or {})


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


def fetch_usage():
    secret = os.environ.get('CRON_SECRET', '').strip()
    if not secret:
        raise RuntimeError('CRON_SECRET is missing; feature report cannot be generated.')
    request = urllib.request.Request('https://383ks.com/api/analytics/usage', headers={
        'Authorization': 'Bearer ' + secret, 'Accept': 'application/json',
        'User-Agent': '383-daily-clarity-report/1.0'})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Feature measurements HTTP {error.code}; no email sent.') from None
    if not isinstance(data, dict) or not all(isinstance(data.get(key), list) for key in ('features', 'pages', 'buttons', 'destinations')):
        raise RuntimeError('Feature measurement structure is invalid; no email sent.')
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inspect', action='store_true', help='Print metric/field names only; do not send email.')
    args = parser.parse_args()
    token = os.environ.get('CLARITY_EXPORT_TOKEN', '').strip()
    if not token:
        raise RuntimeError('CLARITY_EXPORT_TOKEN is missing; no email sent.')
    # Check our own collector before spending Clarity's limited daily API quota.
    usage = None if args.inspect else fetch_usage()
    overall = fetch_export(token)
    by_url = fetch_export(token, 'URL')
    if args.inspect:
        for label, export in [('overall', overall), ('by_url', by_url)]:
            print(json.dumps({'export': label, 'schema': [
                {'metric': m.get('metricName'), 'fields': sorted({k for r in m.get('information', []) for k in r})}
                for m in export]}))
        return
    _, markup = build_report(overall, by_url, usage)
    # Reuse the repository's established email providers and secret handling.
    from codex_automation_support import _send_gmail_report
    day = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    subject = f'383 — Daily website usage — {day}'
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
