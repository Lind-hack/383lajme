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
import re
import unicodedata
from collections import Counter
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

import feedparser
import requests

try:
    from googlenewsdecoder import gnewsdecoder
except ImportError:  # pragma: no cover - optional decoder in minimal test envs
    gnewsdecoder = None


KOSOVO_TIME = ZoneInfo("Europe/Belgrade")
USER_AGENT = "383LajmeDiscovery/2.0 (+https://383ks.com)"

# Exact feed inventory supplied in Topic Selection v2. Each item is tagged by
# editorial lane; the writer must not reclassify a lead based only on a snippet.
DIRECT_FEEDS: tuple[dict[str, Any], ...] = (
    {"url": "https://telegrafi.com/feed/", "source": "Telegrafi", "category": "Kosovë", "lane": "KOSOVË", "mixed": True},
    {"url": "https://www.koha.net/rss", "source": "Koha", "category": "Kosovë", "lane": "KOSOVË"},
    {"url": "https://www.gazetaexpress.com/feed/", "source": "Gazeta Express", "category": "Kosovë", "lane": "KOSOVË"},
    {"url": "https://indeksonline.net/feed/", "source": "Indeksonline", "category": "Kosovë", "lane": "KOSOVË"},
    {"url": "https://kallxo.com/feed/", "source": "Kallxo", "category": "Kosovë", "lane": "KOSOVË"},
    {"url": "https://gazetablic.com/feed/", "source": "Gazeta Blic", "category": "Kosovë", "lane": "KOSOVË"},
    {"url": "https://www.news24.al/feed/", "source": "News24", "category": "Shqipëri", "lane": "SHQIPËRI"},
    {"url": "https://www.balkanweb.com/feed/", "source": "BalkanWeb", "category": "Shqipëri", "lane": "SHQIPËRI"},
    {"url": "https://euronews.al/feed/", "source": "Euronews Albania", "category": "Shqipëri", "lane": "SHQIPËRI"},
    {"url": "https://abcnews.al/feed/", "source": "ABC News Albania", "category": "Shqipëri", "lane": "SHQIPËRI"},
    {"url": "https://news.google.com/rss?hl=en&gl=US&ceid=US:en", "source": "Google News RSS", "category": "Botë", "lane": "BOTË", "wire_substitute": True},
    {"url": "http://feeds.bbci.co.uk/news/world/rss.xml", "source": "BBC World", "category": "Botë", "lane": "BOTË"},
    {"url": "https://www.aljazeera.com/xml/rss/all.xml", "source": "Al Jazeera", "category": "Botë", "lane": "BOTË"},
    {"url": "https://www.euronews.com/rss?format=mrss", "source": "Euronews", "category": "Botë", "lane": "BOTË"},
    {"url": "https://balkaninsight.com/feed/", "source": "Balkan Insight", "category": "Botë", "lane": "BOTË"},
    {"url": "https://www.politico.eu/feed/", "source": "POLITICO Europe", "category": "Botë", "lane": "BOTË"},
    {"url": "http://feeds.bbci.co.uk/sport/rss.xml", "source": "BBC Sport", "category": "Sport", "lane": "SPORT"},
    {"url": "https://www.skysports.com/rss/12040", "source": "Sky Sports", "category": "Sport", "lane": "SPORT"},
    {"url": "https://telegrafi.com/category/sport/feed/", "source": "Telegrafi Sport", "category": "Sport", "lane": "SPORT", "discovery_only": True},
)

# No public RSS was verified for these sources. They remain explicit fallback
# lanes rather than silently disappearing or being replaced by banned filler.
BROWSER_LANES = (
    {"source": "RTK Live", "url": "https://www.rtklive.com/", "category": "Kosovë", "reason": "Cloudflare blocks server fetches"},
    {"source": "Top Channel", "url": "https://top-channel.tv/", "category": "Shqipëri", "reason": "Cloudflare blocks server fetches"},
    {"source": "Klan Kosova", "url": "https://klankosova.tv/", "category": "Kosovë", "reason": "Cloudflare/no reliable public RSS"},
    {"source": "JOQ Albania", "url": "https://joq-albania.com/", "category": "Shqipëri", "reason": "no public RSS found"},
    {"source": "SuperSport Albania", "url": "https://supersport.al/", "category": "Sport", "reason": "no public RSS found"},
    {"source": "Shqiptarja", "url": "https://shqiptarja.com/", "category": "Shqipëri", "reason": "feed path returns 404"},
    {"source": "Prive", "url": "https://prive.al/", "category": "Showbiz", "reason": "empty server responses"},
    {"source": "Gazeta Olle", "url": "https://gazetaolle.com/", "category": "Sport", "reason": "empty server responses; unreliable"},
)


