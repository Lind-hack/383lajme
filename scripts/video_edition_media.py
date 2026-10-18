"""What a video-edition clip is made of besides its script (scripts/video_edition.py):

- the voice: Gemini's text-to-speech (warm, calm, in Albanian), else
  Microsoft's Albanian voice through edge-tts; the time of every word comes
  from Whisper (Groq) lined up against the script;
- the pictures: several real, freely licensed photos of the story's people
  and places (Wikipedia / Wikimedia Commons, CC0, public domain, CC BY,
  CC BY-SA, each credited), a map of where it happened (OpenStreetMap),
  and footage the people or institutions themselves posted on YouTube,
  never a news outlet's;
- the beats: which of those is on screen when, changing every few seconds,
  a number shown big the moment the voice says it, the map when the place
  is named.
"""
from __future__ import annotations

import asyncio
import base64
import difflib
import io
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

HEADERS = {"User-Agent": "383VideoEdition/1.0 (https://383ks.com; daily video edition)"}

GEMINI_MODEL = os.environ.get("L383_EDITION_GEMINI_MODEL", "gemini-3.8-flash-tts")
GEMINI_VOICE = os.environ.get("L383_EDITION_GEMINI_VOICE", "Sulafat")
STYLE = "warm, calm and soothing, like a kind newsreader telling a friend the news; soft, unhurried, with gentle feeling"
EDGE_VOICE = os.environ.get("L383_EDITION_VOICE", "sq-AL-AnilaNeural")
EDGE_RATE, EDGE_PITCH = "-6%", "-3Hz"
GROQ_STT = "https://api.groq.com/openai/v1/audio/transcriptions"
EXA = "https://mcp.exa.ai/mcp"
WIKI = "https://en.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"

# Freely licensed only: never NC or ND, never fair use.
FREE = re.compile(r"(?i)\b(cc0|public domain|pd\b|pd-|cc[ -]by(?:-sa)?\b|attribution)")
NOT_FREE = re.compile(r"(?i)\b(nc|nd|non-?commercial|no ?deriv|fair use|non-free)\b")
NOT_A_PHOTO = re.compile(r"(?i)(logo|flag|map|coat[_ ]of[_ ]arms|seal|signature|diagram|chart|emblem|locator|svg)")
# Graves and memorials say something no story about a city's match or market means to say.
SOMBRE = re.compile(r"(?i)(cemetery|graveyard|grave|tomb|memorial|martyr|funeral|ossuary|varrez|varreza|dëshmor|deshmor|eshtëror|eshteror|të rënë|lapidar|mezar|gedenk|friedhof)")


def http_json(url: str, data: bytes | None = None, headers: dict | None = None, timeout: int = 30, tries: int = 3):
    """JSON from a URL; a busy server (429, 5xx) is asked again after a pause."""
    for attempt in range(tries):
        req = urllib.request.Request(url, data=data, headers={**HEADERS, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == tries - 1:
                raise
            time.sleep(3 * (attempt + 1))


def http_bytes(url: str, timeout: int = 30) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=timeout) as res:
        return res.read()


# ── The voice ────────────────────────────────────────────────────────────────

def gemini_keys() -> list[str]:
    keys = [os.environ.get(k, "") for k in ("GOOGLE_AI_API_KEY", "GOOGLE_AI_API_KEY1", "GOOGLE_API_KEY", "GOOGLE_API_KEY_2")]
    return list(dict.fromkeys(k for k in keys if k))


# Spent for the day in this run: (model, key) pairs not to ask again.
_SPENT: set[tuple[str, str]] = set()


def gemini_voice(text: str) -> bytes | None:
    """WAV from Gemini TTS. The style travels as speech metadata: in the text
    itself the model would read it aloud. The free tier allows ten clips a day
    per key and model, and a few a minute: every key is tried on the full
    model, then on Flash-Lite; a key spent for the day is not asked again this
    run, a busy one is asked again after a pause."""
    body = json.dumps({
        "contents": [{"parts": [{"text": text, "speech_metadata": {"style": STYLE}}]}],
        "generationConfig": {"responseModalities": ["AUDIO"],
                             "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": GEMINI_VOICE}}}},
    }).encode()
    for model in dict.fromkeys([GEMINI_MODEL, "gemini-3.8-flash-lite-tts"]):
        for key in gemini_keys():
            for attempt in range(3):
                if (model, key) in _SPENT:
                    break
                try:
                    data = http_json(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
                                     body, {"Content-Type": "application/json"}, timeout=180, tries=1)
                    raw = base64.b64decode(data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
                    return raw if raw[:4] == b"RIFF" else pcm_to_wav(raw)
                except urllib.error.HTTPError as exc:
                    detail = exc.read().decode("utf-8", "replace")
                    if exc.code == 429 and "PerDay" in detail:
                        _SPENT.add((model, key))
                    elif exc.code in (429, 500, 503) and attempt < 2:
                        time.sleep(25)
                    else:
                        print(f"EDITION gemini voice HTTP {exc.code}: {detail[:200]}", file=sys.stderr)
                        break
                except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError) as exc:
                    print(f"EDITION gemini voice failed: {exc}", file=sys.stderr)
                    break
    return None


def pcm_to_wav(pcm: bytes, rate: int = 24000) -> bytes:
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def to_mp3(audio: bytes, suffix: str) -> bytes | None:
    with tempfile.TemporaryDirectory() as tmp:
        src, out = os.path.join(tmp, "in" + suffix), os.path.join(tmp, "out.mp3")
        open(src, "wb").write(audio)
        done = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-ac", "1", "-b:a", "96k", out],
                              capture_output=True, timeout=120, check=False)
        return open(out, "rb").read() if done.returncode == 0 and os.path.exists(out) else None


