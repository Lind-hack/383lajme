#!/usr/bin/env python3
"""
Kosovo News Automated Pipeline — runs every 2 hours via GitHub Actions.
Fetches Kosovo news from international/Balkan sources, deduplicates against
local outlets (Telegrafi, Koha), scores for engagement, generates Albanian
content, finds/generates images, writes JSON, sends email notification.
"""

import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import os
import json
import re
import uuid
import smtplib
import urllib.parse
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import html
import random
import socket
import time

# Load .env for local dev — try scripts/.env first, then Desktop/claude/.env as fallback
try:
    from dotenv import load_dotenv
    _env_paths = [
        Path(__file__).parent / ".env",
        Path.home() / "Desktop" / "claude" / ".env",
    ]
    for _p in _env_paths:
        if _p.exists():
            load_dotenv(_p, override=False)
            break
except ImportError:
    pass

import feedparser
import requests
from bs4 import BeautifulSoup
from slugify import slugify
try:
    from youtubesearchpython import VideosSearch as _VideosSearch
    _YT_AVAILABLE = True
except ImportError:
    _YT_AVAILABLE = False

# ── Config ────────────────────────────────────────────────────────────────────
GOOGLE_AI_API_KEY  = os.environ.get("GOOGLE_AI_API_KEY", "")
GROQ_API_KEY       = os.environ.get("GROQ_API_KEY", "")
GOOGLE_SEARCH_KEY  = os.environ.get("GOOGLE_SEARCH_API_KEY", "")
GOOGLE_CSE_ID      = os.environ.get("GOOGLE_CSE_ID", "")
PEXELS_API_KEY     = os.environ.get("PEXELS_API_KEY", "")
GMAIL_USER         = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
REMOVE_SECRET      = os.environ.get("REMOVE_SECRET", "")
SITE_URL           = os.environ.get("SITE_URL", "https://383lajme.vercel.app")
RECIPIENT_EMAIL    = os.environ.get("RECIPIENT_EMAIL") or "lindsylqa@gmail.com"
# LLM provider: prefer Gemini for article scoring/writing; use Groq only as fallback.
if GOOGLE_AI_API_KEY:
    LLM_URL   = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    LLM_MODEL = "gemini-2.0-flash"
    LLM_KEY   = GOOGLE_AI_API_KEY
    LLM_PROVIDER = "Gemini"
elif GROQ_API_KEY:
    LLM_URL   = "https://api.groq.com/openai/v1/chat/completions"
    LLM_MODEL = "llama-3.3-70b-versatile"
    LLM_KEY   = GROQ_API_KEY
    LLM_PROVIDER = "Groq"
else:
    LLM_URL = ""
    LLM_MODEL = ""
    LLM_KEY = ""
    LLM_PROVIDER = "none"
# Legacy aliases kept for backward compat
GEMMA_URL   = LLM_URL
GEMMA_MODEL = LLM_MODEL
MAX_AGE_HOURS      = 48
MAX_PER_RUN        = 15
AI_CAP             = 8

