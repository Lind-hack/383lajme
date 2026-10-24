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
import html
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


def http_bytes(url: str, timeout: int = 30, tries: int = 3) -> bytes:
    """The bytes at url, tried again (more slowly) when the server is busy or throttling: Wikimedia
    refuses bursts of large thumbnails now and then, and a clip then lost all its people's photos."""
    last: Exception | None = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=timeout) as res:
                return res.read()
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (429, 500, 502, 503, 504):
                break
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
        if attempt + 1 < tries:
            time.sleep(2.0 * (attempt + 1))
    if "/1920px-" in url:
        # A size Wikimedia will not make right now: its smaller standard one.
        return http_bytes(url.replace("/1920px-", "/1280px-"), timeout, 2)
    raise last or OSError(f"no answer from {url}")


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
    """Plain text: no tags, and "&amp;" read as "&" (Commons credits carry both)."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", str(text or "")))).strip()


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
            # What the photo says it shows: its name, description and categories.
            about = " ".join([page.get("title", ""), strip_html((meta.get("ImageDescription") or {}).get("value", ""))[:600],
                              str((meta.get("Categories") or {}).get("value", ""))[:600], strip_html((meta.get("ObjectName") or {}).get("value", ""))])
            out.append({"src": ii.get("thumburl") or ii.get("url"), "credit": f"{creator} · {licence}",
                        "page": ii.get("descriptionurl", ""), "file": page.get("title", ""), "about": about})
    return out


def story_photos(story: dict, subjects: list[str], pages: dict[str, dict]) -> list[dict]:
    """The story's own photo first, then each subject's: its Wikipedia lead photo, and for a
    person or an organisation a couple more that show it. A place (anything with coordinates:
    a country, a city, a building) gets its lead photo only: "photos that show Russia" are
    any photo taken there (a mosque ceiling, a plant, a mine), not the story. Each photo
    knows whose it is ("who"), so it can come up when that name is said. At most eight."""
    photos = []
    if story.get("imageUrl"):
        credit = " · ".join(x for x in (story.get("imageCreator"), story.get("imageLicense")) if x)
        photos.append({"src": story["imageUrl"], "credit": credit, "page": story.get("imageSourcePage", ""), "file": "", "who": ""})
    files: list[tuple[str, str]] = []
    lead: set[str] = set()
    for name in subjects:
        page = pages.get(name) or {}
        if page.get("image"):
            files.append((page["image"], name))
            lead.add(page["image"].replace("_", " "))
        if page.get("lat") is None:
            files += [(f, name) for f in depicting(page.get("qid", ""), 4)[:4]]
    whose = {f.replace("_", " "): who for f, who in files}
    seen = {re.sub(r"^\d+px-", "", p["src"].rsplit("/", 1)[-1]) for p in photos}
    series = {photo_series(p["src"]) for p in photos}
    for p in photo_info([f for f, _ in files]):
        name = re.sub(r"^\d+px-", "", p["src"].rsplit("/", 1)[-1])
        if name in seen:
            continue
        seen.add(name)
        # Frames of one shoot ("Edi Rama, press conference, ITB 2015 (2)", "... (5)") look the same
        # on screen: one of each, or the clip seems to show the same picture over and over.
        if photo_series(p.get("file") or p["src"]) in series:
            continue
        series.add(photo_series(p.get("file") or p["src"]))
        key = p.get("file", "").removeprefix("File:").replace("_", " ")
        p["who"] = whose.get(key, "")
        # A Commons tag can be wrong ("shows Renew Europe" on a banana seller in Aboisso): a photo
        # found by its tag must also name its subject in its title, description or categories.
        if key not in lead and p["who"] and not names_subject(p.get("about", ""), p["who"]):
            continue
        if sum(1 for q in photos if q.get("who") == p["who"] and p["who"]) >= 3:
            continue  # three of one subject at most
        photos.append(p)
    return photos[:8]


def photo_series(src: str) -> str:
    """A photo's name without its numbers, size prefix and extension: frames of one shoot share it."""
    name = urllib.parse.unquote(str(src or "").split("?")[0].rsplit("/", 1)[-1]).removeprefix("File:")
    name = re.sub(r"^\d+px-", "", name)
    name = re.sub(r"\.(jpe?g|png|webp)$", "", name, flags=re.I)
    name = re.sub(r"\(.*?\)|\d+", " ", name.lower())
    return " ".join(re.findall(r"[^\W\d_]+", name))


def names_subject(text: str, subject: str) -> bool:
    """The text mentions the subject: one of its telling words (first five letters, so "Weber"
    meets "Weberit"), or for a name of short words only ("EPP", "S&D"), one of them whole."""
    have = {norm(w) for w in re.findall(r"[\w'-]+", text.lower())}
    stems = {w[:5] for w in have if len(w) >= 4}
    words = [norm(w) for w in re.findall(r"[\w'-]+", re.sub(r"\s*\(.*?\)", "", subject).lower()) if norm(w)]
    strong = [w for w in words if len(w) >= 4 and w not in GENERIC]
    if strong:
        return any(w[:5] in stems for w in strong)
    return any(w in have for w in words if len(w) >= 2)


# Words that name a kind of body, not which one: "Bangladesh Air Force" is not "Kosovo Security Force".
GENERIC = {"party", "group", "union", "european", "national", "republic", "the", "and", "for", "of",
           "security", "force", "forces", "army", "ministry", "office", "police", "council", "court", "city",
           "municipality", "government", "state", "people", "democratic", "assembly", "agency", "bank", "service",
           "department", "committee", "organization", "organisation", "international", "federation", "association",
           "chamber", "chambers", "specialist", "football", "club", "league", "university", "airport", "news"}


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
SEGMENT = 5.0  # seconds cut; a beat shows up to 4.0 of them (+0.7 under the next)


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


