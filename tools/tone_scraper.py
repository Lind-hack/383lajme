"""
Scrapes Kosovo-related news from Google News RSS per country, classifies
sentiment + translates headlines to Albanian via Groq (heuristic fallback,
no translation, if no key), resolves a real image per article, and writes
three files:

  public/tone-outlets.json       — today's full snapshot, grouped by outlet
                                    (per-country hover drill-down on the
                                    homepage's "Toni i Mediave" dashboard)
  public/tone-history.json       — one row per day (capped at HISTORY_DAYS),
                                    country-level indices + a handful of the
                                    day's most positive/negative headlines —
                                    what makes "Toni i Mediave" a real time
                                    series instead of a reshuffled snapshot.
  public/tone-article-cache.json — persistent, cross-run article cache. This
                                    now runs 9x/day (07:00-23:00 Kosovo time,
                                    matching the main news pipeline), so a
                                    cache is what keeps repeat runs within a
                                    day from re-spending Groq calls and
                                    re-scraping images on stories already
                                    seen a few hours earlier. It's also what
                                    "Bota Flet" reads from directly — see
                                    lib/tone-data.ts:getForeignCoverage().

Run via GitHub Actions (.github/workflows/tone-scraper.yml) or manually:
python tools/tone_scraper.py
"""

import json
import os
import re
import socket
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import feedparser
import requests
from bs4 import BeautifulSoup
from googlenewsdecoder import gnewsdecoder
from groq import Groq

# googlenewsdecoder's internal requests.get()/post() calls (new_decoderv2.py)
# pass no timeout at all — confirmed by reading its source. A single
# unresponsive server would hang that thread forever with no bound anywhere
# else in the call chain. Python's socket module falls back to this global
# default whenever a caller (ours or a third party's) doesn't pass an
# explicit timeout, so this is the actual backstop, not just scrape_og_image's
# explicit timeout=8 below. Must be set before any network call runs.
socket.setdefaulttimeout(15)

ROOT = Path(__file__).parent.parent
OUTLETS_PATH = ROOT / "public" / "tone-outlets.json"
HISTORY_PATH = ROOT / "public" / "tone-history.json"
CACHE_PATH = ROOT / "public" / "tone-article-cache.json"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

# Cap so tone-history.json stays a small, fast-to-fetch file (~4 months of
# daily rows) instead of growing forever.
HISTORY_DAYS = 120

# Below this many deduped articles, a country's index is noisy enough that
# the UI should show it as low-confidence rather than a bare percentage.
MIN_CONFIDENT_N = 8

# Cache retention deliberately wider than Bota Flet's 72h display window
# (lib/tone-data.ts) — survives a workflow outage over a weekend without
# losing data, and keeps this file small (low hundreds of live entries at
# any time, not tens of thousands).
CACHE_RETENTION_DAYS = 7

# A permanently imageless article (paywall, no og:image tag, scraper
# blocked) shouldn't get re-fetched on every one of the 9 daily runs
# forever — cap the retry budget and move on.
MAX_IMAGE_ATTEMPTS = 3
IMAGE_WORKERS = 8
# Hard cap on the whole image-resolution phase, regardless of how many
# stragglers are still running — see the comment at the wait() call below.
IMAGE_BATCH_TIMEOUT = 240

# Small enough that llama-3.1-8b-instant stays coherent across the whole
# numbered list; small enough that one malformed-JSON response only costs
# one chunk's retry, not the whole run's.
TRANSLATE_BATCH_SIZE = 10

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

