"""Public discovery documents: enumerate links before editorial selection."""
import gzip
import json
import re
from io import BytesIO
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from xml.etree import ElementTree

import feedparser
from bs4 import BeautifulSoup

from cloud_news_discovery import canonical, clean_text, published_at
from news_source_policy import publisher_for


def owned(url, publisher):
    owner = publisher_for(url)
    return bool(owner and owner['source'] == publisher['source'])


def feed_items(payload, publisher, now, *, since=None):
    """All current/undated feed URLs, including off-category reporting.

    Full retrieval establishes missing dates and subsequent category checks
    decide publication eligibility. No feed-position or headline-length cap.
    """
    feed = feedparser.parse(payload)
    rows = {}
    for entry in feed.entries:
        url = canonical(entry.get('link', ''))
        if not owned(url, publisher):
            continue
        published = published_at(entry)
        if published:
            cutoff = now.timestamp()-86400 if since is None else since
            recent = cutoff <= published.timestamp() <= now.timestamp()+300
            if not recent:
                continue
        rows.setdefault(url, {'url':url, 'title':clean_text(entry.get('title')),
            'published':published.isoformat() if published else '',
            'updated':str(entry.get('updated') or '') if 'updated' in entry else '',
            'tags':[str(tag.get('term','')) for tag in entry.get('tags',[])],
            'summary':clean_text(entry.get('summary'))[:650]})
    return list(rows.values())


def feed_pages(payload, base):
    """Follow advertised Atom/RSS continuation on the same public feed host."""
    feed = feedparser.parse(payload)
    host = urlsplit(base).hostname
    return sorted({canonical(urljoin(base, link.get('href','')))
                   for link in feed.feed.get('links',[]) if link.get('rel') == 'next'
                   and urlsplit(urljoin(base,link.get('href',''))).hostname == host})


def sitemap_items(payload):
    """Parse all sitemap entries. lastmod never becomes datePublished."""
    if payload[:2] == b'\x1f\x8b':
        with gzip.GzipFile(fileobj=BytesIO(payload)) as source:
            payload = source.read(50_000_001)
    if len(payload) > 50_000_000:
        raise ValueError('sitemap exceeds the decoded XML size limit')
    if re.search(br'<!\s*(?:DOCTYPE|ENTITY)\b', payload, re.I):
        raise ValueError('sitemap declarations are not allowed')
    root = ElementTree.fromstring(payload)
    kind = root.tag.rsplit('}',1)[-1]
    if kind not in {'sitemapindex','urlset'}:
        raise ValueError('not a sitemap document')
    rows = []
    for element in root:
        fields = {child.tag.rsplit('}',1)[-1]:str(child.text or '').strip()
                  for child in element if child.tag.rsplit('}',1)[-1] in {'loc','lastmod'}}
        if not fields.get('loc'):
            continue
        for child in element.iter():
            tag = child.tag.rsplit('}',1)[-1]
            if tag == 'publication_date':
                fields['published'] = str(child.text or '').strip()
            elif tag == 'title':
                fields['title'] = str(child.text or '').strip()
        rows.append(fields)
    return kind, rows


_NON_ARTICLE = re.compile(r'\.(?:jpg|jpeg|png|gif|webp|svg|css|js|woff2?|ttf|pdf|zip|mp4|mp3)$',re.I)
_UTILITY = {'about','about-us','contact','contact-us','privacy','privacy-policy','terms','login','register','subscribe','cookies','robots.txt'}


