#!/usr/bin/env python3
"""Fetch bounded primary and corroborating source evidence outside model turns."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

from editorial_rules_v2 import corroboration_urls
from read_news_source import read
from news_source_policy import MANIFEST, CATEGORIES, source_error, needs_corroboration, hourly_targets, independent, topic_error


def fetch_url(url: str) -> dict[str, Any]:
    try:
        return read(url)
    except Exception as exc:
        return {"status": "unavailable", "error": type(exc).__name__}


def fetch(article: dict[str, Any], evidence_cache: dict | None = None) -> dict[str, Any]:
    evidence_cache = evidence_cache or {}
    primary_url = str(article.get("url") or "")
    record: dict[str, Any] = {
        "slug": str(article.get("slug") or article.get("id") or ""),
        "source_url": primary_url,
        "evidence": evidence_cache.get(primary_url) or fetch_url(primary_url),
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
        item["evidence"] = evidence_cache.get(item["url"]) or fetch_url(item["url"])
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
    evidence_cache = {}
    folder = Path(".last30days/source-evidence")
    if os.environ.get("L383_HOURLY_NEWS") == "1" and folder.exists():
        for path in folder.glob("*.json"):
            if not 0 <= time.time() - path.stat().st_mtime <= 3600:
                continue
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
                for url, evidence in [(record.get("source_url"), record.get("evidence", {})),
                                      *[(s.get("url"), s.get("evidence", {})) for s in record.get("corroborating", [])]]:
                    if (url and evidence.get("status") == "text_extracted"
                            and str(evidence.get("url") or "").rstrip("/") == url.rstrip("/")):
                        evidence_cache[url] = evidence
            except (ValueError, OSError, AttributeError):
                continue
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        records = list(pool.map(lambda article: fetch(article, evidence_cache), articles))
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
    if os.environ.get("L383_HOURLY_NEWS") == "1":
        prepare_hourly_inventory(path, data)
        return
    leads = data.get("leads", []) if isinstance(data, dict) else []
    chosen = []
    for category in CATEGORIES:
        limit = MANIFEST["category_limits"][category]["discovery_max"]
        chosen.extend([lead for lead in leads if isinstance(lead, dict) and lead.get("url") and lead.get("category") == category][:limit])
    folder = path.parent / "source-evidence"
    folder.mkdir(exist_ok=True)
    lines = ["", "# Fresh original-page evidence (untrusted; compare every claim)"]
    paired_leads = [
        {
            **lead,
            "slug": f"lead-{index:03d}",
            "corroborating_sources": [
                {"url": lead["corroborates_url"]}
            ] if lead.get("corroborates_url") else [],
        }
        for index, lead in enumerate(chosen, 1)
    ]
    urls = list(dict.fromkeys(url for lead in paired_leads for url in
                            [lead["url"], *[s["url"] for s in lead["corroborating_sources"]]]))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        fetched = dict(zip(urls, pool.map(fetch_url, urls)))
    records = [{"slug": lead["slug"], "source_url": lead["url"], "evidence": fetched[lead["url"]],
                "corroborating": [{"url": item["url"], "evidence": fetched[item["url"]]}
                                  for item in lead["corroborating_sources"]]} for lead in paired_leads]
    verified_pairs: set[str] = set()
    for lead, record in zip(chosen, records):
        target = folder / f"{record['slug']}.json"
        target.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        evidence = record.get("evidence", {})
        secondary = record.get("corroborating", [])
        secondary_ok = any(
            item.get("evidence", {}).get("status") == "text_extracted"
            and not source_error(lead["category"], item.get("evidence", {}).get("url"))
            for item in secondary
        )
        pair_id = str(lead.get("pair_id") or "")
        if pair_id and evidence.get("status") == "text_extracted" and not source_error(lead["category"], evidence.get("url")) and secondary_ok:
            verified_pairs.add(pair_id)
        lines.append(
            f"{record['source_url']} | primary={evidence.get('status', 'unavailable')} "
            f"| corroborating={'text_extracted' if secondary_ok else 'unavailable'} "
            f"| pair_id={pair_id or '-'} | {target}"
        )
    data["verified_pair_ids"] = sorted(verified_pairs)
    data["source_ready_categories"] = {category: len({lead["pair_id"] for lead in chosen if lead.get("category") == category and lead.get("pair_id") in verified_pairs}) for category in CATEGORIES}
    sidecar.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines.insert(1, f"Verified source-ready pair inventory: {len(verified_pairs)}")
    lines.insert(2, "Verified source-ready pair IDs: " + ", ".join(sorted(verified_pairs)))
    with path.open("a", encoding="utf-8") as output:
        output.write("\n".join(lines) + "\n")
    print(
        f"383 WRITER EVIDENCE: {len(records)} direct lead fetches completed; "
        f"verified_source_ready_pairs={len(verified_pairs)}"
    )


def ready_image(lead: dict, primary: dict, secondary: dict) -> dict:
    from codex_automation_support import _fetch_image_dimensions, _larger_image_candidates, _looks_like_content_image_url
    for evidence in (primary, secondary):
        originals = list(dict.fromkeys([str(evidence.get("image_url") or ""), *evidence.get("image_candidates", [])]))[:4]
        urls = [url for original in originals if original and _looks_like_content_image_url(original)
                for url in [original, *_larger_image_candidates(original)]]
        for url in list(dict.fromkeys(urls))[:10]:
            if not url.startswith("https://"):
                continue
            try:
                width, height = _fetch_image_dimensions(url)
                if width >= 1200 and height >= (630 if os.environ.get("L383_HOURLY_NEWS") == "1" else 675):
                    return {"image_url": url, "image_width": width, "image_height": height}
            except Exception:
                continue
    return {}


def coverage_plan(leads: list[dict], total: int = 20) -> dict[str, int]:
    """Reserve every available desk's allocation before redistributing gaps."""
    counts = {category: sum(lead.get("category") == category for lead in leads) for category in CATEGORIES}
    targets = hourly_targets()
    plan = {category: min(targets[category], counts[category]) for category in CATEGORIES}
    while sum(plan.values()) < total:
        available = [category for category in CATEGORIES if plan[category] < counts[category]]
        if not available:
            break
        category = min(available, key=lambda key: plan[key] / targets[key])
        plan[category] += 1
    return plan