def youtube_clips(videos: list[dict], workdir: str, per_video: tuple[int, ...] = (7, 4, 3)) -> list[dict]:
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
        credit = {"credit": f"Video: {v['channel']} · YouTube", "source": url, "youtube": v["id"], "channel": v["channel"],
                  "keys": list(v.get("keys") or [])}

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
    return commons_cut(list(dict.fromkeys(files)), workdir, limit)


def commons_cut(files: list[str], workdir: str, limit: int) -> list[dict]:
    """A piece of each Commons video that is free, sharp enough and long enough."""
    out = []
    for title in files:
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
        seg = os.path.join(workdir, f"foot-commons-{abs(hash(title)) % 10**8}.mp4")
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


# ── B-roll: the thing being talked about, filmed anywhere ───────────────────
# When the event's own video is not there (for most Kosovo and Albania stories every YouTube
# result is a TV outlet, which 383 never uses), a shot of what the voice is talking about:
# a courtroom while it speaks of the court, police lights while it speaks of an arrest. From
# free stock libraries (Pexels, Pixabay: their licences allow it, credited on screen) and
# freely licensed Commons video, always marked "Pamje ilustruese", so nobody takes a stock
# shot for the event itself. Each shot must say in its own description what it was searched
# for, and none is used twice in one edition.

USED_STOCK: set[str] = set()
STOCK_LABEL = "Pamje ilustruese"
STOCK_STOP = {"with", "the", "and", "for", "from", "into", "over", "near", "a", "an", "of", "in", "on", "at", "to", "video", "footage", "shot"}

# What a story speaks of (its Albanian words) -> what a camera films. Used when the writer gave
# no searches of its own, or too few; the first matching rules win.
BROLL_HINTS: list[tuple[str, tuple[str, ...]]] = [
    (r"gjykat|gjyq|aktakuz|prokuror|paraburgim|dënua|dënim", ("courtroom", "judge gavel")),
    (r"arrest|polic|ndalua|ndaloi|hetim", ("police car lights", "police officers street")),
    (r"zjarr|djeg|flak", ("fire flames night", "firefighters")),
    (r"aksident|përplas", ("ambulance lights", "car accident road")),
    (r"kuvend|parlament|deputet|seancë plenare|projektligj", ("parliament session", "politicians voting")),
    (r"zgjedhj|votim|votues|fushat", ("voting ballot box", "election campaign crowd")),
    (r"gjob|inspekt", ("inspector clipboard", "restaurant kitchen inspection")),
    (r"shkoll|nxënës|mësues|maturant|universitet|student", ("school classroom", "students walking campus")),
    (r"spital|mjek|pacient|shëndet|sëmund|vaksin", ("hospital corridor", "doctor stethoscope")),
    (r"ushtr|rekrut|ushtar|betohen|fsk\b|mbrojtj", ("soldiers marching", "military training")),
    (r"dron", ("military drone",)),
    (r"tajfun|uragan|stuhi|përmbytj|reshje|vërshim", ("storm waves", "heavy rain flood")),
    (r"tërmet", ("earthquake damage",)),
    (r"naft|karburant|benzin", ("gas station fuel pump",)),
    (r"rrym|energji|elektrik", ("power lines", "electricity pylons")),
    (r"inflacion|çmim|shtrenjt|ekonomi|bank|kredi|bursë|investim|miliard", ("money counting", "stock market screen")),
    (r"pesticid|bujq|fermer", ("tractor spraying field", "farmer field")),
    (r"turist|turiz|pushim|plazh", ("tourists city street", "beach summer")),
    (r"aeroport|fluturim|avion|aviacion", ("airplane takeoff", "airport terminal")),
    (r"kufi|pasaport|viz[ëa]", ("border checkpoint", "passport control")),
    (r"protest|demonstrues|marshim", ("protest crowd",)),
    (r"autostrad|infrastruktur|trafik", ("highway traffic", "road construction")),
    (r"ndërtim|banes|urbanist", ("construction site crane",)),
    (r"burg", ("prison bars",)),
    (r"drog|kanabis|narkotik|kokain", ("cannabis plants", "police drugs seizure")),
    (r"emigr|azil|refugj|diaspor", ("refugees walking", "airport arrivals hall")),
    (r"thatësir|ujësjellës", ("water tap", "dry cracked land")),
    (r"inteligjenc[ëe] artificiale|çip|teknologj|kompjuter|softuer", ("computer chips", "data center servers")),
    (r"aplikacion|rrjete sociale|tiktok|instagram", ("smartphone scrolling",)),
    (r"futboll|ndeshj|stadium", ("football stadium crowd", "soccer ball goal")),
    (r"basketboll", ("basketball game",)),
    (r"tenis", ("tennis match",)),
]


