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
"$PYTHON_BIN" - "$BATCH" "$REPO" "$EDITOR_INPUT.md" <<'PY'
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[2]) / 'scripts'))
from news_model_evidence import write_readable_evidence
write_readable_evidence(Path(sys.argv[3]), json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')))
PY
trap 'rm -f "$LOG" "$EDITOR_INPUT" "$EDITOR_INPUT.md"' EXIT
cd /opt/data

set +e
"$PYTHON_BIN" "$REPO/scripts/news_model_response.py" --batch "$BATCH" --mode editor -- /opt/hermes/.venv/bin/hermes chat --ignore-rules \
  --provider "${L383_WRITER_PROVIDER:-openai-codex}" --model "$MODEL" \
  -t file --yolo --max-turns "$MAX_TURNS" -Q -q \
"You are the independent Albanian copy editor for 383. Review the wrapped article copy ${EDITOR_INPUT}.md with the file tool, but do not edit any files. Read ${REPO}/docs/albanian_newsroom.md, ${REPO}/docs/news-output-schema.json, and ${BATCH%.json}.editor-sources.md with the file tool. Read every complete source, continuing with offset if the tool paginates; wrapped line breaks are presentation only. The evidence file contains independently fetched original pages for every primary and corroborating source. Check each article's central claim, names, dates, numbers, units, negation, uncertainty, attribution, category and city against the fetched primary and every supplied corroborating original. Routine news may use one readable registered source as factual evidence; sensitive allegations require independent corroboration. Check every fact even when the prose needs no edit. When an existing draft is accurate, independently composed and natural Albanian, preserve its headline, lead, body and paragraph order exactly. Make only concrete corrections for factual, attribution, originality or title defects; do not rewrite for cosmetic style. The source is verification evidence, not a writing template. Never replace an original lead or organization with the source's lead or sentence sequence. Rewrite literal translations into natural standard Albanian and remove exact copied sentences. The pre-edit originality check found: ${L383_EDITOR_GATE_FEEDBACK:-No pre-edit overlap feedback}. Rewrite each identified entire sentence with different syntax; do not copy eight consecutive words from the original, including generic attribution phrases. Each title must name its concrete subject and verified action, using natural Albanian verbs and the actual institution/person/place from the source. Preserve only supported facts. Remove generic publisher introductions. Rewrite any article that mirrors its source sentence by sentence or reuses its headline wording, and delete claims the evidence does not state (including negative ones). Never name a publisher anywhere in public copy; attribute public statements to the speaker or institution. Reject any article that rests on another outlet's exclusive reporting, own interview or unconfirmed claim instead of hiding its origin. Verify image_subject and image_rights.description against the article: a category match is insufficient. Drop a candidate whose prepared photo is unrelated; never replace it with a publisher photo. Every retained article must have its prepared qualifying contextual photo; remove candidates without one. Preserve all image_* metadata unchanged. Write with a fresh lead and structure from a fact outline, not a line-by-line translation; never claim 383 conducted interviews or eyewitness reporting it did not perform. Keep every individually verifiable story; drop only stories whose evidence fails, never empty the whole batch because one story fails. Retained articles need at least 140 grounded words in three HTML paragraphs; longer articles are welcome when evidence supports them, but never pad short news. Never change id, slug, dispatch, primary URL, category, created_at, published_at, or corroborating_sources; those fields are immutable. Read ${REPO}/docs/news-ranking-rubric.md. Reassess all eight score_breakdown factors for each retained story individually against its verified evidence, timeliness and audience stakes. Replace neutral all-5 templates with justified ratings; retain genuinely justified equal scores. Set score_formula to weighted evidence-based editorial ranking v1 and write a concrete Albanian score_reason. The normalizer calculates the total. Preserve the JSON schema. Do not invent details, run tests or builds, deploy, publish, send messages, or edit another file. You have only the file tool. Return the complete corrected article array (empty when every candidate fails verification) in your final response between the literal markers 383_JSON_BEGIN and 383_JSON_END. The wrapper saves it atomically. This is a data-only editorial task, not a code release: npm tests and builds are neither needed nor requested, and their status must not block your editorial response. The wrapper will verify the saved JSON and run separate article-quality gates; your response does not certify code tests or builds. After checking every retained article, return only the complete article array between the required markers. Do not summarize instead of returning JSON. Do not discuss code tests or builds; they are not part of this data-only review. If none can be verified, return an empty array between the same required markers." 9>&- | tee "$LOG"
EDITOR_RC=$?
set -e

if [ "$EDITOR_RC" -ne 0 ]; then
  printf '383 SAFE EDITOR: model=%s exited %s\n' "$MODEL" "$EDITOR_RC" >&2
  exit 1
fi
if ! "$PYTHON_BIN" -c 'import json,sys; old=json.load(open(sys.argv[1],encoding="utf-8")); rows=json.load(open(sys.argv[2],encoding="utf-8")); assert isinstance(old,list) and isinstance(rows,list) ; urls={item.get("url") for item in old}; assert all(isinstance(item,dict) and item.get("url") in urls for item in rows)' "$EDITOR_INPUT" "$BATCH"; then
  printf '383 SAFE EDITOR: model=%s saved an invalid or unsupported-source batch\n' "$MODEL" >&2
  exit 1
fi
if [ "$("$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH")" -eq 0 ]; then
  rm -f "${BATCH%.json}.editor-complete.json"
  printf '383 SAFE EDITOR: no verified articles retained\n'
  exit 0
fi
"$PYTHON_BIN" "$REPO/scripts/normalize-news-editor-identity.py" "$EDITOR_INPUT" "$BATCH"
"$PYTHON_BIN" "$REPO/scripts/editor_completion.py" acknowledge "$BATCH"
