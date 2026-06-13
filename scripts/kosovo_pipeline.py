#!/usr/bin/env python3
"""
Kosovo News Automated Pipeline — runs hourly via GitHub Actions.
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
GOOGLE_SEARCH_KEY  = os.environ.get("GOOGLE_SEARCH_API_KEY", "")
GOOGLE_CSE_ID      = os.environ.get("GOOGLE_CSE_ID", "")
PEXELS_API_KEY     = os.environ.get("PEXELS_API_KEY", "")
ALLOW_STOCK_IMAGES = os.environ.get("ALLOW_STOCK_IMAGES", "").strip().lower() in {"1", "true", "yes", "on"}
GMAIL_USER         = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
REMOVE_SECRET      = os.environ.get("REMOVE_SECRET", "")
SITE_URL           = os.environ.get("SITE_URL", "https://383lajme.vercel.app")
RECIPIENT_EMAIL    = os.environ.get("RECIPIENT_EMAIL") or "lindsylqa@gmail.com"
GOOGLE_AI_MODEL    = os.environ.get("GOOGLE_AI_MODEL", "gemma-4-26b-a4b-it")
GOOGLE_AI_BACKUP_MODEL = os.environ.get("GOOGLE_AI_BACKUP_MODEL", "gemma-4-31b-it")
# LLM provider: hosted Google Gemma only for article scoring/writing.
LLM_PROVIDERS: list[dict[str, str]] = []
if GOOGLE_AI_API_KEY:
    model_candidates = [
        GOOGLE_AI_MODEL,
        GOOGLE_AI_BACKUP_MODEL,
        # Official hosted Gemma 4 models in the Gemini API.
        "gemma-4-26b-a4b-it",
        "gemma-4-31b-it",
    ]
    for model_name in dict.fromkeys(model_candidates):
        if not model_name:
            continue
        LLM_PROVIDERS.append({
            "provider": "Google Gemma",
            "kind": "google",
            "url": f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
            "model": model_name,
            "key": GOOGLE_AI_API_KEY,
        })
LLM_PROVIDER = LLM_PROVIDERS[0]["provider"] if LLM_PROVIDERS else "none"
LLM_MODEL = LLM_PROVIDERS[0]["model"] if LLM_PROVIDERS else ""
LLM_SUCCESS_COUNTS: dict[str, int] = {}
# Legacy aliases kept for backward compat
GEMMA_URL   = LLM_PROVIDERS[0]["url"] if LLM_PROVIDERS else ""
GEMMA_MODEL = LLM_MODEL
MAX_AGE_HOURS      = 72
MAX_PER_RUN        = int(os.environ.get("MAX_PER_RUN", "14"))
MIN_PER_RUN        = 6
MAX_AI_CALLS       = int(os.environ.get("MAX_AI_CALLS", "24"))
MIN_SCORE          = 6.0
CANDIDATE_POOL_LIMIT = 90
AI_CAP             = 8
SPORT_CAP          = 7
WORLD_CAP          = 7
MAX_RUNTIME_MINUTES = float(os.environ.get("MAX_RUNTIME_MINUTES", "50"))
MIN_SECONDS_FOR_NEXT_ANALYSIS = int(os.environ.get("MIN_SECONDS_FOR_NEXT_ANALYSIS", "210"))
SCORE_WEIGHTS      = {
    "relevance": 0.35,
    "urgency": 0.20,
    "interest": 0.30,
    "credibility": 0.15,
}

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
    # Kosovo internal news and viral/controversial local debate
    ("https://news.google.com/rss/search?q=Kosov%C3%AB+OR+Kosova+OR+Prishtin%C3%AB+OR+Prishtina+when%3A2d&hl=sq&gl=XK&ceid=XK:sq",
     "_GNEWS_EXTRACT_", "🇽🇰", "neutral", True),
    ("https://news.google.com/rss/search?q=%22Albin+Kurti%22+OR+%22Vjosa+Osmani%22+OR+%22Kuvendi+i+Kosov%C3%ABs%22+OR+%22Qeveria+e+Kosov%C3%ABs%22+when%3A3d&hl=sq&gl=XK&ceid=XK:sq",
     "_GNEWS_EXTRACT_", "🇽🇰", "neutral", True),
    ("https://news.google.com/rss/search?q=Kosovo+Kurti+claim+statement+controversy+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", True),
    ("https://news.google.com/rss/search?q=Kosovo+scandal+OR+accused+OR+claim+OR+parliament+OR+police+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", True),
    # Social-signal discovery: claims/posts that become news, without treating the post itself as verified fact
    ("https://news.google.com/rss/search?q=Kosovo+%28X+OR+Twitter+OR+Instagram+OR+TikTok+OR+viral+OR+video+OR+post%29+%28claim+OR+accused+OR+controversy+OR+statement%29+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", True),
    ("https://news.google.com/rss/search?q=Kosova+%28Instagram+OR+TikTok+OR+Facebook+OR+video+OR+postim+OR+viral%29+%28akuz%C3%AB+OR+deklarat%C3%AB+OR+skandal+OR+debat%29+when%3A2d&hl=sq&gl=XK&ceid=XK:sq",
     "_GNEWS_EXTRACT_", "🇽🇰", "neutral", True),
    ("https://news.google.com/rss/search?q=Kosovo+economy+business+investment+tax+prices+jobs+%28controversy+OR+warning+OR+claim+OR+statement%29+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_EXTRACT_", "🌍", "neutral", True),
    # Serbian and regional framing about Kosovo
    ("https://news.google.com/rss/search?q=Kosovo+Kurti+OR+Pristina+OR+%22Kosovo+police%22+when%3A3d&hl=en-US&gl=RS&ceid=RS:en",
     "_SERBIAN_GNEWS_", "🇷🇸", "hostile", True),
    ("https://news.google.com/rss/search?q=Kosovo+OR+Kosova+OR+Kurti+OR+Pri%C5%A1tina+when%3A3d&hl=sr&gl=RS&ceid=RS:sr",
     "_SERBIAN_GNEWS_", "🇷🇸", "hostile", True),
    ("https://news.google.com/rss/search?q=Kosovo+Serbia+%28X+OR+Twitter+OR+Instagram+OR+viral+OR+video+OR+claim%29+when%3A2d&hl=en-US&gl=RS&ceid=RS:en",
     "_SERBIAN_GNEWS_", "🇷🇸", "hostile", True),
    # World drama, conflict, politics, and high-interest international stories
    ("https://news.google.com/rss/search?q=world+breaking+news+scandal+OR+controversy+OR+resignation+OR+protest+when%3A1d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_WORLD_", "🌍", "neutral", True),
    ("https://news.google.com/rss/search?q=Europe+politics+drama+OR+election+OR+court+OR+sanctions+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_WORLD_", "🌍", "neutral", True),
    ("https://news.google.com/rss/search?q=world+%28X+OR+Twitter+OR+Instagram+OR+TikTok+OR+YouTube+OR+Reddit%29+viral+controversy+claim+when%3A1d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_WORLD_", "🌍", "neutral", True),
    ("https://news.google.com/rss/search?q=global+economy+markets+prices+jobs+trade+%28shock+OR+warning+OR+controversy+OR+scandal%29+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_WORLD_", "🌍", "neutral", True),
    # AI and tech: product releases, company drama, investment, and The Rundown-style stories
    ("https://news.google.com/rss/search?q=%22The+Rundown+AI%22+OR+%22AI+startup%22+OR+%22AI+model%22+OR+OpenAI+OR+Anthropic+OR+Gemini+when%3A1d&hl=en-US&gl=US&ceid=US:en",
     "AI News", "🤖", "neutral", True),
    ("https://news.google.com/rss/search?q=AI+drama+OR+lawsuit+OR+acquisition+OR+funding+OR+model+release+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "AI News", "🤖", "neutral", True),
    ("https://news.google.com/rss/search?q=AI+%28X+OR+Twitter+OR+Reddit+OR+YouTube+OR+viral%29+%28drama+OR+claim+OR+demo+OR+controversy%29+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "AI News", "🤖", "neutral", True),
    # Sports: Kosovo sports plus major global events, controversy, and match analysis
    ("https://news.google.com/rss/search?q=Kosovo+football+OR+basketball+OR+judo+OR+sport+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_SPORT_", "🏀", "neutral", True),
    ("https://news.google.com/rss/search?q=Kosov%C3%AB+futboll+OR+basketboll+OR+xhudo+OR+sport+when%3A3d&hl=sq&gl=XK&ceid=XK:sq",
     "_GNEWS_SPORT_", "🏀", "neutral", True),
    ("https://news.google.com/rss/search?q=%22World+Cup+2026%22+OR+FIFA+World+Cup+match+red+card+referee+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_SPORT_", "🌍", "neutral", True),
    ("https://news.google.com/rss/search?q=%22433%22+football+OR+%22433%22+World+Cup+OR+Instagram+football+stats+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_SPORT_", "⚽", "neutral", True),
    ("https://news.google.com/rss/search?q=football+%28Instagram+OR+TikTok+OR+X+OR+Twitter+OR+viral+video+OR+post%29+World+Cup+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_SPORT_", "⚽", "neutral", True),
    ("https://news.google.com/rss/search?q=sports+%28Instagram+OR+TikTok+OR+X+OR+Twitter+OR+viral+video+OR+post%29+%28controversy+OR+claim+OR+reaction%29+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_SPORT_", "🏀", "neutral", True),
    ("https://news.google.com/rss/search?q=World+Cup+2026+referee+VAR+red+card+controversy+OR+decision+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_SPORT_", "🌍", "neutral", True),
    ("https://news.google.com/rss/search?q=%22NBA+Finals%22+OR+%22Formula+1%22+OR+%22Grand+Prix%22+OR+UFC+fight+when%3A2d&hl=en-US&gl=US&ceid=US:en",
     "_GNEWS_SPORT_", "🏀", "neutral", True),
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
    # Sports outlets / organizations
    "ESPN":          ("ESPN",         "🏀"),
    "BBC Sport":     ("BBC Sport",    "🇬🇧"),
    "Sky Sports":    ("Sky Sports",   "🇬🇧"),
    "The Athletic":  ("The Athletic", "🏀"),
    "FIFA":          ("FIFA",         "🌍"),
    "Formula 1":     ("Formula 1",    "🏎️"),
    "NBA":           ("NBA",          "🏀"),
    "UFC":           ("UFC",          "🥊"),
    "433":           ("433",          "⚽"),
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
    "report", "reports", "reported", "confirmed", "details", "context",
    "story", "stories", "exclusive", "update", "updates", "latest", "readers",
    "separate", "facts", "number",
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
    "AI News":          (4, "Google News AI/tech cluster — verify specific claims through source context"),
    "OpenAI Blog":      (4, "official company blog — primary source for OpenAI news"),
    "Google Blog":      (4, "official company blog — primary source for Google news"),
    "ESPN":             (3, "major sports outlet — strong for global sports context and match analysis"),
    "BBC Sport":        (3, "major broadcaster sports desk — reliable for global sports"),
    "Sky Sports":       (3, "major sports outlet — strong for football, F1, boxing and transfers"),
    "The Athletic":     (3, "specialist sports reporting — strong analysis and reporting"),
    "FIFA":             (2, "official football governing body — primary source for schedules and match facts"),
    "Formula 1":        (2, "official F1 source — primary source for race facts and schedules"),
    "NBA":              (2, "official NBA source — primary source for league facts and schedules"),
    "UFC":              (2, "official UFC source — primary source for fight cards and results"),
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
    candidate = _kw(title) | _kw(summary[:240])
    if len(candidate) < 8:
        return False
    for c in covered:
        overlap = len(candidate & c)
        if overlap >= 8 and overlap / max(1, min(len(candidate), len(c))) >= 0.55:
            return True
    return False


def is_intra_duplicate(candidate_kws: set[str], accepted_kws: list[set[str]]) -> bool:
    if len(candidate_kws) < 8:
        return False
    for accepted in accepted_kws:
        overlap = len(candidate_kws & accepted)
        if overlap >= 8 and overlap / max(1, min(len(candidate_kws), len(accepted))) >= 0.55:
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


def resolve_article_url(article_url: str) -> str:
    if "news.google.com" not in article_url:
        return article_url
    try:
        r = requests.get(
            article_url, timeout=10,
            headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"},
            allow_redirects=True,
        )
        return r.url or article_url
    except Exception:
        return article_url


def fetch_article_text(article_url: str) -> str:
    actual_url = resolve_article_url(article_url)
    try:
        r = requests.get(actual_url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code != 200:
            return ""
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            tag.decompose()
        paragraphs = []
        for el in soup.select("article p, main p, .article-body p, .entry-content p, .post-content p"):
            text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
            if len(text) >= 45:
                paragraphs.append(text)
        if not paragraphs:
            for el in soup.find_all("p"):
                text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
                if len(text) >= 60:
                    paragraphs.append(text)
        joined = "\n".join(paragraphs[:12])
        return joined[:5000]
    except Exception:
        return ""


def _candidate_lane(source: str, source_name: str, title: str) -> str:
    text = f"{source} {source_name} {title}".lower()
    title_text = title.lower()
    words = set(re.findall(r"[a-z0-9]+", text))
    title_words = set(re.findall(r"[a-z0-9]+", title_text))
    if source == "_SERBIAN_GNEWS_":
        return "Serbian"
    sport_words = {"sport", "football", "basketball", "nba", "fifa", "ufc", "judo", "futboll", "basketboll"}
    if title_words & sport_words or any(phrase in title_text for phrase in ["world cup", "formula 1", "grand prix"]):
        return "Sport"
    if (
        "ai" in words
        or "openai" in words
        or "gemini" in words
        or "anthropic" in words
        or "tech" in words
        or "artificial intelligence" in text
    ):
        return "Tech"
    if source == "_GNEWS_WORLD_":
        return "World"
    if any(word in text for word in ["kosovo", "kosova", "kosovë", "kurti", "prishtina", "pristina"]):
        return "Kosovo"
    return "Other"


def _candidate_priority(candidate: dict) -> int:
    text = f"{candidate.get('title_en', '')} {candidate.get('summary', '')} {candidate.get('source', '')}".lower()
    lane = candidate.get("lane", "Other")
    score = 0

    lane_boost = {
        "Kosovo": 35,
        "Serbian": 32,
        "Sport": 28,
        "Tech": 25,
        "World": 20,
        "Other": 8,
    }
    score += lane_boost.get(lane, 0)

    dramatic_terms = [
        "breaking", "scandal", "controversy", "controversial", "accused", "claim",
        "claims", "alleged", "arrest", "police", "court", "protest", "resign",
        "sanction", "threat", "attack", "red card", "referee", "var", "decision",
        "final", "fight", "grand prix", "world cup", "433", "instagram", "tiktok",
        "twitter", "x post", "posted on x", "reddit", "youtube", "viral", "video",
    ]
    score += sum(8 for term in dramatic_terms if term in text)

    kosovo_terms = ["kosovo", "kosova", "kosovë", "kurti", "osmani", "prishtina", "serbia", "belgrade"]
    score += sum(6 for term in kosovo_terms if term in text)

    tech_terms = ["openai", "gemini", "anthropic", "claude", "chatgpt", "ai model", "lawsuit", "funding", "startup"]
    score += sum(5 for term in tech_terms if term in text)

    sport_terms = ["world cup", "football", "basketball", "nba", "f1", "formula 1", "ufc", "fifa", "judo"]
    score += sum(5 for term in sport_terms if term in text)

    source = candidate.get("source", "")
    if source in SOURCE_TIERS:
        tier, _ = SOURCE_TIERS[source]
        score += max(0, 12 - tier * 2)
    if source in {"433", "FIFA", "NBA", "Formula 1", "UFC"}:
        score += 8

    if any(term in text for term in ["opinion", "oped", "op-ed"]):
        score -= 8

    published_at = candidate.get("published_at")
    if published_at:
        age_hours = (datetime.now(timezone.utc) - published_at).total_seconds() / 3600
        if age_hours <= 6:
            score += 12
        elif age_hours <= 24:
            score += 7
        elif age_hours <= 48:
            score += 3

    return score


def diversify_candidates(candidates: list[dict]) -> list[dict]:
    lane_order = ["Kosovo", "Serbian", "Sport", "Tech", "World", "Other"]
    buckets: dict[str, list[dict]] = {lane: [] for lane in lane_order}
    for candidate in candidates:
        buckets.setdefault(candidate.get("lane", "Other"), []).append(candidate)
    for bucket in buckets.values():
        bucket.sort(key=_candidate_priority, reverse=True)

    diversified: list[dict] = []
    while any(buckets.values()):
        for lane in lane_order:
            if buckets.get(lane):
                diversified.append(buckets[lane].pop(0))

    lane_counts = {lane: sum(1 for c in candidates if c.get("lane") == lane) for lane in lane_order}
    print("  Candidate lanes: " + ", ".join(f"{lane}={count}" for lane, count in lane_counts.items() if count))
    return diversified[:CANDIDATE_POOL_LIMIT]


# ── RSS fetch ─────────────────────────────────────────────────────────────────
def fetch_candidates(seen_urls: set[str]) -> list[dict]:
    candidates: list[dict] = []
    source_counts: dict[str, int] = {}
    candidate_keys: set[str] = set()
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

                if source in {"_GNEWS_EXTRACT_", "_GNEWS_WORLD_", "_GNEWS_SPORT_"}:
                    # Google News appends " - Outlet Name" to every title
                    parts = raw_title.rsplit(" - ", 1)
                    outlet = parts[1].strip() if len(parts) == 2 else "International"
                    clean_title = parts[0].strip() if len(parts) == 2 else raw_title

                    # Map to canonical label; unknown outlets keep their raw name
                    source_name, source_flag = outlet, flag
                    for key, (sname, sflag) in GNEWS_SOURCE_MAP.items():
                        outlet_lower = outlet.lower()
                        key_lower = key.lower()
                        short_key = len(key_lower) <= 4
                        if (short_key and outlet_lower == key_lower) or (not short_key and key_lower in outlet_lower):
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

                dedupe_key = re.sub(r"\W+", " ", clean_title.lower()).strip()
                if dedupe_key in candidate_keys:
                    continue
                candidate_keys.add(dedupe_key)

                candidates.append({
                    "url":          url,
                    "source":       source_name,
                    "source_flag":  source_flag,
                    "source_bias":  bias,
                    "lane":         _candidate_lane(source, source_name, clean_title),
                    "title_en":     clean_title,
                    "summary":      _clean_html(entry.get("summary", "")),
                    "raw_image":    _feed_image(entry),
                    "published_at": _parse_published(entry),
                })
                source_counts[source_name] = source_counts.get(source_name, 0) + 1
        except Exception as e:
            print(f"  Feed error [{source}]: {e}")
    if source_counts:
        top_sources = sorted(source_counts.items(), key=lambda item: item[1], reverse=True)[:12]
        print("  Candidate sources: " + ", ".join(f"{name}={count}" for name, count in top_sources))
    return candidates


# ── LLM API (hosted Google Gemma) ─────────────────────────────────────────────
def _prompt_from_messages(messages: list[dict]) -> str:
    return "\n\n".join(str(m.get("content", "")) for m in messages if m.get("content"))


def _call_google_ai(llm: dict, prompt: str, max_tokens: int, temperature: float) -> str:
    resp = requests.post(
        llm["url"],
        headers={
            "x-goog-api-key": llm["key"],
            "Content-Type": "application/json",
        },
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "application/json",
            },
        },
        timeout=120,
    )
    if not resp.ok:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:500]}")
    payload = resp.json()
    parts = (
        payload.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [])
    )
    text = "".join(part.get("text", "") for part in parts).strip()
    if not text:
        finish = payload.get("candidates", [{}])[0].get("finishReason", "unknown")
        raise RuntimeError(f"empty response from {llm['model']} finishReason={finish}: {json.dumps(payload)[:500]}")
    return text


def _gemma(messages: list[dict], max_tokens: int = 1024, temperature: float = 0.3) -> str:
    if not LLM_PROVIDERS:
        raise RuntimeError("Set GOOGLE_AI_API_KEY before running the Kosovo pipeline")

    last_error: Exception | None = None
    prompt = _prompt_from_messages(messages)
    for llm in LLM_PROVIDERS:
        try:
            text = _call_google_ai(llm, prompt, max_tokens=max_tokens, temperature=temperature)
            print(f"  LLM success: {llm['provider']} ({llm['model']})")
            counter_key = f"{llm['provider']} ({llm['model']})"
            LLM_SUCCESS_COUNTS[counter_key] = LLM_SUCCESS_COUNTS.get(counter_key, 0) + 1
            return text
        except Exception as e:
            last_error = e
            print(f"  LLM provider failed: {llm['provider']} ({llm['model']}): {e}")

    raise RuntimeError(f"Google Gemma failed: {last_error}")


def _parse_json(text: str) -> dict:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()
    text = re.sub(r"^[^{]*", "", text, count=1)
    text = re.sub(r"[^}]*$", "", text, count=1)
    text = re.sub(r",\s*([}\]])", r"\1", text)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        return json.loads(m.group())
    return json.loads(text)


def _is_fatal_llm_error(exc: Exception) -> bool:
    text = str(exc).lower()
    fatal_markers = [
        "resource_exhausted",
        "monthly spending cap",
        "api key not valid",
        "permission_denied",
        "not found for api version",
        "is not supported for generatecontent",
    ]
    return any(marker in text for marker in fatal_markers)


def _bounded_score(value: object, default: float = 1.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = default
    return max(1.0, min(10.0, numeric))


def calculate_weighted_score(breakdown: dict | None, fallback: object = 0) -> float:
    if not isinstance(breakdown, dict):
        return round(_bounded_score(fallback, 0), 1)
    weighted = sum(
        _bounded_score(breakdown.get(key), 1.0) * weight
        for key, weight in SCORE_WEIGHTS.items()
    )
    return round(weighted, 1)


def score_formula_text(breakdown: dict | None) -> str:
    if not isinstance(breakdown, dict):
        return "Nuk pati breakdown te plote nga Google Gemma."
    parts = []
    for key, weight in SCORE_WEIGHTS.items():
        value = _bounded_score(breakdown.get(key), 1.0)
        parts.append(f"{key} {value:.1f} x {weight:.2f}")
    return " + ".join(parts)


def _heuristic_category(title: str, summary: str, lane: str = "") -> str:
    text = f"{title} {summary} {lane}".lower()
    if lane == "Sport" or any(word in text for word in ["football", "basketball", "world cup", "fifa", "nba", "ufc", "formula 1", "grand prix", "judo", "sport", "futboll"]):
        return "Sport"
    if lane == "Tech" or any(word in text for word in ["ai", "openai", "gemini", "anthropic", "chatgpt", "startup", "model", "technology", "tech"]):
        return "Teknologji"
    if any(word in text for word in ["economy", "economic", "business", "market", "prices", "trade", "investment", "jobs", "bank"]):
        return "Ekonomi"
    if any(word in text for word in ["police", "security", "arrest", "attack", "court", "trial", "war", "border"]):
        return "Siguri"
    if any(word in text for word in ["celebrity", "music", "film", "concert", "showbiz"]):
        return "Showbiz"
    if lane == "World":
        return "Botë"
    return "Politikë" if any(word in text for word in ["kosovo", "kosova", "kurti", "osmani", "serbia", "prishtina"]) else "Botë"


ALBANIAN_MARKERS = {
    "dhe", "në", "ne", "për", "per", "që", "qe", "është", "eshte",
    "nga", "me", "një", "nje", "të", "te", "si", "por", "kjo",
    "ky", "ajo", "ai", "u", "ka", "kanë", "kane", "tha", "sipas",
    "kosovë", "kosove", "kosova", "shqip", "lajmi", "lexuesit",
}


def is_albanian_output(analysis: dict) -> bool:
    text = " ".join(str(analysis.get(key, "")) for key in ["title", "excerpt", "body", "reason"]).lower()
    words = re.findall(r"[a-zA-ZÀ-ÿ]+", text)
    if len(words) < 55:
        return False
    marker_hits = sum(1 for word in words if word in ALBANIAN_MARKERS)
    marker_ratio = marker_hits / max(1, len(words))
    has_albanian_chars = any(ch in text for ch in "ëçËÇ")
    return marker_hits >= 10 and (marker_ratio >= 0.035 or has_albanian_chars)


def clean_generated_title(title: object, fallback: str = "") -> str:
    title_text = str(title or fallback or "").strip()
    title_text = re.sub(r"\s+", " ", title_text)
    title_text = re.sub(r"\s*[—–-]\s*ja\s+(pse|çfarë|cfar[eë]).*$", "", title_text, flags=re.IGNORECASE)
    title_text = re.sub(r"\bja\s+pse\b[:\s-]*", "", title_text, flags=re.IGNORECASE).strip(" -—–")
    return title_text[:180] or str(fallback or "").strip()


def normalize_analysis(analysis: dict, fallback_title: str) -> dict:
    analysis["title"] = clean_generated_title(analysis.get("title"), fallback_title)
    for key in ("excerpt", "body", "reason", "tone", "source_bias", "category"):
        if key in analysis and analysis[key] is not None:
            analysis[key] = str(analysis[key]).strip()
    return analysis


def analyze_and_translate(title: str, summary: str, source: str = "", article_text: str = "") -> dict | None:
    """Score and translate an article in one Google Gemma call. Returns None if all retries fail."""
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
  "title": "Accurate Albanian news headline: specific, factual, natural, max 18 words",
  "excerpt": "exactly 2 sentences: fact + Kosovo impact, max 25 words each",
  "body": "full Albanian article 4-5 paragraphs, coherent with title, using only verified source facts",
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
The final "score" = relevance*0.35 + urgency*0.20 + interest*0.30 + credibility*0.15, rounded to 1 decimal.
The "reason" must mention: source name, what makes this score high/low, and one key fact from the article.

Categories: Politikë, Ekonomi, Botë, Siguri, Sport, Teknologji, Kulturë, Shoqëri, Showbiz
Score guide:
- 9-10: BREAKING — major model releases (GPT-5, Gemini 4, Claude 4), AI company lawsuits/scandals (Musk vs Altman), Kosovo security incidents, Serbian official statements on Kosovo
- 8-9: Big Kosovo political developments, controversial public claims about Kosovo leaders that are sourced and framed carefully, AI product launches (new Gemini version, OpenAI Codex mobile), Mira Murati news (ALWAYS score 8+ — she is Albanian, Kosovo readers care deeply about her AI work and her company Thinking Machines), major World Cup/NBA/F1/UFC events
- 7-8: Important Kosovo international coverage, Serbian media framing that Kosovo readers will discuss, AI funding rounds >$500M, tech CEO drama, strong Kosovo sport results, major referee/VAR/red-card controversy
- 5-6: Routine Kosovo politics, smaller local disputes, general AI trend pieces, Balkan economy news, ordinary match previews/results
- 1-4: Generic or unrelated — skip
Use "Showbiz" for celebrity, entertainment, music, film, and pop culture news.
Use "Sport" for football, basketball, judo, NBA, F1, UFC, World Cup, athlete drama, match results, refereeing controversy, transfers, and Kosovo sport.
Use "Teknologji" for ALL AI, software, tech, and innovation news — NOT generic "AI is changing jobs" pieces.
IMPORTANT: For AI/tech news, score SPECIFIC events highly: new model version released, company acquisition, CEO controversy, major investment. Vague trend articles score 1-4 and should be skipped.
IMPORTANT: For controversial claims, rumors, or social-media-driven stories: do NOT state them as fact unless the source proves them. Write "pretendon", "tha", "akuzoi", "u raportua", or "nuk është verifikuar" and explain what is confirmed.
IMPORTANT: Social platforms are SIGNALS, not proof. A story from X/Twitter, Instagram, TikTok, YouTube, Reddit, or a sports/social account can score high only if the provided article/source gives enough context to report it responsibly.
IMPORTANT: Do not invent Instagram/Twitter facts. If the provided article says a post exists, you may mention the post as reported by that source; otherwise omit it.
IMPORTANT: For viral football/sports accounts such as 433, treat them as useful engagement signals. Prefer official match reports, club/league sources, or established sports outlets for facts like scores, cards, injuries, transfers, and referee decisions.
IMPORTANT: Accuracy beats length. Use ONLY facts present in the title, summary, and article text below. If the article text is short, write a shorter article instead of inventing names, numbers, quotes, dates, or reactions.
IMPORTANT: Clarity beats style. The target reader is a normal Kosovo reader on a modern news site, not a policy expert. Every title, excerpt, and paragraph must be understandable on first read.
IMPORTANT: Translate meaning, not word order. Never produce literal English-to-Albanian phrasing that sounds unnatural.

RREGULL KRYESOR — KOHERENCA:
Titulli, ekserpti dhe body-i duhet të tregojnë TË NJËJTËN histori.
Fjalia e parë e paragrafit 1 duhet të zgjerojë SAKTË temën e titullit — asnjë temë tjetër.
GABIM: Titulli "Kurti takon NATO-n" + Body hapet "Lufta në Ukrainë..." ✗
SAKTË: Titulli "Kurti takon NATO-n" + Body hapet "Kryeministri Albin Kurti u takua sot me..." ✓

TITULLI — titull lajmi i saktë dhe i lexueshëm (max 18 fjalë):
Titulli duhet të japë faktin kryesor pa clickbait dhe pa premtime boshe.
Lexuesi duhet ta kuptojë menjëherë kush bëri çfarë, ku dhe pse ka rëndësi.
Mos përdor formula virale si "ja pse", "ja çfarë", "arsyeja do t'ju habisë",
"tregon gjithçka", ose tituj që premtojnë shpjegim pa dhënë faktin.
Nëse titulli mund të keqkuptohet pa e lexuar artikullin, rishkruaje më thjeshtë.

Modele të pranueshme:
- "[Kush] [bëri/tha/vendosi] [çfarë] në [vend/institucion]"
  Shembull: "Kurti takohet me zyrtarë të NATO-s për sigurinë në veri"
- "[Institucioni] miraton [vendimin] pas [ngjarjes/kontekstit]"
  Shembull: "BE-ja kërkon zbatim më të shpejtë të marrëveshjes Kosovë-Serbi"
- "[Kompania/Personi] prezanton [produktin/vendimin] me ndikim për [grupin]"
  Shembull: "OpenAI prezanton model të ri që ul koston e përdorimit të AI-së"

Rregulla teknike të titullit:
- Kohë e tashme ose e kryer e thjeshtë, zë aktiv
- Fjalë konkrete: emra, numra, vende, njerëz realë — jo abstraksione
- KURRË: "Situata", "Zhvillimi i rëndësishëm", "Kriza e re" pa sqarim specifik
- KURRË: "ja pse", "ja çfarë", "dhe arsyeja", "do t'ju habisë"
- KURRË fjalë-për-fjalë nga anglishtja — riformulo plotësisht për lexuesin shqiptar

EKSERPTI (saktësisht 2 fjali):
- Fjalia 1: fakti kryesor (emër specifik, numër konkret, ose ngjarje e saktë)
- Fjalia 2: pse i intereson lexuesit kosovar — impakti direkt
- Max 25 fjalë secila. Pa zhargon. Pa "sipas burimeve".
- Mos përdor fjali të paqarta si "kjo ngre pyetje" ose "situata mbetet komplekse" pa shpjeguar konkretisht çfarë ndodhi.
- SAKTË: "Serbia refuzoi marrëveshjen sot në Bruksel. Kjo vonon liberalizimin e vizave me të paktën dy vjet." ✓
- GABIM: "Sipas burimeve zyrtare, situata është komplekse dhe ka shumë aspekte." ✗

BODY (zakonisht 300-450 fjalë — 4-5 paragrafë):
Shkruaj si po i shpjegon lajmin një miku inteligjent në kafene — me detaje dhe kontekst.
Jo komunikatë zyrtare. Jo resumé i shkurtër. Mos shto fakte që nuk janë në materialin burimor.

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
Summary: {summary[:1200]}
Article text from source page, if available:
{article_text[:5000] if article_text else "(not available — use only title and summary, and keep the body shorter)"}"""

    for attempt in range(3):
        try:
            final_prompt = prompt
            if attempt == 2:
                final_prompt += "\n\nKRITIKE: Pergjigju VETEM shqip. Titulli, excerpt, reason dhe body duhet te jene ne shqip, jo anglisht/serbisht. Perkthe dhe riformulo cdo fjali."
            raw = _gemma([{"role": "user", "content": final_prompt}], max_tokens=6000, temperature=0.65)
            parsed = _parse_json(raw)
            parsed = normalize_analysis(parsed, title)
            if not is_albanian_output(parsed):
                raise ValueError("Google Gemma output was not Albanian enough")
            return parsed
        except Exception as e:
            if _is_fatal_llm_error(e):
                raise RuntimeError(
                    "Fatal Google Gemma provider error; stopping the run instead of "
                    "burning the whole hourly budget on repeated AI failures."
                ) from e
            if attempt < 2:
                wait = 4
                print(f"  analyze_and_translate attempt {attempt + 1} failed: {e} — retrying in {wait}s")
                time.sleep(wait)
            else:
                print(f"  analyze_and_translate failed after 3 attempts: {e} — skipping article")
                return None