# Mirrors kosovo_pipeline.py's ALBANIAN_MARKERS / is_albanian_output pattern,
# scaled down for headline-length text (~5-15 words) instead of full
# articles — the original's word-count/ratio thresholds don't transfer to
# something this short; a single ë/ç or one function word is meaningful
# signal at this length.
ALBANIAN_MARKERS = {
    "dhe", "në", "ne", "për", "per", "që", "qe", "është", "eshte",
    "nga", "me", "një", "nje", "të", "te", "si", "por", "kjo", "ky",
    "kanë", "kane", "ishte", "janë", "jane", "do", "kur", "sipas",
    "mes", "pas", "para", "gjatë", "gjate", "kundër", "kunder",
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
    reprinted near-verbatim by many outlets — including across countries'
    English-language editions (SHBA/Britani) — so this key is now also the
    cache key: one Groq call and one image fetch serve every country that
    happens to run the same wire story, instead of paying for it 2-5x."""
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


def is_albanian_text(text: str | None) -> bool:
    if not text:
        return False
    words = re.findall(r"[a-zA-ZÀ-ÿ]+", text.lower())
    if len(words) < 2:
        return False
    if any(ch in text for ch in "ëçËÇ"):
        return True
    return any(w in ALBANIAN_MARKERS for w in words)


# ── Image resolution ─────────────────────────────────────────────────────
# Confirmed via live testing: Google News RSS provides zero per-article
# images (no media:thumbnail, no enclosure, no embedded <img>). Real images
# only exist by resolving the redirect to the real publisher and scraping
# its og:image — mirrors two precedents already live elsewhere in this repo
# rather than inventing a new approach.

def resolve_google_news_url(url: str) -> str:
    """Mirrors scripts/cloud_news_discovery.py:resolve_google_news_url —
    Google News RSS links require the gnewsdecoder batchexecute decode, not
    a plain HTTP redirect. A failed decode leaves the URL unchanged so the
    image step below fails gracefully instead of crashing."""
    if "news.google.com/" not in url:
        return url
    try:
        decoded = gnewsdecoder(url).get("decoded_url")
    except Exception as exc:
        print(f"  image warn: decode failed: {type(exc).__name__}", file=sys.stderr)
        return url
    if isinstance(decoded, str) and decoded.startswith(("https://", "http://")) and "news.google.com/" not in decoded:
        return decoded
    return url


def scrape_og_image(url: str) -> str | None:
    """Mirrors scripts/content_generator.py:scrape_image — og:image meta tag
    only. No AI-generated fallback: the user explicitly rejected a fake
    photo sitting next to a real foreign headline about Kosovo. An article
    with no scrapable image simply doesn't get shown in Bota Flet."""
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return og["content"]
        return None
    except Exception:
        return None


def resolve_article_media(google_news_url: str) -> tuple[str, str | None]:
    """One unit of thread-pool work: redirect-resolve, then scrape og:image
    off the real publisher page. Returns (resolved_url, image_url_or_none)."""
    real_url = resolve_google_news_url(google_news_url)
    image_url = scrape_og_image(real_url)
    return real_url, image_url


# ── Classification + translation, one combined Groq call ────────────────
# The old prompt just asked "how does this portray Kosovo" — which scored a
# neutral AP report quoting a hostile foreign statement (e.g. Vučić saying
# "Kosovo is not a country") the same as an outlet's own hostile framing.
# Fixed with explicit few-shot examples: a small fast model benefits more
# from concrete examples than abstract rules.
CLASSIFY_TRANSLATE_INSTRUCTIONS = (
    "You are a media analyst for a Kosovo newsroom. For each numbered "
    "foreign-press item below (its own headline + snippet, about Kosovo), "
    "do two things:\n\n"
    "1. Classify SENTIMENT as positive, neutral, or negative — based ONLY "
    "on how the outlet's OWN voice and framing portrays Kosovo. Do NOT "
    "classify based on what a quoted person says. A report that neutrally "
    "quotes someone being hostile to Kosovo is still \"neutral\" (or "
    "\"positive\") if the outlet is just reporting the statement, not "
    "endorsing it. Only mark \"negative\" if the outlet's own reporting, "
    "word choice, or framing is itself critical, hostile, or dismissive of "
    "Kosovo.\n\n"
    "2. Translate the headline into natural Albanian (\"shqip\"), the way a "
    "Kosovo journalist would write it — translate the MEANING, not word "
    "order. Never produce literal English/German/French/Italian-to-Albanian "
    "phrasing. Keep it a real headline: concise, factual, no invented "
    "details.\n\n"
    "EXAMPLES:\n\n"
    "Example 1\n"
    "Original: \"Serbian president Vučić says 'Kosovo is not a country' in "
    "UN speech\"\n"
    "Reasoning: AP is neutrally reporting what Vučić said, not endorsing "
    "it.\n"
    "sentiment: neutral\n"
    "albanian_title: \"Vuçiq në OKB: 'Kosova nuk është shtet'\"\n\n"
    "Example 2\n"
    "Original: \"Kosovo's fragile ethnic peace shattered by police raid, "
    "critics say\"\n"
    "Reasoning: the outlet's own words (\"fragile\", \"shattered\") frame "
    "Kosovo negatively — this is the outlet's editorial voice, not just a "
    "quote.\n"
    "sentiment: negative\n"
    "albanian_title: \"Paqja e brishtë etnike në Kosovë, e goditur nga reid "
    "policor, thonë kritikët\"\n\n"
    "Example 3\n"
    "Original: \"Kosovo and Serbia sign landmark energy deal, EU welcomes "
    "step forward\"\n"
    "Reasoning: positive framing in the outlet's own words.\n"
    "sentiment: positive\n"
    "albanian_title: \"Kosova dhe Serbia nënshkruajnë marrëveshje historike "
    "për energjinë, BE e mirëpret hapin\"\n\n"
)


def classify_and_translate_batch(client: "Groq | None", items: list[dict]) -> list[dict]:
    """items: [{'title':..., 'summary':...}, ...]
    Returns [{'sentiment': ..., 'albanian_title': ... | None}, ...] in order."""
    if not items:
        return []
    texts = [f"{a['title']} — {a.get('summary', '')}".strip(" —") for a in items]

    if client is None:
        return [{"sentiment": heuristic_sentiment(t), "albanian_title": None} for t in texts]

    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(texts))
    prompt = (
        CLASSIFY_TRANSLATE_INSTRUCTIONS
        + f"Now classify and translate these {len(texts)} items. Reply with "
        "ONLY a JSON array, no markdown, no explanation, in this exact "
        "order:\n"
        '[{"sentiment": "positive|neutral|negative", "albanian_title": "..."}, ...]\n\n'
        + numbered
    )
    try:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.3,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
        parsed = json.loads(raw)
        if not isinstance(parsed, list) or len(parsed) != len(texts):
            raise ValueError(f"expected {len(texts)} items, got {parsed!r}")

        out = []
        valid_sentiments = {"positive", "neutral", "negative"}
        for i, p in enumerate(parsed):
            sentiment = p.get("sentiment") if isinstance(p, dict) else None
            if sentiment not in valid_sentiments:
                sentiment = heuristic_sentiment(texts[i])
            albanian_title = p.get("albanian_title") if isinstance(p, dict) else None
            out.append({"sentiment": sentiment, "albanian_title": albanian_title})
        return out
    except Exception as e:
        print(f"  Groq classify+translate error: {e}", file=sys.stderr)
        return [{"sentiment": heuristic_sentiment(t), "albanian_title": None} for t in texts]


