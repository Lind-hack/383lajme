"""
Scrapes Kosovo-related news from Google News RSS per country, classifies each
article's STANCE toward Kosovo and translates its headline to Albanian via
Groq, resolves a real image per article, and writes three files.

Note on "stance": this measures whether the OUTLET's own voice is hostile to
Kosovo, not whether the news is good or bad. A grim event reported flatly is
neutral, and a hostile quote belongs to whoever said it. Both calls run on
llama-3.3-70b; without an API key nothing is guessed, articles are marked
UNKNOWN and excluded from the index.

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
import time
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
TOPICS_PATH = ROOT / "public" / "tone-topics.json"
# Two jobs, two models, two budgets. Stance is the hard call — an 8B model gave
# the same story opposite labels at two outlets on the same day — so it runs on
# the strongest production model Groq offers. Translation is the easy job and
# runs on the model with 5x the daily token allowance. Classification only ever
# touches cache misses (see main()), which is dozens of articles a day, not the
# ~300 fetched — single-digit calls, well inside llama-3.3-70b's free-tier
# ceiling of 1K requests / 100K tokens per day.
CLASSIFY_MODEL = os.environ.get("GROQ_CLASSIFY_MODEL", "llama-3.3-70b-versatile")

# Translation moved to the 70B as well: the 8B was producing headlines that
# were not quite Albanian ("duhet të condamonte"), and these are read by
# people, on the homepage, as the lead.
#
# It fits, but not comfortably. Measured from the API's own usage counters:
# 254 tokens per classified article, 67 per translated one. At the current
# ~276 articles a day that is 70K + 19K = 89K against a 100K daily ceiling —
# eleven percent of headroom, which a busy news day or the retry passes can
# eat. So the 8B stays as a fallback rather than being removed: if the 70B
# refuses, a slightly clumsy Albanian headline is a far better outcome than
# no headline, which is what "translation failed" actually costs us.
#
# Classification runs first, so when the budget does run out it is the
# translation that degrades, not the index.
# Separate daily token bucket from llama-3.3-70b on Groq's free tier, which is
# the entire point: it is what the classifier falls back to when the primary's
# bucket is spent, rather than losing the run.
CLASSIFY_FALLBACK_MODEL = os.environ.get("GROQ_CLASSIFY_FALLBACK", "openai/gpt-oss-120b")
TRANSLATE_MODEL = os.environ.get("GROQ_TRANSLATE_MODEL", "llama-3.3-70b-versatile")
TRANSLATE_FALLBACK_MODEL = os.environ.get("GROQ_TRANSLATE_FALLBACK", "llama-3.1-8b-instant")

# What the label means, not what the code version is. v1 read "is this good or
# bad news about Kosovo"; v2 reads "is this outlet's own voice hostile toward
# Kosovo". A row carries the version that produced it so the trend chart can
# mark where the definition changed instead of splicing two of them together.
# 3: attribution moved from the Google News feed that found an article to the
# outlet that published it, and non-editorial sources (score tables, fixture
# calendars, federations) stopped counting. Numbers before and after are not
# comparable, and summarizeToneHistory() will not subtract across the boundary.
STANCE_SCHEMA_VERSION = 3

# Cap so tone-history.json stays a small, fast-to-fetch file (~4 months of
# daily rows) instead of growing forever.
HISTORY_DAYS = 120

# Below this many deduped articles, a country's index is noisy enough that
# the UI should show it as low-confidence rather than a bare percentage.
#
# Recalibrated from 8 to 5 when MAX_ARTICLE_AGE_DAYS arrived. Eight was tuned
# against a pool of hundreds spanning months; measured against a two-day
# window it would have marked all but three of fifteen countries as
# low-confidence — a threshold describing its own miscalibration rather than
# the data.
#
# It is not removed, and should not be. At n=5 a single critical article
# already swings a country ten points; below that the number is an accident of
# which stories a feed happened to carry. Painting that as a confident colour
# would make thin data *look* authoritative, which is worse than showing it as
# thin — the hatching and the "N nga M artikuj" line exist to say so honestly.
MIN_CONFIDENT_N = 5

# ...but a count alone was not enough. Greece's index of 50 rested on 5 of its
# 79 articles and Sweden's on 9 of 120, because the rest failed classification
# and were excluded — and a bare `n >= 8` passed Sweden while ignoring the 111
# it threw away. A country whose index rests on a tenth of its own coverage is
# not a reading, it is a rounding artifact, and the UI has to be able to say so.
MIN_CONFIDENT_COVERAGE = 0.4


def is_confident(scored: int, excluded: int) -> bool:
    """Enough articles, AND enough of the ones we actually saw."""
    total = scored + excluded
    if scored < MIN_CONFIDENT_N:
        return False
    return total == 0 or (scored / total) >= MIN_CONFIDENT_COVERAGE

# Cache retention deliberately wider than Bota Flet's 72h display window
# (lib/tone-data.ts) — survives a workflow outage over a weekend without
# losing data, and keeps this file small (low hundreds of live entries at
# any time, not tens of thousands).
CACHE_RETENTION_DAYS = 7

# How old an article may be, in days, and still count. 0 = today only,
# 3 = today plus the previous three days, a four-day window.
#
# Widened from 1 after measuring what a two-day window actually yields: seven
# of thirteen countries fell under the confidence threshold on one to four
# articles, and the index had nothing to read. Four days is still recent
# enough that "sot" is defensible — the alternative was a map built on
# single-article countries.
#
# This is the rule that makes "Toni i Mediave sot" mean today. Without it the
# index was built on whatever Google News felt like resurfacing: the cache had
# grown to 1066 articles reaching back to 2025-09-08, and only 263 of the 657
# that fed the index were from the last two days. Sixty percent of "today's"
# reading was up to a year old.
#
# CACHE_RETENTION_DAYS could never catch this because it prunes on lastSeen —
# when the scraper last saw an article in a feed — and Google keeps re-serving
# old stories, refreshing lastSeen forever. Age has to be measured from the
# publication date, which is what this does.
MAX_ARTICLE_AGE_DAYS = 3


def is_fresh(published: str, today: str | None = None) -> bool:
    """True when `published` (YYYY-MM-DD) is within the freshness window.

    An empty or unparseable date fails closed. Roughly 200 cached entries
    carry a truncated RFC-822 fragment from before the date fix, and letting
    those through unchecked is how an article from March keeps being counted
    as today's news.
    """
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", published or ""):
        return False
    ref = today or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cutoff = (
        datetime.strptime(ref, "%Y-%m-%d") - timedelta(days=MAX_ARTICLE_AGE_DAYS)
    ).strftime("%Y-%m-%d")
    # Upper bound too: a feed occasionally carries a future-dated item, and
    # tomorrow's news is not today's either.
    return cutoff <= published <= ref

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
# Google News locale per tracked country: (hl, gl). ceid is derived.
FEED_LOCALES = {
    "Gjermani": ("de", "DE"),
    "SHBA":     ("en-US", "US"),
    "Britani":  ("en-GB", "GB"),
    "Francë":   ("fr", "FR"),
    "Itali":    ("it", "IT"),
    "Austri":   ("de", "AT"),
    "Zvicër":   ("de", "CH"),
    "Holandë":  ("nl", "NL"),
    "Belgjikë": ("fr", "BE"),
    "Spanjë":   ("es", "ES"),
    "Greqi":    ("el", "GR"),
    "Suedi":    ("sv", "SE"),
    "Poloni":   ("pl", "PL"),
    "Turqi":    ("tr", "TR"),
    "Kroaci":   ("hr", "HR"),
}

# Several queries per country, not one.
#
# A single "Kosovo" query returns the day's wire copy, and wire copy is almost
# entirely neutral by construction — which is why every country's index sat on
# exactly 50 and the map read as dead. The extra queries reach the coverage
# that actually carries a stance: the Serbia relationship, the government, EU
# and NATO accession, and the diaspora. They also simply return more articles,
# and a country resting on two of them cannot say anything.
#
# The opinion-shaped queries — commentary, analysis, editorial, column — are
# the ones that can actually move the index. Measured on the news queries
# alone, 2 of 92 articles carried any stance: wire copy reports, it does not
# take a side. Op-eds take a side by definition, so this is where a non-neutral
# reading comes from if one exists.
#
# Keyed by language, not country, so Austria and Switzerland reuse Germany's
# set. Overlap between queries is expected and handled: candidates are deduped
# by normalised title within each country before anything is classified.
FEED_QUERIES = {
    "de": ["Kosovo", "Kosovo Serbien", "Kosovo Regierung", "Kosovo EU",
           "Kosovo Kommentar", "Kosovo Analyse", "Kosovo Meinung"],
    "en-US": ["Kosovo", "Kosovo Serbia", "Kosovo government", "Kosovo NATO",
              "Kosovo opinion", "Kosovo analysis", "Kosovo editorial"],
    "en-GB": ["Kosovo", "Kosovo Serbia", "Kosovo government", "Kosovo NATO",
              "Kosovo opinion", "Kosovo analysis", "Kosovo editorial"],
    "fr": ["Kosovo", "Kosovo Serbie", "Kosovo gouvernement", "Kosovo UE",
           "Kosovo analyse", "Kosovo opinion", "Kosovo éditorial"],
    "it": ["Kosovo", "Kosovo Serbia", "Kosovo governo", "Kosovo UE",
           "Kosovo analisi", "Kosovo opinione", "Kosovo editoriale"],
    "nl": ["Kosovo", "Kosovo Servië", "Kosovo regering",
           "Kosovo analyse", "Kosovo opinie", "Kosovo commentaar"],
    "es": ["Kosovo", "Kosovo Serbia", "Kosovo gobierno",
           "Kosovo análisis", "Kosovo opinión", "Kosovo editorial"],
    "el": ["Κόσοβο", "Κόσοβο Σερβία", "Kosovo",
           "Κόσοβο ανάλυση", "Κόσοβο άποψη"],
    "sv": ["Kosovo", "Kosovo Serbien", "Kosovo regering",
           "Kosovo analys", "Kosovo debatt", "Kosovo ledare"],
    "pl": ["Kosowo", "Kosowo Serbia", "Kosovo",
           "Kosowo analiza", "Kosowo opinia", "Kosowo komentarz"],
    "tr": ["Kosova", "Kosova Sırbistan", "Kosova hükümeti",
           "Kosova analiz", "Kosova yorum", "Kosova köşe yazısı"],
    "hr": ["Kosovo", "Kosovo Srbija", "Kosovo vlada",
           "Kosovo analiza", "Kosovo komentar"],
}


def _feed_url(query: str, hl: str, gl: str) -> str:
    from urllib.parse import quote
    return (
        f"https://news.google.com/rss/search?q={quote(query)}"
        f"&hl={hl}&gl={gl}&ceid={gl}:{hl.split('-')[0]}"
    )


# country -> [feed url, ...]. Built once at import.
FEEDS = {
    country: [_feed_url(q, hl, gl) for q in FEED_QUERIES.get(hl, ["Kosovo"])]
    for country, (hl, gl) in FEED_LOCALES.items()
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
# Raised from 48 with the multi-query feeds, which surface far more
# candidates per run. Groq now carries classification alone — translation and
# blurbs moved to Gemini — so the budget is llama-3.3-70b's 100K/day plus
# gpt-oss-120b's separate 200K. At roughly 480 tokens per article and nine
# runs a day, 300K/9 leaves room for about 69; 64 keeps a margin.
MAX_NEW_PER_RUN = 64

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
# The three rules that decide whether an article counts, and for whom. Kept in
# their own module so the rebuild (tools/tone_rebuild.py) and the tests
# (tools/test_tone_sources.py) apply exactly the same definitions this does —
# a second copy of "is this journalism" would drift within a month.
from tone_sources import (  # noqa: E402
    country_for as source_country_for,
    is_editorial as source_is_editorial,
    is_local_placename as source_is_local_placename,
)

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
    # Kosovo-based, Serbian-language. Same class as the Kosovar outlets above
    # and the Belgrade ones: reporting from inside the subject, not about it.
    # These two were the single largest sources in the cache by volume.
    "kossev.info", "kosovo-online.com", "kosovoonline.com",
    # English-language but Pristina-based, so still the subject reporting on
    # itself. Both surfaced in the topic panels reading as foreign coverage.
    "prishtinainsight.com", "kosovotwopointzero.com", "kosovo-2-0.com",
    # Not press.
    "dvidshub.net", "bundeswehr.de", "nato.int", "kfor.nato.int",
    "dazn.com", "anwalt.de", "audimax.de",
    "uefa.com", "fifa.com", "iqair.com", "archdaily.com", "worldbank.org",
}
BLOCKED_NAMES = {
    "koha.net", "koha ditore", "telegrafi", "kallxo", "gazeta express",
    "klan kosova", "rtk", "indeksonline", "bota sot", "zëri", "zeri",
    "insajderi", "kosova sot", "top channel", "panorama", "shqiptarja",
    "balkanweb", "syri", "albanian daily news", "tirana times",
    "b92", "blic", "kurir", "informer", "politika", "danas", "telegraf",
    "novosti", "rts", "tanjug", "espreso", "srbija danas", "sputnik",
    "kossev", "kosovo online", "prishtina insight", "kosovo 2.0",
    "uefa", "fifa", "iqair", "archdaily",
    "world bank group", "world bank",
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


def outlet_identity(name: str) -> str:
    """Collapse a masthead to a comparison key.

    Google gives the same publisher two identities depending on the feed —
    "ANSA" and "ansa.it", "Aftonbladet" and "aftonbladet.se" — which made one
    outlet look like two in every count, and split its article history in half.
    """
    key = (name or "").strip().lower()
    key = re.sub(r"\.(com|net|org|it|de|fr|es|se|nl|be|at|ch|pl|gr|tr|hr|co\.uk|uk)$", "", key)
    return re.sub(r"[^a-z0-9]+", "", key)


def outlet_identities(name: str) -> set[str]:
    """Every key a masthead could reasonably hash to.

    Domains disagree with mastheads about the leading article, and they
    disagree in both directions: churchtimes.co.uk drops the "The" that "The
    Church Times" carries, while lemonde.fr keeps the "Le" — so stripping
    articles unconditionally fixes the first pair and breaks the second.
    Emitting both forms and matching on any overlap handles both.
    """
    base = outlet_identity(name)
    stripped = outlet_identity(re.sub(r"^\s*(the|la|le|il|el|de|het)\s+", "", (name or "").strip(), flags=re.I))
    return {k for k in (base, stripped) if k}


def normalize_outlet(name: str, country: str) -> str | None:
    if not name:
        return None
    clean = re.sub(r"\s+", " ", name).strip()
    clean_lower = clean.lower()
    for known_name in KNOWN_OUTLETS.get(country, {}).values():
        if clean_lower == known_name.lower():
            return known_name
    # Prefer the prettier of the two identities: "ANSA" over "ansa.it". A name
    # carrying a TLD is the machine form, so if we have seen the human one it
    # wins — this keeps the display name stable across feeds.
    ident = outlet_identity(clean)
    for known_name in KNOWN_OUTLETS.get(country, {}).values():
        if outlet_identity(known_name) == ident:
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


# ── Gemini: the "what is this about" layer ──────────────────────────────
#
# Deliberately a different provider from the classifier. Groq's llama-3.3-70b
# carries stance AND translation against a 100K-token daily budget; blurbs for
# every article plus a labelling pass would not fit beside them. Gemini's free
# tier is barely touched by this repo, so the work lands where there is room.
#
# Thinking is switched off explicitly. gemini-2.5-flash reasons by default and
# spent 899 thinking tokens against 254 of output on the first six-article
# batch — four times the cost for a task that is a one-line paraphrase.
# flash-lite, not flash: this workload is short Albanian paraphrase, headline
# translation and topic naming — none of it needs the larger model, and side
# by side the lite one wrote better topic labels. It also carries its own
# quota, so it is not competing with anything else using flash.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
BLURB_BATCH_SIZE = 10
# Blurbs are written for newly-classified articles, so every entry cached
# before the feature existed would have stayed blank until it aged out. This
# many get backfilled per run, which heals the pool within a few runs without
# turning one run into a bulk job.
BLURB_BACKFILL_PER_RUN = 30
BLURB_MAX_CHARS = 190

# The model reaches for these openers even when told not to; they burn a fifth
# of the word budget saying "this is an article" to someone already reading a
# list of articles.
# Only strips when the opening is genuinely meta — a noun for "the article"
# followed by a reporting verb and/or a connector. The verb-and-connector part
# is required, not optional: without it this ate the subject of legitimate
# blurbs like "Raporti i Komisionit Evropian thotë...", leaving "i Komisionit
# Evropian thotë...".
_BLURB_THROAT_CLEARING = re.compile(
    r"^\s*(?:ky\s+|kjo\s+)?"
    r"(?:artikulli|artikull|shkrimi|teksti|raporti|lajmi|dokumentari)\b"
    r"[\s,:-]*"
    r"(?:"
    r"(?:flet|tregon|raporton|analizon|eksploron|shpjegon|thot[ëe])\s*"
    r"(?:p[ëe]r|se|q[ëe])?\s*"
    r"|"
    r"(?:p[ëe]r|se|q[ëe])\s+"
    r")",
    re.I,
)


def gemini_json(prompt: str, max_tokens: int = 2000, attempts: int = 2):
    """One JSON call to Gemini. Returns the parsed object, or None.

    None is a first-class answer here, not an error path: every caller has to
    work without it, because this key is optional and the pipeline must not
    stop producing an index just because a nice-to-have blurb is unavailable.
    """
    key = os.environ.get("GOOGLE_AI_API_KEY")
    if not key:
        return None
    url = GEMINI_URL.format(model=GEMINI_MODEL)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.3,
            "maxOutputTokens": max_tokens,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    for attempt in range(1, attempts + 1):
        try:
            r = requests.post(url, params={"key": key}, json=payload, timeout=90)
            if r.status_code == 429:
                # Rate limited. Google returns how long to wait; honour it
                # rather than guessing, but cap the wait — a run that sleeps
                # for a minute per batch is a run that times out in Actions.
                if attempt < attempts:
                    delay = 20
                    try:
                        m = re.search(r'"retryDelay":\s*"(\d+)s"', r.text)
                        if m:
                            delay = min(int(m.group(1)) + 1, 45)
                    except Exception:
                        pass
                    time.sleep(delay)
                    continue
                print("  Gemini rate-limited; skipping this batch", file=sys.stderr)
                return None
            r.raise_for_status()
            parts = r.json()["candidates"][0]["content"]["parts"]
            return json.loads("".join(p.get("text", "") for p in parts))
        except Exception as e:
            if attempt >= attempts:
                print(f"  Gemini call failed: {type(e).__name__}: {e}", file=sys.stderr)
                return None
    return None


def clean_blurb(text: str) -> str:
    """Trim the model's throat-clearing and cap the length.

    The prompt forbids "Ky artikull flet për..." and the model writes it
    anyway often enough to matter — it spends a fifth of the word budget
    telling someone reading a list of articles that this is an article.
    """
    text = " ".join(str(text or "").split())
    text = _BLURB_THROAT_CLEARING.sub("", text)
    if not text:
        return ""
    text = text[0].upper() + text[1:]
    if len(text) > BLURB_MAX_CHARS:
        # Cut on a word boundary, never mid-word, and drop dangling punctuation.
        text = text[:BLURB_MAX_CHARS].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"
    return text


BLURB_PROMPT = (
    "Je redaktor lajmesh në Kosovë. Për çdo artikull, shkruaj një përshkrim "
    "të shkurtër shqip (12-20 fjalë) që i thotë lexuesit PËR ÇFARË bëhet fjalë.\n\n"
    "RREGULLA:\n"
    "- Fillo direkt me faktin. KURRË mos shkruaj 'Artikulli', 'Ky artikull', "
    "'Teksti', 'Raporti', 'Lajmi flet për'.\n"
    "- Mos shto fakte, pasoja apo reagime që nuk janë në tekstin e dhënë. Nëse "
    "titulli jep pak informacion, përshkruaj vetëm atë që dihet.\n"
    "- Pa klikbejt, pa pikëpyetje, pa mbiemra emocionalë.\n"
    "- Shqip standarde, jo përkthim fjalë-për-fjalë.\n\n"
)


def write_blurbs(items: list[dict]) -> list[str]:
    """items: [{'title','summary'}] -> one short Albanian blurb each, in order.

    Missing entries come back as "" so callers can zip() safely; the UI then
    simply shows the headline alone.
    """
    if not items:
        return []
    out = [""] * len(items)
    for start in range(0, len(items), BLURB_BATCH_SIZE):
        chunk = items[start : start + BLURB_BATCH_SIZE]
        lines = []
        for i, a in enumerate(chunk):
            line = f"{i + 1}. {a['title']}"
            if a.get("summary"):
                line += " — " + a["summary"][:300]
            lines.append(line)
        prompt = (
            BLURB_PROMPT
            + 'Kthe VETËM JSON: {"items":[{"i":1,"blurb":"..."}]} me saktësisht '
            + f"{len(chunk)} objekte.\n\n"
            + "\n".join(lines)
        )
        data = gemini_json(prompt, max_tokens=180 * len(chunk) + 200)
        if not isinstance(data, dict):
            continue
        for rec in data.get("items", []) or []:
            try:
                idx = int(rec.get("i", 0)) - 1
            except (TypeError, ValueError):
                continue
            if 0 <= idx < len(chunk):
                out[start + idx] = clean_blurb(rec.get("blurb", ""))
    return out



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

    # Two models, not two attempts at one. llama-3.3-70b and gpt-oss-120b bill
    # against SEPARATE daily token buckets on Groq's free tier, so when the
    # primary is exhausted the fallback is genuinely available — retrying the
    # same model twice, which is what this did, just produced the identical
    # 429 twice and left the whole run UNKNOWN.
    #
    # That is not a small failure: UNKNOWN means excluded from the index, so a
    # full bucket silently turned a day of collection into no data at all. A
    # real run read "Used 98397, Requested 2870" and scored 0 of 12 articles.
    for model in (CLASSIFY_MODEL, CLASSIFY_FALLBACK_MODEL):
        try:
            resp = client.chat.completions.create(
                model=model,
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
            # One line, not the provider's full 429 body — it repeats the
            # billing URL on every batch and buries everything else in the log.
            detail = str(e)
            if "rate_limit_exceeded" in detail or "429" in detail:
                detail = "rate limited (daily token bucket exhausted)"
            print(f"  stance via {model} failed: {detail[:160]}", file=sys.stderr)

    print(f"  {len(texts)} articles left UNKNOWN (excluded from index)", file=sys.stderr)
    return unknown


def gemini_translate(titles: list[str]) -> list[str | None]:
    """Translate headlines to Albanian on Gemini. None per item on failure."""
    if not titles:
        return []
    out: list[str | None] = [None] * len(titles)
    prompt = (
        "Përkthe këto tituj lajmesh në shqip standarde, ashtu si do t'i "
        "shkruante një gazetar në Kosovë. Përkthe KUPTIMIN, jo fjalë-për-fjalë. "
        "Ruaj emrat e përveçëm. Mos shto dhe mos hiq informacion.\n"
        'Kthe VETËM JSON: {"items":[{"i":1,"sq":"..."}]} me saktësisht '
        f"{len(titles)} objekte.\n\n"
        + "\n".join(f"{i + 1}. {t}" for i, t in enumerate(titles))
    )
    data = gemini_json(prompt, max_tokens=140 * len(titles) + 250)
    if not isinstance(data, dict):
        return out
    for rec in data.get("items", []) or []:
        try:
            idx = int(rec.get("i", 0)) - 1
        except (TypeError, ValueError):
            continue
        if 0 <= idx < len(titles):
            sq = " ".join(str(rec.get("sq", "") or "").split())
            out[idx] = sq or None
    return out


def translate_batch(client: "Groq | None", items: list[dict]) -> list[str | None]:
    """Albanian headlines, entirely separate from stance. This failing now
    costs a translation and nothing else.

    Gemini first, Groq only as a fallback. Both jobs used to run on Groq's
    llama-3.3-70b against one 100K-token daily ceiling, and classification
    runs first — so translation was reliably the call that got refused, and on
    a heavy day it took classification down with it: a real run hit
    "Used 98397, Requested 2870" and left every article of that run UNKNOWN,
    which means excluded from the index entirely.

    Splitting the two providers gives stance the whole Groq budget. Gemini
    handles German, Italian, French, Turkish and English headlines at least as
    well as the 70B did, on a free tier this repo barely touches.
    """
    if not items:
        return []

    titles = [a["title"] for a in items]
    if os.environ.get("GOOGLE_AI_API_KEY"):
        got = gemini_translate(titles)
        if any(t for t in got):
            return got

    if client is None:
        return [None for _ in items]

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
    # Primary then fallback. The 70B writes better Albanian but shares its
    # daily token ceiling with classification, and classification runs first —
    # so on a heavy day this is the call that gets refused. Dropping to the 8B
    # costs some fluency; dropping the translation costs the headline.
    for model in (TRANSLATE_MODEL, TRANSLATE_FALLBACK_MODEL):
        try:
            resp = client.chat.completions.create(
                model=model,
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
            print(f"  translation via {model} failed: {e}", file=sys.stderr)
            if model == TRANSLATE_FALLBACK_MODEL:
                return [None for _ in titles]
    return [None for _ in titles]


def retry_translation(client: "Groq | None", title: str) -> str | None:
    """One individual escalated retry for a headline whose first-pass
    translation didn't look Albanian (rare, but small models slip back into
    the source language sometimes).

    Gemini first, same as the batch path — a retry that lands on the exhausted
    Groq budget is not a retry, it is a second failure.
    """
    if os.environ.get("GOOGLE_AI_API_KEY"):
        got = gemini_translate([title])
        if got and got[0] and is_albanian_text(got[0]):
            return got[0]
    if client is None:
        return None
    prompt = (
        "Your previous translation was not natural Albanian. Rewrite ONLY "
        "in Albanian (Shqip), using authentic Kosovo Albanian journalistic "
        "phrasing. Reply with ONLY the translated headline, nothing else.\n\n"
        f"Headline: {title}"
    )
    for model in (TRANSLATE_MODEL, TRANSLATE_FALLBACK_MODEL):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=100,
                temperature=0.3,
            )
            text = resp.choices[0].message.content.strip().strip('"')
            if text:
                return text
        except Exception as e:
            print(f"  translation retry via {model} failed: {e}", file=sys.stderr)
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
                return {**data, "articles": drop_blocked(data["articles"])}
        except Exception:
            pass
    return {"version": 1, "articles": {}}


def drop_blocked(articles: dict) -> dict:
    """Re-apply the blocklist to everything already cached.

    is_foreign_press() runs at fetch time, so adding an outlet to the
    blocklist only stopped NEW articles: the ones already cached stayed, and
    the cache is read directly by the site's topic clustering and Bota Flet
    section. KoSSev and Kosovo Online — Kosovo-based Serbian-language
    outlets, the exact class this index exists to exclude — were the two
    highest-volume outlets in it.

    Published tone-outlets.json/tone-history.json rebuild from each run's own
    candidates and so cleaned themselves, which is what hid this: the numbers
    were right while the articles on the page were not.
    """
    kept = {
        key: a for key, a in articles.items()
        if is_foreign_press(a.get("outlet", ""), a.get("url", ""))
    }
    dropped = len(articles) - len(kept)
    if dropped:
        print(f"Dropped {dropped} cached articles from blocked outlets")
    return kept


# Conservative: Google News rate-limits, and the images pool already uses
# eight. This is I/O-bound waiting, not work.
FEED_WORKERS = 6


def _parse_feed(url: str):
    """One feed. Returns its entries, or None if the fetch failed.

    None rather than an empty list on purpose — the caller counts failures,
    and a feed that legitimately returned nothing is not a failure.
    """
    try:
        return feedparser.parse(url).entries[:60]
    except Exception as e:
        print(f"  feed fetch failed ({url[:70]}): {e}", file=sys.stderr)
        return None


def fetch_candidates() -> dict[str, list[dict]]:
    """Fetch + within-country dedupe only, no classification yet. Returns
    {country: [{title, summary, url, date, outlet}, ...]}."""
    by_country: dict[str, list[dict]] = {c: [] for c in FEED_LOCALES}
    # Deduped across every feed, not per feed. The same article now reaches its
    # owning country from several locales — that is the point of attributing by
    # outlet — so a per-feed set would let it in once per feed that found it.
    seen_titles: set[str] = set()
    for country, feed_urls in FEEDS.items():
        items: list[dict] = []
        dropped: list[str] = []
        non_editorial: list[str] = []
        wrong_place: list[str] = []
        reattributed: list[str] = []
        stale = 0
        hl = FEED_LOCALES[country][0]

        # Several queries per country now. They overlap heavily by design —
        # seen_titles dedupes across all of them, so the extra queries add
        # reach without adding duplicates to classify.
        #
        # Fetched in parallel because there are 96 of these. Sequentially, at
        # roughly a second and a half each, the fetch alone would approach the
        # workflow's 20-minute timeout before a single article was classified.
        entries = []
        failed = 0
        with ThreadPoolExecutor(max_workers=FEED_WORKERS) as pool:
            for feed_url, got in zip(feed_urls, pool.map(_parse_feed, feed_urls)):
                if got is None:
                    failed += 1
                else:
                    entries.extend(got)
        print(f"  Fetching {country}... {len(feed_urls) - failed}/{len(feed_urls)} feeds, {len(entries)} entries")

        for entry in entries:
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
            # Freshness, before anything expensive. Filtering here means the
            # classification budget (MAX_NEW_PER_RUN) is spent on today's news
            # instead of on stories from last spring.
            if not is_fresh(published):
                stale += 1
                continue
            # Google serves Kosovar outlets into the German and US feeds. Their
            # coverage is Kosovo talking about itself, which is not what an
            # index of foreign press means.
            if not is_foreign_press(outlet, url):
                dropped.append(outlet)
                continue
            # A score table, a fixture calendar or a TV listing has no stance
            # to measure. Counting it "neutral" is a vote for 50 that no
            # journalist cast, and it was flattening every country's index.
            if not source_is_editorial(outlet, url):
                non_editorial.append(outlet)
                continue
            # The wrong Kosovo: a village in Poland, a mahalle in Turkey, a
            # field near Knin. A house fire in gmina Cekcyn was being counted
            # as Polish coverage of the country.
            if source_is_local_placename(title, summary, hl.split("-")[0]):
                wrong_place.append(outlet)
                continue
            # Attribution deliberately does NOT happen here.
            #
            # At this point `url` is a news.google.com redirect — the
            # publisher's own domain is not known until it is resolved further
            # down the pipeline. Deciding nationality here dropped Blick,
            # Tagesschau and ANSA as "unattributable" even though all three are
            # in the registry, and took the published index to zero outlets.
            #
            # The feed's country is carried as a provisional label so nothing
            # is lost, and tools/tone_rebuild.py re-attributes every article
            # from its resolved URL when it writes the published files. One
            # implementation of "whose press is this", running where the
            # evidence for it actually exists.
            owner = source_country_for(url, outlet) or country
            if owner != country:
                reattributed.append(f"{outlet}->{owner}")

            key = normalize_title(title)
            if key in seen_titles:
                continue
            seen_titles.add(key)
            items.append({
                "title": title, "summary": summary, "url": url,
                "date": published, "outlet": outlet, "country": owner,
            })
        # Filed under the outlet's own country, which is often not the feed
        # that found it.
        for item in items:
            by_country[item["country"]].append(item)
        print(f"    -> {len(items)} usable")
        if stale:
            print(f"  {country}: skipped {stale} outside the {MAX_ARTICLE_AGE_DAYS + 1}-day window")
        # Logged, not silent — every one of these is a judgement call, and this
        # is how they get tuned.
        for label, bucket in (
            ("non-foreign-press", dropped),
            ("non-editorial", non_editorial),
            ("wrong Kosovo", wrong_place),
        ):
            if bucket:
                names = ", ".join(sorted(set(bucket))[:6])
                print(f"  {country}: dropped {len(bucket)} {label} ({names})")
        if reattributed:
            names = ", ".join(sorted(set(reattributed))[:6])
            print(f"  {country}: reattributed {len(reattributed)} to their own press ({names})")
    return by_country


# ── Topics: what the world is actually writing about ────────────────────
#
# This clustering used to live in lib/tone-data.ts and run at render time. It
# moved here so the labels can be written by a model: a reader is not drawn in
# by "Kryeministri · Parlament", which is two frequent tokens stapled together
# and names no event. Groq/Gemini can turn the same cluster into "Kriza në
# Parlament pas hedhjes së vezëve ndaj Kurtit", which is a headline.
#
# The TS implementation stays as a fallback for when public/tone-topics.json is
# missing (a fresh checkout, a failed run), so the section degrades to
# mechanical labels rather than disappearing.

TOPIC_LIMIT = 8
TOPIC_MIN_ARTICLES = 3
TOPIC_STEM_LEN = 6

# Albanian is heavily inflected and there is no stemmer here; folding tokens by
# their first six characters groups parlamenti/parlamentin/parlamentare. Crude,
# and adequate at this scale.
TOPIC_STOPWORDS = {
    # Function words long enough to survive the length filter.
    "tyre", "atij", "asaj", "juaj", "këtu", "ketu", "atje", "shumë", "shume",
    "edhe", "ose", "nëse", "nese", "sepse", "ndërsa", "ndersa", "ashtu",
    "kështu", "keshtu", "gjithë", "gjithe", "tjetër", "tjeter", "tjera",
    "tjerë", "tjere", "mund", "duhet", "bëri", "beri", "bërë", "bere",
    "kishte", "ishin", "pasi", "brenda", "jashtë", "jashte", "rreth", "reja",
    "vitin", "vjet", "ditë", "dite", "ditën", "diten", "nesër", "neser",
    "numri", "pjesë", "pjese", "mënyrë", "menyre", "sipas", "thotë", "thote",
    # Spelled-out numbers cluster on counts rather than subjects.
    "dy", "tre", "katër", "kater", "pesë", "pese", "gjashtë", "gjashte",
    "shtatë", "shtate", "tetë", "tete", "nëntë", "nente", "dhjetë", "dhjete",
    "njëzet", "njezet", "qind", "mijë", "mije",
    # News furniture.
    "lajme", "lajmi", "artikull", "video", "foto", "news", "report", "reports",
    "says", "said", "live", "update", "updates",
    # Bare verbs. "Është" and "Janë" ranked into labels as if they were
    # subjects; they are the most common words in any Albanian sentence.
    "është", "eshte", "janë", "jane", "ishte", "kanë", "kane", "bëhet",
    "behet", "bëhen", "behen", "merr", "marrin", "shkon", "vjen", "kishin",
    "pati", "paten", "patën", "u bë", "bëhet",
}

# Matched by stem prefix rather than exact spelling. The kosov* family alone
# has a dozen inflections — kosova, kosovës, kosovën, kosovar, kosovare — and
# it appears in nearly every headline, so an exact-match list always leaks one
# and that one becomes the label. A prefix rule cannot leak.
# Only words that appear in nearly EVERY headline belong here — a stopword's
# job is to remove tokens that cannot discriminate between topics. "Serbi" and
# "shqip" were on this list briefly and should not have been: they turn up in a
# minority of headlines and genuinely separate one subject from another.
TOPIC_STOP_STEMS = ("kosov", "prisht")


def topic_tokens(title: str) -> set[str]:
    """Unicode-aware, and it has to be.

    Splitting on \\W classed ë and ç as non-word characters and shredded
    Albanian at every diacritic: "kundër" became "kund" + "r". Topic labels
    came out as truncated stems.
    """
    return {w for w in re.split(r"[^\w]+", (title or "").lower(), flags=re.UNICODE) if len(w) > 3}


def _stem(word: str) -> str:
    return word[:TOPIC_STEM_LEN]


def cluster_topics(articles: list[dict], limit: int = TOPIC_LIMIT,
                   min_articles: int = TOPIC_MIN_ARTICLES) -> list[dict]:
    """Greedy single-pass clustering. A newsroom summary, not a taxonomy.

    Takes the most frequent surviving token, claims every article containing
    it, removes them, repeats.
    """
    # Outlet names are not topics. "Arte" and "Tgcom" recur often enough to
    # out-rank real subjects, so they join the stopwords — derived from the
    # data rather than hand-listed, so new outlets are covered automatically.
    outlet_stems = set()
    for a in articles:
        for w in topic_tokens(a.get("outlet", "")):
            outlet_stems.add(_stem(w))

    def usable(word: str) -> bool:
        if word in TOPIC_STOPWORDS or _stem(word) in outlet_stems:
            return False
        return not word.startswith(TOPIC_STOP_STEMS)

    docs = []
    for a in articles:
        # Albanian titles only. Falling back to the original produced labels
        # like "Minister · Eggs" — a topic list in German and English on an
        # Albanian homepage is worse than a shorter one.
        title = a.get("albanianTitle")
        if not title:
            continue
        words = [w for w in topic_tokens(title) if usable(w)]
        if words:
            docs.append({"article": a, "stems": {_stem(w) for w in words}, "words": words})

    topics: list[dict] = []
    claimed: set[int] = set()
    for _ in range(limit * 3):
        if len(topics) >= limit:
            break
        freq: dict[str, int] = {}
        for i, d in enumerate(docs):
            if i in claimed:
                continue
            for st in d["stems"]:
                freq[st] = freq.get(st, 0) + 1
        if not freq:
            break
        top, top_count = max(freq.items(), key=lambda kv: kv[1])
        if top_count < min_articles:
            break

        members = [i for i, d in enumerate(docs) if i not in claimed and top in d["stems"]]
        claimed.update(members)
        mine = [docs[i]["article"] for i in members]

        inner: dict[str, int] = {}
        for i in members:
            for w in docs[i]["words"]:
                inner[w] = inner.get(w, 0) + 1
        # One word per stem. Without this the label reads "Kryeministri ·
        # Kryeministrin" — the same noun in two cases, which names nothing and
        # wastes the only two slots the fallback label has.
        ranked = sorted(inner.items(), key=lambda kv: -kv[1])
        seed_words: list[str] = []
        seen_stems: set[str] = set()
        for w, _ in ranked:
            if _stem(w) in seen_stems:
                continue
            seen_stems.add(_stem(w))
            seed_words.append(w)
            if len(seed_words) == 4:
                break

        counts = Counter(a.get("stance", a.get("sentiment")) for a in mine)
        pos, neu, neg = counts.get("positive", 0), counts.get("neutral", 0), counts.get("negative", 0)
        scored = pos + neu + neg
        topics.append({
            "key": top,
            # The mechanical label, kept as the fallback if the model is
            # unavailable — better a token pair than an empty chip.
            "fallbackLabel": " · ".join(w.capitalize() for w in seed_words[:2]),
            "seedWords": seed_words,
            "count": len(mine),
            "positive": pos,
            "neutral": neu,
            "negative": neg,
            # Identical arithmetic to country_index, so a topic and a country
            # mean the same thing on the same scale.
            "index": country_index(pos, neu, neg) if scored else None,
            "articles": mine,
        })

    topics.sort(key=lambda t: -t["count"])
    return topics


def label_topics(topics: list[dict]) -> None:
    """Ask Gemini for a real headline-shaped label and a one-line summary.

    One call for every topic in the run. Mutates in place; on any failure the
    mechanical label stands, so the section never empties out.
    """
    for t in topics:
        t.setdefault("label", t["fallbackLabel"])
        t.setdefault("summary", "")
    if not topics:
        return

    blocks = []
    for i, t in enumerate(topics):
        heads = [a.get("albanianTitle") or a["title"] for a in t["articles"][:6]]
        blocks.append(
            f"TEMA {i + 1} ({t['count']} artikuj):\n"
            + "\n".join(f"  - {h}" for h in heads)
        )

    prompt = (
        "Më poshtë janë grupe titujsh nga shtypi i huaj për Kosovën. Secili grup "
        "flet për të njëjtën temë.\n\n"
        "Për çdo grup jep:\n"
        '- "label": një emër teme 3-6 fjalë, konkret dhe i kuptueshëm, si titull '
        "seksioni. Përmend ngjarjen ose çështjen reale, jo fjalë të përgjithshme.\n"
        '- "summary": një fjali shqip (15-25 fjalë) që shpjegon çfarë po ndodh '
        "dhe pse ka rëndësi.\n\n"
        "RREGULLA:\n"
        "- Bazohu VETËM te titujt e dhënë. Mos shto ngjarje apo pasoja që nuk janë aty.\n"
        "- Pa klikbejt, pa pikëpyetje, pa 'Ja çfarë'.\n"
        "- Mos e nis etiketën me 'Tema' ose 'Grupi'.\n\n"
        f'Kthe VETËM JSON: {{"topics":[{{"i":1,"label":"...","summary":"..."}}]}} '
        f"me saktësisht {len(topics)} objekte.\n\n" + "\n\n".join(blocks)
    )

    data = gemini_json(prompt, max_tokens=260 * len(topics) + 300)
    if not isinstance(data, dict):
        print("  topic labelling unavailable; keeping mechanical labels")
        return

    for rec in data.get("topics", []) or []:
        try:
            idx = int(rec.get("i", 0)) - 1
        except (TypeError, ValueError):
            continue
        if not (0 <= idx < len(topics)):
            continue
        label = " ".join(str(rec.get("label", "") or "").split())[:70]
        summary = clean_blurb(rec.get("summary", ""))
        if label:
            topics[idx]["label"] = label
        if summary:
            topics[idx]["summary"] = summary


def write_topics(articles_cache: dict, today: str) -> None:
    """Cluster, label, and publish public/tone-topics.json."""
    pool = [a for a in articles_cache.values() if a.get("albanianTitle")]
    topics = cluster_topics(pool)
    label_topics(topics)

    out = []
    for t in topics:
        out.append({
            "label": t["label"],
            "fallbackLabel": t["fallbackLabel"],
            "summary": t["summary"],
            "count": t["count"],
            "positive": t["positive"],
            "neutral": t["neutral"],
            "negative": t["negative"],
            "index": t["index"],
            "countries": sorted({a.get("country", "") for a in t["articles"] if a.get("country")}),
            "articles": [
                {
                    "title": a["title"],
                    "albanianTitle": a.get("albanianTitle"),
                    "blurb": a.get("blurb", ""),
                    "imageUrl": a.get("imageUrl"),
                    "url": a["url"],
                    "date": a.get("date", ""),
                    "sentiment": a.get("stance", a.get("sentiment")),
                    "reason": a.get("stanceReason", ""),
                    "isQuote": bool(a.get("isQuote", False)),
                    "speaker": a.get("speaker", ""),
                    "evidence": a.get("evidence", ""),
                    "outlet": a.get("outlet", ""),
                    "country": a.get("country", ""),
                    "flag": FLAGS.get(a.get("country", ""), ""),
                }
                # Critical first, then positive, then the neutral bulk: the two
                # ends are what a reader came to see.
                for a in sorted(
                    t["articles"],
                    key=lambda x: {"negative": 0, "positive": 1, "neutral": 2}.get(
                        x.get("stance", x.get("sentiment")), 3
                    ),
                )[:10]
            ],
        })

    TOPICS_PATH.write_text(
        json.dumps({"lastUpdated": today, "topics": out}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {TOPICS_PATH} ({len(out)} topics)")


def canonicalise_outlets(by_country: dict[str, list[dict]]) -> None:
    """Fold each publisher's two identities into one, across the whole run.

    normalize_outlet() only folds against KNOWN_OUTLETS, so a publisher not on
    that list keeps whichever identity Google happened to send per feed. The
    result renders as two separate outlets carrying the same story: "Bangladesh
    Post" beside "bangladeshpost.net", "The Church Times" beside
    "churchtimes.co.uk". Both are counted, both are shown, and the country's
    outlet count is inflated.

    outlet_identity() already knows these are the same masthead. This picks the
    human-readable spelling of each identity — a name with spaces, or failing
    that the one without a TLD — and rewrites every candidate to it.
    """
    # Every variant key points at the best spelling seen for that masthead, so
    # "churchtimes" and "thechurchtimes" both resolve to "The Church Times".
    best: dict[str, str] = {}
    for items in by_country.values():
        for item in items:
            name = item["outlet"]
            keys = outlet_identities(name)
            if not keys:
                continue
            incumbent = next((best[k] for k in keys if k in best), None)
            winner = name if incumbent is None or _prettier(name, incumbent) else incumbent
            for k in keys | (outlet_identities(incumbent) if incumbent else set()):
                best[k] = winner
    for items in by_country.values():
        for item in items:
            for k in outlet_identities(item["outlet"]):
                if k in best:
                    item["outlet"] = best[k]
                    break


def _prettier(candidate: str, incumbent: str) -> bool:
    """A masthead beats a domain; failing that, the longer spelling wins."""
    def score(n: str) -> tuple[int, int]:
        looks_like_domain = bool(re.search(r"\.[a-z]{2,}$", n.lower()))
        return (0 if looks_like_domain else 1, len(n))
    return score(candidate) > score(incumbent)


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
    canonicalise_outlets(by_country)

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

    # ── Blurbs ──
    # Runs on Gemini, not Groq: the 70b model already carries stance and
    # translation against a 100K/day budget. Additive by design — every entry
    # can come back "" and the cards simply show the headline alone.
    blurbs: dict[str, str] = {}
    if new_items:
        texts = write_blurbs([c for _, c in new_items])
        blurbs = {key: b for (key, _), b in zip(new_items, texts) if b}
        print(f"  {len(blurbs)}/{len(new_items)} blurbs written")

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
            # One line of Albanian saying what the article is about. Falls back
            # to whatever a previous run managed, so a rate-limited batch does
            # not blank a blurb that already exists.
            "blurb": blurbs.get(key) or prior.get("blurb", ""),
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
    #
    # Two rules, and the second is the one that matters. lastSeen prunes what
    # the feeds have stopped carrying. Publication date prunes what is simply
    # too old to be today's news — and only that rule can catch an article
    # from March that Google re-serves every single run, refreshing its
    # lastSeen forever. Together they had let the cache grow to 1066 entries
    # reaching back to 2025-09-08.
    seen_cutoff = (datetime.now(timezone.utc) - timedelta(days=CACHE_RETENTION_DAYS)).strftime("%Y-%m-%d")
    aged_out = old_news = 0
    for key in list(articles_cache.keys()):
        entry = articles_cache[key]
        if entry.get("lastSeen", "") < seen_cutoff:
            del articles_cache[key]
            aged_out += 1
        elif not is_fresh(entry.get("date", ""), today):
            del articles_cache[key]
            old_news += 1
    if aged_out or old_news:
        print(f"  pruned {aged_out} unseen + {old_news} outside the freshness window")

    # ── Backfill blurbs ──
    # Runs after the prune, deliberately: there is no point spending calls on
    # an article that is about to be deleted for being too old. Everything
    # cached before blurbs existed is blank until this fills it in.
    missing = [e for e in articles_cache.values() if not e.get("blurb")][:BLURB_BACKFILL_PER_RUN]
    if missing:
        texts = write_blurbs([
            {"title": e["title"], "summary": e.get("summary", "")} for e in missing
        ])
        filled = 0
        for entry, text in zip(missing, texts):
            if text:
                entry["blurb"] = text
                filled += 1
        print(f"  backfilled {filled}/{len(missing)} missing blurbs")

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(
        json.dumps({"version": 1, "articles": articles_cache}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {CACHE_PATH} ({len(articles_cache)} cached articles)")

    # Topics are derived from the cache, so they are written straight after it
    # and before the per-country rollup — they answer "what is the world
    # writing about", which is the half the index alone cannot tell a reader.
    write_topics(articles_cache, today)

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
                # What the article is about, in one line. Cached from Gemini.
                "blurb": entry.get("blurb", ""),
                # The cache has resolved og:images all along and this file
                # dropped the field, so the country drill-down had nothing to
                # show but text — the reason those cards never stopped a scroll.
                "imageUrl": entry.get("imageUrl"),
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
            "confident": is_confident(n, excluded),
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
        # Which definition of "tone" produced these numbers. Must match what
        # tools/tone_reclassify.py writes, or a scheduled run silently
        # downgrades a hand-derived file.
        "stanceVersion": STANCE_SCHEMA_VERSION,
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
            # Without this the row reads as v1 to summarizeToneHistory, which
            # would then happily subtract a stance-measured index from a
            # valence-measured one and report a methodology change as a swing
            # in world opinion. The guard in lib/tone-data.ts depends on this
            # field being here, so a scheduled run that omitted it undid the
            # guard a few hours after it shipped.
            "stanceVersion": STANCE_SCHEMA_VERSION,
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
