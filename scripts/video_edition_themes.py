"""The look of a clip, by what it is about (scripts/video_edition_render.py draws with it).

A clip about Kosovo, a football match, a Formula 1 race, a celebrity or the economy should not
look like every other clip. Each theme sets:
- its colours (an accent, a second colour, the card colours) for every label, card, wipe and
  graphic, through CSS variables on the composition;
- the kicker over the headline (an icon and a word: "KOSOVË", "FUTBOLL", "FORMULA 1"), and for
  Kosovo and Albania the country's outline drawn behind the headline;
- its signature wipe (a pitch, a chequered flag, a court, a sparkle sweep, a data grid, Kosovo's
  stars), which the cue sheet uses for a cut or two;
- a quiet ambient decor (sparkles, a chart grid, speed lines), or none;
- its signature sounds, each used once or twice (a whistle at kick-off, the crowd or the buzzer
  when the score lands, an engine on the first cut, camera flashes for a star, data blips for a
  chart, a news sting for politics).
"""
from __future__ import annotations

import math
import re
import unicodedata

THEMES: dict[str, dict] = {
    # Politics and the world: 383's own orange on cream.
    "default": {"acc": "#FF4422", "acc2": "#111111", "card": "#F5F0E6", "cardink": "#111111", "cardsub": "#5d554d",
                "kicker": "", "icon": "", "wipe": "plain", "decor": "", "sounds": {"hook": "sting"}},
    "kosovo": {"acc": "#2F5BD3", "acc2": "#D9AA47", "card": "#F4F1E8", "cardink": "#0E1B3D", "cardsub": "#4a5470",
               "kicker": "Kosovë", "icon": "kosovo", "wipe": "stars", "decor": "", "sounds": {"hook": "sting"}},
    "albania": {"acc": "#E41E20", "acc2": "#111111", "card": "#F6F0EE", "cardink": "#160606", "cardsub": "#5c4040",
                "kicker": "Shqipëri", "icon": "albania", "wipe": "plain", "decor": "", "sounds": {"hook": "sting"}},
    "football": {"acc": "#1DB45A", "acc2": "#0B3D1F", "card": "#F2F7F1", "cardink": "#08210F", "cardsub": "#3e5a46",
                 "kicker": "Futboll", "icon": "ball", "wipe": "pitch", "decor": "", "sounds": {"open": "whistle", "score": "crowd"}},
    "basketball": {"acc": "#F26B1D", "acc2": "#2A1408", "card": "#FBF3EA", "cardink": "#2A1408", "cardsub": "#6b4a33",
                   "kicker": "Basketboll", "icon": "hoop", "wipe": "court", "decor": "", "sounds": {"score": "buzzer"}},
    "f1": {"acc": "#E10600", "acc2": "#15151E", "card": "#15151E", "cardink": "#FFFFFF", "cardsub": "#b9b9c6",
           "kicker": "Formula 1", "icon": "flag", "wipe": "checker", "decor": "speed", "sounds": {"open": "engine"}},
    "tennis": {"acc": "#C9DC2E", "acc2": "#B5532A", "card": "#F7F3E8", "cardink": "#2b1a0f", "cardsub": "#6b5440",
               "kicker": "Tenis", "icon": "tennis", "wipe": "plain", "decor": "", "sounds": {"score": "crowd"}},
    "sport": {"acc": "#FF4422", "acc2": "#111111", "card": "#F5F0E6", "cardink": "#111111", "cardsub": "#5d554d",
              "kicker": "Sport", "icon": "ball", "wipe": "plain", "decor": "", "sounds": {"score": "crowd"}},
    "showbiz": {"acc": "#FF3EA5", "acc2": "#FFC94A", "card": "#FFF6FA", "cardink": "#2a0a1c", "cardsub": "#7a4a63",
                "kicker": "Showbiz", "icon": "star", "wipe": "sparkle", "decor": "sparkles", "sounds": {"open": "flash", "slam": "sparkle"}},
    "economy": {"acc": "#16B364", "acc2": "#0B1F3A", "card": "#0F2440", "cardink": "#FFFFFF", "cardsub": "#9fb3cc",
                "kicker": "Ekonomi", "icon": "chart", "wipe": "grid", "decor": "grid", "sounds": {"card": "blip", "hook": "sting"}},
    "conflict": {"acc": "#E5484D", "acc2": "#1A1A1A", "card": "#F3EEEC", "cardink": "#1A1A1A", "cardsub": "#5b4f4c",
                 "kicker": "", "icon": "", "wipe": "plain", "decor": "", "sounds": {"hook": "sting"}},
    "tech": {"acc": "#7C5CFF", "acc2": "#0E0B1F", "card": "#F3F1FF", "cardink": "#120d2b", "cardsub": "#565075",
             "kicker": "Teknologji", "icon": "chip", "wipe": "grid", "decor": "", "sounds": {"card": "blip"}},
}


def fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text or "").lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def _has(text: str, pattern: str) -> int:
    return len(re.findall(r"(?<![a-z])(?:" + pattern + r")", text))


def theme_for(category: str, text: str) -> str:
    """The theme of a story, from its section and its own words (the newsroom files a basketball
    game under Kosovë now and then: the words decide)."""
    c, t = fold(category), fold(text)
    if _has(t, r"formula 1|formula one|f1|grand prix|verstappen|hamilton|leclerc|norris|piastri|russell|kualifikim|pilot") >= 2:
        return "f1"
    sporty = _has(t, r"futboll|basketboll|tenis|boks|golf|ndeshj|kampionat|turne|gol|gola|goli|pike|trajner|lojtar|skuadr|"
                     r"stadium|superlig|la ?liga|premier league|serie a|bundesliga|champions|uefa|fifa|formula|grand prix|wta|atp|nba|"
                     r"finale|gjysmefinal|kualifikim|medalj|olimpi|boks|revansh|nokaut|ring|golf|raund|superiore|abissnet|grupin")
    named = _has(t, r"basketboll|futboll|tenis|formula 1|boks|golf|volejboll|hendboll|atletik|ciklizem")
    if "sport" in c or sporty >= 3 or named >= 1:
        if _has(t, r"basketboll|nba|euroleague|kosh|cerek") >= 1:
            return "basketball"
        if _has(t, r"tenis|wta|atp|grand slam|wimbledon|roland garros|us open") >= 1:
            return "tennis"
        if _has(t, r"futboll|gol|gola|goli|penallti|la ?liga|premier league|serie a|bundesliga|champions|uefa|fifa|el clasico|"
                   r"superlig|superiore|abissnet|kombetarja|barcelona|real madrid|ligue 1|conference league") >= 1:
            return "football"
        return "sport"
    if "teknolog" in c or "shkenc" in c or _has(t, r"inteligjenc[ae] artificiale|ai|openai|anthropic|chatgpt|tiktok|startup|"
                                                  r"aplikacion|teknologji|google|apple|microsoft|meta|spacex|nasa|robot") >= 2:
        return "tech"
    if "showbiz" in c or "argetim" in c or _has(t, r"kengetar|aktor|aktore|kengetare|film|serial|celebrit|reper|modele|holliv|"
                                                  r"hollywood|gala|oscar|grammy|koncert|album|kenge") >= 3:
        return "showbiz"
    if "ekonomi" in c or "biznes" in c or _has(t, r"inflacion|cmim|bank[ae]?|euro|bursa|eksport|import|buxhet|pag[ae]|tatim|"
                                                 r"investim|pib|rritje ekonomike|depozit|sanksion|tregti") >= 3:
        return "economy"
    if _has(t, r"lufte|sulm|bombard|raket|protest|trazir|ushtar|vrase|plagos") >= 3:
        return "conflict"
    kosovo, albania = _has(t, r"kosov|prishtin|kurti|osmani|kuvendi i kosoves"), _has(t, r"shqiperi|tiran|rama|berisha|begaj")
    if "kosov" in c or (kosovo >= 2 and kosovo >= albania):
        return "kosovo"
    if "shqiperi" in c or albania >= 2:
        return "albania"
    return "default"


