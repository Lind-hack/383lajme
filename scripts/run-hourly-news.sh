#!/usr/bin/env bash
set -Eeuo pipefail

# Refuse the retired production overlays. The host timer uses a committed release.
if [[ "${L383_REPO:-}" == /opt/data/workspaces/383lajme-prod-* ]]; then
  printf '383 LEGACY SCHEDULER DISABLED: refusing detached overlay %s; use the canonical news release.\n' "$L383_REPO" >&2
  exit 0
fi

# Bound the container process group itself; killing docker exec on the host
# does not reliably stop its descendants inside the container.
if [ "${L383_DEADLINE_ACTIVE:-0}" != "1" ]; then
  set +e
  timeout --signal=TERM --kill-after=30s 3300s env L383_DEADLINE_ACTIVE=1 bash "$0" "$@"
  deadline_rc=$?
  if [ "$deadline_rc" = "124" ] || [ "$deadline_rc" = "137" ]; then
    printf '383 DEADLINE: container run exceeded 55 minutes; process group stopped.\n' >&2
    if [ "${L383_QA_ONLY:-0}" != "1" ]; then
      /opt/data/scripts/send-383-failure-alert.sh "${STAMP:-$(date -u +%Y-%m-%dT%H)}" "55-minute container deadline exceeded; inspect batch/publication state before retrying"
    fi
  fi
  exit "$deadline_rc"
fi

REPO="${L383_REPO:-/opt/data/workspaces/383lajme}"
PYTHON_BIN="${L383_PYTHON_BIN:-/opt/data/workspaces/383lajme/.venv/bin/python}"
QA_ONLY="${L383_QA_ONLY:-0}"
cd "$REPO"
export HERMES_HOME="${L383_HERMES_HOME:-/opt/data/news-pipeline-hermes}"
STAMP="${STAMP:-$(date -u +%Y-%m-%dT%H)}"
export CRON_SLOT_LABEL="$(TZ=Europe/Warsaw date '+%Y-%m-%d %H:00 %Z')"
DISCOVERY="$PWD/.last30days/cloud-news-discovery-current.md"
SOCIAL_CANDIDATES="$PWD/.last30days/social-native-candidates-current.md"
if [ "$QA_ONLY" = "1" ]; then
  BATCH="/opt/data/qa/383/${STAMP}.json"
else
  BATCH="$PWD/data/auto-articles/${STAMP}.json"
fi
mkdir -p "$(dirname "$BATCH")"
LOCK_FILE=/tmp/383-production.lock
START_EPOCH="$(date +%s)"
stage="initialization"
alerting=0
STATE="$PWD/.last30days/hourly-runs/${STAMP}${QA_ONLY:+-mode${QA_ONLY}}.json"
record_state() { "$PYTHON_BIN" scripts/news_run_state.py save "$STATE" --status "$1" --stage "$stage" --batch "$BATCH"; }

alert_failure() {
  local reason="$1"
  if [ "$QA_ONLY" = "1" ]; then
    printf '383 QA FAILURE ALERT SUPPRESSED: %s\n' "$reason" >&2
    return 0
  fi
  if /opt/data/scripts/send-383-failure-alert.sh "$STAMP" "$reason"; then
    printf '383 FAILURE ALERT SENT: %s\n' "$reason" >&2
  else
    printf '383 FAILURE ALERT DELIVERY FAILED: %s\n' "$reason" >&2
  fi
}

fail_run() {
  local reason="$1"
  trap - ERR
  record_state failed
  alert_failure "$reason"
  printf '383 NO_PUBLISH: %s for %s\n' "$reason" "$STAMP"
  exit 75
}