def retry_translation(client: "Groq | None", title: str) -> str | None:
    """One individual escalated retry for a headline whose first-pass
    translation didn't look Albanian (rare, but small models slip back into
    the source language sometimes)."""
    if client is None:
        return None
    prompt = (
        "Your previous translation was not natural Albanian. Rewrite ONLY "
        "in Albanian (Shqip), using authentic Kosovo Albanian journalistic "
        "phrasing. Reply with ONLY the translated headline, nothing else.\n\n"
        f"Headline: {title}"
    )
    try:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.3,
        )
        text = resp.choices[0].message.content.strip().strip('"')
        return text or None
    except Exception as e:
        print(f"  Groq translation retry error: {e}", file=sys.stderr)
        return None


def country_index(positive: int, neutral: int, negative: int) -> int | None:
    """0–100 scale: 100 = all positive, 0 = all negative, 50 = split evenly
    between positive/negative (neutral doesn't pull the needle either way)."""
    total = positive + neutral + negative
    if total == 0:
        return None
    return round(50 + 50 * (positive - negative) / total)


# ── Cache ──────────────────────────────────────────────────────────────

def load_cache() -> dict:
    if CACHE_PATH.exists():
        try:
            data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("articles"), dict):
                return data
        except Exception:
            pass
    return {"version": 1, "articles": {}}


def fetch_candidates() -> dict[str, list[dict]]:
    """Fetch + within-country dedupe only, no classification yet. Returns
    {country: [{title, summary, url, date, outlet}, ...]}."""
    by_country: dict[str, list[dict]] = {}
    for country, feed_url in FEEDS.items():
        print(f"  Fetching {country}...")
        try:
            feed = feedparser.parse(feed_url)
        except Exception as e:
            print(f"  {country} feed fetch failed: {e}", file=sys.stderr)
            by_country[country] = []
            continue

        seen_titles: set[str] = set()
        items: list[dict] = []
        for entry in feed.entries[:60]:
            url = entry.get("link", "")
            title = entry.get("title", "").strip()
            summary = re.sub(r"<[^>]+>", "", entry.get("summary", "") or "").strip()
            # published_parsed is feedparser's already-parsed struct_time —
            # a clean ISO date from this, not a [:10] slice of the raw RFC822
            # string (which used to truncate mid-word, e.g. "Sun, 09 Au" —
            # both an unparseable value downstream and a broken-looking date
            # shown directly on every Bota Flet card).
            published_struct = entry.get("published_parsed")
            published = datetime(*published_struct[:6]).strftime("%Y-%m-%d") if published_struct else ""
            source = entry.get("source") or {}
            outlet = extract_outlet(url, country, source.get("title", ""))
            if not outlet or not title:
                continue

            key = normalize_title(title)
            if key in seen_titles:
                continue
            seen_titles.add(key)
            items.append({
                "title": title, "summary": summary, "url": url,
                "date": published, "outlet": outlet,
            })
        by_country[country] = items
    return by_country


