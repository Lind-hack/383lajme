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
from html import escape as html_escape
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
import video_edition_media as media  # noqa: E402
import video_edition_render as render  # noqa: E402
import video_trends  # noqa: E402

MAX_STORIES = 7
BUCKET = "video-edition"
INDEX = "index.json"
KEEP_AUDIO = timedelta(days=3)
BUDGET = 35 * 60  # seconds of rendering a run starts new clips in
MIN_WORDS, MAX_WORDS = 30, 110
# Bumped when a clip is made differently: every story is made again once.
CLIP_VERSION = "8"
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

For every story in the brief, write ONE spoken script.

The listener knows NOTHING about this story, is scrolling on a phone, and hears it ONCE. After
the clip they must be able to tell a friend in one sentence what happened. Clear beats complete:
leave out every detail that is not needed to understand the news.
- Plain, everyday Albanian, the way you would tell a friend. No officialese or newspaper phrases
  ("në kuadër të", "lidhur me", "përkatësisht", "në fjalë", "ka bërë të ditur", "inicoi").
- One idea per sentence, at most 15 words each. 55 to 85 words, 4 to 6 sentences.
- The first sentence is the news itself in the simplest words: who did what. No greeting, no
  "Në lajmin e sotëm", no "Mirëmëngjes", no question to the viewer.
