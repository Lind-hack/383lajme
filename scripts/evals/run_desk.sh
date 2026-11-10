#!/usr/bin/env bash
# EVAL ONLY: one QA (no-publish) run of a reliable desk on a local machine, with a
# stand-in model answering for Luna. See README.md in this folder.
# usage: run_desk.sh <showbiz|ekonomi|bote> <run-number> [minutes]
#   L383_EVAL_ROOT   where checkouts and results live (default /d/383-evals)
#   PREFIX           result folder prefix, e.g. PREFIX=fix -> runs/<desk>/fix-<n>
#   L383_EVAL_MODEL  model for `claude -p` (default haiku)
set -uo pipefail
DESK="$1"; N="$2"; MIN="${3:-20}"
case "$DESK" in showbiz) CAT="Showbiz";; ekonomi) CAT="Ekonomi";; bote) CAT="Botë";; *) echo "unknown desk" >&2; exit 2;; esac
ROOT="${L383_EVAL_ROOT:-/d/383-evals}"
WIN_ROOT="$(cygpath -m "$ROOT" 2>/dev/null || echo "$ROOT")"
HERE="$(cd "$(dirname "$0")" && pwd)"
# One checkout per desk: the runner writes .last30days/ relative to its folder.
WT="$ROOT/wt-$DESK"; [ -d "$WT" ] || WT="$ROOT/wt"
OUT="$ROOT/runs/$DESK/${PREFIX:-run}-$N"; mkdir -p "$OUT/state/hourly-runs" "$ROOT/tmp"
cd "$WT" || exit 2
set -a; . ./.env.local; set +a
# The public read-only key: history can be read, nothing can be written.
export SUPABASE_SERVICE_ROLE_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
export L383_EVAL_SHIM=1 PYTHONPATH="$(cygpath -m "$HERE/shim" 2>/dev/null || echo "$HERE/shim")" PYTHONIOENCODING=utf-8 PYTHONUTF8=1
export L383_EVAL_CALLS="$WIN_ROOT/runs/$DESK/${PREFIX:-run}-$N/model-calls.jsonl" L383_EVAL_TMP="$WIN_ROOT/tmp"
export TMP="$WIN_ROOT/tmp" TEMP="$WIN_ROOT/tmp"
export L383_QA_ONLY=1 L383_RUN_DESK="$DESK" L383_NEWS_CATEGORIES="$CAT" L383_HOURLY_NEWS=1
export L383_PYTHON_BIN="$(cygpath -m "$(command -v python)" 2>/dev/null || command -v python)"
export L383_EDITOR_CWD="$(cygpath -m "$WT" 2>/dev/null || echo "$WT")"
export STAMP="$(date -u +%Y-%m-%dT%H)" L383_ARTICLE_CONTEXT=0
export L383_RUN_STATE="$WIN_ROOT/runs/$DESK/${PREFIX:-run}-$N/state/hourly-runs/outcome.json"
export L383_MODEL_DEADLINE_EPOCH="$(( $(date +%s) + MIN*60 ))"
date -u +%FT%TZ > "$OUT/started"
python scripts/news_reliable_desks.py > "$OUT/log.txt" 2>&1
echo "exit=$?" >> "$OUT/log.txt"; date -u +%FT%TZ > "$OUT/finished"
cp -r .last30days "$OUT/last30days" 2>/dev/null
tail -3 "$OUT/log.txt" | cut -c1-600
