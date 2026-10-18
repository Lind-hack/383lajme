#!/usr/bin/env python3
"""383's video edition: today's top stories as short clips, voiced in Albanian.

Run on the VPS (383-video-edition.timer, 06:40 and then every hour to 22:40
Kosovo time), inside the hermes container, with the edition's own venv
(/opt/data/video-edition/.venv, which has edge-tts):

1. The stories: the front page's seven, in its order (the site's
   /api/video-edition/plan picks them the way the homepage does).
2. A spoken script for each new or changed story, 55-85 words of plain
   Albanian, written by the newsroom's model from the story alone, with what
   the clip can show: the story's people and places, two numbers to show
   big, a quote, a search for footage. Every number, name and quote must be
   in the story; a script that fails says the story's own headline and
   summary instead.
3. The footage: YouTube's search finds videos of the event and the model
   keeps only those the people or institutions posted themselves; pieces of
   them (and of freely licensed Commons and Pexels video) are cut for the clip.
4. The voice, the photos, the map and the beats (scripts/video_edition_media.py).
5. The finished video: transitions, sound design, music and the words burned
   in, rendered with HyperFrames (scripts/video_edition_render.py).
6. Published to the public storage bucket video-edition: video/, audio/ and
   maps/ (never change once written) and index.json, which the site reads,
   written again after every clip so the edition fills in as it renders.

A story that has not changed keeps its clip: only new stories cost a script
and a voice. If the model or the voice fails, the clip still goes out, with
the story's own words or with no voice (the site shows the words alone).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
import video_edition_media as media  # noqa: E402
import video_edition_render as render  # noqa: E402

MAX_STORIES = 7
BUCKET = "video-edition"
INDEX = "index.json"
KEEP_AUDIO = timedelta(days=3)
MIN_WORDS, MAX_WORDS = 30, 110
# Bumped when a clip is made differently: every story is made again once.
CLIP_VERSION = "4"
KOSOVO = ZoneInfo("Europe/Belgrade")  # the host has no Europe/Pristina; same clock

SITE = os.environ.get("SITE_URL", "https://383ks.com").rstrip("/")
HERMES = os.environ.get("L383_HERMES_BIN", "/opt/hermes/.venv/bin/hermes")
MODEL = os.environ.get("L383_EDITION_MODEL", os.environ.get("L383_WRITER_MODEL", "gpt-6-luna"))
STATE = Path(os.environ.get("L383_EDITION_STATE", "/opt/data/video-edition/clips.json"))
SKILLS = Path(os.environ.get("HERMES_HOME", "/opt/data/news-pipeline-hermes")) / "skills" / "creative"
HEADERS = {"User-Agent": "383VideoEdition/1.0 (https://383ks.com; daily video edition)"}

# Names the script may use although the story writes them short.
SPELLED_OUT = {"Shtetet", "Shteteve", "Bashkuara", "Bashkimi", "Bashkimit", "Evropian", "Evropiane", "Kombet", "Kombeve"}

RULES = """You write the voice-over for 383's video edition: each of today's top stories as one
short clip, read aloud in Albanian by a warm synthetic voice over photos, maps and footage.

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

