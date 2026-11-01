#!/bin/sh
# Stable code and protected configuration are independent of news release cleanup.
set -eu
REPO="${L383_REPO:-/opt/data/workspaces/383lajme-tregu-main}"
ENV_FILE="${L383_AUTOMATION_ENV:-/opt/data/automation/tregu.env}"
PYTHON_BIN="${L383_PYTHON_BIN:-/opt/data/workspaces/383lajme/.venv/bin/python}"
test -r "$ENV_FILE" || { echo 'Protected Tregu environment is missing' >&2; exit 1; }
test -d "$REPO/scripts" || { echo 'Stable Tregu source is missing' >&2; exit 1; }
set -a
. "$ENV_FILE"
set +a
export L383_REPO="$REPO"
cd "$REPO"
case "${1:-}" in
  research) exec "$PYTHON_BIN" scripts/research-tregu-news.py ;;
  reprice)
    mkdir -p /opt/data/locks
    exec 9>/opt/data/locks/tregu-reprice.lock
    if ! flock -n 9; then
      echo '{"ok":true,"skipped":true,"reason":"overlap_prevented"}'
      exit 0
    fi
    exec node scripts/run-tregu-reprice.mjs ;;
  # The two-minute sports heartbeat (live odds, scores, NBA/Superliga markets).
  # It ran from a news release folder until cleanup deleted it on 2026-10-30.
  sports)
    mkdir -p /opt/data/locks
    exec 9>/opt/data/locks/tregu-sports.lock
    if ! flock -n 9; then
      echo '{"ok":true,"skipped":true,"reason":"overlap_prevented"}'
      exit 0
    fi
    exec node scripts/run-tregu-live-sports.mjs ;;
  alert) shift; exec "$PYTHON_BIN" scripts/send-tregu-monitor-failure.py "$@" ;;
  *) echo 'Expected research, reprice, sports or alert' >&2; exit 2 ;;
esac
