#!/usr/bin/env python3
"""383 viral cuts: the day's viral moments, re-cut into 383's own short edits ("Virale sot").

The clip scout (scripts/clip_scout.py) finds and downloads what Albanian social media is
talking about; this module turns one story's clips into one fast vertical edit:

- no narrator: the original sound of each moment carries it;
- short credited excerpts (a few seconds each, never most of a long clip), each with
  "@creator · Platform" on screen while it plays;
- a hook line on top for the first seconds, hard punch-ins and quick transitions on the
  cuts, one or two of Lind's film burns, a whoosh on each change;
- word-by-word Albanian captions of what is said (Whisper on Groq): Albanian speech as it is
  heard, other languages translated; nothing shown where Whisper is unsure;
- a closing card with a question for the viewer.

The choice of moments, the hook and the closing question come from the model (Groq), from
the transcript and loudness of every stretch of every clip; when it cannot be asked, the
loudest stretches are taken in order and the hook is the scout's headline.

    python viral_cut.py <out dir> <clip.mp4> [<clip2.mp4> ...]   # a trial cut of local files
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import re
import subprocess
import time
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

W, H, FPS = 1080, 1920, 30
XF = 0.2                 # seconds two pieces overlap in a transition
END = 1.8                # the closing card
MIN_PIECE, MAX_PIECE = 1.4, 6.5
TOTAL = (14.0, 30.0)     # what an edit runs, closing card aside
MIN_TOTAL = 6.0          # shorter than this, the model's choice is not taken
SHORT_SOURCE = 20.0      # a clip shorter than this may give most of itself...
SHARE_LONG = 0.5         # ...a longer one at most this share (excerpts, not the clip)
SHARE_SHORT = 0.8
PUNCH = (1.0, 1.16, 1.0, 1.28, 1.08)   # hard punch-ins, piece by piece
WIDE_PUNCH = (1.0, 1.4, 1.15, 1.6, 1.0)  # a landscape clip fills more of the upright frame as it punches
TRANSITIONS = ("fadewhite", "zoomin", "slideleft", "smoothup", "hblur", "slideright", "circleopen")
MAX_BURNS = 2
ORANGE = "&H002244FF"     # 383's #FF4422, in ASS's blue-green-red order
LIBRARY = Path(os.environ.get("L383_EDITION_LIBRARY", "/opt/data/video-edition/library"))
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf"   # SIL OFL
FONT_FAMILY = "Anton"
GROQ = "https://api.groq.com/openai/v1"
GEMINI = "https://generativelanguage.googleapis.com/v1beta/models"
# Models that watch video, cheapest first (free tier); each key is tried with each.
VISION_MODELS = [m for m in os.environ.get("L383_CUT_VISION_MODELS", "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash").split(",") if m]
MARK = Path(__file__).resolve().parent / "assets" / "383-mark.png"   # the 383 logo in white, for over video
WHISPER = os.environ.get("L383_CUT_WHISPER", "whisper-large-v3")
HEADERS = {"User-Agent": "383ViralCut/1.0 (https://383ks.com)"}
# The library's sounds sit this far under the clip's own sound (-14 LUFS after loudnorm).
LEVELS = {"whoosh": -16, "swish": -16, "impact": -12, "burn": -14, "pop": -15, "sting": -12}
KICKERS = ("Ti çfarë mendon?", "Kush ka të drejtë?", "E pe deri në fund?", "Po ti si do reagoje?")
ALBANIAN = {"albanian", "sq", "sqi", "alb"}
PLATFORMS = {"tiktok": "TikTok", "x": "X", "instagram": "Instagram", "youtube": "YouTube"}


def log(msg: str) -> None:
    print(f"CUT {msg}", file=sys.stderr)


def run(args: list[str], timeout: int = 900, cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False, cwd=cwd,
                          encoding="utf-8", errors="replace")


# ── Reading a clip ───────────────────────────────────────────────────────────

def probe(path: Path) -> dict:
    """Length, size and whether it has sound; a picture (a photo post) has no length."""
    done = run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                "-of", "json", str(path)], timeout=60)
    try:
        info = json.loads(done.stdout or "{}")
    except ValueError:
        info = {}
    streams = info.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    try:
        duration = float((info.get("format") or {}).get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0.0
    photo = path.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")
    return {"duration": 0.0 if photo else round(duration, 3), "width": int(video.get("width") or 0),
            "height": int(video.get("height") or 0), "audio": any(s.get("codec_type") == "audio" for s in streams),
            "photo": photo}


def loudness_curve(path: Path, step: float = 0.5) -> list[float]:
    """The sound's level (dB RMS) every half second: shouts, laughter and applause stand out."""
    n = int(16000 * step)
    done = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-vn", "-af",
                f"aresample=16000,asetnsamples=n={n}:p=0,astats=metadata=1:reset=1,"
                "ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"], timeout=300)
    levels = []
    for value in re.findall(r"RMS_level=(-?[\d.]+|-inf)", done.stderr + done.stdout):
        levels.append(-90.0 if value == "-inf" else max(-90.0, float(value)))
    return levels


