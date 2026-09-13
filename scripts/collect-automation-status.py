#!/usr/bin/env python3
"""Read application jobs and remaining systemd timers; send structured status only."""
import datetime as dt
import json
import re
import subprocess

JOBS = [
    ('383-production', '383 Lajme', 'Çdo orë, 07:00–23:00'),
    ('social-research', 'Kërkimi social', 'Çdo ditë, 07:10'),
    ('383-tregu-sports', 'Tregu · sportet', 'Çdo 2 minuta'),
    ('383-tregu-reprice', 'Tregu · lajmet', 'Çdo 2 minuta'),
    ('tregu-daily-drafts', 'Tregu · tregje të reja', 'Çdo ditë, 07:20'),
]


def command(*args):
    return subprocess.run(args, text=True, capture_output=True, timeout=15, check=False).stdout.strip()


def timestamp(value):
    match = re.search(r'\d{4}-\d\d-\d\d \d\d:\d\d:\d\d', value or '')
    return dt.datetime.fromisoformat(match[0]).replace(tzinfo=dt.timezone.utc).isoformat() if match else None


def job_status(props):
    if props.get('ActiveState') in ('activating', 'active', 'deactivating'):
        return 'running'
    if props.get('Result') not in ('', 'success', None):
        return 'failed'
    return 'success' if timestamp(props.get('ExecMainExitTimestamp')) else 'idle'


def collect(name, label, schedule):
    props = dict(line.split('=', 1) for line in command('systemctl', 'show', name + '.service',
        '-p', 'ActiveState', '-p', 'Result', '-p', 'ExecMainStartTimestamp', '-p', 'ExecMainExitTimestamp').splitlines() if '=' in line)
    status = job_status(props)
    start = timestamp(props.get('ExecMainStartTimestamp'))
    logs = command('journalctl', '-u', name + '.service', '--since', start or 'today', '-n', '1500', '-o', 'cat', '--no-pager')
    stage = 'Në punë' if status == 'running' else 'Përfundoi' if status == 'success' else 'Në pritje'
    for line in logs.splitlines():
        for marker, value in [('CODEX AUTH:', 'Kontrolli i autentikimit'), ('SITE HEALTH:', 'Kontrolli i faqes'),
                ('DISCOVERY {', 'Kërkimi i burimeve'), ('383 WRITER:', 'Shkrimi i artikujve'),
                ('NORMALIZED ', 'Redaktimi / kontrolli i shqipes'), ('BATCH_VALID ', 'Validimi i artikujve'),
                ('Creating an optimized production build', 'Kontrolli i ndërtimit'),
                ('383 PRODUCTION SUCCESS', 'Publikimi u verifikua'), ('SOCIAL_WATCHLIST:', 'Kërkimi në rrjetet sociale'),
                ('AGENT REACH:', 'Kërkimi i videove publike'), ('SOCIAL_STATUS:', 'Kërkimi përfundoi')]:
            if line.startswith(marker) or (marker == 'Creating an optimized production build' and marker in line):
                stage = value
    if status == 'failed': stage = 'Ekzekutimi dështoi'
    reason = None
    if status == 'failed':
        if 'usage limit' in logs.lower(): reason = 'U arrit kufiri i përdorimit të modelit.'
        elif 'another 383 production run' in logs: reason = 'Një ekzekutim tjetër ishte ende në punë.'
        elif 'DEADLINE' in logs or props.get('Result') == 'timeout': reason = 'U tejkalua koha e lejuar.'
        else:
            stages = re.findall(r'stage=([a-z-]+) exit=(\d+)', logs)
            reason = f'Hapi: {stages[-1][0]}; kodi: {stages[-1][1]}.' if stages else 'Procesi përfundoi me gabim; kontrollo shërbimin në VPS.'
    result = 'Publikimi dhe faqja e artikullit u verifikuan.' if '383 PRODUCTION SUCCESS' in logs else ''
    if 'SOCIAL_STATUS:' in logs: result = 'Rezultatet e kërkimit u ruajtën; postimet kërkojnë verifikim editorial.'
    timer = command('systemctl', 'show', name + '.timer', '-p', 'NextElapseUSecRealtime', '--value')
    return dict(id=name, name=label, schedule=schedule, enabled=command('systemctl', 'is-active', name + '.timer') == 'active',
                status=status, started_at=start, finished_at=None if status == 'running' else timestamp(props.get('ExecMainExitTimestamp')),
                next_run=timestamp(timer), stage=stage, result=result, error=reason)


if __name__ == '__main__':
    known = {job[0] for job in JOBS}
    for line in command('systemctl', 'list-timers', '--all', '--no-legend', '--plain', '--no-pager').splitlines():
        match = re.search(r'\s([\w.@-]+)\.timer\s+([\w.@-]+)\.service\s*$', line)
        if match and match[1] == match[2] and match[1] not in known:
            JOBS.append((match[1], match[1], 'Sipas timer-it të serverit'))
            known.add(match[1])
    report = {'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'jobs': [collect(*job) for job in JOBS]}
    subprocess.run(['docker', 'exec', '-i', '--user', 'hermes', '--env', 'HOME=/opt/data/home', 'hermes',
        '/opt/data/workspaces/383lajme/.venv/bin/python', '/opt/data/scripts/publish-automation-status.py'],
        input=json.dumps(report), text=True, check=True, timeout=30)
