#!/usr/bin/env python3
"""383 clip scout: viral Kosovo and Albania clips, found early, ready for the editor to post.

Runs on the VPS every two hours (383-clip-scout.timer). Each run:

1. Looks, free sources only. X first, through twscrape and a spare account's cookies
   (x-cookies.txt). X has no trends for Albania or Kosovo, so the scout counts them itself: a few
   hundred of today's Albanian tweets, the hashtags and names the most people post about against
   what they usually do; X's own list (x.com/explore read in headless Chromium, x_trends.mjs, as
   Agent-Reach does) joins where it touches Albanians. Then the Top video posts of Albanian X and
   of the last run's trends and topics. TikTok through a local copy of omkarcloud/tiktok-scraper
   (MIT; no key, it talks to tiktok.com itself): the Albanian hashtags (#kosova, #shqiperi...),
   the X trends and today's searches (/opt/data/trends/trends.json) as hashtags, and a watchlist
   of Albanian creators the scout has met before. YouTube: today's uploads for the same terms.
   Instagram through instaloader and a spare account (ig-cookies.txt): the hashtags' top posts
   and a watchlist of its own, slowly (a long wait asked for ends Instagram for the run). X and
   Instagram run in child processes cut off after seven minutes. Each source's result is a line
   at the top of the email, so a cookie that expired is said, not silent.
2. Scores. An outlier is a clip far above what its creator normally gets, spreading fast, and
   shared and saved more than watched: plays per hour, plays against the creator's median (their
   last dozen posts) or their followers, and shares and saves per play. Older than three days it
   is not news. A clip already on three or more accounts has been seen; it is dropped.
3. Vets the best thirty with the model as an editor would (news, events, public figures stay; ads,
   shops, giveaways and filler go) and names each one's story. Packages the best few that clear a
   minimum score: at most three from one platform, one from an account, two of a story (none of a
   story queued four times that day). Downloads the clip (yt-dlp with the
   platform's cookie; TikTok without one through the scraper's own session), writes a short Albanian headline of what is
   happening (Groq, gpt-oss-120b; the caption itself when the model is down), and renders an
   upright 1080x1920 post: the headline on top, the clip, and the creator's credit tag.
4. Queues them for the editor: the files go to the storage bucket clip-scout (clips/<day>/...),
   with queue.json beside them, and one email lists the run's finds with their numbers, why each
   was picked, and links to the original and the file.
5. Puts the day's best on 383's own site, "Virale sot" after the video edition's stories: only
   finds the model passed for the site by itself (news, events, public figures; nothing that may
   be staged, AI-made or a claim the post cannot prove), rendered with their headline and credit
   (published.json; the site shows four). Each is in the email with a "Hiq nga faqja" link,
   signed for it alone, that takes it down at once (the site's /api/virale/hiq writes
   removed.json, which every run respects). Nothing is ever posted to social media.

State (what was seen, queued, each creator's usual numbers) lives in /opt/data/clip-scout/state.json.
`python clip_scout.py --dry-run` looks and scores, and prints instead of downloading or sending.
"""
from __future__ import annotations

