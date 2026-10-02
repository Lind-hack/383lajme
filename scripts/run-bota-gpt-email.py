#!/usr/bin/env python3
"""Hermes entry: run the existing Bota job, independently verify, email every outcome."""
from datetime import datetime
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import uuid
from zoneinfo import ZoneInfo
from bota_email_report import verify_public,render_report,send_report,save_private

ROOT=Path('/opt/data/automation/bota')
clock=lambda:datetime.now(ZoneInfo('Europe/Warsaw')).isoformat(timespec='seconds')
started=clock();date=started[:10]
reused_pending=(ROOT/(date+'-pending.json')).exists() and '--dry-run' not in sys.argv
outcome={'status':'failed','date':date,'reason':'WorkflowError'}
try:
    process=subprocess.Popen([sys.executable,'/opt/data/scripts/run-bota-gpt.py',*sys.argv[1:]],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
    try:stdout,stderr=process.communicate(timeout=3500)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid,signal.SIGTERM)
        try:stdout,stderr=process.communicate(timeout=5)
        except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);stdout,stderr=process.communicate()
        raise TimeoutError('Bota run exceeded its notification-safe timeout')
    for line in reversed(stdout.splitlines()):
        try:
            candidate=json.loads(line)
            if isinstance(candidate,dict) and candidate.get('status'):outcome=candidate;break
        except ValueError:pass
    if 'Bota run already active' in stdout:outcome={'status':'skipped','result':'already_running','date':date}
    if process.returncode!=0:outcome={'status':'failed','date':date,'reason':'WorkerFailed'}
    if outcome.get('status')=='ok':
        receipt=ROOT/('dry-run.json' if outcome.get('result')=='dry_run_no_publication' else 'last-run.json')
        if outcome.get('result')!='already_published':
            saved=json.loads(receipt.read_text())
            if saved.get('date')!=date or saved.get('result')!=outcome.get('result'):raise ValueError('Current run receipt mismatch')
            outcome=saved
        outcome['public']=verify_public(outcome)
        outcome['reusedSavedPacket']=reused_pending
    save_private(ROOT/'latest-worker-log.json',{'started':started,'stdout':stdout[-20000:],'stderr':stderr[-20000:]})
except Exception as error:
    outcome={'status':'failed','date':date,'reason':type(error).__name__}
finished=clock();report=render_report(outcome,started,finished)
run_id=started.replace(':','').replace('+','_')+'-'+uuid.uuid4().hex;notification=ROOT/'email-outbox'/(run_id+'.json')
try:
    ROOT.mkdir(parents=True,exist_ok=True)
    with (ROOT/'email-delivery.lock').open('w') as email_lock:
        fcntl.flock(email_lock,fcntl.LOCK_EX)
        save_private(notification,{'report':report,'outcome':outcome,'started':started,'finished':finished})
        # Retry bounded older reports with their original outcome. The lock
        # prevents concurrent manual/scheduled runs from sending duplicates.
        recovered=0
        for queued in sorted(notification.parent.glob('*.json')):
            if queued==notification:continue
            saved=json.loads(queued.read_text());send_report(saved['report']);queued.unlink();recovered+=1
            if recovered>=5:break
        delivery=send_report(report)
        save_private(ROOT/'last-notification.json',{'outcome':outcome,'started':started,'finished':finished,'email':delivery})
        notification.unlink()
    print(json.dumps({'pipelineStatus':outcome['status'],'result':outcome.get('result'),'email':delivery},ensure_ascii=False))
except Exception as error:
    print(json.dumps({'pipelineStatus':outcome['status'],'emailStatus':'failed','reason':type(error).__name__,'savedReport':str(notification)}),file=sys.stderr)
    sys.exit(1)
sys.exit(0 if outcome['status'] in ('ok','skipped') else 1)
