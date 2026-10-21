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
    # Added 2026-10-17 so most stories have an official video: YouTube-
    # verified, or (Balkans) a channel whose own page names it official or
    # links the institution's site. Still never news outlets.
    "UC4Xc2nL2i8Pu3PL_tljnjjg": "Kuvendi i Republikës së Kosovës",
    "UCk760jgRKgAvftBlGAQmuMA": "Vjosa Osmani",
    "UCqpmNXbs4ZQMt7FBBVmGung": "Kosovo Police",
    "UCzeT6tNab6BQ38KZvvNYyKA": "Federata e Futbollit e Kosovës",
    "UCftIBC9eGA55-o0f6tOVLpQ": "FSHF",
    "UCmLzBIWh5b2RcnwtNwT1mdA": "Komuna e Prishtinës",
    "UCsAnh_Iv_beYv8CoO1aphYQ": "KFOR",
    "UCpgAmi6MlkRO-4GDHUlHKnA": "Lëvizja Vetëvendosje",
    "UCD-ASHwNCPfd0Rgbt2cVhaQ": "Lidhja Demokratike e Kosovës",
    "UCrf9kF4uiN40wXbeq7_pehA": "Partia Demokratike e Kosovës",
    "UCLRcx-0FItBkTFR5JKvouow": "Sali Berisha",
    "UCPaeEhnVIdn4T01gUphIltw": "Élysée",
    "UC6wP9lyGnU9Znt4idvQhKLg": "Giorgia Meloni",
    "UCp8W1bzofvzB8MfZSkYW2xw": "Palazzo Chigi",
    "UCzJtDQ9b_Uq1tA5W_tMiMUQ": "La Moncloa",
    "UCiHR69jCQX8uoH-B1tX6lzg": "Recep Tayyip Erdoğan",
    "UC1NF71EwP41VdjAU1iXdLkw": "Narendra Modi",
    "UCyvEONnqE2Krm9Zi0LVvGmA": "Prime Minister of Canada",
    "UC1zjxtA66v1z64-AUNvmldA": "Mark Carney",
    "UCLPG_xkgSWeWnOhBsi-jxCA": "Council of the EU",
    "UCXB8fM4VyQubRu3UVGhd3wA": "European Central Bank",
    "UC07-dOwgza1IguKA86jqxNA": "World Health Organization",
    "UCE9mrcoX-oE-2f1BL-iPPoQ": "World Bank Group",
    "UCpuofAxlrUAgnu7QEwKQwxw": "U.S. Department of War",
    "UC6ZhpmNnLxlOYipqh8wbM3A": "U.S. Department of State",
    "UCt2FDbyyFrn_lw1gWwuBfgQ": "U.S. Department of the Treasury",
    "UCY70MMJ8Rj4wtwt7bVN6hIA": "Bank of England",
    "UCR-Ja1yBcjkhuQblxnroZJg": "OECD",
    "UCS3LJf8IInqTB0fjJeZpSFw": "World Trade Organization",
    "UCw-kH-Od73XDAt7qtH9uBYA": "World Economic Forum",
    "UCGr3nR_XH9r6E5b09ZJAT9w": "EuroLeague",
    "UC7_VGkwCoKfqh1eZEkzey3A": "Mercedes-AMG PETRONAS F1 Team",
    "UCQIyqMWCdx1GBvbw_Yi6lEA": "Oracle Red Bull Racing",
    "UCd8iY-kEHtaB8qt8MH--zGw": "Ferrari",
    "UC8dxVgZl9u5HeCOXnosCtuQ": "McLaren",
    "UC8pYaQzbBBXg9GIOHRvTmDQ": "MotoGP",
    "UCNa8NxMgSm7m4Ii9d4QGk1Q": "Wimbledon",
    "UCF3K1Jf8hjFW8qliei8fQ3A": "Roland-Garros",
    "UCXbboag48Qlr78zzz6SkzkQ": "US Open Tennis",
    "UCeTKJSW1NTAkf27nNmjWt5A": "Australian Open",
    "UCTl3QQTvqHFjurroKxexy2Q": "Olympic Games",
    "UCQk7fWv15ChjMJLCRVmtApw": "World Athletics",
    "UCKwGZZMrhNYKzucCtTPY2Nw": "PGA Tour",
    "UCvgfXK4nTYKudb0rFR6noLA": "UFC",
    "UCEg25rdRZXg32iwai6N6l0w": "Tottenham Hotspur",
    "UCywGl_BPp9QhD0uAcP2HsJw": "Newcastle United",
    "UCICNP0mvtr0prFwGUQIABfQ": "Aston Villa",
    "UCuzKFwdh7z2GHcIOX_tXgxA": "Atlético de Madrid",
    "UCK8rTVgp3-MebXkmeJcQb1Q": "Borussia Dortmund",
    "UCTnCzHi0P6MH83er5OfZbzQ": "SSC Napoli",
    "UCLttSYJ6kPtlcurY96kXkQw": "AS Roma",
    "UC8zrah5cNf2c3jKKeD_Z3fw": "Benfica",
    "UCGpf7WX7R1one-NwOvg_PbQ": "AFC Ajax",
    "UCQpeujIamj2ZOKXZnrxTRhA": "Galatasaray",
    "UCgqlho3-8a6FmDqQm7Q6gJw": "Fenerbahçe",
    "UCBN-bb-hE7jYlcp4exwXRsQ": "Celtic FC",
    "UCSMZmPVql528Cph9WPvt0GA": "Bayer 04 Leverkusen",
    "UCoKweTwEeA-D9vuSVw_Z_DQ": "Olympique de Marseille",
    "UCnJj6L93JX3Jrhzv81ayywA": "Sporting CP",
    "UCQegzQwEExHgXvm_yHptzQg": "FC Porto",
    "UCNT2e7Og56vm5_V-yJWvglA": "England",
    "UCfMo0xj-sbdzHuzxvKdu1hw": "DFB",
    "UCQsH5XtIc9hONE1BQjucM0g": "Ligue 1",
    "UCoLrcjPV5PbUrUyXq5mjc_A": "MLB",
    "UCqFMzb-4AUf6WAIbl132QKA": "NHL",
    "UCeYc_OjHs3QNxIjti2whKzg": "Golden State Warriors",
    "UC8CSt-oVqy8pUAoKSApTxQw": "Los Angeles Lakers",
    "UCO9a_ryN_l7DIDS-VIt-zmw": "WNBA",
    "UCHuiy8bXnmK5nisYHUd1J5g": "NVIDIA",
    "UCHQDjDDW8w2RieO-IuqYlyg": "AMD",
    "UCrDwWp7EBBv4NwvScIpBDOA": "Anthropic",
    "UCP7jMXSY2xbc3KCAE0MHQ-A": "Google DeepMind",
    "UCVjS9AuBloqJJjhsy3vIfug": "Sony",
    "UC-2Y8dQb0S6DtpxNgAKoJKA": "PlayStation",
    "UCjBp_7RuDBUYbd1LegWEJ8g": "Xbox",
    "UCGIY_O-8vW4rfX98KlMkvRg": "Nintendo",
    "UCH6eZr6vbZ6Bx53TyuSzxrg": "Qualcomm",
    "UCtjV1_XU6gvPYyreaFScxBQ": "Huawei",
    "UCCspJ6mFfCwOV4qFjZWi2wg": "Xiaomi",
    "UCh5Yo6HN5b2Hco70HosIzZA": "Waymo",
    "UCVxTHEKKLxNjGcvVaZindlg": "Blue Origin",
    "UCIBaDdAbGlFDeS33shmlD0A": "European Space Agency",
    "UC8cc4pVKVHG7A9fbNsRNrLQ": "IBM",
    "UCgnxoUwDmmyzeigmmcf0hZA": "Uber",
    "UCuVQmkiETvqmLviDcBtQw4A": "Nothing",
    "UCYwrS5QvBY_JbSdbINLey6Q": "BMW",
    "UClj0L8WZrVydk5xKOscI6-A": "Mercedes-Benz",
    "UC0US_GEXVmwMH04OMcNuhpQ": "Volkswagen",
    "UC1pOTJteEef10zJM0cHs4iQ": "Toyota",
    "UC_BaxRhNREI_V0DVXjXDALA": "Porsche",
    "UCofTOFX4QuhT8OY-3-fFRFw": "Coinbase",
    "UCfYw6dhiwGBJQY_-Jcs8ozw": "Binance",
    "UCDhqADfY8S2N8BfrffZAc2w": "Nasdaq",
    "UCG2B6emunc-8ACAChpHv0qQ": "New York Stock Exchange",
    "UC61MWzrpcsazp23LOxCsTcg": "BlackRock",
    "UCBnFes2U2diA3QfR5m8l_Tw": "JPMorgan",
    "UCyz6-taovlaOkPsPtK4KNEg": "Goldman Sachs",
    "UCWOA1ZGywLbqmigxE4Qlvuw": "Netflix",
    "UC_5niPa-d35gg88HaS7RrIw": "Disney",
    "UCjmJDM5pRKbUlVIzDYYWb6g": "Warner Bros.",
    "UCq0OueAsdxH6b8nyAspwViw": "Universal Pictures",
    "UCz97F7dMxBNOfGYu3rx8aCw": "Sony Pictures",
    "UCF9imwPMSGz4Vq1NiTWCC7g": "Paramount Pictures",
    "UCvC4D8onUfXzvjTOM-dBfEA": "Marvel Entertainment",
    "UCVTQuK2CaWaTgSsoNkn5AiQ": "HBO",
    "UCx-KWLTKlB83hDI6UKECtJQ": "HBO Max",
    "UCQJWtTnAHhEG5w4uN0udnUQ": "Prime Video",
    "UC1Myj674wRVXB9I4c6Hm5zA": "Apple TV",
    "UCuPivVjnfNo4mb3Oog_frZg": "A24",
    "UCqECaJ8Gagnn7YCbPEzWH6g": "Taylor Swift",
    "UC-J-KZfRV8c13fOCkhXdLiQ": "Dua Lipa",
    "UCfSAqqftdc7FM1SY5vJjKfA": "Rita Ora",
    "UC5-gWZXAQqSGVfPHkA7NRiQ": "Bebe Rexha",
    "UCRdVQqY4jyRzlObeYPxLdHQ": "Era Istrefi",
    "UCRpjHHu8ivVWs73uxHlWwFA": "Eurovision Song Contest",
    "UCq4isO8ZYOZfmvGJ-_1UdIA": "GRAMMYs",
    "UCb-vZWBeWA5Q2818JmmJiqQ": "Oscars",
    "UCxrnpUor0IuXwxMiV7Fx_Cw": "BRITs",
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