import hashlib
import hmac
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
# A spare account's cookies (cookies.txt, as a browser extension exports them) for each; never a real one.
X_COOKIES = HOME / "x-cookies.txt"
IG_COOKIES = HOME / "ig-cookies.txt"
X_DB = HOME / "x-accounts.db"   # twscrape's account pool
FONT = os.environ.get("L383_SCOUT_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
BUCKET = "clip-scout"
GROQ = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("L383_SCOUT_MODEL", "openai/gpt-oss-120b")
HEADERS = {"User-Agent": "383ClipScout/1.0 (https://383ks.com; editorial clip discovery)"}

# Where Albanian TikTok gathers. Each is read two pages deep (TikTok ranks a tag's videos itself).
HASHTAGS = ["kosova", "kosovo", "shqiperi", "albania", "prishtina", "tirana", "shqip", "shqiptar",
            "lajme", "lajmeshqip", "kosovaalbania", "albaniankosovo", "durres", "prizren", "vlora",
            "shqiperia", "kombetarja", "diaspora",
            # Showbiz and reality TV: Big Brother VIP Kosova and the Albanian stars ("Virale sot" cuts).
            "bigbrothervipkosova", "bbvk", "bbvipkosova", "bigbrotherkosova", "showbizshqip", "dualipa", "ritaora", "beberexha"]
# The Albanian stars' own Instagram: each is read in turn (one a run), their posts are news to
# Albanian showbiz whatever language they are in, and a photo post can be cut too.
CELEBS_IG = ["dualipa", "ritaora", "beberexha", "eraistrefi", "avamax"]
CELEB_PHOTO_MAX_H = 30  # a star's photo post older than this has had its day
RAW = HOME / "raw"      # the originals, kept two days for the cuts (viral_cut.py)
RAW_KEEP_H = 48
CUTS_MAX = 8            # "Virale sot" cuts on the site at once
CUTS_PER_RUN = 4        # new or changed cuts rendered a run (a few minutes each on the VPS)
CUT_SOURCES = 4         # clips of one story in one cut
CUT_DEADLINE = 1750     # seconds into the run after which no cut is started (the runner stops at 2400; a cut takes a few minutes)
KINDS = {"lajme", "sport", "showbiz", "bbk", "humor"}
MAX_AGE_H = 72          # older than three days is not news
MIN_PLAYS = 5_000       # below this, a clip has not taken off yet
BASELINE_LOOKUPS = 25   # creators whose last posts are read per run (their usual numbers)
WATCH_POLLS = 30        # watched creators read per run, in turn
WATCH_MAX = 200
WATCH_MIN_FOLLOWERS = 5_000
SEEN_BY = 3             # a clip on this many accounts has been seen already
PICKS_PER_RUN = 6
PER_PLATFORM = 3        # X counts views generously; no one platform takes the whole run
PER_AUTHOR = 1          # one account does not fill the run (Tirana_Report took all of X once)
PER_STORY = 2           # nor one story: two clips of it a run...
STORY_PER_DAY = 4       # ...and no more once it has been queued this often in a day
# Below this a find is not worth the editor's time. X scores lower for the same reach: a big
# account's views are measured against its followers, so even 1.6M views is "1.8×".
MIN_SCORE = {"x": 6.0}
MIN_SCORE_OTHERS = 7.0
VET_TOP = 40            # the best this many are checked by the model for news value; only they are picked
KEEP_DAYS = 7
SITE = "https://383ks.com"
SITE_KEEP = 8           # finds in published.json; the site shows four, the rest fill in for any taken down
COLLECT_TIMEOUT = 420   # X and Instagram each run in a child process cut off after this
X_PER_QUERY = 40
# Albanian tweets read for what Albanian X talks about. X lets an account about 50 searches (20
# tweets each) a quarter of an hour: these eight and two each for the video queries stay under it.
X_TALK = (("Latest", 100), ("Top", 60))
X_TERMS = 6             # trends and topics searched for video on X a run (two of the eight went to BBK and the stars)
X_TRENDS_JS = Path(__file__).resolve().parent / "x_trends.mjs"
# Capitalised words that start a sentence or are always there: not a trend.
NOT_TRENDS = {"sot", "ky", "kjo", "këto", "keto", "këta", "keta", "ai", "ajo", "ata", "ato", "unë", "une", "ne", "ju", "në", "ne",
              "për", "per", "dhe", "por", "nuk", "po", "jo", "si", "kur", "çfarë", "cfare", "pse", "kush", "ku", "edhe", "me",
              "nga", "pas", "para", "mirë", "faleminderit", "lajm", "lajme", "video", "rt", "breaking", "the", "this",
              "kosova", "kosovo", "kosovës", "shqipëria", "shqipëri", "shqiperia", "shqiperi", "shqipërisë", "albania",
              "shqip", "shqiptar", "shqiptarët", "shqiptaret", "tirana", "tiranë", "prishtina", "prishtinë", "zoti", "allah",
              "një", "nje", "çdo", "cdo", "është", "eshte", "qeveria", "kryeministri", "kryeministrit", "ka", "kanë", "jam",
              "jemi", "janë", "jane", "ishte", "duhet", "mund", "tani", "vetëm", "vetem", "shumë", "shume", "kështu",
              "atëherë", "pra", "nëse", "nese", "sepse", "apo", "ose", "deri", "mbi", "pa", "te", "tek", "ti", "im", "yt",
              "kundër", "kunder", "pse", "sipas", "rreth", "lajmi", "fundit", "urgjent", "zyrtare", "live"}
NOT_STEMS: set[str] = set()   # NOT_TRENDS by stem, filled once stem() is defined below
# What Albanian X posts with video. min_faves keeps the timeline's noise out; X's own Top tab ranks.
# Not lang:sq: X finds nothing for it (it does not detect Albanian); words only Albanian uses do.
ALBANIAN_X = "(është OR eshte OR shqiptarët OR qeveria OR kryeministri OR shqipëri OR kosovë)"
X_QUERIES = [f"{ALBANIAN_X} filter:native_video min_faves:100",
             "(kosova OR kosovo OR prishtina OR prishtinë) filter:native_video min_faves:100",
             "(shqipëri OR shqiperi OR tirana OR tiranë) filter:native_video min_faves:100",
             '("big brother" OR bbvk OR #bbvk OR bigbrothervipkosova) filter:native_video min_faves:50',
             '("dua lipa" OR "rita ora" OR "bebe rexha" OR "era istrefi") filter:native_video min_faves:300']
IG_HASHTAGS = ["kosova", "shqiperi", "prishtina", "tirana", "albania", "bigbrothervipkosova"]
IG_PER_TAG = 30
IG_WATCH_POLLS = 4      # with the five hashtags, nine requests a run: Instagram stops a pushier scraper
IG_WATCH_MIN_PLAYS = 50_000

ALBANIAN_WORDS = re.compile(r"(?i)(?<![\wçë])(dhe|është|eshte|për|per|nga|shqip\w*|kosov\w*|prishtin\w*|tiran\w*|"
                            r"shqipëri\w*|shqiperi\w*|durr\w*|prizren\w*|vlor\w*|ferizaj|gjakov\w*|mitrovic\w*|"
                            r"pej[aë]\w*|gjilan\w*|kurti|rama|berisha|osmani|dardan\w*|kuqezi\w*|vëlla|vella|"
                            r"motr\w*|nën[aë]|babai|qytet\w*|lajm\w*|sot|shiko|kjo|ky)(?![\wçë])")

ABOUT_PLACE = re.compile(r"(?i)\b(albania|albanian|albanians|kosovo|kosova|tirana|pristina|prishtina|durr[eë]s|prizren)\b")


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


def as_tags(terms: list[str]) -> list[str]:
    """Trends as TikTok hashtags: "Vincent Kompany" -> "vincentkompany", "#Kurti" -> "kurti"."""
    tags = []
    for term in terms:
        tag = re.sub(r"[^\wçë]", "", term.lower())
        if 4 <= len(tag) <= 30 and tag not in tags:
            tags.append(tag)
    return tags


def trend_tags(path: Path = TRENDS) -> list[str]:
    return as_tags(trend_terms(path))


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


def read_cookies(path: Path) -> dict[str, str]:
    """A cookies.txt (Netscape format, as browser extensions export it) as name -> value."""
    out = {}
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return out
    for line in lines:
        line = line[len("#HttpOnly_"):] if line.startswith("#HttpOnly_") else line
        parts = line.split("\t")
        if len(parts) >= 7 and not line.startswith("#"):
            out[parts[5]] = parts[6].strip()
    return out


def run_collector(name: str, payload: dict) -> dict:
    """X or Instagram in a child process (this file, --collect <name>), so a scraper that hangs or
    is told to wait costs the run a few minutes, not the whole of it."""
    py = HOME / ".venv" / "bin" / "python"
    try:
        done = subprocess.run([str(py if py.exists() else sys.executable), str(Path(__file__).resolve()), "--collect", name],
                              input=json.dumps(payload), capture_output=True, text=True, timeout=COLLECT_TIMEOUT, check=False)
    except subprocess.TimeoutExpired:
        return {"error": f"cut off after {COLLECT_TIMEOUT // 60} min"}
    sys.stderr.write(done.stderr[-2000:])
    try:
        got = json.loads((done.stdout.strip().splitlines() or [""])[-1])
        return got if isinstance(got, dict) else {"error": "bad output"}
    except ValueError:
        return {"error": ((done.stderr or "").strip().splitlines() or ["no output"])[-1][:200]}


def collect_child(name: str) -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    try:
        if name == "x":
            import asyncio
            got = asyncio.run(x_collect(payload.get("terms") or []))
        else:
            got = ig_collect(payload.get("watch") or [])
    except Exception as exc:  # noqa: BLE001  (whatever broke is the health line the editor reads)
        got = {"error": f"{type(exc).__name__}: {exc}"[:200]}
    print(json.dumps(got, ensure_ascii=False))
    return 0


def x_clip(tw, found_by: str) -> dict | None:
    """A twscrape tweet with a video as the scout's candidate (a repost counts as its original)."""
    tw = getattr(tw, "retweetedTweet", None) or tw
    videos = getattr(getattr(tw, "media", None), "videos", None) or []
    user = getattr(tw, "user", None)
    if not videos or user is None or not getattr(tw, "id", None):
        return None
    name = str(getattr(user, "username", "") or "")
    when = getattr(tw, "date", None)
    dur = float(getattr(videos[0], "duration", 0) or 0)
    num = lambda key: int(getattr(tw, key, 0) or 0)  # noqa: E731
    return {
        "platform": "x", "id": f"x:{tw.id}", "vid": str(tw.id), "link": f"https://x.com/{name}/status/{tw.id}",
        "caption": str(getattr(tw, "rawContent", "") or "")[:600], "language": str(getattr(tw, "lang", "") or ""),
        "created": when.isoformat() if hasattr(when, "isoformat") else str(when or ""), "author": name,
        "author_name": str(getattr(user, "displayname", "") or ""), "followers": int(getattr(user, "followersCount", 0) or 0),
        "plays": num("viewCount") or int(getattr(videos[0], "views", 0) or 0), "likes": num("likeCount"),
        "comments": num("replyCount"), "shares": num("retweetCount") + num("quoteCount"), "saves": num("bookmarkedCount"),
        "duration": int(dur / 1000 if dur > 1000 else dur), "music": "",
        "cover": str(getattr(videos[0], "thumbnailUrl", "") or ""), "found_by": found_by,
    }


async def x_collect(terms: list[str]) -> dict:
    """X through twscrape and the spare account: what Albanian X is saying today (its tweets, for
    the trends the scout counts itself), then the Top video posts for Albanian X and for each of
    the terms (the last run's trends and topics)."""
    from twscrape import API  # the scout's venv; when it is missing the health line says so
    cookies = read_cookies(X_COOKIES)
    if not (cookies.get("auth_token") and cookies.get("ct0")):
        return {"error": "no X cookie (x-cookies.txt has no auth_token/ct0)"}
    try:
        api = API(str(X_DB), raise_when_no_account=True)  # fail fast instead of waiting out a rate limit
    except TypeError:
        api = API(str(X_DB))
    await api.pool.add_account_cookies("scout", "; ".join(f"{k}={v}" for k, v in cookies.items()))
    day = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%d")
    talk, failed, limited = [], 0, 0
    for product, limit in X_TALK:
        try:
            async for tw in api.search(f"{ALBANIAN_X} -filter:replies since:{day}", limit=limit, kv={"product": product}):
                name = str(getattr(getattr(tw, "user", None), "username", "") or "")
                if name and len(ALBANIAN_WORDS.findall(getattr(tw, "rawContent", "") or "")) >= 2:
                    talk.append({"author": name, "text": str(tw.rawContent)[:400]})
        except Exception as exc:  # noqa: BLE001
            failed += 1
            limited += type(exc).__name__ == "NoAccountError"
            print(f"SCOUT X talk ({product}): {exc!r}"[:240], file=sys.stderr)
    since = (datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_H)).strftime("%Y-%m-%d")
    quoted = [f'"{t}"' if " " in t else t for t in list(dict.fromkeys(terms))[:X_TERMS]]
    queries = X_QUERIES + [f"{t} filter:native_video min_faves:50" for t in quoted]
    clips = []
    for q in queries:
        try:
            async for tw in api.search(f"{q} since:{since}", limit=X_PER_QUERY, kv={"product": "Top"}):
                if c := x_clip(tw, "X: " + q.split(" filter:")[0]):
                    clips.append(c)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            limited += type(exc).__name__ == "NoAccountError"
            print(f"SCOUT X search {q[:60]}: {exc!r}"[:240], file=sys.stderr)
    if failed == len(queries) + len(X_TALK):
        if limited == failed:  # twscrape has the account resting until X's quarter-hour limit resets
            return {"error": "X rate limit: the spare account's searches were used up; it is back in 15 minutes"}
        return {"error": "every X search failed (cookie expired? re-export x.com_cookies.txt)"}
    return {"clips": clips, "talk": talk}


