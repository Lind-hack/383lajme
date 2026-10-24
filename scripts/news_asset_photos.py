"""Visually reviewed physical asset photographs for that asset's market news.

The owner approved explicitly labelled illustrations on 24 October 2026.
This is a finite inventory, not an exception for arbitrary coins or graphics.
An overwritten Commons original or changed rights/date fails closed.
"""
from __future__ import annotations

import json
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

import requests

from editorial_rules_v2 import fold

INVENTORY = Path(__file__).resolve().parents[1] / "data/news-asset-photos.json"
SUBJECTS = {"BTC": "Bitcoin", "ETH": "Ethereum", "EUR": "Euro"}
_LOCK = threading.Lock()
_PAGES: tuple[float, list[dict]] = (0, [])
MARKET = re.compile(r"\b(?:prices?|markets?|trading|rall(?:y|ies)|surges?|falls?|fell|rises?|rose|drops?|"
                    r"gains?|losses?|inflows?|outflows?|etfs?|exchanges?|kurs\w*|cmim\w*|treg\w*|"
                    r"rrit\w*|ngrit\w*|renie\w*|bie|humb\w*|fitim\w*|investitor\w*|fluks\w*)\b")


def market_asset(article: dict) -> str | None:
    if fold(str(article.get("category", ""))) != "ekonomi":
        return None
    title = fold(str(article.get("title", "")))
    if not MARKET.search(title):
        return None
    # Forks, software releases and breaches need their own documentary photo.
    if re.search(r"\b(?:bitcoin\s+(?:cash|sv|core)|ethereum\s+classic|hack\w*|breach\w*|"
                 r"vulnerab\w*|security|siguri\w*|update\w*|perdites\w*|stocks?|shares?|aksion\w*|miners?|"
                 r"kompani\w*|companies|company|firms?)\b", title):
        return None
    found = []
    for code, pattern in (("BTC", r"\b(?:bitcoin(?:i|it|in)?|btc)\b"),
                          ("ETH", r"\b(?:ethereum(?:i|it|in)?|ether|eth)\b"),
                          ("EUR", r"\b(?:euro(?:ja|s|n)?|eur)\b")):
        if re.search(pattern, title):
            found.append(code)
    # A comparison of different assets cannot silently get just one symbol.
    if len(found) != 1:
        return None
    code = found[0]
    if code in {"BTC", "ETH"} and not re.search(
            r"\b" + SUBJECTS[code].lower() + r"(?:i|it|in)?\b", title):
        evidence = " ".join(str(article.get(key, "")) for key in ("body", "text"))
        evidence += " " + str(article.get("primary_evidence", {}).get("text", ""))
        if not re.search(r"\b" + SUBJECTS[code].lower() + r"\b", fold(evidence)):
            return None  # Ambiguous tickers need the full asset name in evidence.
    if found[0] == "EUR" and not re.search(
            r"\b(?:kurs\w*|exchange|currency|forex|kundrejt|dollar\w*|sterlin\w*|yen|frang\w*)\b", title):
        return None  # A project's euro cost is not news about the euro.
    return found[0]


def inventory() -> dict:
    return json.loads(INVENTORY.read_text(encoding="utf-8"))


def caption(entry: dict) -> str:
    from news_image_policy import ARCHIVE_MONTHS
    taken = datetime.fromisoformat(entry["taken"])
    subject = ("para euro" if entry["asset"] == "EUR" else
               f"token fizik me simbolin e {SUBJECTS[entry['asset']]}")
    return f"Foto ilustruese ({ARCHIVE_MONTHS[taken.month - 1]} {taken.year}): {subject}."


def curated_page(page: dict, code: str) -> dict | None:
    """Bind visual review to unchanged original bytes and current metadata."""
    from news_image_policy import plain, taken_date
    entry = next((row for row in inventory()["photos"]
                  if row["asset"] == code and row["title"] == page.get("title")), None)
    if not entry:
        return None
    info = next(iter(page.get("imageinfo", [])), {})
    meta = info.get("extmetadata", {})
    value = lambda key: plain(meta.get(key, {}).get("value"))
    taken = taken_date({"DateTimeOriginal": meta.get("DateTimeOriginal", {})})
    now = datetime.now(timezone.utc).date()
    if (info.get("sha1") != entry["original_sha1"] or not taken
            or taken.isoformat() != entry["taken"]
            or not 0 <= (now - taken).days <= 3652
            or value("LicenseShortName") != entry["license"]
            or (value("Attribution") or value("Artist")) != entry["creator"]):
        return None
    return entry


def _current_pages() -> list[dict]:
    global _PAGES
    from news_image_policy import commons_files
    with _LOCK:
        now = time.monotonic()
        if not _PAGES[0] or now - _PAGES[0] >= 1800:
            pages = commons_files([row["title"].removeprefix("File:") for row in inventory()["photos"]])
            _PAGES = (now, pages)
        return _PAGES[1]


def asset_options(lead: dict, primary: dict, secondary: dict) -> list[dict]:
    from news_image_policy import _research, candidate_photo, image_identity
    code = market_asset(lead)
    if not code or time.monotonic() >= lead.get("_photo_deadline", float("inf")):
        return []
    # The normal source-image fingerprint path still applies, including when
    # the model found no conventional subject plan. No Commons text search.
    research = _research(lead, primary, secondary,
                         {"subject": "__asset__" + code, "queries": []},
                         min(time.monotonic() + 60, lead.get("_photo_deadline", float("inf"))))
    if research is None:
        return []
    try:
        pages = _current_pages()
    except (OSError, ValueError, requests.RequestException):
        return []
    options = []
    for page in pages:
        entry = curated_page(page, code)
        if not entry:
            continue
        plan = {"kind": "asset", "asset_code": code, "subject": SUBJECTS[code],
                "subject_evidence": SUBJECTS[code], "caption": caption(entry)}
        photo = candidate_photo(page, plan, 10)
        if photo and not any(image_identity(photo["image_url"]) == image_identity(url) for url in research[0]):
            photo["image_rights"].update(asset_code=code, original_sha1=entry["original_sha1"],
                                         inventory_version=inventory()["version"])
            options.append({"tier": "asset", "page": page, "photo": photo})
    return options


def valid_asset_photo(article: dict, photo: dict) -> bool:
    rights = photo.get("image_rights", {})
    code = market_asset(article)
    entry = next((row for row in inventory()["photos"]
                  if row["asset"] == code and row["original_sha1"] == rights.get("original_sha1")), None)
    source = urlsplit(str(rights.get("source_page", "")))
    return bool(entry and rights.get("provider") == "wikimedia-commons"
                and rights.get("asset_code") == code and rights.get("photo_tier") == "asset"
                and rights.get("inventory_version") == inventory()["version"]
                and source.hostname == "commons.wikimedia.org"
                and unquote(source.path).replace("_", " ") == "/wiki/" + entry["title"]
                and rights.get("creator") == entry["creator"] and rights.get("license") == entry["license"]
                and str(rights.get("taken", ""))[:10] == entry["taken"]
                and photo.get("image_subject") == SUBJECTS[code]
                and photo.get("image_caption") == caption(entry))
