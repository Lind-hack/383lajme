#!/usr/bin/env python3
"""Drop batch candidates that copy long exact source sentences."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from editorial_rules_v2 import fold


def _words(value: object) -> list[str]:
    return re.findall(r"[a-z0-9]+", fold(re.sub(r"<[^>]+>", " ", str(value or ""))))


def _sentences(value: object) -> list[str]:
    cleaned = re.sub(r"<[^>]+>", " ", str(value or ""))
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", cleaned) if part.strip()]


def _source_index(source_text: str, maximum: int, minimum: int = 8) -> dict[int, set[tuple[str, ...]]]:
    source = _words(source_text)
    return {
        size: {tuple(source[i : i + size]) for i in range(len(source) - size + 1)}
        for size in range(minimum, maximum + 1)
        if len(source) >= size
    }


def _longest_exact_ngram(body_sentence: str, source_index: dict[int, set[tuple[str, ...]]], *, minimum: int = 8) -> int:
    body = _words(body_sentence)
    for size in range(min(len(body), max(source_index, default=minimum)), minimum - 1, -1):
        if any(tuple(body[i : i + size]) in source_index.get(size, set()) for i in range(len(body) - size + 1)):
            return size
    return 0


def originality_errors(article: dict[str, Any], evidence: dict[str, Any]) -> list[str]:
    source_text = str((evidence.get("evidence") or {}).get("text") or "")
    if not source_text:
        return ["primary evidence has no readable text for originality comparison"]
    sentences = _sentences(article.get("body"))
    maximum = min(32, max((len(_words(sentence)) for sentence in sentences), default=0))
    if maximum < 8:
        return []
    source_index = _source_index(source_text, maximum)
    errors: list[str] = []
    for sentence in sentences:
        overlap = _longest_exact_ngram(sentence, source_index)
        if overlap < 8:
            continue
        quoted = any(mark in sentence for mark in ('"', "“", "”", "«", "»"))
        if quoted and overlap <= 16:
            continue
        errors.append(f"body contains an exact source overlap of {overlap} words; rewrite it in 383's own words")
    return errors


def _records(path: Path) -> dict[str, dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"{path} is not an evidence array")
    return {str(item.get("slug")): item for item in raw if isinstance(item, dict) and item.get("slug")}


def validate(batch: Path, evidence_path: Path) -> int:
    raw = json.loads(batch.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"{batch} is not an article array")
    records = _records(evidence_path)
    kept: list[dict[str, Any]] = []
    rejected = 0
    for index, article in enumerate(raw, 1):
        record = records.get(str(article.get("slug")))
        if not record:
            print(f"ORIGINALITY failed article {index}: evidence record is missing")
            return 1
        errors = originality_errors(article, record)
        if errors:
            rejected += 1
            print(f"REJECTED originality candidate {index} {article.get('title', 'untitled')!r}: {'; '.join(errors)}")
            continue
        kept.append(article)
    batch.write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ORIGINALITY GATE kept={len(kept)} rejected={rejected}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--evidence", required=True, type=Path)
    args = parser.parse_args()
    return validate(args.file, args.evidence)


if __name__ == "__main__":
    raise SystemExit(main())
