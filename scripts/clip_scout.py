#!/usr/bin/env python3
"""383 clip scout: viral Kosovo and Albania clips, found early, ready for the editor to post.

Runs on the VPS every two hours (383-clip-scout.timer). Each run:

1. Looks. TikTok through a local copy of omkarcloud/tiktok-scraper (MIT; no key, it talks to
   tiktok.com itself): the Albanian hashtags (#kosova, #shqiperi, #prishtina...), today's trends
   as hashtags (/opt/data/trends/trends.json, Google Trends Albania and sq.wikipedia spikes), and
   a watchlist of Albanian creators the scout has met before. YouTube: today's uploads for the
   same terms. Free only: TikTok's free-text search is closed to logged-out visitors, X and
   Instagram need a logged-in account (cookies), and no public site publishes X trends for
   Albania or Kosovo.
2. Scores. An outlier is a clip far above what its creator normally gets, spreading fast, and
   shared and saved more than watched: plays per hour, plays against the creator's median (their
   last dozen posts) or their followers, and shares and saves per play. Older than three days it
   is not news. A clip already on three or more accounts has been seen; it is dropped.
3. Packages the best few: downloads the clip (YouTube through yt-dlp and the YouTube cookie;
   TikTok through the scraper's own session, which TikTok serves from a home connection, or
   yt-dlp with a TikTok cookie when there is one), writes a short Albanian headline of what is
   happening (Groq, gpt-oss-120b; the caption itself when the model is down), and renders an
   upright 1080x1920 post: the headline on top, the clip, and the creator's credit tag.
4. Queues them for the editor. Nothing is posted anywhere: the files go to the storage bucket
   clip-scout (clips/<day>/...), with queue.json beside them, and one email lists the run's
   finds with their numbers, why each was picked, and links to the original and the file.

State (what was seen, queued, each creator's usual numbers) lives in /opt/data/clip-scout/state.json.
`python clip_scout.py --dry-run` looks and scores, and prints instead of downloading or sending.
"""
from __future__ import annotations

import json
import math
import os
import re
import smtplib
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import video_edition_media as media  # noqa: E402  (YouTube's results page, shared with the edition)

HOME = Path(os.environ.get("L383_SCOUT_DIR", "/opt/data/clip-scout"))
SCRAPER = HOME / "tiktok-scraper"
STATE = HOME / "state.json"
PORT = int(os.environ.get("L383_SCOUT_PORT", "8765"))
API = f"http://127.0.0.1:{PORT}"
TRENDS = Path(os.environ.get("L383_TRENDS", "/opt/data/trends/trends.json"))
YTDLP = os.environ.get("L383_EDITION_YTDLP", "/opt/data/video-edition/yt-dlp")
YT_COOKIES = os.environ.get("L383_EDITION_YT_COOKIES", "/opt/data/video-edition/youtube-cookies.txt")
TT_COOKIES = HOME / "tiktok-cookies.txt"
FONT = os.environ.get("L383_SCOUT_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
BUCKET = "clip-scout"
GROQ = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("L383_SCOUT_MODEL", "openai/gpt-oss-120b")
HEADERS = {"User-Agent": "383ClipScout/1.0 (https://383ks.com; editorial clip discovery)"}

# Where Albanian TikTok gathers. Each is read two pages deep (TikTok ranks a tag's videos itself).
HASHTAGS = ["kosova", "kosovo", "shqiperi", "albania", "prishtina", "tirana", "shqip", "shqiptar",
            "lajme", "lajmeshqip", "kosovaalbania", "albaniankosovo", "durres", "prizren", "vlora",
            "shqiperia", "kombetarja", "diaspora"]
MAX_AGE_H = 72          # older than three days is not news
MIN_PLAYS = 5_000       # below this, a clip has not taken off yet
BASELINE_LOOKUPS = 25   # creators whose last posts are read per run (their usual numbers)
WATCH_POLLS = 30        # watched creators read per run, in turn
WATCH_MAX = 200
WATCH_MIN_FOLLOWERS = 5_000
SEEN_BY = 3             # a clip on this many accounts has been seen already
PICKS_PER_RUN = 6
KEEP_DAYS = 7

ALBANIAN_WORDS = re.compile(r"(?i)(?<![\wçë])(dhe|është|eshte|për|per|nga|shqip\w*|kosov\w*|prishtin\w*|tiran\w*|"
                            r"shqipëri\w*|shqiperi\w*|durr\w*|prizren\w*|vlor\w*|ferizaj|gjakov\w*|mitrovic\w*|"
                            r"pej[aë]\w*|gjilan\w*|kurti|rama|berisha|osmani|dardan\w*|kuqezi\w*|vëlla|vella|"
                            r"motr\w*|nën[aë]|babai|qytet\w*|lajm\w*|sot|shiko|kjo|ky)(?![\wçë])")


# ── 1. Looking ───────────────────────────────────────────────────────────────

def start_scraper() -> subprocess.Popen | None:
    """The TikTok scraper as a local API for the length of the run."""
    if not (SCRAPER / "run.py").exists():
        print("SCOUT tiktok scraper missing: TikTok skipped", file=sys.stderr)
        return None
    py = HOME / ".venv" / "bin" / "python"
    proc = subprocess.Popen([str(py if py.exists() else sys.executable), "run.py"], cwd=SCRAPER,
                            env={**os.environ, "PORT": str(PORT), "HOST": "127.0.0.1"},
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        try:
            with urllib.request.urlopen(f"{API}/health", timeout=2):
                return proc
        except (urllib.error.URLError, OSError):
            time.sleep(0.5)
    proc.terminate()
    print("SCOUT tiktok scraper did not start: TikTok skipped", file=sys.stderr)
    return None


def tiktok(path: str, **params) -> dict:
    url = f"{API}/{path}?" + urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, "")})
    try:
        with urllib.request.urlopen(url, timeout=90) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            return json.loads(exc.read().decode("utf-8"))
        except ValueError:
            return {"error": f"HTTP {exc.code}"}
    except (urllib.error.URLError, OSError, ValueError) as exc:
        return {"error": str(exc)}


