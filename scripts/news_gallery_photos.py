"""Same-day photos from official institutions' own Flickr streams.

Commons rarely has a free photo of today's event, so today's news went out with
photos from years back (owner, 2026-10-17). Governments, parliaments and space
agencies post this day's photos on Flickr under free licences. Only the streams
listed here are read, and every photo's own licence is checked: a stream that
is mostly free still carries third-party or editorial-only uploads.
"""
from __future__ import annotations

import concurrent.futures
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

from editorial_rules_v2 import fold
from news_image_policy import HEADERS, LICENSES, context_terms, plain

FLICKR_API = "https://www.flickr.com/services/rest/"
KEY_FILE = Path("/opt/data/news-pipeline-hermes/flickr.key")
# "Today's events": uploaded and taken in the last two days.
GALLERY_DAYS = 2
# Official streams, by Flickr path alias. An alias that does not resolve is
# skipped and logged; it never widens the search to other accounts.
ACCOUNTS = {
    "whitehouse": "The White House",
    "statephotos": "U.S. Department of State",
    "number10gov": "UK Prime Minister's Office",
    "europeanparliament": "European Parliament",
    "nato": "NATO",
    "nasahqphoto": "NASA HQ",
    "europeanspaceagency": "European Space Agency",
}
# Flickr licence ids -> the licence names 383 accepts. 1-3 and 6 are NC or ND;
# 7 ("no known copyright restrictions") is a museum's statement, not a licence.
FLICKR_LICENSES = {"4": "CC BY 2.0", "5": "CC BY-SA 2.0", "8": "Public domain", "9": "CC0",
                   "10": "Public domain", "11": "CC BY 4.0", "12": "CC BY-SA 4.0"}
SIZES = ("url_k", "url_h", "url_l")
_STREAMS: dict[str, list[dict]] | None = None
_LOCK = threading.Lock()


def api_key() -> str:
    if os.environ.get("L383_FLICKR_KEY"):
        return os.environ["L383_FLICKR_KEY"].strip()
    try:
        return KEY_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def _call(method: str, **params) -> dict:
    response = requests.get(FLICKR_API, params={"method": method, "api_key": api_key(), "format": "json",
                                                "nojsoncallback": 1, **params}, headers=HEADERS, timeout=15)
    response.raise_for_status()
    data = response.json()
    if data.get("stat") != "ok":
        raise ValueError(data.get("message", "Flickr error"))
    return data


def streams() -> dict[str, list[dict]]:
    """Each official stream's free-licensed photos of the last two days,
    fetched once per run. Empty without a key or when Flickr is down."""
    global _STREAMS
    with _LOCK:
        if _STREAMS is not None:
            return _STREAMS
        _STREAMS = {}
        if not api_key():
            print("383 GALLERY PHOTOS skipped: no Flickr key")
            return _STREAMS
        since = int((datetime.now(timezone.utc) - timedelta(days=GALLERY_DAYS)).timestamp())
        def fetch(alias: str) -> list[dict]:
            user = _call("flickr.urls.lookupUser", url=f"https://www.flickr.com/photos/{alias}/")["user"]["id"]
            return _call("flickr.people.getPhotos", user_id=user, min_upload_date=since, per_page=200,
                         extras="license,date_taken,date_upload,description,tags,owner_name,path_alias,"
                                + ",".join(SIZES))["photos"]["photo"]
        missing = []
        # All streams at once: one slow stream must not hold up the photo search.
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(ACCOUNTS)) as pool:
            for (alias, institution), future in zip(ACCOUNTS.items(), [pool.submit(fetch, alias) for alias in ACCOUNTS]):
                try:
                    photos = future.result()
                except (requests.RequestException, ValueError, KeyError) as exc:
                    missing.append(f"{alias} ({type(exc).__name__})")
                    continue
                _STREAMS[alias] = [dict(photo, institution=institution) for photo in photos
                                   if str(photo.get("license")) in FLICKR_LICENSES]
        print(f"383 GALLERY PHOTOS streams={len(_STREAMS)} photos={sum(map(len, _STREAMS.values()))}"
              + (f" unavailable={', '.join(missing)}" if missing else ""))
        return _STREAMS


def taken(photo: dict):
    try:
        return datetime.strptime(str(photo.get("datetaken", ""))[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _words(text: str) -> str:
    return " " + " ".join(re.findall(r"[a-z0-9]+", fold(text))) + " "


def gallery_options(lead: dict) -> list[dict]:
    """Official photos taken in the last two days that name the story's person
    or thing as a whole phrase, or, for a one-word subject, also share two of
    the story's other words. Newest first; nothing is downloaded here."""
    plan = lead.get("photo_plan")
    if not plan or not plan.get("subject"):
        return []
    phrase = " ".join(re.findall(r"[a-z0-9]+", fold(plan["subject"])))
    if not phrase:
        return []
    terms = context_terms(lead, plan)
    today = datetime.now(timezone.utc).date()
    found = []
    for alias, photos in streams().items():
        for photo in photos:
            day = taken(photo)
            url = next((photo[size] for size in SIZES if photo.get(size)), "")
            if not day or not 0 <= (today - day).days <= GALLERY_DAYS or not url.startswith("https://live.staticflickr.com/"):
                continue
            description = plain(photo.get("description", {}).get("_content", ""))
            text = _words(f"{photo.get('title', '')} {description}")
            tags = set(str(photo.get("tags", "")).split())
            named = f" {phrase} " in text or phrase.replace(" ", "") in tags
            shared = sum(any(word.startswith(term[:5]) for word in text.split()) for term in terms)
            if not named or (" " not in phrase and shared < 2):
                continue
            license_name = FLICKR_LICENSES[str(photo["license"])]
            creator = plain(photo.get("ownername")) or photo["institution"]
            page = f"https://www.flickr.com/photos/{photo.get('pathalias') or alias}/{photo['id']}/"
            found.append({"tier": "fresh", "taken": day.isoformat(), "page": {"title": plain(photo.get("title", "")),
                          "imageinfo": [{"extmetadata": {"ImageDescription": {"value": description},
                                                         "DateTimeOriginal": {"value": day.isoformat()}}}]},
                          "photo": {"image_url": url, "image_subject": plan["subject"],
                                    "image_caption": plan.get("caption") or plan["subject"],
                                    "image_rights": {"provider": "flickr-official", "source_page": page,
                                                     "creator": creator, "license": license_name,
                                                     "license_url": LICENSES[license_name],
                                                     "description": f"{plain(photo.get('title', ''))} {description}"[:1200],
                                                     "subject_evidence": plan.get("subject_evidence", plan["subject"]),
                                                     "verified_at": datetime.now(timezone.utc).isoformat()}}})
    return sorted(found, key=lambda option: option["taken"], reverse=True)
