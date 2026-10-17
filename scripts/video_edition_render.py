"""One story's clip rendered as a real video (scripts/video_edition.py calls make_video).

The beats (scripts/video_edition_media.build_beats) say what is on screen
when; this file turns them into a finished, upright MP4 the way an editor
would:

- the cue sheet (build_cues): how each beat comes in — under the flash of one
  of Lind's film burns (the story's opening, the first footage, the climax),
  or a blur-push, a whip pan, a zoom-through or an orange wipe — and the
  sounds that go with it: a whoosh on every change, a riser into the hook and
  into the climax, a swell before a quote, a tick and a hit when a number
  lands, a pop on the few words that matter, a shutter on a new photo;
- the picture (compose): a HyperFrames composition (HTML + a GSAP timeline,
  rendered frame by frame in headless Chrome), 1080x1920, 30 fps: photos with
  slow camera moves, footage, number, quote and map cards in 383's style,
  the words burned in as they are said, the burns blended over the cuts;
- the sound (mix): the voice cleaned up, the mood's music bed far below it
  and ducking under every word, the effects at their moments, the whole at
  -14 LUFS (what TikTok, Reels and Shorts play at);
- the check (review): a render that is the wrong length, goes black, or is
  too quiet or too loud is not published.

The fixed library of burns, sounds, beds, fonts and GSAP is built once by
scripts/video_edition_assets.py and lives at L383_EDITION_LIBRARY.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import random
import re
import shutil
import subprocess
import sys
import urllib.error
from pathlib import Path

import video_edition_media as media

LIBRARY = Path(os.environ.get("L383_EDITION_LIBRARY", "/opt/data/video-edition/library"))
HYPERFRAMES = Path(os.environ.get("L383_EDITION_HYPERFRAMES", "/opt/data/video-edition/hf"))
W, H, FPS = 1080, 1920, 30
# A phone screen is narrower than 9:16: the player fills it and crops about 100 px off each
# side, so every word and card keeps 150 px clear of the edges.
TAIL = 0.5  # seconds after the last word
MOODS = ("tense", "serious", "calm", "bright")
MAX_BURNS = 3
BURN_GAP = 5.0
CARD_KINDS = {"fact", "quote", "map"}
MOVES_IN = ("blur", "whip", "zoom", "wipe")

# Peak level of each effect in the mix (the library peaks at about -1 dBFS).
LEVELS = {"whoosh": -17, "swish": -16, "burn": -15, "riser": -21, "swell": -18, "impact": -14,
          "boom": -13, "pop": -21, "shutter": -21, "tick": -20}
MUSIC_DB = -25
LUFS = -14


def load_library(root: Path = LIBRARY) -> dict:
    data = json.loads((root / "library.json").read_text(encoding="utf-8"))
    data["root"] = str(root)
    return data


def mood_for(category: str, wanted: str) -> str:
    """The writer's mood when it gave one; else from the section."""
    if wanted in MOODS:
        return wanted
    c = (category or "").lower()
    if any(k in c for k in ("sport", "teknolog", "shkenc")):
        return "bright"
    if any(k in c for k in ("kultur", "jet", "shëndet", "argëtim", "lifestyle")):
        return "calm"
    if any(k in c for k in ("krim", "luft", "siguri")):
        return "tense"
    return "serious"


# ── The cue sheet ────────────────────────────────────────────────────────────

def _word_at(words: list[list], phrase: str) -> tuple[float, float] | None:
    """Start of the phrase's first word and end of its last, as said."""
    toks = [media.norm(t) for t in phrase.split() if media.norm(t)]
    said = [media.norm(w[2]) for w in words]
    if not toks:
        return None
    for i in range(len(said) - len(toks) + 1):
        if said[i:i + len(toks)] == toks:
            return words[i][0], words[i + len(toks) - 1][1]
    return None