For every story also say what the clip can show while the voice reads:
- "subjects": up to 4 exact English Wikipedia article titles of the people, organisations,
  buildings or places the story names (e.g. "Edi Rama", "Tirana", "California Department of
  Forestry and Fire Protection"). Only ones the story itself names.
- "place": the exact English Wikipedia title of the one city or region where it happens, or "";
  "place_name": the same place's name in Albanian, in its base form (Parisi, Tirana, Kalifornia).
- "facts": up to 2 striking numbers to show big on screen, each
  {"value": "40 mijë", "label": "veta prisnin në protestën e Parisit"}: the value as the script
  says it (digits and their unit word, at most 14 characters), the label 3 to 8 Albanian words.
  Only numbers that are in the story and in your script.
- "quote": one short sentence a person in the story said, copied EXACTLY as the story prints it,
  as {"text": "...", "who": "<their name as in the story>"}, or null when there is none.
- "youtube": 2 or 3 short YouTube searches (3 to 5 words each) for video of this very event:
  the key names and the occasion, one in English and one in the language of the country where
  it happened (e.g. ["Merz Junge Union Deutschlandtag", "Merz speech Junge Union"]). No dates.
- "sources": up to 4 names of official channels that may have posted their own video of it: the
  people or institutions themselves (governments, ministries, police, fire services, parties,
  leagues, clubs, companies). Never a news outlet.

And how the clip should feel, the way a good short-form editor would cut it:
- "mood": the story's tone, one of "tense" (war, protests, crime, disasters, deaths), "serious"
  (politics, economy, courts, institutions), "calm" (culture, lifestyle, health, society, weather),
  "bright" (sport, technology, science, achievements, good news). It picks the music under the voice.
- "hook": your script's first sentence, copied exactly. Write it so a viewer scrolling past stops:
  the most surprising true fact first, concrete, no warm-up.
- "climax": 2 to 6 consecutive words copied exactly from your script: the moment the viewer is
  waiting for (the outcome, the number, the decision). The sound builds up to it.
- "emphasis": up to 3 single words from your script that carry the story (a name, a number, a verb).

Reply with ONLY this, exactly, nothing before or after:
383_JSON_BEGIN
[{"slug": "<the story's slug>", "script": "<the script>", "subjects": [], "place": "",
  "place_name": "", "facts": [], "quote": null, "youtube": [], "sources": [],
  "mood": "serious", "hook": "", "climax": "", "emphasis": []}]
383_JSON_END
"""

FOOTAGE_RULES = """You pick footage for 383's video edition. For each story in the brief there is a list of
YouTube videos (channel and title). Keep a video ONLY if both are true:
1. The channel is a primary source: the person, team or organisation in the story itself, or a
   government, ministry, parliament, police, fire or emergency service, public agency, party,
   league, club or company directly involved. NEVER a news outlet, TV channel, newspaper,
   magazine, news agency, aggregator, commentator, fan or reaction channel, or a broadcaster
   that holds the rights to the event.
2. The title shows it is this very event (the same people, place and occasion), not a different
   one. Every video listed was posted in the last week.
At most 2 per story; none is a fine answer.

Reply with ONLY this, exactly, nothing before or after:
383_JSON_BEGIN
{"<slug>": ["<video id>", ...]}
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
    text = CLIP_VERSION + "\n" + "\n".join(str(story.get(k) or "") for k in ("title", "excerpt", "body", "imageUrl"))
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


def plain(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", str(text or ""))
    text = re.sub(r"[*_#>`]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def ask_model(prompt: str, label: str) -> str:
    try:
        done = subprocess.run([HERMES, "chat", "--provider", "openai-codex", "--model", MODEL, "--ignore-rules",
                               # Built-in reasoning, not the newsroom's "max": at max the stream stalls
                               # (no events for 12 s) and the call fails.
                               "--ignore-user-config", "-t", "file", "--yolo", "--max-turns", "20", "-Q", "-q", prompt],
                              capture_output=True, text=True, encoding="utf-8", timeout=600, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"EDITION {label} failed: {exc}", file=sys.stderr)
        return ""
    if "383_JSON_END" not in done.stdout:
        print(f"EDITION {label} gave nothing (exit {done.returncode}): {(done.stdout + done.stderr)[-600:]}", file=sys.stderr)
    return done.stdout


def between_markers(output: str):
    start = output.rfind("383_JSON_BEGIN")
    end = output.find("383_JSON_END", start + 14)
    if start < 0 or end < 0:
        return None
    try:
        return json.loads(output[start + 14:end])
    except ValueError:
        return None


def write_scripts(stories: list[dict], workdir: Path) -> dict[str, dict]:
    """One model call for every story that needs a script; {slug: {"script", "subjects", ...}}."""
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
    # The short-form craft skill (installed in the newsroom's Hermes): its hook and pacing
    # rules shape the first sentence and the climax; the rules below win where they differ.
    craft = SKILLS / "openmontage-short-form" / "short-form.md"
    read_craft = f"Also read {craft} (the sections on the hook and on pacing) before writing. " if craft.exists() else ""
    prompt = f"Read {brief} with the file tool. {read_craft}Then follow these rules.\n\n{RULES}"
    return parse_scripts(ask_model(prompt, "script writer"), {s["slug"] for s in stories})


def strings(v, n: int, size: int = 120) -> list[str]:
    return [str(x).strip()[:size] for x in v if isinstance(x, str) and x.strip()][:n] if isinstance(v, list) else []


def parse_scripts(output: str, slugs: set[str]) -> dict[str, dict]:
    rows = between_markers(output)
    out = {}
    for row in rows if isinstance(rows, list) else []:
        if not (isinstance(row, dict) and row.get("slug") in slugs and isinstance(row.get("script"), str)):
            continue
        quote = row.get("quote") if isinstance(row.get("quote"), dict) else None
        out[row["slug"]] = {
            "script": re.sub(r"\s+", " ", row["script"]).strip(),
            "subjects": strings(row.get("subjects"), 4),
            "place": str(row.get("place") or "").strip()[:120],
            "place_name": str(row.get("place_name") or "").strip()[:40],
            "facts": [{"value": str(f.get("value", "")).strip(), "label": str(f.get("label", "")).strip()}
                      for f in row.get("facts", []) if isinstance(f, dict)][:2] if isinstance(row.get("facts"), list) else [],
            "quote": {"text": str(quote.get("text", "")).strip(), "who": str(quote.get("who", "")).strip()} if quote else None,
            "youtube": strings(row.get("youtube"), 3, 80) if isinstance(row.get("youtube"), list)
                       else strings([row.get("youtube")], 1, 80),
            "sources": strings(row.get("sources"), 4, 80),
            "mood": str(row.get("mood") or "").strip().lower()[:12],
            "hook": str(row.get("hook") or "").strip()[:300],
            "climax": str(row.get("climax") or "").strip()[:80],
            "emphasis": strings(row.get("emphasis"), 3, 30),
        }
    return out


def check_facts(facts: list[dict], script: str, story: dict) -> list[dict]:
    """A number shown big must be in the story and said in the script."""
    source = story_numbers(" ".join(plain(story.get(k)) for k in ("title", "excerpt", "body")))
    said = numbers_in(script)
    ok = []
    for f in facts:
        nums = numbers_in(f["value"])
        if nums and nums <= source and nums <= said and len(f["value"]) <= 16 and 2 <= len(f["label"].split()) <= 10:
            ok.append(f)
    return ok


def check_feel(w: dict, script: str) -> dict:
    """The edit's cues are kept only where they are the script's own words."""
    said = flat(script)
    words = set(re.findall(r"[\wçë]+", said))
    hook, climax = flat(w.get("hook", "")), flat(w.get("climax", ""))
    return {
        "mood": w.get("mood") if w.get("mood") in render.MOODS else "",
        "hook": w.get("hook", "") if hook and said.startswith(hook) else "",
        "climax": w.get("climax", "") if climax and climax in said and 2 <= len(climax.split()) <= 8 else "",
        "emphasis": [e for e in w.get("emphasis", []) if flat(e) in words][:3],
    }


def flat(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[“”„«»\"']", "", text)).strip().lower()


def check_quote(quote: dict | None, story: dict) -> dict | None:
    """A quote is shown only as the story prints it, word for word."""
    if not quote or not quote.get("text") or not quote.get("who") or len(quote["text"]) > 170:
        return None
    body = flat(" ".join(plain(story.get(k)) for k in ("excerpt", "body")))
    return quote if flat(quote["text"]) in body and flat(quote["who"]).split()[-1] in body else None


def pick_footage(found: dict[str, list[dict]], workdir: Path) -> dict[str, list[dict]]:
    """The model keeps only the people's and institutions' own videos of the event."""
    found = {slug: c for slug, c in found.items() if c}
    if not found:
        return {}
    brief = workdir / "footage-brief.md"
    blocks = []
    for slug, cands in found.items():
        blocks.append("\n".join([f"## Story {slug}", *[f"- {c['id']} | channel: {c['channel']} | posted {c['posted']} | title: {c['title']}" for c in cands]]))
    brief.write_text("# Footage candidates\n\n" + "\n\n".join(blocks) + "\n", encoding="utf-8")
    picked = between_markers(ask_model(f"Read {brief} with the file tool, then follow these rules.\n\n{FOOTAGE_RULES}", "footage judge"))
    out = {}
    for slug, cands in found.items():
        ids = picked.get(slug) if isinstance(picked, dict) and isinstance(picked.get(slug), list) else []
        out[slug] = [c for c in cands if c["id"] in ids][:2]
    return out


def numbers_in(text: str) -> set[str]:
    """Every number, however it is grouped: 1.250, 1,250 and 1 250 are one number."""
    found = re.findall(r"\d{1,3}(?:[   ]\d{3})+(?!\d)|\d[\d.,]*\d|\d", text)
    return {re.sub(r"[.,\s  ]", "", n) for n in found}


NUMBER_WORDS = {
    "një": 1, "dy": 2, "tre": 3, "tri": 3, "katër": 4, "pesë": 5, "gjashtë": 6, "shtatë": 7, "tetë": 8, "nëntë": 9,
    "dhjetë": 10, "njëmbëdhjetë": 11, "dymbëdhjetë": 12, "trembëdhjetë": 13, "katërmbëdhjetë": 14, "pesëmbëdhjetë": 15,
    "gjashtëmbëdhjetë": 16, "shtatëmbëdhjetë": 17, "tetëmbëdhjetë": 18, "nëntëmbëdhjetë": 19, "njëzet": 20,
    "tridhjetë": 30, "dyzet": 40, "pesëdhjetë": 50, "gjashtëdhjetë": 60, "shtatëdhjetë": 70, "tetëdhjetë": 80,
    "nëntëdhjetë": 90, "njëqind": 100,
}


def story_numbers(text: str) -> set[str]:
    """The story's numbers, the ones it spells out ("dy dispozita") as well."""
    words = {str(NUMBER_WORDS[w]) for w in re.findall(r"[a-zçë]+", text.lower()) if w in NUMBER_WORDS}
    return numbers_in(text) | words


def check_script(script: str, story: dict) -> tuple[bool, str]:
    """The script may say only what the story says: its numbers and its names."""
    words = script.split()
    if not MIN_WORDS <= len(words) <= MAX_WORDS:
        return False, f"{len(words)} words"
    source = " ".join(plain(story.get(k)) for k in ("title", "excerpt", "body"))
    low = source.lower()
    missing = numbers_in(script) - story_numbers(source)
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


# ── 4. Storage ───────────────────────────────────────────────────────────────

def storage(method: str, path: str, body: bytes | None = None, extra: dict | None = None) -> tuple[int, bytes]:
    # On the VPS the storage gateway is next door (L383_EDITION_STORAGE): a video
    # sent through Cloudflare comes back 502, and so does the bucket update.
    base = os.environ.get("L383_EDITION_STORAGE", "").rstrip("/") or os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(f"{base}/storage/v1/{path}", data=body, method=method,
                                 # Cloudflare in front of storage refuses Python's default agent (error 1010).
                                 headers={"apikey": key, "Authorization": f"Bearer {key}", **HEADERS, **(extra or {})})
    try:
        with urllib.request.urlopen(req, timeout=180 if body and len(body) > 2_000_000 else 30) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def public_url(path: str) -> str:
    return f"{os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')}/storage/v1/object/public/{BUCKET}/{path}"


def ensure_bucket() -> None:
    conf = {"public": True, "allowed_mime_types": ["application/json", "audio/mpeg", "image/jpeg", "video/mp4"]}
    if storage("GET", f"bucket/{BUCKET}")[0] != 200:
        storage("POST", "bucket", json.dumps({"id": BUCKET, "name": BUCKET, **conf}).encode(), {"Content-Type": "application/json"})
    else:
        # The bucket began with voices only; maps are images, clips are videos.
        status, reply = storage("PUT", f"bucket/{BUCKET}", json.dumps(conf).encode(), {"Content-Type": "application/json"})
        if status != 200:
            print(f"EDITION bucket update failed: HTTP {status} {reply[:160]!r}", file=sys.stderr)


def upload(path: str, body: bytes, kind: str, cache: str) -> bool:
    status, reply = storage("POST", f"object/{BUCKET}/{path}", body, {"Content-Type": kind, "x-upsert": "true", "cache-control": cache})
    if status not in (200, 201):
        print(f"EDITION upload {path} failed: HTTP {status} {reply[:160]!r}", file=sys.stderr)
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


def make_clip(story: dict, script: str, how: str, look: dict, picked: list[dict], now: datetime, workdir: Path) -> dict:
    """The voice, the pictures, the beats and the rendered video of one story's clip."""
    h = story_hash(story)
    clip = {"hash": h, "script": script, "how": how, "madeAt": now.isoformat(), "audio": "", "duration": 0,
            "words": [], "beats": [], "files": [], "voice": "", "video": {}}
    voiced = media.voice_clip(spoken(script))
    if voiced:
        path = f"audio/{story['slug']}-{h}.mp3"
        if upload(path, voiced["mp3"], "audio/mpeg", "31536000"):
            clip.update(audio=path, duration=voiced["duration"], words=voiced["words"], voice=voiced["voice"])
            clip["files"].append(path)
    if not clip["audio"]:
        # No voice: the words on screen alone, at an easy reading pace.
        clip["duration"] = round(max(8.0, len(script.split()) / 2.6), 1)

    # The pictures: anything that fails here leaves the story's own photo, never no clip.
    photos = [{"src": story["imageUrl"], "credit": ""}] if story.get("imageUrl") else []
    place = None
    footage: list[dict] = []
    pages: dict[str, dict] = {}
    try:
        titles = look.get("subjects", []) + ([look["place"]] if look.get("place") else [])
        pages = media.wiki_pages(titles)
        # The place too: a story about two clubs with no photos still has its city.
        photos = media.story_photos(story, look.get("subjects", []) + ([look["place"]] if look.get("place") else []), pages) or photos
        where = pages.get(look.get("place", "")) if look.get("place") else None
        if where and where.get("lat") is not None:
            jpeg = media.map_image(float(where["lat"]), float(where["lon"]), where.get("dim"))
            path = f"maps/{story['slug']}-{h}.jpg"
            if jpeg and upload(path, jpeg, "image/jpeg", "31536000"):
                place = {"src": public_url(path), "label": look.get("place_name") or look["place"]}
                clip["files"].append(path)
    except Exception as exc:  # a picture source misbehaving must not stop the edition
        print(f"EDITION {story['slug']}: pictures failed ({exc!r})", file=sys.stderr)
    if voiced:
        # Moving picture only for a clip that will be rendered (it needs the voice).
        try:
            qids = [p.get("qid", "") for p in pages.values()]
            footage = media.gather_footage(picked, qids, look.get("place", ""), str(workdir))
        except Exception as exc:  # a footage source misbehaving must not stop the clip
            print(f"EDITION {story['slug']}: footage failed ({exc!r})", file=sys.stderr)
    clip["beats"] = media.build_beats(clip["duration"], clip["words"], photos, look.get("facts", []), place,
                                      look.get("quote"), footage)
    clip["footage"] = len(footage)
    if voiced and clip["beats"]:
        made = render.make_video(story["slug"], {**clip, "title": plain(story.get("title")), "category": story.get("category", ""),
                                                  "color": ""}, voiced["mp3"], look, workdir)
        if made:
            video = {}
            for kind, mime in (("hd", "video/mp4"), ("sd", "video/mp4"), ("poster", "image/jpeg")):
                path = f"video/{story['slug']}-{h}-{kind}.{'jpg' if kind == 'poster' else 'mp4'}"
                if upload(path, made[kind].read_bytes(), mime, "31536000"):
                    video[kind] = path
                    clip["files"].append(path)
            if len(video) == 3:
                clip["video"] = video
                # What the video shows when, for the credit line under it.
                clip["beats"] = made["beats"]
                clip["mood"] = made["cues"].get("music", "")
    return clip


def edition_entry(story: dict, clip: dict) -> dict:
    video = clip.get("video") if isinstance(clip.get("video"), dict) and len(clip["video"]) == 3 else {}
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
        "beats": [public_beat(b) for b in clip.get("beats", []) if b.get("kind") != "video" or b.get("youtube") or video],
        "video": {k: public_url(v) for k, v in video.items()} if video else None,
    }


def public_beat(b: dict) -> dict:
    """A beat as the site gets it: no paths on this machine."""
    return {k: v for k, v in b.items() if k != "file"}


def publish(stories: list[dict], clips: dict, now: datetime) -> dict | None:
    """index.json: today's stories that have a clip, in the front page's order."""
    edition = {
        "date": now.astimezone(KOSOVO).date().isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "clips": [edition_entry(s, clips[s["slug"]]) for s in stories if s["slug"] in clips],
    }
    if not upload(INDEX, json.dumps(edition, ensure_ascii=False).encode("utf-8"), "application/json", "60"):
        print("EDITION index upload failed", file=sys.stderr)
        return None
    return edition


def main(dry_run: bool = False, only: str = "", force: bool = False, keep: str = "") -> int:
    import fcntl  # the VPS (Linux) only; the tests import this file on any machine

    STATE.parent.mkdir(parents=True, exist_ok=True)
    lock = open(STATE.with_suffix(".lock"), "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print("EDITION another run is still going", file=sys.stderr)
        return 0
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
    retired = [r for r in state.get("retired", []) if isinstance(r, dict) and (r.get("files") or r.get("audio"))]
    fresh = [s for s in stories if force or (clips.get(s["slug"]) or {}).get("hash") != story_hash(s)]
    if only:
        fresh = [s for s in fresh if s["slug"] == only]
    print(f"EDITION {len(stories)} stories, {len(fresh)} new or changed")

    with tempfile.TemporaryDirectory(prefix="383-edition-") as tmp:
        written = write_scripts(fresh, Path(tmp))
        looks: dict[str, dict] = {}
        for s in fresh:
            w = written.get(s["slug"]) or {}
            script, how = w.get("script", ""), "model"
            ok, why = check_script(script, s) if script else (False, "no script")
            if not ok:
                print(f"EDITION {s['slug']}: own words ({why})")
                script, how = fallback_script(s), "story"
            looks[s["slug"]] = {
                "script": script, "how": how,
                "subjects": w.get("subjects", []), "place": w.get("place", ""), "place_name": w.get("place_name", ""),
                "facts": check_facts(w.get("facts", []), script, s), "quote": check_quote(w.get("quote"), s),
                **(check_feel(w, script) if how == "model" else {"mood": w.get("mood") if w.get("mood") in render.MOODS else ""}),
            }
        found = {s["slug"]: media.footage_candidates((written.get(s["slug"]) or {}).get("youtube", []),
                                                     (written.get(s["slug"]) or {}).get("sources", []),
                                                     ((written.get(s["slug"]) or {}).get("subjects") or [""])[0]) for s in fresh}
        footage = pick_footage(found, Path(tmp))
    if dry_run:
        for s in fresh:
            print(f"--- {s['slug']} [{looks[s['slug']]['how']}]\n{json.dumps(looks[s['slug']], ensure_ascii=False, indent=1)}\n"
                  f"footage: {footage.get(s['slug'])} of {len(found.get(s['slug']) or [])}\n")
        return 0
    ensure_bucket()
    for s in fresh:
        look = looks[s["slug"]]
        before = clips.get(s["slug"]) or {}
        with tempfile.TemporaryDirectory(prefix=f"383-clip-{s['slug'][:20]}-") as work:
            clip = make_clip(s, look["script"], look["how"], look, footage.get(s["slug"], []), now, Path(work))
            if keep:
                # A trial run: keep the render to look at, publish nothing.
                shutil.copytree(work, Path(keep) / s["slug"], dirs_exist_ok=True, symlinks=True)
                print(json.dumps(edition_entry(s, clip), ensure_ascii=False)[:3000])
                continue
        clips[s["slug"]] = clip
        beats = clip["beats"]
        print(f"EDITION {s['slug']}: {clip['voice'] or 'no voice'}, {'video' if clip.get('video') else 'no video'}, "
              f"{len(beats)} beats, {len({b.get('src') for b in beats if b['kind'] == 'photo'})} photos "
              f"({', '.join(sorted({b['kind'] for b in beats}))}); footage {clip.get('footage', 0)} "
              f"(youtube picked {len(footage.get(s['slug']) or [])} of {len(found.get(s['slug']) or [])})")
        # A story that changed gets a new clip. Its old files stay a day: pages
        # cached on the site may still play them.
        old_files = before.get("files") or ([before["audio"]] if before.get("audio") else [])
        stale = [f for f in old_files if f not in clip["files"]]
        if stale:
            retired.append({"files": stale, "at": now.isoformat()})
        # Each clip goes out as soon as it is made: a long render does not hold the edition back.
        publish(stories, clips, now)
        save_state({"clips": clips, "retired": retired, "lastRun": now.isoformat()})

    if keep:
        return 0
    edition = publish(stories, clips, now)
    if edition is None:
        return 1

    # Clips not in today's edition are kept three days (a shared link still plays), then removed.
    live = {s["slug"] for s in stories}
    old = [slug for slug, c in clips.items()
           if slug not in live and now - datetime.fromisoformat(c.get("madeAt", now.isoformat())) > KEEP_AUDIO]
    gone = [r for r in retired if now - datetime.fromisoformat(r.get("at", now.isoformat())) > timedelta(days=1)]
    remove([f for slug in old for f in (clips[slug].get("files") or [clips[slug].get("audio")]) if f]
           + [f for r in gone for f in (r.get("files") or [r.get("audio")]) if f])
    for slug in old:
        clips.pop(slug, None)
    save_state({"clips": clips, "retired": [r for r in retired if r not in gone], "lastRun": now.isoformat()})
    voiced = sum(1 for c in edition["clips"] if c["audio"])
    videos = sum(1 for c in edition["clips"] if c.get("video"))
    print(f"EDITION published {len(edition['clips'])} clips ({voiced} voiced, {videos} rendered, {len(fresh)} new)")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(main(dry_run="--dry-run" in args, only=args[args.index("--only") + 1] if "--only" in args else "", force="--force" in args,
                  keep=args[args.index("--keep") + 1] if "--keep" in args else ""))