def x_browser_trends() -> list[dict]:
    """X's own trends list, read off x.com/explore in headless Chromium (x_trends.mjs), as
    Agent-Reach's OpenCLI does. X has no trends for Albania or Kosovo (its 467 places leave
    them out), so this is the account's location's list; the scout keeps what touches Albanians."""
    if not X_TRENDS_JS.exists():
        return []
    try:
        done = subprocess.run(["node", str(X_TRENDS_JS), str(X_COOKIES), "20"], capture_output=True, text=True, timeout=150, check=False)
        got = json.loads((done.stdout.strip().splitlines() or ["{}"])[-1])
    except (subprocess.TimeoutExpired, OSError, ValueError) as exc:
        print(f"SCOUT X browser trends: {exc!r}"[:200], file=sys.stderr)
        return []
    if got.get("error"):
        print(f"SCOUT X browser trends: {got['error']}", file=sys.stderr)
    return [t for t in got.get("trends") or [] if isinstance(t, dict) and t.get("topic")]


def x_trending(talk: list[dict], browser: list[dict], state: dict) -> list[str]:
    """Albanian X's trends, counted: the hashtags and names the most people posted about today,
    the more so against what they usually post about (the earlier runs). X's own list joins in
    where it touches Albanians: about the place, written in Albanian, or what they also talk about."""
    authors: dict[str, set[str]] = {}
    forms: dict[str, dict[str, int]] = {}
    for t in talk:
        text = re.sub(r"https?://\S+|@\w+", " ", t.get("text", ""))
        terms = {"#" + h for h in re.findall(r"#(\w{3,30})", text)}
        # Every name and pair of names in a run of capitals: "Kundër Edi Ramës" holds "Edi Ramës".
        for run in re.findall(r"(?<![\w#])[A-ZÇË][a-zçë]{2,}(?:\s+[A-ZÇË][a-zçë]{2,})*", text):
            words = run.split()
            terms |= set(words) | {f"{a} {b}" for a, b in zip(words, words[1:])}
        for term in terms:
            key = term_key(term)
            if any(w in NOT_STEMS for w in key.split()) or term.lstrip("#").lower() in NOT_TRENDS:
                continue  # also #Albania, #Kosova: always there
            authors.setdefault(key, set()).add(t.get("author", ""))
            forms.setdefault(key, {})[term] = forms.get(key, {}).get(term, 0) + 1
    usual = state.setdefault("x_terms", {})
    scored = []
    for key, who in authors.items():
        n, before = len(who), float(usual.get(key, 0))
        if n >= 3:
            scored.append((n * n / (n + before), key))
    # What each term usually gets: an average that forgets, so a word that is always there is not a trend.
    for key in set(usual) | set(authors):
        usual[key] = round(0.7 * float(usual.get(key, 0)) + 0.3 * len(authors.get(key, ())), 2)
    state["x_terms"] = {k: v for k, v in sorted(usual.items(), key=lambda kv: -kv[1])[:400] if v >= 0.3}
    ranked_keys = [key for _, key in sorted(scored, key=lambda s: (-s[0], -len(s[1].split())))][:16]
    # "Rama" says less than "Edi Rama" beside it; "Edi Ramës" is "Edi Rama" (the same stems).
    keys = [key for key in ranked_keys if not any(key != k and key in k.split() for k in ranked_keys)]
    out = [max(forms[k], key=forms[k].get) for k in keys[:12]]
    for t in browser:
        topic = str(t["topic"]).strip()
        if term_key(topic) in authors or ABOUT_PLACE.search(topic) or re.search(r"[çë]", topic, re.I):
            if topic not in out:
                out.append(topic)
    return out[:15]


ENDINGS = ("eve", "es", "it", "in", "en", "et", "ja", "ne", "a", "e", "i")   # Albanian case endings, without ë


def stem(word: str) -> str:
    word = word.lower().replace("ë", "e").replace("ç", "c")
    for end in ENDINGS:
        if word.endswith(end) and len(word) - len(end) >= 3:
            word = word[: -len(end)]
            break
    return word[:5]


def term_key(term: str) -> str:
    """A term by its words' stems: "Edi Ramës", "Edi Rames" and "Edi Rama" are one, "Kurtit" is "Kurti".
    A hashtag stays whole: #AlbaniaYouthRiseUp is not "Albania"."""
    if term.startswith("#"):
        return term.lower()
    return " ".join(stem(w) for w in re.sub(r"[^\w\s]", " ", term).split())


NOT_STEMS.update(stem(w) for w in NOT_TRENDS)


def ig_medias(node):
    """Every media in an Instagram app reply, whatever layout holds it (medias, fill_items, one_by_two_item...)."""
    if isinstance(node, dict):
        if isinstance(node.get("media"), dict) and node["media"].get("code"):
            yield node["media"]
        elif node.get("code") and "media_type" in node:
            yield node
        else:
            for v in node.values():
                yield from ig_medias(v)
    elif isinstance(node, list):
        for v in node:
            yield from ig_medias(v)


def ig_raw_clip(m: dict, found_by: str) -> dict | None:
    """A media from Instagram's app reply that is a video as the scout's candidate."""
    if m.get("media_type") != 2 or not m.get("code"):
        return None
    user, cover = m.get("user") or {}, ((m.get("image_versions2") or {}).get("candidates") or [{}])[0]
    taken = m.get("taken_at")
    return {
        "platform": "instagram", "id": f"ig:{m['code']}", "vid": m["code"], "link": f"https://www.instagram.com/reel/{m['code']}/",
        "caption": str((m.get("caption") or {}).get("text") or "")[:600], "language": "",
        "created": datetime.fromtimestamp(int(taken), timezone.utc).isoformat() if taken else "",
        "author": str(user.get("username") or ""), "author_name": str(user.get("full_name") or ""), "followers": 0,
        "plays": int(m.get("play_count") or m.get("ig_play_count") or m.get("view_count") or 0),
        "likes": int(m.get("like_count") or 0), "comments": int(m.get("comment_count") or 0),
        "shares": int(m.get("reshare_count") or 0), "saves": 0, "duration": int(m.get("video_duration") or 0), "music": "",
        "cover": str(cover.get("url") or ""), "media_url": str(((m.get("video_versions") or [{}])[0]).get("url") or ""),
        "found_by": found_by,
    }