def trend_terms(path: Path = TRENDS) -> list[str]:
    """Today's searches in Albania and spikes on sq.wikipedia (video_trends.py), most searched first."""
    try:
        trends = json.loads(path.read_text(encoding="utf-8")).get("trends") or []
    except (OSError, ValueError, AttributeError):
        return []
    return [str(t.get("term", "")).strip() for t in trends[:12] if str(t.get("term", "")).strip()]


def trend_tags(path: Path = TRENDS) -> list[str]:
    """Today's trends as TikTok hashtags: "Vincent Kompany" -> "vincentkompany"."""
    tags = []
    for term in trend_terms(path):
        tag = re.sub(r"[^\wçë]", "", term.lower())
        if 4 <= len(tag) <= 30 and tag not in tags:
            tags.append(tag)
    return tags


def tiktok_clip(v: dict, found_by: str) -> dict | None:
    """The scraper's video as the scout's candidate."""
    stats, author, astats, video = (v.get(k) or {} for k in ("stats", "author", "author_stats", "video"))
    if not v.get("id") or v.get("is_ad") or v.get("is_private") or v.get("type") not in (None, "video"):
        return None
    return {
        "platform": "tiktok", "id": f"tt:{v['id']}", "vid": str(v["id"]), "link": v.get("link") or "",
        "caption": str(v.get("description") or "")[:600], "language": v.get("language") or "",
        "created": v.get("created_at") or "", "author": author.get("username") or "",
        "author_name": author.get("nickname") or "", "followers": int(astats.get("follower_count") or 0),
        "plays": int(stats.get("play_count") or 0), "likes": int(stats.get("like_count") or 0),
        "comments": int(stats.get("comment_count") or 0), "shares": int(stats.get("share_count") or 0),
        "saves": int(stats.get("save_count") or 0), "duration": int(video.get("duration_seconds") or 0),
        "music": str((v.get("music") or {}).get("id") or ""), "cover": video.get("cover") or v.get("cover") or "",
        "found_by": found_by,
    }


