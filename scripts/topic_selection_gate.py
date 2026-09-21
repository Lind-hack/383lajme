#!/usr/bin/env python3
"""Hard Topic Selection v2 and corroboration gate for 383 batches."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from editorial_rules_v2 import canonical_url, corroboration_urls, validate_run


def _evidence_by_slug(path: Path) -> dict[str, dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"{path} is not an evidence array")
    return {str(item.get("slug")): item for item in raw if isinstance(item, dict) and item.get("slug")}


def _status_ok(evidence: object) -> bool:
    return isinstance(evidence, dict) and evidence.get("status") == "text_extracted"


def evidence_errors(articles: list[dict[str, Any]], evidence_path: Path) -> list[str]:
    if not evidence_path.exists():
        return [f"corroboration evidence file is missing: {evidence_path}"]
    try:
        records = _evidence_by_slug(evidence_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return [f"corroboration evidence cannot be read: {type(exc).__name__}: {exc}"]

    errors: list[str] = []
    for index, article in enumerate(articles, 1):
        record = records.get(str(article.get("slug")))
        if not record:
            errors.append(f"article {index}: no fetched evidence record for slug {article.get('slug')!r}")
            continue
        if not _status_ok(record.get("evidence")):
            errors.append(f"article {index}: primary source evidence is not independently readable")
        by_url = {
            canonical_url(item.get("url")): item
            for item in record.get("corroborating", [])
            if isinstance(item, dict) and canonical_url(item.get("url"))
        }
        for url in corroboration_urls(article):
            item = by_url.get(url)
            if not item or not _status_ok(item.get("evidence")):
                errors.append(f"article {index}: corroborating source {url!r} was not independently readable")
    return errors


def validate(path: Path, evidence_path: Path | None = None) -> int:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and isinstance(raw.get("articles"), list):
        raw = raw["articles"]
    if not isinstance(raw, list) or not all(isinstance(item, dict) for item in raw):
        print(f"TOPIC SELECTION V2 failed: {path} is not an article array")
        return 2

    articles = [item for item in raw if isinstance(item, dict)]
    errors = validate_run(articles)
    evidence = evidence_path or path.with_suffix(".editor-sources.json")
    errors.extend(evidence_errors(articles, evidence))
    if errors:
        print("TOPIC SELECTION V2 failed:")
        for error in errors:
            print(f"  - {error}")
        return 1
    print(f"TOPIC SELECTION V2 ok: {len(articles)} articles; quotas, titles, city tags, source policy and corroboration passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--evidence", type=Path)
    args = parser.parse_args()
    return validate(args.file, args.evidence)


if __name__ == "__main__":
    raise SystemExit(main())
