#!/usr/bin/env python3
"""Append fresh current-day leads from additional direct publisher RSS/Atom feeds."""
from __future__ import annotations
import email.utils
import html
import re
import ssl
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

OUT = Path('data/automation/cloud-news-discovery-current.md')
TZ = ZoneInfo('Europe/Belgrade')
UA = 'Mozilla/5.0 (compatible; 383Lajme/1.0; +https://383ks.com)'
FEEDS = {
    'Balkan Insight': 'https://balkaninsight.com/feed/',
    'Radio Free Europe/Radio Liberty': 'https://www.rferl.org/api/zp$e_ovj$om',
    'Euronews': 'https://www.euronews.com/rss?format=mrss',
    'The Guardian World': 'https://www.theguardian.com/world/rss',
    'The Guardian Technology': 'https://www.theguardian.com/uk/technology/rss',
    'The Guardian Football': 'https://www.theguardian.com/football/rss',
    'Al Jazeera': 'https://www.aljazeera.com/xml/rss/all.xml',
    'TechCrunch': 'https://techcrunch.com/feed/',
    'MIT Technology Review': 'https://www.technologyreview.com/feed/',
    'DW': 'https://rss.dw.com/rdf/rss-en-all',
    'Euractiv': 'https://www.euractiv.com/feed/',
    'The Verge': 'https://www.theverge.com/rss/index.xml',
    'Ars Technica': 'https://feeds.arstechnica.com/arstechnica/index',
    'Engadget': 'https://www.engadget.com/rss.xml',
    'Sky News': 'https://feeds.skynews.com/feeds/rss/world.xml',
    'UEFA': 'https://www.uefa.com/api/v1/rss/news/',
    'AP News': 'https://rsshub.app/apnews/topics/world-news',
}

def text(el, *names):
    for name in names:
        found = el.find(name)
        if found is not None and found.text:
            return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', found.text))).strip()
    return ''

def stamp(value: str):
    if not value: return None
    try:
        d = email.utils.parsedate_to_datetime(value)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError, IndexError): pass
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError: return None

def main():
    today = datetime.now(TZ).date()
    existing = OUT.read_text(encoding='utf-8')
    urls = set(re.findall(r'^- URL: (.+)$', existing, re.M))
    added=[]
    for publisher, feed in FEEDS.items():
        try:
            payload = urlopen(Request(feed, headers={'User-Agent':UA}), timeout=20, context=ssl.create_default_context()).read()
            root=ET.fromstring(payload)
        except Exception as exc:
            print(f'EXPAND REJECT {publisher}: {type(exc).__name__}: {exc}')
            continue
        items = root.findall('.//item') + root.findall('.//{http://www.w3.org/2005/Atom}entry')
        for item in items[:30]:
            title = text(item, 'title', '{http://www.w3.org/2005/Atom}title')
            link = text(item, 'link', '{http://www.w3.org/2005/Atom}link')
            if not link:
                a=item.find('{http://www.w3.org/2005/Atom}link')
                link=a.get('href','') if a is not None else ''
            date = text(item, 'pubDate', 'published', 'updated', '{http://www.w3.org/2005/Atom}published', '{http://www.w3.org/2005/Atom}updated')
            published=stamp(date)
            if not title or not link.startswith('http') or link in urls or not published or published.astimezone(TZ).date()!=today: continue
            summary=text(item, 'description', 'summary', '{http://www.w3.org/2005/Atom}summary', '{http://purl.org/rss/1.0/modules/content/}encoded')[:600] or 'No RSS summary available.'
            added.append((title,publisher,published.astimezone(TZ).isoformat(timespec='minutes'),link,summary))
            urls.add(link)
    with OUT.open('a', encoding='utf-8') as f:
        for title,publisher,published,link,summary in added:
            f.write(f'\n## {title}\n- Lane: Direct publisher expansion\n- Publisher: {publisher}\n- Published: {published} Kosovo time\n- URL: {link}\n- Summary: {summary}\n')
    print(f'EXPAND appended {len(added)} current-day direct RSS leads')
if __name__=='__main__': main()