def broll_terms(text: str, written: list[str] | None = None, limit: int = 4) -> list[dict]:
    """What to search the stock libraries for: the writer's own searches ("courtroom | gjykata":
    the English search, then the word in the script it goes with), then the story's own words
    through BROLL_HINTS. Each: {"q": English search, "said": [Albanian words]}."""
    out: list[dict] = []
    for item in written or []:
        q, _, said = str(item).partition("|")
        q = re.sub(r"[^\w\s-]", " ", q).strip().lower()
        if 2 <= len(q) <= 40 and len(q.split()) <= 4:
            out.append({"q": q, "said": [w for w in re.findall(r"[\wçë]+", said.lower()) if len(w) >= 4][:2]})
    low = text.lower()
    matched = []
    for pattern, queries in BROLL_HINTS:
        m = re.search(r"(?<![\wçë])(?:" + pattern + ")", low)
        if m:
            matched.append((m.start(), re.match(r"[\wçë]+", low[m.start():]).group(0), queries))
    # What the story speaks of first is what it is about (the headline comes first): one shot of
    # each thing before a second of any.
    matched.sort(key=lambda x: x[0])
    for n in range(2):
        out += [{"q": queries[n], "said": [said]} for _, said, queries in matched if n < len(queries)]
    seen, best = set(), []
    for t in out:
        if t["q"] not in seen:
            seen.add(t["q"])
            best.append(t)
    return best[:limit]


def stock_fits(query: str, described: str) -> bool:
    """The shot's own description says what was searched for: every telling word of the search
    (its first 4 letters, so "police" meets "policeman"), or all but one when there are three."""
    have = {w[:4] for w in re.findall(r"[a-z]+", described.lower()) if len(w) >= 3}
    want = [w[:4] for w in re.findall(r"[a-z]+", query.lower()) if len(w) >= 3 and w not in STOCK_STOP]
    if not want:
        return False
    hits = sum(w in have for w in want)
    return hits == len(want) or (len(want) >= 3 and hits >= len(want) - 1)


def _stock_piece(link: str, key: str, wide: bool, credit: str, source: str, said: list[str], workdir: str) -> dict | None:
    seg = os.path.join(workdir, f"foot-stock-{abs(hash(key)) % 10**9}.mp4")
    layout = "frame" if wide else "fill"
    if cut_segment(link, 1.0, SEGMENT, seg, layout):
        USED_STOCK.add(key)
        return {"file": seg, "credit": credit, "duration": SEGMENT, "layout": layout, "source": source, "said": said, "stock": True}
    return None


def pexels_broll(term: dict, workdir: str) -> dict | None:
    key = os.environ.get("PEXELS_API_KEY", "")
    if not key:
        return None
    # Upright first (it fills the phone without a crop); a wide shot only when no upright one fits.
    for orientation in ("portrait", "landscape"):
        q = urllib.parse.urlencode({"query": term["q"], "per_page": "15", "orientation": orientation, "size": "medium"})
        try:
            data = http_json(f"https://api.pexels.com/videos/search?{q}", headers={"Authorization": key})
        except (urllib.error.URLError, TimeoutError, ValueError):
            return None
        for v in data.get("videos", []):
            sid = f"pexels:{v.get('id')}"
            # The page's address carries its description: ".../video/police-car-lights-at-night-1234/".
            if sid in USED_STOCK or not stock_fits(term["q"], v.get("url", "").replace("-", " ")):
                continue
            if float(v.get("duration") or 0) < SEGMENT + 1.5:
                continue
            files = [f for f in v.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("link")]
            files.sort(key=lambda f: (-(min(f.get("width") or 0, f.get("height") or 0) >= 1080),
                                      abs(max(f.get("width") or 0, f.get("height") or 0) - 1920)))
            if not files:
                continue
            wide = (files[0].get("width") or 0) > (files[0].get("height") or 0)
            name = str((v.get("user") or {}).get("name") or "Pexels")[:40]
            got = _stock_piece(files[0]["link"], sid, wide, f"{STOCK_LABEL} · {name} · Pexels", v.get("url", ""), term["said"], workdir)
            if got:
                return got
    return None


def pixabay_broll(term: dict, workdir: str) -> dict | None:
    key = os.environ.get("PIXABAY_API_KEY", "")
    if not key:
        return None
    q = urllib.parse.urlencode({"key": key, "q": term["q"], "per_page": "20", "safesearch": "true"})
    try:
        data = http_json(f"https://pixabay.com/api/videos/?{q}")
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    for v in data.get("hits", []):
        sid = f"pixabay:{v.get('id')}"
        if sid in USED_STOCK or not stock_fits(term["q"], str(v.get("tags", ""))) or float(v.get("duration") or 0) < SEGMENT + 1.5:
            continue
        sizes = v.get("videos") or {}
        f = next((sizes[k] for k in ("large", "medium") if (sizes.get(k) or {}).get("url") and (sizes[k].get("height") or 0) >= 720), None)
        if not f:
            continue
        got = _stock_piece(f["url"], sid, (f.get("width") or 0) > (f.get("height") or 0),
                           f"{STOCK_LABEL} · {str(v.get('user') or 'Pixabay')[:40]} · Pixabay", v.get("pageURL", ""), term["said"], workdir)
        if got:
            return got
    return None


def commons_broll(term: dict, workdir: str) -> dict | None:
    """Freely licensed Commons video whose own name says what was searched for (no key needed)."""
    q = urllib.parse.urlencode({"action": "query", "format": "json", "list": "search", "srnamespace": "6", "srlimit": "8",
                                "srsearch": f"filemime:video {term['q']}"})
    try:
        rows = (http_json(f"{COMMONS}?{q}").get("query") or {}).get("search", [])
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    titles = [r["title"] for r in rows if f"commons:{r['title']}" not in USED_STOCK and stock_fits(term["q"], r["title"].replace("_", " "))
              and not SOMBRE.search(r["title"])][:3]
    for title in titles:
        got = commons_cut([title], workdir, 1)
        if got:
            USED_STOCK.add(f"commons:{title}")
            got[0].update(credit=f"{STOCK_LABEL} · " + got[0]["credit"].removeprefix("Video: "), said=term["said"], stock=True)
            return got[0]
    return None