def collect_tiktok(state: dict, tags: list[str]) -> list[dict]:
    out = []
    for tag in tags:
        cursor = None
        for _ in range(2):
            page = tiktok("hashtags/videos", hashtag=tag, cursor=cursor)
            if page.get("error"):
                print(f"SCOUT #{tag}: {page['error'][:120]}", file=sys.stderr)
                break
            out += [c for v in page.get("videos") or [] if (c := tiktok_clip(v, f"#{tag}"))]
            cursor = page.get("next_cursor")
            if not page.get("has_more") or not cursor:
                break
    # The watched creators, a slice each run (the ones not read the longest first).
    watch = state.setdefault("watch", {})
    for name in sorted(watch, key=lambda n: watch[n].get("polled", ""))[:WATCH_POLLS]:
        page = tiktok("users/videos", user=name)
        watch[name]["polled"] = now_iso()
        if page.get("error"):
            continue
        clips = [c for v in page.get("videos") or [] if (c := tiktok_clip(v, f"@{name}"))]
        remember_baseline(state, name, clips)
        out += clips
    return out


def views_of(text: str) -> int:
    """YouTube's "1.2M views" / "35K views" / "1,234 views" as a number."""
    m = re.search(r"([\d.,]+)\s*([KMB])?\s*views", text or "", re.I)
    if not m:
        return 0
    n = float(m.group(1).replace(",", ""))
    return int(n * {"K": 1e3, "M": 1e6, "B": 1e9}.get((m.group(2) or "").upper(), 1))


def collect_youtube(terms: list[str]) -> list[dict]:
    """Today's uploads on YouTube's own results page (filter: today), with their views."""
    now = datetime.now(timezone.utc)
    out = []
    for term in terms:
        url = "https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": term, "sp": "EgIIAg=="})  # filter: today
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en"})
            with urllib.request.urlopen(req, timeout=20) as res:
                html = res.read().decode("utf-8", "replace")
            data = json.loads(re.search(r"var ytInitialData = (\{.*?\});</script>", html).group(1))
        except (urllib.error.URLError, OSError, AttributeError, ValueError):
            continue
        for v in media.walk_videos(data):
            runs = lambda key: ((v.get(key) or {}).get("runs") or [{}])[0].get("text", "")  # noqa: E731
            when = media.posted_on((v.get("publishedTimeText") or {}).get("simpleText", ""), now)
            length = (v.get("lengthText") or {}).get("simpleText", "")
            secs = sum(int(x) * 60 ** i for i, x in enumerate(reversed(length.split(":")))) if re.fullmatch(r"[\d:]+", length) else 0
            if not (v.get("videoId") and when) or not 5 <= secs <= 240:
                continue  # clips, not whole programmes
            out.append({"platform": "youtube", "id": f"yt:{v['videoId']}", "vid": v["videoId"],
                        "link": f"https://www.youtube.com/watch?v={v['videoId']}", "caption": runs("title")[:300],
                        "language": "", "created": when.isoformat(), "author": runs("ownerText")[:80], "author_name": runs("ownerText")[:80],
                        "followers": 0, "plays": views_of((v.get("viewCountText") or {}).get("simpleText", "")),
                        "likes": 0, "comments": 0, "shares": 0, "saves": 0, "duration": secs, "music": "",
                        "cover": f"https://i.ytimg.com/vi/{v['videoId']}/hqdefault.jpg", "found_by": f"youtube: {term}"})
    return out


# ── 2. Scoring ───────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hours_old(clip: dict, now: datetime) -> float:
    try:
        when = datetime.fromisoformat(str(clip.get("created", "")).replace("Z", "+00:00"))
    except ValueError:
        return float("inf")
    return max(0.5, (now - when).total_seconds() / 3600)


def is_albanian(clip: dict) -> bool:
    if clip.get("language") == "sq":
        return True
    text = f"{clip.get('caption', '')} {clip.get('author', '')} {clip.get('author_name', '')}"
    return len(ALBANIAN_WORDS.findall(text)) >= 2 or (("ë" in text or "ç" in text) and len(ALBANIAN_WORDS.findall(text)) >= 1)


