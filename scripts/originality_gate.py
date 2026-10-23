#!/usr/bin/env python3
"""Drop batch candidates that copy long exact source sentences."""

from __future__ import annotations

import argparse
import json
import re
import html
from pathlib import Path
from typing import Any

from editorial_rules_v2 import fold


def _words(value: object) -> list[str]:
    return re.findall(r"[a-z0-9]+", fold(html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))))


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


def _matching_words(sentence: str, source_index: dict[int, set[tuple[str, ...]]], size: int) -> str:
    words = _words(sentence)
    return next((" ".join(words[i:i + size]) for i in range(len(words) - size + 1)
                 if tuple(words[i:i + size]) in source_index.get(size, set())), "")


def _comparison_errors(article: dict[str, Any], source_text: str) -> list[str]:
    # Quotation marks do not grant permission or prove attribution. Automated
    # output uses independently composed indirect speech, not borrowed quotes.
    body = html.unescape(str(article.get("body") or ""))
    unquoted_body = body
    sentences = _sentences(unquoted_body)
    maximum = min(32, max((len(_words(sentence)) for sentence in sentences), default=0))
    source_index = _source_index(source_text, maximum)
    errors: list[str] = []
    for sentence in sentences:
        overlap = _longest_exact_ngram(sentence, source_index)
        if overlap < 8:
            continue
        matching = _matching_words(sentence, source_index, overlap)
        errors.append(f"body contains an exact source overlap of {overlap} words; matching normalized words: {matching!r}; rewrite this entire sentence in 383's own words: {sentence!r}")
    for field in ("title", "excerpt"):
        field_index = _source_index(source_text, 32)
        overlap = _longest_exact_ngram(str(article.get(field) or ""), field_index)
        if overlap:
            matching = _matching_words(str(article.get(field) or ""), field_index, overlap)
            errors.append(f"{field} contains an exact source overlap of {overlap} words; matching normalized words: {matching!r}; write an original {field}")
    # Detect stitched paraphrases made of many short copied fragments.
    words = _words(unquoted_body)
    fragments = _source_index(source_text, 5, minimum=5).get(5, set())
    copied_positions = set()
    for index in range(len(words) - 4):
        if tuple(words[index:index + 5]) in fragments:
            copied_positions.update(range(index, index + 5))
    if len(copied_positions) >= 40 and len(copied_positions) / max(1, len(words)) >= 0.25:
        errors.append("body stitches together substantial source wording; draft from a fact outline with new structure")
    return errors


def originality_errors(article: dict[str, Any], evidence: dict[str, Any]) -> list[str]:
    source = evidence.get("evidence") or {}
    if not source.get("text"):
        return ["primary evidence has no readable text for originality comparison"]
    errors = _comparison_errors(article, str(source["text"]) + "\n" + str(source.get("title") or ""))
    body = html.unescape(re.sub(r"<[^>]+>", " ", str(article.get("body") or "")))
    for match in re.finditer(r'"([^"\n]+)"|“([^”\n]+)”|«([^»\n]+)»', body):
        if len(_words(match.group(0))) >= 6:
            errors.append("substantive direct quotation is not permitted in automated copy; report supported facts in independently composed indirect speech")
    for item in evidence.get("corroborating", []):
        secondary = item.get("evidence") or {}
        if secondary.get("text"):
            errors.extend("corroborating source: " + error for error in
                          _comparison_errors(article, str(secondary["text"]) + "\n" + str(secondary.get("title") or "")))
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
