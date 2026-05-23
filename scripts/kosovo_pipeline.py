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

import feedparser
import requests
from bs4 import BeautifulSoup
from slugify import slugify

# ── Config ────────────────────────────────────────────────────────────────────
GOOGLE_AI_API_KEY  = os.environ.get("GOOGLE_AI_API_KEY", "")
PEXELS_API_KEY     = os.environ.get("PEXELS_API_KEY", "")
GMAIL_USER         = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
RECIPIENT_EMAIL    = "lindsylqa@gmail.com"
GOOGLE_AI_URL      = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
GEMMA_MODEL        = "gemma-4-31b-it"
MAX_AGE_HOURS      = 48
MAX_PER_RUN        = 8

SCRIPT_DIR  = Path(__file__).parent
OUTPUT_DIR  = SCRIPT_DIR.parent / "data" / "auto-articles"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Sources ───────────────────────────────────────────────────────────────────
# International / Balkan-focused — explicitly NOT local Kosovo outlets
NEWS_SOURCES = [
    ("https://balkaninsight.com/feed/",                                             "Balkan Insight",  "🌍", "neutral"),
    ("https://europeanwesternbalkans.com/feed/",                                    "EWB",             "🌍", "neutral"),
    ("https://exit.al/en/feed/",                                                    "Exit News",       "🇦🇱", "neutral"),
    ("https://feeds.bbci.co.uk/news/world/europe/rss.xml",                          "BBC",             "🇬🇧", "neutral"),
    ("https://rss.dw.com/rss/en-all",                                               "DW",              "🇩🇪", "neutral"),
    ("https://apnews.com/rss/world-news",                                           "AP",              "🇺🇸", "neutral"),
    ("https://www.france24.com/en/rss",                                             "France 24",       "🇫🇷", "neutral"),
    ("https://news.google.com/rss/search?q=Kosovo+news&hl=en-US&gl=US&ceid=US:en", "Google News",     "🌐",  "neutral"),
    ("https://news.google.com/rss/search?q=Kosovo+Serbia&hl=en-US&gl=US&ceid=US:en","Google News",    "🌐",  "neutral"),
]

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
                    kws = _kw(entry.get("title", "") + " " + entry.get("summary", ""))
                    if kws:
                        covered.append(kws)
        except Exception as e:
            print(f"  Dedup feed error ({url}): {e}")
    return covered


def is_duplicate(title: str, summary: str, covered: list[set[str]]) -> bool:
    candidate = _kw(title + " " + summary)
    for c in covered:
        if len(candidate & c) >= 3:
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
    for feed_url, source, flag, bias in NEWS_SOURCES:
        try:
            feed = feedparser.parse(feed_url, request_headers={"User-Agent": "Mozilla/5.0"})
            for entry in feed.entries[:25]:
                url = entry.get("link", "")
                if not url or url in seen_urls:
                    continue
                if not is_recent(entry):
                    continue
                text = (entry.get("title", "") + " " + entry.get("summary", "")).lower()
                if not any(kw in text for kw in KOSOVO_KEYWORDS):
                    continue
                candidates.append({
                    "url": url,
                    "source": source,
                    "source_flag": flag,
                    "source_bias": bias,
                    "title_en": entry.get("title", ""),
                    "summary": entry.get("summary", ""),
                    "raw_image": _feed_image(entry),
                    "published_at": _parse_published(entry),
                })
        except Exception as e:
            print(f"  Feed error [{source}]: {e}")
    return candidates


# ── Google AI / Gemma API ─────────────────────────────────────────────────────
def _strip_thinking(text: str) -> str:
    # Gemma 4 wraps its reasoning in <thought>...</thought> — strip before parsing
    return re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL).strip()


def _gemma(messages: list[dict], max_tokens: int = 1024) -> str:
    resp = requests.post(
        GOOGLE_AI_URL,
        headers={"Authorization": f"Bearer {GOOGLE_AI_API_KEY}", "Content-Type": "application/json"},
        json={"model": GEMMA_MODEL, "messages": messages, "max_tokens": max_tokens},
        timeout=120,
    )
    resp.raise_for_status()
    return _strip_thinking(resp.json()["choices"][0]["message"]["content"])


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


def score_article(title: str, summary: str) -> dict:
    prompt = f"""Rate this Kosovo news article for a Kosovo audience.

Scoring guide:
- 9-10: breaking (elections, arrests, major policy, conflict, international crisis)
- 7-8: important but not breaking
- 5-6: interesting but niche
- 1-4: low relevance or routine

Return ONLY JSON: {{"score": 8.2, "featured": false, "category": "Politikë", "breaking": false}}
Categories must be exactly one of: Politikë, Ekonomi, Siguri, Sport, Teknologji, Kulturë, Shoqëri, Diasporë

Title: {title}
Summary: {summary[:400]}"""
    try:
        return _parse_json(_gemma([{"role": "user", "content": prompt}]))
    except Exception as e:
        print(f"  Score error: {e}")
        return {"score": 0, "featured": False, "category": "Shoqëri", "breaking": False}


def generate_content(title: str, summary: str) -> dict:
    prompt = f"""You are a Kosovo news journalist writing in Albanian (Shqip) for 383 Lajme.

Original article (English):
Title: {title}
Summary: {summary[:800]}

Produce a JSON object with EXACTLY these 5 keys:
- title: compelling Albanian headline (max 15 words)
- excerpt: 2-3 sentence Albanian lead paragraph
- body: full Albanian article, 4-5 paragraphs, ~250-350 words, journalistic style
- tone: EXACTLY one of [positive, neutral, negative]
- source_bias: EXACTLY one of [neutral, pro-kosovo, critical]

Return ONLY the JSON object. No markdown, no code blocks, no explanation."""
    try:
        return _parse_json(_gemma([{"role": "user", "content": prompt}], max_tokens=4096))
    except Exception as e:
        print(f"  Content gen error: {e}")
        return {
            "title": title,
            "excerpt": summary[:200],
            "body": summary,
            "tone": "neutral",
            "source_bias": "neutral",
        }


