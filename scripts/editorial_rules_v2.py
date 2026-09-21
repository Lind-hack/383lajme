#!/usr/bin/env python3
"""Deterministic Topic Selection v2 rules for the 383 Lajme pipeline.

The writer may discover and rewrite stories, but this module owns the rules that
must not be left to model judgment: lane quotas, source-lane exceptions, title
shape, city tagging, hard topic bans, Kosovo relevance, and second-source
independence.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from urllib.parse import urlparse
from typing import Any


MIN_TOTAL_ARTICLES = 13
MAX_TOTAL_ARTICLES = 20

LANE_QUOTAS: dict[str, dict[str, int]] = {
    "Kosovë": {"min": 6},
    "Shqipëri": {"min": 3},
    "Botë": {"min": 3, "max": 4},
    "Sport": {"min": 2, "max": 3},
    "Showbiz": {"min": 1, "max": 2},
}

CANONICAL_CATEGORIES = {
    "Kosovë",
    "Shqipëri",
    "Botë",
    "Sport",
    "Showbiz",
    "Ekonomi",
    "Teknologji",
}

_CATEGORY_ALIASES = {
    "kosovo": "Kosovë",
    "kosove": "Kosovë",
    "kosovë": "Kosovë",
    "kosova": "Kosovë",
    "vendi": "Kosovë",
    "shqiperi": "Shqipëri",
    "shqiperia": "Shqipëri",
    "shqipëri": "Shqipëri",
    "albania": "Shqipëri",
    "politike": "Kosovë",
    "politikë": "Kosovë",
    "siguri": "Kosovë",
    "shoqeri": "Kosovë",
    "shoqëri": "Kosovë",
    "bote": "Botë",
    "botë": "Botë",
    "showbiz": "Showbiz",
    "kulture": "Showbiz",
    "kulturë": "Showbiz",
    "argëtim": "Showbiz",
    "sporti": "Sport",
    "teknologjia": "Teknologji",
    "tech": "Teknologji",
    "biznes": "Ekonomi",
}

# Exact publisher/domain exceptions requested by the user. They are legal only
# in their own local lane; in all other lanes they remain discovery-only/banned
# as a primary article source.
LOCAL_COMPETITOR_LANES = {
    "telegrafi.com": "Kosovë",
    "koha.net": "Kosovë",
    "gazetaexpress.com": "Kosovë",
    "indeksonline.net": "Kosovë",
    "kallxo.com": "Kosovë",
    "gazetablic.com": "Kosovë",
    "news24.al": "Shqipëri",
    "balkanweb.com": "Shqipëri",
    "euronews.al": "Shqipëri",
    "abcnews.al": "Shqipëri",
}

# Other Kosovo-originating competitors stay prohibited as primary sources in
# every lane. The v2 exception is deliberately narrow, not a global allowlist.
ALWAYS_BANNED_COMPETITORS = {
    "reporteri",
    "reporter.al",
    "rtk",
    "rtklive",
    "klan kosova",
    "kosovapress",
    "sinjali",
    "nacionale",
    "periskopi",
    "dukagjini",
    "bota sot",
    "zeri",
    "lajmi.net",
    "insajderi",
    "ekonomia online",
    "albanian post",
}

# The source list in the user specification is also useful when only the
# publisher name, rather than its URL, survives normalization.
_SOURCE_NAME_LANES = {
    "telegrafi": "Kosovë",
    "koha": "Kosovë",
    "gazeta express": "Kosovë",
    "indeksonline": "Kosovë",
    "kallxo": "Kosovë",
    "gazeta blic": "Kosovë",
    "news24": "Shqipëri",
    "balkanweb": "Shqipëri",
    "euronews albania": "Shqipëri",
    "abc news": "Shqipëri",
}

# City order is intentional: the first matching city in this list wins, not the
# first city in the article text. This mirrors the supplied editorial priority.
KOSOVO_CITIES = [
    ("Prishtinë", ("prishtine", "prishtina")),
    ("Prizren", ("prizren",)),
    ("Pejë", ("peje", "peja")),
    ("Mitrovicë", ("mitrovice", "mitrovica")),
    ("Gjilan", ("gjilan",)),
    ("Ferizaj", ("ferizaj",)),
    ("Gjakovë", ("gjakove",)),
    ("Podujevë", ("podujeve",)),
    ("Vushtrri", ("vushtrri",)),
    ("Skenderaj", ("skenderaj",)),
    ("Drenas", ("drenas",)),
    ("Lipjan", ("lipjan",)),
    ("Suharekë", ("suhareke",)),
    ("Rahovec", ("rahovec",)),
    ("Deçan", ("decan",)),
    ("Istog", ("istog",)),
    ("Klinë", ("kline",)),
    ("Malishevë", ("malisheve",)),
    ("Kaçanik", ("kacanik",)),
    ("Shtime", ("shtime",)),
    ("Obiliq", ("obiliq",)),
    ("Fushë Kosovë", ("fushe kosove",)),
    ("Graçanicë", ("gracanice",)),
    ("Dragash", ("dragash",)),
    ("Junik", ("junik",)),
    ("Mamushë", ("mamushe",)),
    ("Hani i Elezit", ("hani i elezit",)),
    ("Zveçan", ("zvecan",)),
    ("Leposaviq", ("leposaviq",)),
    ("Zubin Potok", ("zubin potok",)),
    ("Shtërpcë", ("shterpce",)),
    ("Novobërdë", ("novoberde",)),
    ("Kllokot", ("kllokot",)),
    ("Ranillug", ("ranillug",)),
    ("Partesh", ("partesh",)),
]

ALBANIA_CITIES = [
    ("Tiranë", ("tirane", "tirana")),
    ("Durrës", ("durres",)),
    ("Shkodër", ("shkoder",)),
    ("Vlorë", ("vlore",)),
    ("Elbasan", ("elbasan",)),
    ("Fier", ("fier",)),
    ("Korçë", ("korce",)),
    ("Berat", ("berat",)),
    ("Lezhë", ("lezhe",)),
    ("Kavajë", ("kavaje",)),
    ("Lushnjë", ("lushnje",)),
    ("Pogradec", ("pogradec",)),
    ("Gjirokastër", ("gjirokaster",)),
    ("Sarandë", ("sarande",)),
    ("Kukës", ("kukes",)),
    ("Dibër", ("diber",)),
    ("Krujë", ("kruje",)),
    ("Kurbin", ("kurbin",)),
    ("Mirditë", ("mirdita",)),
    ("Mat", ("mat",)),
    ("Bulqizë", ("bulqize",)),
    ("Tropojë", ("tropoje",)),
    ("Has", ("has",)),
    ("Pukë", ("puke",)),
    ("Devoll", ("devoll",)),
    ("Kolonjë", ("kolonje",)),
    ("Përmet", ("permet",)),
    ("Tepelenë", ("tepelene",)),
    ("Mallakastër", ("mallakaster",)),
    ("Skrapar", ("skrapar",)),
    ("Gramsh", ("gramsh",)),
    ("Librazhd", ("librazhd",)),
    ("Peqin", ("peqin",)),
    ("Rrogozhinë", ("rrogozhine",)),
    ("Divjakë", ("divjake",)),
    ("Himarë", ("himare",)),
    ("Delvinë", ("delvine",)),
    ("Vorë", ("vore",)),
    ("Kamëz", ("kamez",)),
    ("Shijak", ("shijak",)),
]

GENERIC_TITLE_NOUNS = {"zhvillime", "ngjarje", "reagime", "detaje", "situate"}
TITLE_STAKE_MARKERS = {
    "rrit", "ul", "hap", "mbyll", "miraton", "ndalon", "ndryshon", "njofton",
    "takohen", "takim", "fiton", "humb", "kalon", "shënon", "shenon", "nis",
    "përfundon", "perfundon", "vendos", "kërkon", "kerkon", "paguan", "nga",
    "deri", "pas", "para", "shton", "heq", "jep", "merr", "konfirmon",
}

TITLE_WHO_MARKERS = {
    "kosov", "prishtin", "shqiper", "tirane", "qeveri", "kuvend", "polici", "komun",
    "banka", "aeroport", "kurti", "vucic", "vuçiç", "osmani", "sveçla", "be", "nato",
    "kfor", "drita", "ballkani", "prishtina", "llapi", "dua lipa", "rita ora",
    "bebe rexha", "era istrefi", "netflix", "europ", "trump", "messi", "ronaldo",
}

GLOBAL_RELEVANCE_MARKERS = {
    "kosov", "prishtin", "shqiper", "alban", "balkan", "diaspor", "europ",
    "bashkimi evropian", "bashkimi europian", "be", "nato", "kfor", "serbi",
    "dialog", "viza", "migr", "bruksel", "washington", "shba", "amerik",
    "shtetet e bashkuara", "trump",
}

SPORT_MARKERS = {
    "kosov", "drita", "ballkani", "prishtina", "llapi", "champions league",
    "premier league", "la liga", "serie a", "transfer", "muriq", "zhegrova",
    "rrahmani", "broja", "xhaka", "shaqiri", "messi", "ronaldo", "mbappe",
    "haaland",
}

SHOWBIZ_MARKERS = {
    "dua lipa", "rita ora", "bebe rexha", "era istrefi", "elvana gjata", "tayna",
    "noizy", "ledri", "yll limani", "taylor swift", "beyonce", "rihanna",
    "kim kardashian", "brad pitt", "angelina jolie", "tom cruise", "netflix",
    "oscar", "grammy", "hollywood", "major film",
}

HARD_BANNED_PATTERNS = (
    ("anime/manga", re.compile(r"\b(anime|manga)\b", re.I)),
    ("K-pop/J-pop", re.compile(r"\b(k[ -]?pop|j[ -]?pop)\b", re.I)),
    ("gaming/esports", re.compile(r"\b(gaming|gamer|esports?|e[ -]?sports?)\b", re.I)),
)
WOMEN_SPORT_PATTERN = re.compile(
    r"(?:(?:\b(women['’]?s|femr\w*|vajz\w*|femer\w*)\b.{0,80}\b(futboll\w*|sport\w*|basketboll\w*|tenis\w*|volejboll\w*|olimpiad\w*)\b)|(?:\b(futboll\w*|sport\w*|basketboll\w*|tenis\w*|volejboll\w*|olimpiad\w*)\b.{0,80}\b(women['’]?s|femr\w*|vajz\w*|femer\w*)\b))",
    re.I,
)
LOW_VALUE_SPORT_PATTERN = re.compile(r"\b(youth|u-?\d+|te rinj\w*|lower league|liga e ulet|friendly|miqesor\w*)\b", re.I)
KOSOVO_SPORT_INTEREST_MARKERS = {"kosov", "alban", "drita", "ballkani", "prishtina", "llapi"}


def fold(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).casefold()
    return "".join(char for char in text if not unicodedata.combining(char))


def canonical_category(value: object) -> str:
    raw = str(value or "").strip()
    if raw in CANONICAL_CATEGORIES:
        return raw
    return _CATEGORY_ALIASES.get(fold(raw), raw)


def hostname(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if not text.startswith(("http://", "https://")):
        text = "https://" + text
    try:
        return (urlparse(text).hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def canonical_url(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return text.split("#", 1)[0].rstrip("/")


def _contains(text: str, marker: str) -> bool:
    marker = fold(marker)
    if " " in marker:
        return marker in text
    return bool(re.search(r"(?<!\w)" + re.escape(marker) + r"\w*", text))


def _article_text(article: dict[str, Any]) -> str:
    return fold(" ".join(str(article.get(key) or "") for key in ("title", "excerpt", "body")))


def _publisher_lane(source: object, url: object) -> tuple[str, str] | None:
    host = hostname(url)
    for domain, lane in LOCAL_COMPETITOR_LANES.items():
        if host == domain or host.endswith("." + domain):
            return domain, lane
    source_text = fold(source)
    for name, lane in _SOURCE_NAME_LANES.items():
        if name in source_text:
            return name, lane
    return None


def _always_banned(source: object, url: object) -> bool:
    host = hostname(url)
    source_text = fold(source)
    for marker in ALWAYS_BANNED_COMPETITORS:
        marker_folded = fold(marker)
        if host == marker_folded or host.endswith("." + marker_folded) or marker_folded in source_text:
            return True
    return False


def source_policy_error(category: object, source: object, url: object) -> str | None:
    """Return a source-policy error, or None when the primary source is legal."""
    lane = canonical_category(category)
    publisher = _publisher_lane(source, url)
    if publisher:
        publisher_name, allowed_lane = publisher
        if lane == allowed_lane:
            return None
        return (
            f"source {publisher_name!r} is discovery-only/banned as a primary source in "
            f"the {lane or category!r} lane; local competitor exceptions apply only to {allowed_lane}"
        )
    if _always_banned(source, url):
        return f"source {source!r} remains a prohibited competitor primary source"
    return None


def infer_city(category: object, title: object, body: object) -> str | None:
    lane = canonical_category(category)
    if lane not in {"Kosovë", "Shqipëri"}:
        return None
    first_200_words = " ".join(str(body or "").split()[:200])
    text = fold(f"{title or ''} {first_200_words}")
    candidates = KOSOVO_CITIES if lane == "Kosovë" else ALBANIA_CITIES
    for city, aliases in candidates:
        for alias in aliases:
            if _contains(text, alias):
                return city
    return lane


def title_errors(article: dict[str, Any]) -> list[str]:
    category = canonical_category(article.get("category"))
    title = " ".join(str(article.get("title") or "").split())
    errors: list[str] = []
    if not title:
        return ["title is empty"]
    if len(title) > 65:
        errors.append(f"title exceeds the ~65-character mobile limit ({len(title)} characters)")
    folded = fold(title)
    words = re.findall(r"[\wÀ-ÿ'-]+", title, flags=re.UNICODE)
    folded_words = [fold(word).strip("'-") for word in words]
    has_named_who = any(_contains(folded, marker) for marker in TITLE_WHO_MARKERS)
    has_proper_name = any(word[:1].isupper() for word in words[1:])
    if not has_named_who and not has_proper_name:
        errors.append("title does not name the WHO (person, institution, team, or place)")
    if any(word in GENERIC_TITLE_NOUNS for word in folded_words):
        # Generic nouns are acceptable only when attached to a named/concrete
        # subject; a title made from the generic noun plus vague filler fails.
        concrete = any(_contains(folded, marker) for marker in TITLE_STAKE_MARKERS)
        named = any(_contains(folded, marker) for marker in GLOBAL_RELEVANCE_MARKERS | SPORT_MARKERS | SHOWBIZ_MARKERS)
        if not concrete and not named:
            errors.append("title uses a banned standalone generic noun")
    if category in {"Kosovë", "Shqipëri"}:
        first_three = fold(" ".join(words[:3]))
        local_markers = {"kosove", "kosova", "kosove", "shqiperi", "shqiperia"}
        cities = KOSOVO_CITIES if category == "Kosovë" else ALBANIA_CITIES
        local_markers.update(alias for _, aliases in cities for alias in aliases)
        if not any(_contains(first_three, marker) for marker in local_markers):
            errors.append(f"{category} title must front-load Kosovo/Albania or a city in its first three words")
    if not any(_contains(folded, marker) for marker in TITLE_STAKE_MARKERS) and not re.search(r"\d", title):
        errors.append("title does not name a concrete stake or verifiable action")
    return errors


def corroboration_urls(article: dict[str, Any]) -> list[str]:
    raw = article.get("corroborating_sources")
    if raw is None:
        raw = article.get("secondary_sources")
    if raw is None:
        raw = article.get("corroboration_urls")
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    urls: list[str] = []
    for item in raw:
        value = item.get("url") if isinstance(item, dict) else item
        if isinstance(value, str) and canonical_url(value):
            urls.append(canonical_url(value))
    return urls


def independent_source_error(article: dict[str, Any]) -> str | None:
    primary = canonical_url(article.get("url"))
    if not primary:
        return "primary source URL is invalid"
    secondary = corroboration_urls(article)
    if not secondary:
        return "article needs at least one independently verifiable corroborating source URL"
    primary_host = hostname(primary)
    independent = [url for url in secondary if hostname(url) and hostname(url) != primary_host]
    if not independent:
        return "corroborating source is not independent of the primary publisher"
    return None


def article_errors(article: dict[str, Any]) -> list[str]:
    category = canonical_category(article.get("category"))
    text = _article_text(article)
    errors: list[str] = []
    if category not in CANONICAL_CATEGORIES:
        errors.append(f"unknown editorial lane: {article.get('category')!r}")
    errors.extend(title_errors({**article, "category": category}))
    source_error = source_policy_error(category, article.get("source"), article.get("url"))
    if source_error:
        errors.append(source_error)
    corroboration_error = independent_source_error(article)
    if corroboration_error:
        errors.append(corroboration_error)
    breakdown = article.get("score_breakdown")
    if isinstance(breakdown, dict):
        try:
            if float(breakdown.get("relevance", 0)) < 6:
                errors.append("Prishtina relevance score is below 6")
        except (TypeError, ValueError):
            errors.append("relevance score is not numeric")

    for label, pattern in HARD_BANNED_PATTERNS:
        if pattern.search(text):
            errors.append(f"banned topic: {label}")
    if category == "Sport":
        if WOMEN_SPORT_PATTERN.search(text):
            errors.append("women's sports are banned")
        if LOW_VALUE_SPORT_PATTERN.search(text) and not any(_contains(text, marker) for marker in KOSOVO_SPORT_INTEREST_MARKERS):
            errors.append("youth/lower-league/friendly sports without Kosovar interest are banned")
        if not any(_contains(text, marker) for marker in SPORT_MARKERS):
            errors.append("Sport story fails the Kosovo/major-league/major-player relevance rule")
    elif category == "Botë":
        if not any(_contains(text, marker) for marker in GLOBAL_RELEVANCE_MARKERS):
            errors.append("Botë story lacks a Kosovo/Balkans/diaspora/EU/US angle")
    elif category == "Showbiz":
        if not any(_contains(text, marker) for marker in SHOWBIZ_MARKERS):
            errors.append("Showbiz story is not recognizable to the Pristina audience")

    if category in {"Kosovë", "Shqipëri"}:
        expected_city = infer_city(category, article.get("title"), article.get("body"))
        actual_city = str(article.get("city") or "").strip()
        if not actual_city:
            errors.append(f"{category} article is missing city")
        elif actual_city != expected_city:
            errors.append(f"city {actual_city!r} does not match deterministic inference {expected_city!r}")
    return errors


def validate_run(articles: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    if len(articles) < MIN_TOTAL_ARTICLES:
        errors.append(f"run contains {len(articles)} articles; Topic Selection v2 requires at least {MIN_TOTAL_ARTICLES}")
    if len(articles) > MAX_TOTAL_ARTICLES:
        errors.append(f"run contains {len(articles)} articles; Topic Selection v2 caps the run at {MAX_TOTAL_ARTICLES}")
    counts = Counter(canonical_category(article.get("category")) for article in articles)
    for category, quota in LANE_QUOTAS.items():
        count = counts.get(category, 0)
        if count < quota["min"]:
            errors.append(f"{category} quota is {count}; minimum is {quota['min']}")
        if "max" in quota and count > quota["max"]:
            errors.append(f"{category} quota is {count}; maximum is {quota['max']}")
    for index, article in enumerate(articles, 1):
        for error in article_errors(article):
            errors.append(f"article {index}: {error}")
    return errors


__all__ = [
    "ALBANIA_CITIES",
    "CANONICAL_CATEGORIES",
    "KOSOVO_CITIES",
    "LANE_QUOTAS",
    "MAX_TOTAL_ARTICLES",
    "MIN_TOTAL_ARTICLES",
    "article_errors",
    "canonical_category",
    "corroboration_urls",
    "independent_source_error",
    "infer_city",
    "source_policy_error",
    "title_errors",
    "validate_run",
]
