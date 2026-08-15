"""
Scrapes Kosovo-related news from Google News RSS per country, classifies
sentiment + translates headlines to Albanian via Groq (heuristic fallback,
no translation, if no key), resolves a real image per article, and writes
three files:

  public/tone-outlets.json       — today's full snapshot, grouped by outlet
                                    (per-country hover drill-down on the
                                    homepage's "Toni i Mediave" dashboard)
  public/tone-history.json       — one row per day (capped at HISTORY_DAYS),
                                    country-level indices + a handful of the
                                    day's most positive/negative headlines —
                                    what makes "Toni i Mediave" a real time
                                    series instead of a reshuffled snapshot.
  public/tone-article-cache.json — persistent, cross-run article cache. This
                                    now runs 9x/day (07:00-23:00 Kosovo time,
                                    matching the main news pipeline), so a
                                    cache is what keeps repeat runs within a
                                    day from re-spending Groq calls and
                                    re-scraping images on stories already
                                    seen a few hours earlier. It's also what
                                    "Bota Flet" reads from directly — see
                                    lib/tone-data.ts:getForeignCoverage().

Run via GitHub Actions (.github/workflows/tone-scraper.yml) or manually:
python tools/tone_scraper.py
"""

import json
import os
import re
import socket
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import feedparser
import requests
from bs4 import BeautifulSoup
from googlenewsdecoder import gnewsdecoder
from groq import Groq

# googlenewsdecoder's internal requests.get()/post() calls (new_decoderv2.py)
# pass no timeout at all — confirmed by reading its source. A single
# unresponsive server would hang that thread forever with no bound anywhere
# else in the call chain. Python's socket module falls back to this global
# default whenever a caller (ours or a third party's) doesn't pass an
# explicit timeout, so this is the actual backstop, not just scrape_og_image's
# explicit timeout=8 below. Must be set before any network call runs.
socket.setdefaulttimeout(15)

ROOT = Path(__file__).parent.parent
OUTLETS_PATH = ROOT / "public" / "tone-outlets.json"
HISTORY_PATH = ROOT / "public" / "tone-history.json"
CACHE_PATH = ROOT / "public" / "tone-article-cache.json"
# Two jobs, two models, two budgets. Stance is the hard call — an 8B model gave
# the same story opposite labels at two outlets on the same day — so it runs on
# the strongest production model Groq offers. Translation is the easy job and
# runs on the model with 5x the daily token allowance. Classification only ever
# touches cache misses (see main()), which is dozens of articles a day, not the
# ~300 fetched — single-digit calls, well inside llama-3.3-70b's free-tier
# ceiling of 1K requests / 100K tokens per day.
CLASSIFY_MODEL = os.environ.get("GROQ_CLASSIFY_MODEL", "llama-3.3-70b-versatile")
TRANSLATE_MODEL = os.environ.get("GROQ_TRANSLATE_MODEL", "llama-3.1-8b-instant")

# What the label means, not what the code version is. v1 read "is this good or
# bad news about Kosovo"; v2 reads "is this outlet's own voice hostile toward
# Kosovo". A row carries the version that produced it so the trend chart can
# mark where the definition changed instead of splicing two of them together.
STANCE_SCHEMA_VERSION = 2

# Cap so tone-history.json stays a small, fast-to-fetch file (~4 months of
# daily rows) instead of growing forever.
HISTORY_DAYS = 120

# Below this many deduped articles, a country's index is noisy enough that
# the UI should show it as low-confidence rather than a bare percentage.
MIN_CONFIDENT_N = 8

# Cache retention deliberately wider than Bota Flet's 72h display window
# (lib/tone-data.ts) — survives a workflow outage over a weekend without
# losing data, and keeps this file small (low hundreds of live entries at
# any time, not tens of thousands).
CACHE_RETENTION_DAYS = 7

# A permanently imageless article (paywall, no og:image tag, scraper
# blocked) shouldn't get re-fetched on every one of the 9 daily runs
# forever — cap the retry budget and move on.
MAX_IMAGE_ATTEMPTS = 3
IMAGE_WORKERS = 8
# Hard cap on the whole image-resolution phase, regardless of how many
# stragglers are still running — see the comment at the wait() call below.
IMAGE_BATCH_TIMEOUT = 240

# Small enough that llama-3.1-8b-instant stays coherent across the whole
# numbered list; small enough that one malformed-JSON response only costs
# one chunk's retry, not the whole run's.
TRANSLATE_BATCH_SIZE = 10
# Stance asks for five fields per item and reasoning about each one, so the
# chunks are smaller — accuracy per item matters more here than throughput,
# and the volume is tiny either way.
CLASSIFY_BATCH_SIZE = 6

# Fifteen editions, not five. Five made "Toni i Mediave Botërore" a claim the
# data could not support, and left a map that was mostly empty sea.
#
# Serbia was tried and deliberately removed: its coverage is a party to the
# subject rather than an outside observer of it, which is a different thing
# from "how the world's press writes about Kosovo".
FEEDS = {
    "Gjermani": "https://news.google.com/rss/search?q=Kosovo&hl=de&gl=DE&ceid=DE:de",
    "SHBA":     "https://news.google.com/rss/search?q=Kosovo&hl=en-US&gl=US&ceid=US:en",
    "Britani":  "https://news.google.com/rss/search?q=Kosovo&hl=en-GB&gl=GB&ceid=GB:en",
    "Francë":   "https://news.google.com/rss/search?q=Kosovo&hl=fr&gl=FR&ceid=FR:fr",
    "Itali":    "https://news.google.com/rss/search?q=Kosovo&hl=it&gl=IT&ceid=IT:it",
    "Austri":   "https://news.google.com/rss/search?q=Kosovo&hl=de&gl=AT&ceid=AT:de",
    "Zvicër":   "https://news.google.com/rss/search?q=Kosovo&hl=de&gl=CH&ceid=CH:de",
    "Holandë":  "https://news.google.com/rss/search?q=Kosovo&hl=nl&gl=NL&ceid=NL:nl",
    "Belgjikë": "https://news.google.com/rss/search?q=Kosovo&hl=fr&gl=BE&ceid=BE:fr",
    "Spanjë":   "https://news.google.com/rss/search?q=Kosovo&hl=es&gl=ES&ceid=ES:es",
    "Greqi":    "https://news.google.com/rss/search?q=Kosovo&hl=el&gl=GR&ceid=GR:el",
    "Suedi":    "https://news.google.com/rss/search?q=Kosovo&hl=sv&gl=SE&ceid=SE:sv",
    "Poloni":   "https://news.google.com/rss/search?q=Kosovo&hl=pl&gl=PL&ceid=PL:pl",
    "Turqi":    "https://news.google.com/rss/search?q=Kosovo&hl=tr&gl=TR&ceid=TR:tr",
    "Kroaci":   "https://news.google.com/rss/search?q=Kosovo&hl=hr&gl=HR&ceid=HR:hr",
}

