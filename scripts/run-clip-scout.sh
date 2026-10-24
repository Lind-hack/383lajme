#!/usr/bin/env bash
# 383's clip scout (383-clip-scout.timer, every two hours 07:15-23:15 Kosovo time): viral
# Kosovo and Albania clips, downloaded and labelled, queued in storage (clip-scout/queue.json)
# and emailed to the editor for review. Nothing is posted anywhere. Source of truth for the
# job: scripts/clip_scout.py in the 383lajme repo; installed at /opt/data/clip-scout.
set -uo pipefail
set -a
. /opt/data/news-pipeline.env
set +a
# Files go to storage next door: through Cloudflare a large upload comes back 502.
export L383_EDITION_STORAGE=http://supabase-envoy:8000
export L383_SCOUT_REPORT_TO=lindsylqa@gmail.com
cd /opt/data/clip-scout
exec flock -n /opt/data/clip-scout/run.lock timeout --signal=TERM --kill-after=30s 2400s \
  /opt/data/clip-scout/.venv/bin/python /opt/data/clip-scout/clip_scout.py
