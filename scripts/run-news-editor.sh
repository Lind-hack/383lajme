#!/usr/bin/env bash
set -euo pipefail

MODEL="$1"
BATCH="$2"
REPO="$3"
MAX_TURNS="${4:-45}"
PYTHON_BIN="${L383_PYTHON_BIN:-/opt/data/workspaces/383lajme/.venv/bin/python}"
LOG="$(mktemp /tmp/383-safe-editor.XXXXXX.log)"
EDITOR_INPUT="$(mktemp /tmp/383-safe-editor-input.XXXXXX.json)"
cp "$BATCH" "$EDITOR_INPUT"
INPUT_HASH="$(sha256sum "$BATCH" | cut -d ' ' -f 1)"
trap 'rm -f "$LOG" "$EDITOR_INPUT"' EXIT
cd /opt/data

set +e
/opt/hermes/.venv/bin/hermes chat --ignore-rules \
  --provider "${L383_WRITER_PROVIDER:-openai-codex}" --model "$MODEL" \
  -t file --yolo --max-turns "$MAX_TURNS" -Q -q \
"You are the independent Albanian copy editor for 383. Edit only ${BATCH}. Read ${REPO}/docs/albanian_newsroom.md, ${REPO}/docs/news-output-schema.json, and ${BATCH%.json}.editor-sources.json with the file tool. The evidence file contains independently fetched original pages for every primary and corroborating source. Check each article's central claim, names, dates, numbers, units, negation, uncertainty, attribution, category and city against the fetched primary and every supplied corroborating original. Routine news may use one credited readable source; sensitive allegations require independent corroboration. Rewrite literal translations into natural standard Albanian and remove exact copied sentences. Preserve only supported facts. Keep every individually verifiable story; drop only stories whose evidence fails, never empty the whole batch because one story fails. Retained articles need at least 140 grounded words in three HTML paragraphs; longer articles are welcome when evidence supports them, but never pad short news. Never change id, slug, dispatch, primary URL, category, created_at, published_at, or corroborating_sources; those fields are immutable. Preserve the JSON schema. Do not invent details, run tests or builds, deploy, publish, send messages, or edit another file. You have only the file tool. Save a non-empty valid JSON array to ${BATCH}. This is a data-only editorial task, not a code release: npm tests and builds are neither needed nor requested, and their status must not block your editorial response. The wrapper will verify the saved JSON and run separate article-quality gates; your response does not certify code tests or builds. After saving and checking every retained article, briefly summarize how many were kept and removed. Do not discuss code tests or builds; they are not part of this data-only review. If none can be verified, explain why instead of claiming completion." 9>&- | tee "$LOG"
EDITOR_RC=$?
set -e

if [ "$EDITOR_RC" -ne 0 ]; then
  printf '383 SAFE EDITOR: model=%s exited %s\n' "$MODEL" "$EDITOR_RC" >&2
  exit 1
fi
if [ "$(sha256sum "$BATCH" | cut -d ' ' -f 1)" = "$INPUT_HASH" ]; then
  printf '383 SAFE EDITOR: model=%s did not save a reviewed change\n' "$MODEL" >&2
  exit 1
fi
if ! "$PYTHON_BIN" -c 'import json,sys; old=json.load(open(sys.argv[1],encoding="utf-8")); rows=json.load(open(sys.argv[2],encoding="utf-8")); assert isinstance(old,list) and isinstance(rows,list) and len(rows)>0; urls={item.get("url") for item in old}; assert all(isinstance(item,dict) and item.get("url") in urls for item in rows)' "$EDITOR_INPUT" "$BATCH"; then
  printf '383 SAFE EDITOR: model=%s saved an empty, invalid, or unsupported-source batch\n' "$MODEL" >&2
  exit 1
fi
"$PYTHON_BIN" "$REPO/scripts/normalize-news-editor-identity.py" "$EDITOR_INPUT" "$BATCH"
"$PYTHON_BIN" "$REPO/scripts/editor_completion.py" acknowledge "$BATCH"