async def _edge(text: str) -> tuple[bytes, list[list]]:
    import edge_tts  # in the edition's venv only
    com = edge_tts.Communicate(text, EDGE_VOICE, rate=EDGE_RATE, pitch=EDGE_PITCH, boundary="WordBoundary")
    audio, words = bytearray(), []
    async for chunk in com.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            start = chunk["offset"] / 1e7
            words.append([round(start, 2), round(start + chunk["duration"] / 1e7, 2), chunk["text"]])
    return bytes(audio), words


def edge_voice(text: str) -> tuple[bytes, list[list]] | None:
    for _ in range(2):
        try:
            audio, words = asyncio.run(_edge(text))
        except Exception as exc:  # edge-tts raises its own types; any failure means no voice
            print(f"EDITION edge voice failed: {exc}", file=sys.stderr)
            continue
        if len(audio) > 4000 and words:
            return audio, words
    return None


def heard_words(mp3: bytes) -> list[list]:
    """Whisper's words with their times: [[start, end, word], ...]."""
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        return []
    boundary = uuid.uuid4().hex
    fields = [("model", "whisper-large-v3"), ("language", "sq"), ("response_format", "verbose_json"),
              ("timestamp_granularities[]", "word")]
    body = b"".join(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in fields)
    body += (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="clip.mp3"\r\n'
             "Content-Type: audio/mpeg\r\n\r\n").encode() + mp3 + f"\r\n--{boundary}--\r\n".encode()
    for _ in range(3):
        try:
            data = http_json(GROQ_STT, body, {"Authorization": f"Bearer {key}",
                                              "Content-Type": f"multipart/form-data; boundary={boundary}"}, timeout=120, tries=1)
            return [[float(w["start"]), float(w["end"]), str(w["word"]).strip()] for w in data.get("words", []) if str(w.get("word", "")).strip()]
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                time.sleep(20)
                continue
            return []
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
            return []
    return []


def norm(word: str) -> str:
    return re.sub(r"[^\w]", "", word.lower())


def align(script: str, heard: list[list], duration: float) -> list[list]:
    """The script's own words, each with the time it is said: [[start, end,
    word, pause_after]]. Matched to what Whisper heard where the two agree;
    words it heard differently (numbers above all) share the time of what it
    heard in their place; words it missed are placed between their
    neighbours. pause_after is 1 where the script has a comma or a stop."""
    tokens = script.split()
    if not tokens:
        return []
    times: list[list[float] | None] = [None] * len(tokens)
    a, b = [norm(t) for t in tokens], [norm(w[2]) for w in heard]
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = [heard[j1 + k][0], heard[j1 + k][1]]
        elif tag == "replace":
            start, end = heard[j1][0], heard[j2 - 1][1]
            spread(times, tokens, i1, i2, start, end)
    # What was never heard: between its neighbours, by length.
    k = 0
    while k < len(tokens):
        if times[k] is not None:
            k += 1
            continue
        j = k
        while j < len(tokens) and times[j] is None:
            j += 1
        start = times[k - 1][1] if k > 0 else 0.15
        end = times[j][0] if j < len(tokens) else max(start + 0.3 * (j - k), duration - 0.3)
        spread(times, tokens, k, j, start, max(end, start + 0.12 * (j - k)))
        k = j
    out, last = [], 0.0
    for tok, t in zip(tokens, times):
        start = max(last, t[0])
        end = max(start + 0.08, t[1])
        last = start
        word = tok.strip("\"'“”„«»()")
        word = re.sub(r"[,.;:!?]+$", "", word) or word
        out.append([round(start, 2), round(end, 2), word, 1 if re.search(r"[,.;:!?]$", tok) else 0])
    return out


def spread(times: list, tokens: list[str], i1: int, i2: int, start: float, end: float) -> None:
    sizes = [max(1, len(tokens[k])) for k in range(i1, i2)]
    total, at = sum(sizes), start
    for k, size in zip(range(i1, i2), sizes):
        step = (end - start) * size / total
        times[k] = [at, at + step]
        at += step


def voice_clip(script: str) -> dict | None:
    """{"mp3", "words", "duration", "voice"} or None."""
    wav = gemini_voice(script)
    if wav:
        mp3 = to_mp3(wav, ".wav")
        if mp3:
            duration = media_duration(mp3)
            heard = heard_words(mp3)
            if heard:
                return {"mp3": mp3, "words": align(script, heard, duration), "duration": duration, "voice": f"gemini:{GEMINI_VOICE}"}
            print("EDITION no word times for the Gemini voice; Microsoft's instead", file=sys.stderr)
    voiced = edge_voice(script)
    if not voiced:
        return None
    mp3, boundaries = voiced
    duration = media_duration(mp3)
    return {"mp3": mp3, "words": align(script, boundaries, duration), "duration": duration, "voice": f"edge:{EDGE_VOICE}"}


def media_duration(audio: bytes) -> float:
    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        f.write(audio)
        f.flush()
        try:
            out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f.name],
                                 capture_output=True, text=True, timeout=20, check=False).stdout.strip()
            return round(float(out), 2)
        except (OSError, ValueError, subprocess.TimeoutExpired):
            return 0.0


# ── The pictures ─────────────────────────────────────────────────────────────

def strip_html(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(text or ""))).strip()


