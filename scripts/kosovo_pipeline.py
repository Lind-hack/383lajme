#!/usr/bin/env python3
"""
Kosovo News Automated Pipeline — runs every 2 hours via GitHub Actions.
Fetches Kosovo news from international/Balkan sources, deduplicates against
local outlets (Telegrafi, Koha), scores for engagement, generates Albanian
content, finds/generates images, writes JSON, sends email notification.
"""

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
import time

import feedparser
import requests
from bs4 import BeautifulSoup
from slugify import slugify

# ── Config ────────────────────────────────────────────────────────────────────
GOOGLE_AI_API_KEY  = os.environ.get("GOOGLE_AI_API_KEY", "")
PEXELS_API_KEY     = os.environ.get("PEXELS_API_KEY", "")
GMAIL_USER         = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
REMOVE_SECRET      = os.environ.get("REMOVE_SECRET", "")
SITE_URL           = os.environ.get("SITE_URL", "https://383lajme.vercel.app")
RECIPIENT_EMAIL    = "lindsylqa@gmail.com"
GEMMA_URL          = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
GEMMA_MODEL        = "gemma-4-31b-it"
MAX_AGE_HOURS      = 48
MAX_PER_RUN        = 25
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
    # Sport
    ("https://news.google.com/rss/search?q=Kosovo+football+OR+%22Vedat+Muriqi%22+OR+%22Edon+Zhegrova%22+when%3A3d&hl=en-US&gl=US&ceid=US:en",
     "Sport News", "⚽", "neutral", True),
    # ── Serbian sources — Kosovo topic (all get hostile bias) ─────────────────
    ("https://news.google.com/rss/search?q=Kosovo+OR+Kosova+when%3A1d&hl=sr&gl=RS&ceid=RS:sr",
     "_SERBIAN_GNEWS_", "🇷🇸", "hostile", True),
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
            feed = feedparser.parse(url, request_headers={"User-Agent": "Mozilla/5.0"})
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
            feed = feedparser.parse(feed_url, request_headers={"User-Agent": "Mozilla/5.0"})
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