FLAGS = {
    "Gjermani": "🇩🇪", "SHBA": "🇺🇸", "Britani": "🇬🇧", "Francë": "🇫🇷",
    "Itali": "🇮🇹", "Austri": "🇦🇹", "Zvicër": "🇨🇭",
    "Holandë": "🇳🇱", "Belgjikë": "🇧🇪", "Spanjë": "🇪🇸", "Greqi": "🇬🇷",
    "Suedi": "🇸🇪", "Poloni": "🇵🇱", "Turqi": "🇹🇷", "Kroaci": "🇭🇷",
}

# Sixteen feeds mean ~960 candidates a run, and on the first run after this
# change nearly all of them are cache misses. At six per batch that is 160
# classification calls in one go, well past llama-3.3-70b's 100K tokens a day
# — the backfill already proved that ceiling is real. So the backlog is filled
# a slice at a time: each run classifies at most this many new articles and
# leaves the rest for the next one, ninety minutes later. Steady state is far
# below the cap; this only bites while a new country is warming up.
MAX_NEW_PER_RUN = 48

# How many times an article may be re-sent to the classifier before we accept
# that it is genuinely unreadable. Most UNKNOWNs are transient — a batch lost
# to a rate limit — so a couple of retries recovers nearly all of them without
# letting a permanently odd headline consume a slot on all nine daily runs.
MAX_STANCE_ATTEMPTS = 4

# Same idea for the Albanian rendering. A non-neutral article without one is
# the case that actually costs us — those are the pieces the homepage leads
# with — so they get retried, bounded, on the model with the larger budget.
MAX_TRANSLATE_ATTEMPTS = 3
TRANSLATE_RETRY_PER_RUN = 20

KNOWN_OUTLETS: dict[str, dict[str, str]] = {
    "Gjermani": {
        "spiegel.de": "Der Spiegel",
        "sueddeutsche.de": "Süddeutsche Zeitung",
        "zeit.de": "Die Zeit",
        "faz.net": "FAZ",
        "bild.de": "Bild",
        "tagesschau.de": "Tagesschau",
    },
    "SHBA": {
        "apnews.com": "AP",
        "washingtonpost.com": "Washington Post",
        "nytimes.com": "New York Times",
        "bloomberg.com": "Bloomberg",
        "theatlantic.com": "The Atlantic",
        "politico.com": "Politico",
    },
    "Britani": {
        "theguardian.com": "Guardian",
        "bbc.com": "BBC",
        "bbc.co.uk": "BBC",
        "reuters.com": "Reuters",
        "independent.co.uk": "Independent",
        "thetimes.co.uk": "The Times",
        "ft.com": "Financial Times",
    },
    "Francë": {
        "lemonde.fr": "Le Monde",
        "lefigaro.fr": "Le Figaro",
        "franceinfo.fr": "France Info",
        "afp.com": "AFP",
        "liberation.fr": "Libération",
    },
    "Itali": {
        "repubblica.it": "La Repubblica",
        "corriere.it": "Corriere della Sera",
        "ansa.it": "ANSA",
        "lastampa.it": "La Stampa",
    },
}

# KNOWN_OUTLETS above only *renames* — it never filtered, so anything Google
# News attached a <source> title to counted as that country's press. Two kinds
# of thing slip through and both corrupt the index:
#
#   1. Kosovar and Albanian outlets. KOHA.net writing about Kosovo is not
#      "how German media sees Kosovo" — it is Kosovo talking about itself, and
#      it lands in the German feed only because Google served it there.
#   2. Things that are not press at all: military PR wires, an army's own
#      newsroom, a sports streamer, a legal-directory blog.
#
# Matched against both the domain and the source name, since Google supplies
# whichever it has. Substring match is deliberate — "koha.net" must also catch
# "arkiva.koha.net".
BLOCKED_DOMAINS = {
    # Kosovar / Albanian press — the subject, not the observer.
    "koha.net", "telegrafi.com", "kallxo.com", "gazetaexpress.com",
    "klankosova.tv", "rtklive.com", "indeksonline.net", "botasot.info",
    "zeri.info", "insajderi.com", "kosova-sot.info", "epokaere.com",
    "top-channel.tv", "panorama.com.al", "shqiptarja.com", "balkanweb.com",
    "syri.net", "albaniandailynews.com", "tiranatimes.com",
    # Serbian press. Removing the Serbian *feed* was not enough on its own:
    # Google serves Belgrade outlets into other countries' editions, and B92
    # was landing in the US feed and coming out as the single most critical
    # piece of "American" coverage. Serbian media is a party to the subject,
    # not an outside observer of it — the same reason the feed went.
    "b92.net", "blic.rs", "kurir.rs", "informer.rs", "politika.rs",
    "danas.rs", "telegraf.rs", "novosti.rs", "rts.rs", "tanjug.rs",
    "alo.rs", "espreso.rs", "vesti.rs", "nova.rs", "n1info.com",
    "sputnikportal.rs", "srbijadanas.com", "objektiv.rs", "pink.rs",
    # Not press.
    "dvidshub.net", "bundeswehr.de", "nato.int", "kfor.nato.int",
    "dazn.com", "anwalt.de", "audimax.de",
}
BLOCKED_NAMES = {
    "koha.net", "koha ditore", "telegrafi", "kallxo", "gazeta express",
    "klan kosova", "rtk", "indeksonline", "bota sot", "zëri", "zeri",
    "insajderi", "kosova sot", "top channel", "panorama", "shqiptarja",
    "balkanweb", "syri", "albanian daily news", "tirana times",
    "b92", "blic", "kurir", "informer", "politika", "danas", "telegraf",
    "novosti", "rts", "tanjug", "espreso", "srbija danas", "sputnik",
    "dvids", "bundeswehr", "nato", "kfor", "dazn", "anwalt.de", "audimax",
}


