#!/usr/bin/env python3
"""Current-day RSS discovery for the 383 Lajme Topic Selection v2 run.

This script is discovery only. It preserves enough lane inventory for the
writer, records the source lane that selected each lead, and never decides the
final article quota. The hard quotas and source policy are enforced later by
``topic_selection_gate.py``.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import json
import os
import re
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

import feedparser
import requests
from bs4 import BeautifulSoup
from news_source_policy import MANIFEST, CATEGORIES, source_error, topic_error, publisher_for, independent

try:
    from googlenewsdecoder import gnewsdecoder
except ImportError:  # pragma: no cover - optional decoder in minimal test envs
    gnewsdecoder = None


KOSOVO_TIME = ZoneInfo("Europe/Belgrade")
USER_AGENT = "383LajmeDiscovery/2.0 (+https://383ks.com)"

# Fail closed: discovery and publication load the same validated registry.
DIRECT_FEEDS = tuple(MANIFEST["feeds"])
BROWSER_LANES = tuple(MANIFEST["browser_lanes"])
SEARCHES = ()

SERBIAN_SOURCE_MARKERS = (
    "b92", "kurir", "informer", "pink", "novosti", "blic", "danas", "politika", "rts", "n1 serbia", "nova rs", "kosovo online",
)
def fold(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").casefold())
    return "".join(char for char in text if not unicodedata.combining(char))


_SQ_SUFFIXES = ("ave", "ive", "eve", "të", "së", "it", "in", "et", "at", "ut", "ot", "a", "i", "u", "n")


def stem_sq(token: str) -> str:
    # Lightweight Albanian suffix strip so inflected forms of the
    # same word match (hysenit/hyseni, marreveshje/marreveshjen).
    for suffix in _SQ_SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= 3:
            return token[: -len(suffix)]
    return token


def clean_text(value: object) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))
    if "Ã" in text:
        try:
            text = text.encode("latin-1").decode("utf-8")
        except UnicodeError:
            pass
    return " ".join(text.replace("<br>", " ").replace("<br/>", " ").split())


def canonical(url: str) -> str:
    try:
        parsed = urlsplit(str(url or "").strip())
    except ValueError:
        return ""
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.hostname == "news.google.com":
        return ""
    query = [(key, value) for key, value in parse_qsl(parsed.query) if not key.startswith("utm_") and key not in {"fbclid", "gclid"}]
    return urlunsplit(("https", parsed.netloc.lower(), parsed.path.rstrip("/"), urlencode(query), ""))


def google_news_url(query: str, language: str = "en", country: str = "US", ceid: str = "US:en") -> str:
    return f"https://news.google.com/rss/search?q={quote_plus(query)}&hl={language}&gl={country}&ceid={ceid}"


def resolve_google_news_url(url: str) -> str:
    if "news.google.com/" not in url:
        return url
    if gnewsdecoder is None:
        return url
    try:
        decoded = gnewsdecoder(url).get("decoded_url")
    except Exception:
        return url
    if isinstance(decoded, str) and decoded.startswith(("https://", "http://")) and "news.google.com/" not in decoded:
        return decoded
    return url


def published_at(entry: object) -> datetime | None:
    getter = getattr(entry, "get", lambda *_: None)
    for key in ("published", "updated"):
        raw = getter(key)
        if not raw:
            continue
        try:
            value = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            try:
                value = parsedate_to_datetime(raw)
            except (TypeError, ValueError, IndexError):
                continue
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    for key in ("published_parsed", "updated_parsed"):
        parsed = getter(key)
        if parsed:
            return datetime(*parsed[:6], tzinfo=timezone.utc)
    return None


def category_for(entry: object, spec: dict[str, Any]) -> str:
    return str(spec.get("category") or "Botë")


def _spec(value: dict[str, Any] | str, label: str | None = None) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {"url": value, "source": label or value, "category": "Botë", "lane": "BOTË"}


def is_recent_for_slot(published: datetime, now: datetime) -> bool:
    local_now = now.astimezone(KOSOVO_TIME)
    midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    # At midnight the feeds have not produced a new calendar day's inventory.
    # Keep the prior evening available only during the first six local hours;
    # published-URL filtering still prevents reusing a previously run story.
    cutoff = local_now - timedelta(hours=24) if os.environ.get("L383_HOURLY_NEWS") == "1" else (midnight - timedelta(hours=6) if local_now.hour < 6 else midnight)
    return cutoff <= published.astimezone(KOSOVO_TIME) <= now.astimezone(KOSOVO_TIME) + timedelta(minutes=5)


def fetch_feed(spec_value: dict[str, Any] | str, now: datetime | None = None, label: str | None = None) -> tuple[list[dict[str, str]], dict[str, Any]]:
    spec = _spec(spec_value, label)
    now = now or datetime.now(KOSOVO_TIME)
    audit: dict[str, Any] = {"source": spec.get("source", ""), "url": spec.get("url", ""), "category": spec.get("category", ""), "status": "error", "entries": 0, "eligible": 0, "old_or_undated": 0}
    try:
        response = requests.get(spec["url"], timeout=(5, 15), headers={"User-Agent": USER_AGENT})
        audit["http_status"] = response.status_code
        response.raise_for_status()
        feed = feedparser.parse(response.content)
        if not feed.entries:
            raise ValueError("empty or non-XML feed")
        audit["entries"] = len(feed.entries)
        audit["status"] = "ok" if feed.entries else "empty_feed"
    except Exception as exc:
        audit["error"] = type(exc).__name__
        publisher = next((p for p in MANIFEST["publishers"] if p["source"] == spec["source"]), None)
        fallback, listing_audit = fetch_listing({**spec, "url": spec.get("listing_url") or "https://" + publisher["domains"][0] + "/"}, now) if publisher else ([], {})
        audit["listing_fallback"] = listing_audit
        audit["eligible"] = len(fallback)
        return fallback, audit

    leads: list[dict[str, str]] = []
    for entry in feed.entries[:100]:
        pub = published_at(entry)
        if pub is None or not is_recent_for_slot(pub, now):
            audit["old_or_undated"] += 1
            continue
        allowed_tags = {fold(tag) for tag in spec.get("allowed_tags", [])}
        entry_tags = {fold(tag.get("term", "")) for tag in entry.get("tags", [])}
        if allowed_tags and not entry_tags.intersection(allowed_tags):
            continue
        title = clean_text(entry.get("title"))
        original_url = str(entry.get("link") or "").strip()
        url = resolve_google_news_url(original_url) if spec.get("wire_substitute") else original_url
        url = canonical(url)
        if not title or not url:
            continue
        source = str(spec.get("source") or "")
        if spec.get("wire_substitute") and " - " in title:
            title, publisher = title.rsplit(" - ", 1)
            source = clean_text(publisher) or source
        summary = clean_text(entry.get("summary"))[:650]
        showbiz_discovery = False
        lead_category = category_for(entry, spec)
        if source_error(lead_category, url) or topic_error(lead_category, title, summary, tags=[tag.get("term", "") for tag in entry.get("tags", [])], url=url):
            audit["off_lane"] = audit.get("off_lane", 0) + 1
            continue
        lead_discovery_only = bool(spec.get("discovery_only")) or showbiz_discovery
        source_key = fold(source)
        # Match Serbian publisher names at a word boundary, not inside RTSH
        # (Albanian public broadcaster) or Gazeta Blic (Kosovo publisher).
        serbian_source = any(source_key == marker or source_key.startswith(marker + " ") for marker in SERBIAN_SOURCE_MARKERS)
        if serbian_source or (urlsplit(url).hostname or "").endswith(".rs"):
            continue
        leads.append({
            "title": title.strip(),
            "url": url,
            "source": source,
            "category": lead_category,
            "lane": str(spec.get("lane") or lead_category or ""),
            "published": pub.astimezone(KOSOVO_TIME).isoformat(timespec="minutes"),
            "summary": summary,
            "discovery_only": lead_discovery_only,
        })
    audit["eligible"] = len(leads)
    return leads, audit


def fetch_listing(spec: dict, now: datetime | None = None):
    """Public HTML discovery, never a paywall or anti-bot bypass."""
    now = now or datetime.now(KOSOVO_TIME)
    audit = {"source": spec["source"], "category": spec["category"], "url": spec["url"],
             "status": "unavailable", "entries": 0, "eligible": 0, "method": "public_listing"}
    try:
        from read_news_source import read
        response = requests.get(spec["url"], timeout=(5, 15), headers={"User-Agent": USER_AGENT})
        audit["http_status"] = response.status_code
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        from urllib.parse import urljoin
        urls = []
        for link in soup.select("a[href]"):
            if len(link.get_text(" ", strip=True)) < 35:
                continue
            url = canonical(urljoin(response.url, link["href"]))
            if url and url not in urls and not source_error(spec["category"], url) and len(urlsplit(url).path) > 12:
                urls.append(url)
        audit["entries"] = len(urls)
        leads = []
        for url in urls[:int(spec.get("listing_limit", 12))]:
            try:
                evidence = read(url)
            except Exception:
                audit["unreadable"] = audit.get("unreadable", 0) + 1
                continue
            if evidence.get("status") != "text_extracted":
                continue
            pub = published_at({"published": evidence.get("published")})
            if not pub or not is_recent_for_slot(pub, now):
                continue
            title = evidence.get("title", "")
            summary = evidence.get("text", "")[:650]
            if topic_error(spec["category"], title, summary, url=url):
                continue
            leads.append({"title": title, "url": url, "source": spec["source"], "category": spec["category"],
                          "lane": spec["category"].upper(), "published": pub.isoformat(), "summary": summary, "discovery_only": False})
        audit.update(status="ok" if urls else "no_article_links", eligible=len(leads))
        return leads, audit
    except Exception as exc:
        audit["error"] = type(exc).__name__
        return [], audit


def rank(lead: dict[str, Any], watchlist: tuple[str, ...] = ()) -> int:
    text = fold(f"{lead.get('title', '')} {lead.get('summary', '')}")
    score = 0
    if re.search(r"\b(kosov|prishtin|shqiper|alban|balkan|diaspor|eu|nato|kfor|viza|migr)\w*", text):
        score += 6
    if re.search(r"\b(njofton|miraton|vendos|fiton|rekord|zbul|rrit|ul|cmim|paga|pune|transfer|final)\w*", text):
        score += 2
    if any(fold(name) in text for name in watchlist):
        score += 5
    if re.search(r"\b(horoskop|sponsoriz|promo|advertorial|coupon|shopping|shop now)\b", text):
        score -= 20
    return score


TOPIC_STOPWORDS = {
    "dhe", "per", "nga", "nje", "me", "ne", "te", "se", "qe", "si", "pas",
    "mbi", "nen", "sot", "kjo", "kete", "the", "and", "for", "from", "with",
    "after", "says", "said", "new", "live", "video", "kosove", "kosova",
    "kosov", "shqiperi", "shqiperia", "albania", "alban", "futboll",
}


def topic_terms(lead: dict[str, Any], include_summary: bool = False) -> set[str]:
    value = str(lead.get("title", ""))
    if include_summary:
        value += " " + str(lead.get("summary", ""))[:240]
    return {
        stem_sq(token)
        for token in re.findall(r"[a-z0-9]+", fold(value))
        if len(token) >= 3 and token not in TOPIC_STOPWORDS
    }


def topic_similarity(left: dict[str, Any], right: dict[str, Any]) -> float:
    left_title = " ".join(sorted(topic_terms(left)))
    right_title = " ".join(sorted(topic_terms(right)))
    left_terms = topic_terms(left)
    right_terms = topic_terms(right)
    if not left_terms or not right_terms:
        return 0.0
    title_overlap = len(left_terms & right_terms) / min(len(left_terms), len(right_terms))
    sequence = SequenceMatcher(None, left_title, right_title).ratio()
    left_context = topic_terms(left, include_summary=True)
    right_context = topic_terms(right, include_summary=True)
    context_overlap = len(left_context & right_context) / min(len(left_context), len(right_context))
    return max(title_overlap, sequence * 0.9, context_overlap * 0.75)


def select_leads(collected: list[dict[str, Any]], limits: dict[str, int] | None = None, watchlist: tuple[str, ...] = (), published_urls: set[str] | tuple[str, ...] = ()) -> list[dict[str, Any]]:
    # Only pass paired leads to the writer. Unpaired RSS items cannot pass the
    # two-source publication gate and previously wasted much of its context.
    limits = limits or {category: MANIFEST["category_limits"][category]["discovery_max"] for category in CATEGORIES}
    seen_urls = {canonical(url) for url in published_urls if canonical(url)}
    seen_titles: set[str] = set()
    unique: list[dict[str, Any]] = []
    for lead in sorted(collected, key=lambda item: (-rank(item, watchlist), item.get("published", ""), item.get("url", ""))):
        url = canonical(lead.get("url", ""))
        title = " ".join(str(lead.get("title", "")).casefold().split())
        if not url or url in seen_urls or source_error(str(lead.get("category", "")), url):
            continue
        seen_urls.add(url)
        seen_titles.add(title)
        unique.append(lead)
    selected: list[dict[str, Any]] = []
    for category, limit in limits.items():
        pool = [lead for lead in unique if lead.get("category") == category]
        used: set[str] = set()
        host_counts: Counter[str] = Counter()
        chosen: list[dict[str, Any]] = []
        pair_target = limit // 2
        for anchor in pool:
            anchor_url = canonical(anchor.get("url", ""))
            if anchor_url in used or len(chosen) // 2 >= pair_target:
                continue
            anchor_host = (urlsplit(anchor_url).hostname or "").removeprefix("www.")
            candidates: list[tuple[float, dict[str, Any]]] = []
            for candidate in pool:
                candidate_url = canonical(candidate.get("url", ""))
                candidate_host = (urlsplit(candidate_url).hostname or "").removeprefix("www.")
                if candidate_url == anchor_url or candidate_url in used or not independent(anchor_url, candidate_url):
                    continue
                candidates.append((topic_similarity(anchor, candidate), candidate))
            if not candidates:
                continue
            score, match = max(candidates, key=lambda item: item[0])
            anchor_terms = topic_terms(anchor)
            match_terms = topic_terms(match)
            shared_terms = len(anchor_terms & match_terms)
            title_overlap = shared_terms / min(len(anchor_terms), len(match_terms))
            if score < 0.40 or shared_terms < 2 or title_overlap < 0.40:
                continue
            match_url = canonical(match.get("url", ""))
            pair_id = f"{category}-{len(chosen) // 2 + 1:02d}"
            first = dict(anchor, pair_id=pair_id, corroborates_url=match_url, pair_score=round(score, 3))
            second = dict(match, pair_id=pair_id, corroborates_url=anchor_url, pair_score=round(score, 3))
            chosen.extend((first, second))
            used.update((anchor_url, match_url))
            host_counts[anchor_host] += 1
            host_counts[(urlsplit(match_url).hostname or "").removeprefix("www.")] += 1
        selected.extend(chosen[:limit])
    return selected


def select_hourly_leads(collected: list[dict[str, Any]], published_urls=()) -> list[dict[str, Any]]:
    """Build a diverse, distinct primary queue; attach corroboration when found.

    Unlike the legacy selector, a routine story is not discarded just because
    another publisher used a different headline or did not cover it.
    """
    excluded = {canonical(url) for url in published_urls}
    result = []
    for category in CATEGORIES:
        unique = {}
        for lead in collected:
            url = canonical(lead.get("url", ""))
            if lead.get("category") == category and url and url not in excluded and not source_error(category, url):
                unique.setdefault(url, lead)
        pool = sorted(unique.values(), key=lambda item: (item.get("published", ""), rank(item)), reverse=True)
        chosen = []
        family_counts = Counter()
        while pool and len(chosen) < MANIFEST["category_limits"][category]["discovery_max"]:
            # Alternate publishers so one busy feed cannot exhaust the queue.
            anchor = min(pool, key=lambda item: family_counts[publisher_for(item["url"])["family"]])
            pool.remove(anchor)
            def compatible(item):
                a = {term for term in topic_terms(anchor) if term.isdigit()}
                b = {term for term in topic_terms(item) if term.isdigit()}
                return not (a and b and a.isdisjoint(b))
            matches = [item for item in pool if compatible(item) and independent(anchor["url"], item["url"])
                       and len(topic_terms(anchor) & topic_terms(item)) >= 2
                       and topic_similarity(anchor, item) >= 0.65]
            match = max(matches, key=lambda item: topic_similarity(anchor, item)) if matches else None
            pair_id = f"{category}-{len(chosen) + 1:02d}"
            chosen.append(dict(anchor, pair_id=pair_id,
                               corroborates_url=match["url"] if match else "",
                               corroborating_source=match.get("source", "") if match else ""))
            family_counts[publisher_for(anchor["url"])["family"]] += 1
            # Strong title overlap collapses the same event across publishers.
            # Loose matches remain available; the editor compares actual claims.
            pool = [item for item in pool if item is not match and not (compatible(item) and
                len(topic_terms(anchor) & topic_terms(item)) >= 3
                and topic_similarity(anchor, item) >= 0.80)]
        result.extend(chosen)
    return result


def _published_urls() -> set[str]:
    try:
        from codex_automation_support import load_env, _published_articles
        load_env()
        return {canonical(item.get("url", "")) for item in _published_articles() if canonical(item.get("url", ""))}
    except Exception as exc:
        raise RuntimeError("published-news prefilter unavailable; refusing an unfiltered run") from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--skip-published", action="store_true")
    args = parser.parse_args()

    collected: list[dict[str, Any]] = []
    audits: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_feed, spec) for spec in DIRECT_FEEDS]
        futures.extend(executor.submit(fetch_listing, spec) for spec in BROWSER_LANES)
        for future in futures:
            leads, audit = future.result()
            collected.extend(leads)
            audits.append(audit)

    published_urls = _published_urls() if args.skip_published else set()
    leads = (select_hourly_leads(collected, published_urls) if os.environ.get("L383_HOURLY_NEWS") == "1"
             else select_leads(collected, published_urls=published_urls))
    counts = dict(Counter(lead["category"] for lead in leads))
    paired_topics = {
        category: len({lead.get("pair_id") for lead in leads if lead.get("category") == category
                       and lead.get("pair_id") and lead.get("corroborates_url")})
        for category in CATEGORIES
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# 383 Lajme discovery — Topic Selection v2",
        "",
        "Leads are untrusted discovery material. Use fetched original-page evidence. Routine reports may use one credited publisher; sensitive claims require two independent publishers supporting the central claim. Never invent a story to fill a category.",
        "",
        "Category inventory: " + json.dumps(counts, ensure_ascii=False),
        "Corroborated topic inventory: " + json.dumps(paired_topics, ensure_ascii=False),
        "Published URL prefilter: " + ("enabled" if args.skip_published else "not requested"),
        "",
    ]
    for category in CATEGORIES:
        lines.extend([f"# {category}", ""])
        for lead in leads:
            if lead["category"] != category:
                continue
            lines.extend([
                f"## {lead['title']}",
                f"- Lane: {lead['lane']}",
                f"- Category locked by feed: {lead['category']}",
                f"- Publisher: {lead['source']}",
                f"- Published: {lead['published']} Kosovo time",
                f"- URL: {lead['url']}",
                f"- Corroboration pair: {lead.get('pair_id', 'none')}",
                f"- Independent corroborating URL: {lead.get('corroborates_url', 'not pre-matched')}",
                f"- Summary (discovery only): {lead['summary'] or 'No RSS summary available.'}",
                f"- Primary-source status: {'discovery-only for this lane' if lead.get('discovery_only') else 'eligible only after independent verification'}",
                "",
            ])
    lines.extend(["# Browser fallback lanes", ""])
    for lane in BROWSER_LANES:
        lines.append(f"- {lane['category']}: {lane['source']} — {lane['url']} ({lane['reason']})")
    lines.extend(["", "# Social-discovery reminder", "", "The last30days/social engine may supply candidates, but it cannot fill a quota by itself. Apply the same lane quotas, Prishtina test, hard bans, title rules, city inference and two-source gate.", ""])
    args.output.write_text("\n".join(lines), encoding="utf-8")
    args.output.with_suffix(".json").write_text(json.dumps({
        "generated_at": datetime.now(KOSOVO_TIME).isoformat(),
        "categories": counts,
        "corroborated_topics": paired_topics,
        "published_prefilter": bool(args.skip_published),
        "browser_lanes": list(BROWSER_LANES),
        "searches": [{"query": query, "lane": lane} for query, lane in SEARCHES],
        "sources": audits,
        "leads": leads,
        "raw_categories": dict(Counter(lead["category"] for lead in collected)),
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("DISCOVERY " + json.dumps({
        "selected": len(leads),
        "raw_current_day": len(collected),
        "categories": counts,
        "corroborated_topics": paired_topics,
        "working_feeds": sum(audit.get("status") == "ok" for audit in audits),
        "total_feeds": len(audits),
        "browser_lanes": len(BROWSER_LANES),
    }, ensure_ascii=False))
    return 0 if collected or any(a.get("status") == "ok" or a.get("listing_fallback", {}).get("status") == "ok" for a in audits) else 2


if __name__ == "__main__":
    raise SystemExit(main())
