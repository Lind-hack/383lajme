#!/usr/bin/env bash
set -Eeuo pipefail
# Retrieval drains its own durable queue between hourly publication runs.
# Resolve the committed release again on every pass, so a running request
# retains its original code while the next pass uses the activated release.
REPO="${L383_REPO:-/opt/data/workspaces/383lajme-news-current}"
PYTHON_BIN="${L383_PYTHON_BIN:-/opt/data/workspaces/383lajme/.venv/bin/python}"
STATE_ROOT="${L383_SOURCE_STATE_ROOT:-/opt/data/news-pipeline-state}"
mkdir -p "$STATE_ROOT"
request_pid=""
pause_pid=""
stop_requests() {
  trap - TERM INT
  if [[ -n "$pause_pid" ]]; then
    kill -TERM "$pause_pid" 2>/dev/null || true
  fi
  if [[ -n "$request_pid" ]]; then
    kill -TERM -- "-$request_pid" 2>/dev/null || true
    wait "$request_pid" 2>/dev/null || true
  fi
  exit 0
}
trap stop_requests TERM INT
while true; do
  # Warm source evidence before the first 07:00 publication slot. The publisher's
  # 07:00–23:00 schedule and its emails are controlled separately and unchanged.
  local_clock="$(TZ=Europe/Warsaw date +%H%M)"
  if (( 10#$local_clock >= 635 && 10#$local_clock <= 2359 )); then
    timeout --signal=TERM --kill-after=15s 360s "$PYTHON_BIN" \
      "$REPO/scripts/news_ingestion.py" --state "$STATE_ROOT/source-inventory.sqlite" \
      --output "$STATE_ROOT/source-ingestion-latest.json" --budget 240 &
    request_pid=$!
    wait "$request_pid" || \
      printf '383 INGESTION interrupted; durable queue retained for retry\n' >&2
    request_pid=""
  fi
  sleep 60 &
  pause_pid=$!
  wait "$pause_pid"
  pause_pid=""
done
