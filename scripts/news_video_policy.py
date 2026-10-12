"""Official YouTube videos for stories no licensed photo can illustrate.

Free and keyless: every channel publishes an RSS feed of its latest uploads,
and YouTube's oEmbed endpoint says whether a video may be embedded. Only the
official channels below are watched (governments, institutions, leagues,
clubs, companies), never news outlets, so the visual is the subject's own and
from the last few days. The article embeds the player (allowed by YouTube's
terms); the video's own thumbnail is its poster on cards.
"""
from __future__ import annotations

import concurrent.futures
import re
import threading
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import requests

from editorial_rules_v2 import fold

HEADERS = {"User-Agent": "383NewsVideoResearch/1.0 (https://383ks.com; editorial video selection)"}
MAX_AGE = timedelta(days=3)

# Official channels only (resolved from their @handles, 2026-10-13).
CHANNELS = {
    "UCYxRlFDqcWM4y7FfpiAN3KQ": "The White House",
    "UCHlEaKbepQ_S9iIoZPKVQew": "NATO",
    "UCMPaviJxybo1RTdzvYcU91A": "European Commission",
    "UCvU4p_w08osQsrNi_I4ZtDA": "European Parliament",
    "UC5O114-PQNYkurlTg6hekZw": "United Nations",
    "UClqnG2M4VkvtervvU8LnErQ": "Zelenskyy Official",
    "UC8o7mIMg3mmO9-dx3e2iFgw": "10 Downing Street",
    "UCcnFmkINMo4Jmkx5mvlCh6g": "Bundesregierung",
    "UC4wJmdmJW6dN0OLmJL0I-mw": "Albin Kurti",
    "UC_l2qmM0mXkq5pOBEp3j2dw": "Edi Rama",
    "UCB_qr75-ydFVKSF9Dmo6izg": "Formula 1",
    "UCyGa1YEx9ST66rYrJTGIKOw": "UEFA",
    "UCpcTrCXblq78GZrTUTLWeBw": "FIFA",
    "UCG5qGWdu8nIRZqJ_GgDwQ-w": "Premier League",
    "UCTv-XvfzLX3i4IGWAm4sbmA": "LALIGA",
    "UCBJeMCIeLQos7wacox4hmLQ": "Serie A",
    "UC6UL29enLNe4mqwTfAyeNuw": "Bundesliga",
    "UCWJ2lWNubArHWmf3FIHbfcQ": "NBA",
    "UCDVYQ4Zhbm3S2dlz7P1GBDg": "NFL",
    "UCY_5h5zaSwN7Or4kIJDYNXA": "ATP Tour",
    "UCaBIVVpHjq6j3tSyxwTE-8Q": "WTA",
    "UCWV3obpZVGgJ3j9FVhEjF2Q": "Real Madrid",
    "UC14UlmYlSNiQCBe9Eookf_A": "FC Barcelona",
    "UCkzCjdRMrW2vXLx8mvPVLdQ": "Man City",
    "UC9LQwHZoucFT94I2h6JOcjw": "Liverpool FC",
    "UCpryVRk_VDudG8SHXgWcG0w": "Arsenal",
    "UC6yW44UGJJBvYTlfC7CRg2Q": "Manchester United",
    "UCU2PacFf99vhb3hNiYDmxww": "Chelsea FC",
    "UCZkcxFIsqW5htimoUQKA0iA": "FC Bayern München",
    "UCLzKhsxrExAC6yAdtZ-BOWw": "Juventus",
    "UCvXzEblUa0cfny4HAJ_ZOWw": "Inter",
    "UCKcx1uK38H4AOkmfv4ywlrg": "AC Milan",
    "UCt9a_qP9CqHCNwilf-iULag": "Paris Saint-Germain",
    "UCE_M8A5yxnLfW0KghEeajjw": "Apple",
    "UCK8sQmJBp8GCxrOtXWBpyEA": "Google",
    "UCFtEEv80fQVKkD4h1PF-Xqw": "Microsoft",
    "UCWwgaK7x0_FR1goeSRazfsQ": "Samsung",
    "UCXZCJLdBC09xxGZ6gcdrc6A": "OpenAI",
    "UC5WjFrtBdufl6CZojX3D8dQ": "Tesla",
    "UCLA_DiR1FfKNvjuUpBHmylQ": "NASA",
    "UCtI0Hodo5o5dUb67FeUjDeA": "SpaceX",
    "UC04FyDIvYXNecpbG8gyOw4A": "Meta",
    "UCIYhr3JsLYfKkCM7-W5B6DA": "IMF",
    "UCAzhpt9DmG6PnHXjmJTvRGQ": "Federal Reserve",
}
NS = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}

