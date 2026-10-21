#!/usr/bin/env bash
# The Albanian copy editor in chunks of five drafts, three at a time.
# One call takes about 1.2 minutes per draft, so twenty drafts in one call
# needed most of the hour (2026-10-12). Small batches go straight through.
set -euo pipefail

MODEL="$1"
BATCH="$2"
REPO="$3"
MAX_TURNS="${4:-45}"
PYTHON_BIN="${L383_PYTHON_BIN:-/opt/data/workspaces/383lajme/.venv/bin/python}"
CHUNK="${L383_EDITOR_CHUNK:-5}"
COUNT="$("$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH")"
if [ "$COUNT" -le "$CHUNK" ]; then
  exec bash "$REPO/scripts/run-news-editor.sh" "$MODEL" "$BATCH" "$REPO" "$MAX_TURNS"
fi

WORK="$(mktemp -d /tmp/383-editor-chunks.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
NAME="$(basename "$BATCH")"
# chunk-N/<batch name> plus its own slice of the evidence file, which the
# editor reads beside the batch.
"$PYTHON_BIN" - "$BATCH" "$WORK" "$CHUNK" "$NAME" <<'PY'
import json, sys
from pathlib import Path
batch, work, size, name = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
articles = json.loads(batch.read_text(encoding="utf-8"))
evidence = json.loads(batch.with_suffix(".editor-sources.json").read_text(encoding="utf-8"))
by_slug = {row.get("slug"): row for row in evidence}
for index in range(0, len(articles), size):
    folder = work / f"chunk-{index // size:02d}"
    folder.mkdir()
    part = articles[index:index + size]
    (folder / name).write_text(json.dumps(part, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (folder / name).with_suffix(".editor-sources.json").write_text(
        json.dumps([by_slug[a["slug"]] for a in part if a.get("slug") in by_slug], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
PY

edit_chunk() {
  local folder="$1"
  # One retry: the Codex stream stalls now and then.
  bash "$REPO/scripts/run-news-editor.sh" "$MODEL" "$folder/$NAME" "$REPO" "$MAX_TURNS" > "$folder/log" 2>&1 \
    || bash "$REPO/scripts/run-news-editor.sh" "$MODEL" "$folder/$NAME" "$REPO" "$MAX_TURNS" >> "$folder/log" 2>&1 \
    || touch "$folder/failed"
}

running=0
for folder in "$WORK"/chunk-*; do
  edit_chunk "$folder" &
  running=$((running + 1))
  if [ "$running" -ge 3 ]; then
    wait -n || true
    running=$((running - 1))
  fi
done
wait || true

# Edited chunks in their original order; a chunk that failed twice is left
# out (its drafts were not fact-checked by the editor).
"$PYTHON_BIN" - "$BATCH" "$WORK" "$NAME" <<'PY'
import json, sys
from pathlib import Path
batch, work, name = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
rows, failed = [], 0
for folder in sorted(work.glob("chunk-*")):
    print((folder / "log").read_text(encoding="utf-8", errors="replace")[-600:])
    if (folder / "failed").exists():
        failed += 1
        continue
    rows += json.loads((folder / name).read_text(encoding="utf-8"))
if not rows and failed == len(list(work.glob("chunk-*"))):
    raise SystemExit("383 PARALLEL EDITOR: every chunk failed")
batch.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"383 PARALLEL EDITOR: kept={len(rows)} failed_chunks={failed}")
PY
if [ "$("$PYTHON_BIN" -c 'import json,sys; print(len(json.load(open(sys.argv[1],encoding="utf-8"))))' "$BATCH")" -gt 0 ]; then
  "$PYTHON_BIN" "$REPO/scripts/editor_completion.py" acknowledge "$BATCH"
else
  rm -f "${BATCH%.json}.editor-complete.json"
fi