def transcribe(path: Path, key: str, work: Path) -> dict:
    """Whisper on Groq: segments with how sure it is, and each word's time. {} when it cannot be asked."""
    if not key:
        return {}
    audio = work / f"{path.stem}-{uuid.uuid4().hex[:6]}.mp3"
    done = run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", str(audio)], timeout=300)
    if done.returncode != 0 or not audio.exists():
        return {}
    boundary = uuid.uuid4().hex
    fields = [("model", WHISPER), ("response_format", "verbose_json"), ("timestamp_granularities[]", "word"),
              ("timestamp_granularities[]", "segment"), ("temperature", "0")]
    body = b"".join(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode() for k, v in fields)
    body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\n"
             "Content-Type: audio/mpeg\r\n\r\n").encode() + audio.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    audio.unlink(missing_ok=True)
    req = urllib.request.Request(f"{GROQ}/audio/transcriptions", data=body, method="POST",
                                 headers={**HEADERS, "Authorization": f"Bearer {key}",
                                          "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            got = json.loads(res.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        log(f"whisper {path.name}: {exc!r}"[:200])
        return {}
    segments = [{"start": float(s.get("start") or 0), "end": float(s.get("end") or 0), "text": str(s.get("text") or "").strip(),
                 "sure": float(s.get("avg_logprob") or -9) > -0.75 and float(s.get("no_speech_prob") or 1) < 0.5
                 and float(s.get("compression_ratio") or 9) < 2.4}
                for s in got.get("segments") or [] if isinstance(s, dict)]
    words = [[float(w.get("start") or 0), float(w.get("end") or 0), str(w.get("word") or "").strip()]
             for w in got.get("words") or [] if isinstance(w, dict) and str(w.get("word") or "").strip()]
    return {"language": str(got.get("language") or "").lower(), "segments": segments, "words": words}


def analyse(path: Path, key: str, work: Path, cache: Path | None = None) -> dict:
    """What the cutter needs to know of one clip, kept beside it (a clip is analysed once)."""
    if cache and cache.exists():
        try:
            return json.loads(cache.read_text(encoding="utf-8"))
        except ValueError:
            pass
    info = probe(path)
    out = {**info, "loud": [], "speech": {}}
    if not info["photo"] and info["audio"]:
        out["loud"] = loudness_curve(path)
        out["speech"] = transcribe(path, key, work)
    if cache:
        cache.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out


# ── The stretches a cut is made of ───────────────────────────────────────────

def level(loud: list[float], start: float, end: float, step: float = 0.5) -> float:
    vals = loud[int(start / step):max(int(start / step) + 1, int(math.ceil(end / step)))]
    return round(sum(vals) / len(vals), 1) if vals else -90.0


# What Whisper writes over music, noise or silence (it was trained on subtitled video).
HALLUCINATIONS = re.compile(r"(?i)^\W*(thank you( (so much|very much))?( for watching)?|thanks for watching|please subscribe|"
                            r"subscribe|you|bye|faleminderit( për shikimin)?|titrat?\b.*|subtitles? by.*|amara\.org.*)\W*$")


def hallucinated(text: str) -> bool:
    return bool(HALLUCINATIONS.match(text.strip()))


def units_of(n: int, a: dict) -> list[dict]:
    """Every stretch of clip n that could be a piece: what is said, sentence by sentence (long
    ones split at a pause), and the moments between with no words (a reaction, a crowd, a fall)."""
    if a.get("photo"):
        return [{"id": f"u{n}a", "src": n, "start": 0.0, "end": 2.6, "text": "", "photo": True, "loud": -90.0}]
    dur = float(a.get("duration") or 0)
    if dur < MIN_PIECE:
        return []
    speech = a.get("speech") or {}
    words = speech.get("words") or []
    spans: list[list] = []   # [start, end, text, sure]
    for s in speech.get("segments") or []:
        start, end = max(0.0, s["start"]), min(dur, s["end"])
        if end - start < 0.4 or not s.get("text") or hallucinated(s["text"]):
            continue
        said = [w for w in words if start - 0.05 <= w[0] < end]
        if said:   # Whisper's segments start early; the piece starts with the first word
            start, end = max(start, said[0][0] - 0.15), min(dur, max(end, said[-1][1] + 0.2))
        split = False
        if spans and start - spans[-1][1] < 0.5 and end - spans[-1][0] <= MAX_PIECE:
            spans[-1] = [spans[-1][0], end, f"{spans[-1][2]} {s['text']}", spans[-1][3] and s["sure"]]
            continue
        while end - start > MAX_PIECE:   # a long sentence: cut at the widest pause before MAX_PIECE
            inside = [w for w in words if start < w[1] <= start + MAX_PIECE]
            gaps = [(inside[i + 1][0] - inside[i][1], inside[i][1]) for i in range(len(inside) - 1) if inside[i][1] - start >= MIN_PIECE]
            cut = max(gaps)[1] + 0.08 if gaps else start + MAX_PIECE * 0.8
            said = " ".join(w[2] for w in words if start <= w[0] < cut)
            spans.append([start, cut, said, s["sure"]])
            start, split = cut, True
        rest = " ".join(w[2] for w in words if start <= w[0] < end) if split else s["text"]
        spans.append([start, end, rest, s["sure"]])
    units, k = [], 0
    edges = [0.0] + [x for sp in spans for x in (sp[0], sp[1])] + [dur]
    quiet = [(edges[i], edges[i + 1]) for i in range(0, len(edges) - 1, 2)]   # between the spoken spans
    for sp in spans:
        if sp[1] - sp[0] >= MIN_PIECE * 0.8:
            units.append({"start": round(sp[0], 2), "end": round(sp[1], 2), "text": sp[2].strip(), "sure": sp[3]})
    for start, end in quiet:
        t = start
        while end - t >= MIN_PIECE + 0.6:
            stop = min(end, t + 3.5)
            units.append({"start": round(t + 0.1, 2), "end": round(stop - 0.1, 2), "text": "", "sure": False})
            t = stop
    if len(units) < 3 and dur >= 2 * MIN_PIECE + 1:
        # One sentence, or no clear moments: the clip itself in beats of about three seconds,
        # each cut at a pause between words where there is one near.
        units, t = [], 0.0
        while dur - t >= MIN_PIECE:
            stop = min(dur, t + 3.2)
            near = [w[1] + 0.08 for w in words if stop - 0.9 <= w[1] <= stop + 0.6 and w[1] + 0.08 - t >= MIN_PIECE]
            stop = min(dur, min(near, key=lambda x: abs(x - stop)) if near and dur - stop > MIN_PIECE else stop)
            if dur - stop < MIN_PIECE:
                stop = dur
            text = " ".join(w[2] for w in words if t <= w[0] < stop)
            sure = any(s.get("sure") for s in speech.get("segments") or [] if s["end"] > t and s["start"] < stop)
            units.append({"start": round(t, 2), "end": round(stop, 2), "text": text, "sure": sure})
            t = stop
    units.sort(key=lambda u: u["start"])
    out = []
    for u in units[:40]:
        k += 1
        out.append({"id": f"u{n}{chr(96 + k) if k <= 26 else k}", "src": n, **u, "photo": False,
                    "loud": level(a.get("loud") or [], u["start"], u["end"])})
    return out


def length(u: dict) -> float:
    return round(u["end"] - u["start"], 3)


def budget(a: dict) -> float:
    """How much of one clip a cut may use: most of a short one, half of a long one."""
    if a.get("photo"):
        return 99.0
    dur = float(a.get("duration") or 0)
    return dur * (SHARE_SHORT if dur < SHORT_SOURCE else SHARE_LONG)


def fallback_plan(units: list[dict], analyses: list[dict]) -> list[dict]:
    """Without the model: the loudest stretches (said words count extra), in each clip's own order."""
    if not units:
        return []
    mean = sum(u["loud"] for u in units) / len(units)
    ranked = sorted(units, key=lambda u: -((u["loud"] - mean) + (4 if u["text"] else 0) + (6 if u.get("photo") else 0)))
    chosen, used, total = [], {}, 0.0
    for u in ranked:
        if total + length(u) > TOTAL[1] or used.get(u["src"], 0) + length(u) > budget(analyses[u["src"]]):
            continue
        chosen.append(u)
        used[u["src"]] = used.get(u["src"], 0) + length(u)
        total += length(u)
        if len(chosen) >= 7:
            break
    return sorted(chosen, key=lambda u: (u["src"], u["start"]))


def check_plan(ids: list, units: list[dict], analyses: list[dict]) -> list[dict]:
    """The model's pieces as they may be cut: known, not twice, inside each clip's share and the cut's length."""
    by_id = {u["id"]: u for u in units}
    chosen, used, total = [], {}, 0.0
    for i in ids:
        u = by_id.get(str(i))
        if not u or u in chosen:
            continue
        if total + length(u) > TOTAL[1] + 2 or used.get(u["src"], 0) + length(u) > budget(analyses[u["src"]]) + 0.5:
            continue
        chosen.append(u)
        used[u["src"]] = used.get(u["src"], 0) + length(u)
        total += length(u)
    return chosen if total >= min(MIN_TOTAL, sum(length(u) for u in units) * 0.6) and len(chosen) >= 2 else []


def clean(text: str, limit: int) -> str:
    text = re.sub(r"[#@]\S+|https?://\S+|[{}\\]", " ", text or "")
    text = re.sub(r"[\U0001F000-\U0001FAFF☀-➿️]", "", text)
    return re.sub(r"\s+", " ", text).strip(" .,-")[:limit]


def plan_cut(story: str, sources: list[dict], analyses: list[dict], key: str, work: Path | None = None,
             look: dict | None = None) -> dict:
    """What the cut is. A video is watched first (Gemini, look): it is cut only if it shows the
    moment its post is about and makes sense alone; that moment plays first (the hook), then the
    stretches of the same moment, nothing else. A star's photos are their own post: all of them.
    plan["skip"] says why there is no cut ("retry" when it may work next run)."""
    units = [u for n, a in enumerate(analyses) for u in units_of(n, a)]
    headline = next((clean(s.get("headline", ""), 120) for s in sources if s.get("headline")), "")
    plan = {"units": units, "pieces": [], "title": headline, "kicker": "", "origin": "", "sq": {}, "how": "",
            "area": None, "captions": True, "skip": "", "retry": False}
    if all(a.get("photo") for a in analyses):
        plan.update(pieces=fallback_plan(units, analyses), kicker="Si ju duket?", how="photos")
    else:
        got = look if look is not None else watch(sources[0], analyses[0], units, work or Path("."))
        if not isinstance(got, dict):
            return {**plan, "skip": "the video could not be watched (Gemini)", "retry": True}
        if got.get("shows") is not True:
            return {**plan, "skip": "the video does not show what its post is about"}
        if got.get("context") is not True:
            return {**plan, "skip": "the clip does not make sense on its own"}
        by_id = {u["id"]: u for u in units}
        hook = str(got.get("hook") or "")
        if hook not in by_id:
            return {**plan, "skip": "the moment the post is about was not found in the clip"}
        order = [hook] + [str(i) for i in got.get("pieces") or [] if str(i) != hook]
        plan["pieces"] = check_plan(order, units, analyses)
        if not plan["pieces"] or plan["pieces"][0]["id"] != hook:
            return {**plan, "skip": "too little of the moment to cut"}
        title = clean(str(got.get("title") or ""), 90)
        plan["title"] = title if 2 <= len(title.split()) <= 12 else headline
        kicker = clean(str(got.get("kicker") or ""), 40)
        plan["kicker"] = kicker if kicker and len(kicker.split()) <= 7 else ""
        plan["origin"] = said_in(clean(str(got.get("origin") or ""), 40), sources[0].get("caption", ""))
        sq = got.get("sq") if isinstance(got.get("sq"), dict) else {}
        plan["sq"] = {str(k): clean(str(v), 160) for k, v in sq.items() if str(v).strip()}
        # A page's banners found by looking (static flat bands) first; Gemini's box only when there are none.
        plan["area"] = bars(Path(sources[0]["file"]), float(analyses[0].get("duration") or 0)) if sources[0].get("file") else None
        plan["area"] = plan["area"] or footage_area(got.get("area"))
        plan["captions"] = got.get("subtitles") is not True   # its own subtitles: ours would sit on them
        plan["how"] = "watched"
    if len(plan["pieces"]) < 1 or sum(length(u) for u in plan["pieces"]) < MIN_PIECE:
        return {**plan, "skip": "nothing to cut"}
    if not plan["title"]:
        plan["title"] = "Momenti që po flitet sot"
    if not plan["kicker"]:
        plan["kicker"] = KICKERS[int(hashlib.sha1(story.encode()).hexdigest(), 16) % len(KICKERS)]
    return plan


def bars(path: Path, duration: float) -> tuple[float, float, float, float] | None:
    """The banners a page put above and below the footage (a headline on white, a black bar with
    its name): rows at the top or bottom that stay the same while the picture moves and are mostly
    one flat light or dark colour. Returns the footage between them (x, y, w, h fractions), or None."""
    if duration < 2 or not path.exists():
        return None
    cols, rows = 108, 192
    frames = []
    for at in (duration * 0.2, duration * 0.5, duration * 0.8):
        done = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{at:.2f}", "-i", str(path), "-frames:v", "1", "-vf",
                               f"scale={cols}:{rows},format=gray", "-f", "rawvideo", "-"], capture_output=True, timeout=60, check=False)
        if done.returncode != 0 or len(done.stdout) != cols * rows:
            return None
        frames.append(done.stdout)

    def banner(r: int) -> bool:
        # Still across the clip (the footage moves under it) with some flat background: its
        # text lines are still too, which a "mostly white" test would miss.
        row = [f[r * cols:(r + 1) * cols] for f in frames]
        still = all(sum(abs(a - b) for a, b in zip(row[0], other)) / cols < 4 for other in row[1:])
        flat = sum(1 for v in row[1] if v > 215 or v < 30) >= cols * 0.15
        return still and flat

    def run_from(order) -> int:
        n = 0
        for r in order:
            if not banner(r):
                break
            n += 1
        return n

    def solid(r: int) -> bool:   # a row of the banner's own colour, between its lines of text
        return sum(1 for v in frames[1][r * cols:(r + 1) * cols] if v > 215 or v < 30) >= cols * 0.8

    def keep(band: range) -> int:
        # A static shot (a studio wall) is still too; a page's banner is mostly one flat colour.
        rs = list(band)
        return len(rs) if len(rs) >= 3 and sum(map(solid, rs)) >= len(rs) * 0.5 else 0

    most = int(rows * 0.35)   # a banner is never more than a third of the frame
    top, bottom = min(run_from(range(rows)), most), min(run_from(range(rows - 1, -1, -1)), most)
    top, bottom = keep(range(top)), keep(range(rows - bottom, rows))
    if top + bottom < rows * 0.04:
        return None
    return (0.0, round(top / rows, 3), 1.0, round((rows - top - bottom) / rows, 3))