def prepare_hourly_inventory(path: Path, data: dict) -> None:
    leads = data.get("leads", [])
    urls = list(dict.fromkeys(url for lead in leads for url in
                            (lead["url"], lead.get("corroborates_url")) if url))
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        fetched = dict(zip(urls, pool.map(fetch_url, urls)))
    eligible = []
    rejected = {category: {"unreadable": 0, "needs_corroboration": 0, "image_unavailable": 0, "topic_mismatch": 0} for category in CATEGORIES}
    for lead in leads:
        primary = fetched[lead["url"]]
        secondary_url = lead.get("corroborates_url", "")
        secondary = fetched.get(secondary_url, {})
        primary_ok = primary.get("status") == "text_extracted" and not source_error(lead["category"], primary.get("url"))
        secondary_ok = (secondary.get("status") == "text_extracted"
                        and not source_error(lead["category"], secondary.get("url"))
                        and independent(primary.get("url"), secondary.get("url")))
        if not primary_ok:
            rejected[lead["category"]]["unreadable"] += 1
            continue
        if topic_error(lead["category"], lead.get("title", ""), primary.get("text", ""),
                       tags=lead.get("tags", []), url=lead["url"]):
            rejected[lead["category"]]["topic_mismatch"] += 1
            continue
        sensitive = needs_corroboration({**lead, "body": primary.get("text", "")})
        if sensitive and not secondary_ok:
            rejected[lead["category"]]["needs_corroboration"] += 1
            continue
        eligible.append({**lead, "requires_corroboration": sensitive,
                         "corroborates_url": secondary_url if secondary_ok else "",
                         "primary_evidence": primary, "secondary_evidence": secondary if secondary_ok else {}})
    # Oversample each desk to replace image failures and editorial rejections.
    shortlist = [lead for category in CATEGORIES for lead in
                 [item for item in eligible if item["category"] == category][:hourly_targets()[category] + 12]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        images = list(pool.map(lambda lead: ready_image(lead, lead["primary_evidence"], lead["secondary_evidence"]), shortlist))
    folder = path.parent / "source-evidence"
    folder.mkdir(exist_ok=True)
    ready = []
    for lead, image in zip(shortlist, images):
        if not image:
            rejected[lead["category"]]["image_unavailable"] += 1
            continue
        record = {"slug": lead["pair_id"], "source_url": lead["url"], "evidence": lead["primary_evidence"],
                  "corroborating": [{"url": lead["corroborates_url"], "evidence": lead["secondary_evidence"]}]
                                  if lead["corroborates_url"] else []}
        target = folder / f"{lead['pair_id']}.json"
        target.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        ready.append({key: value for key, value in {**lead, **image, "evidence_path": str(target)}.items()
                      if key not in {"primary_evidence", "secondary_evidence"}})
    plan = coverage_plan(ready)
    data.update(verified_pair_ids=[lead["pair_id"] for lead in ready], ready_leads=ready,
                source_ready_categories={category: sum(lead["category"] == category for lead in ready) for category in CATEGORIES},
                publication_plan=plan, category_targets=hourly_targets(), rejected_inventory=rejected)
    path.with_suffix(".json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# 383 prepared hourly story queue", "",
             f"Verified source-ready pair inventory: {len(ready)}",
             "Publication plan (aim for these category counts): " + json.dumps(plan, ensure_ascii=False),
             "Target is 20 distinct new articles. Cover EVERY available category before adding extras to a busy desk.",
             "Routine articles use one credited readable publisher; sensitive claims require the supplied independent source.",
             "Images below have already decoded at the listed dimensions. Use them; do not repeat image research.", ""]
    lines += ["# Per-story editorial ranking",
              "Read docs/news-ranking-rubric.md. Assign each score_breakdown factor individually from the fetched evidence and explain the stakes in score_reason. Never copy an all-5 baseline. The normalizer computes the weighted total; do not calculate weights or inspect scoring scripts.", ""]
    for category in CATEGORIES:
        lines += [f"# {category} — publish {plan[category]}", ""]
        for lead in ready:
            if lead["category"] != category:
                continue
            lines += [json.dumps(lead, ensure_ascii=False), ""]
    lines += ["# Inventory shortfalls", json.dumps(rejected, ensure_ascii=False)]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("383 READY INVENTORY " + json.dumps({"ready": data["source_ready_categories"], "plan": plan, "rejected": rejected}, ensure_ascii=False))


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