def build_cues(beats: list[dict], duration: float, words: list[list], meta: dict, lib: dict, seed: str) -> dict:
    """{"moves": [per beat: how it comes in], "burns": [...], "sfx": [...], "music": file}.
    Deterministic for a given story (seeded by its slug)."""
    rng = random.Random(hashlib.sha1(seed.encode()).hexdigest())
    burns_lib = [b for b in lib.get("burns", []) if b.get("duration", 0) <= 2.2] or lib.get("burns", [])
    sfx_lib = lib.get("sfx", {})
    climax = _word_at(words, meta.get("climax", "")) if meta.get("climax") else None
    hook = _word_at(words, meta.get("hook", "")) if meta.get("hook") else None
    moves: list[str] = []
    burns: list[dict] = []
    sfx: list[dict] = []
    last_kind: dict[str, str] = {}

    def pick(kind: str) -> dict | None:
        options = sfx_lib.get(kind) or []
        if not options:
            return None
        choices = [o for o in options if o["file"] != last_kind.get(kind)] or options
        o = rng.choice(choices)
        last_kind[kind] = o["file"]
        return o

    def sound(kind: str, at: float, level: str | None = None, end_at: float | None = None) -> None:
        o = pick(kind)
        if not o:
            return
        start = (end_at - o["duration"]) if end_at is not None else at
        if start < 0 or start > duration + TAIL:
            return
        sfx.append({"file": o["file"], "at": round(start, 3), "db": LEVELS[level or kind], "kind": kind})

    def burn(at: float) -> bool:
        if not burns_lib or len(burns) >= MAX_BURNS or any(abs(at - b["cut"]) < BURN_GAP for b in burns):
            return False
        b = burns_lib[(len(burns) + rng.randrange(len(burns_lib))) % len(burns_lib)]
        start = at - b["peak"]
        burns.append({"file": b["file"], "start": round(max(0.0, start), 3), "media": round(max(0.0, -start), 3),
                      "length": round(b["duration"] - max(0.0, -start), 3), "cut": round(at, 3)})
        if b.get("sound"):
            sfx.append({"file": b["sound"], "at": round(max(0.0, start), 3), "db": LEVELS["burn"], "kind": "burn"})
        else:
            sound("whoosh", at - 0.35)
        return True

    climax_beat = None
    if climax:
        climax_beat = max((k for k, b in enumerate(beats) if b["at"] <= climax[0] + 0.05), default=None)
    first_footage = next((k for k, b in enumerate(beats) if b["kind"] == "video"), None)
    first_map = next((k for k, b in enumerate(beats) if b["kind"] == "map"), None)
    previous = ""
    shutters = 0
    for k, b in enumerate(beats):
        if k == 0:
            # The clip opens out of a flash: the hand-off from the clip before.
            moves.append("burn" if burn(0.0) else "cut")
            continue
        at = b["at"]
        strong = k in (first_footage, first_map, climax_beat)
        if strong and burn(at):
            moves.append("burn")
            previous = "burn"
            continue
        if b["kind"] in CARD_KINDS:
            options = ["zoom", "blur"]
        elif b["kind"] == "video":
            options = ["whip", "wipe"]
        else:
            options = list(MOVES_IN)
        options = [o for o in options if o != previous] or options
        move = rng.choice(options)
        moves.append(move)
        previous = move
        sound("swish" if move == "whip" else "whoosh", at - 0.3)
        if b["kind"] == "photo" and move in ("blur", "zoom") and shutters < 2 and rng.random() < 0.5:
            sound("shutter", at + 0.05)
            shutters += 1
        if b["kind"] == "fact":
            sound("tick", at + 0.1)
            sound("impact", at + 0.55)
        if b["kind"] == "quote":
            sound("swell", 0, end_at=at + 0.05)

    if hook and hook[1] - 0.2 > 1.6:
        sound("riser", 0, end_at=hook[1])
        sound("impact", hook[1])
    if climax and climax[0] > 3.0:
        sound("riser", 0, end_at=climax[0])
        sound("boom", climax[0])
    for word in (meta.get("emphasis") or [])[:3]:
        span = _word_at(words, word)
        if span and not any(abs(s["at"] - span[0]) < 0.3 for s in sfx):
            sound("pop", span[0])
    sfx.sort(key=lambda s: s["at"])
    beds = (lib.get("music") or {}).get(meta.get("mood") or "serious") or []
    bed = beds[int(hashlib.sha1(seed.encode()).hexdigest(), 16) % len(beds)]["file"] if beds else ""
    return {"moves": moves, "burns": burns, "sfx": sfx, "music": bed}


# ── The picture ──────────────────────────────────────────────────────────────

def phrases(words: list[list]) -> list[tuple[int, int]]:
    """The words a few at a time, as the site shows them (components/video-row.tsx)."""
    out, start, chars = [], 0, 0
    marked = any(len(w) > 3 and w[3] == 1 for w in words)
    for k, w in enumerate(words):
        chars += len(w[2]) + 1
        nxt = words[k + 1] if k + 1 < len(words) else None
        pause = nxt is None or ((len(w) > 3 and w[3] == 1) if marked else nxt[0] - w[1] > 0.28)
        if pause or k - start >= 4 or chars > 26:
            out.append((start, k))
            start, chars = k + 1, 0
    return out


