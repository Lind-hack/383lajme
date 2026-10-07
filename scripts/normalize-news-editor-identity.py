#!/usr/bin/env python3
"""Restore immutable article identity after an AI copy edit."""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path


IMMUTABLE = (
    "id", "slug", "dispatch", "url", "category", "created_at",
    "published_at", "corroborating_sources",
)


def restore(original_path: Path, edited_path: Path) -> int:
    original = json.loads(original_path.read_text(encoding="utf-8"))
    edited = json.loads(edited_path.read_text(encoding="utf-8"))
    if not isinstance(original, list) or not isinstance(edited, list) or not edited:
        raise ValueError("editor must retain a non-empty article array")
    by_url = {row.get("url"): row for row in original if isinstance(row, dict)}
    if len(by_url) != len(original):
        raise ValueError("original batch has missing or duplicate source URLs")
    seen: set[str] = set()
    changed = 0
    for row in edited:
        if not isinstance(row, dict) or row.get("url") not in by_url:
            raise ValueError("editor introduced an unsupported source URL")
        url = row["url"]
        if url in seen:
            raise ValueError("editor duplicated a source URL")
        seen.add(url)
        before = by_url[url]
        for key in IMMUTABLE:
            if key in before and row.get(key) != before[key]:
                row[key] = before[key]
                changed += 1
    if changed:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=edited_path.parent,
            prefix=".383-editor-identity-", suffix=".json", delete=False,
        ) as output:
            temp_path = Path(output.name)
            json.dump(edited, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(temp_path, edited_path)
    print(f"EDITOR IDENTITY: retained={len(edited)} immutable_fields_restored={changed}")
    return changed


if __name__ == "__main__":
    restore(Path(sys.argv[1]), Path(sys.argv[2]))