def wiki_pages(titles: list[str]) -> dict[str, dict]:
    """English Wikipedia: each title's lead image, Wikidata id and coordinates."""
    titles = [t for t in dict.fromkeys(t.strip() for t in titles) if t][:8]
    if not titles:
        return {}
    q = urllib.parse.urlencode({"action": "query", "format": "json", "formatversion": "2", "redirects": "1",
                                "titles": "|".join(titles), "prop": "pageimages|pageprops|coordinates",
                                "piprop": "name", "ppprop": "wikibase_item", "coprop": "dim"})
    try:
        data = http_json(f"{WIKI}?{q}")
    except (urllib.error.URLError, TimeoutError, ValueError):
        return {}
    back = {}
    for r in (data.get("query") or {}).get("redirects", []) + (data.get("query") or {}).get("normalized", []):
        back[r.get("to")] = back.get(r.get("from"), r.get("from"))
    out = {}
    for page in (data.get("query") or {}).get("pages", []):
        if page.get("missing"):
            continue
        coords = (page.get("coordinates") or [{}])[0]
        info = {"title": page.get("title"), "image": page.get("pageimage", ""),
                "qid": (page.get("pageprops") or {}).get("wikibase_item", ""),
                "lat": coords.get("lat"), "lon": coords.get("lon"), "dim": coords.get("dim")}
        out[page.get("title")] = info
        if page.get("title") in back:
            out[back[page.get("title")]] = info
    return out


def depicting(qid: str, n: int = 3) -> list[str]:
    """Commons photos whose structured data says they show this item."""
    if not re.fullmatch(r"Q\d+", qid or ""):
        return []
    found: list[str] = []
    # Commons' own "quality images" first, then the newest uploads: a plain search
    # brings up old engravings and 19th-century plates as readily as today's photos.
    for extra, sort in ((" incategory:Quality_images", "relevance"), ("", "create_timestamp_desc")):
        q = urllib.parse.urlencode({"action": "query", "format": "json", "list": "search", "srnamespace": "6", "srlimit": str(n + 3),
                                    "srsort": sort, "srsearch": f"haswbstatement:P180={qid} filemime:image/jpeg{extra}"})
        try:
            data = http_json(f"{COMMONS}?{q}")
        except (urllib.error.URLError, TimeoutError, ValueError):
            continue
        found += [r["title"].removeprefix("File:") for r in (data.get("query") or {}).get("search", [])]
        if len(found) >= n:
            break
    return list(dict.fromkeys(found))[: n + 3]


def photo_info(files: list[str]) -> list[dict]:
    """Each file's 1280px rendition, creator and licence; only free, real photos."""
    files = [f for f in dict.fromkeys(files) if f and not NOT_A_PHOTO.search(f) and not SOMBRE.search(f) and re.search(r"(?i)\.jpe?g$", f)]
    out = []
    for i in range(0, len(files), 20):
        q = urllib.parse.urlencode({"action": "query", "format": "json", "formatversion": "2", "prop": "imageinfo",
                                    # 1920 wide: the rendered video fills an upright 1080x1920 frame with it.
                                    "iiprop": "url|size|extmetadata|mime", "iiurlwidth": "1920",
                                    "titles": "|".join("File:" + f for f in files[i:i + 20])})
        try:
            data = http_json(f"{COMMONS}?{q}")
        except (urllib.error.URLError, TimeoutError, ValueError):
            continue
        for page in (data.get("query") or {}).get("pages", []):
            ii = (page.get("imageinfo") or [{}])[0]
            meta = ii.get("extmetadata") or {}
            licence = strip_html((meta.get("LicenseShortName") or {}).get("value", ""))
            if not licence or NOT_FREE.search(licence) or not FREE.search(licence):
                continue
            if ii.get("mime") != "image/jpeg" or int(ii.get("width") or 0) < 900:
                continue
            creator = strip_html((meta.get("Artist") or {}).get("value", ""))[:80] or "Wikimedia Commons"
            out.append({"src": ii.get("thumburl") or ii.get("url"), "credit": f"{creator} · {licence}",
                        "page": ii.get("descriptionurl", ""), "file": page.get("title", "")})
    return out


def story_photos(story: dict, subjects: list[str], pages: dict[str, dict]) -> list[dict]:
    """The story's own photo first, then each subject's: its Wikipedia lead
    photo and a few more that show it. At most eight, none twice."""
    photos = []
    if story.get("imageUrl"):
        credit = " · ".join(x for x in (story.get("imageCreator"), story.get("imageLicense")) if x)
        photos.append({"src": story["imageUrl"], "credit": credit, "page": story.get("imageSourcePage", ""), "file": ""})
    files = []
    for name in subjects:
        page = pages.get(name) or {}
        if page.get("image"):
            files.append(page["image"])
        files += depicting(page.get("qid", ""), 2)
    seen = {re.sub(r"^\d+px-", "", p["src"].rsplit("/", 1)[-1]) for p in photos}
    for p in photo_info(files):
        name = re.sub(r"^\d+px-", "", p["src"].rsplit("/", 1)[-1])
        if name in seen:
            continue
        seen.add(name)
        photos.append(p)
    return photos[:8]


