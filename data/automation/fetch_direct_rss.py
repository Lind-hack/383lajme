import json
import re
import ssl
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

feeds = {
    'BBC News': 'https://feeds.bbci.co.uk/news/world/rss.xml',
    'The Guardian': 'https://www.theguardian.com/world/rss',
    'Al Jazeera': 'https://www.aljazeera.com/xml/rss/all.xml',
    'Euronews': 'https://www.euronews.com/rss?format=mrss',
    'TechCrunch': 'https://techcrunch.com/feed/',
}
headers = {'User-Agent': 'Mozilla/5.0 (compatible; 383Lajme/1.0; +https://383ks.com)'}
rows = []
for publisher, feed in feeds.items():
    try:
        request = Request(feed, headers=headers)
        with urlopen(request, timeout=25, context=ssl.create_default_context()) as response:
            payload = response.read()
        root = ET.fromstring(payload)
        items = root.findall('.//item')[:8]
        for item in items:
            title = (item.findtext('title') or '').strip()
            link = (item.findtext('link') or '').strip()
            description = unescape(re.sub(r'<[^>]+>', ' ', item.findtext('description') or '')).strip()
            pubdate = (item.findtext('pubDate') or '').strip()
            rows.append({'publisher': publisher, 'feed': feed, 'headline': title, 'url': link, 'summary': re.sub(r'\s+', ' ', description), 'published': pubdate})
    except Exception as exc:
        rows.append({'publisher': publisher, 'feed': feed, 'error': f'{type(exc).__name__}: {exc}'})
Path('data/automation/direct-rss-supplement.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'wrote {len(rows)} direct RSS rows')