def count_target(value: str) -> tuple[float, int, str, str] | None:
    """"90 mijë" -> (90, 0 decimals, "", " mijë"): a number the card can count up to."""
    m = re.match(r"^(\D*)(\d{1,3}(?:[.\s]\d{3})*|\d+)(?:,(\d+))?(.*)$", value)
    if not m:
        return None
    whole = int(re.sub(r"\D", "", m.group(2)))
    decimals = len(m.group(3) or "")
    number = whole + (int(m.group(3)) / 10 ** decimals if decimals else 0)
    return number, decimals, m.group(1), m.group(4)


def esc(text: str) -> str:
    return html.escape(str(text or ""), quote=True)


STYLE = """
@font-face{font-family:Manrope;src:url(fonts/manrope-latin.woff2) format('woff2');font-weight:200 800;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215}
@font-face{font-family:Manrope;src:url(fonts/manrope-latin-ext.woff2) format('woff2');font-weight:200 800;unicode-range:U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#111}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#111;font-family:Manrope,system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.beat{position:absolute;inset:0;overflow:hidden;opacity:0;will-change:transform,opacity}
.beat .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 38%;will-change:transform}
.beat video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.beat .bd{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.beat.plain{background:radial-gradient(120% 80% at 50% 30%,var(--c) 0%,#111 70%)}
.shade-top{position:absolute;left:0;right:0;top:0;height:560px;background:linear-gradient(#000c,#0000);z-index:50}
.shade-bottom{position:absolute;left:0;right:0;bottom:0;height:980px;background:linear-gradient(#0000,#0008 45%,#000d);z-index:50}
.cardwrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:300px 150px 720px}
.card{position:relative;width:100%;background:#F5F0E6;color:#111;border-radius:28px;padding:56px 60px 60px;box-shadow:0 30px 80px #0008,0 4px 14px #0005}
.label{display:flex;align-items:center;gap:18px;font-size:30px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#111}
.label i{display:block;width:14px;height:44px;border-radius:3px;background:#FF4422}
.fact-value{font-size:188px;line-height:.95;font-weight:800;letter-spacing:-.04em;margin:34px 0 22px;color:#111;font-variant-numeric:tabular-nums}
.fact-label{font-size:46px;line-height:1.18;font-weight:700;color:#3a3530}
.quote-mark{font-size:200px;line-height:.6;font-weight:800;color:#FF4422;height:96px}
.quote-text{font-size:58px;line-height:1.2;font-weight:800;letter-spacing:-.015em;margin:12px 0 30px}
.quote-who{font-size:36px;font-weight:700;color:#6b625a;letter-spacing:.02em}
.map{position:relative;margin-top:30px;border-radius:18px;overflow:hidden;aspect-ratio:4/3}
.map img{width:100%;height:100%;object-fit:cover;filter:saturate(.8) contrast(1.05)}
.pin{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:#FF4422;border:7px solid #fff;box-shadow:0 6px 18px #0006}
.pulse{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:#FF4422;opacity:0}
.place{display:inline-block;margin-top:30px;background:#111;color:#fff;font-size:44px;font-weight:800;padding:14px 28px;border-radius:999px}
.chip{position:absolute;left:150px;top:300px;z-index:3;display:flex;align-items:center;gap:14px;background:#111c;color:#fff;font-size:28px;font-weight:700;padding:12px 22px;border-radius:999px;letter-spacing:.01em}
.chip i{width:12px;height:12px;border-radius:50%;background:#FF4422}
.wipe{position:absolute;top:0;bottom:0;left:0;width:1080px;background:#FF4422;z-index:60;opacity:0}
.burn{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:screen;z-index:70;pointer-events:none}
.hook{position:absolute;left:150px;right:150px;top:360px;z-index:80}
.hook .label{color:#fff;font-size:30px}
.hook h1{margin-top:30px;font-size:84px;line-height:1.04;font-weight:800;letter-spacing:-.025em;text-shadow:0 4px 30px #0009}
.hook h1 span{display:inline-block;margin-right:.24em}
.cap{position:absolute;left:150px;right:150px;bottom:500px;z-index:90;font-size:64px;line-height:1.2;font-weight:800;letter-spacing:-.01em;text-align:left}
.cap .w{position:relative;display:inline-block;margin-right:.22em;padding:0 .12em;color:#ffffffd0;text-shadow:0 2px 3px #0009,0 6px 22px #0008}
.cap .w b{position:relative;z-index:1;font-weight:800}
.cap .w i{position:absolute;inset:.06em -.02em .02em;border-radius:.22em;background:#FF4422;opacity:0;box-shadow:0 6px 18px #ff442255}
.cap .w.em b{color:#FFE2D9}
"""