def map_image(lat: float, lon: float, dim: float | None) -> bytes | None:
    """A square map of the place (OpenStreetMap's standard tiles, a handful,
    fetched once and kept in storage), the place in the middle."""
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        size = float(dim or 0)  # Wikipedia gives it as text ("10000"), or not at all
    except (TypeError, ValueError):
        size = 0.0
    zoom = 6 if size > 200000 else 9 if size > 20000 else 11
    n = 2 ** zoom
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    tx, ty = int(x), int(y)
    canvas = Image.new("RGB", (768, 768), (240, 238, 232))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            try:
                tile = Image.open(io.BytesIO(http_bytes(f"https://tile.openstreetmap.org/{zoom}/{(tx + dx) % n}/{ty + dy}.png", 20)))
            except (urllib.error.URLError, TimeoutError, OSError):
                return None
            canvas.paste(tile.convert("RGB"), ((dx + 1) * 256, (dy + 1) * 256))
    px, py = (x - tx + 1) * 256, (y - ty + 1) * 256
    left = int(min(max(px - 320, 0), 768 - 640))
    top = int(min(max(py - 320, 0), 768 - 640))
    out = io.BytesIO()
    canvas.crop((left, top, left + 640, top + 640)).save(out, "JPEG", quality=82)
    return out.getvalue()


# ── Footage: the people's and institutions' own videos ───────────────────────

def exa_text(query: str, n: int = 10) -> str:
    """Agent Reach's search (Exa's keyless MCP endpoint), as text. The query
    has to name the platform: the keyless endpoint ignores includeDomains."""
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {
        "name": "web_search_exa", "arguments": {"query": query, "numResults": n}}}).encode()
    req = urllib.request.Request(EXA, data=body, method="POST", headers={
        **HEADERS, "Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            raw = res.read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, OSError):
        return ""
    texts = []
    for line in raw.splitlines():
        if line.startswith("data:"):
            try:
                msg = json.loads(line[5:])
            except ValueError:
                continue
            texts += [c.get("text", "") for c in (msg.get("result") or {}).get("content") or [] if isinstance(c, dict)]
    return "\n".join(texts)


def youtube_oembed(video_id: str) -> dict | None:
    """Title and channel, and whether the owner allows other sites to embed it."""
    try:
        return http_json(f"https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v={video_id}", timeout=10)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None


MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def posted_on(date_text: str, now: datetime) -> datetime | None:
    """YouTube's own date line: "Oct 16, 2026", "Streamed live on Nov 15"
    (this year, or last year if that day is still to come), "3 hours ago"."""
    rel = re.search(r"(\d+)\s*(minutes?|mins?|hours?|h|days?|d|weeks?|w|months?|mo|years?|y)\b\s*ago", date_text)
    if rel:
        n, unit = int(rel.group(1)), rel.group(2)
        days = {"h": n / 24, "d": n, "w": 7 * n, "m": 30 * n, "y": 365 * n}
        key = "m" if unit.startswith("mo") else "h" if unit.startswith("h") else unit[0]
        if unit.startswith("min"):
            return now - timedelta(minutes=n)
        return now - timedelta(days=days[key])
    m = re.search(r"([A-Z][a-z]{2})[a-z]*\.? (\d{1,2})(?:, (\d{4}))?", date_text)
    if not m or m.group(1).lower() not in MONTHS:
        return None
    year = int(m.group(3)) if m.group(3) else now.year
    try:
        when = datetime(year, MONTHS[m.group(1).lower()], int(m.group(2)), tzinfo=timezone.utc)
    except ValueError:
        return None
    if not m.group(3) and when > now + timedelta(days=1):
        when = when.replace(year=year - 1)
    return when


def youtube_posted(video_id: str, now: datetime) -> datetime | None:
    try:
        req = urllib.request.Request(f"https://www.youtube.com/watch?v={video_id}",
                                     headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en"})
        with urllib.request.urlopen(req, timeout=15) as res:
            html = res.read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    m = re.search(r'"(?:publishDate|dateText)":\{"simpleText":"([^"]+)"', html)
    return posted_on(m.group(1), now) if m else None


def walk_videos(node):
    if isinstance(node, dict):
        if "videoRenderer" in node:
            yield node["videoRenderer"]
        for v in node.values():
            yield from walk_videos(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk_videos(v)


def youtube_search(query: str, now: datetime) -> list[dict]:
    """YouTube's own search, uploads of this week only: id, channel, title and
    when it went up, as the results page shows them."""
    url = "https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": query, "sp": "EgIIAw=="})
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en"})
        with urllib.request.urlopen(req, timeout=20) as res:
            html = res.read().decode("utf-8", "replace")
        data = json.loads(re.search(r"var ytInitialData = (\{.*?\});</script>", html).group(1))
    except (urllib.error.URLError, TimeoutError, OSError, AttributeError, ValueError):
        return []
    out = []
    for v in walk_videos(data):
        runs = lambda key: ((v.get(key) or {}).get("runs") or [{}])[0].get("text", "")  # noqa: E731
        when = posted_on((v.get("publishedTimeText") or {}).get("simpleText", ""), now)
        if v.get("videoId") and when:
            out.append({"id": v["videoId"], "channel": runs("ownerText")[:80], "title": runs("title")[:160], "when": when})
    return out


def footage_candidates(queries: list[str], sources: list[str], subject: str | list[str] = "", limit: int = 14, max_age_days: int = 7) -> list[dict]:
    """YouTube videos of the event that other sites may embed, posted in the
    last week (an older one is a different occasion): YouTube's own search
    with a few short queries (short ones find far more than long ones), then
    Agent Reach's (Exa) when it answers."""
    subjects = [subject] if isinstance(subject, str) else list(subject)
    subjects = [re.sub(r"\s*\(.*?\)", "", s).strip() for s in subjects if s]
    queries = [re.sub(r"\s+", " ", re.sub(r"\b(20\d\d)\b", "", q)).strip() for q in queries if q]
    # The writer's searches can miss; the story's own names together always say who it is about.
    if len(subjects) >= 2:
        queries.append(f"{subjects[0]} {subjects[1]}")
    queries = [q for q in dict.fromkeys(queries) if q]
    if not queries:
        return []
    now = datetime.now(timezone.utc)
    query = queries[0]
    subject = subjects[0] if subjects else ""
    searches = queries[:4] + ([f"{s} {subject}" for s in sources[:2]] if subject else [])
    seen: dict[str, dict] = {}
    # Each search's top results in turn, so every search gets its best ones in.
    ranked = [youtube_search(q, now) for q in dict.fromkeys(searches)]
    for row in range(max((len(r) for r in ranked), default=0)):
        for results in ranked:
            if row < len(results):
                seen.setdefault(results[row]["id"], results[row])
    for vid in re.findall(r"youtube\.com/(?:watch\?v=|shorts/)([A-Za-z0-9_-]{11})", exa_text(f"site:youtube.com {query}")):
        if vid not in seen:
            when = youtube_posted(vid, now)
            if when:
                seen[vid] = {"id": vid, "channel": "", "title": "", "when": when}
    out = []
    # In the order the searches ranked them: the first results are the most relevant.
    for v in seen.values():
        if now - v["when"] > timedelta(days=max_age_days):
            continue
        o = youtube_oembed(v["id"])  # also: the owner lets other sites embed it
        if not (o and o.get("author_name") and o.get("title")):
            continue
        out.append({"id": v["id"], "channel": str(o["author_name"])[:80], "title": str(o["title"])[:160], "posted": v["when"].date().isoformat()})
        if len(out) >= limit:
            break
    return out


# ── Footage clips, cut for the rendered video ────────────────────────────────
# A few seconds of moving picture each, upright 1080x1920, no sound, credited
# on screen: first the people's and institutions' own YouTube videos of the
# event (through yt-dlp with a YouTube cookie: YouTube refuses the VPS
# without one), then freely licensed video of the story's people and places
# on Wikimedia Commons, then a Pexels shot of the city it happened in.

FOOT_DIR = os.environ.get("L383_EDITION_DIR", "/opt/data/video-edition")
YTDLP = os.environ.get("L383_EDITION_YTDLP", os.path.join(FOOT_DIR, "yt-dlp"))
YT_COOKIES = os.environ.get("L383_EDITION_YT_COOKIES", os.path.join(FOOT_DIR, "youtube-cookies.txt"))
SEGMENT = 4.6  # seconds cut; a beat shows up to 3.8 of them


# Two ways to put a wide video upright: filling the frame (close, punchy), or the whole
# picture across the middle over a dark, soft copy of itself (the whole play in view).
LAYOUTS = {
    "fill": "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920",
    "frame": ("split[a][b];[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10,"
              "scale=1080:1920,eq=brightness=-0.2:saturation=0.8[bg];[b]scale=1080:-2:flags=lanczos[fg];"
              "[bg][fg]overlay=0:(H-h)/2-140"),
}


def cut_segment(src: str, start: float, length: float, out: str, layout: str = "fill") -> bool:
    """A piece of a video (a file or a URL), upright, silent."""
    done = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-i", src, "-t", f"{length:.2f}",
                           "-vf", LAYOUTS.get(layout, LAYOUTS["fill"]) + ",fps=30,format=yuv420p",
                           "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", out],
                          capture_output=True, timeout=240, check=False)
    return done.returncode == 0 and os.path.exists(out) and os.path.getsize(out) > 30_000