def remember_baseline(state: dict, author: str, clips: list[dict]) -> None:
    """A creator's usual plays: the median of their recent posts."""
    plays = [c["plays"] for c in clips if c.get("plays")]
    if len(plays) >= 4:
        state.setdefault("authors", {})[author] = {"median": int(statistics.median(plays)), "at": now_iso()}


def same_clip_key(clip: dict) -> str:
    """Re-uploads of one clip share their words (hashtags and emoji aside) or their sound and length."""
    words = re.sub(r"#\S+|@\S+|[^\wçë ]", " ", clip.get("caption", "").lower())
    words = " ".join(w for w in words.split() if len(w) > 2)[:60]
    if len(words) >= 18:
        return "t:" + words
    if clip.get("music") and clip.get("duration"):
        return f"m:{clip['music']}:{clip['duration']}"
    return "id:" + clip["id"]


def score(clip: dict, state: dict, now: datetime) -> tuple[float, list[str]]:
    """How much of an outlier this clip is, and why, in words for the editor."""
    age = hours_old(clip, now)
    plays = clip.get("plays", 0)
    per_hour = plays / age
    base = (state.get("authors") or {}).get(clip.get("author", ""), {}).get("median")
    if base:
        outlier, against = plays / max(base, 300), f"{plays / max(base, 300):.0f}× zakonisht të @{clip['author']}"
    elif clip.get("followers"):
        outlier, against = plays / max(clip["followers"], 1000), f"{plays / max(clip['followers'], 1000):.1f}× ndjekësit"
    else:
        outlier, against = 1.0, ""
    spread = (2 * clip.get("shares", 0) + clip.get("saves", 0) + clip.get("comments", 0)) / max(plays, 1)
    value = math.log10(1 + per_hour) + 0.9 * math.log2(1 + outlier) + min(spread * 25, 2.0)
    why = [f"{fmt(plays)} shikime në {age:.0f} orë ({fmt(per_hour)}/orë)"]
    if against:
        why.append(against)
    if spread >= 0.03:
        why.append(f"shpërndarje e lartë ({spread * 100:.1f}% ndajnë/ruajnë)")
    return round(value, 3), why


def fmt(n: float) -> str:
    return f"{n / 1e6:.1f}M" if n >= 1e6 else f"{n / 1e3:.0f}K" if n >= 1e3 else f"{n:.0f}"


def rank(pool: list[dict], state: dict, now: datetime) -> list[dict]:
    """Fresh Albanian clips that have taken off, not yet everywhere, best first."""
    owners: dict[str, set[str]] = {}
    for c in pool:
        owners.setdefault(same_clip_key(c), set()).add(c.get("author", ""))
    for key, seen in (state.get("seen_keys") or {}).items():
        owners.setdefault(key, set()).update(seen.get("authors", []))
    best: dict[str, dict] = {}
    for c in pool:
        if c["id"] in (state.get("queued") or {}) or hours_old(c, now) > MAX_AGE_H or c.get("plays", 0) < MIN_PLAYS:
            continue
        if not is_albanian(c) or len(owners.get(same_clip_key(c), ())) >= SEEN_BY:
            continue
        c["score"], c["why"] = score(c, state, now)
        if c["id"] not in best or c["score"] > best[c["id"]]["score"]:
            best[c["id"]] = c
    return sorted(best.values(), key=lambda c: -c["score"])


def remember_seen(state: dict, pool: list[dict], now: datetime) -> None:
    """Which accounts carried each clip, for three days: a clip that spreads to more is "seen"."""
    keys = state.setdefault("seen_keys", {})
    for c in pool:
        entry = keys.setdefault(same_clip_key(c), {"authors": [], "at": now_iso()})
        if c.get("author") and c["author"] not in entry["authors"]:
            entry["authors"] = (entry["authors"] + [c["author"]])[-10:]
    cutoff = (now - timedelta(days=3)).isoformat()
    state["seen_keys"] = {k: v for k, v in keys.items() if v.get("at", "") >= cutoff}


