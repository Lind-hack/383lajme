#!/usr/bin/env python3
"""383's video edition: today's top stories as short clips, voiced in Albanian.

Run on the VPS (383-video-edition.timer, 06:40 and then every hour to 22:40
Kosovo time), inside the hermes container, with the edition's own venv
(/opt/data/video-edition/.venv, which has edge-tts):

1. The stories: the front page's seven, in its order (the site's
   /api/video-edition/plan picks them the way the homepage does).
2. A spoken script for each new or changed story, 55-85 words of plain
   Albanian, written by the newsroom's model from the story alone. Every
   number and name in it must be in the story, or the clip says the story's
   own headline and summary instead.
3. The voice: Microsoft's Albanian neural voice through edge-tts (free, no
   key), with the time of every word, so the site can show the words as
   they are said.
4. Published to the public storage bucket video-edition: audio/<slug>-<hash>.mp3
   (never changes once written) and index.json, which the site reads.

A story that has not changed keeps its clip: only new stories cost a script
and a voice. If the model or the voice fails, the clip still goes out, with
the story's own words or with no voice (the site shows the words alone).
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

MAX_STORIES = 7
BUCKET = "video-edition"
INDEX = "index.json"
KEEP_AUDIO = timedelta(days=3)
MIN_WORDS, MAX_WORDS = 30, 110
KOSOVO = ZoneInfo("Europe/Belgrade")  # the host has no Europe/Pristina; same clock

SITE = os.environ.get("SITE_URL", "https://383ks.com").rstrip("/")
VOICE = os.environ.get("L383_EDITION_VOICE", "sq-AL-AnilaNeural")
RATE = os.environ.get("L383_EDITION_RATE", "+6%")
HERMES = os.environ.get("L383_HERMES_BIN", "/opt/hermes/.venv/bin/hermes")
MODEL = os.environ.get("L383_EDITION_MODEL", os.environ.get("L383_WRITER_MODEL", "gpt-6-luna"))
STATE = Path(os.environ.get("L383_EDITION_STATE", "/opt/data/video-edition/clips.json"))
HEADERS = {"User-Agent": "383VideoEdition/1.0 (https://383ks.com; daily video edition)"}

# Names the script may use although the story writes them short.
SPELLED_OUT = {"Shtetet", "Shteteve", "Bashkuara", "Bashkimi", "Bashkimit", "Evropian", "Evropiane", "Kombet", "Kombeve"}

RULES = """You write the voice-over for 383's video edition: each of today's top stories as one
short clip, read aloud in Albanian by a synthetic voice over the story's photo.

For every story in the brief, write ONE spoken script:
- Standard Albanian, the way a good newsreader talks to a friend: short, clear sentences.
- 55 to 85 words, 3 to 5 sentences.
- The first sentence is the news itself, the strongest fact. No greeting, no "Në lajmin e sotëm",
  no "Mirëmëngjes", no question to the viewer.
- Then the context that makes it make sense, then what happens next or why it matters, but ONLY
  if the story says so.
- Use only facts that are in the story. No number, name, date or place that the story does not
  contain. Do not guess, do not add background you know from elsewhere.
- Never name a newspaper, TV, website or news agency, and never say "sipas mediave".
- Numbers as digits (40 mijë, 3,5 për qind, 17 tetor 2026). Write "për qind", never "%";
  "euro", never "€".
- Write in full the short names the voice reads badly: SHBA -> Shtetet e Bashkuara,
  BE -> Bashkimi Evropian, OKB -> Kombet e Bashkuara. NATO, KFOR, FIFA, UEFA can stay.
- No emoji, no hashtags, no quotation marks around whole sentences, no lists.
- The last sentence ends the clip; do not say "lexoni më shumë" or "na ndiqni".

Reply with ONLY this, exactly, nothing before or after:
383_JSON_BEGIN
[{"slug": "<the story's slug>", "script": "<the script>"}]
383_JSON_END
"""


# ── 1. The stories ───────────────────────────────────────────────────────────

def get_json(url: str, extra: dict | None = None, timeout: int = 30):
    req = urllib.request.Request(url, headers={**HEADERS, **(extra or {})})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def plan() -> list[dict]:
    """The front page's seven, from the site; if the site does not answer, the
    newest seven of the last day straight from the newsroom's table."""
    try:
        data = get_json(f"{SITE}/api/video-edition/plan")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"EDITION site plan unavailable ({exc}); newest stories instead", file=sys.stderr)
        data = {"stories": newest_stories()}
    stories = [s for s in (data or {}).get("stories", []) if isinstance(s, dict) and s.get("slug") and s.get("title")]
    return stories[:MAX_STORIES]


