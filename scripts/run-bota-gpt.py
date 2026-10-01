#!/usr/bin/env python3
"""Hermes cron entry, isolated from all existing automations."""
import fcntl
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path('/opt/data/automation/bota')
REPO=Path('/opt/data/workspaces/383lajme-bota-main')
ROOT.mkdir(parents=True,exist_ok=True)
with (ROOT/'run.lock').open('w') as lock:
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:print('Bota run already active');sys.exit(0)
 for command in [['git','-C',str(REPO),'fetch','origin','main'],['git','-C',str(REPO),'merge','--ff-only','origin/main']]:
  result=subprocess.run(command,capture_output=True,text=True,timeout=90)
  if result.returncode:print('Bota clean source refresh failed; no checkout overwritten',file=sys.stderr);sys.exit(1)
 if subprocess.check_output(['git','-C',str(REPO),'status','--porcelain'],text=True).strip():
  print('Bota source checkout is dirty; operator review required',file=sys.stderr);sys.exit(1)
 result=subprocess.run([sys.executable,str(REPO/'tools/bota_gpt.py'),*sys.argv[1:]],cwd=REPO,timeout=3600)
 sys.exit(result.returncode)