def is_foreign_press(outlet: str, url: str) -> bool:
    """False for outlets that must not count toward a foreign country's tone."""
    name = (outlet or "").strip().lower()
    # Word boundaries, not substrings. Plain `in` blocked La Repubblica,
    # because "blic" sits inside "repub-blic-a" — short outlet names collide
    # with ordinary words often enough that this has to be exact.
    if any(re.search(rf"\b{re.escape(blocked)}\b", name) for blocked in BLOCKED_NAMES):
        return False
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return True
    return not any(blocked in host for blocked in BLOCKED_DOMAINS)


# Mirrors kosovo_pipeline.py's ALBANIAN_MARKERS / is_albanian_output pattern,
# scaled down for headline-length text (~5-15 words) instead of full
# articles — the original's word-count/ratio thresholds don't transfer to
# something this short; a single ë/ç or one function word is meaningful
# signal at this length.
ALBANIAN_MARKERS = {
    "dhe", "në", "ne", "për", "per", "që", "qe", "është", "eshte",
    "nga", "me", "një", "nje", "të", "te", "si", "por", "kjo", "ky",
    "kanë", "kane", "ishte", "janë", "jane", "do", "kur", "sipas",
    "mes", "pas", "para", "gjatë", "gjate", "kundër", "kunder",
}


def normalize_outlet(name: str, country: str) -> str | None:
    if not name:
        return None
    clean = re.sub(r"\s+", " ", name).strip()
    clean_lower = clean.lower()
    for known_name in KNOWN_OUTLETS.get(country, {}).values():
        if clean_lower == known_name.lower():
            return known_name
    return clean


def extract_outlet(url: str, country: str, source_name: str = "") -> str | None:
    outlet = normalize_outlet(source_name, country)
    if outlet:
        return outlet

    try:
        host = urlparse(url).netloc.lower().lstrip("www.")
        for domain, name in KNOWN_OUTLETS.get(country, {}).items():
            if domain in host:
                return name
    except Exception:
        pass
    return None


def normalize_title(title: str) -> str:
    """Collapse a headline to a dedupe key. Wire copy (AP/AFP/Reuters) gets
    reprinted near-verbatim by many outlets — including across countries'
    English-language editions (SHBA/Britani) — so this key is now also the
    cache key: one Groq call and one image fetch serve every country that
    happens to run the same wire story, instead of paying for it 2-5x."""
    stripped = re.sub(r"[^\w]+", " ", title.lower(), flags=re.UNICODE)
    return re.sub(r"\s+", " ", stripped).strip()[:80]


# There is deliberately no keyword fallback here any more.
#
# There used to be one: an English word list ("war", "crime", "protest" →
# negative) that fired on every malformed-JSON response. Three things were
# wrong with it. It ran on German, French and Italian headlines, where it can
# only ever return "neutral" or match by accident. It scored the *event*, so a
# neutral report of a bad thing came back negative — the exact confusion this
# rewrite exists to remove. And it failed silently, so a run where Groq was
# down looked identical to a run where it worked.
#
# An article we cannot classify is now "unknown" and is excluded from the
# index instead of being guessed at. See summarize_country().
UNKNOWN = "unknown"


def is_albanian_text(text: str | None) -> bool:
    if not text:
        return False
    words = re.findall(r"[a-zA-ZÀ-ÿ]+", text.lower())
    if len(words) < 2:
        return False
    if any(ch in text for ch in "ëçËÇ"):
        return True
    return any(w in ALBANIAN_MARKERS for w in words)


# ── Image resolution ─────────────────────────────────────────────────────
# Confirmed via live testing: Google News RSS provides zero per-article
# images (no media:thumbnail, no enclosure, no embedded <img>). Real images
# only exist by resolving the redirect to the real publisher and scraping
# its og:image — mirrors two precedents already live elsewhere in this repo
# rather than inventing a new approach.

def resolve_google_news_url(url: str) -> str:
    """Mirrors scripts/cloud_news_discovery.py:resolve_google_news_url —
    Google News RSS links require the gnewsdecoder batchexecute decode, not
    a plain HTTP redirect. A failed decode leaves the URL unchanged so the
    image step below fails gracefully instead of crashing."""
    if "news.google.com/" not in url:
        return url
    try:
        decoded = gnewsdecoder(url).get("decoded_url")
    except Exception as exc:
        print(f"  image warn: decode failed: {type(exc).__name__}", file=sys.stderr)
        return url
    if isinstance(decoded, str) and decoded.startswith(("https://", "http://")) and "news.google.com/" not in decoded:
        return decoded
    return url


def scrape_og_image(url: str) -> str | None:
    """Mirrors scripts/content_generator.py:scrape_image — og:image meta tag
    only. No AI-generated fallback: the user explicitly rejected a fake
    photo sitting next to a real foreign headline about Kosovo. An article
    with no scrapable image simply doesn't get shown in Bota Flet."""
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return og["content"]
        return None
    except Exception:
        return None


def resolve_article_media(google_news_url: str) -> tuple[str, str | None]:
    """One unit of thread-pool work: redirect-resolve, then scrape og:image
    off the real publisher page. Returns (resolved_url, image_url_or_none)."""
    real_url = resolve_google_news_url(google_news_url)
    image_url = scrape_og_image(real_url)
    return real_url, image_url