def newest_stories() -> list[dict]:
    base = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    query = urllib.parse.urlencode({
        "select": "slug,title,excerpt,body,category,published_at,image_url,raw_article",
        "published_at": f"gte.{since}", "order": "published_at.desc", "limit": str(MAX_STORIES),
    })
    rows = get_json(f"{base}/rest/v1/news_articles?{query}", {"apikey": key, "Authorization": f"Bearer {key}"})
    out = []
    for r in rows if isinstance(rows, list) else []:
        raw = r.get("raw_article") if isinstance(r.get("raw_article"), dict) else {}
        rights = raw.get("image_rights") if isinstance(raw.get("image_rights"), dict) else {}
        page = str(rights.get("source_page") or "")
        out.append({
            "slug": r.get("slug"), "title": r.get("title"), "excerpt": r.get("excerpt"), "body": r.get("body"),
            "category": r.get("category"), "publishedAt": r.get("published_at"), "imageUrl": r.get("image_url") or "",
            "imageCreator": str(rights.get("creator") or ""), "imageLicense": str(rights.get("license") or ""),
            "imageSourcePage": page if page.startswith("https://commons.wikimedia.org/wiki/File:") else "",
        })
    return out


# ── 2. The script ────────────────────────────────────────────────────────────

def story_hash(story: dict) -> str:
    text = "\n".join(str(story.get(k) or "") for k in ("title", "excerpt", "body"))
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