def said_in(origin: str, caption: str) -> str:
    """The show's name only when the post names it (the watcher once called BBVK Kosova "Albania")."""
    text = re.sub(r"[^a-z0-9ëç]+", " ", caption.lower())
    words = [w for w in re.sub(r"[^a-z0-9ëç]+", " ", origin.lower()).split() if len(w) > 2]
    squashed = text.replace(" ", "")
    return origin if words and all(w in text.split() or w in squashed for w in words) else ""


def footage_area(raw) -> tuple[float, float, float, float] | None:
    """Gemini's box of the real footage ([ymin, xmin, ymax, xmax], 0-1000), as fractions (x, y, w, h):
    a fan page's banners, text bars and borders are cropped off. None when it is the whole frame
    or not a believable box."""
    try:
        y0, x0, y1, x1 = (float(v) / 1000 for v in raw)
    except (TypeError, ValueError):
        return None
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        return None
    w, h = x1 - x0, y1 - y0
    if w * h < 0.25 or w * h > 0.94:
        return None
    return (round(x0, 3), round(y0, 3), round(w, 3), round(h, 3))


def gemini_keys() -> list[str]:
    keys = [os.environ.get(k, "") for k in ("GOOGLE_AI_API_KEY", "GOOGLE_AI_API_KEY1", "GOOGLE_AI_API_KEY_2", "GEMINI_API_KEY")]
    for f in ("/opt/data/news-pipeline-hermes/gemini.key", "/opt/data/news-pipeline-hermes/gemini2.key"):
        try:
            keys.append(Path(f).read_text(encoding="utf-8").strip())
        except OSError:
            pass
    return list(dict.fromkeys(k.strip() for k in keys if k and k.strip()))


