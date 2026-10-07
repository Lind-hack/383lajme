#!/usr/bin/env python3
"""Keep structurally valid hourly articles when a sibling draft is invalid."""

from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

from codex_automation_support import validate_batch


def isolate(path: Path, validator=validate_batch) -> int:
    articles = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(articles, list):
        raise ValueError("news batch must be an article array")
    kept = []
    rejected = 0
    seen_ids: set[str] = set()
    seen_slugs: set[str] = set()
    seen_urls: set[str] = set()
    seen_images: set[str] = set()
    with tempfile.TemporaryDirectory(prefix="383-candidate-check-") as folder:
        probe = Path(folder) / path.name
        for index, article in enumerate(articles, 1):
            if not isinstance(article, dict):
                print(f"REJECTED structural candidate {index}: not an article object")
                rejected += 1
                continue
            identifiers = (
                str(article.get("id") or ""),
                str(article.get("slug") or ""),
                str(article.get("url") or "").split("#", 1)[0].rstrip("/"),
                str(article.get("image_url") or ""),
            )
            if (identifiers[0] in seen_ids or identifiers[1] in seen_slugs
                    or identifiers[2] in seen_urls or identifiers[3] in seen_images):
                print(f"REJECTED structural candidate {index}: duplicate ID, slug, URL, or image")
                rejected += 1
                continue
            probe.write_text(json.dumps([article], ensure_ascii=False) + "\n", encoding="utf-8")
            try:
                validator(probe)
            except Exception as exc:
                reason = str(exc).splitlines()[0] if str(exc) else type(exc).__name__
                print(f"REJECTED structural candidate {index} {article.get('title', 'untitled')!r}: {reason}")
                rejected += 1
                continue
            kept.append(article)
            seen_ids.add(identifiers[0])
            seen_slugs.add(identifiers[1])
            seen_urls.add(identifiers[2])
            seen_images.add(identifiers[3])
    if kept:
        path.write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"STRUCTURAL ISOLATION kept={len(kept)} rejected={rejected}")
    return 0 if kept else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, type=Path)
    args = parser.parse_args()
    raise SystemExit(isolate(args.file))