# ── Stance classification ───────────────────────────────────────────────
# Two rewrites happened here. The first asked "how does this portray Kosovo",
# which scored a neutral wire report of a hostile quote the same as an outlet's
# own hostility. The second bolted few-shot examples onto that, and did not
# hold: 9 of 258 articles translated successfully, meaning most batches failed
# to parse and fell through to an English keyword list.
#
# The real faults were structural, not wording:
#
#   * One call did classification AND translation, so a translation failure
#     silently destroyed a sentiment label. They are two calls now.
#   * The question conflated the news with the newsroom. "Kosovo finds a
#     wartime mass grave" is grim news reported flatly; it says nothing about
#     how the outlet regards Kosovo. It was scoring negative and dragging the
#     index down. The index is named for the media's tone toward Kosovo, so
#     that is the only thing this asks about now.
#   * Nothing forced the model to point at the words that decided it. It has
#     to produce an `evidence` span from the outlet's own prose now — which is
#     what actually separates "the outlet is hostile" from "the outlet quoted
#     someone hostile", far more reliably than an instruction not to confuse
#     them.
#
# Enum values stay English (positive/neutral/negative) because the whole
# downstream schema and UI already speak them; only the meaning changed.
STANCE_INSTRUCTIONS = (
    "You are a media analyst for a Kosovo newsroom. For each numbered "
    "foreign-press item (headline + snippet, about Kosovo), judge ONE thing: "
    "the stance of THE OUTLET ITSELF toward Kosovo.\n\n"
    "This is NOT about whether the news is good or bad. Terrible events "
    "reported plainly are NEUTRAL. War crimes, corruption trials, protests, "
    "mass graves, political chaos — all neutral when the outlet is simply "
    "reporting them. Bad news about Kosovo is not the same as an outlet being "
    "against Kosovo.\n\n"
    "Rules:\n"
    "- negative ONLY when the outlet's OWN words are hostile, contemptuous, "
    "belittling, or push a line against Kosovo. Loaded adjectives, sneering "
    "framing, or treating Kosovo's statehood as illegitimate in the outlet's "
    "own voice.\n"
    "- If the charged language sits inside quotation marks, or is attributed "
    "(\"says\", \"according to\", \"claims\", \"accuses\"), it belongs to the "
    "SPEAKER, not the outlet. Set is_quote=true and stance=neutral. Reporting "
    "a hostile statement is journalism, not hostility.\n"
    "- Quotation marks are not only the English ones. Treat all of these as "
    "quoting: \" \"  ' '  « »  » «  „ \"  ‚ '  ‹ ›  「 」. German, French and "
    "Italian headlines mostly use « » or „ \", and text inside them is ALWAYS "
    "the speaker's, never the outlet's.\n"
    "- positive ONLY when the outlet's own voice is warm, admiring or "
    "advocating for Kosovo. Not merely 'a good thing happened'.\n"
    "- Most real journalism is neutral. Expect most items to be neutral, and "
    "do not hunt for reasons to call something negative.\n"
    "- evidence MUST be words copied from the item itself, in its own "
    "language. For neutral, use \"\".\n"
    "- If you cannot tell from the text given, use \"unknown\". That is a "
    "valid, useful answer — never guess.\n\n"
    "EXAMPLES:\n\n"
    "1. \"Serbian president Vučić says 'Kosovo is not a country' in UN speech\"\n"
    "   -> {\"stance\":\"neutral\",\"is_quote\":true,\"speaker\":\"Vučić\","
    "\"evidence\":\"\",\"reason\":\"Raporton deklaratën e Vuçiqit, nuk e "
    "përvetëson\",\"confidence\":\"high\"}\n\n"
    "2. \"Kosovo's fragile ethnic peace shattered by police raid\"\n"
    "   -> {\"stance\":\"negative\",\"is_quote\":false,\"speaker\":\"\","
    "\"evidence\":\"fragile ethnic peace shattered\",\"reason\":\"Fjalët e vetë "
    "mediumit e kornizojnë Kosovën si të brishtë\",\"confidence\":\"high\"}\n\n"
    "3. \"Kosovo finds third wartime mass grave, forensic team says\"\n"
    "   -> {\"stance\":\"neutral\",\"is_quote\":false,\"speaker\":\"\","
    "\"evidence\":\"\",\"reason\":\"Lajm i rëndë, i raportuar në mënyrë "
    "faktike\",\"confidence\":\"high\"}\n\n"
    "4. \"Kosovo: Gesänge erzählen die Geschichte der Albaner — Die ganze Doku\"\n"
    "   -> {\"stance\":\"positive\",\"is_quote\":false,\"speaker\":\"\","
    "\"evidence\":\"Gesänge erzählen die Geschichte\",\"reason\":\"Dokumentar "
    "kulturor me ton respektues\",\"confidence\":\"medium\"}\n\n"
    "5. \"Albania says Kosovo independence irreversible after Zelenskyy remarks\"\n"
    "   -> {\"stance\":\"neutral\",\"is_quote\":true,\"speaker\":\"Albania\","
    "\"evidence\":\"\",\"reason\":\"Raporton qëndrimin e Shqipërisë\","
    "\"confidence\":\"high\"}\n\n"
    "6. \"Diaspora-Besuch im Kosovo: «Albaner lieben es, VIP zu sein»\"\n"
    "   -> {\"stance\":\"neutral\",\"is_quote\":true,\"speaker\":\"vizitor nga "
    "diaspora\",\"evidence\":\"\",\"reason\":\"Fjalia është citim brenda «», jo "
    "zëri i mediumit\",\"confidence\":\"high\"}\n\n"
    "7. \"Kosovo erhält Visafreiheit für den Schengen-Raum\"\n"
    "   -> {\"stance\":\"neutral\",\"is_quote\":false,\"speaker\":\"\","
    "\"evidence\":\"\",\"reason\":\"Lajm i mirë, i raportuar në mënyrë "
    "faktike\",\"confidence\":\"high\"}\n\n"
    "Write field values WITHOUT any double-quote characters inside them, so "
    "the JSON stays valid.\n\n"
)

VALID_STANCES = {"positive", "neutral", "negative"}