def broll_clips(terms: list[dict], workdir: str, limit: int = 4) -> list[dict]:
    """One shot per search, from the first library that has a fitting one."""
    out = []
    if not (os.environ.get("PEXELS_API_KEY") or os.environ.get("PIXABAY_API_KEY")):
        print("EDITION b-roll: no PEXELS_API_KEY or PIXABAY_API_KEY, Commons only", file=sys.stderr)
    for term in terms:
        if len(out) >= limit:
            break
        for source in (pexels_broll, pixabay_broll, commons_broll):
            try:
                got = source(term, workdir)
            except Exception as exc:  # one library misbehaving must not stop the clip
                print(f"EDITION b-roll {source.__name__} failed ({exc!r})", file=sys.stderr)
                got = None
            if got:
                out.append(got)
                break
    return out


def gather_footage(picked: list[dict], qids: list[str], place: str, workdir: str, photos: int = 0,
                   names: list[str] | None = None, broll: list[dict] | None = None, sport: bool = False) -> list[dict]:
    """Moving picture, the strongest a clip has, in this order: the event's own video (the
    people's and institutions' YouTube uploads, then this week's free Commons video of them),
    free video of the story's people and places, then b-roll of what the story speaks of, up
    to about six shots in all. A game with its own video is only the game: no stock shots."""
    found = youtube_clips(picked, workdir)
    if len(found) < 3:
        found += commons_recent(names or [], workdir)
    if sport and len(found) >= 3:
        return found
    if len(found) < 3:
        found += commons_clips(qids, workdir)
    want = 6 - len(found)
    if want > 0 and broll:
        found += broll_clips(broll, workdir, min(4, want))
    if not found and not photos and place:
        found = pexels_clips(place, workdir)
    return found


SPORT_WORDS = re.compile(r"(?i)\b(ndeshj\w*|kampionat\w*|superlig\w*|basketboll\w*|futboll\w*|volejboll\w*|hendboll\w*|"
                         r"skuadr\w*|trajner\w*|lojtar\w*|golat|golin|pikë|çerek\w*|stadium\w*|palestr\w*|kupa\w*|ligë|ligën|ligës)(?!\w)")


