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
      printf "383 FAILURE LOGGED: 55-minute deadline exceeded; publication state retained for diagnosis\n" >&2
    fi
  fi
  exit "$deadline_rc"
fi

REPO="${L383_REPO:-/opt/data/workspaces/383lajme}"
PYTHON_BIN="${L383_PYTHON_BIN:-/opt/data/workspaces/383lajme/.venv/bin/python}"
QA_ONLY="${L383_QA_ONLY:-0}"
cd -P "$REPO"
REPO="$PWD"
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
# One originality receipt for the hour: refill rounds review their own temporary
# batches, and the published batch is verified against every round's approvals.
export L383_REVIEW_RECEIPT="${BATCH%.json}.copyright-review.json"
# Drafts the reviewer rejects this hour, with its reasons, get one rewrite; a
# story rejected twice in a day rests for a day (owner's decision 2026-10-17).
export L383_REVIEW_REJECTED="${BATCH%.json}.copyright-rejected.json"
rm -f "$L383_REVIEW_REJECTED"
if [ "$QA_ONLY" = "1" ]; then
  export L383_REJECTION_LEDGER="/opt/data/qa/383/copyright-rejections.json"
else
  export L383_REJECTION_LEDGER="$PWD/.last30days/copyright-rejections.json"
fi
# All model work uses the dedicated Codex OAuth home at max effort.
export L383_WRITER_PROVIDER=openai-codex
export L383_WRITER_MODEL=gpt-6-luna
export L383_EDITOR_MODEL=gpt-6-luna
export L383_WRITER_FALLBACK_MODEL=gpt-6-luna
export HERMES_CODEX_EVENT_STALE_TIMEOUT_SECONDS=300
export HERMES_CODEX_TTFB_TIMEOUT_SECONDS=300
export HERMES_CODEX_TTFB_MAX_SECONDS=300
printf '383 MODEL CONTRACT: gpt-6-luna max through Codex OAuth; no API fallback\n'
LOCK_FILE=/tmp/383-production.lock
START_EPOCH="$(date +%s)"
# Stop model work at minute 50, leaving five minutes for verified publication.
export L383_MODEL_DEADLINE_EPOCH="$((START_EPOCH + 3000))"
stage="initialization"
alerting=0
if [ "$QA_ONLY" = "1" ]; then
  STATE_ROOT="${L383_STATE_ROOT:-/opt/data/qa/383/hourly-runs}"
else
  STATE_ROOT="${L383_STATE_ROOT:-/opt/data/news-pipeline-state/hourly-runs}"
fi
STATE="$STATE_ROOT/${STAMP}-mode${QA_ONLY}.json"
export L383_NOTES_CACHE="${STATE_ROOT%/hourly-runs}/reporter-notes-cache.json"
export L383_PHOTO_IDENTITY_CACHE="${STATE_ROOT%/hourly-runs}/photo-identity-cache.json"
LEGACY_STATE="$PWD/.last30days/hourly-runs/${STAMP}-mode${QA_ONLY}.json"
record_state() { "$PYTHON_BIN" scripts/news_run_state.py save "$STATE" --status "$1" --stage "$stage" --batch "$BATCH"; }

alert_failure() {
  local reason="$1"
  if [ "$QA_ONLY" = "1" ]; then
    printf '383 QA FAILURE ALERT SUPPRESSED: %s\n' "$reason" >&2
    return 0
  fi
  printf "383 FAILURE LOGGED: %s\n" "$reason" >&2
}

# The ChatGPT account's usage limit (HTTP 429) since this run started: every
# model call fails, so the hour has no news rather than a broken pipeline.
quota_hit() {
  local since
  since="$(date -u -d "@$START_EPOCH" '+%Y-%m-%d %H:%M:%S')"
  awk -v s="$since" 'substr($0, 1, 19) >= s && /usage limit has been reached/ {found = 1} END {exit !found}' \
    "${L383_HERMES_HOME:-${HERMES_HOME:-/opt/data/news-pipeline-hermes}}/logs/errors.log" 2>/dev/null
}