def listing_links(payload, base, publisher, spec=None):
    """Enumerate public article links and real pagination, without slicing."""
    soup = BeautifulSoup(payload,'html.parser')
    spec = spec or {}
    articles, pages, maps, apis = {}, set(), set(), set()
    homepage_articles = {}
    prefix = str(spec.get('article_path_prefix') or '')
    for link in soup.select('a[href], link[href]'):
        url = canonical(urljoin(base,str(link.get('href') or '')))
        if not owned(url,publisher):
            continue
        rel = {str(value).casefold() for value in link.get('rel',[])}
        text = link.get_text(' ',strip=True)
        label = (text+' '+str(link.get('aria-label') or '')).casefold()
        parsed = urlsplit(url)
        query = dict(parse_qsl(parsed.query))
        if 'next' in rel or (link.name == 'a' and (
                re.search(r'\b(?:next|older|tjet[eë]r|vazhdo)\b|m[eë] shum[eë]',label)
                or text.isdigit() and (re.search(r'/page/\d+/?$',parsed.path) or query.get('page','').isdigit() or query.get('paged','').isdigit()))):
            if url != canonical(base):
                pages.add(url)
            continue
        if 'sitemap' in rel:
            maps.add(url)
            continue
        if 'https://api.w.org/' in rel:
            apis.add(url)
            continue
        if link.name != 'a':
            continue
        if link.find_parent(['nav','footer','form']) is not None:
            continue  # Preserve pagination above, but do not scrape menu labels.
        path = parsed.path.rstrip('/')
        parts = [part for part in path.split('/') if part]
        query_article = str(query.get('p','')).isdigit()
        if (not parts and not query_article) or (parts and parts[-1].casefold() in _UTILITY) or _NON_ARTICLE.search(path):
            continue
        if parts and parts[0] in {'tag','tags','author','authors','search','feed','rss','wp-json','wp-admin'}:
            continue
        if parts and parts[0] in {'category','categories'} and len(parts) <= 2:
            continue
        if prefix and not parsed.path.startswith(prefix):
            continue
        card = link.find_parent('article')
        heading = link.find(['h1','h2','h3']) or (card.find(['h1','h2','h3']) if card else None)
        title = heading.get_text(' ',strip=True) if heading else text
        if not title and not card and not prefix:
            continue
        if not heading and not card and not prefix and len(title.split()) < 2:
            continue  # Navigation labels are not evidence of article URLs.
        clock = card.find('time',datetime=True) if card else None
        articles.setdefault(url,{'url':url,'title':title,'published':str(clock.get('datetime')) if clock else ''})
        # Keep hidden links in retrieval inventory, but never call them prominent.
        hidden = any(node.has_attr('hidden') or str(node.get('aria-hidden','')).lower() == 'true'
                     or node.name in {'template','noscript','script','style'}
                     or re.search(r'(?:display\s*:\s*none|visibility\s*:\s*hidden)',str(node.get('style','')),re.I)
                     for node in [link,*link.parents] if getattr(node,'attrs',None) is not None)
        # A card's category/author/image link must not borrow its headline.
        if not hidden and (link.find(['h1','h2','h3']) is not None
                           or link.find_parent(['h1','h2','h3']) is not None):
            homepage_articles.setdefault(url,articles[url])
    return {'articles':list(articles.values()),'pages':sorted(pages),'sitemaps':sorted(maps),'wordpress':sorted(apis),
            'homepage_articles':list(homepage_articles.values())}


def wordpress_url(base, after, page=1):
    parsed = urlsplit(urljoin(base.rstrip('/')+'/', 'wp/v2/posts'))
    query = urlencode({'after':after,'orderby':'date','order':'asc','per_page':100,'page':page})
    return urlunsplit((parsed.scheme,parsed.netloc,parsed.path,query,''))


def wordpress_items(payload, publisher):
    posts = json.loads(payload)
    if not isinstance(posts,list):
        raise ValueError('not a public WordPress post array')
    result = []
    for post in posts:
        url = canonical(post.get('link',''))
        if (not owned(url,publisher) or post.get('status') != 'publish'
                or (post.get('content') or {}).get('protected')):
            continue
        published = str(post.get('date_gmt') or '')
        updated = str(post.get('modified_gmt') or '')
        result.append({'url':url,'title':clean_text((post.get('title') or {}).get('rendered')),
            'published':published+'Z' if published and not published.endswith('Z') else published,
            'updated':updated+'Z' if updated and not updated.endswith('Z') else updated})
    return result