# ── Icons and outlines ───────────────────────────────────────────────────────

ICONS = {
    "ball": '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#fff" stroke="currentColor" stroke-width="2.5"/>'
            '<path d="M20 11l7 5-2.7 8h-8.6L13 16z" fill="currentColor"/><path d="M20 3v8M27 16l9-3M24.3 24l5 7M15.7 24l-5 7M13 16l-9-3" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
    "hoop": '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="currentColor"/><path d="M3 20h34M20 3v34M8 8c6 6 6 18 0 24M32 8c-6 6-6 18 0 24" stroke="#111" stroke-width="2" fill="none"/></svg>',
    "flag": '<svg viewBox="0 0 40 40"><path d="M6 4v33" stroke="currentColor" stroke-width="3"/><path d="M8 5h26v18H8z" fill="#fff"/>'
            '<path d="M8 5h6.5v6H8zM21 5h6.5v6H21zM14.5 11H21v6h-6.5zM27.5 11H34v6h-6.5zM8 17h6.5v6H8zM21 17h6.5v6H21z" fill="#111"/></svg>',
    "tennis": '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="currentColor"/><path d="M6 10c9 4 9 16 0 20M34 10c-9 4-9 16 0 20" stroke="#fff" stroke-width="2.5" fill="none"/></svg>',
    "star": '<svg viewBox="0 0 40 40"><path d="M20 3l4.9 10.6 11.6 1.3-8.7 7.8 2.5 11.4L20 28.3 9.7 34.1l2.5-11.4-8.7-7.8 11.6-1.3z" fill="currentColor"/></svg>',
    "chart": '<svg viewBox="0 0 40 40"><path d="M5 34h31" stroke="currentColor" stroke-width="3"/><rect x="8" y="20" width="6" height="12" fill="currentColor"/>'
             '<rect x="17" y="13" width="6" height="19" fill="currentColor"/><rect x="26" y="6" width="6" height="26" fill="currentColor"/></svg>',
    "chip": '<svg viewBox="0 0 40 40"><rect x="9" y="9" width="22" height="22" rx="3" fill="currentColor"/><path d="M14 4v5M20 4v5M26 4v5M14 31v5M20 31v5M26 31v5M4 14h5M4 20h5M4 26h5M31 14h5M31 20h5M31 26h5" stroke="currentColor" stroke-width="2.5"/></svg>',
}

# Rough outlines (longitude, latitude) of the two countries, for the opening: a mark, not a map.
OUTLINES = {
    "kosovo": [(20.06, 42.55), (20.24, 42.81), (20.52, 42.89), (20.80, 43.26), (21.10, 43.18), (21.40, 42.95), (21.77, 42.68),
               (21.57, 42.25), (21.12, 42.19), (20.76, 42.06), (20.59, 41.86), (20.52, 42.21), (20.28, 42.32)],
    "albania": [(19.37, 41.85), (19.45, 41.40), (19.52, 41.25), (19.40, 40.90), (19.31, 40.65), (19.40, 40.35), (19.94, 39.95),
                (20.05, 39.69), (20.32, 39.99), (20.67, 40.10), (21.03, 40.62), (20.95, 40.85), (20.55, 41.10), (20.47, 41.52),
                (20.59, 41.86), (20.22, 42.17), (19.75, 42.62), (19.40, 42.33)],
}


def outline_path(country: str, size: float = 100.0) -> str:
    """An SVG path of the country's outline, fitted into a size x size box."""
    pts = OUTLINES.get(country) or []
    if not pts:
        return ""
    lat0 = sum(p[1] for p in pts) / len(pts)
    xs = [p[0] * math.cos(math.radians(lat0)) for p in pts]
    ys = [-p[1] for p in pts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    k = size / max(w, h)
    ox, oy = (size - w * k) / 2, (size - h * k) / 2
    coords = [(ox + (x - min(xs)) * k, oy + (y - min(ys)) * k) for x, y in zip(xs, ys)]
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in coords) + " Z"