def plain(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", str(text or ""))
    text = re.sub(r"[*_#>`]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def write_scripts(stories: list[dict], workdir: Path) -> dict[str, str]:
    """One model call for every story that needs a script; {slug: script}."""
    if not stories:
        return {}
    brief = workdir / "edition-brief.md"
    blocks = []
    for s in stories:
        # Readable lines: the model's file tool cuts very long ones.
        body = plain(s.get("body"))[:5000]
        sentences = re.split(r"(?<=[.!?])\s+", body)
        blocks.append("\n".join([
            f"## Story {s['slug']}",
            f"slug: {s['slug']}",
            f"section: {s.get('category', '')}",
            f"headline: {plain(s.get('title'))}",
            f"summary: {plain(s.get('excerpt'))}",
            "story:",
            *sentences,
        ]))
    brief.write_text("# Today's stories\n\n" + "\n\n".join(blocks) + "\n", encoding="utf-8")
    prompt = f"Read {brief} with the file tool, then follow these rules.\n\n{RULES}"
    try:
        done = subprocess.run([HERMES, "chat", "--provider", "openai-codex", "--model", MODEL, "--ignore-rules",
                               # Built-in reasoning, not the newsroom's "max": at max the stream stalls
                               # (no events for 12 s) and the call fails.
                               "--ignore-user-config", "-t", "file", "--yolo", "--max-turns", "20", "-Q", "-q", prompt],
                              capture_output=True, text=True, encoding="utf-8", timeout=600, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"EDITION script writer failed: {exc}", file=sys.stderr)
        return {}
    scripts = parse_scripts(done.stdout, {s["slug"] for s in stories})
    if not scripts:
        print(f"EDITION script writer gave nothing (exit {done.returncode}): {(done.stdout + done.stderr)[-600:]}", file=sys.stderr)
    return scripts


def parse_scripts(output: str, slugs: set[str]) -> dict[str, str]:
    start = output.rfind("383_JSON_BEGIN")
    end = output.find("383_JSON_END", start + 14)
    if start < 0 or end < 0:
        return {}
    try:
        rows = json.loads(output[start + 14:end])
    except ValueError:
        return {}
    out = {}
    for row in rows if isinstance(rows, list) else []:
        if isinstance(row, dict) and row.get("slug") in slugs and isinstance(row.get("script"), str):
            out[row["slug"]] = re.sub(r"\s+", " ", row["script"]).strip()
    return out


def numbers_in(text: str) -> set[str]:
    """Every number, however it is grouped: 1.250, 1,250 and 1 250 are one number."""
    found = re.findall(r"\d{1,3}(?:[   ]\d{3})+(?!\d)|\d[\d.,]*\d|\d", text)
    return {re.sub(r"[.,\s  ]", "", n) for n in found}


def check_script(script: str, story: dict) -> tuple[bool, str]:
    """The script may say only what the story says: its numbers and its names."""
    words = script.split()
    if not MIN_WORDS <= len(words) <= MAX_WORDS:
        return False, f"{len(words)} words"
    source = " ".join(plain(story.get(k)) for k in ("title", "excerpt", "body"))
    low = source.lower()
    missing = numbers_in(script) - numbers_in(source)
    if missing:
        return False, "numbers not in the story: " + ", ".join(sorted(missing))
    # A capitalised word that does not start a sentence is a name: the story must have it
    # (its stem, since Albanian names take endings: Kurti, Kurtit, Kurtin).
    for sentence in re.split(r"(?<=[.!?])\s+", script):
        for word in re.findall(r"[A-ZÇË][\wçëÇË-]*", " ".join(sentence.split()[1:])):
            if word in SPELLED_OUT or word in {"NATO", "KFOR", "FIFA", "UEFA"}:
                continue
            stem = word.lower()[: max(4, len(word) - 3)]
            if stem not in low:
                return False, f"name not in the story: {word}"
    if re.search(r"[%€#]|https?://", script):
        return False, "symbols the voice reads badly"
    return True, ""


def fallback_script(story: dict) -> str:
    """The story's own headline and summary: checked words, never the model's."""
    title = plain(story.get("title")).rstrip(".!?")
    return f"{title}. {plain(story.get('excerpt'))}".strip()


def spoken(text: str) -> str:
    """What the voice is given: the few signs it reads badly, in words."""
    text = re.sub(r"\s*%", " për qind", text)
    text = re.sub(r"\s*€", " euro", text)
    return text


# ── 3. The voice ─────────────────────────────────────────────────────────────

async def _voice(text: str) -> tuple[bytes, list[list]]:
    import edge_tts  # in the edition's venv only

    com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    audio = bytearray()
    words: list[list] = []
    async for chunk in com.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            start = chunk["offset"] / 1e7
            words.append([round(start, 2), round(start + chunk["duration"] / 1e7, 2), chunk["text"]])
    return bytes(audio), words


def voice(text: str) -> tuple[bytes, list[list]] | None:
    for _ in range(2):
        try:
            audio, words = asyncio.run(_voice(text))
        except Exception as exc:  # edge-tts raises its own types; any failure means no voice
            print(f"EDITION voice failed: {exc}", file=sys.stderr)
            continue
        if len(audio) > 4000 and words:
            return audio, words
    return None


def duration_of(audio: bytes, words: list[list]) -> float:
    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        f.write(audio)
        f.flush()
        try:
            out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f.name],
                                 capture_output=True, text=True, timeout=20, check=False).stdout.strip()
            return round(float(out), 2)
        except (OSError, ValueError, subprocess.TimeoutExpired):
            return round(words[-1][1] + 0.4, 2) if words else 0.0


# ── 4. Storage ───────────────────────────────────────────────────────────────

