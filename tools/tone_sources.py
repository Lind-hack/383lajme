"""Who counts as a country's press, and which "Kosovo" an article is about.

Three defects in the tone index made it easy to discredit, and all three are
decided here rather than anywhere the scraper happens to touch them:

1. **The wrong Kosovo.** "Kosowo" is a village in Poland; "Kosova" is a common
   Turkish neighbourhood name; "Kosovo" is a field near Knin in Croatia. A
   house fire in gmina Cekcyn and a fire brigade's new truck were both being
   counted as Polish media coverage of the country.

2. **Sources that are not journalism.** Sofascore, Transfermarkt, Meczyki,
   ESPN's fixture calendar, livescore listings, TV schedules, sports
   federations, UN agencies and a university page were all in the index. A
   database row has no editorial stance, so scoring it "neutral" is not a
   measurement — it is a vote for 50 that no journalist cast. Twelve of 234
   rows were these, and all three of Poland's rows were.

3. **Country attribution followed the feed, not the outlet.** Countries were
   defined by a Google News locale, so Germany (de/DE), Austria (de/AT) and
   Switzerland (de/CH) issued the same German-language queries and Google
   returned largely the same articles to all three. Blick (Swiss) and
   Tagesschau (German) each appeared under all three; ANSA (Italian) counted
   as American and British. Thirty-six outlets sat under more than one country,
   which means those countries were never independent measurements.

The rule now is: an article counts for the country of the outlet that published
it, established from the domain — never from the feed that surfaced it. A feed
is a way of finding articles, not a claim about who wrote them.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

# ─────────────────────────────────────────────────────────────────────────────
# 1. Sources that are not editorial journalism
# ─────────────────────────────────────────────────────────────────────────────

#: Live-score databases, fixture calendars, transfer registries, TV listings.
#: These publish rows, not reporting. They carry no stance to measure, and
#: counting them as "neutral" pulls every country's index toward 50.
NON_EDITORIAL_DOMAINS = {
    "sofascore.com", "transfermarkt.com", "transfermarkt.de", "transfermarkt.at",
    "transfermarkt.com.tr", "transfermarkt.pl", "transfermarkt.it", "transfermarkt.es",
    "meczyki.pl", "flashscore.com", "flashscore.pl", "livescore.com",
    "besoccer.com", "fotmob.com", "worldfootball.net", "soccerway.com",
    "futbol24.com", "scoreboard.com", "wynikinazywo.pl", "sportowefakty.wp.pl",
    "espn.com", "espn.co.uk", "espndeportes.espn.com",
    "cosmotetv.gr", "tvguide.gr", "programmatv.gr",
    "eurosport.com", "eurosport.de", "eurosport.fr",
    "wikipedia.org", "wikiwand.com", "youtube.com", "youtu.be",
    "facebook.com", "x.com", "twitter.com", "instagram.com", "tiktok.com",
    "reddit.com", "linkedin.com",
}

#: Institutions, federations and academia. They publish, and what they publish
#: can be perfectly good — it is simply not a country's *press*. An EEAS
#: statement is the EU speaking, not Belgium's newsrooms reacting.
NON_PRESS_DOMAINS = {
    "unicef.org", "un.org", "unhcr.org", "undp.org", "who.int",
    "europa.eu", "eeas.europa.eu", "consilium.europa.eu", "coe.int",
    "osce.org", "worldbank.org", "imf.org", "iom.int",
    "padelfip.com", "wbsc.org", "fiba.basketball", "olympics.com",
    "amnesty.org", "hrw.org", "state.gov", "gov.uk",
    "devdiscourse.com",
}

#: Name-shaped tells, for the many sources Google labels by masthead rather
#: than domain. "Wyniki na żywo" is Polish for "live results" — a listings
#: page whose name says exactly what it is.
NON_EDITORIAL_NAME_MARKERS = (
    "sofascore", "transfermarkt", "meczyki", "flashscore", "livescore",
    "besoccer", "fotmob", "soccerway", "worldfootball",
    "wyniki na żywo", "wyniki na zywo", "canlı skor", "canli skor",
    "ζωντανά αποτελέσματα", "resultados en vivo", "risultati live",
    "programma tv", "tv programa", "πρόγραμμα τηλεόρασης",
    "wikipedia", "youtube", "unicef", "eeas", "european external action",
    "world bank", "united nations",
    "padel federation", "baseball softball", "university of",
    # Sports federations and associations, in the languages this index reads.
    # The Hellenic Volleyball Federation was sitting in the Greek sample as an
    # outlet: it publishes, but it is a governing body announcing its own
    # fixtures, not a newsroom with a view about Kosovo.
    "ομοσπονδία", "federation", "fédération", "federazione", "federación",
    "federasyon", "związek", "savez", "verband", "förbund", "bond van",
    "olympic committee", "ολυμπιακή επιτροπή", "komiteti olimpik",
    "ministry of", "ministerium", "ministère", "ministero", "bakanlığı",
    "embassy", "botschaft", "ambassade", "ambasada",
)

#: Whole top-level domains that are never a national newsroom.
NON_PRESS_TLDS = (".edu", ".gov", ".mil", ".int")


def _host(url: str) -> str:
    try:
        host = urlparse(url or "").netloc.lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def is_editorial(outlet: str, url: str) -> bool:
    """Does this source publish journalism with a stance worth measuring?

    False for score databases, fixture calendars, TV listings, social
    platforms, institutions and academia.
    """
    host = _host(url)
    name = (outlet or "").strip().lower()

    if host:
        if any(host == d or host.endswith("." + d) for d in NON_EDITORIAL_DOMAINS):
            return False
        if any(host == d or host.endswith("." + d) for d in NON_PRESS_DOMAINS):
            return False
        if host.endswith(NON_PRESS_TLDS):
            return False
    if name and any(marker in name for marker in NON_EDITORIAL_NAME_MARKERS):
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# 2. The wrong Kosovo
# ─────────────────────────────────────────────────────────────────────────────

#: Words that only appear when a piece is about a *locality*: a municipality, a
#: parish, a village, a volunteer fire brigade. Grouped by the language whose
#: place names collide with the country's.
#: A trailing "*" means "this stem, however it is inflected"; anything else
#: must match as a whole word. The distinction is load-bearing in both
#: directions: Polish "strażacy" needs the stem "strażac*" to match at all,
#: while "wsi" must stay whole or it matches inside unrelated words — as a bare
#: substring it threw away a Greek story about lignite exports. Slavic and
#: Turkish inflect heavily, so most of these are stems.
LOCAL_PLACE_MARKERS = {
    # Kosowo is a village in several Polish gminas.
    "pl": ("gmin*", "powiat*", "wieś", "wsi", "sołectw*", "sołtys*",
           "osp", "ochotnicza straż*", "strażac*", "remiz*", "miejscowoś*"),
    # Kosovo is a field and settlement near Knin.
    "hr": ("općin*", "opčin*", "selo", "selu", "mjest*", "knin*",
           "župa", "vatrogas*"),
    # Kosova is a common mahalle/köy name across Turkey.
    "tr": ("mahalles*", "köy*", "ilçe*", "belde*", "muhtar*", "itfaiye*"),
}

#: If any of these appear, the piece is about the country whatever else it
#: says — a municipality can be mentioned in real Kosovo coverage, and this is
#: what stops the filter eating it.
COUNTRY_SIGNALS = (
    "pristina", "prishtina", "priština", "prisztina", "priştine",
    "kurti", "osmani", "vučić", "vucic", "belgrade", "beograd", "belgrad",
    "serbia", "serbien", "serbie", "sırbistan", "srbija", "serbi",
    "kfor", "eulex", "nato", "unmik", "mitrovica", "mitrovicë",
    "balkan", "bałkan", "balkanlar", "peja", "prizren", "gjakova",
    "republic of kosovo", "republika kosovo", "kosova cumhuriyeti",
    "independence", "unabhängigkeit", "niepodległość", "bağımsızlık",
    "eu accession", "visa liberalis", "wizowa", "vizesiz",
)


def is_local_placename(title: str, blurb: str = "", lang: str = "") -> bool:
    """True when "Kosovo" here is a village somewhere else, not the country.

    Requires a local-administration marker *and* the absence of any
    country-level signal, so a real story that happens to name a municipality
    is not thrown away.
    """
    text = f"{title or ''} {blurb or ''}".lower()
    if not text.strip():
        return False
    if any(signal in text for signal in COUNTRY_SIGNALS):
        return False

    markers = LOCAL_PLACE_MARKERS.get(lang)
    pools = [markers] if markers else list(LOCAL_PLACE_MARKERS.values())
    return any(_marker_hit(text, marker) for pool in pools for marker in pool)


def _marker_hit(text: str, marker: str) -> bool:
    """Match a marker as a stem ("gmin*") or as a whole word ("wsi")."""
    stem = marker.endswith("*")
    body = re.escape(marker[:-1] if stem else marker)
    edge = "" if stem else r"\b"
    return bool(re.search(r"\b" + body + edge, text))


# ─────────────────────────────────────────────────────────────────────────────
# 3. Which country's press
# ─────────────────────────────────────────────────────────────────────────────

#: Country-code TLD → the country label the index uses. This is the cheap
#: majority case: a .ch domain is Swiss press no matter which feed found it.
CCTLD_COUNTRY = {
    "de": "Gjermani", "at": "Austri", "ch": "Zvicër", "fr": "Francë",
    "it": "Itali", "nl": "Holandë", "be": "Belgjikë", "es": "Spanjë",
    "gr": "Greqi", "se": "Suedi", "pl": "Poloni", "tr": "Turqi",
    "hr": "Kroaci", "uk": "Britani", "us": "SHBA",
}

#: Outlets on a generic TLD (.com/.org/.net), where the domain says nothing
#: about nationality and only knowing the masthead does. Extend this rather
#: than guessing — an unknown outlet is dropped, not assigned.
GENERIC_DOMAIN_COUNTRY = {
    # Britain
    "theguardian.com": "Britani", "bbc.com": "Britani", "reuters.com": "Britani",
    "independent.co.uk": "Britani", "thetimes.co.uk": "Britani", "ft.com": "Britani",
    "telegraph.co.uk": "Britani", "economist.com": "Britani", "dailymail.co.uk": "Britani",
    "churchtimes.co.uk": "Britani", "skynews.com": "Britani",
    # United States
    "apnews.com": "SHBA", "washingtonpost.com": "SHBA", "nytimes.com": "SHBA",
    "bloomberg.com": "SHBA", "theatlantic.com": "SHBA", "politico.com": "SHBA",
    "cnn.com": "SHBA", "cbsnews.com": "SHBA", "nbcnews.com": "SHBA",
    "foxnews.com": "SHBA", "wsj.com": "SHBA", "npr.org": "SHBA",
    "newsweek.com": "SHBA", "forbes.com": "SHBA", "voanews.com": "SHBA",
    "rferl.org": "SHBA", "balkaninsight.com": "Britani",
    # Germany
    "spiegel.de": "Gjermani", "sueddeutsche.de": "Gjermani", "zeit.de": "Gjermani",
    "faz.net": "Gjermani", "bild.de": "Gjermani", "tagesschau.de": "Gjermani",
    "dw.com": "Gjermani", "welt.de": "Gjermani", "handelsblatt.com": "Gjermani",
    "n-tv.de": "Gjermani", "focus.de": "Gjermani", "taz.de": "Gjermani",
    # Austria
    "diepresse.com": "Austri", "derstandard.at": "Austri", "krone.at": "Austri",
    "orf.at": "Austri", "kurier.at": "Austri", "kleinezeitung.at": "Austri",
    "heute.at": "Austri", "oe24.at": "Austri",
    # Switzerland
    "blick.ch": "Zvicër", "nzz.ch": "Zvicër", "srf.ch": "Zvicër",
    "tagesanzeiger.ch": "Zvicër", "20min.ch": "Zvicër", "watson.ch": "Zvicër",
    "zentralplus.ch": "Zvicër", "swissinfo.ch": "Zvicër",
    # France
    "lemonde.fr": "Francë", "lefigaro.fr": "Francë", "franceinfo.fr": "Francë",
    "afp.com": "Francë", "liberation.fr": "Francë", "lexpress.fr": "Francë",
    "courrierdesbalkans.fr": "Francë", "france24.com": "Francë", "rfi.fr": "Francë",
    # Italy
    "repubblica.it": "Itali", "corriere.it": "Itali", "ansa.it": "Itali",
    "lastampa.it": "Itali", "ilsole24ore.com": "Itali", "ilfattoquotidiano.it": "Itali",
    "balcanicaucaso.org": "Itali", "rainews.it": "Itali",
    # Netherlands / Belgium
    "nos.nl": "Holandë", "nrc.nl": "Holandë", "volkskrant.nl": "Holandë",
    "telegraaf.nl": "Holandë", "ad.nl": "Holandë",
    "nieuwsblad.be": "Belgjikë", "standaard.be": "Belgjikë", "vrt.be": "Belgjikë",
    "lesoir.be": "Belgjikë", "rtbf.be": "Belgjikë", "brusselstimes.com": "Belgjikë",
    # Spain / Greece / Sweden
    "elpais.com": "Spanjë", "elmundo.es": "Spanjë", "abc.es": "Spanjë",
    "lavanguardia.com": "Spanjë", "democrata.es": "Spanjë", "efe.com": "Spanjë",
    "kathimerini.gr": "Greqi", "tovima.gr": "Greqi", "protothema.gr": "Greqi",
    "ekathimerini.com": "Greqi", "in.gr": "Greqi", "naftemporiki.gr": "Greqi",
    "svd.se": "Suedi", "dn.se": "Suedi", "aftonbladet.se": "Suedi",
    "expressen.se": "Suedi", "svt.se": "Suedi",
    # Poland / Turkey / Croatia
    "wyborcza.pl": "Poloni", "rp.pl": "Poloni", "onet.pl": "Poloni",
    "tvn24.pl": "Poloni", "polskieradio.pl": "Poloni", "notesfrompoland.com": "Poloni",
    "hurriyet.com.tr": "Turqi", "sabah.com.tr": "Turqi", "milliyet.com.tr": "Turqi",
    "trthaber.com": "Turqi", "trtworld.com": "Turqi", "aa.com.tr": "Turqi",
    "anews.com.tr": "Turqi", "harici.com.tr": "Turqi", "dailysabah.com": "Turqi",
    "jutarnji.hr": "Kroaci", "vecernji.hr": "Kroaci", "index.hr": "Kroaci",
    "24sata.hr": "Kroaci", "hrt.hr": "Kroaci", "novilist.hr": "Kroaci",
    # Turkish newsrooms that publish on a generic TLD, where the domain says
    # nothing. Turkey covers Kosovo more than anywhere else in this set, and
    # without these a fifth of its coverage would go unattributed.
    "sondakika.com": "Turqi", "odatv.com": "Turqi", "haberler.com": "Turqi",
    "haber7.com": "Turqi", "gzt.com": "Turqi", "ensonhaber.com": "Turqi",
    "cumhuriyet.com.tr": "Turqi", "sozcu.com.tr": "Turqi",
    # Italian, likewise.
    "quotidiano.net": "Itali", "ilpost.it": "Itali", "agi.it": "Itali",
}

#: Multinational newsrooms with no single national press to belong to. They are
#: real journalism, so they are not blocked — they simply cannot be evidence
#: about any one country's attitude, which is the thing being measured.
TRANSNATIONAL_DOMAINS = {
    "aljazeera.com", "aljazeera.net", "euronews.com", "euronews.al",
    "politico.eu", "theconversation.com", "opendemocracy.net",
    "modernghana.com", "menafn.com", "zawya.com", "timesofisrael.com",
    "aps.dz", "elwatan-dz.com", "elmoudjahid.dz",
}


def country_for(url: str, outlet: str = "") -> str | None:
    """The country whose press this outlet belongs to, or None.

    None means "do not count this anywhere" — an unknown or multinational
    outlet is dropped rather than attributed to whichever feed happened to
    surface it, because a guess here is exactly the bug this replaces.
    """
    host = _host(url)
    if not host:
        return None
    if any(host == d or host.endswith("." + d) for d in TRANSNATIONAL_DOMAINS):
        return None

    for domain, country in GENERIC_DOMAIN_COUNTRY.items():
        if host == domain or host.endswith("." + domain):
            return country

    # co.uk, com.tr, com.au — the country code sits one label in.
    parts = host.split(".")
    for candidate in (parts[-1], parts[-2] if len(parts) > 2 else ""):
        if candidate in CCTLD_COUNTRY:
            return CCTLD_COUNTRY[candidate]
    return None


def audit(rows):
    """Summarise what the rules would drop, for a rebuild or a dry run.

    `rows` are dicts with at least url/outlet/title; returns counts by reason
    plus the corrected country for whatever survives.
    """
    out = {"kept": [], "non_editorial": [], "wrong_kosovo": [], "unattributable": []}
    for row in rows:
        url, outlet = row.get("url", ""), row.get("outlet", "")
        if not is_editorial(outlet, url):
            out["non_editorial"].append(row)
            continue
        if is_local_placename(row.get("title", ""), row.get("blurb", "") or row.get("summary", "")):
            out["wrong_kosovo"].append(row)
            continue
        country = country_for(url, outlet)
        if not country:
            out["unattributable"].append(row)
            continue
        out["kept"].append({**row, "country": country})
    return out