on_error() {
  local rc=$?
  record_state failed || true
  if [ "$alerting" -eq 0 ]; then
    alerting=1
    alert_failure "stage=${stage} exit=${rc}"
  fi
  exit "$rc"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  printf '383 ACTIVE RUN: %s is held; skipping this invocation without changing the active slot state\n' "$LOCK_FILE"
  exit 0
fi
trap on_error ERR
if "$PYTHON_BIN" scripts/news_run_state.py check "$STATE"; then
  printf "383 SLOT ALREADY PUBLISHED: %s; refusing duplicate writer/publication\n" "$STAMP"
  exit 0
fi
record_state running

stage="writer-auth-preflight"
/opt/hermes/.venv/bin/python scripts/configure_news_model.py --home "$HERMES_HOME" --effort medium
if [ "${L383_WRITER_PROVIDER:-openai-codex}" = "openai-codex" ]; then
  /opt/hermes/.venv/bin/python -c 'from hermes_cli.auth import resolve_codex_runtime_credentials; c=resolve_codex_runtime_credentials(); assert c.get("api_key"), "No Codex access token"; print("383 CODEX AUTH: usable credentials resolved")'
fi

verify_deployment() {
DEPLOYMENT_INFO="$(curl -L -fsS --max-time 30 "https://www.383ks.com/api/deployment-info?cron=${STAMP}")"
printf '%s' "$DEPLOYMENT_INFO" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("environment") == "production", d; print("383 SITE HEALTH: production endpoint reachable; news-only Supabase publication")'
}

# News publishing writes Supabase, not website code. Check production health
# independently of hosting provider; retain article readback after publication.
if [ "$QA_ONLY" != "1" ]; then
  stage="deployment-preflight"
  verify_deployment
  stage="database-schema-preflight"
  PYTHONPATH="$REPO/scripts" "$PYTHON_BIN" -c 'from codex_automation_support import load_env, _supabase_request; load_env(); _supabase_request("GET", "news_articles", query={"select":"id,city,category,raw_article", "limit":"0"}); print("383 DATABASE SCHEMA: publication columns available")'
  stage="startup-confirmation"
  "$PYTHON_BIN" scripts/codex_automation_support.py send-status-report --phase started --message "Pipeline u nis për orarin e shënuar dhe kaloi kontrollet e autentikimit, faqes dhe bazës së të dhënave. Po ekzekutohet me GPT-6.1 Sol, medium effort. Raporti përfundimtar do të listojë artikujt e publikuar."
fi

stage="retention"
# Retention disabled 2026-09-27 on the owner's instruction: 383 keeps every
# published article forever. The old step deleted news_articles rows older
# than five days on every run. Backup: run-383-production.sh.bak-retention-*
echo "RETENTION DISABLED: articles are kept forever"

stage="discovery"
export L383_HOURLY_NEWS=1
if ! "$PYTHON_BIN" scripts/cloud_news_discovery.py --output .last30days/cloud-news-discovery-current.md --skip-published; then
  fail_run "discovery or published-news prefilter unavailable; inspect discovery diagnostics"
fi

stage="writer-source-fetch"
"$PYTHON_BIN" scripts/prepare_editor_sources.py "$DISCOVERY" --discovery

# Count pairs whose primary and independent second article were both readable,
# not just headline-similar URLs. An inaccessible second source cannot be used.
L383_TARGET_ARTICLES="$(DISCOVERY_PATH="$DISCOVERY" "$PYTHON_BIN" -c 'import os,re; t=open(os.environ["DISCOVERY_PATH"],encoding="utf-8").read(); m=re.search(r"Verified source-ready pair inventory: (\d+)",t); print(min(20,int(os.environ.get("L383_MAX_ARTICLES", "20")),int(m.group(1))) if m else 0)')"
if [ -z "$L383_TARGET_ARTICLES" ] || [ "$L383_TARGET_ARTICLES" -lt 1 ]; then
  stage="no-new-verified-news"
  record_state no_news
  "$PYTHON_BIN" scripts/news_quality_report.py --file "/tmp/383-no-batch-${STAMP}.json" --status no_news
  if [ "$QA_ONLY" != "1" ]; then
    "$PYTHON_BIN" scripts/codex_automation_support.py send-status-report --phase completed --message "Pipeline përfundoi me sukses. Nuk u gjetën artikuj të rinj me burime të lexueshme dhe verifikim të pavarur për publikim në këtë orar."
  fi
  printf "383 SUCCESS NO_NEW_VERIFIED_NEWS slot=%s; no padding or publication\n" "$STAMP"
  exit 0
fi
export L383_TARGET_ARTICLES
printf 'HOURLY NEWS TARGET: up to %s source-ready independently paired articles\n' "$L383_TARGET_ARTICLES"
if [ "$L383_TARGET_ARTICLES" -ge 5 ]; then
  L383_WRITER_ATTEMPT_TIMEOUT=900
  L383_WRITER_MAX_TURNS=70
  L383_EDITOR_MAX_TURNS=80
fi

stage="agent-social-research"
SOCIAL_ARTIFACT="$PWD/.last30days/agent-social-research-current.md"
LOCAL_DAY_START="$(TZ=Europe/Belgrade date -d "$(TZ=Europe/Belgrade date +%F) 00:00:00" +%s)"
if [ -s "$SOCIAL_ARTIFACT" ] && [ "$(stat -c %Y "$SOCIAL_ARTIFACT")" -ge "$LOCAL_DAY_START" ]; then
  SOCIAL_MTIME="$(stat -c %Y "$SOCIAL_ARTIFACT")"
  printf 'AGENT SOCIAL RESEARCH: using current-day dedicated artifact mtime=%s\n' "$SOCIAL_MTIME"
  printf '\n# Agent-research social discovery (exact-post verification required for social-native publication)\n\n' >> "$DISCOVERY"
  cat "$SOCIAL_ARTIFACT" >> "$DISCOVERY"
  printf '\n' >> "$DISCOVERY"
else
  printf 'AGENT SOCIAL RESEARCH: no current-day dedicated artifact; social evidence unavailable for this run.\n'
  printf '\n# Agent-research social discovery (exact-post verification required for social-native publication)\n\n' >> "$DISCOVERY"
  printf 'AGENT SOCIAL RESEARCH: no current-day dedicated artifact; social evidence unavailable for this run.\n' >> "$DISCOVERY"
  printf '\n' >> "$DISCOVERY"
fi

stage="social-candidate-probe"
rm -f "$SOCIAL_CANDIDATES"
if ! "$PYTHON_BIN" scripts/prepare_social_native_candidates.py "$DISCOVERY" "$SOCIAL_CANDIDATES"; then
  printf 'SOCIAL CANDIDATES: probe failed; ordinary direct-source pipeline will continue, social-native inventory unavailable.\n' >&2
  printf '%s\n' '# Verified social-native candidates' 'No exact reachable social post passed the pre-writer probe.' > "$SOCIAL_CANDIDATES"
fi

# Prevent the writer from accidentally selecting stale legacy discovery artifacts.
rm -f data/automation/cloud-news-discovery-current.md
# A failed writer must not leave an old same-hour batch eligible for publication.
rm -f "$BATCH"
stage="writer"
export HERMES_HOME="${L383_HERMES_HOME:-/opt/data/news-pipeline-hermes}"
# The provider may legitimately pause for more than 12 seconds between SSE
# frames while drafting. Do not classify that normal prefill as a dead stream.
export HERMES_CODEX_EVENT_STALE_TIMEOUT_SECONDS="${HERMES_CODEX_EVENT_STALE_TIMEOUT_SECONDS:-90}"

run_writer() {
  local model="$1"
  timeout --signal=TERM --kill-after=15s "${L383_WRITER_ATTEMPT_TIMEOUT:-300}s" \
    env HERMES_HOME="${L383_HERMES_HOME:-/opt/data/news-pipeline-hermes}" \
    /opt/hermes/.venv/bin/hermes chat \
      --provider "${L383_WRITER_PROVIDER:-openai-codex}" \
      --model "$model" --ignore-rules -t file,terminal --yolo \
      --max-turns "${L383_WRITER_MAX_TURNS:-35}" -Q -q \
      "Create ${BATCH} from today's prepared evidence. Read docs/albanian_newsroom.md, docs/news-output-schema.json, ${DISCOVERY}, and ${SOCIAL_CANDIDATES}; those files contain the complete rules and fresh source-evidence paths. Discovery lists corroboration pair IDs and the Verified source-ready pair IDs whose primary and independent second pages are readable. Select only verified source-ready pair IDs. Treat each as one article: choose the stronger URL as primary and put its explicitly listed independent URL in corroborating_sources. Ignore unpaired or unreadable leads. Write as many distinct eligible stories as the evidence supports, up to ${L383_TARGET_ARTICLES:-20} total; do not stop after one strong article. Save a populated draft early, then add and verify candidates in the same file before the deadline. Every article needs its discovery category, deterministic city for local lanes, the paired direct primary URL, its paired corroborating URL, a contextual HTTPS image whose actual dimensions are at least 1200x675, at least 220 grounded Albanian words in four HTML paragraphs, and all schema fields. If the first image is too small or unavailable, keep the story and try publisher-declared images from the primary and corroborating pages. If those fail, use web research to find up to three reputable publisher pages covering the exact same event and record them in image_source_pages; do not use raw image-search, gallery, stock-photo, social-profile, or merely topically similar pages. Preserve uncertainty and named attribution; never invent facts, local impact, quotes, images, or sources. Every publisher and corroborating publisher is locked to its category by scripts/news_sources.json. Cover all seven desks fairly using available evidence; Ekonomi includes US stocks, Wall Street and crypto. Prioritize documented local public controversies. Never change a discovery category or use an unregistered source. Do not run pipeline scripts, discover extra stories, repository-wide tests, publish, deploy, email, or write any other file. Save populated valid JSON to ${BATCH} before responding." 9>&-
}

WRITER_RC=0
PRIMARY_WRITER_MODEL="${L383_WRITER_MODEL:-gpt-6.1-sol}"
if [ "$PRIMARY_WRITER_MODEL" = "gpt-5.6-luna" ]; then
  PRIMARY_WRITER_MODEL="gpt-6.1-sol"
fi
EDITOR_MODEL="${L383_EDITOR_MODEL:-${L383_WRITER_MODEL:-gpt-6.1-sol}}"
if [ "$EDITOR_MODEL" = "gpt-5.6-luna" ]; then
  EDITOR_MODEL="gpt-6.1-sol"
fi
FALLBACK_WRITER_MODEL="${L383_WRITER_FALLBACK_MODEL:-gpt-6.1-sol}"
printf '383 WRITER: provider=%s primary=%s fallback=%s max_turns=%s timeout=%ss\n' \
  "${L383_WRITER_PROVIDER:-openai-codex}" "$PRIMARY_WRITER_MODEL" "$FALLBACK_WRITER_MODEL" \
  "${L383_WRITER_MAX_TURNS:-35}" "${L383_WRITER_ATTEMPT_TIMEOUT:-300}"
# Avoid an all-at-once 20-story request. Draft at most four per call, then
# extend the same batch while preserving the existing sources and time budget.
FULL_TARGET="$L383_TARGET_ARTICLES"
L383_TARGET_ARTICLES="$((FULL_TARGET < 4 ? FULL_TARGET : 4))"
if run_writer "$PRIMARY_WRITER_MODEL"; then
  WRITER_RC=0
else
  WRITER_RC=$?
fi
if [ "$WRITER_RC" -ne 0 ] && { [ ! -s "$BATCH" ] || [ "$(stat -c %Y "$BATCH" 2>/dev/null || echo 0)" -lt "$START_EPOCH" ]; }; then
  printf '383 WRITER RETRY: primary=%s rc=%s fallback=%s\n' "$PRIMARY_WRITER_MODEL" "$WRITER_RC" "$FALLBACK_WRITER_MODEL" >&2
  rm -f "$BATCH"
  if run_writer "$FALLBACK_WRITER_MODEL"; then
    WRITER_RC=0
  else
    WRITER_RC=$?
  fi
fi
L383_TARGET_ARTICLES="$FULL_TARGET"
if [ "$WRITER_RC" -ne 0 ]; then
  if [ -s "$BATCH" ] && [ "$(stat -c %Y "$BATCH")" -ge "$START_EPOCH" ]; then
    printf '383 WRITER NONZERO BUT FRESH BATCH EXISTS: rc=%s; deterministic gates will decide publication.\n' "$WRITER_RC" >&2
  else
    fail_run "writer exited ${WRITER_RC} without a fresh non-empty batch file"
  fi
fi

stage="batch-check"
if [ ! -s "$BATCH" ]; then
  fail_run "writer did not create a fresh non-empty batch file"
fi
BATCH_MTIME="$(stat -c %Y "$BATCH")"
if [ "$BATCH_MTIME" -lt "$START_EPOCH" ]; then
  fail_run "batch file is stale (mtime=${BATCH_MTIME}, run_start=${START_EPOCH})"
fi
BATCH_COUNT="$("$PYTHON_BIN" -c 'import json,sys; d=json.load(open(sys.argv[1], encoding="utf-8")); a=d.get("articles", d) if isinstance(d, dict) else d; print(len(a) if isinstance(a, list) else 0)' "$BATCH")"
if [ "$BATCH_COUNT" -lt 1 ]; then
  fail_run "writer produced no verified article candidates"
fi

# Continue a fresh batch in bounded four-story increments. Reserve at least
# 25 minutes of the 55-minute deadline for editing, gates, and publication.
stage="writer-continuation"
CONTINUATION_FAILURES=0
for continuation in {1..15}; do
  if [ "$BATCH_COUNT" -ge "$L383_TARGET_ARTICLES" ]; then
    break
  fi
  if [ "$(( $(date +%s) - START_EPOCH ))" -ge 1800 ]; then
    printf '383 WRITER CONTINUATION time budget reached; editing current drafts\n'
    break
  fi
  printf '383 WRITER CONTINUATION attempt=%s drafted=%s source_ready_target=%s\n' \
    "$continuation" "$BATCH_COUNT" "$L383_TARGET_ARTICLES"
  CONTINUATION_BACKUP="$(mktemp /tmp/383-continuation.XXXXXX.json)"
  cp "$BATCH" "$CONTINUATION_BACKUP"
  L383_TARGET_ARTICLES="$((BATCH_COUNT + 4 < FULL_TARGET ? BATCH_COUNT + 4 : FULL_TARGET))"
  if ! timeout --signal=TERM --kill-after=15s 600s \
    /opt/hermes/.venv/bin/hermes chat --provider "${L383_WRITER_PROVIDER:-openai-codex}" \
      --model "$PRIMARY_WRITER_MODEL" --ignore-rules -t file,terminal --yolo \
      --max-turns 45 -Q -q \
      "Continue the existing ${BATCH}; do not replace, remove, or edit its current articles. Read docs/albanian_newsroom.md, docs/news-output-schema.json, ${DISCOVERY}, and the existing batch. Its current ${BATCH_COUNT} drafts are not the full source-ready inventory of ${L383_TARGET_ARTICLES}. Add as many genuinely distinct articles as the remaining Verified source-ready pair IDs support, up to ${L383_TARGET_ARTICLES} total. Skip every primary or corroborating URL already used in the batch. Every new article must have a readable independent second source, 220+ grounded Albanian words in four HTML paragraphs, a verified 1200x675+ contextual image, all schema fields and a concrete title naming WHO and STAKE. If the first image is unusable, try the story's publisher pages and then up to three exact-event reputable coverage pages in image_source_pages; never use raw image-search, gallery, stock, social-profile, or merely topical pages. Do not fabricate or pad stories. Save valid JSON to the same ${BATCH} before responding. Do not run pipeline scripts, npm, repository tests or builds, publish, deploy, send reports, or write another file. This is a data-only writing task; code-release checks are not part of it." 9>&-; then
    printf '383 WRITER CONTINUATION attempt=%s exited nonzero; retaining existing draft for deterministic checks\n' "$continuation" >&2
  fi
  L383_TARGET_ARTICLES="$FULL_TARGET"
  NEXT_COUNT="$("$PYTHON_BIN" -c 'import json,sys; old=json.load(open(sys.argv[1],encoding="utf-8")); new=json.load(open(sys.argv[2],encoding="utf-8")); old=old.get("articles",old) if isinstance(old,dict) else old; new=new.get("articles",new) if isinstance(new,dict) else new; assert isinstance(old,list) and isinstance(new,list); assert {x.get("url") for x in old}.issubset({x.get("url") for x in new}); print(len(new))' "$CONTINUATION_BACKUP" "$BATCH" 2>/dev/null || true)"
  if [ -z "$NEXT_COUNT" ]; then
    cp "$CONTINUATION_BACKUP" "$BATCH"
    rm -f "$CONTINUATION_BACKUP"
    CONTINUATION_FAILURES="$((CONTINUATION_FAILURES + 1))"
    printf '383 WRITER CONTINUATION invalid or removed an existing source URL; restored prior batch (consecutive failures=%s)\n' "$CONTINUATION_FAILURES" >&2
    if [ "$CONTINUATION_FAILURES" -ge 2 ]; then break; fi
    continue
  fi
  rm -f "$CONTINUATION_BACKUP"
  if [ "$NEXT_COUNT" -le "$BATCH_COUNT" ]; then
    CONTINUATION_FAILURES="$((CONTINUATION_FAILURES + 1))"
    printf '383 WRITER CONTINUATION made no additional drafts (consecutive failures=%s)\n' "$CONTINUATION_FAILURES"
    if [ "$CONTINUATION_FAILURES" -ge 2 ]; then break; fi
    continue
  fi
  CONTINUATION_FAILURES=0
  BATCH_COUNT="$NEXT_COUNT"
done
printf '383 WRITER FINAL DRAFT COUNT: %s of %s source-ready pairs\n' "$BATCH_COUNT" "$L383_TARGET_ARTICLES"

stage="normalize"
"$PYTHON_BIN" scripts/codex_automation_support.py normalize --file "$BATCH"

stage="editor-source-fetch"
"$PYTHON_BIN" scripts/prepare_editor_sources.py "$BATCH"

stage="albanian-editor"
EDITOR_INPUT_BACKUP="$(mktemp /tmp/383-editor-input.XXXXXX.json)"
cp "$BATCH" "$EDITOR_INPUT_BACKUP"
rm -f "${BATCH%.json}.editor-complete.json"
trap - ERR
set +e
bash "$REPO/scripts/run-news-editor.sh" "$EDITOR_MODEL" "$BATCH" "$REPO" "${L383_EDITOR_MAX_TURNS:-30}" 9>&-

EDITOR_RC=$?
set -e
trap on_error ERR
if [ "$EDITOR_RC" -ne 0 ] || ! "$PYTHON_BIN" scripts/editor_completion.py verify "$BATCH" >/dev/null 2>&1; then
  printf '383 EDITOR RETRY: primary=%s rc=%s or completion missing; restoring original drafts for fallback=%s\n' "$EDITOR_MODEL" "$EDITOR_RC" "$FALLBACK_WRITER_MODEL" >&2
  cp "$EDITOR_INPUT_BACKUP" "$BATCH"
  rm -f "${BATCH%.json}.editor-complete.json"
  if ! timeout --signal=TERM --kill-after=15s 600s \
    bash "$REPO/scripts/run-news-editor.sh" "$FALLBACK_WRITER_MODEL" "$BATCH" "$REPO" 45 9>&-; then
    fail_run "both primary and fallback Albanian editors failed before verification"
  fi
fi

stage="editor-completion-check"
"$PYTHON_BIN" scripts/editor_completion.py verify "$BATCH"
rm -f "$EDITOR_INPUT_BACKUP"

stage="normalize-edited-copy"
"$PYTHON_BIN" scripts/codex_automation_support.py normalize --file "$BATCH"

# Give the editor concrete gate feedback before the destructive originality
# pass prunes otherwise repairable drafts. Keep the actual gates unchanged.
stage="editorial-repair"
for repair_attempt in 1 2; do
  CHECK_BATCH="$(mktemp /tmp/383-originality-check.XXXXXX.json)"
  cp "$BATCH" "$CHECK_BATCH"
  ORIGINALITY_FEEDBACK="$("$PYTHON_BIN" scripts/originality_gate.py --file "$CHECK_BATCH" --evidence "${BATCH%.json}.editor-sources.json" 2>&1 || true)"
  rm -f "$CHECK_BATCH"
  CHECK_BATCH="$(mktemp /tmp/383-journalism-check.XXXXXX.json)"
  cp "$BATCH" "$CHECK_BATCH"
  JOURNALISM_FEEDBACK="$("$PYTHON_BIN" scripts/journalism_quality_gate.py --file "$CHECK_BATCH" 2>&1 || true)"
  rm -f "$CHECK_BATCH"
  TOPIC_FEEDBACK="$("$PYTHON_BIN" scripts/topic_selection_gate.py --file "$BATCH" --evidence "${BATCH%.json}.editor-sources.json" 2>&1 || true)"
  if grep -q '^Traceback' <<< "$TOPIC_FEEDBACK"; then
    printf '%s\n' "$TOPIC_FEEDBACK" >&2
    fail_run "topic gate runtime error; editorial repair cannot resolve an infrastructure failure"
  fi
  if ! grep -q '^REJECTED originality\|^ORIGINALITY failed' <<< "$ORIGINALITY_FEEDBACK" &&
     ! grep -q '^REJECTED journalism\|^JOURNALISM failed' <<< "$JOURNALISM_FEEDBACK" &&
     ! grep -q '^TOPIC SELECTION V2 failed' <<< "$TOPIC_FEEDBACK"; then
    printf '383 EDITORIAL PREFLIGHT PASS attempt=%s\n' "$repair_attempt"
    break
  fi
  printf '383 EDITORIAL PREFLIGHT REPAIR attempt=%s\n%s\n%s\n%s\n' "$repair_attempt" "$ORIGINALITY_FEEDBACK" "$JOURNALISM_FEEDBACK" "$TOPIC_FEEDBACK"
  REPAIR_BACKUP="$(mktemp /tmp/383-repair.XXXXXX.json)"
  cp "$BATCH" "$REPAIR_BACKUP"
  trap - ERR
  set +e
  timeout --signal=TERM --kill-after=15s 420s \
    /opt/hermes/.venv/bin/hermes chat --provider "${L383_WRITER_PROVIDER:-openai-codex}" \
      --model "$EDITOR_MODEL" --safe-mode -t file --yolo --max-turns 35 -Q -q \
      "Repair only ${BATCH} using docs/albanian_newsroom.md, docs/news-output-schema.json, and ${BATCH%.json}.editor-sources.json. The wrapper found these exact defects: ${ORIGINALITY_FEEDBACK} ${JOURNALISM_FEEDBACK} ${TOPIC_FEEDBACK}. For each overlapping body sentence, check the original source and rewrite the entire sentence in natural Albanian with a different structure, while preserving only facts supported by both independently fetched sources. Every retained body must still contain at least 220 readable Albanian words, at least four readable HTML paragraphs, and explicit named source attribution; never meet the floor with repetition or invented claims. Fix title WHO and concrete STAKE defects with specific, evidenced subjects and actions. Keep all candidates that can be repaired truthfully; remove only unverified stories. Do not invent facts, pad length, change source URLs, publish, deploy, run validators, or touch another file. Save the corrected JSON to ${BATCH} before responding." 9>&-
  REPAIR_RC=$?
  set -e
  trap on_error ERR
  if [ "$REPAIR_RC" -ne 0 ] || ! "$PYTHON_BIN" -c 'import json,sys; rows=json.load(open(sys.argv[1],encoding="utf-8")); assert isinstance(rows,list) and len(rows)>0' "$BATCH" >/dev/null 2>&1; then
    cp "$REPAIR_BACKUP" "$BATCH"
    rm -f "$REPAIR_BACKUP"
    printf '383 EDITORIAL REPAIR interrupted or invalid; restored valid drafts and continuing with per-candidate gates\n' >&2
    break
  fi
  rm -f "$REPAIR_BACKUP"
  "$PYTHON_BIN" scripts/codex_automation_support.py normalize --file "$BATCH"
done

stage="originality-gate"
"$PYTHON_BIN" scripts/originality_gate.py --file "$BATCH" --evidence "${BATCH%.json}.editor-sources.json"

stage="journalism-gate"
"$PYTHON_BIN" scripts/journalism_quality_gate.py --file "$BATCH"

stage="dedupe"
"$PYTHON_BIN" scripts/codex_automation_support.py dedupe-published --prune --file "$BATCH"

stage="topic-selection-v2"
"$PYTHON_BIN" scripts/topic_selection_gate.py --prune --file "$BATCH" --evidence "${BATCH%.json}.editor-sources.json"

stage="structural-isolation"
if ! "$PYTHON_BIN" scripts/isolate_valid_news_candidates.py --file "$BATCH"; then
  fail_run "no individually valid article remains after structural checks"
fi

stage="batch-validation"
if ! "$PYTHON_BIN" scripts/codex_automation_support.py validate --file "$BATCH"; then
  fail_run "remaining candidates did not meet the batch quality floor after per-candidate isolation"
fi

stage="source-mix"
"$PYTHON_BIN" scripts/validate_source_mix.py --file "$BATCH"

# The hourly job changes Supabase rows, not application code. Website builds
# remain in GitHub/Railway CI; publication checks and live readback remain here.

# Application deployment belongs exclusively to Railway GitHub integration.
# This worker publishes validated news rows and never uploads website code.
stage="deployment-verification"
if [ "$QA_ONLY" != "1" ]; then verify_deployment; fi

if [ "$QA_ONLY" = "1" ]; then
  "$PYTHON_BIN" scripts/news_quality_report.py --file "$BATCH" --status qa || printf "383 quality metrics unavailable\n" >&2
  stage="qa-complete"
  record_state qa_complete
  printf '383 QA SUCCESS batch=%s\n' "$BATCH"
  exit 0
fi

stage="supabase-publication"
"$PYTHON_BIN" scripts/codex_automation_support.py publish-supabase --file "$BATCH"
record_state published
SLUG="$("$PYTHON_BIN" -c "import json; print(json.load(open('$BATCH', encoding='utf-8'))[0]['slug'])")"
URL="https://www.383ks.com/article/${SLUG}?verify=${STAMP}"

stage="news-cache-refresh"
"$PYTHON_BIN" scripts/codex_automation_support.py refresh-news-pages --file "$BATCH"
stage="live-readback"
while IFS= read -r verified_slug; do
  STATUS="$(curl -L -sS --max-time 45 -o /tmp/383-live.html -w '%{http_code}' "https://383ks.com/article/${verified_slug}?verify=${STAMP}")"
  test "$STATUS" = 200
  grep -Fq "$verified_slug" /tmp/383-live.html
done < <("$PYTHON_BIN" -c 'import json,sys; print("\n".join(a["slug"] for a in json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH")
printf '383 LIVE READBACK: every published article returned HTTP 200 with its slug\n'

"$PYTHON_BIN" scripts/news_quality_report.py --file "$BATCH" --status published || printf "383 quality metrics unavailable\n" >&2

record_state published

stage="report-delivery"
if ! "$PYTHON_BIN" scripts/codex_automation_support.py send-report --file "$BATCH"; then
  printf '383 REPORT DELIVERY FAILED batch=%s: publication and live verification completed but no report was delivered.\n' "$BATCH" >&2
  record_state published
  exit 76
fi

stage="complete"
record_state complete
printf '383 PRODUCTION SUCCESS batch=%s live=%s\n' "$BATCH" "$URL"