fail_run() {
  local reason="$1"
  trap - ERR
  # Not inside review_extra: there a non-zero exit is what keeps the
  # approved drafts.
  if [ "${IN_EXTRA_REVIEW:-0}" != "1" ] && quota_hit; then
    stage="model-quota"
    record_state no_news
    printf '383 MODEL QUOTA: the ChatGPT usage limit is reached; no articles this hour (%s)\n' "$reason"
    exit 0
  fi
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
if "$PYTHON_BIN" scripts/news_run_state.py check "$STATE" || "$PYTHON_BIN" scripts/news_run_state.py check "$LEGACY_STATE"; then
  printf "383 SLOT ALREADY PUBLISHED: %s; refusing duplicate writer/publication\n" "$STAMP"
  exit 0
fi
record_state running

stage="writer-auth-preflight"
/opt/hermes/.venv/bin/python scripts/configure_news_model.py --home "$HERMES_HOME" --effort max
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
  "$PYTHON_BIN" scripts/codex_automation_support.py send-status-report --phase started --message "Pipeline u nis për orarin e shënuar dhe kaloi kontrollet e autentikimit, faqes dhe bazës së të dhënave. Po ekzekutohet me GPT-6 Luna, max effort. Raporti përfundimtar do të listojë artikujt e publikuar."
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
# Reserve five minutes for the grouped writers before their minute-25 deadline.
# Scope this preparation-model deadline to the child; later editorial calls keep
# the run's minute-50 limit. Slow notes must not consume the writing window.
env L383_MODEL_DEADLINE_EPOCH="$((START_EPOCH + 1200))" \
  "$PYTHON_BIN" scripts/prepare_editor_sources.py "$DISCOVERY" --discovery

# Prepared inventory includes readable, lane-locked source text and decoded images.
# Sensitive claims still require an independently readable second publisher.
L383_TARGET_ARTICLES="$("$PYTHON_BIN" -c 'import json,os,sys; p=json.load(open(sys.argv[1],encoding="utf-8"))["publication_plan"]; print(min(20,int(os.environ.get("L383_MAX_ARTICLES", "20")),sum(p.values())))' "${DISCOVERY%.md}.json")"
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
printf 'HOURLY NEWS TARGET: up to %s source-ready articles across all available categories\n' "$L383_TARGET_ARTICLES"
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
ATTEMPTED="$BATCH.attempted-urls.json"
rm -f "$BATCH" "$ATTEMPTED"
stage="writer-brief"
WRITER_BRIEF="$PWD/.last30days/news-writer-brief-current.md"
if ! "$PYTHON_BIN" scripts/news_writer_brief.py "${DISCOVERY%.md}.json" "$WRITER_BRIEF"; then
  fail_run "prepared writing brief is unavailable or invalid"
fi
stage="writer"
export HERMES_HOME="${L383_HERMES_HOME:-/opt/data/news-pipeline-hermes}"
# The provider may legitimately pause for more than 12 seconds between SSE
# frames while drafting. Do not classify that normal prefill as a dead stream.
# Keep the max-effort watchdog settings established before discovery.

# Never start a model call with more time than its phase and publication reserve.
model_budget() {
  local cap="$1" phase_end="${2:-3000}" remaining
  remaining=$((START_EPOCH + phase_end - $(date +%s)))
  if [ "$remaining" -le 0 ]; then return 75; fi
  if [ "$remaining" -lt "$cap" ]; then printf '%s' "$remaining"; else printf '%s' "$cap"; fi
}
track_attempted() {
  "$PYTHON_BIN" - "$BATCH" "$ATTEMPTED" <<'PY'
import json, sys
from pathlib import Path
batch, target = map(Path, sys.argv[1:])
old = json.loads(target.read_text(encoding="utf-8")) if target.exists() else []
rows = json.loads(batch.read_text(encoding="utf-8"))
target.write_text(json.dumps(sorted(set(old) | {a["url"] for a in rows})), encoding="utf-8")
PY
}
batch_count() { "$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH"; }
refresh_merged_evidence() {
  "$PYTHON_BIN" scripts/prepare_editor_sources.py "$BATCH"
  if [ "$(batch_count)" -gt 0 ]; then
    "$PYTHON_BIN" scripts/editor_completion.py acknowledge "$BATCH"
  else
    rm -f "${BATCH%.json}.editor-complete.json"
  fi
}

run_writer() {
  local model="$1" writer_budget
  writer_budget="$(model_budget "${L383_WRITER_ATTEMPT_TIMEOUT:-600}" 1500)" || return 75
  timeout --signal=TERM --kill-after=15s "$((writer_budget + 5))s" \
    env HERMES_HOME="${L383_HERMES_HOME:-/opt/data/news-pipeline-hermes}" L383_MODEL_CALL_TIMEOUT="$writer_budget" \
    "$PYTHON_BIN" scripts/news_model_response.py --batch "${WRITER_BATCH:-$BATCH}" --mode replace -- /opt/hermes/.venv/bin/hermes chat \
      --provider "${L383_WRITER_PROVIDER:-openai-codex}" \
      --model "$model" --ignore-rules -t file --yolo \
      --max-turns "${L383_WRITER_MAX_TURNS:-35}" -Q -q \
      "${WRITER_SCOPE:-}Prepare articles for ${BATCH} from today's prepared evidence. Read docs/albanian_newsroom.md, docs/news-output-schema.json, and ${WRITER_BRIEF}. The writing brief contains category allocations, ready story IDs and complete inline reporter notes. Use only ready stories. Write ONLY from the inline notes and never open source originals when notes are supplied: compose 383's own article, lead and headline from the facts. Only a story explicitly marked notes unavailable may use its verified-evidence fallback file. Notes may be raw, scrambled fragments of the source; never reuse a fragment's wording, restate every fact in your own Albanian sentences and choose your own order. Routine reporting may use one readable registered publisher as factual evidence with corroborating_sources=[]; sensitive allegations require the supplied independently readable second source. The prepared photo's subject must be a main subject of your headline or opening paragraph, not just a later mention in a roundup. Use an evidenced angle centered on that subject, or choose another ready story; never imply a photo shows a different company, person or product. Read docs/news-ranking-rubric.md and assign individual evidence-based score_breakdown values and a specific score_reason; never copy a neutral all-5 template or calculate the weighted total. The normalizer computes scores, reading time and city. Keep source URLs fixed. Write as many distinct eligible stories as the evidence supports, up to ${L383_TARGET_ARTICLES:-20} total; do not stop after one strong article. Do not edit any files. Return the complete article array in your final response between the literal markers 383_JSON_BEGIN and 383_JSON_END. The wrapper saves it. Every article needs its discovery category, deterministic city for local lanes, the prepared primary URL, supplied corroborating source when present, no image fields (the pipeline restores the prepared photo by source URL; judge only that image_subject fits the story), at least 140 grounded Albanian words in three HTML paragraphs, and all schema fields. Prefer 220+ words when the source supports that depth. Never pad a brief. The image is already verified outside your model call; do not fetch, decode or research images again. Read every inline note; only an explicit notes-unavailable fallback may open its evidence file; terminal commands, tests and builds are unavailable and unnecessary. Write from a fact outline in original 383 prose, with a new lead and structure; do not closely translate source prose or imply firsthand reporting. Preserve uncertainty and attribute claims to the speaking person or institution, never to a news outlet; never invent facts, local impact, quotes, images, or sources. Every publisher and corroborating publisher is locked to its category by scripts/news_sources.json. In the first drafting call, include at least one story from EVERY available category before adding extras. Follow the publication_plan counts across continuations; prioritize missing categories over more Botë stories; Ekonomi includes US stocks, Wall Street and crypto. Prioritize documented local public controversies. Never change a discovery category or use an unregistered source. Do not run pipeline scripts, discover extra stories, repository-wide tests, publish, deploy, email, or write any other file. Do not write files. Return the complete JSON array between 383_JSON_BEGIN and 383_JSON_END." 9>&-
}

WRITER_RC=0
PRIMARY_WRITER_MODEL=gpt-6-luna
EDITOR_MODEL=gpt-6-luna
FALLBACK_WRITER_MODEL=gpt-6-luna
printf '383 WRITER: provider=%s primary=%s fallback=%s max_turns=%s timeout=%ss\n' \
  "${L383_WRITER_PROVIDER:-openai-codex}" "$PRIMARY_WRITER_MODEL" "$FALLBACK_WRITER_MODEL" \
  "${L383_WRITER_MAX_TURNS:-35}" "${L383_WRITER_ATTEMPT_TIMEOUT:-300}"
# Avoid an all-at-once 20-story request. Draft at most seven per call, then
# extend the same batch while preserving the existing sources and time budget.
FULL_TARGET="$L383_TARGET_ARTICLES"
L383_TARGET_ARTICLES="$((FULL_TARGET < 7 ? FULL_TARGET : 7))"
# Ten or more ready stories: draft the three desk groups concurrently.
# Each group receives the sum of its actual desk allocations, including eight
# for Sport/Technology/Showbiz when all three have available inventory.
run_writer_groups() {
  local folder group desks
  folder="$(mktemp -d /tmp/383-writer-groups.XXXXXX)"
  group=0
  for desks in "Kosovë, Shqipëri" "Botë, Ekonomi" "Sport, Teknologji, Showbiz"; do
    group=$((group + 1))
    (
      WRITER_BATCH="$folder/$group.json"
      L383_TARGET_ARTICLES="$("$PYTHON_BIN" -c 'import json,sys; p=json.load(open(sys.argv[1],encoding="utf-8"))["publication_plan"]; print(sum(p.get(c.strip(),0) for c in sys.argv[2].split(",")))' "${DISCOVERY%.md}.json" "$desks")"
      if [ "$L383_TARGET_ARTICLES" -eq 0 ]; then exit 0; fi
      WRITER_SCOPE="This call covers ONLY these categories: ${desks}. Write only their ready stories, following their publication_plan counts, up to ${L383_TARGET_ARTICLES} articles; ignore every other category, including the every-category rule below. "
      WRITER_BRIEF="$folder/$group-brief.md"
      "$PYTHON_BIN" scripts/news_writer_brief.py "${DISCOVERY%.md}.json" "$WRITER_BRIEF" --categories "$desks" || exit 1
      run_writer "$PRIMARY_WRITER_MODEL"
    ) > "$folder/$group.log" 2>&1 &
  done
  wait || true
  tail -n 3 "$folder"/*.log || true
  "$PYTHON_BIN" scripts/news_refill.py groups "$folder" "$BATCH"
}
if [ "$FULL_TARGET" -ge 10 ]; then
  if run_writer_groups; then WRITER_RC=0; else WRITER_RC=$?; fi
elif run_writer "$PRIMARY_WRITER_MODEL"; then
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
track_attempted
COVERAGE_DEFICITS="$("$PYTHON_BIN" scripts/news_coverage.py "$BATCH" "${DISCOVERY%.md}.json" --balance)"
BATCH_COUNT="$("$PYTHON_BIN" -c 'import json,sys; d=json.load(open(sys.argv[1], encoding="utf-8")); a=d.get("articles", d) if isinstance(d, dict) else d; print(len(a) if isinstance(a, list) else 0)' "$BATCH")"
if [ "$BATCH_COUNT" -lt 1 ]; then
  fail_run "writer produced no verified article candidates"
fi

# Continue a fresh batch in bounded seven-story increments. Reserve at least
# 25 minutes of the 55-minute deadline for editing, gates, and publication.
stage="writer-continuation"
CONTINUATION_FAILURES=0
for continuation in {1..15}; do
  if [ "$BATCH_COUNT" -ge "$L383_TARGET_ARTICLES" ]; then
    break
  fi
  # On 2026-10-12 drafting until minute 33 left 16 drafts the hour could not
  # finish. Editor and review run in parallel chunks. All drafting calls share the
  # minute-25 deadline, including the time spent preparing evidence.
  if [ "$(( $(date +%s) - START_EPOCH ))" -ge 1500 ]; then
    printf '383 WRITER CONTINUATION time budget reached; editing current drafts\n'
    break
  fi
  printf '383 WRITER CONTINUATION attempt=%s drafted=%s source_ready_target=%s\n' \
    "$continuation" "$BATCH_COUNT" "$L383_TARGET_ARTICLES"
  CONTINUATION_BACKUP="$(mktemp /tmp/383-continuation.XXXXXX.json)"
  cp "$BATCH" "$CONTINUATION_BACKUP"
  L383_TARGET_ARTICLES="$((BATCH_COUNT + 7 < FULL_TARGET ? BATCH_COUNT + 7 : FULL_TARGET))"
  continuation_budget="$(model_budget 600 1500)" || break
  if ! timeout --signal=TERM --kill-after=15s "$((continuation_budget + 5))s" \
    env L383_MODEL_CALL_TIMEOUT="$continuation_budget" "$PYTHON_BIN" scripts/news_model_response.py --batch "$BATCH" --mode append -- /opt/hermes/.venv/bin/hermes chat --provider "${L383_WRITER_PROVIDER:-openai-codex}" \
      --model "$PRIMARY_WRITER_MODEL" --ignore-rules -t file --yolo \
      --max-turns 45 -Q -q \
      "Continue the existing ${BATCH}; do not replace, remove, or edit its current articles. Read docs/albanian_newsroom.md, docs/news-output-schema.json, ${WRITER_BRIEF}, and the existing batch. Its current ${BATCH_COUNT} drafts are not the full source-ready inventory of ${L383_TARGET_ARTICLES}. The prepared photo's subject must be a main subject of your headline or opening paragraph, not just a later mention in a roundup. Use an evidenced angle centered on that subject, or choose another ready story; never imply a photo shows a different company, person or product. Read docs/news-ranking-rubric.md and rate every new story individually from evidence; supply all factors and a concrete Albanian score_reason. Do not copy neutral defaults or calculate the total. Use the publication plan in the writing brief to count current category coverage. Write only from its inline reporter notes; do not open source originals when notes are supplied. FIRST fill every missing category, THEN each category allocation, before adding extras. Add distinct ready stories up to ${L383_TARGET_ARTICLES} total. Skip every primary or corroborating URL already used in the batch. Every new article uses its prepared primary evidence and no image fields (the pipeline restores the prepared photo by source URL), 140+ grounded Albanian words in three HTML paragraphs, all schema fields and a title naming WHO and STAKE. Routine news may have corroborating_sources=[]; sensitive claims need the supplied independent second publisher. Do not research or decode images again. Do not fabricate or pad stories. Do not edit files. Return ONLY the new articles as a JSON array between 383_JSON_BEGIN and 383_JSON_END; exclude all existing articles because the wrapper appends your new drafts while preserving every existing field. Do not run pipeline scripts, npm, repository tests or builds, publish, deploy, send reports, or write another file. This is a data-only writing task; code-release checks are not part of it." 9>&-; then
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
  track_attempted
  COVERAGE_DEFICITS="$("$PYTHON_BIN" scripts/news_coverage.py "$BATCH" "${DISCOVERY%.md}.json" --balance)"
  NEXT_COUNT="$("$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH")"
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
printf '383 CATEGORY DEFICITS: %s\n' "$COVERAGE_DEFICITS"

review_candidates() {
local editorial_phase_end=2580
if [ "${IN_EXTRA_REVIEW:-0}" = "1" ]; then
  editorial_phase_end=2880  # Keep two minutes for independent review before minute 50.
fi
stage="normalize"
"$PYTHON_BIN" scripts/codex_automation_support.py normalize --file "$BATCH"

stage="editor-source-fetch"
"$PYTHON_BIN" scripts/prepare_editor_sources.py "$BATCH"

if [ -n "${STATE_ROOT:-}" ] && [ "${IN_EXTRA_REVIEW:-0}" != "1" ]; then
  "$PYTHON_BIN" - "$BATCH" "${BATCH%.json}.editor-sources.json" "$STATE_ROOT/${STAMP}-mode${QA_ONLY}-writer-snapshot.json" <<'PY'
import json, os, sys, tempfile
from pathlib import Path
try:
    target = Path(sys.argv[3])
    target.parent.mkdir(parents=True, exist_ok=True)
    snapshot = {"articles": json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")),
                "evidence": json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))}
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, delete=False) as output:
        temporary = Path(output.name)
        json.dump(snapshot, output, ensure_ascii=False)
    os.replace(temporary, target)
    print("383 WRITER SNAPSHOT saved outside publication data")
except (OSError, ValueError):
    print("383 WRITER SNAPSHOT unavailable; authoritative evidence checks remain required")
PY
fi

stage="albanian-editor"
EDITOR_CHECK="$(mktemp /tmp/383-editor-originality.XXXXXX.json)"
cp "$BATCH" "$EDITOR_CHECK"
export L383_EDITOR_GATE_FEEDBACK="$("$PYTHON_BIN" scripts/originality_gate.py --file "$EDITOR_CHECK" --evidence "${BATCH%.json}.editor-sources.json" 2>&1 || true)"
rm -f "$EDITOR_CHECK"
EDITOR_INPUT_BACKUP="$(mktemp /tmp/383-editor-input.XXXXXX.json)"
cp "$BATCH" "$EDITOR_INPUT_BACKUP"
rm -f "${BATCH%.json}.editor-complete.json"
if ! editor_budget="$(model_budget 900 "$editorial_phase_end")"; then
  printf '[]\n' > "$BATCH"
  rm -f "$EDITOR_INPUT_BACKUP"
  return 0
fi
trap - ERR
set +e
timeout --signal=TERM --kill-after=15s "$((editor_budget + 5))s" env L383_MODEL_DEADLINE_EPOCH="$(( $(date +%s) + editor_budget ))" L383_MODEL_CALL_TIMEOUT="$editor_budget" \
  bash "$REPO/scripts/run-news-editor-parallel.sh" "$EDITOR_MODEL" "$BATCH" "$REPO" "${L383_EDITOR_MAX_TURNS:-30}" 9>&-

EDITOR_RC=$?
set -e
trap on_error ERR
if [ "$EDITOR_RC" -eq 0 ] && [ "$(batch_count)" -eq 0 ]; then
  rm -f "$EDITOR_INPUT_BACKUP"
  return 0
fi
if [ "$EDITOR_RC" -ne 0 ] || ! "$PYTHON_BIN" scripts/editor_completion.py verify "$BATCH" >/dev/null 2>&1; then
  printf '383 EDITOR RETRY: primary=%s rc=%s or completion missing; restoring original drafts for fallback=%s\n' "$EDITOR_MODEL" "$EDITOR_RC" "$FALLBACK_WRITER_MODEL" >&2
  cp "$EDITOR_INPUT_BACKUP" "$BATCH"
  rm -f "${BATCH%.json}.editor-complete.json"
  if ! editor_budget="$(model_budget 600 "$editorial_phase_end")"; then
    printf '[]\n' > "$BATCH"
    rm -f "$EDITOR_INPUT_BACKUP"
    return 0
  fi
  if ! timeout --signal=TERM --kill-after=15s "$((editor_budget + 5))s" env L383_MODEL_DEADLINE_EPOCH="$(( $(date +%s) + editor_budget ))" L383_MODEL_CALL_TIMEOUT="$editor_budget" \
    bash "$REPO/scripts/run-news-editor-parallel.sh" "$FALLBACK_WRITER_MODEL" "$BATCH" "$REPO" 45 9>&-; then
    # Inside review_extra the caller keeps the approved drafts. In the first
    # round nothing is approved yet: an editor that verified none of the
    # drafts (the usual cause, e.g. a story resting on one outlet's own
    # reporting) is an hour without news, not a failed run.
    if [ "${IN_EXTRA_REVIEW:-0}" = "1" ]; then
      fail_run "both primary and fallback Albanian editors failed before verification"
    fi
    printf '[]\n' > "$BATCH"
    rm -f "$EDITOR_INPUT_BACKUP"
    return 0
  fi
fi

if [ "$(batch_count)" -eq 0 ]; then
  rm -f "$EDITOR_INPUT_BACKUP"
  return 0
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
  if [ "$repair_attempt" -gt 1 ] && [ "$(( $(date +%s) - START_EPOCH ))" -ge "$editorial_phase_end" ]; then
    printf '383 EDITORIAL REPAIR skipped: keeping time for review and publication\n'
    break
  fi
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
  repair_budget="$(model_budget 420 "$editorial_phase_end")" || break
  REPAIR_BACKUP="$(mktemp /tmp/383-repair.XXXXXX.json)"
  cp "$BATCH" "$REPAIR_BACKUP"
  trap - ERR
  set +e
  timeout --signal=TERM --kill-after=15s "$((repair_budget + 5))s" \
    env L383_MODEL_CALL_TIMEOUT="$repair_budget" "$PYTHON_BIN" scripts/news_model_response.py --batch "$BATCH" --mode editor -- /opt/hermes/.venv/bin/hermes chat --provider "${L383_WRITER_PROVIDER:-openai-codex}" \
      --model "$EDITOR_MODEL" --ignore-rules -t file --yolo --max-turns 35 -Q -q \
      "Repair only the defective articles in ${BATCH}. The wrapper preserves every unaffected draft unchanged; omit those passing drafts from your response. Use docs/albanian_newsroom.md, docs/news-output-schema.json, and ${BATCH%.json}.editor-sources.md. Read all wrapped evidence, continuing with offset if paginated. The wrapper found these exact defects: ${ORIGINALITY_FEEDBACK} ${JOURNALISM_FEEDBACK} ${TOPIC_FEEDBACK}. For each overlapping body sentence, check the original source and rewrite the entire sentence in natural Albanian with a different structure, while preserving only facts supported by the fetched primary and any supplied corroborating source. Every retained body must still contain at least 140 readable Albanian words, at least three readable HTML paragraphs, and necessary attribution only for quotes, exclusive reporting or unconfirmed claims; never meet the floor with repetition or invented claims. Fix title WHO and concrete STAKE defects with specific, evidenced subjects and actions. Keep all candidates that can be repaired truthfully; remove only unverified stories. Do not invent facts, pad length, change source URLs, publish, deploy, run validators, or touch another file. Do not edit files. Return ONLY the repaired articles as a JSON array between 383_JSON_BEGIN and 383_JSON_END; omit unaffected articles and return [] if every defective article must be dropped." 9>&-
  REPAIR_RC=$?
  set -e
  trap on_error ERR
  if [ "$REPAIR_RC" -ne 0 ] || ! "$PYTHON_BIN" -c 'import json,sys; rows=json.load(open(sys.argv[1],encoding="utf-8")); assert isinstance(rows,list)' "$BATCH" >/dev/null 2>&1 ||
     ! "$PYTHON_BIN" scripts/news_repair_preserve.py "$REPAIR_BACKUP" "$BATCH" "${BATCH%.json}.editor-sources.json"; then
    cp "$REPAIR_BACKUP" "$BATCH"
    rm -f "$REPAIR_BACKUP"
    printf '383 EDITORIAL REPAIR interrupted or invalid; restored valid drafts and continuing with per-candidate gates\n' >&2
    break
  fi
  if [ "$(batch_count)" -eq 0 ]; then rm -f "$REPAIR_BACKUP"; return 0; fi
  "$PYTHON_BIN" scripts/normalize-news-editor-identity.py "$REPAIR_BACKUP" "$BATCH"
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
"$PYTHON_BIN" scripts/topic_selection_gate.py --prune --file "$BATCH" --evidence "${BATCH%.json}.editor-sources.json" || { test "$("$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH")" = 0; }

stage="structural-isolation"
if ! "$PYTHON_BIN" scripts/isolate_valid_news_candidates.py --file "$BATCH"; then
  printf "383 REFILL NEEDED: no individually valid article remains after structural checks\n"
fi

# Review each round as it passes the gates, so the refill loop replaces what
# the independent reviewer rejects instead of the whole hour failing at the end.
stage="independent-originality-review-round"
"$PYTHON_BIN" scripts/news_copyright_review.py --file "$BATCH" ||
  printf '383 ROUND REVIEW unavailable; the final review will decide these articles\n'

}

# A second-round batch (rewrites, refills) that the editor empties or fails
# must cost only itself: at 14:00 on 18 Oct the editor rightly refused the one
# rewrite and the run failed, throwing away the article already approved.
# It must also end by minute 50: at 22:00 on 18 Oct a rewrite round's
# editorial repair ran into the 55-minute kill and the four approved articles
# were lost with it. Past the budget the round is stopped, tree and all.
EXTRA_REVIEW_END=3000
kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null || true
}
review_extra() {
  local budget=$(( EXTRA_REVIEW_END - ($(date +%s) - START_EPOCH) ))
  if [ "$budget" -lt 240 ]; then
    printf '383 EXTRA REVIEW: %s round skipped, %ss left before minute 50; keeping the approved drafts only\n' "$1" "$budget"
    printf '[]\n' > "$BATCH"
    return 0
  fi
  trap - ERR
  set +e
  ( set -e; trap on_error ERR; IN_EXTRA_REVIEW=1; review_candidates ) &
  local pid=$! waited=0
  while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt "$budget" ]; do
    sleep 5
    waited=$((waited + 5))
  done
  if kill -0 "$pid" 2>/dev/null; then
    printf '383 EXTRA REVIEW: %s round stopped at minute 50\n' "$1"
    kill_tree "$pid"
  fi
  wait "$pid"
  local rc=$?
  set -e
  trap on_error ERR
  if [ "$rc" -ne 0 ]; then
    printf '383 EXTRA REVIEW: %s round failed (rc=%s); keeping the approved drafts only\n' "$1" "$rc"
    printf '[]\n' > "$BATCH"
  fi
}

track_attempted
review_candidates

for refill_attempt in 1 2; do
  APPROVED_COUNT="$("$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH")"
  if [ "$APPROVED_COUNT" -ge "$FULL_TARGET" ] || [ "$(( $(date +%s) - START_EPOCH ))" -ge 2520 ]; then break; fi
  COVERAGE_DEFICITS="$("$PYTHON_BIN" scripts/news_coverage.py "$BATCH" "${DISCOVERY%.md}.json" --attempted "$ATTEMPTED")"
  if ! "$PYTHON_BIN" -c 'import json,sys; d=json.load(open(sys.argv[1],encoding="utf-8")); used=set(json.load(open(sys.argv[2],encoding="utf-8"))); deficits=json.loads(sys.argv[3]); assert any(a["url"] not in used and deficits.get(a["category"],0)>0 for a in d["ready_leads"])' "${DISCOVERY%.md}.json" "$ATTEMPTED" "$COVERAGE_DEFICITS" 2>/dev/null; then
    printf '383 REFILL: no unused source-ready candidates for missing categories\n'
    break
  fi
  stage="replacement-writer"
  printf '383 APPROVED REFILL: approved=%s target=%s deficits=%s attempt=%s\n' "$APPROVED_COUNT" "$FULL_TARGET" "$COVERAGE_DEFICITS" "$refill_attempt"
  REFILL_BACKUP="$(mktemp /tmp/383-refill.XXXXXX.json)"
  cp "$BATCH" "$REFILL_BACKUP"
  REFILL_BRIEF="$(mktemp /tmp/383-refill-brief.XXXXXX.md)"
  if ! "$PYTHON_BIN" scripts/news_writer_brief.py "${DISCOVERY%.md}.json" "$REFILL_BRIEF" --approved "$REFILL_BACKUP" --attempted "$ATTEMPTED" --limit 7; then
    rm -f "$REFILL_BACKUP" "$REFILL_BRIEF"
    break
  fi
  trap - ERR
  set +e
  refill_budget="$(model_budget 420 2580)" || refill_budget=1
  timeout --signal=TERM --kill-after=15s "$((refill_budget + 5))s" env L383_MODEL_CALL_TIMEOUT="$refill_budget" "$PYTHON_BIN" scripts/news_model_response.py --batch "$BATCH" --mode append -- /opt/hermes/.venv/bin/hermes chat \
    --provider "${L383_WRITER_PROVIDER:-openai-codex}" --model "$PRIMARY_WRITER_MODEL" \
    --ignore-rules -t file --yolo --max-turns 35 -Q -q \
    "Append replacement articles to ${BATCH}, keeping every existing article unchanged. Read ${REFILL_BRIEF}, docs/news-output-schema.json, docs/albanian_newsroom.md and ${ATTEMPTED}. The brief selects at most seven replacements; compose only those stories and its category allocations. Never use a URL in the attempted-urls file: those stories were already considered. Fill these category deficits: ${COVERAGE_DEFICITS}. Stop at ${FULL_TARGET} total articles. Use only unused ready stories, their complete inline reporter notes (explicit evidence fallback only when notes are unavailable), and supplied corroborators. Leave image fields out; the pipeline restores the prepared photo by source URL. The prepared photo's subject must be a main subject of your headline or opening paragraph, not just a later mention in a roundup. Use an evidenced angle centered on that subject, or choose another ready story; never imply a photo shows a different company, person or product. Read docs/news-ranking-rubric.md and individually rate every replacement from evidence with all factors and a specific score_reason; do not copy neutral defaults or calculate the total. Every new article needs at least 140 grounded Albanian words in three HTML paragraphs and necessary claim attribution. Sensitive claims require the independent source; choose another routine story if none is supplied. Do not edit files. Return ONLY the new replacement articles as a JSON array between 383_JSON_BEGIN and 383_JSON_END; exclude the existing articles because the wrapper preserves them locally. This is a data-only task; do not run tests, build, publish, deploy, email or edit any other file." 9>&-
  REFILL_RC=$?
  rm -f "$REFILL_BRIEF"
  set -e
  trap on_error ERR
  if [ "$REFILL_RC" -ne 0 ]; then printf '383 REFILL: writer exited %s; checking saved drafts\n' "$REFILL_RC"; fi
  if ! "$PYTHON_BIN" -c 'import json,sys; old=json.load(open(sys.argv[1],encoding="utf-8")); new=json.load(open(sys.argv[2],encoding="utf-8")); assert isinstance(new,list) and len(new)>len(old); assert {a["url"] for a in old}.issubset({a["url"] for a in new})' "$REFILL_BACKUP" "$BATCH"; then
    cp "$REFILL_BACKUP" "$BATCH"
    rm -f "$REFILL_BACKUP"
    break
  fi
  "$PYTHON_BIN" scripts/news_coverage.py "$BATCH" "${DISCOVERY%.md}.json" --balance --attempted "$ATTEMPTED" --approved "$REFILL_BACKUP"
  track_attempted
  "$PYTHON_BIN" -c 'import json,sys; p=sys.argv[2]; old=json.load(open(p,encoding="utf-8")); new=json.load(open(sys.argv[1],encoding="utf-8")); json.dump(sorted(set(old)|{a["url"] for a in new}),open(p,"w",encoding="utf-8"))' "$BATCH" "$ATTEMPTED"
  # Approved text already passed the editor and every per-article gate. Review
  # only the new replacements; re-editing old copy can reintroduce source text.
  FULL_BATCH="$BATCH"
  REPLACEMENT_FOLDER="$(mktemp -d /tmp/383-refill-review.XXXXXX)"
  REPLACEMENT_BATCH="$REPLACEMENT_FOLDER/${STAMP}.json"
  "$PYTHON_BIN" scripts/news_refill.py split "$REFILL_BACKUP" "$FULL_BATCH" "$REPLACEMENT_BATCH"
  BATCH="$REPLACEMENT_BATCH"
  review_extra refill
  "$PYTHON_BIN" scripts/news_refill.py merge "$REFILL_BACKUP" "$BATCH" "$FULL_BATCH"
  BATCH="$FULL_BATCH"
  refresh_merged_evidence
  rm -f "$REFILL_BACKUP"
done

# After fresh replacements, rewrite only rejected stories that still fit an
# available category slot, from notes, aimed at
# the concrete sentence or fact it named. On 15-16 Oct the reviewer rejected
# about two drafts in three and every one of them was simply lost.
# The first review can finish at minute 40. Optional writing starts before
# minute 42, lasts at most three minutes and ends by minute 45. Every extra
# editorial/review stage still stops at minute 50, preserving publication time.
stage="rewrite-rejected"
if [ -s "$L383_REVIEW_REJECTED" ] && [ "$(( $(date +%s) - START_EPOCH ))" -lt 2520 ]; then
  REWRITE_FOLDER="$(mktemp -d /tmp/383-rewrite.XXXXXX)"
  REWRITE_RAW="$REWRITE_FOLDER/rejected-full.json"
  REWRITE_INPUT="$REWRITE_FOLDER/rejected.json"
  mv "$L383_REVIEW_REJECTED" "$REWRITE_RAW"
  if "$PYTHON_BIN" scripts/news_refill.py rewrite-input "$BATCH" "$REWRITE_RAW" "$REWRITE_INPUT" &&
     "$PYTHON_BIN" -c 'import json,sys; assert json.load(open(sys.argv[1],encoding="utf-8"))' "$REWRITE_INPUT"; then
    REWRITE_BATCH="$REWRITE_FOLDER/${STAMP}.json"
    printf '383 REWRITE REJECTED: %s draft(s)\n' "$("$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$REWRITE_INPUT")"
    trap - ERR
    set +e
    rewrite_budget="$(model_budget 180 2700)" || rewrite_budget=1
    timeout --signal=TERM --kill-after=15s "$((rewrite_budget + 5))s" env L383_MODEL_CALL_TIMEOUT="$rewrite_budget" "$PYTHON_BIN" scripts/news_model_response.py --batch "$REWRITE_BATCH" --mode replace -- /opt/hermes/.venv/bin/hermes chat \
      --provider "${L383_WRITER_PROVIDER:-openai-codex}" --model "$PRIMARY_WRITER_MODEL" \
      --ignore-rules -t file --yolo --max-turns 35 -Q -q \
      "Compose a fresh article for every selected story in ${REWRITE_INPUT}. The input contains immutable identity and review feedback, not the rejected prose. Each was rejected by the independent originality reviewer; its rejection_reason names the copied sentence, the outlet's sequence it followed, or the wrong fact. Read docs/albanian_newsroom.md, docs/news-output-schema.json and ${WRITER_BRIEF}; find each story there by its url and write ONLY from its inline reporter notes (the explicit verified-evidence fallback only where notes are unavailable). Write a new article, not an edit: a new headline, a new lead built on a different fact than the rejected one, your own paragraph order and sentences, and correct every fact the reason names. Restating what a person said in a public statement in your own words is fine; never translate a source sentence, keep no source phrasing or imagery, no direct quotations, no outlet names. Keep url, slug, category, city and corroborating_sources unchanged; leave image fields out. The prepared photo's subject must be a main subject of your headline or opening paragraph, not just a later mention in a roundup. Use an evidenced angle centered on that subject, or choose another ready story; never imply a photo shows a different company, person or product. Read docs/news-ranking-rubric.md and rate each from evidence with all factors and a specific score_reason. At least 140 grounded Albanian words in three HTML paragraphs. Drop a story only if its facts cannot be told without the rejected material. Do not edit files. Return ONLY the rewritten articles as a JSON array between 383_JSON_BEGIN and 383_JSON_END. This is a data-only task; do not run tests, build, publish, deploy, email or edit any other file." 9>&-
    REWRITE_RC=$?
    set -e
    trap on_error ERR
    # Only the rejected stories may come back: a rewrite is no way to add new ones.
    if [ "$REWRITE_RC" -eq 0 ] && "$PYTHON_BIN" -c 'import json,sys; rows=json.load(open(sys.argv[1],encoding="utf-8")); asked={a["url"] for a in json.load(open(sys.argv[2],encoding="utf-8"))}; assert isinstance(rows,list) and rows and {a["url"] for a in rows} <= asked' "$REWRITE_BATCH" "$REWRITE_INPUT" 2>/dev/null; then
      FULL_BATCH="$BATCH"
      APPROVED_BACKUP="$(mktemp /tmp/383-approved.XXXXXX.json)"
      cp "$BATCH" "$APPROVED_BACKUP"
      BATCH="$REWRITE_BATCH"
      review_extra rewrite
      "$PYTHON_BIN" scripts/news_refill.py merge "$APPROVED_BACKUP" "$BATCH" "$FULL_BATCH"
      BATCH="$FULL_BATCH"
      refresh_merged_evidence
      rm -f "$APPROVED_BACKUP"
    else
      printf '383 REWRITE REJECTED: writer exited %s or returned nothing; continuing with approved drafts\n' "$REWRITE_RC"
    fi
  else
    printf '383 REWRITE: no remaining category slots or invalid input; retaining approved drafts\n'
  fi
fi

stage="independent-originality-review"
"$PYTHON_BIN" scripts/news_copyright_review.py --file "$BATCH"
if [ "$("$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH")" -eq 0 ]; then
  stage="no-new-verified-news"
  record_state no_news
  "$PYTHON_BIN" scripts/news_quality_report.py --file "$BATCH" --status no_news
  if [ "$QA_ONLY" != "1" ]; then
    "$PYTHON_BIN" scripts/codex_automation_support.py send-status-report --phase completed --message "Pipeline përfundoi pa artikuj që kaluan kontrollin e origjinalitetit."
  fi
  printf '383 NO NEWS: independent originality review rejected all candidates\n'
  exit 0
fi
"$PYTHON_BIN" scripts/news_copyright_review.py --verify --file "$BATCH"

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
