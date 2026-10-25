#!/usr/bin/env python3
"""Fetch bounded primary and corroborating source evidence outside model turns."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import sys
import time
import threading
from functools import lru_cache
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
    from news_model_evidence import write_readable_evidence
    write_readable_evidence(batch.with_suffix(".editor-sources.md"), records)
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


def visual_options(lead: dict, primary: dict, secondary: dict) -> list[dict]:
    """Owner, 2026-10-17 evening: every article carries a recent visual of
    its subject, and a story without one is dropped. First the subject's own
    official video of the last three days, then a Commons photo of the last
    30 days (an official Flickr photo of the last two days, when a key
    exists, ahead of it), then a photo of the story's own person or team
    from the last two years, captioned as an archive photo, then a dated
    archive photo of its institution, place, team or company. Text-only is
    out."""
    from news_gallery_photos import gallery_options
    from news_asset_photos import asset_options
    from news_image_policy import photo_options
    from news_photo_editor import trimmed
    from news_press_photos import press_options
    from news_video_policy import video_options
    # Prepare this finite fallback before slower subject searches consume
    # the research window; its position in the editor's tier order stays last.
    asset = asset_options(lead, primary, secondary)
    # Lind, 18 Oct: the institution's own press photo of the last two days
    # comes first, credited to it, as Kosovo and Albanian media do.
    return trimmed(press_options(lead) + video_options(lead) + gallery_options(lead) + photo_options(lead, primary, secondary, "fresh")
                   + photo_options(lead, primary, secondary, "older") + photo_options(lead, primary, secondary, "place")
                   + asset)


def ready_image(lead: dict, primary: dict, secondary: dict) -> dict:
    if os.environ.get("L383_HOURLY_NEWS") == "1":
        from news_image_policy import finalize_photo
        from news_video_policy import finalize_video
        options = lead.get("_visual_options")
        if options is None:
            options = visual_options(lead, primary, secondary)
        # The photo editor's picks, best first; [] means nothing shows the
        # story. Without a verdict the tier order stands.
        choice = lead.get("_visual_choice")
        for option in [options[index] for index in choice] if choice is not None else options:
            found = finalize_video(lead, option) if option["tier"] == "video" else finalize_photo(lead, option)
            if found:
                return found
        return {}
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
    """Plan two to three stories per desk without hiding missing inventory."""
    from news_coverage import plan_counts
    counts = {category: sum(lead.get("category") == category for lead in leads) for category in CATEGORIES}
    return plan_counts(counts, total)


@lru_cache(maxsize=1)
def _outlet_statement_pattern():
    from editorial_rules_v2 import fold
    from news_photo_subjects import publisher_names
    names = publisher_names(MANIFEST["publishers"]) | {"the Journal"}
    return re.compile(r"\b(?:told|tells|tell)\s+(?:" + "|".join(
        re.escape(fold(name)) for name in sorted(names)) + r")\b")


def source_basis_warning(lead: dict) -> str:
    """An ordering hint for the existing ban, never an approval or rejection.

    Outlet interviews and anonymous sourcing repeatedly consumed main writer
    slots before the editor rejected them. Public statements remain preferred.
    Incidental mentions can be false positives, so keep the candidate available.
    """
    from editorial_rules_v2 import fold
    from urllib.parse import urlsplit
    title = fold(str(lead.get("title", "")))
    labels = {fold(str(tag)) for tag in (lead.get("tags") or [])}
    path = urlsplit(str(lead.get("url", ""))).path.casefold()
    if (labels & {"opinion", "opinione", "editorial", "analysis", "analiza", "review", "reviews", "gallery", "galeri", "betting"}
            or re.search(r"/(?:opinion|opinione|editorial|gallery|galleries|galeri|betting)/", path)
            or re.search(r"\((?:exclusive|ekskluzive)\)|^(?:exclusive|ekskluzive|opinion|editorial)\s*:", title)):
        return "Source explicitly labels exclusive, opinion, review, gallery or betting material: prefer a public announcement; use only independently supported public facts."
    text = fold(str(lead.get("primary_evidence", {}).get("text", "")))
    if re.search(r"\b(?:intervist\w*|interviews?|sources? at the|sources? close to|our sources|"
                 r"we.re told|qytetareve te intervistuar|burime anonime|burimeve anonime)\b", text):
        return "Source includes interview or anonymous material: use only independently supported public facts; choose another candidate if it cannot stand without outlet attribution."
    if _outlet_statement_pattern().search(text):
        return "Source includes a statement given to a news outlet: verify a separate public basis before using it; otherwise choose another candidate."
    return ""


def prioritize_grounded_leads(leads: list[dict]) -> list[dict]:
    """Spend bounded photo time on substantial evidence before thin clips.

    A brief primary can still qualify alongside a readable corroborator. This
    ordering is not editorial approval and never substitutes for claim checks.
    """
    def priority(lead: dict) -> tuple[bool, bool, bool]:
        words = sum(len(re.findall(r"\w+", str(lead.get(key, {}).get("text") or "")))
                    for key in ("primary_evidence", "secondary_evidence")
                    if lead.get(key, {}).get("status") == "text_extracted")
        return bool(lead.get("source_basis_warning") or source_basis_warning(lead)), words < 140, words < 80
    return sorted(leads, key=priority)


def reporter_note_candidates(ready: list[dict], plan: dict[str, int]) -> list[dict]:
    """Give every desk notes before a busy desk's backup candidates.

    Model work can exhaust its shared deadline. Round-robin order prevents
    the last desks from getting only fragment fallbacks while early desks
    spend the budget on their fourth, fifth and sixth candidates.
    """
    groups = {category: [lead for lead in ready if lead["category"] == category][:plan[category] + 3]
              for category in CATEGORIES}
    return [items[index] for index in range(max(map(len, groups.values()), default=0))
            for items in groups.values() if index < len(items)]


def join_reporter_notes(ready: list[dict], requested: list[dict], notes: dict[str, Path]) -> list[dict]:
    """Keep unrequested photo-qualified reserves on verified evidence fallback.

    A bounded notes request is not a capacity limit. Missing notes for a
    requested story retain the existing failure behavior; unrequested stories
    were never judged by that step and remain available to the writer/refill.
    """
    if not notes:
        return ready
    requested_ids = {lead["pair_id"] for lead in requested}
    return [{**lead, "facts_path": str(notes[lead["pair_id"]])} if lead["pair_id"] in notes else lead
            for lead in ready if lead["pair_id"] in notes or lead["pair_id"] not in requested_ids]


def discovery_evidence(lead: dict) -> dict:
    return {"slug": lead["pair_id"], "source_url": lead["url"], "evidence": lead["primary_evidence"],
            "corroborating": [{"url": lead["corroborates_url"], "evidence": lead["secondary_evidence"]}]
                             if lead["corroborates_url"] else []}


def reporter_input(lead: dict, record: dict) -> dict:
    return {"pair_id": lead["pair_id"], "source_url": lead["url"], "title": lead.get("title", ""),
            "source_basis_warning": lead.get("source_basis_warning", ""),
            "text": str(record.get("evidence", {}).get("text", "")),
            "corroborating": " ".join(str(item.get("evidence", {}).get("text", ""))
                                      for item in record.get("corroborating", []))}


def recently_published_photos(days: int = 14) -> set[str]:
    """Photos already on the site in the last two weeks, so one laptop-and-
    Bitcoin picture is not reused hour after hour. Empty if Supabase is down."""
    from datetime import datetime, timedelta, timezone
    from news_image_policy import image_identity
    try:
        from codex_automation_support import _supabase_request
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        rows = _supabase_request("GET", "news_articles", query={
            "select": "image_url", "created_at": f"gte.{since}", "limit": "2000"})
    except Exception as exc:  # the photo search must not fail on this
        print(f"383 PHOTO HISTORY unavailable ({type(exc).__name__}); repeats are only blocked within this hour")
        return set()
    return {image_identity(str(row["image_url"])) for row in rows if row.get("image_url")}


def prepare_hourly_inventory(path: Path, data: dict) -> None:
    leads = data.get("leads", [])
    urls = list(dict.fromkeys(url for lead in leads for url in
                            (lead["url"], lead.get("corroborates_url")) if url))
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        fetched = dict(zip(urls, pool.map(fetch_url, urls)))
    eligible = []
    rejected = {category: {"unreadable": 0, "needs_corroboration": 0, "topic_mismatch": 0, "rejected_twice": 0, "no_fresh_photo": 0} for category in CATEGORIES}
    from news_copyright_review import cooling_down
    for lead in leads:
        # Rejected by the reviewer twice today (draft and rewrite): rest it.
        if cooling_down(lead["url"]):
            rejected[lead["category"]]["rejected_twice"] += 1
            continue
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
        sensitive = needs_corroboration(lead)
        if sensitive and not secondary_ok:
            rejected[lead["category"]]["needs_corroboration"] += 1
            continue
        eligible.append({**lead, "requires_corroboration": sensitive,
                         "corroborates_url": secondary_url if secondary_ok else "",
                         "primary_evidence": primary, "secondary_evidence": secondary if secondary_ok else {},
                         "source_basis_warning": source_basis_warning({**lead, "primary_evidence": primary})})
    # Oversample each desk to replace image failures and editorial rejections.
    # With a recent photo required, about one lead in twenty found one on 18 Oct,
    # so every desk sends up to 30 more than its target.
    by_category = {category: prioritize_grounded_leads([item for item in eligible if item["category"] == category])[:hourly_targets()[category] + 30]
                   for category in CATEGORIES}
    # Research one candidate per desk before extras; a slow photo host must
    # not consume the bounded research window before later desks get a turn.
    shortlist = [items[index] for index in range(max(map(len, by_category.values()), default=0))
                 for items in by_category.values() if index < len(items)]
    from news_image_policy import CATALOG, plan_subjects, identity_cache
    plans = plan_subjects(shortlist, path.parent)
    from news_model_quota import require_available
    require_available()
    # The owner permits a credited contextual photo in different hourly
    # batches. Keep distinct photos within this batch, not a 14-day embargo.
    reserved_photos: set[str] = set()
    photo_lock = threading.Lock()
    def reserve_photo(url: str) -> bool:
        from news_image_policy import image_identity
        identity = image_identity(url)
        with photo_lock:
            if identity in reserved_photos:
                return False
            reserved_photos.add(identity)
            return True
    # Ten minutes for visuals in all: candidate research (six, six stories at
    # a time), the photo editor's verdict (at most four), then downloads and
    # checks of the chosen ones. Preparation model work stops at minute 20.
    research_deadline = time.monotonic() + 360
    shortlist = [{**lead, "photo_plan": plans.get(lead["pair_id"]), "_reserve_photo": reserve_photo,
                  "_photo_deadline": research_deadline} for lead in shortlist]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        options = list(pool.map(lambda lead: visual_options(lead, lead["primary_evidence"], lead["secondary_evidence"]), shortlist))
    from news_photo_editor import choose
    picks = choose([{"pair_id": lead["pair_id"], "title": lead.get("title", ""),
                     "text": str(lead["primary_evidence"].get("text", "")), "options": found}
                    for lead, found in zip(shortlist, options)], path.parent)
    require_available()
    finalize_deadline = time.monotonic() + 240
    for lead, found in zip(shortlist, options):
        lead.update(_visual_options=found, _photo_deadline=finalize_deadline)
        lead["_visual_choice"] = picks.get(lead["pair_id"], [])
    folder = path.parent / "source-evidence"
    folder.mkdir(exist_ok=True)
    # Photo selection has finished its model calls. Warm only reporter notes
    # while downloads/decoding do HTTP work; the usual three note calls remain
    # the only active model work. Provisional notes never establish photo readiness.
    from news_fact_sheets import build_fact_sheets
    provisional = [lead for lead in shortlist if lead["_visual_options"] and lead.get("_visual_choice") != []]
    warm_leads = reporter_note_candidates(provisional, coverage_plan(provisional))
    warm_inputs = [reporter_input(lead, discovery_evidence(lead)) for lead in warm_leads]
    if warm_inputs:
        print(f"383 EARLY FACT NOTES candidates={len(warm_inputs)}; photo readiness still pending")
    note_pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    warm_notes = note_pool.submit(build_fact_sheets, warm_inputs, folder) if warm_inputs else None
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            images = list(pool.map(lambda lead: ready_image(lead, lead["primary_evidence"], lead["secondary_evidence"]), shortlist))
    finally:
        note_pool.shutdown(wait=True, cancel_futures=True)
    if warm_notes:
        try:
            warm_notes.result()
            print("383 EARLY FACT NOTES complete; rechecking against final photo-qualified inventory")
        except Exception as exc:
            print(f"383 EARLY FACT NOTES unavailable ({type(exc).__name__}); normal source-bound notes remain required")
    ready = []
    for lead, image in zip(shortlist, images):
        if not image:
            rejected[lead["category"]]["no_fresh_photo"] += 1
            continue
        record = discovery_evidence(lead)
        target = folder / f"{lead['pair_id']}.json"
        target.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        ready.append({key: value for key, value in {**lead, **image, "evidence_path": str(target)}.items()
                      if key not in {"primary_evidence", "secondary_evidence", "photo_plan", "_reserve_photo", "_photo_deadline",
                                     "_photo_research", "_source_fingerprints", "_source_urls",
                                     "_visual_options", "_visual_choice"}})
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    CATALOG.write_text(json.dumps({lead["url"]: {key: value for key, value in lead.items()
                       if key.startswith("image_") or key == "video_clip_url"} for lead in ready}, ensure_ascii=False, indent=2), encoding="utf-8")
    identity_cache.save()
    plan = coverage_plan(ready)
    photo_ready_counts = {category: sum(lead["category"] == category for lead in ready) for category in CATEGORIES}
    # Reporter's notes for the stories the writer will actually use (each desk's
    # allocation plus a few spares). With notes, a story is written from them
    # alone; requested stories whose notes failed keep their existing failure
    # behavior. Unrequested reserves use the verified-evidence fallback.
    wanted = reporter_note_candidates(ready, plan)
    notes_input = []
    for lead in wanted:
        record = json.loads(Path(lead["evidence_path"]).read_text(encoding="utf-8"))
        notes_input.append(reporter_input(lead, record))
    notes = build_fact_sheets(notes_input, folder) if notes_input else {}
    if notes:
        ready = join_reporter_notes(ready, wanted, notes)
        plan = coverage_plan(ready)
    else:
        print("383 FACT NOTES unavailable this hour; writer falls back to source evidence")
    data.update(verified_pair_ids=[lead["pair_id"] for lead in ready], ready_leads=ready,
                source_ready_categories={category: sum(lead["category"] == category for lead in ready) for category in CATEGORIES},
                publication_plan=plan, category_targets=hourly_targets(), rejected_inventory=rejected,
                photo_ready_categories=photo_ready_counts,
                funnel={category: {
                    "selected": sum(lead["category"] == category for lead in leads),
                    "readable_eligible": sum(lead["category"] == category for lead in eligible),
                    "photo_qualified": photo_ready_counts[category],
                    "writer_ready": sum(lead["category"] == category for lead in ready),
                } for category in CATEGORIES})
    path.with_suffix(".json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# 383 prepared hourly story queue", "",
             f"Verified source-ready pair inventory: {len(ready)}",
             "Publication plan (aim for these category counts): " + json.dumps(plan, ensure_ascii=False),
             "Target is 20 distinct new articles: two to three per category, never more than three. Give every available desk two before adding a third. Report missing verified inventory instead of padding another desk.",
             "Use verified facts in original prose. Never name a publisher in public copy; skip stories that rest on another outlet's exclusive, interview or unconfirmed claim; write 383's own lead, sentences and headline wording rather than mirroring the source sentence by sentence, and never add claims (even 'no deadline was given') the evidence does not state; preserve internal evidence URLs.",
             "Visuals below are the institution's own press photos of the last two days, the subject's own official videos of the last three days or rights-cleared photographs of the story's person or team (last 30 days, or archive photos of the last two years whose caption says so), independently checked against source images. Each story shows only image_subject and image_caption; leave the image fields out of your drafts, the pipeline restores the full prepared photo record by source URL. Do not claim a photo shows a moment the caption does not name. The writer and editor must confirm that the photo subject fits the specific story, not just its category.", ""]
    lines += ["# Per-story editorial ranking",
              "Read docs/news-ranking-rubric.md. Assign each score_breakdown factor individually from the fetched evidence and explain the stakes in score_reason. Never copy an all-5 baseline. The normalizer computes the weighted total; do not calculate weights or inspect scoring scripts.", ""]
    for category in CATEGORIES:
        lines += [f"# {category} — publish {plan[category]}", ""]
        for lead in ready:
            if lead["category"] != category:
                continue
            # The full rights record (description, checked source images) made
            # each line too long for the writer's file tool, which then refused
            # to write; the normalizer restores it from the catalog by URL.
            shown = {key: value for key, value in lead.items()
                     if not key.startswith("image_") or key in {"image_subject", "image_caption"}}
            if "facts_path" in shown:
                # The writer works from the notes; the source text is for the
                # editor. The source's own headline and summary go too: drafts
                # kept translating the original headline (reviewer, 2026-10-12).
                for key in ("evidence_path", "title", "summary", "video_clip_url"):
                    shown.pop(key, None)
            lines += [json.dumps(shown, ensure_ascii=False), ""]
    lines += ["# Inventory shortfalls", json.dumps(rejected, ensure_ascii=False)]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("383 READY INVENTORY " + json.dumps({"ready": data["source_ready_categories"], "plan": plan,
                                               "rejected": rejected}, ensure_ascii=False))


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
