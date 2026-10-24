"""Today's photos from the official press pages of the institutions in the news.

Free-licence photos of this week's events barely exist (18 Oct: 2 articles in
six runs), while Kosovo and Albanian media illustrate the day's news with the
press photos institutions publish for exactly that. Lind chose to do the same:
only the feeds below, each the institution's own site, photos credited to it
and taken down on request. Never a news outlet's or an agency's photo.

Kosovo's government and Assembly and Albania's government and president sit
behind bot checks or publish no feed (probed 18 Oct); add them here when a
feed opens.
"""
from __future__ import annotations

import concurrent.futures
import html
import re
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlsplit, unquote

import requests

from editorial_rules_v2 import fold

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; 383NewsPhotoResearch/1.0; +https://383ks.com)"}
MAX_AGE = timedelta(days=2)
LICENSE = "Foto zyrtare për media"
# Where an institution keeps its photos when not on its own site.
IMAGE_SITES = {"Qeveria e Mbretërisë së Bashkuar": {"service.gov.uk"},
               "Google": {"googleapis.com", "googleusercontent.com"}, "OpenAI": {"ctfassets.net"}}
# url -> (credit shown under the photo, feed kind)
FEEDS = {
    "https://president-ksgov.net/feed/": ("Presidenca e Kosovës", "rss"),
    "https://www.kosovopolice.com/feed/": ("Policia e Kosovës", "rss"),
    "https://mfa-ks.net/feed/": ("Ministria e Punëve të Jashtme e Kosovës", "rss"),
    "https://www.asp.gov.al/feed/": ("Policia e Shtetit", "rss"),
    "https://pd.al/feed/": ("Partia Demokratike e Shqipërisë", "rss"),
    "https://fshf.org/wp-json/wp/v2/posts?per_page=20&_embed=wp:featuredmedia": ("FSHF", "wp"),
    "https://www.gov.uk/search/news-and-communications.atom": ("Qeveria e Mbretërisë së Bashkuar", "atom"),
    "https://ec.europa.eu/commission/presscorner/api/rss": ("Komisioni Evropian", "rss"),
    "https://www.consilium.europa.eu/en/rss/pressreleases.ashx": ("Këshilli i BE-së", "rss"),
    "http://en.kremlin.ru/events/president/news/feed": ("Kremlini", "atom"),
    "https://www.apple.com/newsroom/rss-feed.rss": ("Apple", "atom"),
    "https://blog.google/rss/": ("Google", "rss"),
    "https://openai.com/news/rss.xml": ("OpenAI", "rss"),
}
NS = {"atom": "http://www.w3.org/2005/Atom", "media": "http://search.yahoo.com/mrss/",
      "content": "http://purl.org/rss/1.0/modules/content/"}
OG_IMAGE = re.compile(r"""<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)""", re.I)
OG_IMAGE_REVERSED = re.compile(r"""<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']""", re.I)
FIRST_IMG = re.compile(r"""<img[^>]+src=["']([^"']+)""", re.I)
_ITEMS: list[dict] | None = None
_LOCK = threading.Lock()


def site(url: str) -> str:
    """The registrable part of a host: 'www.kosovopolice.com' -> 'kosovopolice.com'."""
    host = (urlsplit(url).hostname or "").lower()
    parts = host.split(".")
    return ".".join(parts[-3:] if len(parts) > 2 and len(parts[-2]) <= 3 else parts[-2:])


def _when(text: str):
    text = (text or "").strip()
    try:
        return parsedate_to_datetime(text).astimezone(timezone.utc)
    except (TypeError, ValueError, IndexError):
        pass
    try:
        when = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return when if when.tzinfo else when.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _text(value: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value or "")).split())


def _first(node, *paths):
    # An element without children is falsy, so `find(a) or find(b)` would skip it.
    for path in paths:
        found = node.find(path, NS)
        if found is not None:
            return found
    return None