def _parse_stance_item(raw: object) -> dict:
    """One item of the model's array -> a normalised record. Anything we can't
    read becomes UNKNOWN rather than a guess."""
    if not isinstance(raw, dict):
        return {"stance": UNKNOWN, "isQuote": False, "speaker": "",
                "evidence": "", "reason": "", "confidence": "low"}
    stance = str(raw.get("stance", "")).strip().lower()
    confidence = str(raw.get("confidence", "")).strip().lower()
    if stance not in VALID_STANCES:
        stance = UNKNOWN
    # A non-neutral call with no evidence from the outlet's own prose is
    # exactly the failure mode this rewrite exists to stop, so it does not
    # get to stand: without a span to point at, it is neutral.
    evidence = str(raw.get("evidence", "") or "").strip()
    if stance in ("positive", "negative") and not evidence:
        stance = "neutral"
    if confidence == "low" and stance != "neutral":
        stance = UNKNOWN
    # The contract says evidence is the span that justifies a NON-neutral call,
    # and neutral takes "". Models do not always comply, and a neutral article
    # carrying a leftover span is data that contradicts its own label — the UI
    # would have to guard against it forever. Clear it at the boundary instead.
    if stance != "positive" and stance != "negative":
        evidence = ""
    return {
        "stance": stance,
        "isQuote": bool(raw.get("is_quote", False)),
        "speaker": str(raw.get("speaker", "") or "").strip()[:80],
        "evidence": evidence[:200],
        "reason": str(raw.get("reason", "") or "").strip()[:160],
        "confidence": confidence or "medium",
    }


def classify_stance_batch(client: "Groq | None", items: list[dict]) -> list[dict]:
    """items: [{'title':..., 'summary':...}, ...] -> one stance record each,
    in order. No API key, or an unparseable answer after one retry, yields
    UNKNOWN — which is excluded from the index rather than guessed at."""
    if not items:
        return []
    unknown = [_parse_stance_item(None) for _ in items]
    if client is None:
        return unknown

    texts = [f"{a['title']} — {a.get('summary', '')}".strip(" —") for a in items]
    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(texts))
    prompt = (
        STANCE_INSTRUCTIONS
        + f"Now judge these {len(texts)} items. Reply with ONLY a JSON array "
        "of exactly "
        + str(len(texts))
        + " objects, in the same order, no markdown and no commentary:\n"
        '[{"stance":"positive|neutral|negative|unknown","is_quote":bool,'
        '"speaker":"","evidence":"","reason":"","confidence":"high|medium|low"}]\n\n'
        + numbered
    )

    for attempt in (1, 2):
        try:
            resp = client.chat.completions.create(
                model=CLASSIFY_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1600,
                # Deterministic on purpose. At 0.3 the same egg-throwing story
                # came back positive at one outlet and negative at another on
                # the same day.
                temperature=0,
            )
            raw = resp.choices[0].message.content.strip()
            raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
            parsed = json.loads(raw)
            if not isinstance(parsed, list) or len(parsed) != len(texts):
                raise ValueError(f"expected {len(texts)} items, got {len(parsed) if isinstance(parsed, list) else parsed!r}")
            return [_parse_stance_item(p) for p in parsed]
        except Exception as e:
            print(f"  stance attempt {attempt}/2 failed: {e}", file=sys.stderr)

    print(f"  {len(texts)} articles left UNKNOWN (excluded from index)", file=sys.stderr)
    return unknown


def translate_batch(client: "Groq | None", items: list[dict]) -> list[str | None]:
    """Albanian headlines, entirely separate from stance. This failing now
    costs a translation and nothing else."""
    if not items:
        return []
    if client is None:
        return [None for _ in items]

    titles = [a["title"] for a in items]
    numbered = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(titles))
    prompt = (
        "Translate each numbered headline into natural Albanian (shqip), the "
        "way a Kosovo journalist would write it — translate the MEANING, not "
        "the word order. Concise, factual, no invented details. Reply with "
        "ONLY a JSON array of "
        + str(len(titles))
        + " strings, in order, no markdown.\n\n"
        + numbered
    )
    try:
        resp = client.chat.completions.create(
            model=TRANSLATE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1400,
            temperature=0.3,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
        parsed = json.loads(raw)
        if not isinstance(parsed, list) or len(parsed) != len(titles):
            raise ValueError(f"expected {len(titles)} strings")
        return [str(p).strip() or None for p in parsed]
    except Exception as e:
        print(f"  Groq translation error: {e}", file=sys.stderr)
        return [None for _ in titles]


def retry_translation(client: "Groq | None", title: str) -> str | None:
    """One individual escalated retry for a headline whose first-pass
    translation didn't look Albanian (rare, but small models slip back into
    the source language sometimes)."""
    if client is None:
        return None
    prompt = (
        "Your previous translation was not natural Albanian. Rewrite ONLY "
        "in Albanian (Shqip), using authentic Kosovo Albanian journalistic "
        "phrasing. Reply with ONLY the translated headline, nothing else.\n\n"
        f"Headline: {title}"
    )
    try:
        resp = client.chat.completions.create(
            model=TRANSLATE_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.3,
        )
        text = resp.choices[0].message.content.strip().strip('"')
        return text or None
    except Exception as e:
        print(f"  Groq translation retry error: {e}", file=sys.stderr)
        return None


def country_index(positive: int, neutral: int, negative: int) -> int | None:
    """0–100 scale: 100 = all positive, 0 = all negative, 50 = split evenly
    between positive/negative (neutral doesn't pull the needle either way)."""
    total = positive + neutral + negative
    if total == 0:
        return None
    return round(50 + 50 * (positive - negative) / total)


# ── Cache ──────────────────────────────────────────────────────────────

def load_cache() -> dict:
    if CACHE_PATH.exists():
        try:
            data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("articles"), dict):
                return data
        except Exception:
            pass
    return {"version": 1, "articles": {}}