# ── Google Gemma 4 API ────────────────────────────────────────────────────────
def _gemma(messages: list[dict], max_tokens: int = 1024, temperature: float = 0.3) -> str:
    resp = requests.post(
        GEMMA_URL,
        headers={"Authorization": f"Bearer {GOOGLE_AI_API_KEY}", "Content-Type": "application/json"},
        json={"model": GEMMA_MODEL, "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
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


def analyze_and_translate(title: str, summary: str) -> dict | None:
    """Score and translate an article in one Gemma call. Returns None if all retries fail."""
    prompt = f"""You are a Kosovo news editor. Given an article (which may be in English, Serbian, or Albanian), do TWO things in one JSON response:
1. Score it for a Kosovo audience (1-10)
2. Rewrite it in Albanian (Shqip) as a Kosovo journalist

Return ONLY this JSON (no markdown, no explanation):
{{
  "score": 8.2,
  "featured": false,
  "category": "Politikë",
  "breaking": false,
  "reason": "one sentence why this score",
  "title": "Albanian headline (max 15 words)",
  "excerpt": "2-3 sentence Albanian lead",
  "body": "full Albanian article 4-5 paragraphs ~300 words",
  "tone": "neutral",
  "source_bias": "neutral"
}}

Categories: Politikë, Ekonomi, Siguri, Sport, Teknologji, Kulturë, Shoqëri, Diasporë, Showbiz
Score guide:
- 9-10: BREAKING — major model releases (GPT-5, Gemini 4, Claude 4), AI company lawsuits/scandals (Musk vs Altman), Kosovo security incidents, Serbian official statements on Kosovo
- 8-9: Big Kosovo political developments, AI product launches (new Gemini version, OpenAI Codex mobile), Mira Murati news (ALWAYS score 8+ — she is Albanian, Kosovo readers care deeply about her AI work and her company Thinking Machines)
- 7-8: Important Kosovo international coverage, AI funding rounds >$500M, tech CEO drama, strong sport results
- 5-6: Routine Kosovo politics, general AI trend pieces, Balkan economy news
- 1-4: Generic or unrelated — skip
Use "Showbiz" for celebrity, entertainment, music, film, and pop culture news.
Use "Teknologji" for ALL AI, software, tech, and innovation news — NOT generic "AI is changing jobs" pieces.
IMPORTANT: For AI/tech news, score SPECIFIC events highly: new model version released, company acquisition, CEO controversy, major investment. Vague trend articles score 1-4 and should be skipped.

Albanian style rules — apply to title, excerpt, and body:
- Write like a friend explaining news to another friend — simple, warm, direct
- Short sentences: max 15 words each. Break long ideas into two sentences.
- Active voice: "Qeveria vendosi" not "Vendimi u mor nga qeveria"
- Avoid formal conjunctions: use "por" not "megjithatë", "sepse" not "për arsye se"
- Prefer everyday words: "thotë" not "deklaron", "fillon" not "inicizon", "rritje" not "inkrement"
- Headline: punchy, present-tense where possible — "Kurti takon Biden" not "Kryeministri Kurti ka realizuar një takim me presidentin Biden"
- Excerpt: 2 crisp sentences a reader can skim in 5 seconds — no subordinate clauses
- Body: start each paragraph differently; vary sentence length; no academic phrasing

Title: {title}
Summary: {summary[:600]}"""

    for attempt in range(3):
        try:
            raw = _gemma([{"role": "user", "content": prompt}], max_tokens=4096, temperature=0.55)
            return _parse_json(raw)
        except Exception as e:
            if attempt < 2:
                wait = 4 * (attempt + 1)
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
    "Sport":      "Kosovo football sport stadium",
    "Kulturë":    "Kosovo culture art tradition",
    "Showbiz":    "celebrity entertainment concert stage",
    "Diasporë":   "Kosovo diaspora community abroad",
    "Shoqëri":    "Kosovo society people community",
}


def get_image(article_url: str, title: str, raw_image: str | None, category: str = "") -> str:
    # 0. Use raw_image from feed if it's not Google's hotlink-blocked CDN
    if raw_image and "googleusercontent.com" not in raw_image and raw_image.startswith("http"):
        return raw_image

    # 1. Resolve Google News redirect to the actual article URL
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

    # 2. Scrape og:image from the real article page
    try:
        r = requests.get(actual_url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            og = soup.find("meta", property="og:image")
            if og and og.get("content"):
                img = og["content"]
                if "googleusercontent.com" not in img:
                    return img
    except Exception:
        pass

    # 3. Pexels API — category-aware query, no random pagination
    if PEXELS_API_KEY:
        try:
            cat_base = CAT_QUERIES.get(category, "Kosovo news")
            words = re.findall(r"[A-Za-z]{5,}", title)
            filtered = [w for w in words if w.lower() not in STOPWORDS][:2]
            query = cat_base + (" " + " ".join(filtered) if filtered else "")
            r = requests.get(
                "https://api.pexels.com/v1/search",
                headers={"Authorization": PEXELS_API_KEY},
                params={"query": query, "per_page": 5, "orientation": "landscape", "page": 1},
                timeout=10,
            )
            photos = r.json().get("photos", [])
            if photos:
                return photos[0]["src"]["large"]
        except Exception:
            pass

    # 4. Pollinations.ai — completely free, no API key needed
    prompt = urllib.parse.quote(f"Kosovo news {title[:60]}, press photo")
    return f"https://image.pollinations.ai/prompt/{prompt}?width=1200&height=630&nologo=true"


# ── Email notification ────────────────────────────────────────────────────────
def send_email(articles: list[dict], out_filename: str) -> None:
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("  No email credentials — skipping email")
        return

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

        remove_btn = ""
        if REMOVE_SECRET and SITE_URL:
            remove_url = f"{SITE_URL}/api/remove?id={a['id']}&file={out_filename}&secret={REMOVE_SECRET}"
            remove_btn = f'&nbsp;&nbsp;&nbsp;<a href="{remove_url}" style="color:#ff6b6b;font-size:12px;text-decoration:none;">🗑 Hiq nga faqja</a>'

        reason_row = f'<div style="font-size:13px;color:#999;font-style:italic;margin-bottom:10px;line-height:1.4;">{reason}</div>' if reason else ""

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

        analysis = analyze_and_translate(title_en, summary)
        time.sleep(1)  # throttle Groq to prevent 429 bursts
        if analysis is None:
            print(f"  [SKIP] {title_en[:70]}")
            continue

        score = float(analysis.get("score", 0))
        if score < 5:
            print(f"  [LOW {score:.1f}] {title_en[:70]}")
            continue

        print(f"  [OK  {score:.1f}] {title_en[:70]}")

        image_url = get_image(c["url"], title_en, c.get("raw_image"), analysis.get("category", ""))

        pub_dt = c["published_at"] or datetime.now(timezone.utc)
        body = analysis.get("body", summary)
        featured = score >= 9 or bool(analysis.get("breaking"))
        slug_base = slugify(analysis.get("title", title_en))[:60]

        results.append({
            "id":             str(uuid.uuid4()),
            "slug":           f"{slug_base}-{pub_dt.strftime('%Y-%m-%d')}",
            "url":            c["url"],
            "dispatch":       f"{len(results) + 1:02d}",
            "title":          analysis.get("title", title_en),
            "excerpt":        analysis.get("excerpt", summary[:200]),
            "body":           body,
            "source":         c["source"],
            "source_flag":    c["source_flag"],
            "source_bias":    analysis.get("source_bias", c["source_bias"]),
            "tone":           analysis.get("tone", "neutral"),
            "category":       analysis.get("category", "Shoqëri"),
            "published_at":   pub_dt.isoformat(),
            "reading_time":   max(1, len(body.split()) // 200),
            "featured":       featured,
            "engagement_score": round(score, 1),
            "score_reason":   analysis.get("reason", ""),
            "image_url":      image_url,
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