SCRIPT_DIR  = Path(__file__).parent
OUTPUT_DIR  = SCRIPT_DIR.parent / "data" / "auto-articles"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Sources ───────────────────────────────────────────────────────────────────
# (url, source_name, flag, bias, kosovo_exclusive)
# kosovo_exclusive=True → skip Kosovo keyword check (feed is entirely Kosovo-focused)
# The Google News site-filter feeds (e.g. site:bbc.co.uk) return relevance-sorted ARCHIVE
# articles — not recent. Use the generic Kosovo+when:3d search instead and extract outlet
# names from the "Headline - Outlet" title suffix Google News appends.
NEWS_SOURCES = [
    # ── Kosovo international coverage ─────────────────────────────────────────
    ("https://balkaninsight.com/tag/kosovo/feed/", "Balkan Insight", "🌍", "neutral", True),
    ("https://europeanwesternbalkans.com/feed/",   "EWB",            "🌍", "neutral", True),
    ("https://exit.al/en/feed/",                   "Exit News",      "🇦🇱", "neutral", True),
    ("https://prishtina-insight.com/feed/",        "Prishtina Insight", "🌍", "neutral", True),
    ("https://balkaneu.com/feed/",                 "Balkan EU",      "🌍", "neutral", True),
    # GNews Kosovo — 1-day window (freshest) + 3-day window (breadth)
    ("https://news.google.com/rss/search?q=Kosovo+when%3A1d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", False),
    ("https://news.google.com/rss/search?q=Kosovo+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", False),
    # Economy & Western Balkans
    ("https://news.google.com/rss/search?q=Kosovo+economy+OR+%22Western+Balkans%22+economy+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", False),
    # ── Serbian sources — Kosovo topic (all get hostile bias) ─────────────────
    ("https://news.google.com/rss/search?q=Kosovo+OR+Kosova+when%3A1d&hl=sr&gl=RS&ceid=RS:sr",
     "_SERBIAN_GNEWS_", "🇷🇸", "hostile", True),
    # ── Major international outlets (direct RSS) ──────────────────────────────
    ("https://feeds.bbci.co.uk/news/world/europe/rss.xml",
     "BBC",             "🇬🇧", "neutral", False),
    ("https://feeds.reuters.com/reuters/worldNews",
     "Reuters",         "🌍", "neutral", False),
    ("https://www.rferl.org/api/z-_qopudvuqqu",
     "RFE/RL",          "🌍", "neutral", False),
    ("https://therundown.ai/feed",
     "The Rundown AI",  "🤖", "neutral", True),
    # ── AI / Tech world news ──────────────────────────────────────────────────
    ("https://techcrunch.com/category/artificial-intelligence/feed/",
     "TechCrunch", "💻", "neutral", True),
    ("https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
     "The Verge", "💻", "neutral", True),
    ("https://venturebeat.com/ai/feed/",
     "VentureBeat", "💻", "neutral", True),
    ("https://www.wired.com/feed/category/artificial-intelligence/latest/rss",
     "Wired", "💻", "neutral", True),
    # OpenAI & Google official blogs
    ("https://openai.com/blog/rss.xml",  "OpenAI Blog",  "🤖", "neutral", True),
    ("https://blog.google/rss/",         "Google Blog",  "🤖", "neutral", True),
    # GNews AI — model releases, company drama, product launches
    ("https://news.google.com/rss/search?q=artificial+intelligence+AI+when%3A1d&hl=en-US&gl=US&ceid=US:en",
     "AI News", "🤖", "neutral", True),
    ("https://news.google.com/rss/search?q=OpenAI+OR+Claude+OR+Gemini+OR+ChatGPT+when%3A1d&hl=en-US&gl=US&ceid=US:en",
     "AI News", "🤖", "neutral", True),
    # AI company drama & lawsuits
    ("https://news.google.com/rss/search?q=%22Sam+Altman%22+OR+%22Elon+Musk+AI%22+OR+%22OpenAI%22+lawsuit+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "AI News", "🤖", "neutral", True),
    # Specific product updates: new model versions, app releases
    ("https://news.google.com/rss/search?q=Gemini+OR+%22Claude+AI%22+OR+%22GPT-5%22+OR+Codex+update+release+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "AI News", "🤖", "neutral", True),
    # Mira Murati — Albanian AI founder, high interest for Kosovo readers
    ("https://news.google.com/rss/search?q=%22Mira+Murati%22+when%3A14d&hl=en-US&gl=US&ceid=US:en",
     "AI News", "🤖", "neutral", True),
    # ── Major international outlets (direct RSS) — full-coverage trusted sources ─
    ("https://rss.dw.com/rdf/rss-en-europe",
     "DW",          "🇩🇪", "neutral", False),
    ("https://www.theguardian.com/world/rss",
     "Guardian",    "🇬🇧", "neutral", False),
    ("https://www.aljazeera.com/xml/rss/all.xml",
     "Al Jazeera",  "🌍", "neutral", False),
    ("https://www.france24.com/en/europe/rss",
     "France 24",   "🇫🇷", "neutral", False),
    ("https://www.euronews.com/rss?format=mrss&level=theme&name=news",
     "Euronews",    "🇪🇺", "neutral", False),
    ("https://apnews.com/rss/apf-europe",
     "AP",          "🇺🇸", "neutral", False),
    ("https://www.technologyreview.com/feed/",
     "MIT Tech Review", "💻", "neutral", True),
    # Kosovo-specific high-signal queries
    ("https://news.google.com/rss/search?q=%22Albin+Kurti%22+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", True),
    ("https://news.google.com/rss/search?q=%22Pristina%22+OR+%22Prishtina%22+EU+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", True),
    ("https://news.google.com/rss/search?q=Kosovo+Belgrade+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", True),
]

# Local Kosovo outlets to skip from the generic Google News search — they publish in
# Albanian/Serbian and are already monitored via DEDUP_FEEDS
LOCAL_OUTLETS = {
    "Kosovo Online", "KOHA.net", "KoSSev", "Koha", "Gazeta Express", "KosovaPress",
    "Telegrafi", "RTK", "zeri.info", "Radio Kosova", "KosovaLive", "Bota Sot",
    "Radio Dukagjini", "KTV", "RTV21", "Lajmi", "Indeksonline", "Insajderi",
}

# Outlet name → (canonical label, flag) for entries from the generic GNews search
GNEWS_SOURCE_MAP = {
    "BBC":               ("BBC",             "🇬🇧"),
    "AP News":           ("AP",              "🇺🇸"),
    "Reuters":           ("Reuters",         "🌍"),
    "CNN":               ("CNN",             "🇺🇸"),
    "Deutsche Welle":    ("DW",              "🇩🇪"),
    "DW":                ("DW",              "🇩🇪"),
    "Al Jazeera":        ("Al Jazeera",      "🌍"),
    "RFE/RL":            ("RFE/RL",          "🇺🇸"),
    "The Guardian":      ("Guardian",        "🇬🇧"),
    "Guardian":          ("Guardian",        "🇬🇧"),
    "Euronews":          ("Euronews",        "🇪🇺"),
    "France 24":         ("France 24",       "🇫🇷"),
    "Voice of America":  ("VOA",             "🇺🇸"),
    "VOA":               ("VOA",             "🇺🇸"),
    "Bloomberg":         ("Bloomberg",       "🇺🇸"),
    "The New York Times":("NYT",             "🇺🇸"),
    "Politico":          ("Politico",        "🇺🇸"),
    "Financial Times":   ("FT",              "🇬🇧"),
    "Balkan Insight":    ("Balkan Insight",  "🌍"),
    "BIRN":              ("Balkan Insight",  "🌍"),
    "EWB":               ("EWB",             "🌍"),
    "Exit News":         ("Exit News",       "🇦🇱"),
    "Prishtina Insight": ("Prishtina Insight","🌍"),
    # Serbian outlets
    "B92":           ("B92",        "🇷🇸"),
    "Blic":          ("Blic",       "🇷🇸"),
    "N1":            ("N1 RS",      "🇷🇸"),
    "Kurir":         ("Kurir",      "🇷🇸"),
    "Telegraf":      ("Telegraf",   "🇷🇸"),
    "RTS":           ("RTS",        "🇷🇸"),
    "Nova.rs":       ("Nova.rs",    "🇷🇸"),
    # Tech outlets
    "TechCrunch":    ("TechCrunch",   "💻"),
    "The Verge":     ("The Verge",    "💻"),
    "VentureBeat":   ("VentureBeat",  "💻"),
    "Wired":         ("Wired",        "💻"),
    "Ars Technica":  ("Ars Technica", "💻"),
}

# Checked ONLY to detect already-covered stories — not imported as articles
DEDUP_FEEDS = [
    "https://telegrafi.com/feed/",
    "https://www.koha.net/feed/",
    "https://gazetaexpress.com/feed/",
    "https://zeri.info/feed/",
]

KOSOVO_KEYWORDS = {
    "kosovo", "kosov", "kurti", "pristina", "prishtina",
    "prishtinë", "kosovë", "kosova", "kosovar",
}

STOPWORDS = {
    "the", "and", "for", "that", "with", "has", "are", "was", "its",
    "his", "her", "have", "been", "from", "will", "this", "they", "but",
    "not", "also", "into", "over", "after", "before", "more", "about",
}

# Source credibility tiers — used to prime the LLM's credibility score
# (tier number, description fed into the scoring prompt)
SOURCE_TIERS: dict[str, tuple[int, str]] = {
    "AP":               (1, "wire service — direct field reporting, highest factual accuracy"),
    "Reuters":          (1, "wire service — direct field reporting, highest factual accuracy"),
    "BBC":              (2, "major international broadcaster — editorial standards, broad reach"),
    "DW":               (2, "major international broadcaster — strong Balkans bureau"),
    "Al Jazeera":       (2, "major international broadcaster — strong Balkans/conflict coverage"),
    "France 24":        (2, "major international broadcaster — EU/European affairs focus"),
    "RFE/RL":           (2, "US-funded broadcaster — specialist in Eastern Europe and Balkans, highly reliable for Kosovo"),
    "VOA":              (2, "US international broadcaster — reliable, has Kosovo coverage"),
    "Euronews":         (2, "pan-European broadcaster — covers EU enlargement closely"),
    "Guardian":         (3, "quality independent UK newspaper — strong investigative journalism"),
    "NYT":              (3, "major US newspaper — widely cited, reliable"),
    "FT":               (3, "quality financial newspaper — excellent on economics"),
    "Bloomberg":        (3, "quality financial/business media — strong economic analysis"),
    "Politico":         (3, "political media — strong EU/Western Balkans beat"),
    "Balkan Insight":   (3, "specialist Balkans investigative journalism — highest Kosovo-specific credibility"),
    "EWB":              (3, "specialist European Western Balkans outlet — reliable on accession/policy"),
    "Prishtina Insight":(3, "Kosovo-focused English-language outlet — primary Kosovo reporting"),
    "Exit News":        (3, "Albania-focused investigative outlet — reliable on Albanian-sphere affairs"),
    "CNN":              (3, "major US broadcaster — mainstream coverage"),
    "MIT Tech Review":  (4, "academic/research tech publication — very credible for tech news"),
    "TechCrunch":       (4, "specialist tech media — highly credible for startup/AI news"),
    "The Verge":        (4, "specialist tech media — reliable for product/AI coverage"),
    "VentureBeat":      (4, "specialist AI/tech media — good on AI business news"),
    "Wired":            (4, "specialist tech/culture media — strong on long-form tech"),
    "The Rundown AI":   (4, "AI newsletter — curated tech coverage"),
    "OpenAI Blog":      (4, "official company blog — primary source for OpenAI news"),
    "Google Blog":      (4, "official company blog — primary source for Google news"),
    # Serbian outlets — hostile framing on Kosovo, credibility cap 3/10 for Kosovo topics
    "B92":      (5, "Serbian outlet — often hostile framing on Kosovo; credibility MAX 3/10 for Kosovo topics"),
    "Blic":     (5, "Serbian tabloid — hostile to Kosovo; credibility MAX 2/10"),
    "N1 RS":    (5, "Serbian outlet — frequently hostile framing on Kosovo"),
    "Kurir":    (5, "Serbian tabloid — hostile to Kosovo; credibility MAX 2/10"),
    "Telegraf": (5, "Serbian tabloid — hostile to Kosovo; credibility MAX 2/10"),
    "RTS":      (5, "Serbian state broadcaster — state-directed hostile framing; credibility MAX 2/10"),
    "Nova.rs":  (5, "Serbian outlet — hostile framing on Kosovo; credibility MAX 3/10"),
}


def _clean_html(text: str) -> str:
    """Strip HTML tags and decode entities — Google News RSS gives HTML summaries."""
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = html.unescape(clean)
    return " ".join(clean.split()).strip()


def _clean_title(title: str) -> str:
    """Remove source attribution Google News appends: 'Kosovo Elections - Bloomberg.com'"""
    parts = title.rsplit(" - ", 1)
    return parts[0].strip() if len(parts) > 1 else title.strip()


# ── Time helpers ──────────────────────────────────────────────────────────────
def _parse_published(entry) -> datetime | None:
    import email.utils
    pub = entry.get("published_parsed") or entry.get("updated_parsed")
    if pub:
        return datetime(*pub[:6], tzinfo=timezone.utc)
    for key in ("published", "updated"):
        s = entry.get(key, "")
        if s:
            try:
                t = email.utils.parsedate(s)
                if t:
                    return datetime(*t[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    return None


def is_recent(entry) -> bool:
    pub = _parse_published(entry)
    if not pub:
        return True  # can't determine age — include it
    return (datetime.now(timezone.utc) - pub) <= timedelta(hours=MAX_AGE_HOURS)


# ── Deduplication ─────────────────────────────────────────────────────────────
def _kw(text: str) -> set[str]:
    words = re.findall(r"[a-zA-ZÀ-ÿ]{3,}", text.lower())
    return {w for w in words if w not in STOPWORDS}


def build_covered_set() -> list[set[str]]:
    covered: list[set[str]] = []
    for url in DEDUP_FEEDS:
        try:
            socket.setdefaulttimeout(15)
            feed = feedparser.parse(url, request_headers={"User-Agent": "Mozilla/5.0"})
            socket.setdefaulttimeout(None)
            for entry in feed.entries[:40]:
                if is_recent(entry):
                    kws = _kw(entry.get("title", ""))
                    if kws:
                        covered.append(kws)
        except Exception as e:
            print(f"  Dedup feed error ({url}): {e}")
    return covered


def is_duplicate(title: str, summary: str, covered: list[set[str]]) -> bool:
    candidate = _kw(title)
    for c in covered:
        if len(candidate & c) >= 5:
            return True
    return False


# ── Already-committed URL tracking ────────────────────────────────────────────
def load_existing_urls() -> set[str]:
    seen: set[str] = set()
    for f in OUTPUT_DIR.glob("*.json"):
        try:
            for a in json.loads(f.read_text(encoding="utf-8")):
                if a.get("url"):
                    seen.add(a["url"])
        except Exception:
            pass
    return seen


# ── Feed image extraction ─────────────────────────────────────────────────────
def _feed_image(entry) -> str | None:
    thumbs = getattr(entry, "media_thumbnail", None)
    if thumbs and thumbs[0].get("url"):
        return thumbs[0]["url"]
    for mc in getattr(entry, "media_content", []):
        if mc.get("medium") == "image" or (mc.get("type") or "").startswith("image/"):
            if mc.get("url"):
                return mc["url"]
    return None


# ── RSS fetch ─────────────────────────────────────────────────────────────────
def fetch_candidates(seen_urls: set[str]) -> list[dict]:
    candidates: list[dict] = []
    for feed_url, source, flag, bias, kosovo_exclusive in NEWS_SOURCES:
        try:
            socket.setdefaulttimeout(15)
            feed = feedparser.parse(feed_url, request_headers={"User-Agent": "Mozilla/5.0"})
            socket.setdefaulttimeout(None)
            for entry in feed.entries[:40]:
                url = entry.get("link", "")
                if not url or url in seen_urls:
                    continue
                if not is_recent(entry):
                    continue

                raw_title = entry.get("title", "")

                if source == "_GNEWS_EXTRACT_":
                    # Google News appends " - Outlet Name" to every title
                    parts = raw_title.rsplit(" - ", 1)
                    outlet = parts[1].strip() if len(parts) == 2 else "International"
                    clean_title = parts[0].strip() if len(parts) == 2 else raw_title

                    # Skip local Kosovo outlets — covered by dedup/local feeds
                    if any(local.lower() in outlet.lower() for local in LOCAL_OUTLETS):
                        continue

                    # Map to canonical label; unknown outlets keep their raw name
                    source_name, source_flag = outlet, "🌍"
                    for key, (sname, sflag) in GNEWS_SOURCE_MAP.items():
                        if key.lower() in outlet.lower():
                            source_name, source_flag = sname, sflag
                            break
                elif source == "_SERBIAN_GNEWS_":
                    parts = raw_title.rsplit(" - ", 1)
                    outlet = parts[1].strip() if len(parts) == 2 else "Mediat Serbe"
                    clean_title = parts[0].strip() if len(parts) == 2 else raw_title
                    source_name = outlet if outlet else "Mediat Serbe"
                    source_flag = "🇷🇸"
                    bias = "hostile"
                else:
                    clean_title = _clean_title(raw_title)
                    source_name = source
                    source_flag = flag

                if not kosovo_exclusive:
                    text = (raw_title + " " + entry.get("summary", "")).lower()
                    if not any(kw in text for kw in KOSOVO_KEYWORDS):
                        continue

                candidates.append({
                    "url":          url,
                    "source":       source_name,
                    "source_flag":  source_flag,
                    "source_bias":  bias,
                    "title_en":     clean_title,
                    "summary":      _clean_html(entry.get("summary", "")),
                    "raw_image":    _feed_image(entry),
                    "published_at": _parse_published(entry),
                })
        except Exception as e:
            print(f"  Feed error [{source}]: {e}")
    return candidates


# ── LLM API (Gemini primary, Groq fallback) ───────────────────────────────────
def _gemma(messages: list[dict], max_tokens: int = 1024, temperature: float = 0.3) -> str:
    if not LLM_KEY:
        raise RuntimeError("Set GOOGLE_AI_API_KEY or GROQ_API_KEY before running the Kosovo pipeline")

    resp = requests.post(
        LLM_URL,
        headers={"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"},
        json={"model": LLM_MODEL, "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _parse_json(text: str) -> dict:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        return json.loads(m.group())
    return json.loads(text)


def analyze_and_translate(title: str, summary: str, source: str = "") -> dict | None:
    """Score and translate an article in one Gemma call. Returns None if all retries fail."""
    tier_info, tier_num = "", 0
    if source and source in SOURCE_TIERS:
        tier_num, tier_desc = SOURCE_TIERS[source]
        tier_info = f"\nSOURCE: {source} — {tier_desc} (Tier {tier_num}/5)"

    prompt = f"""You are a Kosovo news editor. Given an article (which may be in English, Serbian, or Albanian), do TWO things in one JSON response:
1. Score it for a Kosovo audience (1-10)
2. Rewrite it in Albanian (Shqip) as a Kosovo journalist
{tier_info}
Return ONLY this JSON (no markdown, no explanation):
{{
  "score": 8.2,
  "breakdown": {{
    "relevance": 9,
    "urgency": 8,
    "interest": 8,
    "credibility": 9
  }},
  "featured": false,
  "category": "Politikë",
  "breaking": false,
  "reason": "one sentence why this score, mentioning source tier",
  "title": "Albanian TikTok-hook headline: context + curiosity gap, max 18 words",
  "excerpt": "exactly 2 sentences: fact + Kosovo impact, max 25 words each",
  "body": "full Albanian article 4-5 paragraphs 500-600 words, coherent with title",
  "tone": "neutral",
  "source_bias": "neutral"
}}

breakdown field meanings (each 1-10):
- relevance: how directly relevant to Kosovo / Kosovo readers (Kosovo = main subject scores 9-10; tangentially related scores 4-6)
- urgency: time sensitivity / breaking potential (happened in last 2h = 9-10; today = 7-8; this week = 4-6)
- interest: will Kosovo readers share or discuss this? (viral/emotional/surprising = 9-10; informative = 6-7; dry = 1-4)
- credibility: source quality — use the SOURCE TIER above to anchor this score:
    Tier 1 (wire services AP/Reuters) → credibility 9-10
    Tier 2 (major broadcasters BBC/DW/AJ) → credibility 7-9
    Tier 3 (quality press/specialist Balkans) → credibility 6-8
    Tier 4 (specialist tech media) → credibility 6-8 for tech news, 4-5 for non-tech
    Tier 5 (Serbian hostile outlets) → credibility MAX 3/10 for Kosovo topics
    Unknown source → credibility 5 (default)
The final "score" = (relevance + urgency + interest + credibility) / 4, rounded to 1 decimal.
The "reason" must mention: source name, what makes this score high/low, and one key fact from the article.

Categories: Politikë, Ekonomi, Botë, Siguri, Teknologji, Showbiz
Score guide:
- 9-10: BREAKING — major model releases (GPT-5, Gemini 4, Claude 4), AI company lawsuits/scandals (Musk vs Altman), Kosovo security incidents, Serbian official statements on Kosovo
- 8-9: Big Kosovo political developments, AI product launches (new Gemini version, OpenAI Codex mobile), Mira Murati news (ALWAYS score 8+ — she is Albanian, Kosovo readers care deeply about her AI work and her company Thinking Machines)
- 7-8: Important Kosovo international coverage, AI funding rounds >$500M, tech CEO drama, strong sport results
- 5-6: Routine Kosovo politics, general AI trend pieces, Balkan economy news
- 1-4: Generic or unrelated — skip
Use "Showbiz" for celebrity, entertainment, music, film, and pop culture news.
Use "Teknologji" for ALL AI, software, tech, and innovation news — NOT generic "AI is changing jobs" pieces.
IMPORTANT: For AI/tech news, score SPECIFIC events highly: new model version released, company acquisition, CEO controversy, major investment. Vague trend articles score 1-4 and should be skipped.

RREGULL KRYESOR — KOHERENCA:
Titulli, ekserpti dhe body-i duhet të tregojnë TË NJËJTËN histori.
Fjalia e parë e paragrafit 1 duhet të zgjerojë SAKTË temën e titullit — asnjë temë tjetër.
GABIM: Titulli "Kurti takon NATO-n" + Body hapet "Lufta në Ukrainë..." ✗
SAKTË: Titulli "Kurti takon NATO-n" + Body hapet "Kryeministri Albin Kurti u takua sot me..." ✓

TITULLI — si fillimi i një videoje TikTok (max 18 fjalë):
Imagino që lexuesi e sheh titullin dhe ka 2-3 sekonda për të vendosur: klikoj apo jo?
Titulli duhet të bëjë DY gjëra njëkohësisht:
  1. Jep kontekst të mjaftueshëm — lexuesi kupton çfarë ndodhi
  2. Krijon kuriozitet — lexuesi dëshiron të dijë "çfarë ndodhi saktësisht?" ose "çfarë do të thotë kjo?"

Modelet e titujve që funksionojnë:
- "[Kush] bëri [çka] — ja çfarë do të thotë kjo për Kosovën"
  Shembull: "Kurti u takua me Biden — ja çfarë u vendos për Kosovën dhe çfarë ndodh tjetër"
- "[Ngjarje] — dhe arsyeja do t'ju habisë"
  Shembull: "Serbia refuzoi marrëveshjen e re — dhe arsyeja tregon gjithçka"
- "[Kompania/Personi] sapo [bëri diçka] — [pasoja konkrete]"
  Shembull: "OpenAI sapo lëshoi GPT-5 falas — dhe është 10 herë më i shpejtë se ai i vjetri"

Rregulla teknike të titullit:
- Kohë e tashme ose e kryer e thjeshtë, zë aktiv
- Fjalë konkrete: emra, numra, vende, njerëz realë — jo abstraksione
- KURRË: "Situata", "Zhvillimi i rëndësishëm", "Kriza e re" pa sqarim specifik
- KURRË fjalë-për-fjalë nga anglishtja — riformulo plotësisht për lexuesin shqiptar

EKSERPTI (saktësisht 2 fjali):
- Fjalia 1: fakti kryesor (emër specifik, numër konkret, ose ngjarje e saktë)
- Fjalia 2: pse i intereson lexuesit kosovar — impakti direkt
- Max 25 fjalë secila. Pa zhargon. Pa "sipas burimeve".
- SAKTË: "Serbia refuzoi marrëveshjen sot në Bruksel. Kjo vonon liberalizimin e vizave me të paktën dy vjet." ✓
- GABIM: "Sipas burimeve zyrtare, situata është komplekse dhe ka shumë aspekte." ✗

BODY (500-600 fjalë — 4-5 paragrafë):
Shkruaj si po i shpjegon lajmin një miku inteligjent në kafene — me detaje, kontekst dhe mendime.
Jo komunikatë zyrtare. Jo resumé i shkurtër. Histori e plotë me fillim, mes dhe fund.

Paragrafi 1 (4-5 fjali): Fakti kryesor — kush, çka, kur, ku. Fillo direkt, pa hyrje.
  → DUHET të zgjerojë temën e titullit. Jep detajet e sakta që titulli la me vete.
Paragrafi 2 (4-5 fjali): Prapavija — pse ndodhi kjo? Çfarë e shkaktoi? Konteksti historik nëse duhet.
Paragrafi 3 (4-5 fjali): Impakti — çfarë do të thotë kjo për Kosovën ose për lexuesin?
  Nëse ka deklarata ose citate, vendosi këtu me stil të drejtpërdrejtë.
Paragrafi 4 (4-5 fjali): Reagimet dhe debati — çfarë thonë palët e ndryshme?
Paragrafi 5 (3-4 fjali): Çfarë ndodh tjetër — hapat e radhës, datat, vendimi i ardhshëm.
  Mbyll me një pyetje ose mendim që i jep lexuesit diçka për të menduar.

RREGULLA GJUHËSORE:
- Fjalë të thjeshta: "thotë" jo "deklaron", "nis" jo "komençon", "bën" jo "realizon"
- Nëse fjalia ka 2 presje, ndaje në 2 fjali të veçanta
- Zë aktiv: "Qeveria vendosi" ✓ / "Vendimi u mor" ✗
- Lidhëza natyrale midis paragrafëve: "Por kjo nuk është gjithçka.", "Ndërkohë...", "Sipas tij,"
- FSHI plotësisht: "sipas burimeve", "konfirmoi zyrtarisht", "ka bërë me dije", "në kuadër të"
- Terma teknikë (AI, API, blockchain): mbaji anglisht, shto shpjegim shqip herën e parë në kllapa
- Ton: i ngrohtë, i angazhuar, direkt — lexuesi ndjen se dikush i tregon diçka interesante, jo që lexon një raport

Title: {title}
Summary: {summary[:1200]}"""

    for attempt in range(2):
        try:
            raw = _gemma([{"role": "user", "content": prompt}], max_tokens=6000, temperature=0.65)
            return _parse_json(raw)
        except Exception as e:
            if attempt < 1:
                wait = 4
                print(f"  analyze_and_translate attempt {attempt + 1} failed: {e} — retrying in {wait}s")
                time.sleep(wait)
            else:
                print(f"  analyze_and_translate failed after 2 attempts: {e} — skipping article")
                return None


# ── Image pipeline ────────────────────────────────────────────────────────────
CAT_QUERIES: dict[str, str] = {
    "Politikë":   "Kosovo government parliament politics",
    "Siguri":     "Kosovo security police military",
    "Ekonomi":    "Kosovo economy finance business",
    "Teknologji": "artificial intelligence technology computer",
    "Botë":       "world news international diplomacy",
    "Showbiz":    "celebrity entertainment concert stage",
}

SCENE_MAP: dict[str, str] = {
    "Politikë":   "Kosovo parliament politicians formal meeting press conference",
    "Siguri":     "security forces police military checkpoint Kosovo",
    "Ekonomi":    "Kosovo economy business finance professional meeting",
    "Teknologji": "technology artificial intelligence computer screens modern office",
    "Botë":       "international diplomacy world leaders formal summit",
    "Showbiz":    "concert stage performance entertainment celebrity spotlight",
}


def get_image(article_url: str, title: str, raw_image: str | None, category: str = "", used_images: set | None = None) -> str:
    used_images = used_images or set()
    # Tier 0 — Raw feed image (not Google CDN, not already used)
    if raw_image and "googleusercontent.com" not in raw_image and raw_image.startswith("http") and raw_image not in used_images:
        return raw_image

    # Resolve Google News redirect → actual article URL
    actual_url = article_url
    if "news.google.com" in article_url:
        try:
            r = requests.get(
                article_url, timeout=10,
                headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"},
                allow_redirects=True,
            )
            actual_url = r.url
        except Exception:
            pass

    # Tier 1 — Scrape article page: multiple meta tags + first article <img>
    try:
        r = requests.get(actual_url, timeout=45, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for prop in ["og:image", "twitter:image", "og:image:secure_url"]:
                tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
                if tag and tag.get("content"):
                    img = tag["content"]
                    if img.startswith("http") and "googleusercontent.com" not in img and img not in used_images:
                        return img
            for el in soup.select("article img, main img, .article-body img"):
                src = el.get("src") or el.get("data-src", "")
                if src and src.startswith("http") and any(ext in src for ext in [".jpg", ".jpeg", ".png", ".webp"]) and src not in used_images:
                    return src
    except Exception:
        pass

    # Tier 2 — Google Custom Search Images
    if GOOGLE_SEARCH_KEY and GOOGLE_CSE_ID:
        try:
            query = f"{title[:60]} Kosovo" if "Kosovo" not in title else title[:60]
            r = requests.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "key": GOOGLE_SEARCH_KEY, "cx": GOOGLE_CSE_ID, "q": query,
                    "searchType": "image", "num": 3, "imgType": "news", "safe": "active",
                },
                timeout=10,
            )
            items = r.json().get("items", [])
            if items:
                return items[0]["link"]
        except Exception:
            pass

    # Tier 3 — Pexels API (skip already-used photos)
    if PEXELS_API_KEY:
        try:
            cat_base = CAT_QUERIES.get(category, "Kosovo news")
            words = re.findall(r"[A-Za-z]{5,}", title)
            filtered = [w for w in words if w.lower() not in STOPWORDS][:2]
            query = cat_base + (" " + " ".join(filtered) if filtered else "")
            r = requests.get(
                "https://api.pexels.com/v1/search",
                headers={"Authorization": PEXELS_API_KEY},
                params={"query": query, "per_page": 10, "orientation": "landscape", "page": 1},
                timeout=10,
            )
            photos = r.json().get("photos", [])
            for photo in photos:
                img = photo["src"]["large"]
                if img not in used_images:
                    return img
        except Exception:
            pass

    # Tier 4 — Pollinations.ai AI generation with category-aware scene prompt
    scene = SCENE_MAP.get(category, "Kosovo city street people daily life")
    nouns = [w for w in re.findall(r"[A-Z][a-z]{4,}", title)][:3]
    entity_hint = " ".join(nouns) if nouns else ""
    ai_prompt = f"{scene} {entity_hint}, professional editorial news photography, Reuters AP style, sharp focus, photorealistic"
    encoded = urllib.parse.quote(ai_prompt[:200])
    return f"https://image.pollinations.ai/prompt/{encoded}?width=1200&height=630&nologo=true&model=flux"


# ── YouTube clip search ───────────────────────────────────────────────────────
def search_youtube_clip(query: str) -> str | None:
    if not _YT_AVAILABLE:
        return None
    try:
        results = _VideosSearch(query, limit=3).result()
        items = results.get("result", [])
        for item in items:
            vid_id = item.get("id", "")
            if vid_id:
                return f"https://www.youtube.com/embed/{vid_id}"
    except Exception:
        pass
    return None


# ── Email notification ────────────────────────────────────────────────────────
def send_email(articles: list[dict], out_filename: str) -> None:
    missing = [
        name for name, value in {
            "GMAIL_USER": GMAIL_USER,
            "GMAIL_APP_PASSWORD": GMAIL_APP_PASSWORD,
            "RECIPIENT_EMAIL": RECIPIENT_EMAIL,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Cannot send article report email because these settings are missing: "
            + ", ".join(missing)
        )

    now = datetime.now(timezone.utc).strftime("%H:%M UTC")
    subject = f"383 Lajme — {len(articles)} artikuj të rinj [{now}]"

    rows = []
    for i, a in enumerate(articles, 1):
        score = a.get("engagement_score", 0)
        is_breaking = a.get("featured", False)
        reason = a.get("score_reason", "")
        category = a.get("category", "?")
        source = a.get("source", "?")

        breaking_badge = ""
        if is_breaking:
            breaking_badge = '<span style="background:#FF4422;color:#fff;font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:2px 8px;border-radius:12px;margin-right:8px;">BREAKING</span>'

        score_color = "#FF4422" if score >= 9 else "#f0c040" if score >= 7.5 else "#aaaaaa"
        breakdown = a.get("score_breakdown", {})

        remove_btn = ""
        if REMOVE_SECRET and SITE_URL:
            remove_url = f"{SITE_URL}/api/remove?id={a['id']}&file={out_filename}&secret={REMOVE_SECRET}"
            edit_url   = f"{SITE_URL}/admin?id={a['id']}"
            remove_btn = (
                f'&nbsp;&nbsp;&nbsp;<a href="{remove_url}" style="color:#ff6b6b;font-size:12px;text-decoration:none;">🗑 Hiq nga faqja</a>'
                f'&nbsp;&nbsp;<a href="{edit_url}" style="color:#44aaff;font-size:12px;text-decoration:none;">✏️ Edito</a>'
            )

        breakdown_html = ""
        if breakdown:
            r_v = breakdown.get("relevance", "?")
            u_v = breakdown.get("urgency", "?")
            i_v = breakdown.get("interest", "?")
            c_v = breakdown.get("credibility", "?")
            breakdown_html = f"""<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;margin:6px 0 8px;font-size:11px;color:#777;">
              <span>🗺 Relevanca: <b style="color:#ccc">{r_v}/10</b></span>
              <span>⚡ Urgjenca: <b style="color:#ccc">{u_v}/10</b></span>
              <span>💬 Interesi: <b style="color:#ccc">{i_v}/10</b></span>
              <span>✅ Kredibiliteti: <b style="color:#ccc">{c_v}/10</b></span>
            </div>"""

        reason_row = f'<div style="font-size:12px;color:#999;font-style:italic;margin-bottom:10px;line-height:1.4;">{reason}</div>' if reason else ""

        rows.append(f"""
        <tr>
          <td style="padding:18px 20px;border-bottom:1px solid #2a2a2a;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
              {breaking_badge}
              <span style="font-size:24px;font-weight:900;color:{score_color};line-height:1;">{score:.1f}</span>
              <span style="font-size:12px;color:#555;line-height:1;">/10</span>
              <span style="font-size:11px;color:#666;margin-left:4px;">• {category} • {source}</span>
            </div>
            <div style="font-size:16px;font-weight:700;color:#ffffff;margin-bottom:8px;line-height:1.35;">{a['title']}</div>
            {breakdown_html}
            {reason_row}
            <div style="font-size:13px;">
              <a href="{a.get('url', '')}" style="color:#4af;text-decoration:none;">→ Artikulli origjinal</a>
              {remove_btn}
            </div>
          </td>
        </tr>""")

    email_html = f"""<!DOCTYPE html>
<html>
<body style="background:#111;font-family:sans-serif;margin:0;padding:20px;">
  <div style="max-width:640px;margin:auto;">
    <div style="background:#1a1a1a;border-radius:12px;overflow:hidden;">
      <div style="padding:24px 20px;border-bottom:1px solid #2a2a2a;">
        <h2 style="color:#fff;margin:0 0 6px;font-size:20px;">383 Lajme — {len(articles)} artikuj të rinj u shtuan</h2>
        <p style="color:#666;margin:0;font-size:13px;">{now} • Sistemi automatik i lajmeve ndërkombëtare</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        {''.join(rows)}
      </table>
    </div>
    <p style="color:#444;font-size:11px;margin-top:14px;text-align:center;">Automatizuar nga 383 News Pipeline</p>
  </div>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = GMAIL_USER
    msg["To"] = RECIPIENT_EMAIL
    msg.attach(MIMEText(email_html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        smtp.sendmail(GMAIL_USER, RECIPIENT_EMAIL, msg.as_string())
    print(f"  Email sent: {subject}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    print(f"[Kosovo Pipeline] {datetime.now(timezone.utc).isoformat()}")
    print(f"  LLM provider: {LLM_PROVIDER} ({LLM_MODEL or 'not configured'})")

    # Purge JSON files older than 48 hours
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    for old_file in OUTPUT_DIR.glob("*.json"):
        try:
            file_dt = datetime.fromisoformat(old_file.stem).replace(tzinfo=timezone.utc)
            if file_dt < cutoff:
                old_file.unlink()
                print(f"  [PURGE] {old_file.name}")
        except ValueError:
            pass

    seen_urls = load_existing_urls()
    print(f"  {len(seen_urls)} URLs already committed")

    covered = build_covered_set()
    print(f"  {len(covered)} stories covered by local outlets")

    candidates = fetch_candidates(seen_urls)
    print(f"  {len(candidates)} fresh Kosovo candidates")

    # Seed used_images from previous runs so same photo isn't reused across hourly jobs
    used_images: set[str] = set()
    for f in OUTPUT_DIR.glob("*.json"):
        try:
            for a in json.loads(f.read_text(encoding="utf-8")):
                img = a.get("image_url", "")
                if img and img.startswith("http"):
                    used_images.add(img)
        except Exception:
            pass
    print(f"  {len(used_images)} images already used in existing articles")

    results: list[dict] = []
    accepted_kws: list[set[str]] = []
    for c in candidates:
        if len(results) >= MAX_PER_RUN:
            break

        title_en = c["title_en"]
        summary = c["summary"]

        if is_duplicate(title_en, summary, covered):
            print(f"  [DUP]  {title_en[:70]}")
            continue

        candidate_kws = _kw(title_en) | _kw(summary[:300])
        if any(len(candidate_kws & akw) >= 4 for akw in accepted_kws):
            print(f"  [DUP-INTRA] {title_en[:70]}")
            continue

        analysis = analyze_and_translate(title_en, summary, source=c["source"])
        if analysis is None:
            print(f"  [SKIP] {title_en[:70]}")
            continue

        score = float(analysis.get("score", 0))
        if score < 5:
            print(f"  [LOW {score:.1f}] {title_en[:70]}")
            continue

        print(f"  [OK  {score:.1f}] {title_en[:70]}")

        image_url = get_image(c["url"], title_en, c.get("raw_image"), analysis.get("category", ""), used_images)
        used_images.add(image_url)

        article_title = analysis.get("title", title_en)
        video_clip_url = search_youtube_clip(article_title[:80])

        pub_dt = c["published_at"] or datetime.now(timezone.utc)
        body = analysis.get("body", summary)
        featured = score >= 9 or bool(analysis.get("breaking"))
        slug_base = slugify(article_title)[:60]

        results.append({
            "id":             str(uuid.uuid4()),
            "slug":           f"{slug_base}-{pub_dt.strftime('%Y-%m-%d')}",
            "url":            c["url"],
            "dispatch":       f"{len(results) + 1:02d}",
            "title":          article_title,
            "excerpt":        analysis.get("excerpt", summary[:200]),
            "body":           body,
            "source":         c["source"],
            "source_flag":    c["source_flag"],
            "source_bias":    analysis.get("source_bias", c["source_bias"]),
            "tone":           analysis.get("tone", "neutral"),
            "category":       analysis.get("category", "Botë"),
            "published_at":   pub_dt.isoformat(),
            "reading_time":   max(1, round(len(body.split()) / 200)),
            "featured":       featured,
            "engagement_score": round(score, 1),
            "score_reason":   analysis.get("reason", ""),
            "score_breakdown": analysis.get("breakdown", {}),
            "image_url":      image_url,
            "video_clip_url": video_clip_url,
            "created_at":     datetime.now(timezone.utc).isoformat(),
        })
        accepted_kws.append(candidate_kws)

    print(f"  {len(results)} articles ready")

    # Cap "AI News" GNews articles so they don't crowd out Kosovo coverage
    ai_articles = [r for r in results if r.get("source") == "AI News"]
    if len(ai_articles) > AI_CAP:
        non_ai = [r for r in results if r.get("source") != "AI News"]
        results = non_ai + ai_articles[:AI_CAP]
        print(f"  Capped AI News articles to {AI_CAP} ({len(results)} total)")

    if results:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
        out_filename = f"{ts}.json"
        out = OUTPUT_DIR / out_filename
        out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  → {out}")
        send_email(results, out_filename)
    else:
        print("  Nothing new — no file written, no email sent")


if __name__ == "__main__":
    main()