def video_options(lead: dict) -> list[dict]:
    """Recent official videos whose title names the story's person (or, for a
    multi-word name, its organisation or event), newest first."""
    from news_image_policy import plain, story_names
    import time
    if time.monotonic() >= lead.get("_photo_deadline", float("inf")):
        return []
    title = plain(lead.get("title"))
    names = story_names(title, plain(lead.get("primary_evidence", {}).get("text", ""))[:1800])
    # Only the headline's main subject, as a full name: single words matched
    # 'Shqipëri' to an Edi Rama podcast and 'Trump' to a Bill Gates story. A
    # single word passes only on the channel of that very name ('Waymo').
    if not names:
        return []
    name = names[0]
    name_tokens = set(re.findall(r"[a-z0-9]+", fold(name)))
    event_tokens = {token for token in re.findall(r"[a-z0-9]+", fold(title)) if len(token) >= 5} - name_tokens
    def same_event(video_title: str) -> bool:
        # The video must also share a word about the event itself
        # ('Singapore' for Verstappen's Singapore win), not just the person.
        # A company's own channel needs two: one shared 'driver' put a Tesla
        # promo on a story about a Tesla crash (eval, 2026-10-17).
        shared = event_tokens & set(re.findall(r"[a-z0-9]+", fold(video_title)))
        return len(shared) >= (1 if " " in name else 2)
    def named(video: dict) -> bool:
        if " " in name:
            return phrase_in(name, video["title"])
        return phrase_in(name, video["channel"]) and fold(name) == fold(video["channel"]).split()[0]
    matches = [{"tier": "video", "video": video, "name": name} for video in recent_videos()
               if named(video) and same_event(video["title"])]
    matches.sort(key=lambda option: -datetime.fromisoformat(option["video"]["published"]).timestamp())
    return matches