def preview(path: Path, work: Path) -> Path | None:
    """A small copy to watch: 360p, 5 frames a second, mono sound, the first three minutes."""
    out = work / f"look-{uuid.uuid4().hex[:6]}.mp4"
    done = run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-t", "180", "-vf", "scale=-2:360,fps=5", "-c:v", "libx264",
                "-preset", "veryfast", "-crf", "34", "-c:a", "aac", "-ac", "1", "-b:a", "32k", str(out)], timeout=300)
    return out if done.returncode == 0 and out.exists() and 10_000 < out.stat().st_size < 18_000_000 else None


def watch(src: dict, a: dict, units: list[dict], work: Path) -> dict | None:
    """Gemini watches the clip beside its stretches and says what the cut should be (see plan_cut)."""
    keys = gemini_keys()
    small = preview(Path(src["file"]), work) if keys else None
    if not small:
        return None
    lang = (a.get("speech") or {}).get("language") or "no speech"
    lines = [f"{u['id']} {u['start']:.1f}-{u['end']:.1f}s" + (f' says: "{u["text"][:160]}"' if u["text"] else " (no words)")
             for u in units]
    prompt = (
        "You edit 383's \"Virale sot\" (a Kosovo news site): the moment Albanian social media is talking about, re-cut "
        "from the viral clip with its original sound. Watch the video. Its post says: "
        f"\"{clean(src.get('caption', ''), 400) or '(no text)'}\" (by @{src.get('author', '')} on "
        f"{PLATFORMS.get(src.get('platform', ''), src.get('platform', ''))}; spoken language: {lang}).\n"
        "The video is cut into these stretches (seconds):\n" + "\n".join(lines) + "\n\n"
        "Answer, judging by what you see and hear:\n"
        "- shows: true only if the video really shows the moment the post's text is about.\n"
        "- context: true only if a viewer who sees just this clip understands who is doing what (false for a "
        "compilation of unrelated moments, a clip whose text is about something else, or one that needs the full show "
        "to follow).\n"
        "- hook: the id of the stretch where that moment happens: it plays first, in the first second.\n"
        "- pieces: the ids to play, in order, starting with hook: only stretches of that same moment (what leads to it, "
        "the reaction), 2 to 6 of them, 10 to 30 seconds in all; leave out unrelated parts, intros, ads and outros.\n"
        "- title: in standard Albanian, 3 to 8 words, what happens in it; nothing the video and post do not show.\n"
        "- kicker: a question to the viewer in Albanian, at most 6 words.\n"
        "- origin: the TV show or event the footage is from if it is clear (e.g. \"Big Brother VIP Kosova\"), else \"\".\n"
        "- subtitles: true if the video already shows subtitles of what is said.\n"
        "- area: [ymin, xmin, ymax, xmax] from 0 to 1000 of the real footage, leaving out banners, text bars, logos "
        "bars and borders a page added around it; [0, 0, 1000, 1000] if there are none.\n"
        "- sq: for each chosen stretch whose words are not Albanian, what is said in natural Albanian.\n"
        "Reply with only JSON: {\"shows\": true, \"context\": true, \"hook\": \"u0b\", \"pieces\": [\"u0b\", \"u0c\"], "
        "\"title\": \"...\", \"kicker\": \"...\", \"origin\": \"\", \"subtitles\": false, \"area\": [0, 0, 1000, 1000], \"sq\": {}}"
    )
    data = base64.b64encode(small.read_bytes()).decode()
    small.unlink(missing_ok=True)
    body = json.dumps({"contents": [{"parts": [{"inline_data": {"mime_type": "video/mp4", "data": data}}, {"text": prompt}]}],
                       "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}}).encode()
    for model in VISION_MODELS:
        for key in keys:
            req = urllib.request.Request(f"{GEMINI}/{model}:generateContent?key={key}", data=body, method="POST",
                                         headers={**HEADERS, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=150) as res:
                    reply = json.loads(res.read().decode("utf-8"))
                text = reply["candidates"][0]["content"]["parts"][0]["text"]
                got = json.loads(text)
                if isinstance(got, list):   # it sometimes wraps the answer in a list
                    got = got[0] if got and isinstance(got[0], dict) else None
                if isinstance(got, dict):
                    return got
            except urllib.error.HTTPError as exc:
                log(f"watch {model}: HTTP {exc.code}")
                if exc.code not in (429, 500, 503):
                    break   # this model is refused outright: the next one
            except (urllib.error.URLError, OSError, ValueError, KeyError, IndexError, TypeError) as exc:
                log(f"watch {model}: {exc!r}"[:160])
    return None


# ── Captions and on-screen words (ASS, drawn by libass) ─────────────────────

def ass_text(text: str) -> str:
    return re.sub(r"[{}\\]", "", text).replace("\n", " ").strip()


def ts(t: float) -> str:
    t = max(0.0, t)
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def timeline(pieces: list[dict]) -> list[float]:
    """Where each piece starts in the cut (each transition overlaps two pieces by XF)."""
    starts, t = [], 0.0
    for p in pieces:
        starts.append(round(t, 3))
        t += p["len"] - XF
    return starts


def caption_events(pieces: list[dict], starts: list[float], analyses: list[dict], sq: dict) -> list[tuple[float, float, str]]:
    """(start, end, text) in the cut's time: Albanian words as they are said, the current one in orange,
    three at a time; another language as its Albanian, a few words at a time across the speech."""
    events = []
    for p, at in zip(pieces, starts):
        if p.get("photo"):
            continue
        a = analyses[p["src"]]
        speech = a.get("speech") or {}
        lo, hi = at + (XF / 2 if at else 0), at + p["len"] - XF / 2
        to_cut = lambda m: at + (m - p["start"])  # noqa: E731
        sure = [s for s in speech.get("segments") or [] if s.get("sure") and not hallucinated(s.get("text", ""))
                and s["end"] > p["start"] and s["start"] < p["end"]]
        if not sure:
            continue
        words = [w for w in speech.get("words") or [] if p["start"] - 0.05 <= w[0] < p["end"] - 0.1
                 and any(s["start"] - 0.2 <= w[0] <= s["end"] + 0.2 for s in sure)]
        if not words:
            continue
        native = (speech.get("language") or "") in ALBANIAN
        if native:
            groups, cur = [], []
            for w in words:
                if cur and (len(cur) == 3 or w[0] - cur[-1][1] > 0.45):
                    groups.append(cur)
                    cur = []
                cur.append(w)
            if cur:
                groups.append(cur)
            for g in groups:
                for i, w in enumerate(g):
                    s = to_cut(w[0])
                    e = to_cut(g[i + 1][0]) if i + 1 < len(g) else to_cut(w[1]) + 0.25
                    s, e = max(s, lo), min(e, hi)
                    if e - s < 0.05:
                        continue
                    text = " ".join((f"{{\\c{ORANGE}}}{ass_text(x[2]).upper()}{{\\c&H00FFFFFF}}" if j == i else ass_text(x[2]).upper())
                                    for j, x in enumerate(g))
                    pop = "{\\fscx94\\fscy94\\t(0,80,\\fscx100\\fscy100)}" if i == 0 else ""
                    events.append((s, e, pop + text))
        else:
            said = sq.get(p.get("id", ""), "")
            chunks = [c for c in re.split(r"(?<=[.!?,])\s+", said) if c.strip()]
            pieces_of = []
            for c in chunks:
                ws = c.split()
                pieces_of += [" ".join(ws[i:i + 5]) for i in range(0, len(ws), 5)]
            if not pieces_of:
                continue
            s0, s1 = max(lo, to_cut(words[0][0])), min(hi, to_cut(words[-1][1]) + 0.3)
            span = (s1 - s0) / len(pieces_of)
            for i, c in enumerate(pieces_of):
                events.append((s0 + i * span, s0 + (i + 1) * span, ass_text(c).upper()))
    return events


def ass_doc(pieces: list[dict], starts: list[float], total: float, plan: dict, captions: list, font: str) -> str:
    """The words on the cut: what is said (only where the clip has no subtitles of its own), the
    source in a quiet pill top left while each piece plays, and the closing question under the logo.
    Nothing on top: the moment itself is the hook, and the 383 logo (drawn by build) is the brand."""
    style = ("Style: {name},{font},{size},&H00FFFFFF,&H00FFFFFF,{outc},{back},0,0,0,0,100,100,{spacing},0,{border},{outline},{shadow},"
             "{align},{ml},{mr},{mv},1")
    styles = [
        style.format(name="Cap", font=font, size=84, outc="&H00000000", back="&H80000000", spacing=1, border=1, outline=6, shadow=2,
                     align=2, ml=140, mr=140, mv=470),
        style.format(name="Credit", font=font, size=38, outc="&H8C000000", back="&H8C000000", spacing=2, border=3, outline=12, shadow=0,
                     align=7, ml=150, mr=420, mv=166),
        style.format(name="Kicker", font=font, size=112, outc="&H00000000", back="&H00000000", spacing=1, border=1, outline=0, shadow=0,
                     align=8, ml=160, mr=160, mv=0),
    ]
    end_at = total - END
    ev = [("Cap", s, min(e, end_at), text) for s, e, text in captions]
    for p, at in zip(pieces, starts):
        who = f"@{p['author']} · {PLATFORMS.get(p['platform'], p['platform'])}" if p.get("author") else ""
        line = " · ".join(x for x in (plan.get("origin", ""), who) if x)
        if len(line) > 34:   # one line in the pill: the creator is what matters
            line = who
        if line:
            ev.append(("Credit", at + (XF if at else 0), min(at + p["len"], end_at), "{\fad(160,0)}" + ass_text(line)))
    ev.append(("Kicker", end_at + 0.25, total, "{\pos(540,1060)\fad(200,0)\fscx88\fscy88\t(0,260,\fscx100\fscy100)}"
                                               + ass_text(plan["kicker"]).upper()))
    events = "\n".join(f"Dialogue: {9 if st == 'Kicker' else 5},{ts(s)},{ts(e)},{st},,0,0,0,,{text}"
                       for st, s, e, text in ev if e - s > 0.04)
    return ("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
            "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
            "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, "
            "Encoding\n" + "\n".join(styles) + "\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, "
            "Effect, Text\n" + events + "\n")


# ── The library: burns, sounds, the font ─────────────────────────────────────

def load_library(root: Path = LIBRARY) -> dict:
    try:
        lib = json.loads((root / "library.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        lib = {}
    lib["root"] = str(root)
    return lib


def font_dir(root: Path = LIBRARY) -> tuple[Path, str]:
    """Anton (SIL OFL) in the library's fonts folder, fetched once; else whatever bold sans the system has."""
    fonts = root / "fonts"
    target = fonts / "Anton-Regular.ttf"
    if not target.exists():
        try:
            fonts.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(urllib.request.Request(FONT_URL, headers=HEADERS), timeout=60) as res:
                data = res.read()
            if len(data) > 50_000:
                target.write_bytes(data)
        except (urllib.error.URLError, OSError) as exc:
            log(f"font: {exc!r}"[:160])
    return fonts, FONT_FAMILY if target.exists() else "DejaVu Sans"


def pick_sound(lib: dict, kind: str, n: int) -> dict | None:
    sounds = [o for o in (lib.get("sfx") or {}).get(kind) or [] if o.get("file")]
    return sounds[n % len(sounds)] if sounds else None


def gain(o: dict, kind: str) -> float:
    lufs = o.get("lufs")
    return round(-14 + LEVELS.get(kind, -16) - (lufs if isinstance(lufs, (int, float)) else -20), 1)


# ── Rendering (one ffmpeg run: pieces, transitions, burns, words, sound) ─────

def fill(i: int, p: dict, a: dict, area: tuple | None = None) -> str:
    """Piece i's picture as an upright 1080x1920: an upright clip fills the frame (punched in);
    a wide one sits over a blurred copy of itself; a photo slowly pushes in. area (x, y, w, h as
    fractions) is the real footage inside a fan page's banners: only it is used."""
    frames = int(round(p["len"] * FPS)) + 2
    # fps last as well: ffmpeg 7.1's setpts drops the frame rate, and xfade needs it (8.x keeps it).
    tail = f"fps={FPS},format=yuv420p,setsar=1,trim=duration={p['len']:.3f},setpts=PTS-STARTPTS,fps={FPS}[v{i}]"
    if p.get("photo"):
        return (f"[{i}:v]scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
                f"zoompan=z='min(1+0.0011*on,1.14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},{tail}")
    src, ratio = f"[{i}:v]", (a.get("width") or 0) / max(1, a.get("height") or 0)
    if area:
        x, y, w, h = area
        src += f"crop=trunc(iw*{w}/2)*2:trunc(ih*{h}/2)*2:trunc(iw*{x}):trunc(ih*{y}),"
        ratio = ratio * w / h
    wide = ratio > 1.05   # up to square it fills the frame (a little off the sides); only landscape floats on a blur
    if not wide:
        z = PUNCH[i % len(PUNCH)]
        w, h = int(W * z) // 2 * 2, int(H * z) // 2 * 2
        return f"{src}scale={w}:{h}:force_original_aspect_ratio=increase,crop={W}:{H},{tail}"
    z = WIDE_PUNCH[i % len(WIDE_PUNCH)]
    fg = int(W * z) // 2 * 2
    return (f"{src}split=2[bg{i}][fg{i}];[bg{i}]scale={W // 4}:{H // 4}:force_original_aspect_ratio=increase,crop={W // 4}:{H // 4},"
            f"boxblur=12:2,scale={W}:{H},eq=brightness=-0.2:saturation=1.2[bb{i}];[fg{i}]scale={fg}:-2[ff{i}];"
            f"[bb{i}][ff{i}]overlay=(W-w)/2:(H-h)/2:shortest=1,{tail}")


def build(plan: dict, sources: list[dict], analyses: list[dict], work: Path, lib: dict, seed: str) -> dict | None:
    """Renders the cut: work/cut.mp4 (1080x1920), work/cut-sd.mp4 (720x1280), work/thumb.jpg."""
    pieces = []
    for u in plan["pieces"]:
        s = sources[u["src"]]
        pieces.append({**u, "len": length(u), "file": str(Path(s["file"]).resolve()), "author": s.get("author", ""), "platform": s.get("platform", "")})
    if not pieces:
        return None
    rng = int(hashlib.sha1(seed.encode()).hexdigest(), 16)
    root = Path(lib.get("root") or LIBRARY)
    fonts, font = font_dir(root)
    starts = timeline(pieces)
    total = round(starts[-1] + pieces[-1]["len"] - XF + END, 3)
    captions = caption_events(pieces, starts, analyses, plan.get("sq") or {}) if plan.get("captions", True) else []
    (work / "cut.ass").write_text(ass_doc(pieces, starts, total, plan, captions, font), encoding="utf-8")

    args = ["ffmpeg", "-v", "error", "-y"]
    for p in pieces:
        if p.get("photo"):
            args += ["-i", p["file"]]
        else:
            args += ["-ss", f"{p['start']:.3f}", "-t", f"{p['len'] + 0.1:.3f}", "-i", p["file"]]
    n = len(pieces)
    args += ["-f", "lavfi", "-t", f"{END + 0.1:.2f}", "-i", f"color=c=0x16130F:s={W}x{H}:r={FPS}"]
    nxt = n + 1
    graph, cuts = [], []
    for i, p in enumerate(pieces):
        a = analyses[p["src"]]
        graph.append(fill(i, p, a, plan.get("area")))
        if a.get("audio") and not p.get("photo"):
            graph.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=duration={p['len']:.3f},asetpts=PTS-STARTPTS,"
                         f"afade=t=in:d=0.04,afade=t=out:st={max(0, p['len'] - 0.06):.3f}:d=0.06[a{i}]")
        else:
            graph.append(f"anullsrc=r=48000:cl=stereo,atrim=duration={p['len']:.3f}[a{i}]")
    graph.append(f"[{n}:v]format=yuv420p,setsar=1,trim=duration={END:.3f},setpts=PTS-STARTPTS,fps={FPS}[v{n}]")
    graph.append(f"anullsrc=r=48000:cl=stereo,atrim=duration={END:.3f}[a{n}]")
    vcur, acur, t = "v0", "a0", pieces[0]["len"]
    lens = [p["len"] for p in pieces] + [END]
    for k in range(1, n + 1):
        kind = "fade" if k == n else TRANSITIONS[(rng + k) % len(TRANSITIONS)] if k > 1 else "fadewhite"
        off = t - XF
        graph.append(f"[{vcur}][v{k}]xfade=transition={kind}:duration={XF}:offset={off:.3f}[x{k}]")
        graph.append(f"[{acur}][a{k}]acrossfade=d={XF}:c1=tri:c2=tri[y{k}]")
        cuts.append(round(off + XF / 2, 3))
        vcur, acur, t = f"x{k}", f"y{k}", t + lens[k] - XF
    # Film burns over the strongest cuts (the first, then the middle), their flash on the cut.
    burns = [b for b in lib.get("burns") or [] if b.get("file") and (root / b["file"]).exists()]
    sound_at: list[tuple[str, float]] = [("impact", 0.0)]
    used_burns = []
    if burns:
        for at in [cuts[0]] + ([cuts[len(cuts) // 2]] if len(cuts) > 3 else []):
            if len(used_burns) >= MAX_BURNS:
                break
            b = burns[(rng + len(used_burns) * 7) % len(burns)]
            peak = float(b.get("peak") or 0.5)
            start = at - peak
            skip = max(0.0, -start)
            span = min(float(b.get("duration") or 2.0) - skip, 2.2)
            if span < 0.4:
                continue
            args += ["-ss", f"{skip:.3f}", "-t", f"{span:.3f}", "-i", str(root / b["file"])]
            graph.append(f"[{nxt}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=gbrp,setsar=1,"
                         f"setpts=PTS-STARTPTS,tpad=start_duration={max(0.0, start):.3f}:color=black[burn{len(used_burns)}]")
            used_burns.append(at)
            nxt += 1
    if used_burns:
        graph.append(f"[{vcur}]format=gbrp[gb0]")
        for j in range(len(used_burns)):
            graph.append(f"[gb{j}][burn{j}]blend=all_mode=screen:eof_action=pass:shortest=0[gb{j + 1}]")
        graph.append(f"[gb{len(used_burns)}]format=yuv420p[vb]")
        vcur = "vb"
    for at in cuts[:-1]:
        sound_at.append(("whoosh", max(0.0, at - 0.25)))
    sound_at.append(("pop", total - END + 0.1))
    sfx = []
    for j, (kind, at) in enumerate(sound_at):
        o = pick_sound(lib, kind, rng + j) or (pick_sound(lib, "swish", j) if kind == "whoosh" else None)
        if not o or not (root / o["file"]).exists():
            continue
        args += ["-i", str(root / o["file"])]
        ms = int(at * 1000)
        graph.append(f"[{nxt}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={gain(o, kind)}dB,adelay={ms}|{ms}[s{j}]")
        sfx.append(f"[s{j}]")
        nxt += 1
    # Photos only (a star's photo post): no sound of their own, so one of the bright beds carries them.
    beds = [o for o in (lib.get("music") or {}).get("bright") or [] if o.get("file") and (root / o["file"]).exists()]
    if beds and not any(analyses[p["src"]].get("audio") and not p.get("photo") for p in pieces):
        bed = beds[rng % len(beds)]
        args += ["-stream_loop", "-1", "-i", str(root / bed["file"])]
        graph.append(f"[{nxt}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=duration={total:.3f},"
                     f"afade=t=out:st={max(0.0, total - 1.2):.3f}:d=1.2,volume=2dB[bed]")
        sfx.append("[bed]")
        nxt += 1
    graph.append(f"[{acur}]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[an]")
    if sfx:
        graph.append(f"[an]{''.join(sfx)}amix=inputs={len(sfx) + 1}:normalize=0:duration=first,alimiter=limit=0.95[aout]")
    else:
        graph.append("[an]alimiter=limit=0.95[aout]")
    # The 383 logo: small, top right, with a soft shadow so it reads on any picture; large on the closing card.
    if MARK.exists():
        end_at = total - END
        args += ["-loop", "1", "-framerate", str(FPS), "-t", f"{total + 0.2:.3f}", "-i", str(MARK)]
        graph.append(f"[{nxt}:v]format=rgba,split=2[lm0][lm1]")
        graph.append("[lm0]scale=168:-1,pad=iw+28:ih+28:14:14:color=black@0,split=2[la][lb];"
                     "[lb]colorchannelmixer=rr=0:gg=0:bb=0:aa=0.55,boxblur=9:1[lsh];[lsh][la]overlay=0:0,"
                     f"fade=t=out:st={max(0.0, end_at - 0.2):.3f}:d=0.2:alpha=1[lsm]")
        graph.append(f"[lm1]scale=420:-1,fade=t=in:st={end_at + 0.05:.3f}:d=0.35:alpha=1[lbig]")
        graph.append(f"[{vcur}][lsm]overlay=x=W-w-136:y=136:eof_action=pass[lo1]")
        graph.append(f"[lo1][lbig]overlay=x=(W-w)/2:y=800:eof_action=pass[lo2]")
        vcur = "lo2"
        nxt += 1
    graph.append(f"[{vcur}]ass=cut.ass:fontsdir='{fonts.as_posix().replace(':', chr(92) + ':')}',split=2[vh][vs0]")
    graph.append("[vs0]scale=720:1280:flags=lanczos[vs]")
    graph.append("[aout]asplit=2[ah][as]")
    hd, sd = work / "cut.mp4", work / "cut-sd.mp4"
    args += ["-filter_complex", ";".join(graph),
             "-map", "[vh]", "-map", "[ah]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-maxrate", "4M", "-bufsize", "8M",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", f"{total:.3f}", str(hd),
             "-map", "[vs]", "-map", "[as]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-maxrate", "1800k", "-bufsize", "3600k",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "112k", "-movflags", "+faststart", "-t", f"{total:.3f}", str(sd)]
    done = run(args, timeout=540, cwd=work)
    if done.returncode != 0 or not hd.exists() or hd.stat().st_size < 100_000:
        lines = [x.strip() for x in done.stderr.splitlines() if x.strip()]
        said = [x for x in lines if re.search(r"(?i)error|invalid|no such|unable|cannot|not found|option", x)] or lines[-4:]
        log("render failed: " + " | ".join(said[:6])[:900])   # one line, so the journal keeps it whole
        try:   # the whole command and answer beside the originals, for whoever reads why
            (Path(pieces[0]["file"]).parent / "cut-error.log").write_text(
                " ".join(json.dumps(a) for a in args) + "\n\n" + done.stderr, encoding="utf-8")
        except OSError:
            pass
        return None
    thumb = work / "thumb.jpg"
    at = round(min(pieces[0]["len"] * 0.6, 1.6), 2)   # the hook's moment, with the hook on it
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{at}", "-i", str(hd), "-frames:v", "1", "-vf", "scale=540:960", "-q:v", "3", str(thumb)], timeout=120)
    return {"hd": hd, "sd": sd, "thumb": thumb if thumb.exists() else None, "duration": round(total, 2), "cuts": cuts,
            "pieces": [{"src": p["src"], "start": p["start"], "end": p["end"]} for p in pieces]}


def make_cut(story: str, sources: list[dict], work: Path, key: str, lib: dict | None = None) -> dict:
    """One viral clip's cut (or a star's photos). sources: [{"file", "author", "platform", "caption",
    "headline"}]. Returns the files and what went into them, or {"skip": why, "retry": bool}."""
    work = work.resolve()
    work.mkdir(parents=True, exist_ok=True)
    lib = lib or load_library()
    analyses = []
    for s in sources:
        cache = Path(str(s["file"]) + ".cut.json")
        analyses.append(analyse(Path(s["file"]), key, work, cache))
    plan = plan_cut(story, sources, analyses, key, work)
    if plan["skip"]:
        log(f"{story!r}: no cut, {plan['skip']}")
        return {"skip": plan["skip"], "retry": plan["retry"]}
    seed = story + "|" + "|".join(sorted(str(s.get("id", s["file"])) for s in sources))
    out = build(plan, sources, analyses, work, lib, seed)
    if not out:
        return {"skip": "the render failed", "retry": True}
    return {**out, "title": plan["title"], "kicker": plan["kicker"], "origin": plan["origin"], "planned_by": plan["how"],
            "captions": bool(plan["captions"]), "cropped": bool(plan["area"])}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    out_dir = Path(sys.argv[1])
    files = [Path(f) for f in sys.argv[2:]]
    srcs = [{"file": f, "id": f.stem, "author": os.environ.get("CUT_AUTHOR", f.stem[:16]), "platform": "tiktok",
             "caption": os.environ.get("CUT_CAPTION", ""), "headline": os.environ.get("CUT_CAPTION", "")} for f in files]
    got = make_cut(os.environ.get("CUT_STORY", "trial"), srcs, out_dir, os.environ.get("GROQ_API_KEY", ""))
    print(json.dumps({k: str(v) for k, v in (got or {}).items()}, ensure_ascii=False, indent=1))
    sys.exit(1 if got.get("skip") else 0)