def ig_raw_photos(m: dict, found_by: str) -> dict | None:
    """A star's photo post (one picture or a carousel's pictures, at most four) as a cut's stills."""
    if m.get("media_type") not in (1, 8) or not m.get("code"):
        return None
    items = m.get("carousel_media") if m.get("media_type") == 8 else [m]
    urls = []
    for it in items or []:
        if not isinstance(it, dict) or it.get("media_type") not in (1, None):
            continue
        best = ((it.get("image_versions2") or {}).get("candidates") or [{}])[0]
        if best.get("url"):
            urls.append(str(best["url"]))
    if not urls:
        return None
    user, taken = m.get("user") or {}, m.get("taken_at")
    return {
        "platform": "instagram", "kind": "photo", "id": f"ig:{m['code']}", "vid": m["code"],
        "link": f"https://www.instagram.com/p/{m['code']}/", "caption": str((m.get("caption") or {}).get("text") or "")[:600],
        "created": datetime.fromtimestamp(int(taken), timezone.utc).isoformat() if taken else "",
        "author": str(user.get("username") or ""), "author_name": str(user.get("full_name") or ""),
        "likes": int(m.get("like_count") or 0), "comments": int(m.get("comment_count") or 0), "photos": urls[:4],
        "found_by": found_by,
    }


def ig_problem(text: str) -> str:
    """What the editor must do when Instagram refuses the spare account, or "" for a passing error."""
    low = text.lower()
    if "challenge_required" in low or "checkpoint" in low:
        return ("Instagram flagged the spare account (challenge_required): open Instagram on it, pass the check, "
                "then re-export www.instagram.com_cookies.txt")
    if any(w in low for w in ("login_required", "user_has_logged_out", "401 unauthorized", "not logged in")):
        return "Instagram cookie expired: re-export www.instagram.com_cookies.txt"
    if "wait" in low and "instagram asked" in low:
        return f"Instagram is rate-limiting the spare account; it is left alone this run ({text[:80]})"
    return ""


def ig_collect(watch: list[str]) -> dict:
    """Instagram Reels through instaloader and the spare account: the top posts of the Albanian
    hashtags, and a few watched creators each run (their last posts are their usual numbers)."""
    import itertools

    import instaloader
    cookies = read_cookies(IG_COOKIES)
    if not cookies.get("sessionid"):
        return {"error": "no Instagram cookie (ig-cookies.txt has no sessionid)"}

    class NoLongWaits(instaloader.RateController):
        def sleep(self, secs):  # Instagram bans scrapers that push on; a long wait means stop for this run
            if secs > 60:
                raise RuntimeError(f"Instagram asked to wait {secs:.0f}s")
            time.sleep(secs)

    loader = instaloader.Instaloader(quiet=True, download_pictures=False, download_videos=False, save_metadata=False,
                                     rate_controller=lambda ctx: NoLongWaits(ctx))
    loader.context._session.cookies.update(cookies)  # as instaloader's own browser-session import does
    # No test_login: the graphql page it asks answers a logged-in session with an empty page now,
    # which read as "cookie expired". The first hashtag is the test, and its answer says what is wrong.
    started, clips, baselines, errors, reads, photos = time.time(), [], {}, [], 0, []
    for tag in IG_HASHTAGS:
        if time.time() - started > COLLECT_TIMEOUT - 120:
            break
        reads += 1
        try:
            # The app's own reply, read directly: its layouts outran instaloader's Hashtag ('medias'),
            # and each media already carries its plays, likes, creator and file, so one request a tag.
            reply = loader.context.get_iphone_json(f"api/v1/tags/web_info/?tag_name={urllib.parse.quote(tag)}", {})
            top = (reply.get("data") or {}).get("top") or {}
            clips += [c for m in itertools.islice(ig_medias(top), IG_PER_TAG) if (c := ig_raw_clip(m, f"IG #{tag}"))]
        except Exception as exc:  # noqa: BLE001
            if problem := ig_problem(str(exc)):
                return {"error": problem}  # pushing on with a flagged account only makes it worse
            errors.append(f"#{tag}: {exc}"[:160])
    for name in watch[:IG_WATCH_POLLS]:
        if time.time() - started > COLLECT_TIMEOUT - 60:
            break
        reads += 1
        try:
            # The app's feed of the creator, as the hashtags: instaloader's Profile page answers 302 now.
            reply = loader.context.get_iphone_json(f"api/v1/feed/user/{urllib.parse.quote(name)}/username/?count=12", {})
            mine = [c for m in ig_medias(reply) if (c := ig_raw_clip(m, f"IG @{name}"))]
            if name in CELEBS_IG:
                photos += [p for m in ig_medias(reply) if (p := ig_raw_photos(m, f"IG @{name}"))]
        except Exception as exc:  # noqa: BLE001
            if problem := ig_problem(str(exc)):
                return {"error": problem, "clips": clips}
            errors.append(f"@{name}: {exc}"[:160])
            continue
        plays = [c["plays"] for c in mine if c["plays"]]
        if len(plays) >= 4:
            baselines[name] = int(statistics.median(plays))
        clips += mine
    if reads and len(errors) == reads:
        return {"error": "; ".join(errors[:2])}
    return {"clips": clips, "baselines": baselines, "notes": errors[:3], "photos": photos}


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
    if clip.get("platform") == "instagram" and clip.get("author") in CELEBS_IG:
        return True   # the Albanian stars post in English; what they post is Albanian showbiz news
    # On X the world posts about Kosovo and Albania in English (protests in Tirana): about the place
    # counts, and an English post is not taken for Albanian on a word or two ("per"). X cannot tell
    # Albanian (it calls it Estonian, Romanian, Tagalog...), so any other label goes by the words.
    if clip.get("platform") == "x" and clip.get("language") == "en":
        return bool(ABOUT_PLACE.search(clip.get("caption", "")))
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


def author_key(clip: dict) -> str:
    """Whose usual numbers: TikTok creators by name (as the state always kept them), others by platform:name."""
    return clip.get("author", "") if clip.get("platform") in ("tiktok", "youtube") else f"{clip.get('platform')}:{clip.get('author', '')}"


def score(clip: dict, state: dict, now: datetime) -> tuple[float, list[str]]:
    """How much of an outlier this clip is, and why, in words for the editor."""
    age = hours_old(clip, now)
    plays = clip.get("plays", 0)
    per_hour = plays / age
    base = (state.get("authors") or {}).get(author_key(clip), {}).get("median")
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
    got = groq_json(prompt, key, "headline")
    if not isinstance(got, dict):
        return fallback
    headline = re.sub(r"\s+", " ", str(got.get("headline") or "")).strip()
    if not 3 <= len(headline.split()) <= 18:
        return fallback
    return {"headline": headline[:120], "caption": re.sub(r"\s+", " ", str(got.get("caption") or "")).strip()[:400], "how": "model"}


