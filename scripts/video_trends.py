"""What Kosovo and Albania are talking about today, for 383's newsroom and video edition.

Two signals, both free and keyless:
- Google Trends' daily trending searches for Albania (Kosovo has no Trends feed): each with its
  search volume ("2000+") and the news stories Google ties to it;
- Albanian Wikipedia's most read pages, kept only when a page is read far more than in its
  usual week (a spike: someone is in the news), which brings in Kosovo's names too. Wikipedia's
  counts arrive a day or two late, so this is the slower signal.

collect() writes them to TRENDS (default /opt/data/trends/trends.json). The newsroom's
discovery puts leads that match a trend first and tells the writer they are trending
(scripts/cloud_news_discovery.py); the video edition lets a trending 383 article take the place
of the weakest of its seven (scripts/video_edition.py). match() says whether a text is about a
trend, the same way for both.
"""
from __future__ import annotations

import json
import os
import re
import statistics
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

TRENDS = Path(os.environ.get("L383_TRENDS", "/opt/data/trends/trends.json"))
HEADERS = {"User-Agent": "383Trends/1.0 (https://383ks.com; newsroom trends)"}
# Words in a trend that say nothing about what it is ("real madrid c.f. vs sevilla fc").
NOISE = {"vs", "v", "fc", "cf", "sc", "ss", "ac", "fk", "kf", "the", "de", "la", "el", "e", "i", "te", "ne", "dhe", "live"}
# First words of club names: "Real Madrid" is not about any Madrid, "Man Utd" not about any United.
CLUB_PREFIX = {"real", "inter", "atletico", "athletic", "manchester", "man", "bayern", "borussia", "club", "sporting", "west",
               "aston", "crystal", "paris", "olympique", "ajax", "partizan", "dinamo", "dynamo", "red", "golden"}
WIKI_SKIP = re.compile(r"(?i)^(faqja_kryesore|speciale:|skeda:|wikipedia:|kategoria:|stampa:|ndihmë:|përdoruesi:)")


