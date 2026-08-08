"""
Scrapes Kosovo-related news from Google News RSS per country, classifies
sentiment via Groq (heuristic fallback if no key), and writes two files:

  public/tone-outlets.json  — today's full snapshot, grouped by outlet
                               (drives the "Bota Flet" headlines + the
                               per-country hover drill-down on the homepage)
  public/tone-history.json  — one appended row per day (capped at HISTORY_DAYS),
                               with country-level indices + a handful of the
                               day's most positive/negative headlines. This is
                               what makes "Toni i Mediave" a real time series
                               instead of a single reshuffled snapshot.

Run daily via GitHub Actions or manually: python tools/tone_scraper.py
"""

import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import feedparser
from groq import Groq

ROOT = Path(__file__).parent.parent
OUTLETS_PATH = ROOT / "public" / "tone-outlets.json"
HISTORY_PATH = ROOT / "public" / "tone-history.json"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

# Cap so tone-history.json stays a small, fast-to-fetch file (~4 months of
# daily rows) instead of growing forever.
HISTORY_DAYS = 120

# Below this many deduped articles, a country's index is noisy enough that
# the UI should show it as low-confidence rather than a bare percentage.
MIN_CONFIDENT_N = 8

FEEDS = {
    "Gjermani": "https://news.google.com/rss/search?q=Kosovo&hl=de&gl=DE&ceid=DE:de",
    "SHBA":     "https://news.google.com/rss/search?q=Kosovo&hl=en-US&gl=US&ceid=US:en",
    "Britani":  "https://news.google.com/rss/search?q=Kosovo&hl=en-GB&gl=GB&ceid=GB:en",
    "Francë":   "https://news.google.com/rss/search?q=Kosovo&hl=fr&gl=FR&ceid=FR:fr",
    "Itali":    "https://news.google.com/rss/search?q=Kosovo&hl=it&gl=IT&ceid=IT:it",
}

FLAGS = {
    "Gjermani": "🇩🇪",
    "SHBA": "🇺🇸",
    "Britani": "🇬🇧",
    "Francë": "🇫🇷",
    "Itali": "🇮🇹",
}

KNOWN_OUTLETS: dict[str, dict[str, str]] = {
    "Gjermani": {
        "spiegel.de": "Der Spiegel",
        "sueddeutsche.de": "Süddeutsche Zeitung",
        "zeit.de": "Die Zeit",
        "faz.net": "FAZ",
        "bild.de": "Bild",
        "tagesschau.de": "Tagesschau",
    },
    "SHBA": {
        "apnews.com": "AP",
        "washingtonpost.com": "Washington Post",
        "nytimes.com": "New York Times",
        "bloomberg.com": "Bloomberg",
        "theatlantic.com": "The Atlantic",
        "politico.com": "Politico",
    },
    "Britani": {
        "theguardian.com": "Guardian",
        "bbc.com": "BBC",
        "bbc.co.uk": "BBC",
        "reuters.com": "Reuters",
        "independent.co.uk": "Independent",
        "thetimes.co.uk": "The Times",
        "ft.com": "Financial Times",
    },
    "Francë": {
        "lemonde.fr": "Le Monde",
        "lefigaro.fr": "Le Figaro",
        "franceinfo.fr": "France Info",
        "afp.com": "AFP",
        "liberation.fr": "Libération",
    },
    "Itali": {
        "repubblica.it": "La Repubblica",
        "corriere.it": "Corriere della Sera",
        "ansa.it": "ANSA",
        "lastampa.it": "La Stampa",
    },
}


def normalize_outlet(name: str, country: str) -> str | None:
    if not name:
        return None
    clean = re.sub(r"\s+", " ", name).strip()
    clean_lower = clean.lower()
    for known_name in KNOWN_OUTLETS.get(country, {}).values():
        if clean_lower == known_name.lower():
            return known_name
    return clean


def extract_outlet(url: str, country: str, source_name: str = "") -> str | None:
    outlet = normalize_outlet(source_name, country)
    if outlet:
        return outlet

    try:
        host = urlparse(url).netloc.lower().lstrip("www.")
        for domain, name in KNOWN_OUTLETS.get(country, {}).items():
            if domain in host:
                return name
    except Exception:
        pass
    return None


def normalize_title(title: str) -> str:
    """Collapse a headline to a dedupe key. Wire copy (AP/AFP/Reuters) gets
    reprinted near-verbatim by many outlets in the same country; without this,
    one wire story inflates whichever sentiment it carries across 5+ outlets."""
    stripped = re.sub(r"[^\w]+", " ", title.lower(), flags=re.UNICODE)
    return re.sub(r"\s+", " ", stripped).strip()[:80]


