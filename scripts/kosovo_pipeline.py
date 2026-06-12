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
# LLM providers: prefer Gemini for article scoring/writing, then Groq if Gemini fails.
LLM_PROVIDERS: list[dict[str, str]] = []
if GOOGLE_AI_API_KEY:
    LLM_PROVIDERS.append({
        "provider": "Gemini",
        "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "model": "gemini-2.0-flash",
        "key": GOOGLE_AI_API_KEY,
    })
if GROQ_API_KEY:
    LLM_PROVIDERS.append({
        "provider": "Groq",
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "model": "llama-3.3-70b-versatile",
        "key": GROQ_API_KEY,
    })
LLM_PROVIDER = LLM_PROVIDERS[0]["provider"] if LLM_PROVIDERS else "none"
LLM_MODEL = LLM_PROVIDERS[0]["model"] if LLM_PROVIDERS else ""
# Legacy aliases kept for backward compat
GEMMA_URL   = LLM_PROVIDERS[0]["url"] if LLM_PROVIDERS else ""
GEMMA_MODEL = LLM_MODEL
MAX_AGE_HOURS      = 72
MAX_PER_RUN        = 18
MIN_PER_RUN        = 8
MAX_AI_CALLS       = 30
MIN_SCORE          = 4.5
RESCUE_MIN_SCORE   = 3.2
CANDIDATE_POOL_LIMIT = 90
AI_CAP             = 8
SPORT_CAP          = 7
WORLD_CAP          = 7

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