def grow_watchlist(state: dict, pool: list[dict]) -> None:
    """Albanian creators with an audience join the watchlist; the least recently useful leave."""
    watch = state.setdefault("watch", {})
    for c in pool:
        if c["platform"] == "tiktok" and c.get("author") and c.get("followers", 0) >= WATCH_MIN_FOLLOWERS and is_albanian(c):
            watch.setdefault(c["author"], {"polled": ""})["hit"] = now_iso()
    if len(watch) > WATCH_MAX:
        keep = sorted(watch, key=lambda n: watch[n].get("hit", ""), reverse=True)[:WATCH_MAX]
        state["watch"] = {n: watch[n] for n in keep}


# ── 3. Packaging ─────────────────────────────────────────────────────────────

def describe(clip: dict) -> dict:
    """An Albanian headline of what is happening, from what the post itself says."""
    key = os.environ.get("GROQ_API_KEY", "")
    fallback = {"headline": clean_caption(clip.get("caption", ""))[:110] or "Video virale nga rrjetet sociale", "how": "caption"}
    if not key:
        return fallback
    prompt = (
        "You write for 383, an Albanian news site, the line shown on top of a viral clip it reposts. From the post "
        "below, write in Albanian (standard, as Kosovo and Albania read it):\n"
        "- headline: what is happening in the clip, 6 to 14 words, concrete, no clickbait, no emoji, nothing the post "
        "does not say (no names, places or numbers it does not give).\n"
        "- caption: one or two sentences for the post text, same rules.\n"
        "Reply with only JSON: {\"headline\": \"...\", \"caption\": \"...\"}\n\n"
        f"Platform: {clip['platform']}\nCreator: @{clip.get('author', '')} ({clip.get('author_name', '')})\n"
        f"Post text: {clip.get('caption', '')}\n"
    )
    got = None
    # Each Groq model has its own free quota (and Pyet and the newsroom share the first): a model
    # that is out after one wait hands over to the next.
    tries = [GROQ_MODEL, GROQ_MODEL, "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
    for attempt, model in enumerate(tries):
        body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3,
                           "response_format": {"type": "json_object"}}).encode()
        req = urllib.request.Request(GROQ, data=body, method="POST",
                                     headers={**HEADERS, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                got = json.loads(json.loads(res.read().decode("utf-8"))["choices"][0]["message"]["content"])
            break
        except urllib.error.HTTPError as exc:
            # The free tier allows a few calls a minute: the first model once more after the wait it
            # asks for, then the others straight away.
            if exc.code == 429 and attempt < len(tries) - 1:
                if attempt == 0:
                    time.sleep(min(30.0, float(exc.headers.get("retry-after") or 12)))
                continue
            print(f"SCOUT headline model failed (HTTP {exc.code}): caption used", file=sys.stderr)
            return fallback
        except (urllib.error.URLError, OSError, ValueError, KeyError, IndexError, TypeError) as exc:
            print(f"SCOUT headline model failed ({exc!r}): caption used", file=sys.stderr)
            return fallback
    if not isinstance(got, dict):
        return fallback
    headline = re.sub(r"\s+", " ", str(got.get("headline") or "")).strip()
    if not 3 <= len(headline.split()) <= 18:
        return fallback
    return {"headline": headline[:120], "caption": re.sub(r"\s+", " ", str(got.get("caption") or "")).strip()[:400], "how": "model"}


def clean_caption(text: str) -> str:
    text = re.sub(r"#\S+|@\S+|https?://\S+", " ", text or "")
    text = re.sub(r"[^\w\s.,!?:;'\"()çëÇË€%-]", " ", text)
    return re.sub(r"\s+", " ", text).strip(" .,-")


def download(clip: dict, out: Path) -> bool:
    """The original file: YouTube through yt-dlp and its cookie; TikTok through the scraper's own session
    (TikTok serves its files to a home connection), else yt-dlp with a TikTok cookie."""
    if clip["platform"] == "tiktok":
        if tiktok_session_download(clip["vid"], out):
            return True
        cookies = ["--cookies", str(TT_COOKIES)] if TT_COOKIES.exists() else []
        return ytdlp(clip["link"], out, cookies)
    cookies = ["--cookies", YT_COOKIES] if os.path.exists(YT_COOKIES) else []
    return ytdlp(clip["link"], out, cookies + ["-f", "bv*[height<=1920][vcodec^=avc1]+ba/b[height<=1920]/b"])


def ytdlp(url: str, out: Path, extra: list[str]) -> bool:
    if not os.path.exists(YTDLP):
        return False
    done = subprocess.run([YTDLP, "-q", "--no-warnings", "--no-playlist", "--js-runtimes", "node", "--merge-output-format", "mp4",
                           *extra, "-o", str(out), url], capture_output=True, text=True, timeout=600, check=False)
    if done.returncode != 0:
        print(f"SCOUT yt-dlp {url}: {(done.stderr or '').strip()[-200:]}", file=sys.stderr)
    return out.exists() and out.stat().st_size > 100_000


def tiktok_session_download(vid: str, out: Path) -> bool:
    """Through the scraper's own impersonated session: the one that read the video holds the cookies
    its file links expect."""
    code = (
        "import sys\n"
        f"sys.path.insert(0, {str(SCRAPER)!r})\n"
        "from tiktok import fetch, videos\n"
        f"media = videos.get_media({{'id': {vid!r}}})\n"
        "client = fetch._acquire(None)\n"
        "url = (media.get('video') or {}).get('play_link')\n"
        "resp = client.session.get(url, headers={'referer': 'https://www.tiktok.com/'}, timeout=120) if url else None\n"
        "ok = bool(resp is not None and resp.status_code == 200 and resp.headers.get('content-type', '').startswith('video'))\n"
        f"open({str(out)!r}, 'wb').write(resp.content) if ok else None\n"
        "sys.exit(0 if ok else 1)\n"
    )
    py = HOME / ".venv" / "bin" / "python"
    try:
        done = subprocess.run([str(py if py.exists() else sys.executable), "-c", code], capture_output=True, timeout=240, check=False)
    except subprocess.TimeoutExpired:
        return False
    return done.returncode == 0 and out.exists() and out.stat().st_size > 100_000


def wrap(text: str, width: int) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        if line and len(line) + 1 + len(word) > width:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}".strip()
    return lines + ([line] if line else [])


def render(raw: Path, clip: dict, headline: str, out: Path, work: Path) -> bool:
    """1080x1920: the headline on a white band on top, the clip below it (a wide one over a blurred
    copy of itself), the creator's credit tag on the clip, 383ks.com in the band."""
    lines = wrap(headline, 26)[:4]
    band = 120 + 78 * len(lines) + 50
    # One file per line: drawtext draws a line break inside a text file as a missing-glyph box.
    for n, line in enumerate(lines):
        (work / f"line{n}.txt").write_text(line, encoding="utf-8")
    platform = {"tiktok": "TikTok", "youtube": "YouTube"}.get(clip["platform"], clip["platform"])
    (work / "credit.txt").write_text(f"Video: @{clip.get('author', '')} · {platform}", encoding="utf-8")
    (work / "brand.txt").write_text("383ks.com", encoding="utf-8")
    font = FONT.replace(":", "\\:")
    area = 1920 - band
    graph = (
        f"[0:v]scale=1080:{area}:force_original_aspect_ratio=increase,crop=1080:{area},boxblur=24,eq=brightness=-0.25[bg];"
        f"[0:v]scale=1080:{area}:force_original_aspect_ratio=decrease[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2[clip];"
        f"color=c=white:s=1080x{band}:d=1[top];"
        f"[top][clip]vstack=inputs=2,"
        f"drawtext=fontfile='{font}':textfile=brand.txt:fontsize=34:fontcolor=0xFF4422:x=64:y=56,"
        + "".join(f"drawtext=fontfile='{font}':textfile=line{n}.txt:fontsize=62:fontcolor=0x111111:x=64:y={120 + 78 * n},"
                  for n in range(len(lines))) +
        f"drawtext=fontfile='{font}':textfile=credit.txt:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.62:"
        f"boxborderw=18:x=64:y=H-150,fps=30,format=yuv420p[v]"
    )
    done = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-filter_complex", graph, "-map", "[v]", "-map", "0:a?",
                           "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "4M", "-bufsize", "8M",
                           "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-t", "180", str(out)],
                          capture_output=True, text=True, timeout=900, check=False, cwd=work)  # the text files by name
    if done.returncode != 0:
        print(f"SCOUT render {clip['id']}: {done.stderr.strip()[-300:]}", file=sys.stderr)
    return done.returncode == 0 and out.exists() and out.stat().st_size > 50_000


