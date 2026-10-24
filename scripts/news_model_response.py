"""Save a complete model response atomically; the model never edits the batch."""
import argparse
import json
import os
import subprocess
from pathlib import Path

from news_model import model_args, run_process


def resolve_writer_sources(rows: list, manifest: Path) -> list:
    """Bind a draft's short ID to its prepared source; never guess from URL similarity."""
    from news_source_policy import source_error
    records = json.loads(manifest.read_text(encoding='utf-8'))
    if not isinstance(records, list) or not records:
        raise ValueError('writer source manifest is empty or invalid')
    by_id, by_url = {}, {}
    for record in records:
        if (not isinstance(record, dict) or not isinstance(record.get('pair_id'), str)
                or not record['pair_id'] or source_error(record.get('category'), record.get('url'))
                or record['pair_id'] in by_id or record['url'] in by_url):
            raise ValueError('writer source manifest contains an invalid or duplicate identity')
        by_id[record['pair_id']] = record
        by_url[record['url']] = record
    resolved = []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('writer returned an invalid source identity')
        key, url = row.get('source_pair_id'), row.get('url')
        if url is not None and not isinstance(url, str):
            raise ValueError('writer URL must be text or omitted for a known source identity')
        if key is not None and (not isinstance(key, str) or key not in by_id):
            raise ValueError('writer returned an unknown source identity')
        record = by_id.get(key) if key is not None else by_url.get(url) if isinstance(url, str) else None
        if record is None or row.get('category') != record['category']:
            raise ValueError('writer left its prepared source/category scope')
        if url != record['url']:
            # A known identity may recover a missing or cut-off URL, never a
            # conflicting complete URL or another prepared story's identity.
            if url and (not isinstance(url, str) or len(url) < 24 or not record['url'].startswith(url) or url in by_url):
                raise ValueError('writer source ID conflicts with its returned URL')
            print(f"383 WRITER SOURCE restored exact prepared URL for {record['pair_id']!r}")
        item = dict(row)
        item.pop('source_pair_id', None)
        item['url'] = record['url']
        resolved.append(item)
    return resolved


def save_response(output: str, batch: Path, mode: str, identity_manifest: Path | None = None) -> int:
    start = output.rfind("383_JSON_BEGIN")
    end = output.find("383_JSON_END", start + 14)
    if start < 0 or end < 0:
        raise ValueError("Model did not return a complete article response")
    rows = json.loads(output[start + len("383_JSON_BEGIN"):end].strip())
    if not isinstance(rows, list) or (not rows and mode == "replace"):
        raise ValueError("Model response must be an article array; initial drafts cannot be empty")
    if identity_manifest is not None:
        if mode != 'replace':
            raise ValueError('source identity resolution is only for fresh unreviewed writer drafts')
        rows = resolve_writer_sources(rows, identity_manifest)
    if mode == "editor-decisions":
        from news_editor_decisions import apply_decisions
        rows = apply_decisions(json.loads(batch.read_text(encoding="utf-8")), rows)
    if mode == "editor" and rows:
        old = json.loads(batch.read_text(encoding="utf-8"))
        allowed = {row["url"] for row in old}
        retained = [row for row in rows if isinstance(row, dict)
                    and all(row.get(key) for key in ("url", "title", "body", "category", "slug"))
                    and isinstance(row["url"], str)
                    and row["url"] in allowed]
        if not retained:
            raise ValueError("Editor returned no complete articles with reviewed source URLs")
        if len(retained) != len(rows):
            print(f"383 EDITOR RESPONSE isolated={len(rows) - len(retained)} invalid article(s); retained={len(retained)}")
        rows = retained
    if any(not isinstance(row, dict) or not all(row.get(key) for key in ("url", "title", "body", "category", "slug")) for row in rows):
        raise ValueError("Model response contains incomplete articles")
    if len({row["url"] for row in rows}) != len(rows):
        raise ValueError("Model response repeats a source URL")
    if mode in {"append", "editor"}:
        old = json.loads(batch.read_text(encoding="utf-8"))
        by_url = {row["url"]: row for row in rows}
        if mode == "append":
            if set(by_url).isdisjoint({row["url"] for row in old}):
                # The model can return just new drafts; preserve approved copy
                # locally instead of spending tokens reproducing it each time.
                rows = old + rows
            elif any(by_url.get(row["url"]) != row for row in old):
                raise ValueError("Continuation changed or removed an existing article")
        if mode == "editor" and not set(by_url).issubset({row["url"] for row in old}):
            raise ValueError("Editor introduced an unreviewed source URL")
    temporary = batch.with_suffix(".response.tmp")
    temporary.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, batch)
    return len(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=Path, required=True)
    parser.add_argument("--mode", choices=["replace", "append", "editor", "editor-decisions"], required=True)
    parser.add_argument("--context-file", type=Path, action="append", default=[])
    parser.add_argument('--identity-manifest', type=Path)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if len(command) < 3 or command[1] != "chat":
        raise ValueError("News response wrapper requires a Hermes chat command")
    command = command[:2] + model_args(command[2:-1]) + command[-1:]
    if args.context_file:
        from news_model_context import contextual_command
        command, inlined = contextual_command(command, args.context_file)
        print(f"383 MODEL CONTEXT: complete_documents={len(args.context_file)} toolset={'none' if inlined else 'file'}")
    try:
        result = run_process(command, float(os.environ.get("L383_MODEL_CALL_TIMEOUT", "600")))
    except subprocess.TimeoutExpired:
        print("383 MODEL RESPONSE: call timed out; no incomplete response saved and existing copy preserved")
        raise SystemExit(75)
    if result.returncode:
        print(result.stdout[-2000:])
        raise SystemExit(result.returncode)
    try:
        count = save_response(result.stdout, args.batch, args.mode, args.identity_manifest)
    except ValueError:
        # Show what the model said instead of the JSON, so a refusal or a
        # truncated answer can be told apart in the run log.
        print(result.stdout[-1500:])
        raise
    print(f"383 MODEL RESPONSE: mode={args.mode} articles={count}; complete JSON saved atomically")