# ── LLM API (Gemini primary, Groq fallback) ───────────────────────────────────
def _gemma(messages: list[dict], max_tokens: int = 1024, temperature: float = 0.3) -> str:
    if not LLM_PROVIDERS:
        raise RuntimeError("Set GOOGLE_AI_API_KEY or GROQ_API_KEY before running the Kosovo pipeline")

    last_error: Exception | None = None
    for llm in LLM_PROVIDERS:
        try:
            resp = requests.post(
                llm["url"],
                headers={"Authorization": f"Bearer {llm['key']}", "Content-Type": "application/json"},
                json={"model": llm["model"], "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
                timeout=60,
            )
            resp.raise_for_status()
            print(f"  LLM success: {llm['provider']} ({llm['model']})")
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            last_error = e
            print(f"  LLM provider failed: {llm['provider']} ({llm['model']}): {e}")

    raise RuntimeError(f"All LLM providers failed: {last_error}")


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


def fallback_article_analysis(title: str, summary: str, source: str = "", lane: str = "") -> dict:
    clean_title = _clean_title(title).strip() or "Lajm i ri"
    clean_summary = _clean_html(summary).strip()
    if not clean_summary:
        clean_summary = f"Burimi {source or 'i monitoruar'} publikoi një zhvillim të ri për këtë temë."

    category = _heuristic_category(clean_title, clean_summary, lane)
    score = 4.6 if lane in {"Kosovo", "Serbian", "Sport", "Tech"} else 4.2
    social_warning = ""
    if any(term in f"{clean_title} {clean_summary}".lower() for term in ["instagram", "twitter", "x ", "tiktok", "reddit", "viral", "post"]):
        social_warning = " Pjesa që lidhet me rrjetet sociale duhet lexuar si pretendim i raportuar, jo si fakt i pavarur."

    body = (
        f"{clean_title}. {clean_summary}\n\n"
        f"Ky artikull u krijua nga përmbledhja e burimit {source or 'të monitoruar'}, sepse shërbimi AI nuk ktheu përgjigje gjatë këtij run-i. "
        "Redaksia automatike e 383 Lajme e përfshiu sepse tema ka sinjal aktualiteti dhe interes për lexuesit. "
        f"{social_warning}\n\n"
        "Pikat kryesore janë marrë nga titulli dhe përmbledhja e burimit origjinal. Lexuesi duhet të klikojë artikullin origjinal për detajet e plota, deklaratat e sakta dhe kontekstin shtesë. "
        "Nëse bëhet fjalë për debat, akuzë, video virale ose postim në rrjete sociale, formulimi duhet trajtuar si raportim i asaj që u tha, jo si verifikim përfundimtar."
    )

    return {
        "score": score,
        "breakdown": {
            "relevance": 6 if lane in {"Kosovo", "Serbian"} else 5,
            "urgency": 6,
            "interest": 6,
            "credibility": 4,
        },
        "featured": False,
        "category": category,
        "breaking": False,
        "reason": f"Fallback pa AI: {source or 'burim i monitoruar'} u publikua sepse ka sinjal aktual dhe kaloi filtrat bazë.",
        "title": clean_title[:140],
        "excerpt": f"{clean_summary[:160]}. Lexo burimin origjinal për kontekstin e plotë.",
        "body": body,
        "tone": "neutral",
        "source_bias": "neutral",
    }


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
def _format_counts(counts: dict[str, int]) -> str:
    if not counts:
        return "none"
    return ", ".join(f"{key}: {value}" for key, value in sorted(counts.items(), key=lambda item: (-item[1], item[0])))


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
          kandidatë {run_stats.get('candidates', '?')} • analizuar {run_stats.get('analyzed', '?')} • publikuar {len(articles)} • fallback {run_stats.get('fallback_articles', 0)} • rescue {run_stats.get('rescued', 0)} • dublikata lokale {run_stats.get('duplicates', 0)} • dublikata brenda run-it {run_stats.get('intra_duplicates', 0)} • pikë të ulëta {run_stats.get('low_score', 0)} • gabime AI {run_stats.get('ai_failed', 0)}
        </div>
        <div style="font-size:11px;color:#777;line-height:1.5;margin-top:4px;">Lanes: {_format_counts(run_stats.get('lanes', {}))}</div>
        <div style="font-size:11px;color:#777;line-height:1.5;">Kategori të publikuara: {_format_counts(run_stats.get('accepted_categories', {}))}</div>
      </div>"""

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
    print(f"[Kosovo Pipeline] {datetime.now(timezone.utc).isoformat()}")
    provider_label = ", ".join(f"{p['provider']} ({p['model']})" for p in LLM_PROVIDERS) or "not configured"
    print(f"  LLM providers: {provider_label}")

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
        "fallback_articles": 0,
        "low_score": 0,
        "rescued": 0,
        "accepted_categories": {},
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
        analysis = analyze_and_translate(title_en, summary, source=c["source"])
        if analysis is None:
            run_stats["ai_failed"] += 1
            analysis = fallback_article_analysis(title_en, summary, source=c["source"], lane=c.get("lane", ""))
            run_stats["fallback_articles"] += 1
            print(f"  [FALLBACK] {title_en[:70]}")

        score = float(analysis.get("score", 0))
        threshold = RESCUE_MIN_SCORE if len(results) < MIN_PER_RUN else MIN_SCORE
        rescue_accept = score < MIN_SCORE and score >= threshold and len(results) < MIN_PER_RUN
        if score < threshold:
            print(f"  [LOW {score:.1f}] {title_en[:70]}")
            run_stats["low_score"] += 1
            continue

        if rescue_accept:
            print(f"  [RESCUE {score:.1f}] {title_en[:70]}")
            run_stats["rescued"] += 1
        else:
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
        f"rescued={run_stats['rescued']}, "
        f"fallback={run_stats['fallback_articles']}, "
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
            "No articles were published after rescue mode. "
            f"Candidates={run_stats['candidates']}, analyzed={run_stats['analyzed']}, "
            f"duplicates={run_stats['duplicates']}, intra_duplicates={run_stats['intra_duplicates']}, "
            f"low_score={run_stats['low_score']}, ai_failed={run_stats['ai_failed']}."
        )


if __name__ == "__main__":
    main()
