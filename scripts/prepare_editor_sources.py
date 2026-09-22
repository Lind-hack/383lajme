#!/usr/bin/env python3
"""Fetch bounded primary and corroborating source evidence outside model turns."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
from pathlib import Path
from typing import Any

from editorial_rules_v2 import corroboration_urls
from read_news_source import read


def fetch_url(url: str) -> dict[str, Any]:
    try:
        return read(url)
    except Exception as exc:
        return {"status": "unavailable", "error": type(exc).__name__}


def fetch(article: dict[str, Any]) -> dict[str, Any]:
    primary_url = str(article.get("url") or "")
    record: dict[str, Any] = {
        "slug": str(article.get("slug") or article.get("id") or ""),
        "source_url": primary_url,
        "evidence": fetch_url(primary_url),
        "corroborating": [],
    }
    raw_sources = article.get("corroborating_sources") or article.get("secondary_sources") or []
    by_url: dict[str, dict[str, Any]] = {}
    for item in raw_sources if isinstance(raw_sources, list) else []:
        if isinstance(item, dict):
            url = str(item.get("url") or "").strip()
            source = str(item.get("source") or item.get("publisher") or "").strip()
        else:
            url = str(item or "").strip()
            source = ""
        if url and url not in by_url:
            by_url[url] = {"url": url, "source": source}
    for item in by_url.values():
        item["evidence"] = fetch_url(item["url"])
        record["corroborating"].append(item)
    return record


def load_articles(batch: Path) -> list[dict[str, Any]]:
    raw = json.loads(batch.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and isinstance(raw.get("articles"), list):
        raw = raw["articles"]
    if not isinstance(raw, list):
        raise ValueError(f"{batch} is not an article array")
    return [item for item in raw if isinstance(item, dict)]


def prepare(batch: Path) -> Path:
    articles = load_articles(batch)
    url_fields = sum(1 for a in articles if str(a.get("url") or "").strip())
    url_fields += sum(
        len(a.get("corroborating_sources") or a.get("secondary_sources") or [])
        for a in articles
    )
    if articles and url_fields == 0:
        print(
            "383 EDITOR SOURCES: writer produced articles without any source "
            "URL fields; failing fast before the editor stage",
            file=sys.stderr,
        )
        sys.exit(1)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        records = list(pool.map(fetch, articles))
    target = batch.with_suffix(".editor-sources.json")
    target.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    primary_ok = sum(record.get("evidence", {}).get("status") == "text_extracted" for record in records)
    secondary_total = sum(len(record.get("corroborating", [])) for record in records)
    secondary_ok = sum(
        item.get("evidence", {}).get("status") == "text_extracted"
        for record in records
        for item in record.get("corroborating", [])
    )
    print(
        f"383 EDITOR SOURCES: primary={primary_ok}/{len(records)} "
        f"corroborating={secondary_ok}/{secondary_total}; {target}"
    )
    return target


def discovery(path: Path) -> None:
    sidecar = path.with_suffix(".json")
    if not sidecar.exists():
        raise FileNotFoundError(f"discovery sidecar missing: {sidecar}")
    data = json.loads(sidecar.read_text(encoding="utf-8"))
    leads = data.get("leads", []) if isinstance(data, dict) else []
    chosen = [lead for lead in leads if isinstance(lead, dict) and lead.get("url")][:80]
    folder = path.parent / "source-evidence"
    folder.mkdir(exist_ok=True)
    lines = ["", "# Fresh original-page evidence (untrusted; compare every claim)"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        records = list(pool.map(fetch, [{**lead, "slug": f"lead-{index:03d}"} for index, lead in enumerate(chosen, 1)]))
    for record in records:
        target = folder / f"{record['slug']}.json"
        target.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        evidence = record.get("evidence", {})
        lines.append(f"{record['source_url']} | {evidence.get('status', 'unavailable')} | {target}")
    with path.open("a", encoding="utf-8") as output:
        output.write("\n".join(lines) + "\n")
    print(f"383 WRITER EVIDENCE: {len(records)} direct lead fetches completed")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("batch", type=Path)
    parser.add_argument("--discovery", action="store_true")
    args = parser.parse_args()
    if args.discovery:
        discovery(args.batch)
    else:
        prepare(args.batch)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