# ── Official channels: straight to the people who were there ─────────────────
# Each checked by hand (verified badge, or plainly the institution's own account): YouTube's
# channel search alone brings up fan and fake channels for "Zelenskyy" or "Kurti". A story
# that speaks of one of them has that channel's newest uploads read directly, so the video
# the White House or the federation posted of the event is found even when a general search
# buries it under news outlets.
OFFICIAL_CHANNELS: list[tuple[str, str, tuple[str, ...]]] = [
    ("UCYxRlFDqcWM4y7FfpiAN3KQ", "The White House", ("trump", "shtëpia e bardhë", "shtëpisë së bardhë", "white house", "vance", "leavitt")),
    ("UC6ZhpmNnLxlOYipqh8wbM3A", "U.S. Department of State", ("rubio", "departamenti i shtetit", "departamentit të shtetit", "state department")),
    ("UCpuofAxlrUAgnu7QEwKQwxw", "U.S. Department of War", ("pentagon", "hegseth", "departamenti i luftës", "departamenti i mbrojtjes")),
    ("UCncq73xfx9sVA3Ht2uVRrCw", "Office of the President of Ukraine", ("zelensk", "zelenski", "presidenti ukrainas")),
    ("UCp2zBKrqP0ZQF6RN4RJtF2Q", "Zelenskyy President", ("zelensk", "zelenski", "presidenti ukrainas")),
    ("UCHlEaKbepQ_S9iIoZPKVQew", "NATO", ("nato", "rutte", "aleanca veriatlantike")),
    ("UCMPaviJxybo1RTdzvYcU91A", "European Commission", ("komisioni evropian", "komisionit evropian", "von der leyen", "kallas")),
    ("UCvU4p_w08osQsrNi_I4ZtDA", "European Parliament", ("parlamenti evropian", "parlamentit evropian", "metsola")),
    ("UCLPG_xkgSWeWnOhBsi-jxCA", "Council of the EU", ("këshilli evropian", "këshillit evropian", "antónio costa", "antonio costa")),
    ("UC5O114-PQNYkurlTg6hekZw", "United Nations", ("kombet e bashkuara", "kombeve të bashkuara", "guterres", "këshilli i sigurimit")),
    ("UCawNWlihdgaycQpO3zi-jYg", "Israel Defense Forces", ("ushtria izraelite", "ushtrisë izraelite", "idf")),
    ("UCcnFmkINMo4Jmkx5mvlCh6g", "Bundesregierung", ("merz", "qeveria gjermane", "kancelari gjerman")),
    ("UCPaeEhnVIdn4T01gUphIltw", "Élysée", ("macron", "presidenti francez")),
    ("UC8o7mIMg3mmO9-dx3e2iFgw", "10 Downing Street", ("starmer", "kryeministri britanik", "downing street")),
    ("UCLA_DiR1FfKNvjuUpBHmylQ", "NASA", ("nasa", "artemis")),
    ("UCx3ZnEUEVC4bZcqYYsTTpAg", "Zyra e Kryeministrit të Kosovës", ("kurti", "kryeministri i kosovës", "qeveria e kosovës", "qeverisë së kosovës")),
    ("UCpgAmi6MlkRO-4GDHUlHKnA", "Lëvizja Vetëvendosje", ("vetëvendosje", "kurti")),
    ("UC4Xc2nL2i8Pu3PL_tljnjjg", "Kuvendi i Republikës së Kosovës", ("kuvendi i kosovës", "kuvendit të kosovës", "deputetët", "seanca")),
    ("UCk760jgRKgAvftBlGAQmuMA", "Vjosa Osmani", ("osmani", "presidentja")),
    ("UC_l2qmM0mXkq5pOBEp3j2dw", "Edi Rama", ("rama", "kryeministri i shqipërisë", "qeveria shqiptare")),
    ("UCSZa3itQ9eG9FZJIFb0Tubg", "Partia Demokratike e Shqipërisë", ("berisha", "partia demokratike", "pd-ja", "opozita shqiptare")),
    ("UCzeT6tNab6BQ38KZvvNYyKA", "Federata e Futbollit e Kosovës", ("ffk", "dardanët", "kombëtarja e kosovës", "superliga e kosovës")),
    ("UCftIBC9eGA55-o0f6tOVLpQ", "FSHF", ("fshf", "kombëtarja shqiptare", "kombëtarja kuqezi", "kuqezinjtë")),
    ("UCpU_nXypDcGaWCliQE0NV7w", "Federata e Basketbollit e Kosovës FBK", ("basketboll", "fbk")),
    ("UCyGa1YEx9ST66rYrJTGIKOw", "UEFA", ("uefa", "liga e kampionëve", "champions league", "liga e evropës", "liga e konferencës")),
    ("UCpcTrCXblq78GZrTUTLWeBw", "FIFA", ("fifa", "kupa e botës", "botërori")),
    # Added 2026-10-24, each checked the same way (the institution's own account, posting this
    # month): Kosovo's and Albania's own institutions first, the newsroom's most common stories.
    ("UCSi9E_FEvv5Fb0W0WA4DVOw", "Ministria e Mbrojtjes e Kosovës", ("fsk", "maqedonci", "forca e sigurisë", "forcës së sigurisë",
                                                                     "ministria e mbrojtjes së kosovës", "ministrisë së mbrojtjes")),
    ("UCqpmNXbs4ZQMt7FBBVmGung", "Policia e Kosovës", ("policia e kosovës", "policisë së kosovës", "policia kosovare")),
    ("UCsAnh_Iv_beYv8CoO1aphYQ", "NATO KFOR", ("kfor",)),
    ("UCxqi22Ew8nU-DkpgFc5sk2w", "EULEX Kosovo", ("eulex",)),
    ("UCkkaSND-BvlIw9Wgv4P1ulw", "European Union in Kosovo", ("zyra e be", "zyrës së be", "bashkimi evropian në kosovë", "aivo orav")),
    ("UC3B_yRiREiV2YaYVtd1jkHg", "U.S. Embassy Pristina", ("ambasada amerikane", "ambasadës amerikane", "ambasadori amerikan", "ambasadorit amerikan")),
    ("UCrf9kF4uiN40wXbeq7_pehA", "Partia Demokratike e Kosovës", ("pdk", "bedri hamza", "partia demokratike e kosovës")),
    ("UCSEjecdXlJWuzDz2FluIbBw", "Policia e Shtetit", ("policia e shtetit", "policisë së shtetit", "policia shqiptare", "policisë shqiptare")),
    ("UC-lFCv9oCDYUbVi7GJa78FQ", "Kuvendi i Shqipërisë", ("kuvendi i shqipërisë", "kuvendit të shqipërisë", "parlamenti shqiptar", "parlamentit shqiptar")),
    ("UCqaj6EAn7Q22kQvVvW3ACPg", "Ministria e Mbrojtjes (Shqipëri)", ("ministria e mbrojtjes së shqipërisë", "forcat e armatosura", "ushtria shqiptare", "ushtrisë shqiptare", "pirro vengu")),
    ("UCvq_-EH6c3LeBCay5o9LESg", "Aleksandar Vučić", ("vuçiq", "vučić", "vucic", "presidenti serb")),
    ("UCZkiUDyOBtkaTWGRfGnKaHw", "Kremlin", ("putin", "kremlin")),
    ("UCfIsGtgdMS2bw--CF9W8wGA", "Ministry of Foreign Affairs of Ukraine", ("sybiha", "sibiha")),
    ("UCw6E9hgCbubPf_IsofVkiqg", "EEAS", ("eeas", "shërbimi evropian i jashtëm")),
    ("UCXB8fM4VyQubRu3UVGhd3wA", "European Central Bank", ("banka qendrore evropiane", "bankës qendrore evropiane", "bqe", "lagarde")),
    ("UCIYhr3JsLYfKkCM7-W5B6DA", "IMF", ("fmn", "fondi monetar", "fondit monetar", "georgieva")),
    ("UCE9mrcoX-oE-2f1BL-iPPoQ", "World Bank Group", ("banka botërore", "bankës botërore", "ajay banga")),
    ("UC07-dOwgza1IguKA86jqxNA", "World Health Organization", ("obsh", "organizata botërore e shëndetësisë", "tedros")),
    ("UC7E-LYc1wivk33iyt5bR5zQ", "Vatican News", ("papa ", "papës", "vatikan")),
    ("UCTl3QQTvqHFjurroKxexy2Q", "Olympics", ("lojërat olimpike", "olimpiad")),
    ("UCHuiy8bXnmK5nisYHUd1J5g", "NVIDIA", ("nvidia", "jensen huang")),
    ("UC5WjFrtBdufl6CZojX3D8dQ", "Tesla", ("tesla",)),
    ("UCtI0Hodo5o5dUb67FeUjDeA", "SpaceX", ("spacex", "starship")),
    ("UCE_M8A5yxnLfW0KghEeajjw", "Apple", ("apple", "iphone")),
    ("UCXZCJLdBC09xxGZ6gcdrc6A", "OpenAI", ("openai", "chatgpt", "sam altman")),
    ("UCK8sQmJBp8GCxrOtXWBpyEA", "Google", ("google",)),
    ("UCP7jMXSY2xbc3KCAE0MHQ-A", "Google DeepMind", ("deepmind", "gemini")),
    ("UCFtEEv80fQVKkD4h1PF-Xqw", "Microsoft", ("microsoft",)),
    ("UCB_qr75-ydFVKSF9Dmo6izg", "FORMULA 1", ("formula 1", "formula1", "grand prix", "verstappen", "hamilton", "leclerc", "norris")),
    ("UCWJ2lWNubArHWmf3FIHbfcQ", "NBA", ("nba",)),
    ("UCGr3nR_XH9r6E5b09ZJAT9w", "EuroLeague", ("euroleague", "euroliga", "euroligë")),
    ("UCY_5h5zaSwN7Or4kIJDYNXA", "ATP Tour", ("atp", "sinner", "alcaraz", "djokoviq", "djokovic")),
    ("UCaBIVVpHjq6j3tSyxwTE-8Q", "WTA", ("wta", "sabalenka", "swiatek", "gauff")),
    ("UCG5qGWdu8nIRZqJ_GgDwQ-w", "Premier League", ("premier league", "premierliga")),
    ("UCTv-XvfzLX3i4IGWAm4sbmA", "LALIGA", ("laliga", "la liga")),
    ("UC6UL29enLNe4mqwTfAyeNuw", "Bundesliga", ("bundesliga",)),
    ("UCBJeMCIeLQos7wacox4hmLQ", "Serie A", ("serie a",)),
    ("UCWV3obpZVGgJ3j9FVhEjF2Q", "Real Madrid", ("real madrid", "mbappe", "mbappé", "vinicius")),
    ("UC14UlmYlSNiQCBe9Eookf_A", "FC Barcelona", ("barcelon", "yamal")),
    ("UCkzCjdRMrW2vXLx8mvPVLdQ", "Man City", ("manchester city", "man city", "guardiola", "haaland")),
    ("UC6yW44UGJJBvYTlfC7CRg2Q", "Manchester United", ("manchester united", "man united")),
    ("UC9LQwHZoucFT94I2h6JOcjw", "Liverpool FC", ("liverpool",)),
    ("UCpryVRk_VDudG8SHXgWcG0w", "Arsenal", ("arsenal",)),
    ("UCU2PacFf99vhb3hNiYDmxww", "Chelsea FC", ("chelsea",)),
    ("UCZkcxFIsqW5htimoUQKA0iA", "FC Bayern Munich", ("bayern", "kompany")),
    ("UCvXzEblUa0cfny4HAJ_ZOWw", "Inter", ("inter ", "interit", "interi")),
    ("UCKcx1uK38H4AOkmfv4ywlrg", "AC Milan", ("milan",)),
    ("UCt9a_qP9CqHCNwilf-iULag", "PSG", ("psg", "paris saint-germain")),
    ("UCqb1KFVXOjNQGHAfYJcbcxg", "FC Prishtina", ("fc prishtina", "prishtinës në superligë", "kf prishtina")),
    ("UCCplwNAt-CuZQf0QDqVFmUw", "FK Partizani", ("partizan",)),
]