- Say who someone is the first time you name them, as the story describes them ("Edi Rama,
  kryeministri i Shqipërisë", "Ylli nga Suhareka"). At most 3 names in the whole script.
- At most 3 numbers in the whole script (a score like 100:86 counts as two): only the ones the
  news is about. No running scores, no list of figures, no exact times or minor dates.
- A word or abbreviation a teenager might not know: explain it in a few words, or leave it out.
- Then why it matters or what happens next, in one plain sentence, ONLY if the story says so.
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
- "subjects": up to 5 exact English Wikipedia article titles of the PEOPLE, organisations and
  named buildings the script speaks about, in the order the script names them (e.g. "Donald
  Trump", "Marco Rubio", "Volodymyr Zelenskyy", "White House"). Their photos are shown while the
  voice talks about them, so: never a country, region or city (no "Russia", "Ukraine", "Tirana":
  their photos show anything at all), and only ones the story itself names.
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
  leagues, federations, clubs, companies). Never a news outlet.
- "graphics": 2 to 4 on-screen graphics made for THIS story, the ones that make it clearer and
  fit its kind: a match gets its score and its players; an economy story a chart; a race or a
  league its standings; a celebrity or a politician their name card. Each is one of:
  {"type": "score", "teams": [{"name": "Ylli", "score": "100"}, {"name": "Vëllaznimi", "score": "86"}],
   "note": "Superliga, java 3"}: the result of a match (sport only; the team names as the story writes
   them, short; the note 2 to 6 words or "");
  {"type": "compare", "label": "pikë në çerekun e fundit", "items": [{"name": "Ylli", "value": "28"},
   {"name": "Vëllaznimi", "value": "19"}]}: 2 or 3 numbers of the same kind side by side (label 3 to 8
   words, each value a number with at most one unit word);
  {"type": "person", "name": "Davontrey Thomas", "role": "26 pikë për Yllin"}: a name tag shown when the
   script names someone (the name exactly as your script says it, role 2 to 6 words), at most 2;
  {"type": "timeline", "steps": [{"when": "Çereku i dytë", "what": "Ylli kalon përpara"}, ...]}: 2 to 4
   steps in order, when the story is a sequence of moments (when 1 to 3 words, what 2 to 6 words).
  {"type": "chart", "label": "inflacioni në Kosovë", "points": [{"label": "2024", "value": "3,1"},
   {"label": "2025", "value": "4,2"}]}: 2 to 6 values of one thing over time or side by side (economy,
   prices, votes, polls; label 2 to 8 words, each point label 1 to 3 words, each value a number);
  {"type": "ranking", "label": "renditja e pilotëve", "rows": [{"name": "Verstappen", "value": "331 pikë"},
   ...]}: 3 to 5 rows of a standings table or a top list, in order (sport tables, races, charts);
  Every number in a graphic must be in the story (and, for a score, compare or person, in your
  script); every name must be in the story.

And how the clip should feel, the way a good short-form editor would cut it:
- "mood": the story's tone, one of "tense" (war, protests, crime, disasters, deaths), "serious"
  (politics, economy, courts, institutions), "calm" (culture, lifestyle, health, society, weather),
  "bright" (sport, technology, science, achievements, good news). It picks the music under the voice.
- "hook": your script's first sentence, copied exactly. Write it so a viewer scrolling past stops:
  the most surprising true fact first, concrete, no warm-up.
- "climax": 2 to 6 consecutive words copied exactly from your script: the moment the viewer is
  waiting for (the outcome, the number, the decision). The sound builds up to it.
- "emphasis": up to 3 single words from your script that carry the story (a name, a number, a verb).
- "cover": the words on the clip's thumbnail, 2 to 5 Albanian words (at most 32 characters), the one
  true thing that makes someone tap, like the cover of a viral short: concrete, a name or a number
  in it, no question, no clickbait the story does not back (e.g. "Ylli mposht Vëllaznimin 100:86",
  "40 mijë në protestë"). Only names and numbers that are in the story.

Reply with ONLY this, exactly, nothing before or after:
383_JSON_BEGIN
[{"slug": "<the story's slug>", "script": "<the script>", "subjects": [], "place": "",
  "place_name": "", "facts": [], "quote": null, "youtube": [], "sources": [], "graphics": [],
  "mood": "serious", "hook": "", "climax": "", "emphasis": [], "cover": ""}]
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
Each story's headline and summary are given: keep a video only if it shows what THIS story is
about (the same people and the same occasion), not merely the same person on another day. Videos
marked "official" come straight from the uploads of a person or institution the story names: still
check the title is this story. For a story marked TRENDING, the original video of the person who made the moment go viral (posted
on their own channel or account) also counts as a primary source; a re-upload, compilation, reaction
or commentary of it never does. At most 3 per story; none is a fine answer.

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


def newest_stories(hours: int = 24, limit: int = MAX_STORIES) -> list[dict]:
    base = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    query = urllib.parse.urlencode({
        "select": "slug,title,excerpt,body,category,published_at,image_url,raw_article",
        "published_at": f"gte.{since}", "order": "published_at.desc", "limit": str(limit),
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


MAX_TREND_SWAPS = 2
MIN_TREND_TRAFFIC = 200  # Google's "200+" searches in Albania today (a Wikipedia spike counts by its views)


def mix_trends(stories: list[dict], data: dict, recent: list[dict] | None = None) -> list[dict]:
    """What people are talking about today, in the seven: a front-page story that is trending is
    marked so; a trending 383 article of the last day and a half that is not on the front page
    takes the place of the last story that is not trending (two at most, one per trend)."""
    if not data.get("trends"):
        return stories
    about = lambda s: f"{plain(s.get('title'))} {plain(s.get('excerpt'))}"  # noqa: E731
    out = []
    for s in stories:
        t = video_trends.trend_for(about(s), data)
        out.append({**s, "trend": t} if t and t["traffic"] >= MIN_TREND_TRAFFIC else s)
    taken = {s["slug"] for s in out}
    terms = {s["trend"]["term"] for s in out if s.get("trend")}
    hot = []
    for s in recent if recent is not None else newest_stories(36, 60):
        t = video_trends.trend_for(about(s), data)
        if s.get("slug") in taken or not t or t["term"] in terms or t["traffic"] < MIN_TREND_TRAFFIC:
            continue
        terms.add(t["term"])
        hot.append({**s, "trend": t})
    hot.sort(key=lambda s: -s["trend"]["traffic"])
    for s in hot[:MAX_TREND_SWAPS]:
        spots = [i for i, x in enumerate(out) if not x.get("trend")]
        if not spots:
            break
        print(f"EDITION trending: {s['slug']} ({s['trend']['term']}, {s['trend']['traffic']}) in place of {out[spots[-1]]['slug']}")
        out[spots[-1]] = s
    return out


def todays_trends() -> dict:
    """The trends saved in the last 45 minutes, else collected now (video_trends.collect)."""
    data = video_trends.load(max_age=timedelta(minutes=45))
    if data:
        return data
    try:
        return video_trends.collect()
    except Exception as exc:  # trends are extra: the edition goes out without them
        print(f"EDITION trends unavailable ({exc!r})", file=sys.stderr)
        return video_trends.load()


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


def write_scripts(stories: list[dict], workdir: Path, redo: dict[str, str] | None = None) -> dict[str, dict]:
    """One model call for every story that needs a script; {slug: {"script", "subjects", ...}}.
    redo: {slug: why its last script was refused}, for the one second try."""
    if not stories:
        return {}
    brief = workdir / ("edition-brief-redo.md" if redo else "edition-brief.md")
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
            *([f"YOUR LAST SCRIPT FOR THIS STORY WAS REFUSED: {redo[s['slug']]}. Write it again, simpler."]
              if redo and s["slug"] in redo else []),
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
            "cover": re.sub(r"\s+", " ", str(row.get("cover") or "")).strip()[:40],
            "graphics": [g for g in row.get("graphics") or [] if isinstance(g, dict)][:4] if isinstance(row.get("graphics"), list) else [],
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


def _short(text, words: tuple[int, int], size: int = 60) -> str:
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    return text if words[0] <= len(text.split()) <= words[1] and len(text) <= size else ""


def _named(name: str, low: str) -> bool:
    """Every part of a name is in the story (its stem: Albanian names take endings)."""
    parts = [w for w in re.findall(r"[\wçëÇË-]+", name) if len(w) >= 2]
    return bool(parts) and all(w.lower()[: max(3, len(w) - 3)] in low for w in parts)


def check_graphics(graphics: list[dict], script: str, story: dict) -> list[dict]:
    """A graphic shows only what the story says: its numbers (said in the script too) and its names."""
    source_text = " ".join(plain(story.get(k)) for k in ("title", "excerpt", "body"))
    low = source_text.lower()
    source, said = story_numbers(source_text), numbers_in(script)
    sport = media.is_sport(story)

    def number_ok(value) -> bool:
        value = str(value or "").strip()
        nums = numbers_in(value)
        return bool(nums) and nums <= source and nums <= said and len(value) <= 14 and len(value.split()) <= 2

    out = []
    for g in graphics:
        kind = g.get("type")
        if kind == "score" and sport:
            teams = [t for t in g.get("teams") or [] if isinstance(t, dict)]
            if len(teams) == 2 and all(_named(str(t.get("name", "")), low) and len(str(t.get("name", ""))) <= 24
                                       and re.fullmatch(r"\d{1,3}", str(t.get("score", "")).strip()) and number_ok(t.get("score")) for t in teams):
                out.append({"type": "score", "teams": [{"name": str(t["name"]).strip(), "score": str(t["score"]).strip()} for t in teams],
                            "note": _short(g.get("note"), (2, 6), 40)})
        elif kind == "compare":
            items = [i for i in g.get("items") or [] if isinstance(i, dict)]
            label = _short(g.get("label"), (2, 8))
            if label and 2 <= len(items) <= 3 and all(_named(str(i.get("name", "")), low) and len(str(i.get("name", ""))) <= 24
                                                      and number_ok(i.get("value")) for i in items):
                out.append({"type": "compare", "label": label,
                            "items": [{"name": str(i["name"]).strip(), "value": str(i["value"]).strip()} for i in items]})
        elif kind == "person":
            name = re.sub(r"\s+", " ", str(g.get("name") or "")).strip()
            role = _short(g.get("role"), (2, 6), 44)
            if 2 <= len(name.split()) <= 4 and len(name) <= 32 and _named(name, low) and flat(name.split()[-1])[:4] in flat(script) \
                    and all(number_ok(n) for n in numbers_in(role)):
                out.append({"type": "person", "name": name, "role": role})
        elif kind == "chart":
            pts = [x for x in g.get("points") or [] if isinstance(x, dict)]
            label = _short(g.get("label"), (2, 8))
            clean = [{"label": _short(x.get("label"), (1, 3), 16), "value": str(x.get("value") or "").strip()} for x in pts]
            if (label and 2 <= len(clean) <= 6
                    and all(c["label"] and numbers_in(c["value"]) and numbers_in(c["value"]) <= source and len(c["value"]) <= 12 for c in clean)
                    and numbers_in(" ".join(c["label"] for c in clean)) <= source):
                out.append({"type": "chart", "label": label, "points": clean})
        elif kind == "ranking":
            rows = [x for x in g.get("rows") or [] if isinstance(x, dict)]
            label = _short(g.get("label"), (2, 8))
            clean = [{"name": re.sub(r"\s+", " ", str(x.get("name") or "")).strip()[:28], "value": str(x.get("value") or "").strip()[:14]} for x in rows]
            if (label and 3 <= len(clean) <= 5 and all(c["name"] and _named(c["name"], low) for c in clean)
                    and all(not c["value"] or (numbers_in(c["value"]) and numbers_in(c["value"]) <= source) for c in clean)):
                out.append({"type": "ranking", "label": label, "rows": clean})
        elif kind == "timeline":
            steps = [s for s in g.get("steps") or [] if isinstance(s, dict)]
            clean = [{"when": _short(s.get("when"), (1, 3), 22), "what": _short(s.get("what"), (2, 6), 44)} for s in steps]
            if 2 <= len(clean) <= 4 and all(s["when"] and s["what"] for s in clean) \
                    and numbers_in(" ".join(s["when"] + " " + s["what"] for s in clean)) <= source:
                out.append({"type": "timeline", "steps": clean})
    return out


def check_cover(cover: str, story: dict) -> str:
    """The thumbnail's words: short, and only the story's own names and numbers."""
    cover = re.sub(r"[\"“”„«»?!]", "", str(cover or "")).strip().rstrip(".")
    source_text = " ".join(plain(story.get(k)) for k in ("title", "excerpt", "body"))
    low = source_text.lower()
    if not (2 <= len(cover.split()) <= 5 and len(cover) <= 32) or not numbers_in(cover) <= story_numbers(source_text):
        return ""
    for word in re.findall(r"[A-ZÇË][\wçëÇË-]*", " ".join(cover.split()[1:])):
        if word.lower()[: max(4, len(word) - 3)] not in low:
            return ""
    return cover


def fallback_cover(story: dict, look: dict) -> str:
    """No cover from the writer: the scoreboard, a number card, or the headline's first words."""
    for g in look.get("graphics", []):
        if g["type"] == "score":
            a, b = g["teams"]
            return f"{a['name']} {a['score']}:{b['score']}"[:32]
    for f in look.get("facts", []):
        cover = f"{f['value']} {' '.join(f['label'].split()[:2])}"
        if len(cover) <= 32:
            return cover
    words = plain(story.get("title")).rstrip(".!?").split()
    out = []
    for w in words:
        if len(" ".join(out + [w])) > 32:
            break
        out.append(w)
    return " ".join(out)


UNITS = r"(?:mijë|milion[ëe]?|miliard[ëe]?|për qind|euro|dollarë|dollar|vjet|vite|ditë|orë|muaj|vende|veta|persona|banorë|pikë|gola|minuta|kilometra|metra|ushtarë|të vdekur|të plagosur)"


def auto_facts(script: str, story: dict) -> list[dict]:
    """Up to two of the script's numbers with their unit ("40 mijë veta"), each with the few words
    after it as its label: number cards for a clip whose writer gave none (out of quota)."""
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+", script):
        for m_ in re.finditer(r"(\d[\d.,]*\s+" + UNITS + r")\s+((?:[\wçëÇË-]+\s*){2,6})", sentence):
            value = m_.group(1).strip()
            label = " ".join(re.sub(r"[,.;:!?]", "", m_.group(2)).split()[:6])
            if len(value) <= 16 and 2 <= len(label.split()):
                out.append({"value": value, "label": label})
        if len(out) >= 2:
            break
    return check_facts(out[:2], script, story)


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


def searches(story: dict, w: dict) -> list[str]:
    """The writer's YouTube searches; for a match, its highlights by the two sides' names too."""
    out = list(w.get("youtube") or [])
    if story.get("trend"):
        # The search people made today, as they made it: it finds the video that went viral.
        out.insert(0, story["trend"]["term"])
    subjects = [re.sub(r"\s*\(.*?\)", "", s).strip() for s in w.get("subjects") or []]
    if media.is_sport(story) and len(subjects) >= 2:
        out.insert(0, f"{subjects[0]} {subjects[1]} highlights")
    return out


def pick_footage(found: dict[str, list[dict]], workdir: Path, stories: list[dict] | None = None) -> dict[str, list[dict]]:
    """The model keeps only the people's and institutions' own videos of the event."""
    found = {slug: c for slug, c in found.items() if c}
    if not found:
        return {}
    about = {s["slug"]: s for s in stories or []}
    brief = workdir / "footage-brief.md"
    blocks = []
    for slug, cands in found.items():
        s = about.get(slug) or {}
        trending = f"TRENDING today (people search: {s['trend']['term']}): the creator's own original video may be kept" if s.get("trend") else ""
        blocks.append("\n".join([f"## Story {slug}", f"headline: {plain(s.get('title'))}", f"summary: {plain(s.get('excerpt'))}",
                                 *([trending] if trending else []),
                                 *[f"- {c['id']} | channel: {c['channel']}{' | official' if c.get('official') else ''} | posted {c['posted']} | title: {c['title']}"
                                   for c in cands]]))
    brief.write_text("# Footage candidates\n\n" + "\n\n".join(blocks) + "\n", encoding="utf-8")
    picked = between_markers(ask_model(f"Read {brief} with the file tool, then follow these rules.\n\n{FOOTAGE_RULES}", "footage judge"))
    out = {}
    for slug, cands in found.items():
        if not isinstance(picked, dict):
            # No judge (the model is down or out of quota): only what needs no judging, an official
            # channel's own upload whose title shares two topic words with the story.
            out[slug] = [c for c in cands if c.get("official") and c.get("score", 0) >= 2][:2]
            continue
        ids = picked.get(slug) if isinstance(picked.get(slug), list) else []
        out[slug] = [c for c in cands if c["id"] in ids][:3]
    if not isinstance(picked, dict):
        print(f"EDITION footage judge unavailable: kept {sum(len(v) for v in out.values())} official uploads on their titles alone")
    return out


def official_found(story: dict, w: dict) -> list[dict]:
    """The official channels' own uploads about this story (media.official_candidates)."""
    text = " ".join(plain(story.get(k)) for k in ("title", "excerpt", "body"))
    keys = media.story_keys(" ".join([plain(story.get("title")), plain(story.get("excerpt")), *(w.get("youtube") or []),
                                      *(w.get("subjects") or []), w.get("script", "")]))
    try:
        return media.official_candidates(text, keys)
    except Exception as exc:  # a channel page misbehaving must not stop the edition
        print(f"EDITION {story['slug']}: official channels failed ({exc!r})", file=sys.stderr)
        return []


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


MAX_SENTENCE = 20  # words: longer is hard to follow by ear
MAX_NUMBERS = 4    # different numbers in a script: more and the listener loses the thread


def check_script(script: str, story: dict) -> tuple[bool, str]:
    """The script may say only what the story says (its numbers and its names), and must be easy
    to follow by ear: short sentences, few numbers."""
    words = script.split()
    if not MIN_WORDS <= len(words) <= MAX_WORDS:
        return False, f"{len(words)} words"
    longest = max((len(s.split()) for s in re.split(r"(?<=[.!?])\s+", script)), default=0)
    if longest > MAX_SENTENCE:
        return False, f"a sentence of {longest} words (at most {MAX_SENTENCE})"
    if len(numbers_in(script)) > MAX_NUMBERS:
        return False, f"{len(numbers_in(script))} different numbers (at most {MAX_NUMBERS})"
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
    sport = media.is_sport(story)
    try:
        titles = look.get("subjects", []) + ([look["place"]] if look.get("place") else [])
        pages = media.wiki_pages(titles)
        # The story's people and organisations; its city only when they have too few photos,
        # and never for sport (a game is its players, not the town it was played in).
        # (The writer sometimes lists the town among the subjects: a place, for sport, is left out.)
        people = [t for t in look.get("subjects", []) if t != look.get("place")
                  and not (sport and (pages.get(t) or {}).get("lat") is not None)]
        photos = media.story_photos(story, people, pages) or photos
        if len(photos) < 2 and look.get("place") and not sport:
            photos = media.story_photos(story, people + [look["place"]], pages) or photos
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
            qids = [p.get("qid", "") for t, p in pages.items() if not (sport and t == look.get("place"))]
            footage = media.gather_footage(picked, qids, "" if sport else look.get("place", ""), str(workdir), len(photos),
                                           [re.sub(r"\s*\(.*?\)", "", t) for t in look.get("subjects", [])])
        except Exception as exc:  # a footage source misbehaving must not stop the clip
            print(f"EDITION {story['slug']}: footage failed ({exc!r})", file=sys.stderr)
    # A person on screen gets their own photo on their card (their Wikipedia photo, found above).
    for g in look.get("graphics", []):
        if g.get("type") == "person":
            last = media.norm(g["name"].split()[-1])[:5]
            mine = next((p_ for p_ in photos if p_.get("who") and media.norm(p_["who"].split()[-1])[:5] == last), None)
            if mine:
                g["photo"] = mine["src"]
    # A score shown as a scoreboard is not shown again as a number card; a game with its own
    # footage needs no map of the town.
    shown = {n for g in look.get("graphics", []) if g["type"] == "score" for t in g["teams"] for n in numbers_in(t["score"])}
    facts = [f for f in look.get("facts", []) if not numbers_in(f["value"]) <= shown] if shown else look.get("facts", [])
    if sport and len(footage) >= 3:
        # The game's own pictures from start to end.
        place, photos = None, []
    clip["beats"] = media.build_beats(clip["duration"], clip["words"], photos, facts, place,
                                      look.get("quote"), footage)
    clip["footage"] = len(footage)
    if voiced and clip["beats"]:
        made = render.make_video(story["slug"], {**clip, "title": plain(story.get("title")), "category": story.get("category", ""),
                                                  "color": ""}, voiced["mp3"], look, workdir)
        if made:
            video = {}
            for kind, mime in (("hd", "video/mp4"), ("sd", "video/mp4"), ("poster", "image/jpeg"), ("thumb", "image/jpeg")):
                if kind not in made:
                    continue
                # A new name every render: the files are cached for a year, so a re-render under the old name would not be seen.
                path = f"video/{story['slug']}-{h}-{now:%m%d%H%M}-{kind}.{'mp4' if mime == 'video/mp4' else 'jpg'}"
                if upload(path, made[kind].read_bytes(), mime, "31536000"):
                    video[kind] = path
                    clip["files"].append(path)
            if all(k in video for k in ("hd", "sd", "poster")):
                clip["video"] = video
                # What the video shows when, for the credit line under it.
                clip["beats"] = made["beats"]
                clip["mood"] = made["cues"].get("music", "")
                clip["graphics"] = [o["kind"] for o in made.get("overlays") or []]
                clip["theme"] = made.get("theme", "")
    return clip


def edition_entry(story: dict, clip: dict) -> dict:
    video = clip.get("video") if isinstance(clip.get("video"), dict) and all(clip["video"].get(k) for k in ("hd", "sd", "poster")) else {}
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
        # Trending in Kosovo/Albania today: the card says so.
        "trend": (story.get("trend") or {}).get("term", ""),
    }


def public_beat(b: dict) -> dict:
    """A beat as the site gets it: no paths on this machine."""
    return {k: v for k, v in b.items() if k != "file"}


def report(made: list[tuple[dict, dict]], edition: dict, now: datetime) -> None:
    """After a run that made clips: one email to the editor (L383_EDITION_REPORT_TO) with each
    new clip, its thumbnail and where to watch it. A run that made nothing sends nothing."""
    to = os.environ.get("L383_EDITION_REPORT_TO", "").strip()
    # The newsroom's EMAIL_FROM on the VPS is Resend's test sender (it may only mail the account's
    # owner); the report goes out from the site's verified domain (L383_EDITION_REPORT_FROM).
    key = os.environ.get("RESEND_API_KEY", "")
    sender = os.environ.get("L383_EDITION_REPORT_FROM") or os.environ.get("EMAIL_FROM", "")
    if not (made and to and key and sender):
        return
    live = {c["slug"]: c for c in edition.get("clips", [])}
    rows = []
    for story, clip in made:
        entry = live.get(story["slug"]) or edition_entry(story, clip)
        video = entry.get("video") or {}
        thumb = video.get("thumb") or video.get("poster") or entry.get("image") or ""
        page = f"{SITE}/video/{story['slug']}"
        secs = int(round(float(clip.get("duration") or 0)))
        what = [f"{secs // 60}:{secs % 60:02d}", entry.get("category") or ""]
        what.append(f"{clip.get('footage', 0)} pjesë video" if clip.get("footage") else "pa video të ngjarjes")
        if clip.get("graphics"):
            names = {"score": "rezultati", "compare": "krahasim", "person": "emër", "timeline": "kronologji", "slam": "kulmi",
                     "chart": "grafik", "ranking": "renditje", "profile": "kartë personi", "keyline": "fjalia kyçe"}
            what.append("grafika: " + ", ".join(dict.fromkeys(names.get(g, g) for g in clip["graphics"] if g != "bug")))
        state = "" if video else '<p style="margin:6px 0 0;color:#B42318;font-weight:700">Pa video të renderuar: në faqe del me zë dhe foto.</p>'
        img = (f'<a href="{html_escape(page)}"><img src="{html_escape(thumb)}" width="135" height="240" alt="" '
               f'style="display:block;width:135px;height:240px;object-fit:cover;border-radius:12px;background:#222"></a>') if thumb else ""
        links = f'<a href="{html_escape(page)}" style="color:#FF4422;font-weight:800">Shiko në faqe</a>'
        if video.get("hd"):
            links += f' · <a href="{html_escape(video["hd"])}" style="color:#555">MP4 HD</a>'
        rows.append(f'<tr><td style="padding:14px 14px 14px 0;vertical-align:top;width:135px">{img}</td>'
                    f'<td style="padding:14px 0;vertical-align:top;font-family:Arial,sans-serif">'
                    f'<p style="margin:0;font-size:17px;font-weight:800;color:#111;line-height:1.3">{html_escape(entry.get("title", ""))}</p>'
                    f'<p style="margin:6px 0 0;font-size:13px;color:#666">{html_escape(" · ".join(w for w in what if w))}</p>{state}'
                    f'<p style="margin:10px 0 0;font-size:14px">{links}</p></td></tr>')
    when = now.astimezone(KOSOVO)
    n = len(made)
    subject = f"383 Video · {n} {'klip i ri' if n == 1 else 'klipe të reja'} · {when:%H:%M}"
    body = (f'<div style="max-width:620px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;color:#111">'
            f'<p style="margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:.16em;color:#FF4422">EDICIONI VIDEO · {when:%d.%m.%Y}</p>'
            f'<h1 style="margin:0 0 6px;font-size:22px">{n} {"klip i ri u publikua" if n == 1 else "klipe të reja u publikuan"} në faqe</h1>'
            f'<p style="margin:0 0 8px;font-size:14px;color:#555">Edicioni tani ka {len(edition.get("clips", []))} klipe. '
            f'<a href="{SITE}/video" style="color:#FF4422">383ks.com/video</a></p>'
            f'<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse">{"".join(rows)}</table></div>')
    req = urllib.request.Request("https://api.resend.com/emails", method="POST",
                                 data=json.dumps({"from": f"383 Video <{sender}>", "to": [to], "subject": subject, "html": body}).encode(),
                                 headers={**HEADERS, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            print(f"EDITION report sent ({res.status})")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"EDITION report failed: {exc}", file=sys.stderr)


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
    try:
        stories = mix_trends(stories, todays_trends())
    except Exception as exc:  # trends are extra: the front page's seven go out as they are
        print(f"EDITION trends not mixed in ({exc!r})", file=sys.stderr)

    state = load_state()
    clips = state.get("clips", {}) if isinstance(state.get("clips"), dict) else {}
    retired = [r for r in state.get("retired", []) if isinstance(r, dict) and (r.get("files") or r.get("audio"))]
    fresh = [s for s in stories if force or (clips.get(s["slug"]) or {}).get("hash") != story_hash(s)]
    if only:
        fresh = [s for s in fresh if s["slug"] == only]
    print(f"EDITION {len(stories)} stories, {len(fresh)} new or changed")

    with tempfile.TemporaryDirectory(prefix="383-edition-") as tmp:
        written = write_scripts(fresh, Path(tmp))
        if not written and not dry_run:
            # The writer gave nothing at all (the model is down or out of quota): a story that already
            # has a clip keeps it and is tried again next hour; only a story with none is made now,
            # from its own words.
            kept = [s["slug"] for s in fresh if (clips.get(s["slug"]) or {}).get("audio")]
            if kept:
                print(f"EDITION writer unavailable: {len(kept)} clips kept as they are until it is back")
                fresh = [s for s in fresh if s["slug"] not in kept]
        # A script refused (a fact not in the story, too long a sentence, too many numbers) gets one
        # more try with the reason, before the story's own words stand in.
        refused = {}
        for s in fresh:
            script = (written.get(s["slug"]) or {}).get("script", "")
            ok, why = check_script(script, s) if script else (False, "no script")
            if not ok:
                refused[s["slug"]] = why
        if refused:
            print(f"EDITION second try for {len(refused)}: " + "; ".join(f"{k} ({v})" for k, v in refused.items()))
            again = write_scripts([s for s in fresh if s["slug"] in refused], Path(tmp), refused)
            written.update({k: v for k, v in again.items() if check_script(v.get("script", ""), next(s for s in fresh if s["slug"] == k))[0]})
        looks: dict[str, dict] = {}
        for s in fresh:
            w = written.get(s["slug"]) or {}
            script, how = w.get("script", ""), "model"
            ok, why = check_script(script, s) if script else (False, "no script")
            if not ok:
                print(f"EDITION {s['slug']}: own words ({why})")
                script, how = fallback_script(s), "story"
            looks[s["slug"]] = look = {
                "script": script, "how": how,
                "subjects": w.get("subjects", []), "place": w.get("place", ""), "place_name": w.get("place_name", ""),
                "facts": check_facts(w.get("facts", []), script, s) or auto_facts(script, s), "quote": check_quote(w.get("quote"), s),
                "graphics": check_graphics(w.get("graphics", []), script, s) if how == "model" else [],
                "cover": check_cover(w.get("cover", ""), s),
                **(check_feel(w, script) if how == "model" else {"mood": w.get("mood") if w.get("mood") in render.MOODS else ""}),
            }
            look["cover"] = look["cover"] or fallback_cover(s, look)
        found = {}
        for s in fresh:
            w = written.get(s["slug"]) or {}
            # The people's own channels first, then YouTube's search.
            own = official_found(s, w)
            general = media.footage_candidates(searches(s, w), w.get("sources", []), w.get("subjects") or [])
            found[s["slug"]] = list({c["id"]: c for c in general + own}.values())
            found[s["slug"]].sort(key=lambda c: not c.get("official"))
        footage = pick_footage(found, Path(tmp), fresh)
    if dry_run:
        for s in fresh:
            print(f"--- {s['slug']} [{looks[s['slug']]['how']}]\n{json.dumps(looks[s['slug']], ensure_ascii=False, indent=1)}\n"
                  f"graphics asked for: {json.dumps((written.get(s['slug']) or {}).get('graphics'), ensure_ascii=False)}\n"
                  f"footage: {footage.get(s['slug'])} of {len(found.get(s['slug']) or [])}\n")
        return 0
    ensure_bucket()
    made: list[tuple[dict, dict]] = []
    started = time.monotonic()
    for s in fresh:
        # A clip takes ~15 minutes and the runner stops the job at 55: past the budget the rest
        # wait for the next hour, so this run still ends cleanly (and sends its report).
        if made and time.monotonic() - started > BUDGET:
            print(f"EDITION out of time: {len(fresh) - len(made)} left for the next run")
            break
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
        made.append((s, clip))
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
    report(made, edition, now)
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(main(dry_run="--dry-run" in args, only=args[args.index("--only") + 1] if "--only" in args else "", force="--force" in args,
                  keep=args[args.index("--keep") + 1] if "--keep" in args else ""))
