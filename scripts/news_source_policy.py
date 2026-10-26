"""One publisher, one desk. Shared by discovery and the final publication gate."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit

from news_lane import is_sports_story

MANIFEST_PATH = Path(__file__).with_name("news_sources.json")


def fold(value: object) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", str(value or "")).casefold()
                   if not unicodedata.combining(c))


def host(url: object) -> str:
    try:
        parsed = urlsplit(str(url or ""))
        if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
            return ""
        return (parsed.hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def load_manifest(path: Path = MANIFEST_PATH) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    expected = {"Kosovë", "Shqipëri", "Sport", "Teknologji", "Ekonomi", "Botë", "Showbiz"}
    if data.get("version") != 3 or set(data.get("categories", [])) != expected or len(data["categories"]) != 7:
        raise ValueError("news source registry must declare all seven categories")
    targets = [data["category_limits"][category].get("target") for category in data["categories"]]
    if not all(type(value) is int and value > 0 for value in targets) or sum(targets) != 20:
        raise ValueError("hourly category targets must cover seven desks and total 20")
    owners = {}
    names = set()
    for publisher in data["publishers"]:
        if publisher["source"] in names:
            raise ValueError("duplicate publisher name")
        names.add(publisher["source"])
        if publisher["category"] not in data["categories"] or not publisher.get("family"):
            raise ValueError("invalid publisher category/family")
        for domain in publisher["domains"]:
            if domain != host("https://" + domain) or not re.fullmatch(r"[a-z0-9.-]+", domain):
                raise ValueError("publisher domain must be a canonical hostname")
            if domain in owners:
                raise ValueError(f"publisher domain registered twice: {domain}")
            owners[domain] = publisher
    for spec in [*data["feeds"], *data["browser_lanes"]]:
        publisher = next((p for p in data["publishers"] if p["source"] == spec["source"]), None)
        if not publisher or publisher["category"] != spec["category"]:
            raise ValueError(f"feed/category mismatch: {spec.get('source')}")
    return data


MANIFEST = load_manifest()
CATEGORIES = tuple(MANIFEST["categories"])

# Routine attributed reports need a readable primary; sensitive claims also
# need an independent publisher. The same decision is used by all stages.
_SENSITIVE = re.compile(
    r"\b(?:accus\w*|alleg\w*|akuz\w*|scandal\w*|skandal\w*|"
    r"corrupt\w*|korrups\w*|arrest\w*|murder\w*|vras\w*|vrit\w*|"
    r"rape\w*|perdhun\w*|abuz\w*|abuse\w*|fraud\w*|mashtrim\w*|"
    r"divorc\w*|tradhti\w*|cheat\w*|rumou?r\w*|thashethem\w*|"
    r"hetim\w*|investigat\w*|lawsuit\w*|padi(?:a|s[e]?|n[e]?|ve|sh)?|padit\w*)\b"
)


def needs_corroboration(article: dict) -> bool:
    """The story's central claim is an allegation, arrest, scandal or the like:
    its headline, excerpt or summary says so. The full text was scanned too
    until 18 Oct, which flagged 74 of 182 leads (36 of 60 world stories) for a
    passing 'investigation' or 'arrested'; the editor still checks every
    claim against the evidence and rejects sensitive single-source claims."""
    return bool(_SENSITIVE.search(fold(" ".join(str(article.get(key) or "")
                                             for key in ("title", "excerpt", "summary")))))


def hourly_targets() -> dict[str, int]:
    return {category: int(MANIFEST["category_limits"][category]["target"])
            for category in CATEGORIES}


def publisher_for(url: object) -> dict | None:
    hostname = host(url)
    matches = [(len(domain), p) for p in MANIFEST["publishers"] for domain in p["domains"]
               if hostname == domain or hostname.endswith("." + domain)]
    return max(matches, key=lambda item: item[0])[1] if matches else None


def source_error(category: str, url: object) -> str | None:
    publisher = publisher_for(url)
    if publisher is None:
        return "publisher URL is not in the approved category registry"
    if publisher["category"] != category:
        return f"{publisher['source']} belongs only to {publisher['category']}, not {category}"
    return None


def independent(left: object, right: object) -> bool:
    a, b = publisher_for(left), publisher_for(right)
    return bool(a and b and a["family"] != b["family"] and host(left) != host(right))


_ECONOMY = re.compile(r"\b(?:stock(?:s| market)?|wall street|nasdaq|s&p|dow jones|earnings|ipo|"
                      r"bitcoin|ethereum|crypto\w*|kripto\w*|etf|inflacion\w*|burs\w*|"
                      r"aksion(?:et|eve|i|are)|norma\w* e interesit|interes\w* bankar\w*)\b")
_TECH = re.compile(r"\b(?:openai|anthropic|chatgpt|gemini|artificial intelligence|"
                   r"inteligjenc\w* artificiale|robot\w*|cyber\w*|kibernetik\w*|"
                   r"software|softuer\w*|ai model|model\w* (?:te |i )?ai)\b")
_SHOWBIZ = re.compile(r"\b(?:showbiz|big brother|ferma vip|kengetar\w*|aktor\w*|"
                      r"album\w*|grammy|oscar|dua lipa|rita ora|bebe rexha|"
                      r"ledri|luiz ejlli|tayna|noizy|taylor swift)\b")
_CULTURE = re.compile(r"\b(?:showbiz|entertainment|celebr\w*|singer\w*|actor\w*|actress\w*|"
                      r"music\w*|muzik\w*|keng(?:a|e|en|es|et|eve|esh)|singell\w*|hit(?:i|it|in|et|eve)|hot\s+100|"
                      r"film\w*|movie\w*|cinema\w*|kinema\w*|"
                      r"theat\w*|teat\w*|broadway|west end|opera|operes|operen|ballet\w*|balet\w*|"
                      r"concert\w*|koncert\w*|festival\w*|album\w*|kengetar\w*|aktor\w*|"
                      r"books?|bookstore\w*|libr\w*|novels?|roman|romani|romanit|romaneve|"
                      r"artist\w*|art|artwork\w*|piktur\w*|painting\w*|sculpt\w*|skulpt\w*|"
                      r"literatur\w*|letersi\w*|letrar\w*|shkrimtar\w*|poet\w*|poez\w*|nobel|ekspozit\w*|exhibition\w*|bienal\w*|"
                      r"kendon|kendoi|kendojne|kendoje|kenduan|kenduar|kendonte|televiziv\w*|"
                      r"television|reality|tv star|fashion|moda|mode|modes|moden|kardashian|royal family|royals|mbreter\w*)\b")
_LOCAL = {
    "Kosovë": re.compile(r"\b(?:kosov\w*|prishtin\w*|prizren\w*|pej[ae]\w*|gjilan\w*|"
                         r"ferizaj\w*|gjakov\w*|mitrovic\w*|kurti|osmani|haradinaj|hamza|"
                         r"suharek\w*|vushtrri\w*|podujev\w*|drenas\w*|rahovec\w*|"
                         r"skenderaj\w*|kamenic\w*|lipjan\w*|malishev\w*|klina|decan\w*)\b"),
    "Shqipëri": re.compile(r"\b(?:shqiper\w*|albania\w*|tiran\w*|durres\w*|shkod\w*|"
                           r"vlor\w*|elbasan\w*|korce\w*|berat\w*|fier\w*|spak|"
                           r"edi rama|berisha|balluku|lezhe\w*|kukes\w*|sarand\w*)\b"),
}
_VITI_LOCATION = re.compile(r"\b(?:ne viti(?!\s+\d)|vitise)\b|^\s*viti\s*:")


def topic_error(category: str, title: object, summary: object = "", *, tags=(), url="") -> str | None:
    """Conservative topic exclusions; model/editor checks resolve remaining ambiguity."""
    headline = fold(title)
    labels = {fold(tag) for tag in tags}
    try:
        path = fold(urlsplit(str(url)).path) if url else ""
    except ValueError:
        return "invalid publisher URL"
    if labels & {'gaming', 'esports', 'anime', 'manga'} or re.search(r'/(?:gaming|esports|anime|manga)/', path):
        return 'publisher category is explicitly excluded by the newsroom'
    if category != "Sport" and is_sports_story(title, summary, tags=tags, url=url):
        return "sports reporting is outside this publisher's assigned category"
    # Local desks cover verified local personalities, entertainment and companies.
    # Their geographic check below still excludes unrelated international stories.
    if category == "Botë":
        if _SHOWBIZ.search(headline) or labels & {"showbiz", "argetim", "entertainment", "music", "film"} or re.search(r"/(?:showbiz|show-biz|entertainment|music|film|stage|tv-and-radio|celebrity|entertainment-arts)/", path):
            return "entertainment reporting is outside this category"
        if _ECONOMY.search(headline) or labels & {"ekonomi", "economy", "business", "crypto", "markets"}:
            return "financial reporting is outside this category"
        if _TECH.search(headline) or labels & {"teknologji", "technology", "tech"}:
            return "technology reporting is outside this category"
    if category == "Teknologji" and _ECONOMY.search(headline):
        return "stocks/earnings/crypto reporting belongs in Ekonomi"
    if category == "Showbiz" and not (_SHOWBIZ.search(fold(f"{title} {summary}"))
            or _CULTURE.search(fold(f"{title} {summary}"))
            or labels & {"showbiz", "entertainment", "celebrity", "celebrities", "music", "film", "movies",
                         "television", "tv", "culture", "kulture", "argetim", "books", "arts", "fashion"}):
        return "story lacks an explicit entertainment or culture subject"
    if category == "Ekonomi":
        financial = _ECONOMY.search(fold(f"{title} {summary}")) or re.search(
            r"\b(?:econom\w*|ekonom\w*|financ\w*|bank\w*|market\w*|treg\w*|"
            r"business|biznes\w*|invest\w*|pension\w*|pag\w*|tatim\w*|taks\w*|"
            r"buxhet\w*|export\w*|import\w*|employment|jobs|unemployment|"
            r"oil|naft\w*|tariff\w*|tarif\w*|dollar|euro|debt|borxh\w*|"
            r"revenue|profit\w*|fitim\w*|bilanc\w*|te ardhur\w*|dollar\w*|euro\w*|rent|qira\w*|housing|mortgage|treasury|bond\w*)\b",
            fold(f"{title} {summary}"))
        if not financial:
            return "story lacks an explicit economic or markets subject"
        if _SHOWBIZ.search(headline):
            return "entertainment reporting is outside Ekonomi"
    geography_path = (category == 'Shqipëri' and bool(re.search(r'/shqiperi(?:a)?/', path))) or (
        category == 'Kosovë' and bool(re.search(r'/kosov(?:e|a)/', path)))
    if category in _LOCAL:
        text = fold(f"{title} {summary}")
        local = _LOCAL[category].search(text) or geography_path
        if category == 'Kosovë':
            # Albanian 'viti' usually means 'the year', not the town of Viti.
            local = local or _VITI_LOCATION.search(text) or labels & {'viti', 'vitise'}
        if not local:
            return "local story lacks an explicit Kosovo/Albania subject"
    return None


def article_source_errors(article: dict) -> list[str]:
    category = str(article.get("category") or "")
    errors = []
    sources = article.get("corroborating_sources") or []
    if not isinstance(sources, list):
        errors.append("corroborating_sources must be a list")
        sources = []
    for url in [article.get("url"), *[s.get("url") if isinstance(s, dict) else s
                for s in sources]]:
        error = source_error(category, url)
        if error:
            errors.append(error)
    error = topic_error(category, article.get("title"), article.get("excerpt"), url=article.get("url", ""))
    if error:
        errors.append(error)
    return errors
