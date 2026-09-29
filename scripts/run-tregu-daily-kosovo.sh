#!/bin/sh
set -eu

# systemd is the schedule authority; this script runs inside the Hermes container.
REPO="${L383_REPO:-/opt/data/workspaces/383lajme}"
ENV_FILE="$REPO/.env.automation"
[ -r "$ENV_FILE" ] || { echo '{"ok":false,"error":"protected environment unavailable"}' >&2; exit 1; }
set -a
. "$ENV_FILE"
set +a
cd "$REPO"

attempt=1
max_attempts=2
if [ "${TREGU_DAILY_MANUAL:-0}" = "1" ]; then
  set -- --manual
  run_label="manual"
else
  set -- --notify
  run_label="07:20 scheduled"
fi
tmp_output="$(mktemp /tmp/tregu-daily-drafts.XXXXXX)"
trap 'rm -f "$tmp_output"' EXIT INT TERM
while [ "$attempt" -le "$max_attempts" ]; do
  : >"$tmp_output"
  set +e
  timeout 1200s node scripts/run-tregu-daily-drafts.mjs "$@" >"$tmp_output" 2>&1
  status=$?
  set -e
  cat "$tmp_output"
  if [ "$status" -eq 0 ]; then
    exit 0
  fi
  if [ "$attempt" -lt "$max_attempts" ] && grep -Eiq '(^|[^0-9])(404|408|429|500|502|503|504)([^0-9]|$)|fetch failed|econn|timed out|gateway timeout' "$tmp_output"; then
    sleep 30
    attempt=$((attempt + 1))
    continue
  fi
  break
done

# Notify only after the final failed attempt, without putting credentials or
# untrusted provider output into the message body.
html_file="$(mktemp /tmp/tregu-daily-failure.XXXXXX)"
trap 'rm -f "$tmp_output" "$html_file"' EXIT INT TERM
printf '%s\n' "<!doctype html><html><body><h1>383 Tregu daily creation failed</h1><p>The $run_label run did not complete. No market creation result can be confirmed from this run.</p><p>Check the VPS journal for Tregu daily drafts.</p></body></html>" >"$html_file"
python3 scripts/send-tregu-review-email.py --recipient "${TREGU_MARKET_RECIPIENT:-lindsylqa@gmail.com}" --subject "383 Tregu - FAILED - daily creation" --html-file "$html_file" || echo 'Tregu failure receipt delivery failed.' >&2
exit "$status"