def groq_json(prompt: str, key: str, what: str) -> dict | None:
    """The model's JSON reply, or None. Each Groq model has its own free quota (and Pyet and the
    newsroom share the first): a model that is out after one wait hands over to the next."""
    tries = [GROQ_MODEL, GROQ_MODEL, "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
    for attempt, model in enumerate(tries):
        body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3,
                           "response_format": {"type": "json_object"}}).encode()
        req = urllib.request.Request(GROQ, data=body, method="POST",
                                     headers={**HEADERS, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.loads(json.loads(res.read().decode("utf-8"))["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as exc:
            # The free tier allows a few calls a minute: the first model once more after the wait it
            # asks for, then the others straight away.
            if exc.code == 429 and attempt < len(tries) - 1:
                if attempt == 0:
                    time.sleep(min(30.0, float(exc.headers.get("retry-after") or 12)))
                continue
            print(f"SCOUT {what} model failed (HTTP {exc.code})", file=sys.stderr)
            return None
        except (urllib.error.URLError, OSError, ValueError, KeyError, IndexError, TypeError) as exc:
            print(f"SCOUT {what} model failed ({exc!r})", file=sys.stderr)
            return None
    return None


def topics_of(ranked: list[dict]) -> list[str]:
    """What Albanian social media is about right now, from the captions of the run's most viral
    clips: the topics and people, short enough to search with (next run's X searches and hashtags).
    Stands in for X's trends list, which twscrape cannot read (X answers it with a server error)."""
    key = os.environ.get("GROQ_API_KEY", "")
    lines = [clean_caption(c.get("caption", ""))[:160] for c in ranked[:40]]
    lines = [line for line in lines if len(line) >= 12]
    if not key or len(lines) < 5:
        return []
    prompt = ("These are the captions of the most viral Kosovo and Albania videos on social media right now, most "
              "viral first. Name the 5 to 8 topics or people most of them are about (an event, a person, a place in "
              "the news), each as a 1 to 3 word search term in the language the captions use, most talked about "
              "first. Leave out generic words (video, viral, funny, music, love). Reply with only JSON: "
              "{\"topics\": [\"...\"]}\n\n" + "\n".join(f"- {line}" for line in lines))
    got = groq_json(prompt, key, "topics") or {}
    topics = got.get("topics") if isinstance(got, dict) else None
    return [str(t).strip()[:40] for t in topics or [] if 2 <= len(str(t).strip()) <= 40][:8]


def vet(ranked: list[dict], state: dict, now: datetime) -> bool:
    """The model reads the best finds as an editor would: a news moment, an event or a public
    figure Kosovo and Albania care about stays; an ad, a product, a giveaway or filler with a
    word or two of Albanian goes. Each also gets its story in a few words, so one story does not
    fill the run. Verdicts are kept (state "verdicts"); False when the model could not be asked."""
    verdicts = state.setdefault("verdicts", {})
    cutoff = (now - timedelta(days=4)).isoformat()
    state["verdicts"] = verdicts = {k: v for k, v in verdicts.items() if v.get("at", "") >= cutoff}
    todo = [c for c in ranked[:VET_TOP] if c["id"] not in verdicts]
    key = os.environ.get("GROQ_API_KEY", "")
    if not todo:
        return True
    if not key:
        return False
    lines = [f"{n}. [{c['platform']}] @{c.get('author', '')} ({c.get('author_name', '')}): "
             f"{clean_caption(c.get('caption', ''))[:220] or '(no text)'}" for n, c in enumerate(todo, 1)]
    prompt = ("You are the editor of 383, a Kosovo news site whose \"Virale sot\" re-cuts what Albanian social media is "
              "talking about today. For each post below, decide if it is worth it: keep it if it is a news moment, an "
              "event, protest, politics, sport, a public figure, Albanian showbiz (singers, actors, influencers, and "
              "Albanian stars abroad such as Dua Lipa, Rita Ora, Bebe Rexha, Era Istrefi), reality TV (Big Brother VIP "
              "Kosova and other Albanian shows: fights, funny moments, evictions, what the housemates say), or a "
              "genuinely viral funny or human moment in or about Kosovo, Albania or Albanians. Drop it if it is an ad, "
              "a product or shop post, a giveaway or contest, self-promotion, generic entertainment with no Albanian "
              "angle, or not about Albanians at all. A post with no text is kept only if its creator is clearly a news, "
              "showbiz or local account. For each kept post give its story in 2 to 5 Albanian words (the same words "
              "for posts about the same event or moment, e.g. \"sherri i Big Brother\"), and its kind: lajme, sport, "
              "showbiz, bbk (Big Brother) or humor.\n"
              "Also say if a kept post may go into 383's own cut by itself, with no editor looking (\"site\"): news, "
              "events, sport, public figures, showbiz, reality TV and funny moments may, but never when the post may be "
              "staged as news, AI-made, or a startling claim it alone cannot prove (a politician doing something "
              "outlandish, an accident or crime with no source); never nudity or sexual content, a child in it, a "
              "private person who did not choose to be filmed being mocked, or violence that hurts someone. Stars "
              "and reality-TV housemates chose the public eye. When in doubt, false.\n"
              "Reply with only JSON: {\"items\": [{\"n\": 1, \"keep\": true, \"site\": false, \"story\": \"...\", \"kind\": \"lajme\"}]}\n\n"
              + "\n".join(lines))
    got = groq_json(prompt, key, "vet")
    items = got.get("items") if isinstance(got, dict) else None
    if not isinstance(items, list):
        return False
    for it in items:
        try:
            c = todo[int(it.get("n")) - 1]
        except (TypeError, ValueError, IndexError, AttributeError):
            continue
        keep = it.get("keep") is True
        kind = str(it.get("kind") or "").strip().lower()
        verdicts[c["id"]] = {"keep": keep, "site": keep and it.get("site") is True,
                             "story": str(it.get("story") or "").strip().lower()[:60], "at": now_iso(),
                             "kind": kind if kind in KINDS else "lajme"}
    return True


def clean_caption(text: str) -> str:
    text = re.sub(r"#\S+|@\S+|https?://\S+", " ", text or "")
    text = re.sub(r"[^\w\s.,!?:;'\"()çëÇË€%-]", " ", text)
    return re.sub(r"\s+", " ", text).strip(" .,-")


def download(clip: dict, out: Path) -> bool:
    """The original file through yt-dlp and the platform's cookie; TikTok without a cookie through the
    scraper's own session (TikTok serves its files to a home connection, not to a server)."""
    if clip["platform"] == "tiktok":
        if TT_COOKIES.exists() and ytdlp(clip["link"], out, ["--cookies", str(TT_COOKIES)]):
            return True
        return tiktok_session_download(clip["vid"], out)
    if clip["platform"] in ("x", "instagram"):
        jar = X_COOKIES if clip["platform"] == "x" else IG_COOKIES
        if ytdlp(clip["link"], out, (["--cookies", str(jar)] if jar.exists() else []) + ["-f", "bv*[height<=1920]+ba/b"]):
            return True
        return bool(clip.get("media_url")) and fetch_file(clip["media_url"], out)  # Instagram's reply named the file
    cookies = ["--cookies", YT_COOKIES] if os.path.exists(YT_COOKIES) else []
    return ytdlp(clip["link"], out, cookies + ["-f", "bv*[height<=1920][vcodec^=avc1]+ba/b[height<=1920]/b"])


def fetch_file(url: str, out: Path, min_size: int = 100_000) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.instagram.com/"})
        with urllib.request.urlopen(req, timeout=120) as res:
            out.write_bytes(res.read())
    except (urllib.error.URLError, OSError) as exc:
        print(f"SCOUT fetch {url[:80]}: {exc}", file=sys.stderr)
        return False
    return out.stat().st_size > min_size


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


PLATFORM_NAMES = {"tiktok": "TikTok", "youtube": "YouTube", "x": "X", "instagram": "Instagram"}


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
    platform = PLATFORM_NAMES.get(clip["platform"], clip["platform"])
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
    done = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.5", "-i", str(video), "-frames:v", "1", "-vf", "scale=540:-2", str(out)],
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
                                      "likes", "shares", "saves", "comments", "followers", "duration", "found_by", "score", "why", "story", "site", "kind")}
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
        keep_raw(clip["id"], raw)   # the original, for the day's cuts (viral_cut.py)
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


def sign(clip_id: str) -> str:
    """The editor's "Hiq" link's proof for this find alone (the site's /api/virale/hiq does the same sum)."""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return hmac.new(key.encode(), f"clip-scout-remove:{clip_id}".encode(), hashlib.sha256).hexdigest()[:32]


def remove_link(clip_id: str) -> str:
    return f"{SITE}/api/virale/hiq?" + urllib.parse.urlencode({"id": clip_id, "t": sign(clip_id)})


def removed_ids() -> set[str]:
    """The finds the editor took off the site (clip-scout/removed.json, written by the site)."""
    status, body = storage("GET", f"object/{BUCKET}/removed.json")
    if status != 200:
        return set()
    try:
        ids = json.loads(body.decode("utf-8")).get("ids")
    except (ValueError, AttributeError):
        return set()
    return {str(i) for i in ids} if isinstance(ids, list) else set()


def on_site(state: dict, now: datetime, removed: set[str]) -> list[dict]:
    """What "Virale sot" shows on the site: the day's finds the model passed for the site by itself
    (news, events, people; nothing that may be staged), rendered with their headline and credit,
    best first; the site shows the first SITE_SHOWN, the rest stand in for any the editor takes down."""
    day_ago = (now - timedelta(hours=24)).isoformat()
    fit = [e for e in (state.get("queued") or {}).values()
           if e.get("site") is True and e.get("status") == "ready" and e.get("file") and e.get("found_at", "") >= day_ago
           and e.get("id") not in removed and (e.get("duration") or 0) > 0]
    fit.sort(key=lambda e: -(e.get("score") or 0))
    keys = ("id", "platform", "link", "author", "headline", "post_text", "created", "found_at", "duration", "file", "thumb", "score")
    return [{**{k: e.get(k) for k in keys}, "duration": min(int(e.get("duration") or 0), 180)} for e in fit[:SITE_KEEP]]


def publish_site(state: dict, now: datetime) -> list[dict]:
    removed = removed_ids()
    for cid in removed & set(state.get("queued") or {}):
        state["queued"][cid]["status"] = "removed from the site"
    items = on_site(state, now, removed)
    upload("published.json", json.dumps({"updatedAt": now_iso(), "items": items}, ensure_ascii=False).encode(), "application/json")
    return items


# ── 6. "Virale sot": the day's stories re-cut (viral_cut.py) ─────────────────

def safe_name(clip_id: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", clip_id.lower()).strip("-")


def raw_path(clip_id: str, ext: str = ".mp4") -> Path:
    return RAW / f"{safe_name(clip_id)}{ext}"


def keep_raw(clip_id: str, raw: Path) -> None:
    try:
        RAW.mkdir(parents=True, exist_ok=True)
        raw_path(clip_id).write_bytes(raw.read_bytes())
    except OSError as exc:
        print(f"SCOUT keep raw {clip_id}: {exc}", file=sys.stderr)


def prune_raw(now: datetime) -> None:
    """Originals (and the cutter's notes beside them) go after two days."""
    cutoff = now.timestamp() - RAW_KEEP_H * 3600
    for f in RAW.glob("*") if RAW.exists() else []:
        try:
            if f.stat().st_mtime < cutoff:
                f.unlink()
        except OSError:
            pass


def celeb_photos(state: dict, photos: list[dict], now: datetime) -> list[dict]:
    """The stars' fresh photo posts, downloaded as stills and queued as their own story ("<name> në
    Instagram"); a post is taken once. Returns the new entries."""
    queued, new = state.setdefault("queued", {}), []
    for p in photos:
        if p["id"] in queued or hours_old(p, now) > CELEB_PHOTO_MAX_H:
            continue
        files = []
        for n, url in enumerate(p.get("photos") or []):
            out = raw_path(p["id"], f"-{n}.jpg")
            RAW.mkdir(parents=True, exist_ok=True)
            if fetch_file(url, out, min_size=20_000):
                files.append(str(out))
        if not files:
            continue
        name = p.get("author_name") or p["author"]
        entry = {**{k: p.get(k) for k in ("id", "platform", "link", "author", "author_name", "caption", "created", "likes",
                                         "comments", "found_by")},
                 "kind": "showbiz", "photos": files, "story": f"{name.lower()} në instagram", "site": True,
                 # A star's post is news the hour it goes up: it scores as a strong find, more with more likes.
                 "score": round(MIN_SCORE_OTHERS + math.log10(1 + p.get("likes", 0) / 10_000), 3),
                 "headline": f"{name} publikon foto të reja në Instagram", "post_text": "", "found_at": now_iso(),
                 "status": "ready", "file": "", "thumb": "", "why": [f"{fmt(p.get('likes', 0))} pëlqime"]}
        queued[p["id"]] = entry
        new.append(entry)
    return new


def cut_id(story: str) -> str:
    return "cut:" + hashlib.sha1(story.encode("utf-8")).hexdigest()[:16]


def cut_groups(state: dict, now: datetime, removed: set[str]) -> list[tuple[str, list[dict]]]:
    """The day's finds that may go up, by story, best story first; each with its best clips."""
    day_ago = (now - timedelta(hours=24)).isoformat()
    groups: dict[str, list[dict]] = {}
    for e in (state.get("queued") or {}).values():
        if not (e.get("site") is True and str(e.get("status", "")).startswith("ready") and e.get("found_at", "") >= day_ago):
            continue
        if e.get("id") in removed:
            continue
        has = any(Path(f).exists() for f in e["photos"]) if e.get("photos") else raw_path(e["id"]).exists()
        if not has:
            continue
        groups.setdefault(e.get("story") or e["id"], []).append(e)
    ranked = []
    for story, items in groups.items():
        items.sort(key=lambda e: -(e.get("score") or 0))
        if cut_id(story) in removed:
            continue
        ranked.append((story, items[:CUT_SOURCES]))
    ranked.sort(key=lambda g: -(g[1][0].get("score", 0) + 0.4 * sum(e.get("score", 0) for e in g[1][1:])))
    return ranked[:CUTS_MAX]


def cut_sources(items: list[dict]) -> list[dict]:
    out = []
    for e in items:
        base = {"id": e["id"], "author": e.get("author", ""), "platform": e.get("platform", ""),
                "caption": e.get("caption", ""), "headline": e.get("headline", "")}
        if e.get("photos"):
            out += [{**base, "file": f} for f in e["photos"] if Path(f).exists()]
        else:
            out.append({**base, "file": str(raw_path(e["id"]))})
    return out


def make_cuts(state: dict, now: datetime, removed: set[str], deadline: float) -> list[dict]:
    """Renders the day's best stories that have no cut yet, or new clips since theirs; keeps the rest."""
    import viral_cut  # ffmpeg-only; next to this file
    cuts = state.setdefault("cuts", {})
    lib, made, day = viral_cut.load_library(), [], now.strftime("%Y-%m-%d")
    key = os.environ.get("GROQ_API_KEY", "")
    for story, items in cut_groups(state, now, removed):
        cid = cut_id(story)
        version = hashlib.sha1("|".join(sorted(e["id"] for e in items)).encode()).hexdigest()[:10]
        old = cuts.get(cid) or {}
        if old.get("version") == version and old.get("file"):
            old["score"] = items[0].get("score", 0)
            continue
        if len(made) >= CUTS_PER_RUN or time.time() > deadline:
            continue
        with tempfile.TemporaryDirectory(prefix="383-cut-") as tmp:
            try:
                got = viral_cut.make_cut(story, cut_sources(items), Path(tmp), key, lib)
            except (OSError, ValueError, subprocess.SubprocessError) as exc:
                print(f"SCOUT cut {story!r}: {exc!r}"[:240], file=sys.stderr)
                got = None
            if not got:
                continue
            stem = f"cuts/{day}/{safe_name(cid)}-{version}"
            if not upload(f"{stem}.mp4", got["hd"].read_bytes(), "video/mp4"):
                continue
            sd = public_url(f"{stem}-sd.mp4") if upload(f"{stem}-sd.mp4", got["sd"].read_bytes(), "video/mp4") else public_url(f"{stem}.mp4")
            thumb = public_url(f"{stem}.jpg") if got.get("thumb") and upload(f"{stem}.jpg", got["thumb"].read_bytes(), "image/jpeg") else ""
        entry = {"id": cid, "version": version, "story": story, "kind": items[0].get("kind") or "lajme",
                 "title": got["hook"], "kicker": got["kicker"], "origin": got["origin"], "planned_by": got["planned_by"],
                 "file": public_url(f"{stem}.mp4"), "sd": sd, "thumb": thumb, "duration": got["duration"],
                 "sources": [{"id": e["id"], "author": e.get("author", ""), "platform": e.get("platform", ""), "link": e.get("link", "")}
                             for e in items],
                 "score": items[0].get("score", 0), "made_at": now_iso(), "found_at": old.get("found_at") or now_iso()}
        cuts[cid] = entry
        made.append(entry)
        print(f"SCOUT cut: {entry['title']} ({story}; {len(items)} clips, {entry['duration']}s, {entry['planned_by']})")
    cutoff = (now - timedelta(days=3)).isoformat()
    state["cuts"] = {k: v for k, v in cuts.items() if v.get("made_at", "") >= cutoff}
    return made


def on_site_cuts(state: dict, now: datetime, removed: set[str]) -> list[dict]:
    """"Virale sot" as the site reads it (viral.json): today's cuts, best story first; a cut taken
    down, or one whose every clip was taken down, is gone."""
    day_ago = (now - timedelta(hours=24)).isoformat()
    keep = []
    for c in (state.get("cuts") or {}).values():
        if c["id"] in removed or c.get("made_at", "") < day_ago or not c.get("file"):
            continue
        if any(s.get("id") in removed for s in c.get("sources") or []):
            continue   # re-cut without it next run
        keep.append({k: c.get(k) for k in ("id", "story", "kind", "title", "kicker", "origin", "file", "sd", "thumb", "duration",
                                           "sources", "score", "made_at")})
    keep.sort(key=lambda c: -(c.get("score") or 0))
    return keep[:CUTS_MAX]


def publish_viral(state: dict, now: datetime, removed: set[str]) -> list[dict]:
    items = on_site_cuts(state, now, removed)
    upload("viral.json", json.dumps({"updatedAt": now_iso(), "items": items}, ensure_ascii=False).encode(), "application/json")
    return items


def health_lines(health: dict) -> list[str]:
    """Each source in a word: "✓ X: 212 video" or "✗ Instagram: cookie expired..."."""
    return [f"{'✓' if ok else '✗'} {name}: {note}" for name, (ok, note) in health.items()]


def should_email(found: list[dict], health: dict, state: dict, now: datetime) -> bool:
    """Every run with finds; a run with none only to say a source is down, once a day."""
    if found:
        return True
    if all(ok for ok, _ in health.values()):
        return False
    return state.get("alerted", "") < (now - timedelta(hours=20)).isoformat()


def email(found: list[dict], health: dict | None = None, trending: dict | None = None, site: set[str] | None = None,
          cuts: list[dict] | None = None) -> bool:
    """One email per run that found something: each clip, its numbers, why, and its links; above them
    how each source did and what is trending."""
    health, trending = health or {}, trending or {}
    to = os.environ.get("L383_SCOUT_REPORT_TO") or os.environ.get("L383_EDITION_REPORT_TO", "")
    # Operator mail goes through the newsroom's Gmail (SMTP with an app password), as its other reports do.
    user, password = os.environ.get("GMAIL_USER", "").strip(), os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    if not (to and user and password):
        print("SCOUT email skipped: no report address or Gmail credentials", file=sys.stderr)
        return False
    esc = lambda s: str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")  # noqa: E731
    top = "".join(f'<div style="font-size:13px;color:{"#1a7f37" if line[0] == "✓" else "#c62828"}">{esc(line)}</div>'
                  for line in health_lines(health))
    for label, terms in trending.items():
        if terms:
            top += f'<div style="font-size:13px;margin-top:8px"><b>{esc(label)}:</b> {esc(" · ".join(terms[:15]))}</div>'
    rows = []
    for e in found:
        img = f'<img src="{esc(e["thumb"])}" width="120" style="border-radius:8px;display:block">' if e.get("thumb") else ""
        file = f'<a href="{esc(e["file"])}">Shkarko videon</a> · ' if e.get("file") else f"<b>{esc(e['status'])}</b> · "
        rows.append(f'<tr><td style="padding:12px 12px 12px 0;vertical-align:top">{img}</td><td style="padding:12px 0;vertical-align:top;font-family:Arial,sans-serif">'
                    f'<div style="font-size:17px;font-weight:700">{esc(e["headline"])}</div>'
                    f'<div style="color:#555;font-size:13px;margin:4px 0">{esc(" · ".join(e.get("why") or []))}</div>'
                    f'<div style="font-size:13px">{file}<a href="{esc(e["link"])}">Origjinali (@{esc(e["author"])}, {esc(e["platform"])})</a></div>'
                    + (f'<div style="font-size:13px;margin-top:4px;color:#1a7f37"><b>Në faqe</b> (Virale sot) · '
                       f'<a href="{esc(remove_link(e["id"]))}" style="color:#c62828">Hiq nga faqja</a></div>' if e["id"] in (site or set()) else "")
                    + 
                    f'<div style="color:#888;font-size:12px;margin-top:4px">{esc(e.get("post_text") or "")}</div></td></tr>')
    cut_rows = []
    for c in cuts or []:
        img = f'<img src="{esc(c["thumb"])}" width="120" style="border-radius:8px;display:block">' if c.get("thumb") else ""
        srcs = " · ".join(f'<a href="{esc(x["link"])}">@{esc(x["author"])}</a>' for x in c.get("sources") or [])
        cut_rows.append(f'<tr><td style="padding:12px 12px 12px 0;vertical-align:top">{img}</td><td style="padding:12px 0;vertical-align:top;font-family:Arial,sans-serif">'
                        f'<div style="font-size:12px;color:#FF4422;font-weight:700">VIRALE SOT · {esc(c.get("kind", ""))} · {c.get("duration", 0):.0f}s</div>'
                        f'<div style="font-size:17px;font-weight:700">{esc(c["title"])}</div>'
                        f'<div style="font-size:13px;margin:4px 0">{esc(c["story"])} · nga {srcs}</div>'
                        f'<div style="font-size:13px"><a href="{esc(c["file"])}">Shiko</a> · '
                        f'<a href="{esc(remove_link(c["id"]))}" style="color:#c62828">Hiq nga faqja</a></div></td></tr>')
    if cut_rows:
        rows = [f'<tr><td colspan="2"><h3 style="font-family:Arial,sans-serif;margin:8px 0 0">Virale sot: {len(cut_rows)} të montuara, në faqe tani</h3></td></tr>'] + cut_rows + rows
    title = ((f"{len(found)} klipe të reja për rishikim" if found else f"{len(cuts or [])} video virale të montuara")
             if (found or cuts) else "Asnjë klip i ri: një burim nuk punon")
    body = (f'<div style="font-family:Arial,sans-serif"><h2>{title}</h2><div style="margin-bottom:12px">{top}</div>'
            f'<table>{"".join(rows)}</table></div>')
    msg = EmailMessage()
    msg["From"], msg["To"] = f"383 Klipe <{user}>", to
    msg["Subject"] = (f"383 klipe: {found[0]['headline'][:60]}" if found else f"383 virale: {cuts[0]['title'][:60]}" if cuts
                      else "383 klipe: një burim nuk punon")
    msg.set_content(title + "\n\n" + "\n".join(health_lines(health)))
    msg.add_alternative(body, subtype="html")
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
        print("SCOUT email sent")
        return True
    except (smtplib.SMTPException, OSError) as exc:
        print(f"SCOUT email failed: {exc}", file=sys.stderr)
        return False


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


def pick(ranked: list[dict], state: dict | None = None, now: datetime | None = None, vetted: bool = False) -> list[dict]:
    """The run's best that clear the bar and the editor's model: no more than PER_PLATFORM from
    one platform, PER_AUTHOR from one account, PER_STORY of one story, and none of a story
    already queued STORY_PER_DAY times in the last day. When the model read this run's finds
    (vetted), only what it kept is picked: one it did not reach is not waved through."""
    state, now = state or {}, now or datetime.now(timezone.utc)
    verdicts = state.get("verdicts") or {}
    day_ago = (now - timedelta(hours=24)).isoformat()
    queued_stories: dict[str, int] = {}
    for e in (state.get("queued") or {}).values():
        if e.get("story") and e.get("found_at", "") >= day_ago:
            queued_stories[e["story"]] = queued_stories.get(e["story"], 0) + 1
    picks, per, by, stories = [], {}, {}, {}
    for c in ranked:
        verdict = verdicts.get(c["id"]) or {}
        story = verdict.get("story", "")
        if (vetted and not verdict.get("keep")) or verdict.get("keep") is False or \
                c.get("score", 0) < MIN_SCORE.get(c["platform"], MIN_SCORE_OTHERS):
            continue
        if per.get(c["platform"], 0) >= PER_PLATFORM or by.get(author_key(c), 0) >= PER_AUTHOR:
            continue
        if story and (stories.get(story, 0) >= PER_STORY or queued_stories.get(story, 0) >= STORY_PER_DAY):
            continue
        c["story"] = story
        c["site"] = verdict.get("site") is True  # may go on the site by itself ("Virale sot")
        c["kind"] = verdict.get("kind") or "lajme"
        picks.append(c)
        per[c["platform"]] = per.get(c["platform"], 0) + 1
        by[author_key(c)] = by.get(author_key(c), 0) + 1
        if story:
            stories[story] = stories.get(story, 0) + 1
        if len(picks) == PICKS_PER_RUN:
            break
    return picks


def count_line(clips: list[dict], noun: str = "video") -> str:
    return f"{len(clips)} {noun}"


def main(dry_run: bool = False) -> int:
    now, started = datetime.now(timezone.utc), time.time()
    state = load_state()
    health: dict[str, tuple[bool, str]] = {}
    # X first: what is trending there steers every other platform's search.
    # The last run's X trends and the topics its viral clips were about steer this run's X searches.
    # Not today's Google searches: Albania's are mostly the world's (weather, football), and X finds those worldwide.
    topics_before = [str(t) for t in (state.get("topics") or {}).get("terms") or []][:6]
    x_before = [str(t) for t in (state.get("x_trends") or {}).get("terms") or []][:6]
    browser = x_browser_trends()
    x = run_collector("x", {"terms": x_before + topics_before})
    pool = [c for c in x.get("clips") or [] if isinstance(c, dict)]
    talk = [t for t in x.get("talk") or [] if isinstance(t, dict)]
    x_trends = x_trending(talk, browser, state)
    if x_trends:
        state["x_trends"] = {"at": now_iso(), "terms": x_trends}
    health["X"] = (False, x["error"]) if x.get("error") else (
        True, f"{count_line(pool)}, {len(talk)} postime shqip, {len(x_trends)} trende"
              + ("" if browser else " (lista e X-it nuk u lexua)"))
    tags = list(dict.fromkeys(HASHTAGS + as_tags(x_trends[:8] + topics_before) + trend_tags()))
    proc = start_scraper()
    try:
        tiktok_pool = collect_tiktok(state, tags) if proc else []
        health["TikTok"] = (bool(tiktok_pool), count_line(tiktok_pool) if tiktok_pool else
                            "scraper did not start" if not proc else "nothing came back (blocked?)")
        pool += tiktok_pool
        ranked = rank(pool, state, now)
        # The creators behind the best ones: their usual numbers make the outlier score honest.
        for c in [c for c in ranked if c["platform"] == "tiktok" and c["author"] not in (state.get("authors") or {})][:BASELINE_LOOKUPS]:
            page = tiktok("users/videos", user=c["author"])
            if not page.get("error"):
                remember_baseline(state, c["author"], [x for v in page.get("videos") or [] if (x := tiktok_clip(v, ""))])
        youtube = collect_youtube(["kosova", "shqiperi", "prishtina", "tirana"] + trend_terms()[:4])
        health["YouTube"] = (bool(youtube), count_line(youtube) if youtube else "nothing came back")
        pool += youtube
        # Instagram last and slowest: the watched creators that were read the longest ago.
        ig_watch = state.setdefault("ig_watch", {})
        # One of the stars each run, in turn, then the watched creators read the longest ago.
        turn = int(state.get("celeb_turn") or 0) % len(CELEBS_IG)
        state["celeb_turn"] = turn + 1
        due = [CELEBS_IG[turn]] + [n for n in sorted(ig_watch, key=lambda n: ig_watch[n].get("polled", ""))
                                   if n not in CELEBS_IG][:IG_WATCH_POLLS - 1]
        ig = run_collector("instagram", {"watch": due})
        for name in due:
            ig_watch.setdefault(name, {"polled": ""})["polled"] = now_iso()
        for name, median in (ig.get("baselines") or {}).items():
            state.setdefault("authors", {})[f"instagram:{name}"] = {"median": int(median), "at": now_iso()}
        ig_pool = [c for c in ig.get("clips") or [] if isinstance(c, dict)]
        health["Instagram"] = (False, ig["error"]) if ig.get("error") else (True, count_line(ig_pool))
        for c in ig_pool:
            if c.get("author") and c.get("plays", 0) >= IG_WATCH_MIN_PLAYS and is_albanian(c):
                ig_watch.setdefault(c["author"], {"polled": ""})["hit"] = now_iso()
        if len(ig_watch) > WATCH_MAX:
            state["ig_watch"] = {n: ig_watch[n] for n in sorted(ig_watch, key=lambda n: ig_watch[n].get("hit", ""), reverse=True)[:WATCH_MAX]}
        pool += ig_pool
        ranked = rank(pool, state, now)
        print(f"SCOUT {len(pool)} clips looked at, {len(ranked)} fresh Albanian outliers, watching "
              f"{len(state.get('watch') or {})} TikTok and {len(state.get('ig_watch') or {})} Instagram creators")
        for line in health_lines(health):
            print(f"SCOUT {line}")
        topics = topics_of(ranked)
        if topics:
            state["topics"] = {"at": now_iso(), "terms": topics}
        trending = {"Temat e ditës": topics, "Trending në X (shqip)": x_trends, "Google (Shqipëri)": trend_terms()}
        vetted = vet(ranked, state, now)
        if not vetted:
            health["Kontrolli i lajmit"] = (False, "the model could not be asked: this run's finds are not checked for ads")
        picks = pick(ranked, state, now, vetted)
        if dry_run:
            print(f"SCOUT topics: {' · '.join(topics)} | X trends: {' · '.join(x_trends[:15])}")
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
        site = {e["id"] for e in publish_site(state, now)}
        # "Virale sot": the stars' new photo posts join the day's finds, then each story is cut.
        celeb_photos(state, [p for p in ig.get("photos") or [] if isinstance(p, dict)], now)
        removed = removed_ids()
        cuts = make_cuts(state, now, removed, started + CUT_DEADLINE)
        on_site_now = publish_viral(state, now, removed)
        health["Virale sot"] = (bool(on_site_now), f"{len(on_site_now)} në faqe, {len(cuts)} të reja këtë herë")
        prune_raw(now)
        state["trending"] = {"at": now_iso(), **trending}
        if should_email(found + cuts, health, state, now) and email(found, health, trending, site, cuts) and not (found or cuts):
            state["alerted"] = now_iso()
    finally:
        if proc:
            proc.terminate()
        save_state(state)
    return 0


if __name__ == "__main__":
    import signal
    # The runner's timeout sends TERM: exit through main's finally, so the run's state is saved.
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    if sys.argv[1:2] == ["--collect"]:
        sys.exit(collect_child(sys.argv[2] if len(sys.argv) > 2 else ""))
    sys.exit(main(dry_run="--dry-run" in sys.argv[1:]))
