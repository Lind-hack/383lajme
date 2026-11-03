#!/usr/bin/env bash
set -Eeuo pipefail
REPO="${L383_REPO:-/opt/data/workspaces/383lajme-news-current}"
LOCK=/tmp/383-production.lock
if [ "${L383_QA_ONLY:-0}" = "1" ]; then LOCK=/tmp/383-qa-news.lock; fi
exec 9>"$LOCK"
if ! flock -n 9; then
  printf '383 ACTIVE RUN: %s is held; skipping category coordinator\n' "$LOCK"
  exit 0
fi
exec "${L383_PYTHON_BIN:-/opt/data/workspaces/383lajme/.venv/bin/python}" "$REPO/scripts/news_category_runs.py"