def fold(text: str) -> str:
    """Lower case, no accents (ë -> e, ç -> c): "Vëllaznimi" and "vellaznimi" meet."""
    text = unicodedata.normalize("NFKD", str(text or "").lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", fold(text)) if t not in NOISE and len(t) >= 3]


def match(text: str, term: str) -> bool:
    """The text is about the trend: every word of the trend appears in it (by its first five
    letters, so Albanian endings do not matter: Begaj / Begajt, Sevilla / Sevillës). A trend of
    four words or more needs three quarters of them."""
    want = [t[:5] for t in tokens(term)]
    if not want:
        return False
    have = {t[:5] for t in tokens(text)}
    hits = sum(1 for t in want if t in have)
    words = tokens(term)
    # A person is often named by the surname alone ("Begaj" for Bajram Begaj).
    if len(want) == 2 and want[1] in have and len(words[1]) >= 5 and words[0] not in CLUB_PREFIX:
        return True
    return hits == len(want) if len(want) < 4 else hits >= 0.75 * len(want)


def _get(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def traffic_number(text: str) -> int:
    """"2,000+" -> 2000."""
    digits = re.sub(r"[^\d]", "", str(text or ""))
    return int(digits) if digits else 0


def google_trends(geo: str = "AL") -> list[dict]:
    try:
        xml = _get(f"https://trends.google.com/trending/rss?geo={geo}").decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, OSError):
        return []
    out = []
    for item in re.findall(r"<item>(.*?)</item>", xml, re.S):
        title = re.search(r"<title>(.*?)</title>", item, re.S)
        if not title:
            continue
        news = [{"title": html_unescape(t), "url": html_unescape(u)}
                for t, u in zip(re.findall(r"<ht:news_item_title>(.*?)</ht:news_item_title>", item, re.S),
                                re.findall(r"<ht:news_item_url>(.*?)</ht:news_item_url>", item, re.S))]
        traffic = re.search(r"<ht:approx_traffic>(.*?)</ht:approx_traffic>", item)
        out.append({"term": html_unescape(title.group(1)).strip(), "traffic": traffic_number(traffic.group(1) if traffic else ""),
                    "source": f"google:{geo}", "news": news[:3]})
    return out


def html_unescape(text: str) -> str:
    import html
    return html.unescape(re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", text or ""))


def wiki_spikes(lang: str = "sq", now: datetime | None = None, top: int = 40) -> list[dict]:
    """Pages read at least 60 times on the latest day Wikipedia has counted, and three times
    their usual day of the week before."""
    now = now or datetime.now(timezone.utc)
    day = None
    articles = []
    for back in (1, 2, 3):
        d = now - timedelta(days=back)
        try:
            data = json.loads(_get(f"https://wikimedia.org/api/rest_v1/metrics/pageviews/top/{lang}.wikipedia/all-access/{d:%Y/%m/%d}"))
            articles = data["items"][0]["articles"]
            day = d
            break
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError, IndexError):
            continue
    out = []
    for a in articles[:top]:
        name, views = a.get("article", ""), int(a.get("views") or 0)
        if views < 60 or WIKI_SKIP.search(name):
            continue
        start, end = (day - timedelta(days=8)).strftime("%Y%m%d"), (day - timedelta(days=1)).strftime("%Y%m%d")
        try:
            hist = json.loads(_get(f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{lang}.wikipedia/all-access/user/"
                                   f"{urllib.parse.quote(name, safe='')}/daily/{start}/{end}"))
            usual = statistics.median([int(i.get("views") or 0) for i in hist.get("items", [])] or [0])
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            continue
        if views >= 3 * max(usual, 10) and len(tokens(name.replace("_", " "))) >= 2:
            out.append({"term": name.replace("_", " "), "traffic": views, "source": f"wikipedia:{lang}", "news": []})
    # People only: "Historia e Shqipërisë" spikes in exam week and its words are in every other story.
    people = humans([t["term"] for t in out], lang)
    return [t for t in out if t["term"] in people]


def humans(titles: list[str], lang: str = "sq") -> set[str]:
    """The titles whose Wikidata item is a human (P31 = Q5)."""
    if not titles:
        return set()
    try:
        q = urllib.parse.urlencode({"action": "query", "format": "json", "formatversion": "2", "prop": "pageprops",
                                    "ppprop": "wikibase_item", "titles": "|".join(titles[:50])})
        pages = json.loads(_get(f"https://{lang}.wikipedia.org/w/api.php?{q}")).get("query", {}).get("pages", [])
        ids = {p["pageprops"]["wikibase_item"]: p["title"] for p in pages if (p.get("pageprops") or {}).get("wikibase_item")}
        if not ids:
            return set()
        q = urllib.parse.urlencode({"action": "wbgetentities", "format": "json", "props": "claims", "ids": "|".join(ids)})
        ents = json.loads(_get(f"https://www.wikidata.org/w/api.php?{q}")).get("entities", {})
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, KeyError):
        return set()
    out = set()
    for qid, ent in ents.items():
        kinds = {((c.get("mainsnak") or {}).get("datavalue") or {}).get("value", {}).get("id") for c in (ent.get("claims") or {}).get("P31", [])}
        if "Q5" in kinds:
            out.add(ids[qid])
    return out


def collect(path: Path = TRENDS) -> dict:
    """Today's trends, the strongest first, saved for the newsroom and the edition. A trend seen
    before keeps the time it was first seen."""
    now = datetime.now(timezone.utc)
    before = {t["term"].lower(): t for t in load(path, max_age=None).get("trends", [])}
    found = google_trends("AL") + wiki_spikes("sq", now)
    trends = []
    for t in found:
        old = before.get(t["term"].lower()) or {}
        trends.append({**t, "first_seen": old.get("first_seen") or now.isoformat()})
    trends.sort(key=lambda t: -t["traffic"])
    data = {"at": now.isoformat(), "trends": trends}
    if trends:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(path)
    return data


def load(path: Path = TRENDS, max_age: timedelta | None = timedelta(hours=26)) -> dict:
    """The saved trends; {} when there are none or they are older than max_age."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if max_age is not None:
        try:
            if datetime.now(timezone.utc) - datetime.fromisoformat(data.get("at", "")) > max_age:
                return {}
        except ValueError:
            return {}
    return data if isinstance(data, dict) else {}


def trend_for(text: str, data: dict | None = None) -> dict | None:
    """The strongest trend the text is about, or None."""
    for t in (data if data is not None else load()).get("trends", []):
        if match(text, t["term"]):
            return t
    return None


if __name__ == "__main__":
    got = collect()
    for t in got.get("trends", [])[:20]:
        print(f"{t['traffic']:>6}  {t['source']:<14} {t['term']}")
    sys.exit(0 if got.get("trends") else 1)