def heuristic_sentiment(text: str) -> str:
    t = text.lower()
    negative_words = [
        "war", "crime", "criminal", "attack", "tension", "conflict", "ban",
        "condemned", "corruption", "arrest", "sanction", "crisis", "threat",
        "violence", "protest", "failure", "failed",
    ]
    positive_words = [
        "cooperation", "agreement", "win", "growth", "investment", "support",
        "progress", "approved", "success", "opens", "joins", "deal",
    ]
    if any(word in t for word in negative_words):
        return "negative"
    if any(word in t for word in positive_words):
        return "positive"
    return "neutral"


def classify_sentiment(client: "Groq | None", articles: list[dict]) -> list[str]:
    """Classifies on title + snippet — title-only misses tone the RSS
    description often carries (e.g. a neutral-sounding title over a critical
    piece)."""
    if not articles:
        return []
    texts = [f"{a['title']} — {a.get('summary', '')}".strip(" —") for a in articles]
    if client is None:
        return [heuristic_sentiment(t) for t in texts]

    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(texts))
    prompt = (
        "Classify each Kosovo-related news item (headline + snippet) as: "
        "positive, neutral, or negative — from the standpoint of how it "
        "portrays Kosovo.\n"
        "Reply with ONLY a comma-separated list matching the order, e.g.: "
        "positive,neutral,negative\n\n"
        f"{numbered}"
    )
    try:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=96,
            temperature=0,
        )
        labels = [
            l.strip().lower()
            for l in resp.choices[0].message.content.strip().split(",")
        ]
        valid = {"positive", "neutral", "negative"}
        labels = [l if l in valid else "neutral" for l in labels]
        if len(labels) < len(texts):
            labels.extend("neutral" for _ in range(len(texts) - len(labels)))
        return labels[: len(texts)]
    except Exception as e:
        print(f"  Groq error: {e}", file=sys.stderr)
        return [heuristic_sentiment(t) for t in texts]


def scrape_country(country: str, feed_url: str, client: "Groq | None") -> tuple[list[dict], int]:
    """Returns (outlets, duplicates_dropped)."""
    print(f"  Fetching {country}...")
    feed = feedparser.parse(feed_url)

    by_outlet: dict[str, list[dict]] = {}
    seen_titles: set[str] = set()
    duplicates_dropped = 0
    for entry in feed.entries[:60]:
        url = entry.get("link", "")
        title = entry.get("title", "").strip()
        summary = re.sub(r"<[^>]+>", "", entry.get("summary", "") or "").strip()
        published = entry.get("published", "")[:10] if entry.get("published") else ""
        source = entry.get("source") or {}
        outlet = extract_outlet(url, country, source.get("title", ""))
        if not outlet or not title:
            continue

        key = normalize_title(title)
        if key in seen_titles:
            duplicates_dropped += 1
            continue
        seen_titles.add(key)

        by_outlet.setdefault(outlet, []).append(
            {"title": title, "summary": summary, "url": url, "date": published}
        )

    results = []
    for outlet_name, articles in by_outlet.items():
        articles = articles[:6]
        sentiments = classify_sentiment(client, articles)
        vote = Counter(sentiments).most_common(1)[0][0] if sentiments else "neutral"
        results.append(
            {
                "name": outlet_name,
                "sentiment": vote,
                "articleCount": len(articles),
                "articles": [
                    {
                        "title": a["title"],
                        "url": a["url"],
                        "date": a["date"],
                        "sentiment": sentiments[i] if i < len(sentiments) else "neutral",
                    }
                    for i, a in enumerate(articles)
                ],
            }
        )

    return sorted(results, key=lambda o: o["name"]), duplicates_dropped


def country_index(positive: int, neutral: int, negative: int) -> int | None:
    """0–100 scale: 100 = all positive, 0 = all negative, 50 = split evenly
    between positive/negative (neutral doesn't pull the needle either way)."""
    total = positive + neutral + negative
    if total == 0:
        return None
    return round(50 + 50 * (positive - negative) / total)


