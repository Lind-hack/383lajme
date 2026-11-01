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
MIN_TOTAL = 9.0          # shorter than this, the model's choice is not taken
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
GROQ_MODEL = os.environ.get("L383_SCOUT_MODEL", "openai/gpt-oss-120b")
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


def plan_cut(story: str, sources: list[dict], analyses: list[dict], key: str) -> dict:
    """Which stretches, in what order, the hook on top, the closing question, and the Albanian of
    what is said in another language. The model picks; the checks above decide what stands."""
    units = [u for n, a in enumerate(analyses) for u in units_of(n, a)]
    headline = next((clean(s.get("headline", ""), 120) for s in sources if s.get("headline")), "")
    plan = {"units": units, "pieces": [], "hook": "", "kicker": "", "origin": "", "sq": {}, "how": "fallback"}
    got = ask_model(story, sources, analyses, units, key) if key and units else None
    if isinstance(got, dict):
        plan["pieces"] = check_plan(got.get("pieces") or [], units, analyses)
        hook = clean(str(got.get("hook") or ""), 60)
        plan["hook"] = hook if 2 <= len(hook.split()) <= 8 else ""
        kicker = clean(str(got.get("kicker") or ""), 40)
        plan["kicker"] = kicker if kicker and len(kicker.split()) <= 7 else ""
        plan["origin"] = clean(str(got.get("origin") or ""), 40)
        sq = got.get("sq") if isinstance(got.get("sq"), dict) else {}
        plan["sq"] = {str(k): clean(str(v), 160) for k, v in sq.items() if str(v).strip()}
        plan["how"] = "model" if plan["pieces"] else "fallback"
    if not plan["pieces"]:
        plan["pieces"] = fallback_plan(units, analyses)
    if not plan["hook"]:
        plan["hook"] = " ".join(headline.split()[:9]) or "Momenti që po flitet sot"
    if not plan["kicker"]:
        photos_only = all(a.get("photo") for a in analyses)
        plan["kicker"] = "Si ju duket?" if photos_only else KICKERS[int(hashlib.sha1(story.encode()).hexdigest(), 16) % len(KICKERS)]
    return plan