def parse_feed(payload: bytes, kind: str) -> list[dict]:
    """Items as {title, link, when, summary, image}; image may be ''."""
    items = []
    if kind == "wp":
        import json
        for post in json.loads(payload):
            media = (post.get("_embedded", {}).get("wp:featuredmedia") or [{}])[0]
            items.append({"title": _text(post.get("title", {}).get("rendered", "")), "link": post.get("link", ""),
                          "when": _when(post.get("date_gmt", "") + "Z" if post.get("date_gmt") else post.get("date", "")),
                          "summary": _text(post.get("excerpt", {}).get("rendered", "")),
                          "image": media.get("source_url", "") if isinstance(media, dict) else ""})
        return items
    root = ET.fromstring(payload)
    if kind == "atom":
        for entry in root.findall("atom:entry", NS):
            link = next((node.get("href", "") for node in entry.findall("atom:link", NS)
                         if node.get("rel", "alternate") == "alternate"), "")
            body = entry.findtext("atom:content", default="", namespaces=NS) or entry.findtext("atom:summary", default="", namespaces=NS)
            media = _first(entry, "media:content", "media:thumbnail")
            image = media.get("url", "") if media is not None else (FIRST_IMG.search(body).group(1) if FIRST_IMG.search(body) else "")
            items.append({"title": _text(entry.findtext("atom:title", default="", namespaces=NS)), "link": link,
                          "when": _when(entry.findtext("atom:published", default="", namespaces=NS)
                                        or entry.findtext("atom:updated", default="", namespaces=NS)),
                          "summary": _text(body)[:600], "image": urljoin(link, image) if image else ""})
        return items
    for item in root.iter("item"):
        link = (item.findtext("link") or "").strip()
        body = item.findtext("content:encoded", default="", namespaces=NS) or item.findtext("description") or ""
        enclosure = item.find("enclosure")
        media = _first(item, "media:content", "media:thumbnail")
        image = ((media.get("url", "") if media is not None else "")
                 or (enclosure.get("url", "") if enclosure is not None and enclosure.get("type", "image").startswith("image") else "")
                 or (FIRST_IMG.search(body).group(1) if FIRST_IMG.search(body) else ""))
        items.append({"title": _text(item.findtext("title") or ""), "link": link, "when": _when(item.findtext("pubDate") or ""),
                      "summary": _text(body)[:600], "image": urljoin(link, image) if image else ""})
    return items


def page_image(link: str) -> str:
    """The press page's own share image (og:image), or ''."""
    try:
        response = requests.get(link, headers=HEADERS, timeout=12)
        response.raise_for_status()
    except requests.RequestException:
        return ""
    if site(response.url) != site(link):  # redirected off the institution's site
        return ""
    head = response.text[:200_000]
    found = OG_IMAGE.search(head) or OG_IMAGE_REVERSED.search(head)
    return urljoin(link, html.unescape(found.group(1))) if found else ""


def stock_image(url: str, when: datetime) -> bool:
    """A file the site uploaded long before the post: its logo or a stock
    portrait reused as the post's image ('.../uploads/2025/07/DREJTORIA...'
    on an October 2026 police post), not a photo of the event."""
    found = re.search(r"/(20\d\d)/(\d\d)/", urlsplit(url).path)
    if not found:
        return False
    uploaded = datetime(int(found.group(1)), int(found.group(2)), 1, tzinfo=timezone.utc)
    return when - uploaded > timedelta(days=62)