def finalize_video(lead: dict, option: dict) -> dict:
    video, name = option["video"], option["name"]
    if not embeddable(video["video_id"]):
        return {}
    thumbnail = f"https://i.ytimg.com/vi/{video['video_id']}/maxresdefault.jpg"
    try:
        from news_image_policy import photo_fingerprint
        width, height, digest, _ = photo_fingerprint(thumbnail)
    except Exception:
        return {}
    if width < 1200 or height < 630:
        return {}
    reserve = lead.get("_reserve_photo")
    if reserve and not reserve(thumbnail):
        return {}
    watch = f"https://www.youtube.com/watch?v={video['video_id']}"
    return {"image_url": thumbnail, "image_width": width, "image_height": height,
            "image_subject": name, "image_caption": f"{name}: video nga kanali zyrtar {video['channel']} në YouTube",
            "video_clip_url": watch,
            "image_rights": {"provider": "youtube-embed", "source_page": watch, "creator": video["channel"],
                             "license": "YouTube embed", "license_url": "https://www.youtube.com/t/terms",
                             "description": video["title"][:300], "channel_id": video["channel_id"],
                             "published": video["published"], "sha256": digest,
                             "verified_at": datetime.now(timezone.utc).isoformat()}}


def select_video(lead: dict) -> dict:
    """The newest matching official video that is embeddable and large enough."""
    for option in video_options(lead):
        found = finalize_video(lead, option)
        if found:
            return found
    return {}
