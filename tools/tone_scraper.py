"""
Scrapes Kosovo-related news from Google News RSS per country,
classifies outlet sentiment via Groq, outputs public/tone-outlets.json.
Run daily via GitHub Actions or manually: python tools/tone_scraper.py
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import feedparser
from groq import Groq

OUTPUT_PATH = Path(__file__).parent.parent / "public" / "tone-outlets.json"

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


def extract_outlet(url: str, country: str) -> str | None:
    try:
        host = urlparse(url).netloc.lower().lstrip("www.")
        for domain, name in KNOWN_OUTLETS.get(country, {}).items():
            if domain in host:
                return name
    except Exception:
        pass
    return None


def classify_sentiment(client: Groq, articles: list[dict]) -> list[str]:
    if not articles:
        return []
    titles = "\n".join(f"{i+1}. {a['title']}" for i, a in enumerate(articles))
    prompt = (
        "Classify each Kosovo news headline as: positive, neutral, or negative.\n"
        "Reply with ONLY a comma-separated list matching the order, e.g.: positive,neutral,negative\n\n"
        f"{titles}"
    )
    try:
        resp = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=64,
            temperature=0,
        )
        labels = [
            l.strip().lower()
            for l in resp.choices[0].message.content.strip().split(",")
        ]
        valid = {"positive", "neutral", "negative"}
        return [l if l in valid else "neutral" for l in labels]
    except Exception as e:
        print(f"  Groq error: {e}", file=sys.stderr)
        return ["neutral"] * len(articles)


def scrape_country(country: str, feed_url: str, client: Groq) -> list[dict]:
    print(f"  Fetching {country}...")
    feed = feedparser.parse(feed_url)

    # Group articles by outlet
    by_outlet: dict[str, list[dict]] = {}
    for entry in feed.entries[:40]:
        url = entry.get("link", "")
        title = entry.get("title", "").strip()
        published = entry.get("published", "")[:10] if entry.get("published") else ""
        outlet = extract_outlet(url, country)
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
    if not api_key:
        print("GROQ_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client = Groq(api_key=api_key)
    countries_data: dict[str, dict] = {}

    for country, feed_url in FEEDS.items():
        try:
            outlets = scrape_country(country, feed_url, client)
            countries_data[country] = {"outlets": outlets}
            print(f"  {country}: {len(outlets)} outlets found")
        except Exception as e:
            print(f"  {country} failed: {e}", file=sys.stderr)

    output = {
        "lastUpdated": datetime.utcnow().strftime("%Y-%m-%d"),
        "countries": countries_data,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