# ── Image pipeline ────────────────────────────────────────────────────────────
CAT_QUERIES: dict[str, str] = {
    "Politikë":   "Kosovo government parliament politics",
    "Siguri":     "Kosovo security police military",
    "Ekonomi":    "Kosovo economy finance business",
    "Teknologji": "artificial intelligence technology computer",
    "Botë":       "world news international diplomacy",
    "Sport":      "football basketball stadium athlete match sports",
    "Kulturë":    "culture arts festival music Kosovo",
    "Shoqëri":    "people society Kosovo city public life",
    "Showbiz":    "celebrity entertainment concert stage",
}

SCENE_MAP: dict[str, str] = {
    "Politikë":   "Kosovo parliament politicians formal meeting press conference",
    "Siguri":     "security forces police military checkpoint Kosovo",
    "Ekonomi":    "Kosovo economy business finance professional meeting",
    "Teknologji": "technology artificial intelligence computer screens modern office",
    "Botë":       "international diplomacy world leaders formal summit",
    "Sport":      "football stadium basketball arena athletes match action",
    "Kulturë":    "culture festival concert gallery stage Kosovo",
    "Shoqëri":    "Kosovo city street people public life",
    "Showbiz":    "concert stage performance entertainment celebrity spotlight",
}


def _looks_like_article_image(url: str, used_images: set[str]) -> bool:
    if not url or not url.startswith(("http://", "https://")):
        return False
    if url in used_images:
        return False
    lowered = url.lower()
    bad_bits = [
        "logo", "icon", "avatar", "sprite", "placeholder", "default-image",
        "tracking", "pixel", "analytics", "ads.", "/ads/", "doubleclick",
    ]
    if any(bit in lowered for bit in bad_bits):
        return False
    return any(ext in lowered for ext in [".jpg", ".jpeg", ".png", ".webp"]) or "image" in lowered