def fetch_candidates() -> dict[str, list[dict]]:
    """Fetch + within-country dedupe only, no classification yet. Returns
    {country: [{title, summary, url, date, outlet}, ...]}."""
    by_country: dict[str, list[dict]] = {}
    for country, feed_url in FEEDS.items():
        print(f"  Fetching {country}...")
        try:
            feed = feedparser.parse(feed_url)
        except Exception as e:
            print(f"  {country} feed fetch failed: {e}", file=sys.stderr)
            by_country[country] = []
            continue

        seen_titles: set[str] = set()
        items: list[dict] = []
        dropped: list[str] = []
        for entry in feed.entries[:60]:
            url = entry.get("link", "")
            title = entry.get("title", "").strip()
            summary = re.sub(r"<[^>]+>", "", entry.get("summary", "") or "").strip()
            # published_parsed is feedparser's already-parsed struct_time —
            # a clean ISO date from this, not a [:10] slice of the raw RFC822
            # string (which used to truncate mid-word, e.g. "Sun, 09 Au" —
            # both an unparseable value downstream and a broken-looking date
            # shown directly on every Bota Flet card).
            published_struct = entry.get("published_parsed")
            published = datetime(*published_struct[:6]).strftime("%Y-%m-%d") if published_struct else ""
            source = entry.get("source") or {}
            outlet = extract_outlet(url, country, source.get("title", ""))
            if not outlet or not title:
                continue
            # Google serves Kosovar outlets into the German and US feeds. Their
            # coverage is Kosovo talking about itself, which is not what an
            # index of foreign press means.
            if not is_foreign_press(outlet, url):
                dropped.append(outlet)
                continue

            key = normalize_title(title)
            if key in seen_titles:
                continue
            seen_titles.add(key)
            items.append({
                "title": title, "summary": summary, "url": url,
                "date": published, "outlet": outlet,
            })
        by_country[country] = items
        if dropped:
            # Logged, not silent — the blocklist is a judgement call and this
            # is how it gets tuned.
            names = ", ".join(sorted(set(dropped))[:6])
            print(f"  {country}: dropped {len(dropped)} non-foreign-press ({names})")
    return by_country