STOP = {"this", "that", "with", "from", "have", "after", "over", "about", "will", "their", "they", "were", "what", "when",
        "dhe", "për", "nga", "një", "është", "janë", "kanë", "ishte", "pas", "para", "duke", "edhe", "këtë", "ndaj",
        "live", "video", "official", "full", "news", "today", "remarks", "president", "minister"}


def story_keys(text: str) -> set[str]:
    """The story's words that a video title about it would share (names, places, the topic),
    each cut to its first 5 letters so endings do not matter (Rusisë / Rusia, sanksionet / sanctions)."""
    return {norm(w)[:5] for w in re.findall(r"[\wçë-]+", text.lower()) if len(norm(w)) >= 4 and norm(w) not in STOP}


def channels_for(text: str) -> list[tuple[str, str, tuple[str, ...]]]:
    """The official channels a story speaks of, the most spoken of first."""
    low = text.lower()
    hits = []
    for cid, name, keys in OFFICIAL_CHANNELS:
        n = sum(len(re.findall(r"(?<![\wçë])" + re.escape(k), low)) for k in keys)
        if n:
            hits.append((n, cid, name, keys))
    return [(cid, name, keys) for n, cid, name, keys in sorted(hits, key=lambda h: -h[0])][:6]


def channel_uploads(cid: str, now: datetime) -> list[dict]:
    """A channel's newest videos and streams: id, title, when."""
    out = []
    for tab in ("videos", "streams"):
        try:
            req = urllib.request.Request(f"https://www.youtube.com/channel/{cid}/{tab}", headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en"})
            with urllib.request.urlopen(req, timeout=20) as res:
                html = res.read().decode("utf-8", "replace")
            data = json.loads(re.search(r"var ytInitialData = (\{.*?\});</script>", html).group(1))
        except (urllib.error.URLError, TimeoutError, OSError, AttributeError, ValueError):
            continue
        for v in walk_videos(data):
            title = ((v.get("title") or {}).get("runs") or [{}])[0].get("text", "")
            when = posted_on((v.get("publishedTimeText") or {}).get("simpleText", ""), now)
            if v.get("videoId") and title and when:
                out.append({"id": v["videoId"], "title": title[:160], "when": when})
        # Channel pages draw their videos as "lockups" (the search page still uses videoRenderer).
        for lock in walk_key(data, "lockupViewModel"):
            if lock.get("contentType") not in (None, "LOCKUP_CONTENT_TYPE_VIDEO") or not lock.get("contentId"):
                continue
            meta = (lock.get("metadata") or {}).get("lockupMetadataViewModel") or {}
            title = str((meta.get("title") or {}).get("content") or "")
            texts = [t for t in walk_key(meta, "content") if isinstance(t, str)]
            when = next((posted_on(t, now) for t in texts if re.search(r"\bago\b|Streamed", t) and posted_on(t, now)), None)
            if title and when:
                out.append({"id": lock["contentId"], "title": title[:160], "when": when})
    return list({v["id"]: v for v in out}.values())


def walk_key(node, key: str):
    """Every value stored under key, anywhere in a nested JSON."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == key:
                yield v
            yield from walk_key(v, key)
    elif isinstance(node, list):
        for v in node:
            yield from walk_key(v, key)


def official_candidates(text: str, keys: set[str], max_age_days: int = 5, limit: int = 6) -> list[dict]:
    """Videos the story's own people and institutions posted in the last few days whose title
    is about this story: it must share a topic word with it beyond the channel's own name (every
    White House video says "Trump"; one about these sanctions also says Russia or sanctions)."""
    now = datetime.now(timezone.utc)
    out = []
    for cid, name, own in channels_for(text):
        own_keys = {norm(w)[:5] for k in own for w in k.split() if len(norm(w)) >= 4}
        for v in channel_uploads(cid, now):
            if now - v["when"] > timedelta(days=max_age_days):
                continue
            title_keys = story_keys(v["title"])
            score = len((title_keys & keys) - own_keys)
            if score >= 1:
                out.append({"id": v["id"], "channel": name, "title": v["title"], "posted": v["when"].date().isoformat(),
                            "score": score, "keys": list(own), "official": True})
    out.sort(key=lambda c: (c["score"], c["posted"]), reverse=True)  # most on topic, then newest
    seen, best = set(), []
    for c in out:
        if c["id"] not in seen:
            seen.add(c["id"])
            best.append(c)
    return best[:limit]


def commons_recent(names: list[str], workdir: str, days: int = 10, limit: int = 2) -> list[dict]:
    """Freely licensed video uploaded to Commons in the last days about the story's people
    (governments upload their own: the White House, the Kremlin, parliaments)."""
    now = datetime.now(timezone.utc)
    titles: list[str] = []
    for name in [n for n in names if n][:3]:
        q = urllib.parse.urlencode({"action": "query", "format": "json", "list": "search", "srnamespace": "6", "srlimit": "6",
                                    "srsort": "create_timestamp_desc", "srsearch": f'filemime:video "{name}"'})
        try:
            rows = (http_json(f"{COMMONS}?{q}").get("query") or {}).get("search", [])
        except (urllib.error.URLError, TimeoutError, ValueError):
            continue
        for r in rows:
            try:
                when = datetime.fromisoformat(r.get("timestamp", "").replace("Z", "+00:00"))
            except ValueError:
                continue
            if now - when <= timedelta(days=days):
                titles.append(r["title"])
    return commons_cut(list(dict.fromkeys(titles)), workdir, limit)


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
MAX_PHOTO_USES = 2  # a third time and it reads as a loop


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
    named, the people's own footage early on), then the gaps cut into 2.5-4 s
    shots: footage first (each piece once), then photos (each twice at most,
    never twice in a row), and when both run out the words being said ("line")."""
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
    # (Without photos the footage opens the clip instead, as the first shots.)
    for k, v in enumerate([] if rich or not photos else footage[:3]):
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
    fills = 0
    # When each photo's person or organisation is first named: their photo comes up then.
    named = {}
    for p in photos:
        if p.get("who") and p["who"] not in named:
            named[p["who"]] = _said_name(words, re.sub(r"\s*\(.*?\)", "", p["who"]))
    # Footage from someone's own channel comes up when they are named, like their photo; a
    # stock shot when the thing it shows is said ("gjykata" for a courtroom).
    def keys_said(v: dict) -> float | None:
        stems = [norm(k.split()[0])[:5] for k in v.get("keys") or [] if k.split() and len(norm(k.split()[0])) >= 4]
        stems += [norm(x)[:5] for x in v.get("said") or [] if len(norm(x)) >= 4]
        return first_word_at(words, lambda w: any(w.startswith(s) for s in stems)) if stems else None
    foot_named = [keys_said(v) for v in footage]
    # Nothing loops: each piece of footage once, each photo twice at most and never twice in a
    # row. When the pictures run out, the words being said fill the screen ("line").
    unused = list(range(len(footage)))
    if not rich:
        placed = {b.get("file") for _, _, b in fixed if b.get("kind") == "video"}
        unused = [i for i in unused if footage[i].get("file") not in placed]
    uses = [0] * len(photos)
    last = {"src": ""}

    def video_beat(at: float, i: int) -> dict:
        unused.remove(i)
        v = footage[i]
        last["src"] = v.get("file", "")
        return {"at": round(at, 2), "kind": "video", "file": v.get("file", ""), "credit": v.get("credit", ""),
                "youtube": v.get("youtube", ""), "channel": v.get("channel", ""), "start": 2}

    def photo_beat(at: float, i: int) -> dict:
        uses[i] += 1
        p = photos[i]
        last["src"] = p["src"]
        return {"at": round(at, 2), "kind": "photo", "src": p["src"], "credit": p.get("credit", ""),
                "move": MOVES[(sum(uses) + fills) % len(MOVES)]}

    def photo(at: float) -> dict:
        nonlocal fills
        fills += 1
        free_photos = [i for i, p in enumerate(photos) if uses[i] < MAX_PHOTO_USES and p["src"] != last["src"]]
        # The person just named (in the last few seconds, or about to be), if their photo is free.
        recent = [i for i in free_photos if photos[i].get("who") and named.get(photos[i]["who"]) is not None
                  and at - 6.0 <= named[photos[i]["who"]] <= at + 0.8]
        if recent and (not rich or uses[recent[0]] == 0):
            return photo_beat(at, max(recent, key=lambda i: named[photos[i]["who"]]))
        # Moving picture first: the piece whose person or thing was just said, else the next.
        if unused and (rich or not free_photos or fills % 3 == 0):
            near = [i for i in unused if foot_named[i] is not None and at - 6.0 <= foot_named[i] <= at + 0.8]
            return video_beat(at, near[0] if near else unused[0])
        if free_photos:
            # A photo not shown yet before one shown once.
            return photo_beat(at, min(free_photos, key=lambda i: (uses[i], i)))
        if unused:
            return video_beat(at, unused[0])
        if at < 0.1 and photos:
            return photo_beat(at, 0)  # the title needs a picture under it
        if at < 0.1:
            return {"at": round(at, 2), "kind": "plain"}
        last["src"] = ""
        return {"at": round(at, 2), "kind": "line"}

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