def probe_duration(src: str) -> float:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                             capture_output=True, text=True, timeout=60, check=False).stdout.strip()
        return float(out)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return 0.0


CUT = 4.4  # seconds of each piece of the event's own video; a beat shows up to 3.1 of it (+0.7 under the next)
LONG = 900  # a video longer than this (a whole game, a full session) is fetched in pieces


def scene_cuts(path: str) -> list[float]:
    """Where the shots change: a piece starting just after one opens on a fresh shot."""
    try:
        done = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-vf", "scale=320:-2,select='gt(scene,0.3)',showinfo",
                               "-an", "-f", "null", "-"], capture_output=True, text=True, timeout=300, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return []
    return [float(t) for t in re.findall(r"pts_time:([\d.]+)", done.stderr)]


def pick_moments(length: float, cuts: list[float], n: int, piece: float = CUT) -> list[float]:
    """n starts spread across the video, past its intro and before its outro, each on a new
    shot where there is one near, none overlapping."""
    lo, hi = max(2.0, length * 0.06), length * 0.94 - piece
    if hi <= lo:
        return [max(0.0, (length - piece) / 2)] if length >= piece + 0.5 else []
    starts: list[float] = []
    reach = (hi - lo) / (2 * n)
    for j in range(n):
        target = lo + (hi - lo) * (j + 0.5) / n
        near = [c + 0.12 for c in cuts if lo <= c + 0.12 <= hi and abs(c + 0.12 - target) <= reach]
        s = min(near, key=lambda c: abs(c - target)) if near else target
        if all(abs(s - x) >= piece + 0.2 for x in starts):
            starts.append(round(s, 2))
    return starts