def main():
    api_key = os.environ.get("GROQ_API_KEY")
    client = Groq(api_key=api_key) if api_key else None
    if client is None:
        print("GROQ_API_KEY not set; using heuristic tone labels, no translation", file=sys.stderr)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cache = load_cache()
    articles_cache: dict[str, dict] = cache["articles"]

    by_country = fetch_candidates()

    # country_occurrences[country] keeps the per-country (key, candidate)
    # pairs — candidate["outlet"] is this country's own outlet attribution
    # for the story, kept separate from the cache entry's (possibly
    # first-seen-in-a-different-country) outlet name.
    country_occurrences: dict[str, list[tuple[str, dict]]] = {c: [] for c in FEEDS}
    new_items: list[tuple[str, dict]] = []
    image_retry_keys: list[str] = []
    seen_new_keys: set[str] = set()

    for country, items in by_country.items():
        for item in items:
            key = normalize_title(item["title"])
            country_occurrences[country].append((key, item))
            if key in articles_cache:
                entry = articles_cache[key]
                entry["lastSeen"] = today
                if not entry.get("imageUrl") and entry.get("imageAttempts", 0) < MAX_IMAGE_ATTEMPTS:
                    if key not in image_retry_keys:
                        image_retry_keys.append(key)
            elif key not in seen_new_keys:
                seen_new_keys.add(key)
                new_items.append((key, {**item, "country": country}))

    print(f"  {len(new_items)} new articles, {len(image_retry_keys)} pending image retries")

    # ── Classify + translate new items, batched ──
    for i in range(0, len(new_items), TRANSLATE_BATCH_SIZE):
        chunk = new_items[i:i + TRANSLATE_BATCH_SIZE]
        results = classify_and_translate_batch(client, [c for _, c in chunk])
        for (key, item), result in zip(chunk, results):
            sentiment = result["sentiment"]
            albanian_title = result["albanian_title"]
            translated = is_albanian_text(albanian_title)
            if albanian_title and not translated:
                retried = retry_translation(client, item["title"])
                if retried and is_albanian_text(retried):
                    albanian_title, translated = retried, True
                else:
                    albanian_title, translated = None, False

            articles_cache[key] = {
                "key": key,
                "title": item["title"],
                "albanianTitle": albanian_title,
                "translated": translated,
                "url": item["url"],
                "googleNewsUrl": item["url"],
                "imageUrl": None,
                "imageAttempts": 0,
                "outlet": item["outlet"],
                "country": item["country"],
                "sentiment": sentiment,
                "date": item["date"] or today,
                "firstSeen": today,
                "lastSeen": today,
            }

    # ── Image resolution: new items + retry-eligible cached items, one flat
    # batch across all countries so the worker pool stays fully utilized.
    #
    # This does NOT use as_completed() without a bound — as_completed()
    # blocks until every submitted future is done, and the socket-level
    # timeout above is a backstop, not a guarantee (e.g. a connection that's
    # accepted but drip-feeds one byte just under the timeout indefinitely).
    # wait(..., timeout=) instead returns after at most IMAGE_BATCH_TIMEOUT
    # regardless of stragglers, so one bad server degrades this run's image
    # count instead of hanging the whole script (and the GitHub Action) —
    # anything left in `not_done` just retries on the next scheduled run. ──
    image_targets = list(dict.fromkeys([key for key, _ in new_items] + image_retry_keys))
    if image_targets:
        print(f"  Resolving images for {len(image_targets)} articles...")
        pool = ThreadPoolExecutor(max_workers=IMAGE_WORKERS)
        futures = {
            pool.submit(resolve_article_media, articles_cache[key]["googleNewsUrl"]): key
            for key in image_targets
            if key in articles_cache
        }
        done, not_done = wait(futures, timeout=IMAGE_BATCH_TIMEOUT)
        resolved = 0
        for future in done:
            key = futures[future]
            entry = articles_cache[key]
            entry["imageAttempts"] = entry.get("imageAttempts", 0) + 1
            try:
                real_url, image_url = future.result()
                entry["url"] = real_url
                if image_url:
                    entry["imageUrl"] = image_url
                    resolved += 1
            except Exception as e:
                print(f"  image resolve failed for {key[:40]}: {type(e).__name__}", file=sys.stderr)
        for future in not_done:
            key = futures[future]
            articles_cache[key]["imageAttempts"] = articles_cache[key].get("imageAttempts", 0) + 1
        if not_done:
            print(f"  {len(not_done)} image lookups still running past the {IMAGE_BATCH_TIMEOUT}s batch "
                  "budget — left for a later run's retry", file=sys.stderr)
        # wait=False: don't block process exit on stragglers still running
        # past the batch budget — they're bounded by socket.setdefaulttimeout
        # and will die on their own; no result of theirs is used either way.
        pool.shutdown(wait=False, cancel_futures=True)
        print(f"  {resolved}/{len(image_targets)} images resolved")

    # ── Prune stale entries ──
    cutoff = (datetime.now(timezone.utc) - timedelta(days=CACHE_RETENTION_DAYS)).strftime("%Y-%m-%d")
    for key in list(articles_cache.keys()):
        if articles_cache[key].get("lastSeen", "") < cutoff:
            del articles_cache[key]

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(
        json.dumps({"version": 1, "articles": articles_cache}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {CACHE_PATH} ({len(articles_cache)} cached articles)")

    # ── Build today's tone-outlets.json + tone-history.json from the cache.
    # Outlet attribution uses each country's OWN occurrence of the story
    # (candidate["outlet"]), not the cache entry's outlet — a wire story
    # cached from Gjermani's feed can still legitimately show as "AP" under
    # SHBA and "Reuters" under Britani; only the expensive shared fields
    # (sentiment, translation, image) are reused from the cache. ──
    countries_data: dict[str, dict] = {}
    country_summaries: dict[str, dict] = {}
    all_articles_by_country: dict[str, list[dict]] = {}

    for country in FEEDS:
        by_outlet: dict[str, list[dict]] = {}
        flat: list[dict] = []
        for key, candidate in country_occurrences[country]:
            entry = articles_cache.get(key)
            if not entry:
                continue
            article_out = {
                "title": entry["title"],
                "url": entry["url"],
                "date": entry["date"],
                "sentiment": entry["sentiment"],
            }
            by_outlet.setdefault(candidate["outlet"], []).append(article_out)
            flat.append({**article_out, "outlet": candidate["outlet"]})

        outlets_list = []
        for outlet_name, arts in by_outlet.items():
            arts = arts[:6]
            vote = Counter(a["sentiment"] for a in arts).most_common(1)[0][0] if arts else "neutral"
            outlets_list.append({
                "name": outlet_name, "sentiment": vote,
                "articleCount": len(arts), "articles": arts,
            })
        outlets_list.sort(key=lambda o: o["name"])

        counts = Counter(a["sentiment"] for a in flat)
        positive, neutral, negative = counts.get("positive", 0), counts.get("neutral", 0), counts.get("negative", 0)
        n = positive + neutral + negative
        idx = country_index(positive, neutral, negative)
        summary = {
            "index": idx,
            "positive": round(100 * positive / n) if n else 0,
            "neutral": round(100 * neutral / n) if n else 0,
            "negative": round(100 * negative / n) if n else 0,
            "n": n,
            "confident": n >= MIN_CONFIDENT_N,
        }
        countries_data[country] = {"outlets": outlets_list, "summary": summary}
        country_summaries[country] = summary
        all_articles_by_country[country] = flat
        print(f"  {country}: {len(outlets_list)} outlets, {n} articles today")

    total_articles = sum(s["n"] for s in country_summaries.values())
    weighted_sum = sum(
        s["index"] * s["n"] for s in country_summaries.values() if s["index"] is not None
    )
    overall_index = round(weighted_sum / total_articles) if total_articles else None
    source_count = sum(len(c["outlets"]) for c in countries_data.values())

    outlets_output = {
        "lastUpdated": today,
        "overallIndex": overall_index,
        "totalArticles": total_articles,
        "sourceCount": source_count,
        "countries": countries_data,
    }
    OUTLETS_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTLETS_PATH.write_text(json.dumps(outlets_output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTLETS_PATH}")

    # ── History row: 3 most positive + 3 most negative headlines of the
    # day, round-robin picked across countries (a flat slice would silently
    # pick all 3 from whichever country iterates first) and deduped by
    # normalized title (the SAME cache key can legitimately appear under
    # multiple countries' flat lists — this avoids picking the same story
    # twice in the top-6). ──
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

    # Re-running the same day (multiple scheduled runs, manual test, workflow
    # retry) replaces today's row instead of appending a duplicate.
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
