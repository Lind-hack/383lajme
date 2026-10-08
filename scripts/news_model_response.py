"""Save a complete model response atomically; the model never edits the batch."""
import argparse
import json
import os
import subprocess
from pathlib import Path


def save_response(output: str, batch: Path, mode: str) -> int:
    start = output.rfind("383_JSON_BEGIN")
    end = output.find("383_JSON_END", start + 14)
    if start < 0 or end < 0:
        raise ValueError("Model did not return a complete article response")
    rows = json.loads(output[start + len("383_JSON_BEGIN"):end].strip())
    if not isinstance(rows, list) or not rows:
        raise ValueError("Model response must be a nonempty article array")
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
    parser.add_argument("--mode", choices=["replace", "append", "editor"], required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    result = subprocess.run(command, stdout=subprocess.PIPE, text=True, encoding="utf-8")
    if result.returncode:
        print(result.stdout[-2000:])
        raise SystemExit(result.returncode)
    count = save_response(result.stdout, args.batch, args.mode)
    print(f"383 MODEL RESPONSE: mode={args.mode} articles={count}; complete JSON saved atomically")