def youtube_clips(videos: list[dict], workdir: str, per_video: tuple[int, ...] = (7, 4)) -> list[dict]:
    """Pieces of the picked YouTube videos (the judge kept only primary sources): many short
    moments from across each, most filling the frame, every third showing the whole picture."""
    if not (videos and os.path.exists(YTDLP) and os.path.exists(YT_COOKIES)):
        return []
    out = []
    base = [YTDLP, "--cookies", YT_COOKIES, "--js-runtimes", "node", "--remote-components", "ejs:github", "--no-playlist", "--no-warnings", "-q"]
    fmt = ["-f", "bv*[height<=1080][vcodec^=avc1]/bv*[height<=1080]"]
    for vi, v in enumerate(videos[:len(per_video)]):
        url = f"https://www.youtube.com/watch?v={v['id']}"
        try:
            meta = json.loads(subprocess.run(base + ["-J", url], capture_output=True, text=True, timeout=120, check=False).stdout or "{}")
        except (OSError, ValueError, subprocess.TimeoutExpired):
            continue
        length = float(meta.get("duration") or 0)
        if length < 8:
            continue
        wide = float(meta.get("width") or 16) >= float(meta.get("height") or 9)
        credit = {"credit": f"Video: {v['channel']} · YouTube", "source": url, "youtube": v["id"], "channel": v["channel"]}

        def piece(src: str, at: float, n: int) -> None:
            seg = os.path.join(workdir, f"foot-yt-{v['id']}-{n}.mp4")
            layout = "frame" if wide and n % 3 == 2 else "fill"
            if cut_segment(src, at, CUT, seg, layout):
                out.append({"file": seg, "duration": CUT, "layout": layout, **credit})

        if length <= LONG:
            # The whole video once, then its moments cut from it.
            subprocess.run(base + fmt + ["-o", os.path.join(workdir, f"yt-{v['id']}.%(ext)s"), url],
                           capture_output=True, timeout=600, check=False)
            got = next((os.path.join(workdir, f) for f in os.listdir(workdir) if f.startswith(f"yt-{v['id']}.")), "")
            if not got:
                continue
            for n, at in enumerate(pick_moments(length, scene_cuts(got), per_video[vi])):
                piece(got, at, n)
        else:
            for n, at in enumerate(pick_moments(length, [], min(per_video[vi], 4))):
                subprocess.run(base + fmt + ["--download-sections", f"*{at:.1f}-{at + CUT + 1:.1f}",
                                             "-o", os.path.join(workdir, f"yt-{v['id']}-{n}.%(ext)s"), url],
                               capture_output=True, timeout=300, check=False)
                got = next((os.path.join(workdir, f) for f in os.listdir(workdir) if f.startswith(f"yt-{v['id']}-{n}.")), "")
                if got:
                    piece(got, 0.3, n)
    if videos and not out:
        print("EDITION youtube footage: none downloaded (cookie missing or refused)", file=sys.stderr)
    return out


def commons_clips(qids: list[str], workdir: str, limit: int = 1) -> list[dict]:
    """Freely licensed video on Wikimedia Commons that shows the story's people or places."""
    files: list[str] = []
    for qid in [q for q in qids if re.fullmatch(r"Q\d+", q or "")][:4]:
        q = urllib.parse.urlencode({"action": "query", "format": "json", "list": "search", "srnamespace": "6", "srlimit": "4",
                                    "srsearch": f"haswbstatement:P180={qid} filemime:video"})
        try:
            files += [r["title"] for r in (http_json(f"{COMMONS}?{q}").get("query") or {}).get("search", [])]
        except (urllib.error.URLError, TimeoutError, ValueError):
            continue
    out = []
    for title in dict.fromkeys(files):
        q = urllib.parse.urlencode({"action": "query", "format": "json", "formatversion": "2", "prop": "imageinfo",
                                    "iiprop": "url|extmetadata|size", "titles": title})
        try:
            ii = ((http_json(f"{COMMONS}?{q}").get("query") or {}).get("pages") or [{}])[0].get("imageinfo", [{}])[0]
        except (urllib.error.URLError, TimeoutError, ValueError, IndexError):
            continue
        meta = ii.get("extmetadata") or {}
        licence = strip_html((meta.get("LicenseShortName") or {}).get("value", ""))
        if not licence or NOT_FREE.search(licence) or not FREE.search(licence) or int(ii.get("height") or 0) < 480:
            continue
        length = probe_duration(ii.get("url", ""))
        if length < SEGMENT + 1:
            continue
        seg = os.path.join(workdir, f"foot-commons-{len(out)}.mp4")
        if cut_segment(ii["url"], min(length * 0.3, length - SEGMENT - 0.5), SEGMENT, seg):
            creator = strip_html((meta.get("Artist") or {}).get("value", ""))[:50] or "Wikimedia Commons"
            out.append({"file": seg, "credit": f"Video: {creator} · {licence}", "duration": SEGMENT, "source": ii.get("descriptionurl", "")})
        if len(out) >= limit:
            break
    return out


def pexels_clips(place: str, workdir: str) -> list[dict]:
    """A shot of the city the story happened in (never of people or of an event:
    a stock picture must not stand in for what happened)."""
    key = os.environ.get("PEXELS_API_KEY", "")
    token = norm(place.split(",")[0].split()[0]) if place else ""
    if not key or len(token) < 4:
        return []
    q = urllib.parse.urlencode({"query": f"{place.split(',')[0]} city", "per_page": "12", "size": "medium"})
    try:
        data = http_json(f"https://api.pexels.com/videos/search?{q}", headers={"Authorization": key})
    except (urllib.error.URLError, TimeoutError, ValueError):
        return []
    for v in data.get("videos", []):
        # The page's own words must name the city (its address carries the description).
        if token not in norm(v.get("url", "").replace("-", "")) or float(v.get("duration") or 0) < SEGMENT + 1:
            continue
        files = [f for f in v.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("link")]
        files.sort(key=lambda f: (-(min(f.get("width") or 0, f.get("height") or 0) >= 1080), abs((f.get("height") or 0) - 1920)))
        if not files:
            continue
        seg = os.path.join(workdir, f"foot-pexels-{v['id']}.mp4")
        if cut_segment(files[0]["link"], 1.0, SEGMENT, seg):
            name = str((v.get("user") or {}).get("name") or "Pexels")[:40]
            return [{"file": seg, "credit": f"Video: {name} · Pexels", "duration": SEGMENT, "source": v.get("url", "")}]
    return []