def press_items() -> list[dict]:
    """Every feed's items of the last two days with an image hosted by the
    institution itself, fetched once per run."""
    global _ITEMS
    with _LOCK:
        if _ITEMS is not None:
            return _ITEMS
        now = datetime.now(timezone.utc)
        def fetch(url: str) -> list[dict]:
            credit, kind = FEEDS[url]
            try:
                response = requests.get(url, headers=HEADERS, timeout=15)
                response.raise_for_status()
                items = parse_feed(response.content, kind)
            except (requests.RequestException, ET.ParseError, ValueError):
                return []
            secure = lambda link: re.sub(r"^http://", "https://", link or "")
            recent = [dict(item, credit=credit, feed=url, link=secure(item["link"]), image=secure(item["image"]))
                      for item in items if item["when"] and timedelta(0) <= now - item["when"] <= MAX_AGE
                      and item["title"] and site(item["link"]) == site(url)][:10]
            missing = [item for item in recent if not item["image"]]
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pages:
                for item, image in zip(missing, pages.map(lambda item: page_image(item["link"]), missing)):
                    item["image"] = secure(image)
            # The institution's own photo: hosted on its site or its own photo
            # host, never an embedded agency or outlet image.
            allowed = {site(url)} | IMAGE_SITES.get(credit, set())
            return [item for item in recent if item["image"].startswith("https://") and site(item["image"]) in allowed
                    and not stock_image(item["image"], item["when"])]
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(FEEDS)) as pool:
            _ITEMS = [item for items in pool.map(fetch, FEEDS) for item in items]
        print(f"383 PRESS PHOTOS recent={len(_ITEMS)} from {len(FEEDS)} official press feeds")
        return _ITEMS


def _words(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9]+", fold(text)) if len(word) >= 5}


def non_photographic_press_image(url: str) -> bool:
    """Known graphic filenames remain graphics even on an official press feed.

    Visually checked 24 Oct: FSHF's kategoria-e-pare-java-7-web.jpeg is a
    results table with crests, not a photograph of any of the matches.
    """
    name = unquote(urlsplit(url).path.rsplit("/", 1)[-1]).casefold().replace("_", "-")
    return bool(re.search(r"(?:^|-)(?:logo|infographic|infografik\w*|scoreboard|poster|fixture\w*|"
                          r"match-results|results-table)(?:-|\.)", name)
                or re.search(r"(?:kategoria-e-pare|abissnet-superiore)-java-\d+-web(?:-|\.)", name))


def press_options(lead: dict) -> list[dict]:
    """Official press photos of the last two days about this story: the
    headline's main name plus words about the event, or three shared words
    about the event. Newest first; nothing downloaded."""
    from news_image_policy import plain, story_names
    from news_video_policy import phrase_in
    if time.monotonic() >= lead.get("_photo_deadline", float("inf")):
        return []
    title = plain(lead.get("title"))
    names = story_names(title, plain(lead.get("primary_evidence", {}).get("text", ""))[:1800])
    name = names[0] if names else ""
    event = _words(title) - _words(name)
    options = []
    for item in press_items():
        if non_photographic_press_image(item["image"]):
            continue
        text = f"{item['title']} {item['summary']}"
        shared = len(event & _words(text))
        # Press pages often give only the surname ('Presidentja Osmani pret...'):
        # then two shared event words are needed, with the full name one.
        full = " " in name and phrase_in(name, text)
        surname = bool(name) and phrase_in(name.split()[-1], text)
        if not ((full and shared >= 1) or (surname and shared >= 2) or shared >= 3):
            continue
        subject = name or item["credit"]
        options.append({"tier": "press", "taken": item["when"].date().isoformat(),
                        "page": {"title": item["title"], "imageinfo": [{"extmetadata": {
                            "ImageDescription": {"value": item["summary"][:240]},
                            "DateTimeOriginal": {"value": item["when"].date().isoformat()}}}]},
                        "photo": {"image_url": item["image"], "image_subject": subject,
                                  "image_caption": subject,  # the page adds "Foto: <credit>"
                                  "image_rights": {"provider": "official-press", "source_page": item["link"],
                                                   "creator": item["credit"], "license": LICENSE, "license_url": "",
                                                   "description": f"{item['title']} {item['summary']}"[:1200],
                                                   "subject_evidence": subject,
                                                   "verified_at": datetime.now(timezone.utc).isoformat()}}})
    return sorted(options, key=lambda option: option["taken"], reverse=True)