# ── Image pipeline ────────────────────────────────────────────────────────────
def get_image(article_url: str, title: str, raw_image: str | None) -> str:
    # 1. Image embedded in feed metadata
    if raw_image:
        return raw_image

    # 2. Scrape og:image from article page
    try:
        r = requests.get(article_url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            og = soup.find("meta", property="og:image")
            if og and og.get("content"):
                return og["content"]
    except Exception:
        pass

    # 3. Pexels API (requires PEXELS_API_KEY)
    if PEXELS_API_KEY:
        try:
            r = requests.get(
                "https://api.pexels.com/v1/search",
                headers={"Authorization": PEXELS_API_KEY},
                params={"query": f"Kosovo {title[:40]}", "per_page": 1, "orientation": "landscape"},
                timeout=10,
            )
            photos = r.json().get("photos", [])
            if photos:
                return photos[0]["src"]["large"]
        except Exception:
            pass

    # 4. Pollinations.ai — completely free, no API key needed
    prompt = urllib.parse.quote(f"Kosovo news {title[:60]}, photorealistic journalism")
    return f"https://image.pollinations.ai/prompt/{prompt}?width=1200&height=630&nologo=true"


# ── Email notification ────────────────────────────────────────────────────────
def send_email(articles: list[dict]) -> None:
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("  No email credentials — skipping email")
        return

    now = datetime.now(timezone.utc).strftime("%H:%M UTC")
    subject = f"383 Lajme — {len(articles)} artikuj të rinj [{now}]"

    rows = []
    for i, a in enumerate(articles, 1):
        star = "⭐ FEATURED" if a.get("featured") else ""
        score = a.get("engagement_score", 0)
        rows.append(f"""
        <tr>
          <td style="padding:12px;border-bottom:1px solid #333;color:#fff;">
            <strong>#{i} {star} Score: {score:.1f}</strong><br>
            <span style="font-size:16px;">{a['title']}</span><br>
            <small style="color:#aaa;">Kategoria: {a.get('category','?')} | Burimi: {a.get('source','?')}</small><br>
            <a href="{a.get('url','')}" style="color:#4af;">→ Artikulli origjinal</a>
          </td>
        </tr>""")

    html = f"""<!DOCTYPE html>
<html>
<body style="background:#111;font-family:sans-serif;margin:0;padding:20px;">
  <div style="max-width:600px;margin:auto;">
    <h2 style="color:#fff;">383 Lajme — {len(articles)} artikuj të rinj u shtuan</h2>
    <p style="color:#aaa;">{now} — Burimet: internacionale dhe Ballkan</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;">
      {''.join(rows)}
    </table>
    <p style="color:#666;font-size:12px;margin-top:16px;">Automatizuar nga 383 News Pipeline</p>
  </div>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = GMAIL_USER
    msg["To"] = RECIPIENT_EMAIL
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        smtp.sendmail(GMAIL_USER, RECIPIENT_EMAIL, msg.as_string())
    print(f"  Email sent: {subject}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    print(f"[Kosovo Pipeline] {datetime.now(timezone.utc).isoformat()}")

    seen_urls = load_existing_urls()
    print(f"  {len(seen_urls)} URLs already committed")

    covered = build_covered_set()
    print(f"  {len(covered)} stories covered by local outlets")

    candidates = fetch_candidates(seen_urls)
    print(f"  {len(candidates)} fresh Kosovo candidates")

    results: list[dict] = []
    for c in candidates:
        if len(results) >= MAX_PER_RUN:
            break

        title_en = c["title_en"]
        summary = c["summary"]

        if is_duplicate(title_en, summary, covered):
            print(f"  [DUP]  {title_en[:70]}")
            continue

        scoring = score_article(title_en, summary)
        score = float(scoring.get("score", 0))
        if score < 5:
            print(f"  [LOW {score:.1f}] {title_en[:70]}")
            continue

        print(f"  [OK  {score:.1f}] {title_en[:70]}")

        content = generate_content(title_en, summary)
        image_url = get_image(c["url"], title_en, c.get("raw_image"))

        pub_dt = c["published_at"] or datetime.now(timezone.utc)
        body = content.get("body", summary)
        featured = score >= 9 or bool(scoring.get("breaking"))
        slug_base = slugify(content.get("title", title_en))[:60]

        results.append({
            "id":            str(uuid.uuid4()),
            "slug":          f"{slug_base}-{pub_dt.strftime('%Y-%m-%d')}",
            "url":           c["url"],
            "dispatch":      f"{len(results) + 1:02d}",
            "title":         content.get("title", title_en),
            "excerpt":       content.get("excerpt", summary[:200]),
            "body":          body,
            "source":        c["source"],
            "source_flag":   c["source_flag"],
            "source_bias":   content.get("source_bias", c["source_bias"]),
            "tone":          content.get("tone", "neutral"),
            "category":      scoring.get("category", "Shoqëri"),
            "published_at":  pub_dt.isoformat(),
            "reading_time":  max(1, len(body.split()) // 200),
            "featured":      featured,
            "engagement_score": round(score, 1),
            "image_url":     image_url,
            "created_at":    datetime.now(timezone.utc).isoformat(),
        })

    print(f"  {len(results)} articles ready")

    if results:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
        out = OUTPUT_DIR / f"{ts}.json"
        out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  → {out}")
        send_email(results)
    else:
        print("  Nothing new — no file written, no email sent")


if __name__ == "__main__":
    main()