def icon(theme: dict) -> str:
    name = theme.get("icon") or ""
    if name in OUTLINES:
        return f'<svg viewBox="0 0 100 100"><path d="{outline_path(name)}" fill="currentColor"/></svg>'
    return ICONS.get(name, "")


# ── Styles ───────────────────────────────────────────────────────────────────

def variables(theme: dict) -> str:
    return (f"--acc:{theme['acc']};--acc2:{theme['acc2']};--card:{theme['card']};--cardink:{theme['cardink']};"
            f"--cardsub:{theme['cardsub']}")


STYLE = """
.kicker{display:flex;align-items:center;gap:16px}
.kicker .ic{display:block;width:46px;height:46px;color:var(--acc)}
.kicker .ic svg{width:100%;height:100%;display:block}
.outline{position:absolute;left:50%;top:250px;width:760px;height:760px;margin-left:-380px;z-index:79;opacity:0}
.outline path{fill:var(--acc);fill-opacity:.2;stroke:var(--acc2);stroke-width:.7;stroke-linejoin:round}
.wipe-pitch{background:linear-gradient(90deg,#0f7a3a 0 50%,#13873f 50% 100%);background-size:180px 100%}
.wipe-pitch::after{content:"";position:absolute;left:50%;top:0;bottom:0;width:10px;margin-left:-5px;background:#fff;opacity:.85}
.wipe-pitch::before{content:"";position:absolute;left:50%;top:50%;width:300px;height:300px;margin:-150px 0 0 -150px;border:10px solid #fff;border-radius:50%;opacity:.85}
.wipe-checker{background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0 0/120px 120px}
.wipe-court{background:#d9773a}
.wipe-court::before{content:"";position:absolute;left:50%;top:50%;width:520px;height:520px;margin:-260px 0 0 -260px;border:12px solid #fff4;border-radius:50%}
.wipe-sparkle{background:linear-gradient(120deg,var(--acc),var(--acc2))}
.wipe-sparkle::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 30%,#fff 0 6px,transparent 7px),radial-gradient(circle at 70% 60%,#fff 0 5px,transparent 6px),radial-gradient(circle at 40% 80%,#fff 0 4px,transparent 5px),radial-gradient(circle at 85% 20%,#fff 0 7px,transparent 8px)}
.wipe-grid{background:var(--acc2) linear-gradient(transparent 0 0)}
.wipe-grid::before{content:"";position:absolute;inset:0;background-image:linear-gradient(#ffffff22 2px,transparent 2px),linear-gradient(90deg,#ffffff22 2px,transparent 2px);background-size:90px 90px}
.wipe-grid::after{content:"";position:absolute;left:0;right:0;top:55%;height:8px;background:var(--acc)}
.wipe-stars{background:var(--acc)}
.wipe-stars::before{content:"★ ★ ★ ★ ★ ★";position:absolute;left:0;right:0;top:44%;text-align:center;color:var(--acc2);font-size:90px;letter-spacing:.2em}
.decor{position:absolute;inset:0;z-index:52;pointer-events:none}
.decor .sp{position:absolute;width:34px;height:34px;color:#fff;opacity:0}
.decor .sp svg{width:100%;height:100%;display:block;filter:drop-shadow(0 0 10px #fff)}
.decor.grid{opacity:.5;background-image:linear-gradient(#ffffff10 2px,transparent 2px),linear-gradient(90deg,#ffffff10 2px,transparent 2px);background-size:120px 120px}
.decor .speed{position:absolute;height:6px;border-radius:3px;background:linear-gradient(90deg,transparent,#fff);opacity:0}
.chartbox{position:relative;margin-top:24px;height:420px;display:flex;align-items:flex-end;gap:22px;padding:0 4px;border-bottom:4px solid var(--cardsub)}
.chartbox .bar{position:relative;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}
.chartbox .bar b{display:block;width:100%;border-radius:12px 12px 0 0;background:var(--cardsub);transform-origin:50% 100%}
.chartbox .bar.hi b{background:var(--acc)}
.chartbox .bar span{position:absolute;bottom:calc(var(--h) + 10px);font-size:42px;font-weight:800;color:var(--cardink);font-variant-numeric:tabular-nums;white-space:nowrap}
.chartbox .bar i{position:absolute;bottom:-58px;font-style:normal;font-size:28px;font-weight:700;color:var(--cardsub);white-space:nowrap}
.chartbox svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.chartbox polyline{fill:none;stroke:var(--cardink);stroke-width:6;stroke-linecap:round;stroke-linejoin:round;opacity:.85}
.chartbox .dots circle{fill:var(--cardink);stroke:var(--card);stroke-width:4}
.delta{display:inline-flex;align-items:center;gap:10px;margin-top:84px;padding:10px 20px;border-radius:999px;font-size:36px;font-weight:800;color:#fff;background:var(--acc)}
.delta.down{background:#E5484D}
.rank{margin-top:22px;display:flex;flex-direction:column;gap:12px}
.rank .row{position:relative;display:flex;align-items:center;gap:22px;padding:14px 22px;border-radius:14px;background:#ffffff10}
.rank .pos{width:56px;height:56px;flex:none;display:grid;place-items:center;border-radius:10px;font-size:34px;font-weight:800;background:var(--acc);color:#fff}
.rank .nm{flex:1;font-size:40px;font-weight:800;color:var(--cardink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rank .val{font-size:40px;font-weight:800;color:var(--cardink);font-variant-numeric:tabular-nums}
.card .rank .row,.sb .rank .row{background:#0000000d}
.rank.f1 .row{background:#ffffff0f;border-left:8px solid var(--acc);border-radius:6px}
.rank.f1 .pos{background:#fff;color:#15151E}
.profile{position:absolute;left:150px;right:150px;top:330px;z-index:66;opacity:0;display:flex;flex-direction:column;align-items:center;text-align:center}
.profile .ph{position:relative;width:420px;height:420px;border-radius:50%;overflow:hidden;border:10px solid var(--acc);box-shadow:0 0 0 10px #ffffff22,0 30px 80px #000a}
.profile .ph img{width:100%;height:100%;object-fit:cover;object-position:50% 25%}
.profile .nm{margin-top:34px;font-size:66px;font-weight:800;letter-spacing:-.02em;line-height:1.05;text-shadow:0 4px 30px #000c}
.profile .rl{margin-top:16px;display:inline-block;padding:10px 24px;border-radius:999px;background:var(--acc);color:#fff;font-size:34px;font-weight:800}
.profile .ring{position:absolute;left:50%;top:0;width:420px;height:420px;margin-left:-210px;border-radius:50%;border:6px dashed var(--acc2);opacity:.9}
.keyline{position:absolute;left:150px;right:150px;top:520px;z-index:66;opacity:0}
.keyline .kl{font-size:var(--kf,104px);line-height:1.02;font-weight:800;letter-spacing:-.035em;text-transform:uppercase;color:#fff;text-shadow:0 6px 40px #000c}
.keyline .kl span{display:inline-block;margin-right:.2em}
.keyline u{display:block;height:16px;width:300px;margin-top:26px;border-radius:8px;background:var(--acc);transform-origin:0 50%}
.keyline .kk{font-size:30px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--acc);margin-bottom:22px}
"""


def wipe_class(theme: dict) -> str:
    return f"wipe wipe-{theme.get('wipe') or 'plain'}"


def sparkle_svg() -> str:
    return ICONS["star"].replace('fill="currentColor"', 'fill="#fff"')
