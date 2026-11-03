#!/usr/bin/env python3
"""Run from a persistent systemd expiry timer; never log automation secrets."""
import argparse
import json
import os
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--env-file', type=Path)
    args = parser.parse_args()
    config = dict(os.environ)
    if args.env_file:
        for line in args.env_file.read_text().splitlines():
            key, sep, value = line.strip().removeprefix('export ').partition('=')
            if sep and key in {'CRON_SECRET', 'TREGU_AUTOMATION_SECRET'}:
                config[key] = value.strip().strip('\"\'')
    secret = config.get('CRON_SECRET') or config.get('TREGU_AUTOMATION_SECRET')
    if not secret:
        raise SystemExit('No automation secret configured')
    request = urllib.request.Request(
        'https://383ks.com/api/revalidate',
        data=json.dumps({'paths': ['/']}).encode(),
        headers={'Authorization': f'Bearer {secret}', 'Content-Type': 'application/json',
                 'User-Agent': '383-Homepage-Scheduler/1.0'},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        result = json.load(response)
    if result.get('failed') or '/' not in result.get('revalidated', []):
        raise SystemExit('Homepage revalidation failed')
    # Warm the invalidated page so the next reader receives the new ordering.
    homepage = urllib.request.Request('https://383ks.com/', headers={
        'User-Agent': '383-Homepage-Scheduler/1.0',
    })
    with urllib.request.urlopen(homepage, timeout=90) as response:
        response.read()
    print('Homepage revalidated and warmed')


if __name__ == '__main__':
    main()
