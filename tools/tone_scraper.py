"""
Scrapes Kosovo-related news from Google News RSS per country,
classifies outlet sentiment via Groq, outputs public/tone-outlets.json.
Run daily via GitHub Actions or manually: python tools/tone_scraper.py
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import feedparser
from groq import Groq

OUTPUT_PATH = Path(__file__).parent.parent / "public" / "tone-outlets.json"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

FEEDS = {
    "Gjermani": "https://news.google.com/rss/search?q=Kosovo&hl=de&gl=DE&ceid=DE:de",
    "SHBA":     "https://news.google.com/rss/search?q=Kosovo&hl=en-US&gl=US&ceid=US:en",
    "Britani":  "https://news.google.com/rss/search?q=Kosovo&hl=en-GB&gl=GB&ceid=GB:en",
    "Francë":   "https://news.google.com/rss/search?q=Kosovo&hl=fr&gl=FR&ceid=FR:fr",
    "Itali":    "https://news.google.com/rss/search?q=Kosovo&hl=it&gl=IT&ceid=IT:it",
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


def heuristic_sentiment(title: str) -> str:
    text = title.lower()
    negative_words = [
        "war", "crime", "criminal", "attack", "tension", "conflict", "ban",
        "condemned", "corruption", "arrest", "sanction", "crisis", "threat",
        "violence", "protest", "failure", "failed",
    ]
    positive_words = [
        "cooperation", "agreement", "win", "growth", "investment", "support",
        "progress", "approved", "success", "opens", "joins", "deal",
    ]
    if any(word in text for word in negative_words):
        return "negative"
    if any(word in text for word in positive_words):
        return "positive"
    return "neutral"


def classify_sentiment(client: Groq | None, articles: list[dict]) -> list[str]:
    if not articles:
        return []
    if client is None:
        return [heuristic_sentiment(a["title"]) for a in articles]

    titles = "\n".join(f"{i+1}. {a['title']}" for i, a in enumerate(articles))
    prompt = (
        "Classify each Kosovo news headline as: positive, neutral, or negative.\n"
        "Reply with ONLY a comma-separated list matching the order, e.g.: positive,neutral,negative\n\n"
        f"{titles}"
    )
    try:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=64,
            temperature=0,
        )
        labels = [
            l.strip().lower()
            for l in resp.choices[0].message.content.strip().split(",")
        ]
        valid = {"positive", "neutral", "negative"}
        labels = [l if l in valid else "neutral" for l in labels]
        if len(labels) < len(articles):
            labels.extend("neutral" for _ in range(len(articles) - len(labels)))
        return labels[: len(articles)]
    except Exception as e:
        print(f"  Groq error: {e}", file=sys.stderr)
        return [heuristic_sentiment(a["title"]) for a in articles]


def scrape_country(country: str, feed_url: str, client: Groq | None) -> list[dict]:
    print(f"  Fetching {country}...")
    feed = feedparser.parse(feed_url)

    # Group articles by outlet
    by_outlet: dict[str, list[dict]] = {}
    for entry in feed.entries[:40]:
        url = entry.get("link", "")
        title = entry.get("title", "").strip()
        published = entry.get("published", "")[:10] if entry.get("published") else ""
        source = entry.get("source") or {}
        outlet = extract_outlet(url, country, source.get("title", ""))
        if not outlet or not title:
            continue
        by_outlet.setdefault(outlet, []).append(
            {"title": title, "url": url, "date": published}
        )

    # Classify sentiment per outlet (batch titles)
    results = []
    for outlet_name, articles in by_outlet.items():
        articles = articles[:6]
        sentiments = classify_sentiment(client, articles)
        # Majority vote for outlet-level sentiment
        from collections import Counter
        vote = Counter(sentiments).most_common(1)[0][0] if sentiments else "neutral"
        results.append(
            {
                "name": outlet_name,
                "sentiment": vote,
                "articleCount": len(articles),
                "articles": [
                    {**a, "sentiment": sentiments[i] if i < len(sentiments) else "neutral"}
                    for i, a in enumerate(articles)
                ],
            }
        )

    return sorted(results, key=lambda o: o["name"])


def main():
    api_key = os.environ.get("GROQ_API_KEY")
    if api_key:
        client = Groq(api_key=api_key)
    else:
        client = None
        print("GROQ_API_KEY not set; using heuristic tone labels", file=sys.stderr)
    countries_data: dict[str, dict] = {}

    for country, feed_url in FEEDS.items():
        try:
            outlets = scrape_country(country, feed_url, client)
            countries_data[country] = {"outlets": outlets}
            print(f"  {country}: {len(outlets)} outlets found")
        except Exception as e:
            print(f"  {country} failed: {e}", file=sys.stderr)

    output = {
        "lastUpdated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "countries": countries_data,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