def _load_verified_manifest() -> None:
    global DIRECT_FEEDS, BROWSER_LANES
    manifest = Path(__file__).with_name("news_sources.json")
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    feeds = data.get("feeds")
    browser_lanes = data.get("browser_lanes")
    if isinstance(feeds, list) and feeds:
        DIRECT_FEEDS = tuple(item for item in feeds if isinstance(item, dict) and item.get("url"))
    if isinstance(browser_lanes, list) and browser_lanes:
        BROWSER_LANES = tuple(item for item in browser_lanes if isinstance(item, dict) and item.get("url"))


_load_verified_manifest()

SEARCHES = (
    ("Kosovë Prishtinë government economy prices when:1d", "KOSOVË social-discovery"),
    ("Shqipëri Tiranë government economy when:1d", "SHQIPËRI social-discovery"),
    ("Kosovo Albania EU NATO KFOR diaspora migration when:1d", "BOTË Kosovo-angle social-discovery"),
    ("Kosovo Drita Ballkani Prishtina Llapi Champions League when:1d", "SPORT social-discovery"),
    ("Dua Lipa Rita Ora Bebe Rexha Netflix when:1d", "SHOWBIZ social-discovery"),
)

SERBIAN_SOURCE_MARKERS = (
    "b92", "kurir", "informer", "pink", "novosti", "blic", "danas", "politika", "rts", "n1 serbia", "nova rs", "kosovo online",
)
SHOWBIZ_DISCOVERY_MARKERS = (
    "showbiz", "muzik", "kenge", "keng", "aktor", "aktore", "film", "serial", "netflix",
    "dua lipa", "rita ora", "bebe rexha", "era istrefi", "taylor swift", "grammy", "oscar",
    "ledri", "bertan", "elijona", "klodi", "kinematograf", "hite", "artist", "kend",
)


def _is_showbiz_discovery(spec: dict[str, Any], title: str, summary: str) -> bool:
    if not spec.get("mixed") or fold(spec.get("source")) != "telegrafi":
        return False
    text = fold(f"{title} {summary}")
    for marker in SHOWBIZ_DISCOVERY_MARKERS:
        marker = fold(marker)
        if " " in marker and marker in text:
            return True
        if " " not in marker and re.search(r"(?<!\w)" + re.escape(marker) + r"\w*", text):
            return True
    return False

def fold(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").casefold())
    return "".join(char for char in text if not unicodedata.combining(char))


def clean_text(value: object) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))
    if "Ã" in text:
        try:
            text = text.encode("latin-1").decode("utf-8")
        except UnicodeError:
            pass
    return " ".join(text.replace("<br>", " ").replace("<br/>", " ").split())


def canonical(url: str) -> str:
    parsed = urlsplit(str(url or "").strip())
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


def fetch_feed(spec_value: dict[str, Any] | str, now: datetime | None = None, label: str | None = None) -> tuple[list[dict[str, str]], dict[str, Any]]:
    spec = _spec(spec_value, label)
    now = now or datetime.now(KOSOVO_TIME)
    audit: dict[str, Any] = {"source": spec.get("source", ""), "url": spec.get("url", ""), "category": spec.get("category", ""), "status": "error", "entries": 0, "eligible": 0, "old_or_undated": 0}
    try:
        response = requests.get(spec["url"], timeout=(5, 15), headers={"User-Agent": USER_AGENT})
        audit["http_status"] = response.status_code
        response.raise_for_status()
        feed = feedparser.parse(response.content)
        audit["entries"] = len(feed.entries)
        audit["status"] = "ok" if feed.entries else "empty_feed"
    except Exception as exc:
        audit["error"] = type(exc).__name__
        return [], audit

    leads: list[dict[str, str]] = []
    for entry in feed.entries[:100]:
        pub = published_at(entry)
        if pub is None or pub.astimezone(KOSOVO_TIME).date() != now.astimezone(KOSOVO_TIME).date() or pub > now.astimezone(timezone.utc) + timedelta(minutes=5):
            audit["old_or_undated"] += 1
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
        showbiz_discovery = _is_showbiz_discovery(spec, title, summary)
        lead_category = "Showbiz" if showbiz_discovery else category_for(entry, spec)
        lead_discovery_only = bool(spec.get("discovery_only")) or showbiz_discovery
        source_key = fold(source)
        if any(marker in source_key for marker in SERBIAN_SOURCE_MARKERS) or urlsplit(url).hostname and urlsplit(url).hostname.endswith(".rs"):
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


