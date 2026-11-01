"""Public direct-post evidence; popularity claims never stand in for counters."""
import json
import re
import time
from datetime import datetime, timezone
from urllib.parse import parse_qs, urljoin, urlsplit

from bs4 import BeautifulSoup
from read_news_source import fetch_public, _article_scope


def post_url(value, base):
    try:
        url=urljoin(base,str(value or ''))
        parsed=urlsplit(url)
    except ValueError:
        return None
    host=(parsed.hostname or '').lower().removeprefix('www.')
    if parsed.scheme!='https' or parsed.username or parsed.password:
        return None
    if ((host in {'x.com','twitter.com'} and re.fullmatch(r'/[^/]+/status/\d+/?',parsed.path))
        or (host=='instagram.com' and re.fullmatch(r'/(?:p|reel)/[\w-]+/?',parsed.path))
        or (host=='tiktok.com' and re.fullmatch(r'/@[^/]+/video/\d+/?',parsed.path))
        or (host in {'youtube.com','youtu.be'} and (parsed.path=='/watch' and 'v=' in parsed.query
            or re.fullmatch(r'/(?:embed/|shorts/)?[\w-]{11}/?',parsed.path)))):
        return url
    return None


def post_identity(url):
    parsed=urlsplit(url)
    host=(parsed.hostname or '').lower().removeprefix('www.')
    if host in {'x.com','twitter.com'}:
        return 'x',parsed.path.rstrip('/').rsplit('/',1)[-1]
    if host=='instagram.com':
        return 'instagram',parsed.path.strip('/').split('/')[-1]
    if host in {'youtube.com','youtu.be'}:
        return 'youtube',(parse_qs(parsed.query).get('v') or [parsed.path.rstrip('/').rsplit('/',1)[-1]])[0]
    return host,parsed.path.rstrip('/')


def linked_posts(raw,base):
    soup=BeautifulSoup(raw,'html.parser')
    root=_article_scope(soup)
    result=[]
    for node in root.find_all(['a','iframe','blockquote']):
        if node.find_parent(['aside','nav','footer']): continue
        for key in ('href','src','data-instgrm-permalink','cite'):
            url=post_url(node.get(key),base)
            if url and url not in result: result.append(url)
    return result


def public_metrics(raw,url):
    """Only URL-bound public JSON-LD counters, never numbers in article prose."""
    soup=BeautifulSoup(raw,'html.parser')
    results=[]
    def objects(value):
        if isinstance(value,dict):
            yield value
            yield from objects(value.get('@graph',[]))
        elif isinstance(value,list):
            for item in value: yield from objects(item)
    for script in soup.find_all('script',type='application/ld+json'):
        try: rows=objects(json.loads(script.string or script.get_text()))
        except (ValueError,TypeError): continue
        for row in rows:
            kinds=row.get('@type') or []
            if not set(kinds if isinstance(kinds,list) else [kinds]) & {'SocialMediaPosting','VideoObject'}: continue
            target=row.get('url') or row.get('@id')
            if not isinstance(target,str) or post_identity(urljoin(url,target))!=post_identity(url): continue
            stats=row.get('interactionStatistic') or []
            for stat in stats if isinstance(stats,list) else [stats]:
                if not isinstance(stat,dict): continue
                kind=stat.get('interactionType')
                if isinstance(kind,dict): kind=kind.get('@type')
                kind=str(kind or '').rsplit('/',1)[-1]
                count=stat.get('userInteractionCount')
                if isinstance(count,str) and count.isdigit(): count=int(count)
                if kind in {'LikeAction','ShareAction','CommentAction','WatchAction','ViewAction'} and type(count) is int and count>=0:
                    results.append({'metric':kind,'count':count})
    return results


def collect_posts(urls,deadline,*,fetcher=fetch_public):
    records=[]
    for url in urls:
        record={'url':url,'observed_at':datetime.now(timezone.utc).isoformat(),'status':'pending','metrics':[]}
        if time.monotonic()>=deadline:
            record['error']='attention evidence deadline'
        else:
            try:
                response=fetcher(url,max_bytes=3_000_000)
                if not post_url(response['url'],url) or post_identity(response['url'])!=post_identity(url):
                    raise ValueError('direct post redirected away from the requested post')
                record['metrics']=public_metrics(response['payload'],response['url'])
                record['status']='measured' if record['metrics'] else 'no_public_counters'
                record['resolved_url']=response['url']
            except Exception as exc:
                record.update(status='unavailable',error=type(exc).__name__+': '+str(exc)[:200])
        records.append(record)
    return records