def thumb(video: Path, out: Path) -> bool:
    done = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.5", "-i", str(video), "-frames:v", "1", "-vf", "scale=360:-2", str(out)],
                          capture_output=True, timeout=120, check=False)
    return done.returncode == 0 and out.exists()


# ── 4. The queue ─────────────────────────────────────────────────────────────

def storage(method: str, path: str, body: bytes | None = None, headers: dict | None = None) -> tuple[int, bytes]:
    base = os.environ.get("L383_EDITION_STORAGE", "").rstrip("/") or os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(f"{base}/storage/v1/{path}", data=body, method=method,
                                 headers={**HEADERS, "Authorization": f"Bearer {key}", "apikey": key, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=300) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()
    except (urllib.error.URLError, OSError) as exc:
        return 0, str(exc).encode()


def ensure_bucket() -> None:
    conf = {"public": True, "allowed_mime_types": ["application/json", "image/jpeg", "video/mp4"]}
    if storage("GET", f"bucket/{BUCKET}")[0] != 200:
        storage("POST", "bucket", json.dumps({"id": BUCKET, "name": BUCKET, **conf}).encode(), {"Content-Type": "application/json"})


def upload(path: str, body: bytes, kind: str) -> bool:
    status, reply = storage("POST", f"object/{BUCKET}/{path}", body, {"Content-Type": kind, "x-upsert": "true", "cache-control": "300"})
    if status not in (200, 201):
        print(f"SCOUT upload {path} failed: HTTP {status} {reply[:160]!r}", file=sys.stderr)
    return status in (200, 201)


def public_url(path: str) -> str:
    return f"{os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')}/storage/v1/object/public/{BUCKET}/{path}"


def package(clip: dict, day: str) -> dict:
    """Download, describe, render and upload one find; what could not be done is said in the entry."""
    words = describe(clip)
    entry = {k: clip.get(k) for k in ("id", "platform", "link", "author", "author_name", "caption", "created", "plays",
                                      "likes", "shares", "saves", "comments", "followers", "duration", "found_by", "score", "why")}
    entry.update(headline=words["headline"], post_text=words.get("caption", ""), written_by=words["how"], found_at=now_iso(),
                 file="", thumb="", status="needs download")
    with tempfile.TemporaryDirectory(prefix="383-scout-") as tmp:
        work = Path(tmp)
        raw, final, cover = work / "raw.mp4", work / "post.mp4", work / "thumb.jpg"
        if not download(clip, raw):
            return entry
        if not render(raw, clip, words["headline"], final, work):
            final = raw
        stem = f"clips/{day}/{re.sub(r'[^a-z0-9]+', '-', clip['id'].lower())}"
        if upload(f"{stem}.mp4", final.read_bytes(), "video/mp4"):
            entry.update(file=public_url(f"{stem}.mp4"), status="ready" if final != raw else "ready (no text)")
        if thumb(final, cover) and upload(f"{stem}.jpg", cover.read_bytes(), "image/jpeg"):
            entry["thumb"] = public_url(f"{stem}.jpg")
    return entry


def publish_queue(state: dict, now: datetime) -> None:
    cutoff = (now - timedelta(days=KEEP_DAYS)).isoformat()
    state["queued"] = {k: v for k, v in (state.get("queued") or {}).items() if v.get("found_at", "") >= cutoff}
    items = sorted(state["queued"].values(), key=lambda e: e.get("found_at", ""), reverse=True)
    upload("queue.json", json.dumps({"updatedAt": now_iso(), "items": items}, ensure_ascii=False).encode(), "application/json")


def email(found: list[dict]) -> None:
    """One email per run that found something: each clip, its numbers, why, and its links."""
    to = os.environ.get("L383_SCOUT_REPORT_TO") or os.environ.get("L383_EDITION_REPORT_TO", "")
    # Operator mail goes through the newsroom's Gmail (SMTP with an app password), as its other reports do.
    user, password = os.environ.get("GMAIL_USER", "").strip(), os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    if not (found and to and user and password):
        if found:
            print("SCOUT email skipped: no report address or Gmail credentials", file=sys.stderr)
        return
    esc = lambda s: str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")  # noqa: E731
    rows = []
    for e in found:
        img = f'<img src="{esc(e["thumb"])}" width="120" style="border-radius:8px;display:block">' if e.get("thumb") else ""
        file = f'<a href="{esc(e["file"])}">Shkarko videon</a> · ' if e.get("file") else f"<b>{esc(e['status'])}</b> · "
        rows.append(f'<tr><td style="padding:12px 12px 12px 0;vertical-align:top">{img}</td><td style="padding:12px 0;vertical-align:top;font-family:Arial,sans-serif">'
                    f'<div style="font-size:17px;font-weight:700">{esc(e["headline"])}</div>'
                    f'<div style="color:#555;font-size:13px;margin:4px 0">{esc(" · ".join(e.get("why") or []))}</div>'
                    f'<div style="font-size:13px">{file}<a href="{esc(e["link"])}">Origjinali (@{esc(e["author"])}, {esc(e["platform"])})</a></div>'
                    f'<div style="color:#888;font-size:12px;margin-top:4px">{esc(e.get("post_text") or "")}</div></td></tr>')
    body = f'<div style="font-family:Arial,sans-serif"><h2>{len(found)} klipe të reja për rishikim</h2><table>{"".join(rows)}</table></div>'
    msg = EmailMessage()
    msg["From"], msg["To"] = f"383 Klipe <{user}>", to
    msg["Subject"] = f"383 klipe: {found[0]['headline'][:60]}"
    msg.set_content(f"{len(found)} klipe të reja për rishikim.")
    msg.add_alternative(body, subtype="html")
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
        print("SCOUT email sent")
    except (smtplib.SMTPException, OSError) as exc:
        print(f"SCOUT email failed: {exc}", file=sys.stderr)


# ── The run ──────────────────────────────────────────────────────────────────

def load_state() -> dict:
    try:
        data = json.loads(STATE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    tmp.replace(STATE)


def main(dry_run: bool = False) -> int:
    now = datetime.now(timezone.utc)
    state = load_state()
    tags = list(dict.fromkeys(HASHTAGS + trend_tags()))
    proc = start_scraper()
    try:
        pool = collect_tiktok(state, tags) if proc else []
        ranked = rank(pool, state, now)
        # The creators behind the best ones: their usual numbers make the outlier score honest.
        for c in [c for c in ranked if c["platform"] == "tiktok" and c["author"] not in (state.get("authors") or {})][:BASELINE_LOOKUPS]:
            page = tiktok("users/videos", user=c["author"])
            if not page.get("error"):
                remember_baseline(state, c["author"], [x for v in page.get("videos") or [] if (x := tiktok_clip(v, ""))])
        pool += collect_youtube(["kosova", "shqiperi", "prishtina", "tirana"] + trend_terms()[:4])
        ranked = rank(pool, state, now)
        print(f"SCOUT {len(pool)} clips looked at ({sum(c['platform'] == 'tiktok' for c in pool)} TikTok), "
              f"{len(ranked)} fresh Albanian outliers, watching {len(state.get('watch') or {})} creators")
        picks = ranked[:PICKS_PER_RUN]
        if dry_run:
            for c in picks:
                print(f"  {c['score']:.2f} {c['link']}  {' · '.join(c['why'])}\n       {clean_caption(c['caption'])[:120]}")
            return 0
        ensure_bucket()
        day = now.strftime("%Y-%m-%d")
        found = []
        for c in picks:
            entry = package(c, day)
            state.setdefault("queued", {})[c["id"]] = entry
            found.append(entry)
            print(f"SCOUT {entry['status']}: {entry['headline']} ({c['link']}; {' · '.join(c['why'])})")
        remember_seen(state, pool, now)
        grow_watchlist(state, pool)
        publish_queue(state, now)
        email(found)
    finally:
        if proc:
            proc.terminate()
        save_state(state)
    return 0


if __name__ == "__main__":
    sys.exit(main(dry_run="--dry-run" in sys.argv[1:]))