def ask_model(story: str, sources: list[dict], analyses: list[dict], units: list[dict], key: str) -> dict | None:
    lines = []
    for n, s in enumerate(sources):
        a = analyses[n]
        lang = (a.get("speech") or {}).get("language") or ("photo" if a.get("photo") else "no speech")
        lines.append(f"CLIP {n}: {PLATFORMS.get(s.get('platform', ''), s.get('platform', ''))} @{s.get('author', '')}, "
                     f"{a.get('duration', 0):.0f}s (use at most {min(budget(a), 30):.0f}s of it), language {lang}. Post text: {clean(s.get('caption', ''), 300) or '(none)'}")
    loud = sorted(u["loud"] for u in units)
    top = loud[int(len(loud) * 0.75)] if loud else 0
    for u in units:
        mark = " LOUD" if u["loud"] >= top and u["loud"] > -40 else ""
        said = f'says: "{u["text"][:160]}"' if u["text"] else ("a photo" if u.get("photo") else "no words")
        lines.append(f"{u['id']} clip {u['src']} {u['start']:.1f}-{u['end']:.1f}s ({length(u):.1f}s){mark}: {said}")
    prompt = (
        "You edit 383's \"Virale sot\": a viral moment Albanian social media is talking about, re-cut into one fast "
        "vertical video of 18 to 30 seconds with the original sound and no narrator, like the best viral pages do. "
        f"The story: {story or '(see the posts)'}.\n"
        "Choose the stretches (by id) and their play order: open on the most striking moment (it is the hook), then "
        "what makes the moment make sense, and end on the payoff or the reaction. 3 to 7 pieces, 18 to 30 seconds in "
        "all; prefer stretches where something is said or happens (LOUD ones are shouting, laughter, applause). Use "
        "different clips of the same moment when there are several. Never more than half of a long clip.\n"
        "Also write, in standard Albanian:\n"
        "- hook: the line on top for the first seconds, 3 to 7 words, punchy, says only what the clips show or say "
        "(no names, numbers or claims the posts and words do not give; nothing about crimes or private lives they do not show).\n"
        "- kicker: a short question to the viewer for the end, at most 6 words.\n"
        "- origin: the TV show or event the footage is from, only if the posts say so (e.g. \"Big Brother VIP Kosova\"), else \"\".\n"
        "- sq: for each chosen stretch whose words are not Albanian, what is said in natural Albanian (short).\n"
        "Reply with only JSON: {\"pieces\": [\"u0b\", ...], \"hook\": \"...\", \"kicker\": \"...\", \"origin\": \"\", \"sq\": {\"u1a\": \"...\"}}\n\n"
        + "\n".join(lines)
    )
    # The free tier allows a few calls a minute, shared with the scout: the first model once more
    # after the wait it asks for, then the others.
    tries = [GROQ_MODEL, GROQ_MODEL, "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
    for attempt, model in enumerate(tries):
        body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.4,
                           "response_format": {"type": "json_object"}}).encode()
        req = urllib.request.Request(f"{GROQ}/chat/completions", data=body, method="POST",
                                     headers={**HEADERS, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=90) as res:
                return json.loads(json.loads(res.read().decode("utf-8"))["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as exc:
            log(f"plan model {model}: HTTP {exc.code}")
            if exc.code == 429 and attempt == 0:
                time.sleep(min(20.0, float(exc.headers.get("retry-after") or 10)))
        except (urllib.error.URLError, OSError, ValueError, KeyError, IndexError, TypeError) as exc:
            log(f"plan model {model}: {exc!r}"[:160])
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
    style = ("Style: {name},{font},{size},&H00FFFFFF,&H00FFFFFF,{outc},{back},0,0,0,0,100,100,{spacing},0,{border},{outline},{shadow},"
             "{align},{ml},{mr},{mv},1")
    styles = [
        style.format(name="Hook", font=font, size=96, outc=ORANGE, back="&H00000000", spacing=1, border=3, outline=16, shadow=0,
                     align=8, ml=150, mr=150, mv=330),
        style.format(name="Cap", font=font, size=84, outc="&H00000000", back="&H80000000", spacing=1, border=1, outline=6, shadow=2,
                     align=2, ml=140, mr=140, mv=470),
        style.format(name="Credit", font=font, size=38, outc="&H99000000", back="&H99000000", spacing=1, border=3, outline=10, shadow=0,
                     align=1, ml=150, mr=150, mv=300),
        style.format(name="Brand", font=font, size=62, outc="&H00000000", back="&H00000000", spacing=2, border=1, outline=0, shadow=0,
                     align=9, ml=150, mr=150, mv=150).replace("&H00FFFFFF,&H00FFFFFF", f"{ORANGE},{ORANGE}", 1),
        style.format(name="Kicker", font=font, size=124, outc="&H00000000", back="&H00000000", spacing=1, border=1, outline=0, shadow=0,
                     align=5, ml=160, mr=160, mv=0),
        style.format(name="Label", font=font, size=56, outc="&H00000000", back="&H00000000", spacing=6, border=1, outline=0, shadow=0,
                     align=5, ml=160, mr=160, mv=0).replace("&H00FFFFFF,&H00FFFFFF", f"{ORANGE},{ORANGE}", 1),
    ]
    end_at = total - END
    ev = []
    hook_end = min(2.8, (starts[1] + XF) if len(starts) > 1 else 2.8)
    ev.append(("Hook", 0.0, hook_end, "{\\fscx55\\fscy55\\t(0,160,\\fscx106\\fscy106)\\t(160,260,\\fscx100\\fscy100)"
                                      "\\fad(0,120)}" + ass_text(plan["hook"]).upper()))
    for s, e, text in captions:
        if s >= hook_end - 0.05 or e <= hook_end:   # the words never sit on the hook... they sit below it anyway
            pass
        ev.append(("Cap", s, min(e, end_at), text))
    for p, at in zip(pieces, starts):
        who = f"@{p['author']} · {PLATFORMS.get(p['platform'], p['platform'])}" if p.get("author") else ""
        line = " · ".join(x for x in (plan.get("origin", ""), who) if x)
        if line:
            ev.append(("Credit", at + (XF if at else 0), min(at + p["len"], end_at), ass_text(line)))
    ev.append(("Brand", 0.0, end_at, "383"))
    ev.append(("Label", end_at + 0.1, total, "{\\pos(540,780)\\fad(150,0)}VIRALE SOT · 383"))
    ev.append(("Kicker", end_at + 0.15, total, "{\\pos(540,960)\\fscx70\\fscy70\\t(0,200,\\fscx100\\fscy100)\\fad(120,0)}"
                                               + ass_text(plan["kicker"]).upper()))
    events = "\n".join(f"Dialogue: {9 if st in ('Hook', 'Kicker', 'Label') else 5},{ts(s)},{ts(e)},{st},,0,0,0,,{text}"
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

def fill(i: int, p: dict, a: dict) -> str:
    """Piece i's picture as an upright 1080x1920: an upright clip fills the frame (punched in);
    a wide one sits over a blurred copy of itself; a photo slowly pushes in."""
    frames = int(round(p["len"] * FPS)) + 2
    # fps last as well: ffmpeg 7.1's setpts drops the frame rate, and xfade needs it (8.x keeps it).
    tail = f"fps={FPS},format=yuv420p,setsar=1,trim=duration={p['len']:.3f},setpts=PTS-STARTPTS,fps={FPS}[v{i}]"
    if p.get("photo"):
        return (f"[{i}:v]scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
                f"zoompan=z='min(1+0.0011*on,1.14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},{tail}")
    wide = a.get("width", 0) and a.get("height", 0) and a["width"] / max(1, a["height"]) > 0.8
    if not wide:
        z = PUNCH[i % len(PUNCH)]
        w, h = int(W * z) // 2 * 2, int(H * z) // 2 * 2
        return f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={W}:{H},{tail}"
    z = WIDE_PUNCH[i % len(WIDE_PUNCH)]
    fg = int(W * z) // 2 * 2
    return (f"[{i}:v]split=2[bg{i}][fg{i}];[bg{i}]scale={W // 4}:{H // 4}:force_original_aspect_ratio=increase,crop={W // 4}:{H // 4},"
            f"boxblur=12:2,scale={W}:{H},eq=brightness=-0.2:saturation=1.2[bb{i}];[fg{i}]scale={fg}:-2[ff{i}];"
            f"[bb{i}][ff{i}]overlay=(W-w)/2:(H-h)/2:shortest=1,{tail}")


def build(plan: dict, sources: list[dict], analyses: list[dict], work: Path, lib: dict, seed: str) -> dict | None:
    """Renders the cut: work/cut.mp4 (1080x1920), work/cut-sd.mp4 (720x1280), work/thumb.jpg."""
    pieces = []
    for u in plan["pieces"]:
        s = sources[u["src"]]
        pieces.append({**u, "len": length(u), "file": str(Path(s["file"]).resolve()), "author": s.get("author", ""), "platform": s.get("platform", "")})
    if len(pieces) < 2:
        return None
    rng = int(hashlib.sha1(seed.encode()).hexdigest(), 16)
    root = Path(lib.get("root") or LIBRARY)
    fonts, font = font_dir(root)
    starts = timeline(pieces)
    total = round(starts[-1] + pieces[-1]["len"] - XF + END, 3)
    captions = caption_events(pieces, starts, analyses, plan.get("sq") or {})
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
        graph.append(fill(i, p, a))
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


def make_cut(story: str, sources: list[dict], work: Path, key: str, lib: dict | None = None) -> dict | None:
    """One story's cut. sources: [{"file", "author", "platform", "caption", "headline", "analysis"?}].
    Returns the files and what went into them, or None when there is not enough to cut."""
    work = work.resolve()
    work.mkdir(parents=True, exist_ok=True)
    lib = lib or load_library()
    analyses = []
    for s in sources:
        cache = Path(str(s["file"]) + ".cut.json")
        analyses.append(analyse(Path(s["file"]), key, work, cache))
    plan = plan_cut(story, sources, analyses, key)
    if len(plan["pieces"]) < 2:
        log(f"{story!r}: not enough to cut ({len(plan['units'])} stretches)")
        return None
    seed = story + "|" + "|".join(sorted(str(s.get("id", s["file"])) for s in sources))
    out = build(plan, sources, analyses, work, lib, seed)
    if not out:
        return None
    return {**out, "hook": plan["hook"], "kicker": plan["kicker"], "origin": plan["origin"], "planned_by": plan["how"]}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    out_dir = Path(sys.argv[1])
    files = [Path(f) for f in sys.argv[2:]]
    srcs = [{"file": f, "id": f.stem, "author": f.stem[:16], "platform": "tiktok", "caption": "", "headline": ""} for f in files]
    got = make_cut(os.environ.get("CUT_STORY", "trial"), srcs, out_dir, os.environ.get("GROQ_API_KEY", ""))
    print(json.dumps({k: str(v) for k, v in (got or {}).items()}, ensure_ascii=False, indent=1))
    sys.exit(0 if got else 1)