def gather_footage(picked: list[dict], qids: list[str], place: str, workdir: str, photos: int = 0) -> list[dict]:
    """The event's own video when there is any, and then nothing else: a clip of the game
    is the game, never the city around it. Without it, free video of the story's people
    and places; a stock shot of the city only when the story has no pictures at all."""
    found = youtube_clips(picked, workdir)
    if found:
        return found
    found = commons_clips(qids, workdir)
    if not found and not photos and place:
        found = pexels_clips(place, workdir)
    return found[:3]


SPORT_WORDS = re.compile(r"(?i)\b(ndeshj\w*|kampionat\w*|superlig\w*|basketboll\w*|futboll\w*|volejboll\w*|hendboll\w*|"
                         r"skuadr\w*|trajner\w*|lojtar\w*|golat|golin|pikë|çerek\w*|stadium\w*|palestr\w*|kupa\w*|ligë|ligën|ligës)(?!\w)")


def is_sport(story: dict) -> bool:
    """A match story, whatever section the newsroom filed it under (a game in Gjakova can be
    filed under Kosovë): the section says sport, or the story speaks of a game three times."""
    if "sport" in str(story.get("category") or "").lower():
        return True
    text = " ".join(str(story.get(k) or "") for k in ("title", "excerpt", "body"))
    return len(SPORT_WORDS.findall(text)) >= 3


# ── The beats ────────────────────────────────────────────────────────────────

MOVES = ["in", "left", "out", "right"]
PHOTO_BEAT = (2.4, 3.4)


def first_word_at(words: list[list], test) -> float | None:
    for w in words:
        if test(norm(w[2])):
            return w[0]
    return None


def snap(t: float, words: list[list], within: float = 0.6) -> float:
    """A cut lands on the start of a word, if one is near."""
    best = min((w[0] for w in words), key=lambda s: abs(s - t), default=t)
    return best if abs(best - t) <= within else t


def build_beats(duration: float, words: list[list], photos: list[dict], facts: list[dict],
                place: dict | None, quote: dict | None, footage: list[dict]) -> list[dict]:
    """What is on screen when: [{"at": seconds, "kind": ...}, ...], in order.
    Fixed moments first (a number when it is said, the map when the place is
    named, the people's own footage early on), photos in between, each shown
    3-4.5 seconds, taking the photos in turn (a story with one photo moves it
    a different way each time)."""
    if duration <= 0:
        return []
    fixed: list[tuple[float, float, dict]] = []

    def free(at: float, length: float) -> bool:
        return at >= 2.4 and at + length <= duration - 0.6 and all(at + length <= s or at >= s + l for s, l, _ in fixed)

    for f in facts[:2]:
        digits = re.findall(r"\d+", f["value"])
        at = first_word_at(words, lambda w, d=digits[0] if digits else "": bool(d) and d in w) if digits else None
        if at is not None and free(at - 0.15, 3.4):
            fixed.append((at - 0.15, 3.4, {"kind": "fact", "value": f["value"], "label": f["label"]}))
    # Plenty of the event's own video: it carries the clip, cut between the fixed moments.
    rich = len(footage) >= 3
    for k, v in enumerate([] if rich else footage[:3]):
        # Moving picture is the strongest a clip has: early, else wherever it fits.
        length = min(3.8, float(v.get("duration") or SEGMENT) - 0.8)
        spots = ([3.2] + [duration * f for f in (0.45, 0.32, 0.6, 0.22, 0.75)] if k == 0
                 else [duration * f for f in ((0.58, 0.3, 0.72, 0.85) if k == 1 else (0.78, 0.4, 0.66, 0.2))])
        for at in spots:
            at = snap(at, words)
            if free(at, length):
                fixed.append((at, length, {"kind": "video", "file": v.get("file", ""), "credit": v.get("credit", ""),
                                           "youtube": v.get("youtube", ""), "channel": v.get("channel", ""), "start": 2}))
                break
    if place and place.get("src"):
        stem = norm(place["label"])[:4]
        said = first_word_at(words, lambda w: len(stem) >= 3 and w.startswith(stem))
        # When the place is named; else, or if a number holds that moment, a free one.
        for at in ([said - 0.1] if said is not None else []) + [duration * f for f in (0.3, 0.45, 0.65, 0.2)]:
            at = snap(at, words, 0.3)
            if free(at, 3.2):
                fixed.append((at, 3.2, {"kind": "map", "src": place["src"], "label": place["label"], "credit": "© OpenStreetMap"}))
                break
    if quote:
        for at in (duration * 0.55, duration * 0.4, duration * 0.7):
            if free(at, 4.2):
                fixed.append((at, 4.2, {"kind": "quote", "text": quote["text"], "who": quote["who"]}))
                break
    fixed.sort(key=lambda x: x[0])

    beats: list[dict] = []
    k = 0
    shown = 0  # footage pieces used, in rich mode
    fills = 0

    def photo(at: float) -> dict:
        nonlocal k, shown, fills
        fills += 1
        if rich and (not photos or fills % 4):
            # A fresh moment of the event each time; only when all are used, one again.
            v = footage[shown % len(footage)]
            shown += 1
            return {"at": round(at, 2), "kind": "video", "file": v.get("file", ""), "credit": v.get("credit", ""),
                    "youtube": v.get("youtube", ""), "channel": v.get("channel", ""), "start": 2}
        if not photos and footage:
            # No photo of the story: its footage again, from a little further in, rather than a blank screen.
            v = footage[k % len(footage)]
            k += 1
            return {"at": round(at, 2), "kind": "video", "file": v.get("file", ""), "credit": v.get("credit", ""),
                    "youtube": v.get("youtube", ""), "channel": v.get("channel", ""), "start": 2, "media": 0.8 * (k % 2)}
        if not photos:
            return {"at": round(at, 2), "kind": "plain"}
        p = photos[k % len(photos)]
        b = {"at": round(at, 2), "kind": "photo", "src": p["src"], "credit": p.get("credit", ""), "move": MOVES[k % len(MOVES)]}
        k += 1
        return b

    t = 0.0
    for start, length, beat in fixed + [(duration, 0, None)]:
        # Photos until the next fixed moment, the gap cut into 3-4.4 s pieces.
        gap = start - t
        if gap > 0.05:
            # Footage cuts quicker than photos (and a piece is only CUT seconds long).
            size, longest = (2.5, 3.1) if rich else (2.9, PHOTO_BEAT[1] + 0.6)
            pieces = max(1, round(gap / size))
            while gap / pieces > longest:
                pieces += 1
            for p in range(pieces):
                at = t + gap * p / pieces
                beats.append(photo(snap(at, words, 0.4) if p else at))
        if beat:
            beats.append({"at": round(start, 2), **beat})
            t = start + length
    return beats