def storage(method: str, path: str, body: bytes | None = None, extra: dict | None = None) -> tuple[int, bytes]:
    base = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(f"{base}/storage/v1/{path}", data=body, method=method,
                                 # Cloudflare in front of storage refuses Python's default agent (error 1010).
                                 headers={"apikey": key, "Authorization": f"Bearer {key}", **HEADERS, **(extra or {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def public_url(path: str) -> str:
    return f"{os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')}/storage/v1/object/public/{BUCKET}/{path}"


def ensure_bucket() -> None:
    conf = {"public": True, "allowed_mime_types": ["application/json", "audio/mpeg"]}
    if storage("GET", f"bucket/{BUCKET}")[0] != 200:
        storage("POST", "bucket", json.dumps({"id": BUCKET, "name": BUCKET, **conf}).encode(), {"Content-Type": "application/json"})


def upload(path: str, body: bytes, kind: str, cache: str) -> bool:
    status, _ = storage("POST", f"object/{BUCKET}/{path}", body, {"Content-Type": kind, "x-upsert": "true", "cache-control": cache})
    return status in (200, 201)


def remove(paths: list[str]) -> None:
    if paths:
        storage("DELETE", f"object/{BUCKET}", json.dumps({"prefixes": paths}).encode(), {"Content-Type": "application/json"})


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
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(STATE)


def make_clip(story: dict, script: str, how: str, now: datetime) -> dict:
    h = story_hash(story)
    clip = {"hash": h, "script": script, "how": how, "madeAt": now.isoformat(), "audio": "", "duration": 0, "words": []}
    voiced = voice(spoken(script))
    if voiced:
        audio, words = voiced
        path = f"audio/{story['slug']}-{h}.mp3"
        if upload(path, audio, "audio/mpeg", "31536000"):
            clip.update(audio=path, duration=duration_of(audio, words), words=words)
    if not clip["audio"]:
        # No voice: the words on screen alone, at an easy reading pace.
        clip["duration"] = round(max(8.0, len(script.split()) / 2.6), 1)
    return clip


def edition_entry(story: dict, clip: dict) -> dict:
    return {
        "slug": story["slug"],
        "title": plain(story.get("title")),
        "excerpt": plain(story.get("excerpt")),
        "category": story.get("category", ""),
        "publishedAt": story.get("publishedAt", ""),
        "image": story.get("imageUrl", ""),
        "imageCreator": story.get("imageCreator", ""),
        "imageLicense": story.get("imageLicense", ""),
        "imageSourcePage": story.get("imageSourcePage", ""),
        "script": clip["script"],
        "audio": public_url(clip["audio"]) if clip.get("audio") else "",
        "duration": clip.get("duration", 0),
        "words": clip.get("words", []),
    }


def main(dry_run: bool = False) -> int:
    now = datetime.now(timezone.utc)
    try:
        stories = plan()
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"EDITION no plan: {exc}", file=sys.stderr)
        return 1
    if not stories:
        print("EDITION no stories", file=sys.stderr)
        return 1

    state = load_state()
    clips = state.get("clips", {}) if isinstance(state.get("clips"), dict) else {}
    retired = [r for r in state.get("retired", []) if isinstance(r, dict) and r.get("audio")]
    fresh = [s for s in stories if (clips.get(s["slug"]) or {}).get("hash") != story_hash(s)]
    print(f"EDITION {len(stories)} stories, {len(fresh)} new or changed")

    with tempfile.TemporaryDirectory(prefix="383-edition-") as tmp:
        written = write_scripts(fresh, Path(tmp))
    if not dry_run:
        ensure_bucket()
    for s in fresh:
        script, how = written.get(s["slug"], ""), "model"
        ok, why = check_script(script, s) if script else (False, "no script")
        if not ok:
            print(f"EDITION {s['slug']}: own words ({why})")
            script, how = fallback_script(s), "story"
        if dry_run:
            print(f"--- {s['slug']} [{how}]\n{script}\n")
            continue
        before = (clips.get(s["slug"]) or {}).get("audio")
        clips[s["slug"]] = make_clip(s, script, how, now)
        # A story that changed gets a new clip. Its old voice stays a day: pages
        # cached on the site may still play it.
        if before and before != clips[s["slug"]].get("audio"):
            retired.append({"audio": before, "at": now.isoformat()})
    if dry_run:
        return 0

    edition = {
        "date": now.astimezone(KOSOVO).date().isoformat(),
        "updatedAt": now.isoformat(),
        "voice": VOICE,
        "clips": [edition_entry(s, clips[s["slug"]]) for s in stories if s["slug"] in clips],
    }
    if not upload(INDEX, json.dumps(edition, ensure_ascii=False).encode("utf-8"), "application/json", "60"):
        print("EDITION index upload failed", file=sys.stderr)
        return 1

    # Clips not in today's edition are kept three days (a shared link still plays), then removed.
    live = {s["slug"] for s in stories}
    old = [slug for slug, c in clips.items()
           if slug not in live and now - datetime.fromisoformat(c.get("madeAt", now.isoformat())) > KEEP_AUDIO]
    gone = [r for r in retired if now - datetime.fromisoformat(r.get("at", now.isoformat())) > timedelta(days=1)]
    remove([clips[slug]["audio"] for slug in old if clips[slug].get("audio")] + [r["audio"] for r in gone])
    for slug in old:
        clips.pop(slug, None)
    save_state({"clips": clips, "retired": [r for r in retired if r not in gone], "lastRun": now.isoformat()})
    voiced = sum(1 for c in edition["clips"] if c["audio"])
    print(f"EDITION published {len(edition['clips'])} clips ({voiced} voiced, {len(fresh)} new)")
    return 0


if __name__ == "__main__":
    sys.exit(main(dry_run="--dry-run" in sys.argv))