def select_leads(collected: list[dict[str, Any]], limits: dict[str, int] | None = None, watchlist: tuple[str, ...] = (), published_urls: set[str] | tuple[str, ...] = ()) -> list[dict[str, Any]]:
    limits = limits or {"Kosovë": 30, "Shqipëri": 20, "Botë": 30, "Sport": 20, "Showbiz": 15}
    seen_urls = {canonical(url) for url in published_urls if canonical(url)}
    seen_titles: set[str] = set()
    unique: list[dict[str, Any]] = []
    for lead in sorted(collected, key=lambda item: (-rank(item, watchlist), item.get("published", ""), item.get("url", ""))):
        url = canonical(lead.get("url", ""))
        title = " ".join(str(lead.get("title", "")).casefold().split())
        if not url or url in seen_urls or title in seen_titles:
            continue
        seen_urls.add(url)
        seen_titles.add(title)
        unique.append(lead)
    selected: list[dict[str, Any]] = []
    for category, limit in limits.items():
        pool = [lead for lead in unique if lead.get("category") == category]
        host_counts: Counter[str] = Counter()
        chosen: list[dict[str, Any]] = []
        for lead in pool:
            host = (urlsplit(lead["url"]).hostname or "").removeprefix("www.")
            if host_counts[host] >= 12:
                continue
            chosen.append(lead)
            host_counts[host] += 1
            if len(chosen) >= limit:
                break
        selected.extend(chosen)
    return selected


def _published_urls() -> set[str]:
    try:
        from codex_automation_support import load_env, _published_articles
        load_env()
        return {canonical(item.get("url", "")) for item in _published_articles() if canonical(item.get("url", ""))}
    except Exception:
        return set()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--skip-published", action="store_true")
    args = parser.parse_args()

    collected: list[dict[str, Any]] = []
    audits: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_feed, spec) for spec in DIRECT_FEEDS]
        for future in futures:
            leads, audit = future.result()
            collected.extend(leads)
            audits.append(audit)

    published_urls = _published_urls() if args.skip_published else set()
    leads = select_leads(collected, published_urls=published_urls)
    counts = dict(Counter(lead["category"] for lead in leads))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# 383 Lajme discovery — Topic Selection v2",
        "",
        "Leads are untrusted discovery material, not verified facts. Open the original page and a second independent source before writing. The final run must pass the mandatory 13–20 article quota gate; social discovery cannot decide topics alone.",
        "",
        "Category inventory: " + json.dumps(counts, ensure_ascii=False),
        "Published URL prefilter: " + ("enabled" if args.skip_published else "not requested"),
        "",
    ]
    for category in ("Kosovë", "Shqipëri", "Botë", "Sport", "Showbiz"):
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
        "published_prefilter": bool(args.skip_published),
        "browser_lanes": list(BROWSER_LANES),
        "searches": [{"query": query, "lane": lane} for query, lane in SEARCHES],
        "sources": audits,
        "leads": leads,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("DISCOVERY " + json.dumps({
        "selected": len(leads),
        "raw_current_day": len(collected),
        "categories": counts,
        "working_feeds": sum(audit.get("status") == "ok" for audit in audits),
        "total_feeds": len(audits),
        "browser_lanes": len(BROWSER_LANES),
    }, ensure_ascii=False))
    return 0 if leads else 1


if __name__ == "__main__":
    raise SystemExit(main())