def _src_from_srcset(srcset: str) -> str:
    if not srcset:
        return ""
    # Prefer the first/highest declared candidate rather than leaving srcset unusable.
    candidates = [part.strip().split(" ")[0] for part in srcset.split(",") if part.strip()]
    return candidates[-1] if candidates else ""


def _jsonld_images(soup: BeautifulSoup) -> list[str]:
    images: list[str] = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            payload = json.loads(script.string or "")
        except Exception:
            continue
        queue = payload if isinstance(payload, list) else [payload]
        while queue:
            item = queue.pop(0)
            if isinstance(item, list):
                queue.extend(item)
                continue
            if not isinstance(item, dict):
                continue
            img = item.get("image") or item.get("thumbnailUrl")
            if isinstance(img, str):
                images.append(img)
            elif isinstance(img, list):
                for entry in img:
                    if isinstance(entry, str):
                        images.append(entry)
                    elif isinstance(entry, dict) and entry.get("url"):
                        images.append(str(entry["url"]))
            elif isinstance(img, dict) and img.get("url"):
                images.append(str(img["url"]))
            graph = item.get("@graph")
            if isinstance(graph, list):
                queue.extend(graph)
    return images


def _article_native_images(actual_url: str, used_images: set[str]) -> list[str]:
    images: list[str] = []
    try:
        r = requests.get(actual_url, timeout=45, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code != 200:
            return images
        soup = BeautifulSoup(r.text, "html.parser")

        for prop in [
            "og:image", "og:image:secure_url", "twitter:image", "twitter:image:src",
            "thumbnail", "image",
        ]:
            tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
            if tag and tag.get("content"):
                images.append(urllib.parse.urljoin(actual_url, tag["content"].strip()))

        link = soup.find("link", rel=lambda rel: rel and "image_src" in rel)
        if link and link.get("href"):
            images.append(urllib.parse.urljoin(actual_url, link["href"].strip()))

        images.extend(urllib.parse.urljoin(actual_url, img) for img in _jsonld_images(soup))

        for el in soup.select("article img, main img, .article-body img, .entry-content img, .post-content img, figure img"):
            src = (
                el.get("src")
                or el.get("data-src")
                or el.get("data-original")
                or _src_from_srcset(el.get("srcset", "") or el.get("data-srcset", ""))
            )
            if not src:
                continue
            try:
                width = int(el.get("width") or 0)
                height = int(el.get("height") or 0)
                if width and height and (width < 240 or height < 140):
                    continue
            except ValueError:
                pass
            images.append(urllib.parse.urljoin(actual_url, src.strip()))
    except Exception:
        return images

    result = []
    seen = set()
    for img in images:
        if img not in seen and _looks_like_article_image(img, used_images):
            result.append(img)
            seen.add(img)
    return result


def get_image(article_url: str, title: str, raw_image: str | None, category: str = "", used_images: set | None = None) -> str:
    used_images = used_images or set()

    # Resolve Google News redirect → actual article URL
    actual_url = resolve_article_url(article_url)

    # Tier 0 — actual article image. This should win whenever the selected article exposes one.
    native_images = _article_native_images(actual_url, used_images)
    if native_images:
        return native_images[0]

    # Tier 1 — Raw feed image, but only if it is a real image URL and not a Google News thumbnail.
    if raw_image:
        raw = urllib.parse.urljoin(actual_url, raw_image.strip())
        if "googleusercontent.com" not in raw and _looks_like_article_image(raw, used_images):
            return raw

    # Tier 2 — Google Custom Search Images, used only when article-native images are absent.
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
            for item in items:
                img = item.get("link", "")
                if _looks_like_article_image(img, used_images):
                    return img
        except Exception:
            pass

    # Tier 3 — Pexels API is opt-in only. Stock images made article pages look low quality.
    if ALLOW_STOCK_IMAGES and PEXELS_API_KEY:
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
def _format_counts(counts: dict[str, int]) -> str:
    if not counts:
        return "none"
    return ", ".join(f"{key}: {value}" for key, value in sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def _scoring_explainer_html(run_stats: dict) -> str:
    provider_counts = run_stats.get("llm_success_counts", {})
    provider_text = _format_counts(provider_counts) if provider_counts else "Google Gemma nuk ktheu artikuj të publikuar"
    return f"""
      <div style="padding:14px 20px;border-bottom:1px solid #2a2a2a;background:#111;">
        <div style="font-size:12px;color:#ddd;line-height:1.6;">
          <b style="color:#fff;">AI provider:</b> {provider_text}. Pipeline-i përdor vetëm Google Gemma për scoring, përkthim dhe shkrim.
        </div>
        <div style="font-size:12px;color:#aaa;line-height:1.6;margin-top:6px;">
          <b style="color:#fff;">Si llogaritet score:</b>
          relevance 35% + urgency 20% + interest 30% + credibility 15%.
          Artikujt publikohen vetëm nëse score është të paktën {MIN_SCORE:.1f}/10 dhe titulli, excerpt-i, arsyeja dhe body janë në shqip.
        </div>
        <div style="font-size:11px;color:#777;line-height:1.5;margin-top:6px;">
          Relevance mat lidhjen me Kosovën/lexuesin shqiptar. Urgency mat sa i freskët dhe i kohës është lajmi. Interest mat dramën, debatueshmërinë, viralitetin dhe klikueshmërinë. Credibility mat besueshmërinë e burimit dhe e ul pikën për pretendime të paverifikuara.
        </div>
      </div>"""


def send_email(articles: list[dict], out_filename: str, run_stats: dict | None = None) -> None:
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
    if articles:
        subject = f"383 Lajme — {len(articles)} artikuj të rinj [{now}]"
        heading = f"383 Lajme — {len(articles)} artikuj të rinj u shtuan"
    else:
        subject = f"383 Lajme — raporti automatik: 0 artikuj të rinj [{now}]"
        heading = "383 Lajme — nuk u gjetën artikuj të rinj"

    run_stats = run_stats or {}
    summary_html = f"""
      <div style="padding:14px 20px;border-bottom:1px solid #2a2a2a;background:#151515;">
        <div style="font-size:12px;color:#aaa;line-height:1.6;">
          <b style="color:#fff;">Përmbledhje automatizimi:</b>
          kandidatë {run_stats.get('candidates', '?')} • analizuar {run_stats.get('analyzed', '?')} • publikuar {len(articles)} • dublikata lokale {run_stats.get('duplicates', 0)} • dublikata brenda run-it {run_stats.get('intra_duplicates', 0)} • pikë të ulëta {run_stats.get('low_score', 0)} • gabime AI/gjuhë {run_stats.get('ai_failed', 0)}{' • ndalur nga buxheti i kohës' if run_stats.get('time_budget_stop') else ''}
        </div>
        <div style="font-size:11px;color:#777;line-height:1.5;margin-top:4px;">Lanes: {_format_counts(run_stats.get('lanes', {}))}</div>
        <div style="font-size:11px;color:#777;line-height:1.5;">Kategori të publikuara: {_format_counts(run_stats.get('accepted_categories', {}))}</div>
      </div>"""
    scoring_html = _scoring_explainer_html(run_stats)

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
            formula = html.escape(a.get("score_formula") or score_formula_text(breakdown))
            breakdown_html = f"""<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;margin:6px 0 8px;font-size:11px;color:#777;">
              <span>🗺 Relevanca: <b style="color:#ccc">{r_v}/10</b></span>
              <span>⚡ Urgjenca: <b style="color:#ccc">{u_v}/10</b></span>
              <span>💬 Interesi: <b style="color:#ccc">{i_v}/10</b></span>
              <span>✅ Kredibiliteti: <b style="color:#ccc">{c_v}/10</b></span>
            </div>
            <div style="font-size:10px;color:#666;margin:-2px 0 8px;line-height:1.4;">Formula: {formula} = <b style="color:#aaa">{score:.1f}/10</b></div>"""

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

    if not rows:
        rows.append("""
        <tr>
          <td style="padding:20px;border-bottom:1px solid #2a2a2a;">
            <div style="font-size:16px;font-weight:700;color:#ffffff;margin-bottom:8px;line-height:1.35;">Nuk pati artikuj të rinj për t'u shtuar këtë orë.</div>
            <div style="font-size:13px;color:#999;line-height:1.5;">Automatizimi u krye me sukses, por filtrat nuk gjetën lajme të reja që kaluan kontrollin e dublikimit, relevancës dhe pikëzimit.</div>
          </td>
        </tr>""")

    email_html = f"""<!DOCTYPE html>
<html>
<body style="background:#111;font-family:sans-serif;margin:0;padding:20px;">
  <div style="max-width:640px;margin:auto;">
    <div style="background:#1a1a1a;border-radius:12px;overflow:hidden;">
      <div style="padding:24px 20px;border-bottom:1px solid #2a2a2a;">
        <h2 style="color:#fff;margin:0 0 6px;font-size:20px;">{heading}</h2>
        <p style="color:#666;margin:0;font-size:13px;">{now} • Sistemi automatik i lajmeve ndërkombëtare</p>
      </div>
      {summary_html}
      {scoring_html}
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
    print(f"  Email sent to {RECIPIENT_EMAIL}: {subject}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    run_started_monotonic = time.monotonic()
    deadline_monotonic = run_started_monotonic + (MAX_RUNTIME_MINUTES * 60)
    print(f"[Kosovo Pipeline] {datetime.now(timezone.utc).isoformat()}")
    provider_label = ", ".join(f"{p['provider']} ({p['model']})" for p in LLM_PROVIDERS) or "not configured"
    print(f"  LLM providers: {provider_label}")
    print(f"  Runtime budget: {MAX_RUNTIME_MINUTES:.1f} min (workflow timeout should be higher)")

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
    candidates = diversify_candidates(candidates)
    print(f"  {len(candidates)} fresh candidates after source/lane filtering")
    run_stats = {
        "candidates": len(candidates),
        "lanes": {},
        "analyzed": 0,
        "duplicates": 0,
        "intra_duplicates": 0,
        "ai_failed": 0,
        "low_score": 0,
        "time_budget_stop": False,
        "accepted_categories": {},
        "llm_success_counts": LLM_SUCCESS_COUNTS,
    }
    for candidate in candidates:
        lane = candidate.get("lane", "Other")
        run_stats["lanes"][lane] = run_stats["lanes"].get(lane, 0) + 1

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
        seconds_left = deadline_monotonic - time.monotonic()
        if seconds_left < MIN_SECONDS_FOR_NEXT_ANALYSIS:
            print(
                f"  Runtime budget nearly spent ({seconds_left:.0f}s left); "
                "stopping candidate analysis and publishing accepted articles."
            )
            run_stats["time_budget_stop"] = True
            break
        if len(results) >= MAX_PER_RUN:
            break
        if run_stats["analyzed"] >= MAX_AI_CALLS:
            print(f"  AI call cap reached after {run_stats['analyzed']} analyses")
            break

        title_en = c["title_en"]
        summary = c["summary"]

        if is_duplicate(title_en, summary, covered):
            print(f"  [DUP]  {title_en[:70]}")
            run_stats["duplicates"] += 1
            continue

        candidate_kws = _kw(title_en) | _kw(summary[:300])
        if is_intra_duplicate(candidate_kws, accepted_kws):
            print(f"  [DUP-INTRA] {title_en[:70]}")
            run_stats["intra_duplicates"] += 1
            continue

        run_stats["analyzed"] += 1
        article_text = fetch_article_text(c["url"])
        analysis = analyze_and_translate(title_en, summary, source=c["source"], article_text=article_text)
        if analysis is None:
            run_stats["ai_failed"] += 1
            print(f"  [SKIP-AI/LANG] {title_en[:70]}")
            continue

        score = calculate_weighted_score(analysis.get("breakdown"), analysis.get("score", 0))
        analysis["score"] = score
        if score < MIN_SCORE:
            print(f"  [LOW {score:.1f}] {title_en[:70]}")
            run_stats["low_score"] += 1
            continue

        print(f"  [OK  {score:.1f}] {title_en[:70]}")
        category = analysis.get("category", "Botë")
        run_stats["accepted_categories"][category] = run_stats["accepted_categories"].get(category, 0) + 1

        image_url = get_image(c["url"], title_en, c.get("raw_image"), category, used_images)
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
            "category":       category,
            "published_at":   pub_dt.isoformat(),
            "reading_time":   max(1, round(len(body.split()) / 200)),
            "featured":       featured,
            "engagement_score": round(score, 1),
            "score_reason":   analysis.get("reason", ""),
            "score_breakdown": analysis.get("breakdown", {}),
            "score_formula":  score_formula_text(analysis.get("breakdown")),
            "image_url":      image_url,
            "video_clip_url": video_clip_url,
            "created_at":     datetime.now(timezone.utc).isoformat(),
        })
        accepted_kws.append(candidate_kws)

    print(f"  {len(results)} articles ready")
    print(
        "  Selection summary: "
        f"analyzed={run_stats['analyzed']}, "
        f"duplicates={run_stats['duplicates']}, "
        f"intra_duplicates={run_stats['intra_duplicates']}, "
        f"low_score={run_stats['low_score']}, "
        f"ai_failed={run_stats['ai_failed']}"
    )

    # Cap "AI News" GNews articles so they don't crowd out Kosovo coverage
    ai_articles = [r for r in results if r.get("source") == "AI News"]
    if len(ai_articles) > AI_CAP:
        non_ai = [r for r in results if r.get("source") != "AI News"]
        results = non_ai + ai_articles[:AI_CAP]
        print(f"  Capped AI News articles to {AI_CAP} ({len(results)} total)")

    sport_articles = [r for r in results if r.get("category") == "Sport"]
    if len(sport_articles) > SPORT_CAP:
        non_sport = [r for r in results if r.get("category") != "Sport"]
        results = non_sport + sport_articles[:SPORT_CAP]
        print(f"  Capped Sport articles to {SPORT_CAP} ({len(results)} total)")

    world_articles = [r for r in results if r.get("category") == "Botë"]
    if len(world_articles) > WORLD_CAP:
        non_world = [r for r in results if r.get("category") != "Botë"]
        results = non_world + world_articles[:WORLD_CAP]
        print(f"  Capped Botë articles to {WORLD_CAP} ({len(results)} total)")

    if results:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
        out_filename = f"{ts}.json"
        out = OUTPUT_DIR / out_filename
        out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  → {out}")
        send_email(results, out_filename, run_stats)
    else:
        raise RuntimeError(
            "No articles were published because none passed the Google Gemma, Albanian-language, duplicate, and score filters. "
            f"Candidates={run_stats['candidates']}, analyzed={run_stats['analyzed']}, "
            f"duplicates={run_stats['duplicates']}, intra_duplicates={run_stats['intra_duplicates']}, "
            f"low_score={run_stats['low_score']}, ai_failed={run_stats['ai_failed']}."
        )


if __name__ == "__main__":
    main()
