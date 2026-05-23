import feedparser
from database import save_raw

RSS_FEEDS = [
    # Global wire services — Europe-specific feeds have far more Kosovo content
    ("https://feeds.bbci.co.uk/news/world/europe/rss.xml", "BBC", "🇬🇧"),
    ("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC World", "🇬🇧"),
    ("https://rss.dw.com/rss/en-all", "DW", "🇩🇪"),
    ("https://www.france24.com/en/rss", "France 24", "🇫🇷"),
    ("https://apnews.com/rss/world-news", "AP", "🇺🇸"),
    ("https://feeds.theguardian.com/theguardian/world/rss", "Guardian", "🇬🇧"),
    ("https://www.aljazeera.com/xml/rss/all.xml", "Al Jazeera", "🇶🇦"),
    # Balkan / regional specialists
    ("https://balkaninsight.com/feed/", "Balkan Insight", "🇷🇸"),
    ("https://europeanwesternbalkans.com/feed/", "Euractiv Balkans", "🇪🇺"),
    ("https://www.rferl.org/api/zrqiteuuiez", "Radio Free Europe", "🇺🇸"),
    ("https://euobserver.com/rss.xml", "EUobserver", "🇪🇺"),
    ("https://www.euractiv.com/feed/", "Euractiv", "🇪🇺"),
    # Albanian-language Kosovo news sites (all Kosovo content)
    ("https://telegrafi.com/feed/", "Telegrafi", "🇽🇰"),
    ("https://gazetaexpress.com/feed/", "Gazeta Express", "🇽🇰"),
    ("https://kosovapress.com/feed/", "KosovaPress", "🇽🇰"),
    ("https://zeri.info/feed/", "Zëri", "🇽🇰"),
    ("https://www.rtklive.com/sq/feed", "RTK Live", "🇽🇰"),
    # Google News — targeted Kosovo queries (reduced to avoid duplicate content)
    ("https://news.google.com/rss/search?q=Kosovo&hl=en-US&gl=US&ceid=US:en", "Google News", "🌐"),
    ("https://news.google.com/rss/search?q=Kosovo+Serbia&hl=en-US&gl=US&ceid=US:en", "Google News", "🌐"),
    ("https://news.google.com/rss/search?q=Kosovo+elections&hl=en-US&gl=US&ceid=US:en", "Google News", "🌐"),
    ("https://news.google.com/rss/search?q=Kosova+shqip&hl=sq&gl=XK&ceid=XK:sq", "Google News SQ", "🌐"),
]

KEYWORDS = {"kosovo", "kosov", "kurti", "pristina", "prishtina", "prishtinë", "kosovë"}


def _extract_image(entry) -> str | None:
    """Pull the best image URL out of a feed entry before any scraping."""
    # media:thumbnail (BBC, Reuters, many news feeds)
    thumbs = getattr(entry, "media_thumbnail", None)
    if thumbs and thumbs[0].get("url"):
        return thumbs[0]["url"]
    # media:content with image type
    for mc in getattr(entry, "media_content", []):
        if mc.get("medium") == "image" or (mc.get("type") or "").startswith("image/"):
            if mc.get("url"):
                return mc["url"]
    # enclosures (podcast/media RSS)
    for enc in getattr(entry, "enclosures", []):
        if (enc.get("type") or "").startswith("image/") and enc.get("url"):
            return enc["url"]
    return None


def fetch_all(conn):
    total = 0
    for feed_url, source, flag in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            limit = 30 if "google.com" not in feed_url else 20
            for entry in feed.entries[:limit]:
                text = (
                    entry.get("title", "") + " " + entry.get("summary", "")
                ).lower()
                if not any(kw in text for kw in KEYWORDS):
                    continue
                url = entry.get("link", "")
                if not url:
                    continue
                raw_image = _extract_image(entry)
                save_raw(
                    conn,
                    url=url,
                    source=source,
                    source_flag=flag,
                    title=entry.get("title", ""),
                    raw_content=entry.get("summary", ""),
                    pub_date=entry.get("published", ""),
                    raw_image=raw_image,
                )
                total += 1
        except Exception as e:
            print(f"  Feed error [{source}]: {e}")
    print(f"  Fetched {total} Kosovo-related entries")