_FEED_LOCK = threading.Lock()
_FEED: list[dict] | None = None


def channel_videos(channel_id: str, now: datetime) -> list[dict]:
    """Uploads from the last MAX_AGE; [] when the feed is unavailable."""
    try:
        response = requests.get("https://www.youtube.com/feeds/videos.xml", params={"channel_id": channel_id},
                                headers=HEADERS, timeout=10)
        response.raise_for_status()
        root = ET.fromstring(response.content)
    except (requests.RequestException, ET.ParseError):
        return []
    videos = []
    for entry in root.findall("atom:entry", NS):
        video_id = entry.findtext("yt:videoId", default="", namespaces=NS)
        title = entry.findtext("atom:title", default="", namespaces=NS)
        published = entry.findtext("atom:published", default="", namespaces=NS)
        try:
            when = datetime.fromisoformat(published.replace("Z", "+00:00"))
        except ValueError:
            continue
        if re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id) and title and now - when <= MAX_AGE:
            videos.append({"video_id": video_id, "title": title, "published": when.isoformat(),
                           "channel_id": channel_id, "channel": CHANNELS[channel_id]})
    return videos


def recent_videos() -> list[dict]:
    """Every watched channel's recent uploads, fetched once per run."""
    global _FEED
    with _FEED_LOCK:
        if _FEED is None:
            now = datetime.now(timezone.utc)
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                _FEED = [video for videos in pool.map(lambda cid: channel_videos(cid, now), CHANNELS) for video in videos]
            print(f"383 VIDEO FEEDS recent={len(_FEED)} from {len(CHANNELS)} official channels")
        return _FEED


def phrase_in(name: str, text: str) -> bool:
    words = " ".join(re.findall(r"[a-z0-9]+", fold(name)))
    return bool(words) and f" {words} " in " " + " ".join(re.findall(r"[a-z0-9]+", fold(text))) + " "


def embeddable(video_id: str) -> bool:
    try:
        return requests.get("https://www.youtube.com/oembed", headers=HEADERS, timeout=10, params={
            "url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"}).status_code == 200
    except requests.RequestException:
        return False


def select_video(lead: dict) -> dict:
    """The newest embeddable official video whose title names the story's
    person (or, for a multi-word name, its organisation or event)."""
    from news_image_policy import plain, story_names
    import time
    if time.monotonic() >= lead.get("_photo_deadline", float("inf")):
        return {}
    title = plain(lead.get("title"))
    names = story_names(title, plain(lead.get("primary_evidence", {}).get("text", ""))[:1800])
    # Only the headline's main subject, as a full name: single words matched
    # 'Shqipëri' to an Edi Rama podcast and 'Trump' to a Bill Gates story.
    if not names or " " not in names[0]:
        return {}
    name = names[0]
    name_tokens = set(re.findall(r"[a-z0-9]+", fold(name)))
    event_tokens = {token for token in re.findall(r"[a-z0-9]+", fold(title)) if len(token) >= 5} - name_tokens
    def same_event(video_title: str) -> bool:
        # The video must also share a word about the event itself
        # ('Singapore' for Verstappen's Singapore win), not just the person.
        return bool(event_tokens & set(re.findall(r"[a-z0-9]+", fold(video_title))))
    matches = [(video, name) for video in recent_videos() if phrase_in(name, video["title"]) and same_event(video["title"])]
    matches.sort(key=lambda pair: -datetime.fromisoformat(pair[0]["published"]).timestamp())
    for video, name in matches:
        if not embeddable(video["video_id"]):
            continue
        thumbnail = f"https://i.ytimg.com/vi/{video['video_id']}/maxresdefault.jpg"
        try:
            from news_image_policy import photo_fingerprint
            width, height, digest, _ = photo_fingerprint(thumbnail)
        except Exception:
            continue
        if width < 1200 or height < 630:
            continue
        reserve = lead.get("_reserve_photo")
        if reserve and not reserve(thumbnail):
            continue
        watch = f"https://www.youtube.com/watch?v={video['video_id']}"
        return {"image_url": thumbnail, "image_width": width, "image_height": height,
                "image_subject": name, "image_caption": f"{name}: video nga kanali zyrtar {video['channel']} në YouTube",
                "video_clip_url": watch,
                "image_rights": {"provider": "youtube-embed", "source_page": watch, "creator": video["channel"],
                                 "license": "YouTube embed", "license_url": "https://www.youtube.com/t/terms",
                                 "description": video["title"][:300], "channel_id": video["channel_id"],
                                 "published": video["published"], "sha256": digest,
                                 "verified_at": datetime.now(timezone.utc).isoformat()}}
    return {}