def _said_name_all(words: list[list], name: str) -> list[float]:
    """Every time the name is said (by its last word's stem)."""
    toks = [norm(t) for t in str(name).split() if len(norm(t)) >= 3]
    if not toks:
        return []
    stem = toks[-1][: max(4, len(toks[-1]) - 2)]
    return [w[0] for w in words if norm(w[2]).startswith(stem)]


def build_overlays(beats: list[dict], duration: float, words: list[list], graphics: list[dict],
                   climax: tuple[float, float] | None = None, cover: str = "") -> list[dict]:
    ends = [b["at"] for b in beats[1:]] + [duration]
    cards = [(b["at"], ends[k]) for k, b in enumerate(beats) if b["kind"] in ("fact", "quote", "map", "line")]
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

    later = [duration * f for f in (0.3, 0.5, 0.65, 0.42, 0.78, 0.22, 0.36, 0.58, 0.7, 0.26, 0.46)]
    score = None
    # The climax first: the moment the clip builds to gets its words across the screen.
    if climax and climax[0] > 3.0:
        cw = [[w[0], w[2]] for w in words if climax[0] - 0.01 <= w[0] <= climax[1]]
        if 2 <= len(cw) <= 6:
            place([climax[0] - 0.08], min(2.8, max(1.8, climax[1] - climax[0] + 0.7)), {"kind": "slam", "words": cw})
    # The ones tied to a moment (a name, a score said) first; a ranking or a timeline fits around them.
    order = {"score": 0, "person": 1, "compare": 2, "chart": 3, "ranking": 4, "timeline": 5}
    for g in sorted(graphics, key=lambda g: order.get(g.get("type"), 9)):
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
        elif kind == "person" and sum(o["kind"] in ("person", "profile") for o in out) < 2:
            # When the name is said: its first mention, or a later one, or (when it is only said in
            # the opening, under the headline) as soon as the headline has gone.
            times = _said_name_all(words, g["name"])
            spots = [t for s in times for t in (s - 0.1, s + 0.6)] + ([2.7] if times and times[0] < 2.6 else [])
            if times and g.get("photo") and not any(o["kind"] == "profile" for o in out):
                # With their photo: a full card (a star's, a player's), once a clip.
                if place(spots, 3.0, {"kind": "profile", "name": g["name"], "role": g.get("role", ""), "photo": g["photo"]}):
                    continue
            if times:
                place(spots, 2.6, {"kind": "person", "name": g["name"], "role": g.get("role", "")})
        elif kind == "chart":
            said = _said_number(words, g["points"][-1]["value"]) or _said_number(words, g["points"][0]["value"])
            spots = [said - 0.4] + [t for t in later if t >= said - 0.4] if said is not None else later
            place(spots, 4.6, {"kind": "chart", "label": g.get("label", ""), "points": g["points"]})
        elif kind == "ranking":
            said = _said_name(words, g["rows"][0]["name"])
            spots = ([said - 0.2] if said is not None else []) + later
            place(spots, 4.4, {"kind": "ranking", "label": g.get("label", ""), "rows": g["rows"]})
        elif kind == "timeline":
            length = min(5.6, 1.4 + 1.3 * len(g["steps"]))
            place([duration * f for f in (0.45, 0.3, 0.6, 0.2, 0.7, 0.38, 0.52)], length, {"kind": "timeline", "steps": g["steps"]})
    # Few graphics in this clip: its cover line, big, half way (every clip gets at least two moments
    # of motion graphics besides the opening).
    if cover and sum(o["kind"] not in ("bug",) for o in out) < 2:
        place([duration * f for f in (0.55, 0.4, 0.7, 0.3)], 2.6, {"kind": "keyline", "text": cover})
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
