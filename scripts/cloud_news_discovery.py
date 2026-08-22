#!/usr/bin/env python3
"""Build a small, current-day web lead file for the hosted Codex news run.

This is intentionally a discovery layer, not a publisher. It keeps the cloud
pipeline useful when an optional last30days web-search backend is unavailable.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote_plus

import feedparser
import requests
from googlenewsdecoder import gnewsdecoder
from zoneinfo import ZoneInfo


KOSOVO_TIME = ZoneInfo("Europe/Belgrade")
USER_AGENT = "383LajmeCloudDiscovery/1.0 (+https://383lajme.vercel.app)"

# Sources are varied deliberately. Google News feeds point to underlying
# publishers; the model must still open and verify the original article.
SEARCHES = (
    ("Kosovo when:1d", "Kosovo / international"),
    ("Kosovo Pristina government parliament election EU when:1d", "Kosovo politics"),
    ("Kosovo economy prices jobs energy when:1d", "Kosovo / economy"),
    ("Kosovo Kurti Osmani police court protest when:1d", "Kosovo / public debate"),
    ("site:euronews.al Kosovë Kosovo Kurti parlament qeveri protestë when:1d", "Euronews Albania / Kosovo breaking"),
    ("site:euronews.al Shqipëri Tirana qeveri parlament polici ekonomi when:1d", "Euronews Albania / Albania breaking"),
    ("Kosovo parliament Albin Kurti protest incident breaking when:1d", "Kosovo breaking politics"),
    ("site:reuters.com Kosovo Albania Kurti parliament government when:1d", "Reuters Kosovo / Albania"),
    ("site:apnews.com Kosovo Albania Kurti parliament government when:1d", "AP Kosovo / Albania"),
    ("site:balkaninsight.com Kosovo Albania Kurti parliament when:1d", "Balkan Insight Kosovo / Albania"),
    ("site:prishtinainsight.com Kosovo Kurti parliament government when:1d", "Prishtina Insight Kosovo"),
    ("Kosovo Albania diaspora when:1d", "Kosovo / diaspora"),
    ("Kosovo football basketball judo when:1d", "Sport"),
    ("Premier League La Liga Serie A Bundesliga Champions League Europa League Conference League NBA F1 when:1d", "Major sport"),
    ("site:espn.com football NBA Formula 1 when:1d", "ESPN major sport"),
    ("site:formula1.com Formula 1 race driver team when:1d", "Formula 1 official"),
    ("site:uefa.com Champions League Europa League Conference League when:1d", "UEFA official"),
    ("site:nba.com NBA team player injury trade when:1d", "NBA official"),
    ("site:footballtransfers.com football transfer when:1d", "FootballTransfers"),
    ("Fabrizio Romano 433 football transfer when:1d", "Verified social sport leads"),
    ("Albania Kosovo celebrity music showbiz Dua Lipa Rita Ora when:1d", "Albanian showbiz"),
    ("Dua Lipa Rita Ora celebrity controversy music when:1d", "Dua Lipa / Rita Ora"),
    ("Kosovo politics government parliament election EU diplomacy sanctions when:1d", "Kosovo politics"),
    ("Europe politics election EU government diplomacy sanctions when:1d", "European politics"),
    ("Kosovo economy inflation wages jobs energy prices investment when:1d", "Kosovo economy"),
    ("oil price stock market Wall Street European economy company earnings when:1d", "World economy"),
    ("Bitcoin crypto price regulation Clarity Act ETF when:1d", "Crypto economy"),
    ("tariffs trade war investment conflict war geopolitics when:1d", "World conflicts and tariffs"),
    ("artificial intelligence robotics OpenAI Anthropic Google when:1d", "Technology"),
    ("site:therundown.ai AI when:1d", "The Rundown AI"),
    ("celebrity music entertainment controversy when:1d", "Global showbiz"),
)

DIRECT_FEEDS = (
    ("https://euronews.al/feed/", "Euronews Albania"),
    ("https://balkaninsight.com/tag/kosovo/feed/", "Balkan Insight"),
    ("https://europeanwesternbalkans.com/feed/", "European Western Balkans"),
    ("https://prishtinainsight.com/feed/", "Prishtina Insight"),
    ("https://rss.dw.com/rdf/rss-en-europe", "DW Europe"),
    ("https://feeds.bbci.co.uk/news/world/europe/rss.xml", "BBC Europe"),
    ("https://www.france24.com/en/europe/rss", "France 24 Europe"),
    ("https://www.aljazeera.com/xml/rss/all.xml", "Al Jazeera"),
    ("https://rss.dw.com/rdf/rss-en-bus", "DW Business"),
    ("https://feeds.bbci.co.uk/news/business/rss.xml", "BBC Business"),
    ("https://feeds.bbci.co.uk/sport/rss.xml", "BBC Sport"),
    ("https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", "BBC Culture"),
    ("https://www.espn.com/espn/rss/news", "ESPN"),
    ("https://www.theguardian.com/uk/business/rss", "The Guardian Business"),
    ("https://www.theguardian.com/uk/sport/rss", "The Guardian Sport"),
    ("https://www.theguardian.com/culture/rss", "The Guardian Culture"),
    ("https://techcrunch.com/feed/", "TechCrunch"),
    ("https://www.coindesk.com/arc/outboundfeeds/rss/", "CoinDesk"),
)

KOSOVO_COMPETITOR_MARKERS = (
    "koha", "telegrafi", "gazeta express", "kosovapress", "rtk",
    "zeri", "indeksonline", "insajderi", "bota sot", "rtv21",
    "dukagjini", "kallxo", "kohanet",
)
SERBIAN_SOURCE_MARKERS = (
    "b92", "kurir", "informer", "pink", "novosti", "blic", "danas",
    "politika", "rts", "n1 serbia", "nova rs", "kosovo online",
)


def google_news_url(query: str, language: str = "en", country: str = "US", ceid: str = "US:en") -> str:
    return f"https://news.google.com/rss/search?q={quote_plus(query)}&hl={language}&gl={country}&ceid={ceid}"


def resolve_google_news_url(url: str) -> str:
    """Decode a Google News RSS intermediary into the publisher's article URL.

    Google no longer serves a normal HTTP redirect for RSS article links.  Its
    batchexecute endpoint is required to recover the original publisher URL.
    A failed decode deliberately leaves the intermediary URL intact, so the
    later strict verifier can reject it instead of publishing from Google.
    """
    if "news.google.com/" not in url:
        return url
    try:
        decoded = gnewsdecoder(url).get("decoded_url")
    except Exception as exc:
        print(f"DISCOVERY warn Google News decode: {type(exc).__name__}")
        return url
    if isinstance(decoded, str) and decoded.startswith(("https://", "http://")) and "news.google.com/" not in decoded:
        return decoded
    print("DISCOVERY warn Google News decode: no original publisher URL")
    return url


def published_at(entry: object) -> datetime | None:
    values = getattr(entry, "get", lambda *_: None)
    parsed = values("published_parsed") or values("updated_parsed")
    if parsed:
        return datetime(*parsed[:6], tzinfo=timezone.utc)
    for key in ("published", "updated"):
        raw = values(key)
        if not raw:
            continue
        try:
            result = parsedate_to_datetime(raw)
            return result.astimezone(timezone.utc) if result.tzinfo else result.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError, IndexError):
            continue
    return None


def clean_text(value: object) -> str:
    text = str(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    if "Ã" in text:
        try:
            text = text.encode("latin-1").decode("utf-8")
        except UnicodeError:
            pass
    return " ".join(text.replace("<br>", " ").replace("<br/>", " ").split())


def fetch_feed(feed_url: str, label: str) -> list[dict[str, str]]:
    try:
        response = requests.get(feed_url, timeout=15, headers={"User-Agent": USER_AGENT})
        response.raise_for_status()
        feed = feedparser.parse(response.content)
    except requests.RequestException as exc:
        print(f"DISCOVERY warn {label}: {type(exc).__name__}")
        return []

    now = datetime.now(KOSOVO_TIME)
    freshest_allowed = now.astimezone(timezone.utc).timestamp() - 36 * 60 * 60
    leads: list[dict[str, str]] = []
    for entry in feed.entries[:35]:
        pub = published_at(entry)
        if pub is None or pub.timestamp() < freshest_allowed:
            continue
        title = clean_text(entry.get("title"))
        url = str(entry.get("link") or "").strip()
        if not title or not url:
            continue
        summary = clean_text(entry.get("summary"))[:600]
        if "news.google.com" in feed_url:
            url = resolve_google_news_url(url)
        if "news.google.com" in feed_url and " - " in title:
            title, publisher = title.rsplit(" - ", 1)
            source = publisher.strip() or label
        else:
            source = label
        source_key = source.lower().replace(".", "")
        if any(marker.replace(".", "") in source_key for marker in KOSOVO_COMPETITOR_MARKERS):
            continue
        if any(marker.replace(".", "") in source_key for marker in SERBIAN_SOURCE_MARKERS) or ".rs/" in url.lower():
            continue
        leads.append(
            {
                "title": title.strip(),
                "url": url,
                "source": source,
                "lane": label,
                "published": pub.astimezone(KOSOVO_TIME).isoformat(timespec="minutes"),
                "summary": summary,
            }
        )
    return leads


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    feeds: list[tuple[str, str]] = [
        (google_news_url(*search[0:1], *(search[2:] or ("en", "US", "US:en"))), search[1])
        for search in SEARCHES
    ]
    feeds.extend(DIRECT_FEEDS)

    collected: list[dict[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_feed, url, label) for url, label in feeds]
        for future in concurrent.futures.as_completed(futures):
            collected.extend(future.result())

    unique: dict[str, dict[str, str]] = {}
    for lead in collected:
        key = " ".join(lead["title"].lower().split())
        unique.setdefault(key, lead)
    leads = sorted(unique.values(), key=lambda item: (item["published"], item["lane"]), reverse=True)[:100]

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Current-day web/RSS discovery",
        "",
        "These are leads only. Open the original publisher, verify the facts and image, then publish only material dated today in Kosovo time.",
        "",
    ]
    for lead in leads:
        lines.extend(
            [
                f"## {lead['title']}",
                f"- Lane: {lead['lane']}",
                f"- Publisher: {lead['source']}",
                f"- Published: {lead['published']} Kosovo time",
                f"- URL: {lead['url']}",
                f"- Summary: {lead['summary'] or 'No RSS summary available.'}",
                "",
            ]
        )
    output.write_text("\n".join(lines), encoding="utf-8")
    print(f"DISCOVERY wrote {len(leads)} current-day web/RSS leads to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