# ── The graphics over the picture ────────────────────────────────────────────
# Laid over photos and footage (the picture keeps moving underneath), each when
# what it shows is said: a scoreboard, a comparison, a name tag, a timeline, and
# the climax's words slammed across the screen. Never over a number, quote or
# map card, never two at once; after a scoreboard, a small score stays in the corner.

def _said_number(words: list[list], value: str) -> float | None:
    digits = re.findall(r"\d+", str(value))
    return first_word_at(words, lambda w, d=digits[0]: d in w) if digits else None


def _said_name(words: list[list], name: str) -> float | None:
    toks = [norm(t) for t in str(name).split() if len(norm(t)) >= 3]
    if not toks:
        return None
    stem = toks[-1][: max(4, len(toks[-1]) - 2)]
    return first_word_at(words, lambda w: w.startswith(stem))


def build_overlays(beats: list[dict], duration: float, words: list[list], graphics: list[dict],
                   climax: tuple[float, float] | None = None) -> list[dict]:
    ends = [b["at"] for b in beats[1:]] + [duration]
    cards = [(b["at"], ends[k]) for k, b in enumerate(beats) if b["kind"] in ("fact", "quote", "map")]
    taken = list(cards)
    out: list[dict] = []

    def free(at: float, length: float) -> bool:
        return at >= 2.6 and at + length <= duration - 0.3 and all(at + length + 0.25 <= s or at >= e + 0.25 for s, e in taken)

    def place(spots: list[float | None], length: float, item: dict) -> bool:
        for at in spots:
            if at is None:
                continue
            snapped = round(snap(at, words, 0.3), 2)
            at = snapped if free(snapped, length) else round(at, 2)
            if free(at, length):
                taken.append((at, at + length))
                out.append({"at": at, "len": round(length, 2), **item})
                return True
        return False

    later = [duration * f for f in (0.3, 0.5, 0.65, 0.42, 0.78, 0.22)]
    score = None
    # The climax first: the moment the clip builds to gets its words across the screen.
    if climax and climax[0] > 3.0:
        cw = [[w[0], w[2]] for w in words if climax[0] - 0.01 <= w[0] <= climax[1]]
        if 2 <= len(cw) <= 6:
            place([climax[0] - 0.08], min(2.8, max(1.8, climax[1] - climax[0] + 0.7)), {"kind": "slam", "words": cw})
    for g in graphics:
        kind = g.get("type")
        if kind == "score" and not score:
            said = _said_number(words, g["teams"][0]["score"])
            # Said in the opening line, it comes in as soon as the headline has gone.
            early = [said - 0.2, max(2.7, said - 0.2)] if said is not None else [2.7]
            if place(early + later, 3.8, {"kind": "score", "teams": g["teams"], "note": g.get("note", "")}):
                score = out[-1]
        elif kind == "compare":
            said = _said_number(words, g["items"][0]["value"])
            # Never before its numbers are said.
            spots = [said - 0.2] + [t for t in later if t >= said - 0.2] if said is not None else later
            place(spots, 3.4, {"kind": "compare", "label": g.get("label", ""), "items": g["items"]})
        elif kind == "person" and sum(o["kind"] == "person" for o in out) < 2:
            said = _said_name(words, g["name"])
            if said is not None:
                place([said - 0.05, said + 0.6], 2.6, {"kind": "person", "name": g["name"], "role": g.get("role", "")})
        elif kind == "timeline":
            length = min(5.6, 1.4 + 1.3 * len(g["steps"]))
            place([duration * f for f in (0.45, 0.3, 0.6)], length, {"kind": "timeline", "steps": g["steps"]})
    if score:
        # The score stays in the corner afterwards, out of the way of the cards and the other graphics.
        t = score["at"] + score["len"]
        for s, e in sorted(taken) + [(duration + 1, duration + 1)]:
            if e <= t:
                continue
            if s - t > 2.2:
                out.append({"at": round(t + 0.1, 2), "len": round(min(s, duration + 0.5) - t - 0.2, 2), "kind": "bug", "teams": score["teams"]})
            t = max(t, e)
    return sorted(out, key=lambda o: o["at"])