def main():
    api_key = os.environ.get("GROQ_API_KEY")
    if api_key:
        client = Groq(api_key=api_key)
    else:
        client = None
        print("GROQ_API_KEY not set; using heuristic tone labels", file=sys.stderr)

    countries_data: dict[str, dict] = {}
    country_summaries: dict[str, dict] = {}
    all_articles_by_country: dict[str, list[dict]] = {}

    for country, feed_url in FEEDS.items():
        try:
            outlets, dupes = scrape_country(country, feed_url, client)
            countries_data[country] = {"outlets": outlets}

            flat = [
                {**a, "outlet": o["name"]}
                for o in outlets
                for a in o["articles"]
            ]
            all_articles_by_country[country] = flat

            counts = Counter(a["sentiment"] for a in flat)
            positive, neutral, negative = counts.get("positive", 0), counts.get("neutral", 0), counts.get("negative", 0)
            n = positive + neutral + negative
            idx = country_index(positive, neutral, negative)
            country_summaries[country] = {
                "index": idx,
                "positive": round(100 * positive / n) if n else 0,
                "neutral": round(100 * neutral / n) if n else 0,
                "negative": round(100 * negative / n) if n else 0,
                "n": n,
                "confident": n >= MIN_CONFIDENT_N,
            }
            countries_data[country]["summary"] = country_summaries[country]
            print(f"  {country}: {len(outlets)} outlets, {n} articles ({dupes} duplicates dropped)")
        except Exception as e:
            print(f"  {country} failed: {e}", file=sys.stderr)
            country_summaries[country] = {"index": None, "positive": 0, "neutral": 0, "negative": 0, "n": 0, "confident": False}
            all_articles_by_country[country] = []

    total_articles = sum(s["n"] for s in country_summaries.values())
    weighted_sum = sum(
        s["index"] * s["n"] for s in country_summaries.values() if s["index"] is not None
    )
    overall_index = round(weighted_sum / total_articles) if total_articles else None
    source_count = sum(len(c["outlets"]) for c in countries_data.values())
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    outlets_output = {
        "lastUpdated": today,
        "overallIndex": overall_index,
        "totalArticles": total_articles,
        "sourceCount": source_count,
        "countries": countries_data,
    }
    OUTLETS_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTLETS_PATH.write_text(json.dumps(outlets_output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUTLETS_PATH}")

    # ── History row: 3 most positive + 3 most negative headlines of the day,
    # picked across all countries, so a later index swing has a "why" attached.
    # Round-robin by country (not a flat slice) — the 5 countries are scraped
    # in a fixed order, so a flat [:3] silently picked all 3 from whichever
    # country happened to list its articles first, defeating the point of a
    # multi-country picture. Also dedupes wire copy that's identical across
    # countries' English-language editions (SHBA/Britani both run AP/Reuters).
    def pick_diverse(sentiment: str, limit: int) -> list[dict]:
        seen_titles: set[str] = set()
        buckets = {
            country: [a for a in arts if a["sentiment"] == sentiment]
            for country, arts in all_articles_by_country.items()
        }
        picked: list[dict] = []
        cursors = {country: 0 for country in buckets}
        progressed = True
        while len(picked) < limit and progressed:
            progressed = False
            for country, arts in buckets.items():
                if len(picked) >= limit:
                    break
                while cursors[country] < len(arts):
                    article = arts[cursors[country]]
                    cursors[country] += 1
                    key = normalize_title(article["title"])
                    if key in seen_titles:
                        continue
                    seen_titles.add(key)
                    picked.append({**article, "country": country, "flag": FLAGS.get(country, "")})
                    progressed = True
                    break
        return picked

    positives = pick_diverse("positive", 3)
    negatives = pick_diverse("negative", 3)
    headlines = [
        {
            "title": a["title"],
            "source": a["outlet"],
            "country": a["country"],
            "flag": a["flag"],
            "url": a["url"],
            "sentiment": a["sentiment"],
        }
        for a in positives + negatives
    ]

    history: list[dict] = []
    if HISTORY_PATH.exists():
        try:
            history = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
            if not isinstance(history, list):
                history = []
        except Exception:
            history = []

    # Re-running the same day (manual test, workflow retry) replaces today's
    # row instead of appending a duplicate.
    history = [row for row in history if row.get("date") != today]
    history.append(
        {
            "date": today,
            "overallIndex": overall_index,
            "totalArticles": total_articles,
            "sourceCount": source_count,
            "countries": country_summaries,
            "headlines": headlines,
        }
    )
    history.sort(key=lambda row: row["date"])
    history = history[-HISTORY_DAYS:]

    HISTORY_PATH.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {HISTORY_PATH} ({len(history)} days of history)")


if __name__ == "__main__":
    main()
