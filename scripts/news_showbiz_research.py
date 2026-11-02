"""Daily Albanian-artist research, refreshed through the day, with exact provenance.

Discovery only: official profiles/posts and search snippets are never substituted
for readable approved publisher articles or permission to reuse a photograph.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote_plus, urlsplit
from zoneinfo import ZoneInfo

import feedparser
from bs4 import BeautifulSoup
from cloud_news_discovery import canonical, published_at
from news_ingestion_store import Inventory, collector_lock
from news_showbiz_focus import ARTISTS, ROSTER_PATH, mentions
from news_source_policy import publisher_for, load_manifest
from news_story_attention import linked_posts
from read_news_source import fetch_public

POLICY='383-albanian-showbiz-research-v2'
REFRESH_SECONDS=4*3600
LOCAL_TIME=ZoneInfo('Europe/Belgrade')


def current(value,now,seconds=86400):
    date=published_at({'published':value})
    return bool(date and -300 <= (now-date).total_seconds() <= seconds)


def searches(artist):
    queries=[f'"{artist["name"]}" when:1d']
    domains=sorted({domain for publisher in load_manifest()['publishers']
                    if publisher['category']=='Showbiz' for domain in publisher['domains']})
    queries.append(f'"{artist["name"]}" ('+' OR '.join('site:'+domain for domain in domains)+') when:1d')
    if artist['priority']==3:
        queries.append(f'"{artist["name"]}" (Instagram OR post OR photos OR outfit OR bikini OR reacts OR deklaron OR foto) when:1d')
    return queries


def decode(url):
    if (urlsplit(url).hostname or '')!='news.google.com': return canonical(url)
    try:
        result=subprocess.run([sys.executable,str(Path(__file__).resolve()),'--decode-url',url],
            capture_output=True,text=True,encoding='utf-8',timeout=12)
        result=json.loads(result.stdout) if result.returncode==0 else {}
        return canonical(result.get('decoded_url','')) if result.get('status') else ''
    except Exception:
        return ''


def research_route(job,now,deadline,*,fetcher=fetch_public,decoder=decode):
    artist,kind,url=job['artist'],job['kind'],job['url']
    row={'artist':artist['id'],'kind':kind,'url':url,'status':'pending','checked_at':now.isoformat(),
         'leads':[],'official_posts':[]}
    if time.monotonic()>=deadline:
        return {**row,'error':'research deadline; route not attempted'}
    try:
        response=fetcher(url,max_bytes=3_000_000)
        row['resolved_url']=response['url']
        if kind=='search':
            parsed=feedparser.parse(response['payload'])
            if not parsed.get('version'): raise ValueError('search did not return RSS/Atom')
            for entry in parsed.entries:
                if time.monotonic()>=deadline:
                    row['status']='partial';row['error']='research deadline during result decoding';break
                date=published_at(entry)
                if not date or not current(date.isoformat(),now): continue
                title=str(entry.get('title') or '')
                if not mentions(title,artist): continue
                indexed_source=entry.get('source') or {}
                declared_url=indexed_source.get('href') or indexed_source.get('url')
                declared_owner=publisher_for(declared_url)
                # Other outlets remain visible discovery references, but cannot
                # supply a source-locked Showbiz article. Do not spend the whole
                # daily budget decoding unusable sources before checking artists.
                direct=decoder(str(entry.get('link') or '')) if not declared_url or (
                    declared_owner and declared_owner['category']=='Showbiz') else ''
                owner=publisher_for(direct)
                approved=bool(owner and owner['category']=='Showbiz')
                row['leads'].append({'artist':artist['id'],'title':title,'url':direct,
                    'discovery_url':str(entry.get('link') or ''),'indexed_at':date.isoformat(),
                    'source':owner['source'] if owner else str(entry.get('source',{}).get('title') or ''),
                    'indexed_publisher_url':declared_url,
                    'eligible_publisher':approved,'status':'publisher_fetch_required' if approved else
                        'outside_approved_showbiz_publishers' if declared_url and not declared_owner else
                        'unresolved_url' if not direct else 'outside_approved_showbiz_publishers',
                    'query':job.get('query','')})
        elif kind=='youtube':
            parsed=feedparser.parse(response['payload'])
            if not parsed.get('version'): raise ValueError('official channel did not return Atom')
            channel=artist['youtube_channel_id']
            feed_channel=parsed.feed.get('yt_channelid')
            if str(feed_channel or '').removeprefix('UC')!=channel.removeprefix('UC'):
                raise ValueError('Atom feed does not identify the configured artist channel')
            for entry in parsed.entries:
                date=published_at({'published':entry.get('published')})  # Never use updated as a new upload.
                if not date or date.timestamp()>now.timestamp()+300: continue
                if entry.get('yt_channelid') not in (None,channel): continue
                views=str(entry.get('media_statistics',{}).get('views',''))
                row['official_posts'].append({'artist':artist['id'],'platform':'YouTube',
                    'url':str(entry.get('link') or ''),'published':date.isoformat(),
                    'title':str(entry.get('title') or ''),'text':BeautifulSoup(str(entry.get('summary') or ''),'html.parser').get_text(' ',strip=True),
                    'author_channel_id':channel,'author_status':'official_channel_feed',
                    'observed_at':now.isoformat(),'metrics':{'views':int(views)} if views.isdigit() else {},
                    'provenance':artist['provenance'],'status':'discovery_only_pending_event_checks'
                        if current(date.isoformat(),now) else 'historical_reference_not_new_upload'})
        elif kind=='instagram':
            expected=(urlsplit(artist['instagram']).hostname or '').removeprefix('www.')
            resolved=urlsplit(response['url'])
            if (resolved.hostname or '').removeprefix('www.')!=expected or '/accounts/' in resolved.path:
                raise ValueError('official profile redirected to login or another service')
            urls=linked_posts(response['payload'],response['url'])
            row['official_posts']=[{'artist':artist['id'],'platform':'Instagram','url':post,
                'profile_url':artist['instagram'],'provenance':artist['provenance'],
                'author_status':'not_verified_for_exact_post','status':'exact_post_author_date_and_content_required'} for post in urls]
            if not urls:
                row['status']='no_public_posts'
                row['error']='No dated post inventory exposed by this public profile response; profile is not a story.'
        if row['status']=='pending': row['status']='checked'
    except Exception as exc:
        row.update(status='unavailable',error=type(exc).__name__+': '+str(exc)[:250])
    return row


def cached_report(path,now,roster_hash):
    try:
        data=json.loads(path.read_text(encoding='utf-8'))
        checked=datetime.fromisoformat(data['generated_at'])
        if (data['policy']==POLICY and data['roster_sha256']==roster_hash
                and checked.astimezone(LOCAL_TIME).date()==now.astimezone(LOCAL_TIME).date()
                and current(data['generated_at'],now,REFRESH_SECONDS)
                and data['summary']['pending_routes']==0): return data
    except (OSError,ValueError,TypeError,KeyError): pass
    return None


def queue_leads(data,state):
    """Search evidence only seeds the same durable, source-locked article queue."""
    if not state: return 0
    with collector_lock(state) as acquired:
        if not acquired: return None  # Background ingestion owns mutation; retry on the next pass.
        store=Inventory(state)
        count=0
        try:
            for lead in data['publisher_leads']:
                owner=publisher_for(lead['url'])
                if not owner or owner['category']!='Showbiz': continue
                store.enqueue(dict(source=owner['source'],kind='article',url=lead['url'],priority=-2,
                    hint={'title':lead['title'],'artist_research_id':lead['artist'],
                          'discovered_via':'targeted_artist_research'}),data['generated_at'],refresh=False)
                count+=1
            store.db.commit()
        finally: store.close()
    return count


def write_memo(data,path):
    lines=['# Daily Albanian artist and Showbiz research', '',
           'Generated: '+data['generated_at'],'Local day: '+data['local_day'],
           'Research/discovery only. Recheck original article dates and exact posts; unavailable metrics do not establish virality.',
           '', 'Coverage: '+json.dumps(data['summary'],ensure_ascii=False),'']
    for artist in ARTISTS:
        lines+=['## '+artist['name']]
        for route in data['routes']:
            if route['artist']==artist['id']:
                lines+=['- '+route['kind']+': '+route['status']+' — '+route['url']]
                if route.get('error'): lines+=['  '+route['error']]
                for lead in route['leads']:
                    lines+=['  - '+lead['title']+' — '+(lead['url'] or lead['discovery_url'])+' ['+lead['status']+']']
                for post in route['official_posts']:
                    lines+=['  - '+post.get('title','Exact post requires verification')+' — '+post['url']+' ['+post['status']+']']
    path.write_text('\n'.join(lines)+'\n',encoding='utf-8')


def run_research(folder,state=None,*,budget_seconds=120,now=None,force=False,artists=None,
                 fetcher=fetch_public,decoder=decode):
    now=now or datetime.now(timezone.utc)
    folder=Path(folder); folder.mkdir(parents=True,exist_ok=True)
    path=folder/'current.json'
    publishers=[{'source':p['source'],'domains':p['domains']} for p in load_manifest()['publishers'] if p['category']=='Showbiz']
    roster_hash=hashlib.sha256(ROSTER_PATH.read_bytes()+json.dumps(publishers,sort_keys=True).encode()).hexdigest()
    if artists is None and not force:
        data=cached_report(path,now,roster_hash)
        if data:
            data['cache_used']=True; data['queued_articles']=queue_leads(data,state)
            return data
    selected=artists if artists is not None else ARTISTS
    previous={}
    prior=None
    try:
        prior=json.loads(path.read_text(encoding='utf-8'))
        if (not force and prior['policy']==POLICY and prior['roster_sha256']==roster_hash and current(prior['generated_at'],now,REFRESH_SECONDS)
                and prior['local_day']==now.astimezone(LOCAL_TIME).date().isoformat()):
            previous={(r['artist'],r['kind'],r['url']):r for r in prior['routes']
                      if r['status'] not in {'pending','partial'}}
    except (OSError,KeyError,ValueError,TypeError): pass
    jobs=[]
    for artist in selected:
        for query in searches(artist):
            jobs.append({'artist':artist,'kind':'search','query':query,
                         'url':'https://news.google.com/rss/search?q='+quote_plus(query)+'&hl=en&gl=US&ceid=US:en'})
        if artist.get('youtube_channel_id'):
            jobs.append({'artist':artist,'kind':'youtube','url':'https://www.youtube.com/feeds/videos.xml?channel_id='+artist['youtube_channel_id']})
        if artist.get('instagram'):
            jobs.append({'artist':artist,'kind':'instagram','url':artist['instagram']})
    deadline=time.monotonic()+max(0,budget_seconds)
    def run(job):
        return previous.get((job['artist']['id'],job['kind'],job['url'])) or research_route(
            job,now,deadline,fetcher=fetcher,decoder=decoder)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        routes=list(pool.map(run,jobs))
    leads={lead['url']:lead for route in routes for lead in route['leads'] if lead['eligible_publisher']}
    posts={post['url']:post for route in routes for post in route['official_posts']}
    old_posts={p['url']:p for p in (prior or {}).get('official_posts',[])}
    for url,post in posts.items():
        old=old_posts.get(url,{})
        try:
            hours=(datetime.fromisoformat(post['observed_at'])-datetime.fromisoformat(old['observed_at'])).total_seconds()/3600
            delta=post['metrics']['views']-old['metrics']['views']
            if hours>0 and delta>=0:
                post['observed_growth']={'views_added':delta,'hours':round(hours,3),
                    'views_per_hour':round(delta/hours,1),'basis':'same_official_video_two_public_feed_observations',
                    'viral_status':'not_established'}
        except (KeyError,ValueError,TypeError): pass
    data={'policy':POLICY,'generated_at':now.isoformat(),'local_day':now.astimezone(LOCAL_TIME).date().isoformat(),
          'roster_sha256':roster_hash,'cache_used':False,'routes':routes,
          'publisher_leads':list(leads.values()),'official_posts':list(posts.values()),
          'summary':{'artists':len(selected),'routes':len(routes),
                     'attempted_routes':sum(r['status']!='pending' for r in routes),
                     'pending_routes':sum(r['status'] in {'pending','partial'} for r in routes),
                     'unavailable_routes':sum(r['status'] in {'unavailable','no_public_posts'} for r in routes),
                     'approved_publisher_leads':len(leads),
                     'official_post_leads':sum(p['status']!='historical_reference_not_new_upload' for p in posts.values()),
                     'historical_posts':sum(p['status']=='historical_reference_not_new_upload' for p in posts.values()),
                     'coverage_complete':all(r['status']=='checked' for r in routes)}}
    data['queued_articles']=queue_leads(data,state)
    stamp=now.strftime('%Y%m%dT%H%M%SZ')
    archive=folder/('research-'+stamp+'.json')
    archive.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temporary=folder/'current.tmp'
    temporary.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); temporary.replace(path)
    write_memo(data,folder/'current.md')
    return data


def attach_context(leads,research):
    for lead in leads:
        if lead.get('category')!='Showbiz': continue
        matches=[a for a in ARTISTS if mentions(lead.get('title','')+' '+str(lead.get('summary',''))[:350],a)]
        ids={a['id'] for a in matches}
        lead['artist_research']={'generated_at':research['generated_at'],
            'status':'discovery_only_not_factual_confirmation',
            'official_posts':[p for p in research['official_posts'] if p['artist'] in ids
                              and p['status']!='historical_reference_not_new_upload'],
            'route_statuses':[{key:r[key] for key in ('artist','kind','status')} for r in research['routes'] if r['artist'] in ids]}
    return leads


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--decode-url',help=argparse.SUPPRESS)
    parser.add_argument('--state',type=Path)
    parser.add_argument('--budget',type=float,default=180)
    parser.add_argument('--force',action='store_true')
    args=parser.parse_args()
    if args.decode_url:
        import requests
        from functools import partial
        from googlenewsdecoder import gnewsdecoder
        requests.get=partial(requests.get,timeout=(4,6))
        requests.post=partial(requests.post,timeout=(4,6))
        print(json.dumps(gnewsdecoder(args.decode_url))); raise SystemExit(0)
    if not args.output: parser.error('--output is required')
    result=run_research(args.output,args.state,budget_seconds=args.budget,force=args.force)
    print(json.dumps(result['summary'],ensure_ascii=False),flush=True)