def main():
    api_key = os.environ.get("GROQ_API_KEY")
    client = Groq(api_key=api_key) if api_key else None
    if client is None:
        print(
            "GROQ_API_KEY not set; every new article will be UNKNOWN and "
            "excluded from the index (no guessing, no translation)",
            file=sys.stderr,
        )

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cache = load_cache()
    articles_cache: dict[str, dict] = cache["articles"]

    by_country = fetch_candidates()

    # country_occurrences[country] keeps the per-country (key, candidate)
    # pairs — candidate["outlet"] is this country's own outlet attribution
    # for the story, kept separate from the cache entry's (possibly
    # first-seen-in-a-different-country) outlet name.
    country_occurrences: dict[str, list[tuple[str, dict]]] = {c: [] for c in FEEDS}
    new_items: list[tuple[str, dict]] = []
    retry_items: list[tuple[str, dict]] = []
    image_retry_keys: list[str] = []
    seen_new_keys: set[str] = set()

    for country, items in by_country.items():
        for item in items:
            key = normalize_title(item["title"])
            country_occurrences[country].append((key, item))
            if key in articles_cache:
                entry = articles_cache[key]
                entry["lastSeen"] = today
                if not entry.get("imageUrl") and entry.get("imageAttempts", 0) < MAX_IMAGE_ATTEMPTS:
                    if key not in image_retry_keys:
                        image_retry_keys.append(key)
                # An article that failed classification used to be dead for
                # good: only cache *misses* were ever sent to the model, so a
                # batch lost to a rate limit stayed UNKNOWN forever. It had
                # still cost a fetch, a translation and an image scrape, and
                # UNKNOWN is excluded from the index and from Bota Flet — so
                # the failure quietly threw all of that away. 39% of the cache
                # was sitting in that state. They get another try each run.
                elif entry.get("stance", entry.get("sentiment")) == UNKNOWN:
                    if entry.get("stanceAttempts", 0) < MAX_STANCE_ATTEMPTS and key not in seen_new_keys:
                        seen_new_keys.add(key)
                        retry_items.append((key, {**item, "country": country}))
            elif key not in seen_new_keys:
                seen_new_keys.add(key)
                new_items.append((key, {**item, "country": country}))

    print(f"  {len(new_items)} new, {len(retry_items)} unresolved retries, "
          f"{len(image_retry_keys)} pending image retries")

    # New articles first — they are today's news — then as much of the
    # unresolved backlog as the per-run budget still allows.
    if len(new_items) > MAX_NEW_PER_RUN:
        print(f"  capping at {MAX_NEW_PER_RUN} this run; {len(new_items) - MAX_NEW_PER_RUN} deferred")
        new_items = new_items[:MAX_NEW_PER_RUN]
    budget = MAX_NEW_PER_RUN - len(new_items)
    if budget > 0 and retry_items:
        taken = retry_items[:budget]
        print(f"  retrying {len(taken)} of {len(retry_items)} unresolved")
        new_items = new_items + taken

    # ── Stance, then translation. Two passes, two models, two failure
    # domains: a translation that fails no longer takes a stance label with it.
    stances: dict[str, dict] = {}
    for i in range(0, len(new_items), CLASSIFY_BATCH_SIZE):
        chunk = new_items[i:i + CLASSIFY_BATCH_SIZE]
        for (key, _), stance in zip(chunk, classify_stance_batch(client, [c for _, c in chunk])):
            stances[key] = stance

    translations: dict[str, str | None] = {}
    for i in range(0, len(new_items), TRANSLATE_BATCH_SIZE):
        chunk = new_items[i:i + TRANSLATE_BATCH_SIZE]
        for (key, item), title in zip(chunk, translate_batch(client, [c for _, c in chunk])):
            if title and not is_albanian_text(title):
                retried = retry_translation(client, item["title"])
                title = retried if retried and is_albanian_text(retried) else None
            translations[key] = title if is_albanian_text(title) else None

    unknown_count = sum(1 for s in stances.values() if s["stance"] == UNKNOWN)
    if unknown_count:
        print(f"  {unknown_count}/{len(new_items)} new articles unresolved (excluded from index)")

    # ── Second translation pass: the articles that actually matter ──
    #
    # Translation ran once per article and, if it failed, never ran again. That
    # is worst exactly where it hurts most: of eight critical articles, six had
    # the deciding span identified and no Albanian headline, so the homepage
    # was left leading with German. Under the stance definition roughly one
    # article in twenty is non-neutral, so this is a handful of extra strings
    # a run, on the model with the larger daily budget.
    pending_translation = [
        (k, e) for k, e in articles_cache.items()
        if e.get("stance") in ("positive", "negative")
        and not e.get("translated")
        and e.get("translateAttempts", 0) < MAX_TRANSLATE_ATTEMPTS
    ][:TRANSLATE_RETRY_PER_RUN]

    if pending_translation:
        print(f"  translating {len(pending_translation)} untranslated non-neutral articles")
        for i in range(0, len(pending_translation), TRANSLATE_BATCH_SIZE):
            chunk = pending_translation[i:i + TRANSLATE_BATCH_SIZE]
            titles = translate_batch(client, [{"title": e["title"]} for _, e in chunk])
            for (key, entry), title in zip(chunk, titles):
                entry["translateAttempts"] = entry.get("translateAttempts", 0) + 1
                # Retry when the batch gave us nothing at all, not only when it
                # gave us something that wasn't Albanian. A whole batch failing
                # to parse returns None for every item, and guarding on `title`
                # meant precisely those articles never got the single-item
                # escalation — which is why the two most-cited critical outlets
                # stayed untranslated through two passes.
                if not title or not is_albanian_text(title):
                    title = retry_translation(client, entry["title"])
                if title and is_albanian_text(title):
                    entry["albanianTitle"] = title
                    entry["translated"] = True

    for key, item in new_items:
        stance = stances.get(key) or _parse_stance_item(None)
        albanian_title = translations.get(key)
        # A retry already has an entry, with an image that cost a page fetch
        # and a firstSeen that the 72h display window is measured from. This
        # write is a full replacement, so those have to be carried over or a
        # retry would silently undo the work that made the article usable.
        prior = articles_cache.get(key) or {}
        articles_cache[key] = {
            "key": key,
            "title": item["title"],
            # Persisted now. It is fed to the classifier and used to be thrown
            # away here, which meant the cache could never be re-classified at
            # the same signal the live run had.
            "summary": (item.get("summary") or "")[:400],
            "albanianTitle": albanian_title or prior.get("albanianTitle"),
            "translated": bool(albanian_title or prior.get("albanianTitle")),
            "url": item["url"],
            "googleNewsUrl": item["url"],
            "imageUrl": prior.get("imageUrl"),
            "imageAttempts": prior.get("imageAttempts", 0),
            "outlet": item["outlet"],
            "country": item["country"],
            # Bounded, so an article the model genuinely cannot read stops
            # costing a slot on every run forever.
            "stanceAttempts": prior.get("stanceAttempts", 0) + 1,
            # `sentiment` stays as the name the frontend still reads; `stance`
            # is the same value under the name that says what it means. Drop
            # the alias once lib/tone-data.ts has migrated.
            "sentiment": stance["stance"],
            "stance": stance["stance"],
            "stanceReason": stance["reason"],
            "isQuote": stance["isQuote"],
            "speaker": stance["speaker"],
            "evidence": stance["evidence"],
            "confidence": stance["confidence"],
            "model": CLASSIFY_MODEL if client else "",
            "stanceVersion": STANCE_SCHEMA_VERSION,
            "date": item["date"] or today,
            "firstSeen": prior.get("firstSeen") or today,
            "lastSeen": today,
        }

    # ── Image resolution: new items + retry-eligible cached items, one flat
    # batch across all countries so the worker pool stays fully utilized.
    #
    # This does NOT use as_completed() without a bound — as_completed()
    # blocks until every submitted future is done, and the socket-level
    # timeout above is a backstop, not a guarantee (e.g. a connection that's
    # accepted but drip-feeds one byte just under the timeout indefinitely).
    # wait(..., timeout=) instead returns after at most IMAGE_BATCH_TIMEOUT
    # regardless of stragglers, so one bad server degrades this run's image
    # count instead of hanging the whole script (and the GitHub Action) —
    # anything left in `not_done` just retries on the next scheduled run. ──
    image_targets = list(dict.fromkeys([key for key, _ in new_items] + image_retry_keys))
    if image_targets:
        print(f"  Resolving images for {len(image_targets)} articles...")
        pool = ThreadPoolExecutor(max_workers=IMAGE_WORKERS)
        futures = {
            pool.submit(resolve_article_media, articles_cache[key]["googleNewsUrl"]): key
            for key in image_targets
            if key in articles_cache
        }
        done, not_done = wait(futures, timeout=IMAGE_BATCH_TIMEOUT)
        resolved = 0
        for future in done:
            key = futures[future]
            entry = articles_cache[key]
            entry["imageAttempts"] = entry.get("imageAttempts", 0) + 1
            try:
                real_url, image_url = future.result()
                entry["url"] = real_url
                if image_url:
                    entry["imageUrl"] = image_url
                    resolved += 1
            except Exception as e:
                print(f"  image resolve failed for {key[:40]}: {type(e).__name__}", file=sys.stderr)
        for future in not_done:
            key = futures[future]
            articles_cache[key]["imageAttempts"] = articles_cache[key].get("imageAttempts", 0) + 1
        if not_done:
            print(f"  {len(not_done)} image lookups still running past the {IMAGE_BATCH_TIMEOUT}s batch "
                  "budget — left for a later run's retry", file=sys.stderr)
        # wait=False: don't block process exit on stragglers still running
        # past the batch budget — they're bounded by socket.setdefaulttimeout
        # and will die on their own; no result of theirs is used either way.
        pool.shutdown(wait=False, cancel_futures=True)
        print(f"  {resolved}/{len(image_targets)} images resolved")

    # ── Prune stale entries ──
    cutoff = (datetime.now(timezone.utc) - timedelta(days=CACHE_RETENTION_DAYS)).strftime("%Y-%m-%d")
    for key in list(articles_cache.keys()):
        if articles_cache[key].get("lastSeen", "") < cutoff:
            del articles_cache[key]

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(
        json.dumps({"version": 1, "articles": articles_cache}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {CACHE_PATH} ({len(articles_cache)} cached articles)")

    # ── Build today's tone-outlets.json + tone-history.json from the cache.
    # Outlet attribution uses each country's OWN occurrence of the story
    # (candidate["outlet"]), not the cache entry's outlet — a wire story
    # cached from Gjermani's feed can still legitimately show as "AP" under
    # SHBA and "Reuters" under Britani; only the expensive shared fields
    # (sentiment, translation, image) are reused from the cache. ──
    countries_data: dict[str, dict] = {}
    country_summaries: dict[str, dict] = {}
    all_articles_by_country: dict[str, list[dict]] = {}

    for country in FEEDS:
        by_outlet: dict[str, list[dict]] = {}
        flat: list[dict] = []
        for key, candidate in country_occurrences[country]:
            entry = articles_cache.get(key)
            if not entry:
                continue
            article_out = {
                "title": entry["title"],
                # The Albanian rendering is the point of the drill-down for a
                # Kosovo reader: the original headline is in German or Turkish.
                "albanianTitle": entry.get("albanianTitle"),
                "url": entry["url"],
                "date": entry["date"],
                "sentiment": entry["sentiment"],
                # Why it was labelled that way, carried through so the UI can
                # answer "why is Britani 33?" with the outlet's own words
                # instead of asking to be believed.
                "reason": entry.get("stanceReason", ""),
                "isQuote": bool(entry.get("isQuote", False)),
                # The outlet's own words that decided a non-neutral call. The
                # single most persuasive thing we hold: it turns the label
                # from an assertion into something the reader can check.
                "evidence": entry.get("evidence", ""),
                "speaker": entry.get("speaker", ""),
            }
            by_outlet.setdefault(candidate["outlet"], []).append(article_out)
            flat.append({**article_out, "outlet": candidate["outlet"]})

        outlets_list = []
        for outlet_name, arts in by_outlet.items():
            arts = arts[:6]
            # An outlet whose articles we could not read has no label. Voting
            # over UNKNOWNs would manufacture one.
            scored = [a for a in arts if a["sentiment"] in VALID_STANCES]
            vote = Counter(a["sentiment"] for a in scored).most_common(1)[0][0] if scored else UNKNOWN
            outlets_list.append({
                "name": outlet_name, "sentiment": vote,
                "articleCount": len(arts), "articles": arts,
            })
        outlets_list.sort(key=lambda o: o["name"])

        counts = Counter(a["sentiment"] for a in flat)
        positive, neutral, negative = counts.get("positive", 0), counts.get("neutral", 0), counts.get("negative", 0)
        # Unresolved articles are counted and reported, never folded into
        # neutral. Burying them in neutral would move the index and hide the
        # fact that the classifier was down.
        excluded = counts.get(UNKNOWN, 0)
        n = positive + neutral + negative
        idx = country_index(positive, neutral, negative)
        summary = {
            "index": idx,
            "positive": round(100 * positive / n) if n else 0,
            "neutral": round(100 * neutral / n) if n else 0,
            "negative": round(100 * negative / n) if n else 0,
            "n": n,
            "excluded": excluded,
            "confident": n >= MIN_CONFIDENT_N,
            "stanceVersion": STANCE_SCHEMA_VERSION,
        }
        countries_data[country] = {"outlets": outlets_list, "summary": summary}
        country_summaries[country] = summary
        all_articles_by_country[country] = flat
        print(f"  {country}: {len(outlets_list)} outlets, {n} articles today")

    total_articles = sum(s["n"] for s in country_summaries.values())
    weighted_sum = sum(
        s["index"] * s["n"] for s in country_summaries.values() if s["index"] is not None
    )
    overall_index = round(weighted_sum / total_articles) if total_articles else None
    source_count = sum(len(c["outlets"]) for c in countries_data.values())

    outlets_output = {
        "lastUpdated": today,
        "overallIndex": overall_index,
        "totalArticles": total_articles,
        "sourceCount": source_count,
        "countries": countries_data,
    }
    OUTLETS_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTLETS_PATH.write_text(json.dumps(outlets_output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTLETS_PATH}")

    # ── History row: 3 most positive + 3 most negative headlines of the
    # day, round-robin picked across countries (a flat slice would silently
    # pick all 3 from whichever country iterates first) and deduped by
    # normalized title (the SAME cache key can legitimately appear under
    # multiple countries' flat lists — this avoids picking the same story
    # twice in the top-6). ──
    def pick_diverse(sentiment: str, limit: int) -> list[dict]:
        seen_titles: set[str] = set()
        buckets = {
            country: [a for a in arts if a["sentiment"] == sentiment]
            for country, arts in all_articles_by_country.items()
        }
        picked: list[dict] = []
        cursors = {country: 0 for country in buckets}
        progressed = True
        while len(picked) < limit and progressed:
            progressed = False
            for country, arts in buckets.items():
                if len(picked) >= limit:
                    break
                while cursors[country] < len(arts):
                    article = arts[cursors[country]]
                    cursors[country] += 1
                    key = normalize_title(article["title"])
                    if key in seen_titles:
                        continue
                    seen_titles.add(key)
                    picked.append({**article, "country": country, "flag": FLAGS.get(country, "")})
                    progressed = True
                    break
        return picked

    positives = pick_diverse("positive", 3)
    negatives = pick_diverse("negative", 3)
    headlines = [
        {
            "title": a["title"],
            "source": a["outlet"],
            "country": a["country"],
            "flag": a["flag"],
            "url": a["url"],
            "sentiment": a["sentiment"],
        }
        for a in positives + negatives
    ]

    history: list[dict] = []
    if HISTORY_PATH.exists():
        try:
            history = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
            if not isinstance(history, list):
                history = []
        except Exception:
            history = []

    # Re-running the same day (multiple scheduled runs, manual test, workflow
    # retry) replaces today's row instead of appending a duplicate.
    history = [row for row in history if row.get("date") != today]
    history.append(
        {
            "date": today,
            "overallIndex": overall_index,
            "totalArticles": total_articles,
            "sourceCount": source_count,
            "countries": country_summaries,
            "headlines": headlines,
        }
    )
    history.sort(key=lambda row: row["date"])
    history = history[-HISTORY_DAYS:]

    HISTORY_PATH.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {HISTORY_PATH} ({len(history)} days of history)")


if __name__ == "__main__":
    main()
