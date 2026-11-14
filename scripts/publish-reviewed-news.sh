#!/usr/bin/env bash
# Model work stays outside the shared publication critical section.
set -Eeuo pipefail
BATCH="$1"
REPO="$2"
QA_ONLY="${3:-0}"
PYTHON_BIN="${L383_PYTHON_BIN:-/opt/data/workspaces/383lajme/.venv/bin/python}"
cd "$REPO"
: "${L383_PUBLICATION_DEADLINE_EPOCH:?publication deadline is required}"
for attempt in 1 2; do
  if [ "$(date +%s)" -ge "$L383_PUBLICATION_DEADLINE_EPOCH" ]; then
    printf '383 PUBLICATION QUEUE: review deadline exhausted; drafts retained\n' >&2
    exit 75
  fi
  stage="independent-event-context-review"
  "$PYTHON_BIN" scripts/news_context_review.py --file "$BATCH"
  if [ "$("$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH")" -eq 0 ]; then exit 0; fi
  "$PYTHON_BIN" scripts/news_copyright_review.py --verify --file "$BATCH"
  "$PYTHON_BIN" scripts/codex_automation_support.py validate --file "$BATCH"
  "$PYTHON_BIN" scripts/validate_source_mix.py --file "$BATCH"

  stage="publication-lock"
  LOCK_FILE="${4:-/tmp/383-news-publication.lock}"
  exec 8>"$LOCK_FILE"
  PUBLICATION_WAIT="$((L383_PUBLICATION_DEADLINE_EPOCH - $(date +%s)))"
  if [ "$PUBLICATION_WAIT" -le 0 ] || ! flock -w "$PUBLICATION_WAIT" 8; then
    printf '383 PUBLICATION QUEUE: lock deadline exhausted; drafts retained\n' >&2
    exit 75
  fi
  stage="locked-history-verification"
  set +e
  "$PYTHON_BIN" scripts/news_context_review.py --verify --file "$BATCH"
  verified=$?
  set -e
  if [ "$verified" -eq 75 ]; then
    flock -u 8
    exec 8>&-
    printf '383 PUBLICATION QUEUE: history changed; release lock before fresh comparison\n'
    continue
  fi
  if [ "$verified" -ne 0 ]; then exit "$verified"; fi
  if [ "$QA_ONLY" != "1" ]; then
    "$PYTHON_BIN" scripts/codex_automation_support.py publish-supabase --file "$BATCH"
  fi
  # Exact database readback completed inside publish-supabase.
  flock -u 8
  exec 8>&-
  exit 0
done
printf '383 PUBLICATION QUEUE: history changed after both independent comparisons; drafts retained\n' >&2
exit 75