RUNTIME = """
window.__timelines = window.__timelines || {};
(function(){
  var P = window.PLAN, tl = gsap.timeline({paused:true});
  P.tweens.forEach(function(t){
    var els = document.querySelectorAll(t.sel);
    if (!els.length) return;
    var to = Object.assign({}, t.to || {});
    if (t.count) {
      var el = els[0], c = t.count, o = {v:0};
      tl.to(o, {v:c.n, duration:c.d, ease:'power3.out', onUpdate:function(){
        var v = c.dec ? o.v.toFixed(c.dec).replace('.', ',') : Math.round(o.v).toLocaleString('de-DE');
        el.textContent = c.pre + v + c.post;
      }}, t.at);
      return;
    }
    if (t.m === 'set') tl.set(els, to, t.at);
    else if (t.m === 'to') tl.to(els, to, t.at);
    else tl.fromTo(els, t.from, to, t.at);
  });
  window.__timelines['root'] = tl;
})();
"""


def compose(clip: dict, beats: list[dict], cues: dict, look: dict, assets: dict[str, str]) -> str:
    """The HyperFrames composition (index.html). assets maps each remote src to its local file."""
    duration = round(clip["duration"] + TAIL, 3)
    words = clip.get("words") or []
    color = clip.get("color") or "#FF4422"
    tweens: list[dict] = []
    T = tweens.append
    parts: list[str] = []
    ends = [b["at"] for b in beats[1:]] + [duration]
    last_photo = ""
    for k, b in enumerate(beats):
        start, end = b["at"], ends[k]
        hold = end - start + 0.7  # stays under the next one while it comes in
        move = cues["moves"][k] if k < len(cues["moves"]) else "cut"
        z = 10 + k
        inner = ""
        if b["kind"] == "photo":
            src = assets.get(b["src"], "")
            last_photo = src or last_photo
            inner = f'<img class="ph" src="{esc(src)}" alt="">'
            mv = b.get("move", "in")
            frm, to = {"in": ({"scale": 1.0}, {"scale": 1.13}), "out": ({"scale": 1.15}, {"scale": 1.0}),
                       "left": ({"scale": 1.14, "xPercent": 3}, {"scale": 1.14, "xPercent": -3}),
                       "right": ({"scale": 1.14, "xPercent": -3}, {"scale": 1.14, "xPercent": 3})}.get(mv, ({"scale": 1.0}, {"scale": 1.12}))
            T({"sel": f"#b{k} .ph", "m": "fromTo", "from": frm, "to": {**to, "duration": round(hold, 3), "ease": "none"}, "at": start})
        elif b["kind"] == "video":
            src = assets.get(b.get("file", ""), "")
            inner = (f'<video id="v{k}" src="{esc(src)}" muted playsinline data-start="{start}" data-duration="{round(hold, 3)}" '
                     f'data-track-index="{20 + k % 2}"></video>'
                     f'<span class="chip"><i></i>{esc(b.get("credit", ""))}</span>')
        elif b["kind"] in CARD_KINDS:
            # Blurred ahead of time (blur_copy): a CSS blur this size costs every frame of the render.
            blurred = last_photo.replace(".jpg", "-bd.jpg") if last_photo else ""
            bd = f'<img class="bd" src="{esc(blurred)}" alt="">' if blurred else ""
            if b["kind"] == "fact":
                card = (f'<div class="card"><div class="label"><i></i>{esc(clip.get("category", ""))}</div>'
                        f'<div class="fact-value" id="n{k}">{esc(b["value"])}</div><div class="fact-label">{esc(b["label"])}</div></div>')
                target = count_target(b["value"])
                if target and target[0] >= 2:
                    T({"sel": f"#n{k}", "count": {"n": target[0], "dec": target[1], "pre": target[2], "post": target[3], "d": 0.9}, "at": start + 0.15})
            elif b["kind"] == "quote":
                card = (f'<div class="card"><div class="quote-mark">“</div><div class="quote-text">{esc(b["text"])}</div>'
                        f'<div class="quote-who">— {esc(b["who"])}</div></div>')
            else:
                card = (f'<div class="card"><div class="label"><i></i>Ku ndodhi</div><div class="map"><img src="{esc(assets.get(b["src"], ""))}" alt="">'
                        f'<span class="pulse" id="p{k}"></span><span class="pin"></span></div><span class="place">{esc(b["label"])}</span></div>')
                T({"sel": f"#p{k}", "m": "fromTo", "from": {"scale": 1, "opacity": 0.55},
                   "to": {"scale": 3.2, "opacity": 0, "duration": 1.1, "ease": "power2.out", "repeat": max(0, int((end - start) / 1.1) - 1)}, "at": start + 0.4})
            inner = bd + f'<div class="cardwrap">{card}</div>'
            T({"sel": f"#b{k} .card", "m": "fromTo", "from": {"y": 90, "opacity": 0, "scale": 0.94},
               "to": {"y": 0, "opacity": 1, "scale": 1, "duration": 0.55, "ease": "expo.out"}, "at": start + 0.08})
            if b["kind"] == "map" or b["kind"] == "quote" or b["kind"] == "fact":
                T({"sel": f"#b{k} .bd", "m": "fromTo", "from": {"scale": 1.0}, "to": {"scale": 1.08, "duration": round(hold, 3), "ease": "none"}, "at": start})
        else:
            inner = ""
        cls = "beat plain" if b["kind"] == "plain" else "beat"
        parts.append(f'<div class="{cls}" id="b{k}" style="z-index:{z};--c:{esc(color)}">{inner}</div>')

        # How it comes in.
        sel = f"#b{k}"
        if move in ("cut", "burn"):
            T({"sel": sel, "m": "set", "to": {"opacity": 1}, "at": start})
            if move == "burn" and k:
                T({"sel": sel, "m": "fromTo", "from": {"scale": 1.07}, "to": {"scale": 1, "duration": 0.7, "ease": "power2.out"}, "at": start})
        elif move == "blur":
            T({"sel": sel, "m": "fromTo", "from": {"opacity": 0, "scale": 1.06, "filter": "blur(26px)"},
               "to": {"opacity": 1, "scale": 1, "filter": "blur(0px)", "duration": 0.5, "ease": "power2.out"}, "at": start - 0.1})
        elif move == "zoom":
            T({"sel": sel, "m": "fromTo", "from": {"opacity": 0, "scale": 1.32},
               "to": {"opacity": 1, "scale": 1, "duration": 0.45, "ease": "expo.out"}, "at": start - 0.08})
        elif move == "whip":
            T({"sel": sel, "m": "fromTo", "from": {"opacity": 1, "xPercent": 100, "filter": "blur(20px)"},
               "to": {"xPercent": 0, "filter": "blur(0px)", "duration": 0.38, "ease": "power4.out"}, "at": start - 0.12})
            if k:
                T({"sel": f"#b{k - 1}", "m": "to", "to": {"xPercent": -28, "filter": "blur(16px)", "duration": 0.38, "ease": "power4.out"}, "at": start - 0.12})
        elif move == "wipe":
            parts.append(f'<div class="wipe" id="w{k}"></div>')
            # (No transform in its CSS: GSAP would fold it into its own and park the bar on screen.)
            T({"sel": f"#w{k}", "m": "fromTo", "from": {"xPercent": -110, "opacity": 1}, "to": {"xPercent": 110, "duration": 0.6, "ease": "power3.inOut"}, "at": start - 0.3})
            T({"sel": sel, "m": "fromTo", "from": {"opacity": 1, "clipPath": "inset(0% 100% 0% 0%)"},
               "to": {"clipPath": "inset(0% 0% 0% 0%)", "duration": 0.6, "ease": "power3.inOut"}, "at": start - 0.26})
        # The one before, fully covered, leaves the page's work.
        if k:
            T({"sel": f"#b{k - 1}", "m": "set", "to": {"opacity": 0}, "at": round(start + 0.62, 3)})

    for n, bn in enumerate(cues["burns"]):
        parts.append(f'<video class="burn" id="burn{n}" src="{esc(bn["file"])}" muted playsinline data-start="{bn["start"]}" '
                     f'data-duration="{bn["length"]}" data-media-start="{bn["media"]}" data-track-index="{40 + n % 2}"></video>')

    # The opening frame: the section and the headline, gone once the pictures take over.
    hook_until = min(3.2, beats[1]["at"] - 0.15 if len(beats) > 1 else 3.2, duration - 0.5)
    title_words = "".join(f"<span>{esc(w)}</span>" for w in str(clip.get("title", "")).split()[:16])
    parts.append(f'<div class="hook" id="hook"><div class="label"><i></i>{esc(clip.get("category", ""))}</div><h1>{title_words}</h1></div>')
    T({"sel": "#hook .label", "m": "fromTo", "from": {"x": -40, "opacity": 0}, "to": {"x": 0, "opacity": 1, "duration": 0.4, "ease": "expo.out"}, "at": 0.05})
    T({"sel": "#hook h1 span", "m": "fromTo", "from": {"y": 60, "opacity": 0},
       "to": {"y": 0, "opacity": 1, "duration": 0.5, "ease": "expo.out", "stagger": 0.035}, "at": 0.12})
    T({"sel": "#hook", "m": "to", "to": {"opacity": 0, "y": -30, "duration": 0.3, "ease": "power2.in"}, "at": round(hook_until, 3)})

    # The words as they are said.
    emphasis = {media.norm(e) for e in (look.get("emphasis") or [])}
    lines = phrases(words)
    for n, (a, b) in enumerate(lines):
        start = words[a][0]
        end = words[lines[n + 1][0]][0] if n + 1 < len(lines) else min(duration, words[b][1] + 0.6)
        spans = []
        for j in range(a, b + 1):
            em = " em" if media.norm(words[j][2]) in emphasis else ""
            spans.append(f'<span class="w{em}" id="w{n}_{j}"><i></i><b>{esc(words[j][2])}</b></span>')
            nxt = words[j + 1][0] if j + 1 < len(words) else words[j][1] + 0.3
            T({"sel": f"#w{n}_{j} i", "m": "fromTo", "from": {"opacity": 0, "scale": 0.86}, "to": {"opacity": 1, "scale": 1, "duration": 0.08, "ease": "power2.out"}, "at": words[j][0]})
            T({"sel": f"#w{n}_{j}", "m": "set", "to": {"color": "#ffffff"}, "at": words[j][0]})
            if j < b:
                T({"sel": f"#w{n}_{j} i", "m": "to", "to": {"opacity": 0, "duration": 0.08}, "at": round(min(nxt, end), 3)})
            if em:
                T({"sel": f"#w{n}_{j}", "m": "fromTo", "from": {"scale": 1.22}, "to": {"scale": 1, "duration": 0.3, "ease": "back.out(2)"}, "at": words[j][0]})
        parts.append(f'<div class="cap" id="c{n}" data-start="{round(start, 3)}" data-duration="{round(max(0.2, end - start), 3)}" '
                     f'data-track-index="{30 + n % 2}">{"".join(spans)}</div>')
        T({"sel": f"#c{n}", "m": "fromTo", "from": {"y": 22, "opacity": 0}, "to": {"y": 0, "opacity": 1, "duration": 0.16, "ease": "power2.out"}, "at": round(start - 0.04, 3)})

    plan = json.dumps({"tweens": tweens}, ensure_ascii=False).replace("</", "<\\/")
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{STYLE}</style></head><body>'
            f'<div id="root" data-composition-id="root" data-start="0" data-duration="{duration}" data-width="{W}" data-height="{H}">'
            f'{"".join(parts)}<div class="shade-top"></div><div class="shade-bottom"></div>'
            f'<script src="js/gsap.min.js"></script><script>window.PLAN={plan};</script><script>{RUNTIME}</script>'
            f'</div></body></html>')


