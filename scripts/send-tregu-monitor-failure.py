#!/usr/bin/env python3
"""Throttle operator mail when Tregu research or repricing stops working."""

import importlib.util
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
try:
    import fcntl
except ImportError:  # Local Windows tests; the VPS uses fcntl.
    fcntl = None


SERVICES = {
    '383-tregu-research.service': 'original-page research',
    '383-tregu-reprice.service': 'news repricing',
}
ALERT_INTERVAL = timedelta(minutes=30)
STATE_DIR = Path('/opt/data/state/tregu-monitor-alerts')


def alert(service, *, now=None, state_dir=STATE_DIR, send=None):
    if service not in SERVICES:
        raise ValueError('Unknown Tregu monitoring service')
    now = now or datetime.now(timezone.utc)
    state_dir.mkdir(parents=True, exist_ok=True)
    marker = state_dir / (service + '.last-sent')
    with (state_dir / (service + '.lock')).open('w') as lock:
        if fcntl:
            fcntl.flock(lock, fcntl.LOCK_EX)
        if marker.exists():
            try:
                previous = datetime.fromisoformat(marker.read_text().strip())
                if now - previous < ALERT_INTERVAL:
                    return False
            except ValueError:
                pass
        if send is None:
            spec = importlib.util.spec_from_file_location('tregu_mail', Path(__file__).with_name('send-tregu-review-email.py'))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            send = module.send_email
        name = SERVICES[service]
        body = (f'<h1>383 Tregu monitoring failed</h1><p>The {name} service failed at '
                f'{now.isoformat()}. News changes may not be checked or repriced until it recovers.</p>'
                f'<p>Inspect the VPS journal: <code>journalctl -u {service} -n 80</code>.</p>')
        send('lindsylqa@gmail.com', f'383 Tregu — monitoring failed: {name}', body)
        marker.write_text(now.isoformat())
        return True


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: send-tregu-monitor-failure.py SERVICE')
    from codex_automation_support import load_env
    load_env()
    sent = alert(sys.argv[1])
    print({'service': sys.argv[1], 'alert_sent': sent})


if __name__ == '__main__':
    main()
