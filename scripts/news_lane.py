"""Deterministic sports-lane guard shared by discovery and editorial checks.

The source's country is not the article's subject: a Kosovo publisher can
publish football, boxing, and other sports stories that belong only in Sport.
Keep this deliberately title-led; a traffic notice mentioning a match is not
itself sports reporting.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from urllib.parse import urlparse


def _fold(value: object) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or "")).casefold()
    return "".join(char for char in normalized if not unicodedata.combining(char))


_SPORT_TAGS = {
    "sport", "sports", "futboll", "football", "basketboll", "basketball",
    "boks", "boxing", "tenis", "tennis", "olimpiade", "formula 1", "f1",
}
_SPORT_URL_SEGMENT = re.compile(
    r"(?:^|/)(?:sport|sports|futboll|football|basketboll|basketball|boxing|boks|tenis|formula-1)(?:/|$)"
)
_SPORT_TITLE = re.compile(
    r"\b(?:futboll\w*|basketboll\w*|boks\w*|ndeshj\w*|gol(?:a|in|at|it|ave)?|"
    r"asistim\w*|penallti\w*|kampionat\w*|turne\w*|medalj\w*|bronzin|"
    r"cerekfinal\w*|gjysmefinal\w*|finalen|skuadr\w*|lojtar\w*|trajner\w*|"
    r"perzgjedhes\w*|liga e kombeve|nations league|champions league|"
    r"premier league|euroliga|uefa|fifa|nba|grand prix|kualifikim\w* ne boteror)\b"
)
_SPORT_PERSON_OR_TEAM = re.compile(
    r"\b(?:mbappe|muriqi|rashica|zhegrova|franco foda|donjeta sadiku|"
    r"man(?:chester)? city|real madrid|barcelona|dardanet)\b"
)
_SPORT_CONTEXT = re.compile(
    r"\b(?:futboll\w*|sport\w*|ndeshj\w*|gol\w*|skuadr\w*|lojtar\w*|"
    r"trajner\w*|perzgjedhes\w*|kombetar\w*|boksi\w*|olimp\w*|"
    r"fitore\w*|stervitj\w*|premier league|1\s*[:\-]\s*0|2\s*[:\-]\s*0)\b"
)
_CIVIC_TRAFFIC_TITLE = re.compile(
    r"\b(?:rrug\w*|aks\w*|qarkullim\w*|trafik\w*|parkim\w*)\b"
)
_SCORE = re.compile(r"\b\d{1,2}\s*[:\-]\s*\d{1,2}\b")
_MILITARY_CONTEXT = re.compile(r"\b(?:nato|kfor|ushtarak\w*|ushtri\w*|forcat e armatosura)\b")


def is_sports_story(
    title: object,
    summary: object = "",
    *,
    tags: Iterable[object] = (),
    url: object = "",
) -> bool:
    """Return true for a sports *story*, not incidental sports mentions."""
    headline = _fold(title)
    context = _fold(summary)
    if not headline:
        return False
    if _CIVIC_TRAFFIC_TITLE.search(headline):
        return False
    if any(_fold(tag) in _SPORT_TAGS for tag in tags):
        return True
    path = _fold(urlparse(str(url or "")).path)
    if _SPORT_URL_SEGMENT.search(path):
        return True
    if _SPORT_TITLE.search(headline) or _SCORE.search(headline):
        return True
    if _SPORT_PERSON_OR_TEAM.search(headline) and _SPORT_CONTEXT.search(context):
        return True
    if re.search(r"\b(?:stervitj\w*|fitore ndaj|fitorj\w* ndaj|duel\w*|debuton|demtim\w*)\b", headline):
        if _MILITARY_CONTEXT.search(headline):
            return False
        return bool(_SPORT_CONTEXT.search(context))
    return False


def classify_lane(
    source_lane: str,
    title: object,
    summary: object = "",
    *,
    tags: Iterable[object] = (),
    url: object = "",
) -> str:
    return "Sport" if is_sports_story(title, summary, tags=tags, url=url) else source_lane