# ── The sound ────────────────────────────────────────────────────────────────

def run(args: list[str], timeout: int = 600) -> str:
    done = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
    if done.returncode:
        raise RuntimeError(f"{Path(args[0]).name} failed ({done.returncode}): {(done.stderr or done.stdout)[-900:]}")
    return done.stdout + done.stderr


def mix(voice: Path, cues: dict, duration: float, out: Path, root: Path) -> None:
    """Voice + bed (ducking under the voice) + effects, at -14 LUFS, 48 kHz stereo."""
    total = round(duration + TAIL, 3)
    args = ["ffmpeg", "-v", "error", "-y", "-i", str(voice)]
    graph = ["[0:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=80,equalizer=f=500:t=q:w=1:g=-2,"
             "equalizer=f=3200:t=q:w=1:g=2.5,acompressor=threshold=-24dB:ratio=3:attack=4:release=60:makeup=3,"
             f"apad=whole_dur={total},asplit=2[voice][key]"]
    mixes = ["[voice]"]
    n = 1
    if cues.get("music"):
        args += ["-stream_loop", "-1", "-i", str(root / cues["music"])]
        graph.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{total},asetpts=N/SR/TB,"
                     f"equalizer=f=3000:t=q:w=1.5:g=-4,volume={MUSIC_DB}dB,afade=t=in:d=0.8,afade=t=out:st={max(0, total - 1.4)}:d=1.4[bed0];"
                     "[bed0][key]sidechaincompress=threshold=0.04:ratio=6:attack=25:release=350:makeup=1[bed]")
        mixes.append("[bed]")
        n += 1
    else:
        graph.append("[key]anullsink")
    for s in cues.get("sfx", []):
        args += ["-i", str(root / s["file"])]
        ms = int(round(s["at"] * 1000))
        graph.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,volume={s['db']}dB,adelay={ms}|{ms}[s{n}]")
        mixes.append(f"[s{n}]")
        n += 1
    graph.append(f"{''.join(mixes)}amix=inputs={len(mixes)}:normalize=0:duration=first,atrim=0:{total}[pre]")
    raw = out.with_suffix(".pre.wav")
    run(args + ["-filter_complex", ";".join(graph), "-map", "[pre]", "-ac", "2", "-ar", "48000", str(raw)])
    # Two passes: measure, then bring it to -14 LUFS exactly (one pass undershoots on short clips).
    stats = run(["ffmpeg", "-hide_banner", "-i", str(raw), "-af", f"loudnorm=I={LUFS}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    m = json.loads(stats[stats.rfind("{"):stats.rfind("}") + 1])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af",
         f"loudnorm=I={LUFS}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
         f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", "-ar", "48000", "-c:a", "aac", "-b:a", "160k", str(out)])
    raw.unlink(missing_ok=True)


# ── The check ────────────────────────────────────────────────────────────────

def review(path: Path, duration: float) -> str:
    """"" when the render may go out, else why not."""
    if not path.exists() or path.stat().st_size < 150_000:
        return "no file"
    got = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip() or 0)
    if abs(got - (duration + TAIL)) > 0.35:
        return f"length {got:.2f}s, expected {duration + TAIL:.2f}s"
    black = run(["ffmpeg", "-hide_banner", "-i", str(path), "-vf", "blackdetect=d=0.5:pic_th=0.97", "-an", "-f", "null", "-"])
    if "black_start" in black:
        return "goes black: " + black[black.find("black_start"):][:60]
    loud = run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128", "-vn", "-f", "null", "-"])
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", loud)
    if m and not -16.5 <= float(m[-1]) <= -11.5:
        return f"loudness {m[-1]} LUFS"
    return ""


# ── One clip ─────────────────────────────────────────────────────────────────

def fetch(url: str, dest: Path) -> bool:
    try:
        dest.write_bytes(media.http_bytes(url, 40))
        return dest.stat().st_size > 2000
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False


def blur_copy(path: Path) -> None:
    """img.jpg -> img-bd.jpg: soft, dark and small, to sit behind a card."""
    try:
        from PIL import Image, ImageEnhance, ImageFilter
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((720, 720))
            w, h = im.size
            side = min(w, h * 9 // 16)
            im = im.crop(((w - side) // 2, 0, (w - side) // 2 + side, min(h, side * 16 // 9))).resize((540, 960))
            im = ImageEnhance.Brightness(im.filter(ImageFilter.GaussianBlur(26))).enhance(0.55)
            im.save(path.with_name(path.stem + "-bd.jpg"), "JPEG", quality=80)
    except Exception as exc:  # no backdrop is better than no clip
        print(f"EDITION backdrop failed for {path.name}: {exc!r}", file=sys.stderr)


def make_video(slug: str, clip: dict, voice_mp3: bytes, look: dict, workdir: Path, lib: dict | None = None) -> dict | None:
    """Render the clip: {"hd": path, "sd": path, "poster": path, "cues": {...}} or None (the
    edition then keeps its browser beats for this story)."""
    lib = lib or load_library()
    root = Path(lib["root"])
    work = workdir / f"render-{slug}"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    for sub in ("burns", "fonts", "js"):
        (work / sub).symlink_to(root / sub, target_is_directory=True)
    beats = clip["beats"]
    assets: dict[str, str] = {}
    keep = []
    for k, b in enumerate(beats):
        src = b.get("src") or ""
        if b["kind"] in ("photo", "map") and src and src not in assets:
            local = work / f"img{k}.jpg"
            if fetch(src, local):
                assets[src] = local.name
                if b["kind"] == "photo":
                    blur_copy(local)
            elif b["kind"] == "photo":
                continue  # a photo that will not load: the beat before stays longer
        if b["kind"] == "video" and b.get("file"):
            local = work / f"foot{k}.mp4"
            shutil.copy(b["file"], local)
            assets[b["file"]] = local.name
        keep.append(b)
    if not keep:
        return None
    keep[0] = {**keep[0], "at": 0.0}
    meta = {**look, "mood": mood_for(clip.get("category", ""), look.get("mood", ""))}
    voice = work / "voice.mp3"
    voice.write_bytes(voice_mp3)
    (work / "clip.json").write_text(json.dumps({"slug": slug, "clip": {k: v for k, v in clip.items() if k != "beats"},
                                                "beats": keep, "look": meta, "assets": assets}, ensure_ascii=False), encoding="utf-8")
    return finish(work, slug, clip, keep, meta, assets, lib)


def finish(work: Path, slug: str, clip: dict, keep: list[dict], meta: dict, assets: dict, lib: dict) -> dict | None:
    """Cue, compose, mix, render, encode and check a clip whose files are in work/."""
    root = Path(lib["root"])
    for b in keep:
        local = work / assets.get(b.get("src", ""), "-")
        if b["kind"] == "photo" and local.is_file() and not local.with_name(local.stem + "-bd.jpg").exists():
            blur_copy(local)
    cues = build_cues(keep, clip["duration"], clip.get("words") or [], meta, lib, slug)
    (work / "index.html").write_text(compose(clip, keep, cues, meta, assets), encoding="utf-8")
    voice = work / "voice.mp3"
    sound = work / "mix.m4a"
    master = work / "master.mp4"
    try:
        mix(voice, cues, clip["duration"], sound, root)
        run(["nice", "-n", "12", str(HYPERFRAMES / "node_modules" / ".bin" / "hyperframes"), "render", str(work), "-o", str(master),
             "--fps", str(FPS), "--quality", "high", "--workers", "2", "--quiet"], timeout=900)
        hd, sd, poster = work / "hd.mp4", work / "sd.mp4", work / "poster.jpg"
        common = ["-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-pix_fmt", "yuv420p", "-g", "60",
                  "-movflags", "+faststart", "-c:a", "copy", "-shortest"]
        run(["nice", "-n", "12", "ffmpeg", "-v", "error", "-y", "-i", str(master), "-i", str(sound), "-map", "0:v", "-map", "1:a",
             "-crf", "24", "-maxrate", "3000k", "-bufsize", "6000k", *common, str(hd)], timeout=900)
        run(["nice", "-n", "12", "ffmpeg", "-v", "error", "-y", "-i", str(master), "-i", str(sound), "-map", "0:v", "-map", "1:a",
             "-vf", "scale=720:1280:flags=lanczos", "-crf", "26", "-maxrate", "1400k", "-bufsize", "2800k", *common, str(sd)], timeout=900)
        run(["ffmpeg", "-v", "error", "-y", "-ss", "1.0", "-i", str(hd), "-frames:v", "1", "-vf", "scale=720:1280", "-q:v", "4", str(poster)])
    except (RuntimeError, subprocess.TimeoutExpired, OSError, ValueError, KeyError) as exc:
        print(f"EDITION {slug}: render failed ({exc})", file=sys.stderr)
        return None
    why = review(hd, clip["duration"])
    if why:
        print(f"EDITION {slug}: render not published ({why})", file=sys.stderr)
        return None
    return {"hd": hd, "sd": sd, "poster": poster, "cues": cues, "beats": keep}


if __name__ == "__main__":
    # Make a trial clip again from its folder (clip.json, voice.mp3, the pictures), with no new voice:
    #   python video_edition_render.py /opt/data/video-edition/trials/<slug>/render-<slug>
    folder = Path(sys.argv[1])
    saved = json.loads((folder / "clip.json").read_text(encoding="utf-8"))
    made = finish(folder, saved["slug"], saved["clip"], saved["beats"], saved["look"], saved["assets"], load_library())
    print(json.dumps({k: str(v) for k, v in (made or {}).items() if k in ("hd", "sd", "poster")}))
