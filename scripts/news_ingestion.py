"""Incremental public-source retrieval, independent of publication quotas."""
import concurrent.futures
import json
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from cloud_news_discovery import canonical, is_recent_for_slot, published_at
from news_ingestion_protocol import feed_items, feed_pages, listing_links, owned, sitemap_items, wordpress_items, wordpress_url
from news_ingestion_store import Inventory, collector_lock
from news_source_policy import topic_error, hourly_targets
from read_news_source import PublicHTTPError, extract, fetch_public


def seed_routes(manifest):
    """Every registered publisher is scheduled, including evidence-only sites."""
    routes = []
    for publisher in manifest['publishers']:
        name = publisher['source']
        routes += [dict(source=name,kind='feed',url=spec['url'],hint={},priority=0)
                   for spec in manifest['feeds'] if spec['source']==name]
        routes += [dict(source=name,kind='listing',url=spec['url'],hint=spec,priority=0)
                   for spec in manifest['browser_lanes'] if spec['source']==name]
        for domain in publisher['domains']:
            routes += [dict(source=name,kind='listing',url='https://'+domain+'/',hint={},priority=0),
                       dict(source=name,kind='robots',url='https://'+domain+'/robots.txt',hint={},priority=0)]
    return routes


def _date(value):
    parsed = published_at({'published':value}) if value else None
    return parsed.timestamp() if parsed else None


def _execute(task, publishers, cutoffs, now, fetcher):
    publisher = publishers[task['source']]
    if task['kind']!='feed' and not owned(task['url'],publisher):
        raise ValueError('discovery task leaves its registered publisher')
    response = fetcher(task['url'],max_bytes=8_000_000 if task['kind']=='sitemap' else 3_000_000)
    if task['kind']!='feed' and not owned(response['url'],publisher):
        raise ValueError('public route redirected outside its publisher')
    body, base = response['payload'], response['url']
    result = {'tasks':[], 'articles':[], 'evidence':None, 'index_confirmed':False}
    if task['kind']=='article':
        result['evidence'] = extract(body,base,max_text_chars=None)
        result['evidence']['fetched_at'] = datetime.now(timezone.utc).isoformat()
    elif task['kind']=='feed':
        import feedparser
        parsed = feedparser.parse(body)
        if not parsed.get('version') and not parsed.entries:
            raise ValueError('route did not return a public RSS/Atom feed')
        result['articles'] = feed_items(body,publisher,now,since=cutoffs[task['source']])
        result['tasks'] = [dict(source=task['source'],kind='feed',url=url,priority=2,hint={})
                           for url in feed_pages(body,base)]
        result['index_confirmed'] = True
    elif task['kind']=='robots':
        maps = [line.split(':',1)[1].strip() for line in body.decode('utf-8','replace').splitlines()
                if line.strip().lower().startswith('sitemap:')]
        if not maps:
            maps = [urljoin(base,'/news-sitemap.xml'),urljoin(base,'/sitemap.xml'),urljoin(base,'/sitemap_index.xml')]
        result['tasks'] = [dict(source=task['source'],kind='sitemap',url=canonical(url),priority=3,
                               hint={'optional':True}) for url in maps if owned(url,publisher)]
    elif task['kind']=='sitemap':
        kind, rows = sitemap_items(body)
        result['index_confirmed'] = True
        for row in rows:
            url = canonical(row['loc'])
            if not owned(url,publisher):
                continue
            modified = _date(row.get('lastmod'))
            if modified is not None and modified < cutoffs[task['source']]:
                continue  # Discovery lastmod is not the article publication date.
            if kind=='sitemapindex':
                result['tasks'].append(dict(source=task['source'],kind='sitemap',url=url,priority=3,hint={}))
            else:
                result['articles'].append({'url':url,'title':row.get('title',''),
                    'published':row.get('published',''),'updated':row.get('lastmod','')})
    elif task['kind']=='listing':
        links = listing_links(body,base,publisher,task['hint'])
        result['articles'] = links['articles']
        result['tasks'] = [dict(source=task['source'],kind='listing',url=url,priority=3,hint=task['hint']) for url in links['pages']]
        result['tasks'] += [dict(source=task['source'],kind='sitemap',url=url,priority=3,hint={}) for url in links['sitemaps']]
        for api in links['wordpress']:
            after = datetime.fromtimestamp(cutoffs[task['source']],timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            result['tasks'].append(dict(source=task['source'],kind='wordpress',url=wordpress_url(api,after),priority=1,
                                       hint={'api':api,'after':after,'page':1}))
    elif task['kind']=='wordpress':
        result['articles'] = wordpress_items(body,publisher)
        result['index_confirmed'] = True
        pages = int(response['headers'].get('x-wp-totalpages') or 1)
        page = task['hint']['page']
        if page < pages:
            hint = {**task['hint'],'page':page+1}
            result['tasks'].append(dict(source=task['source'],kind='wordpress',url=wordpress_url(hint['api'],hint['after'],hint['page']),priority=1,hint=hint))
    return result


def collect(manifest, state, *, budget_seconds=240, now=None, fetcher=fetch_public):
    """Collect, or read committed evidence while the background collector runs."""
    with collector_lock(state) as acquired:
        if acquired:
            return _collect(manifest,state,budget_seconds=budget_seconds,now=now,fetcher=fetcher)
        now = now or datetime.now(timezone.utc)
        started = time.time()
        deadline = time.monotonic()+budget_seconds
        publishers = {p['source']:p for p in manifest['publishers']}
        categories = {p['category'] for p in publishers.values()}
        while True:
            store = Inventory(state)
            try:
                result = _snapshot(store,publishers,now,{},started,checkpoint=False)
            finally:
                store.close()
            counts = Counter(lead['category'] for lead in result[0])
            # At morning startup the collector may own an empty/stale queue.
            # Allow it the normal discovery window to prepare every desk.
            if (all(counts[c] >= hourly_targets()[c]*4 for c in categories)
                    or not budget_seconds or time.monotonic() >= deadline):
                result[3]['collector_active'] = True
                return result
            time.sleep(min(2,max(0,deadline-time.monotonic())))


def _collect(manifest, state, *, budget_seconds=240, now=None, fetcher=fetch_public):
    """Drain the durable queue; report incomplete work rather than truncate it.

    The production publisher already holds the hourly process lock. Shadow audits
    must use a separate state file. A zero budget requests an unbounded bootstrap.
    """
    now = now or datetime.now(timezone.utc)
    started = time.time()
    run = now.isoformat()
    deadline = time.monotonic()+budget_seconds if budget_seconds else float('inf')
    publishers = {p['source']:p for p in manifest['publishers']}
    store = Inventory(state)
    store.recover()
    cutoffs = {source:store.since(source,now.timestamp()) for source in publishers}
    fields = ('requests_started','documents_retrieved','usable_indexes','articles_retrieved','readable_this_run',
              'cache_hits','failed_requests','article_links_seen','distinct_urls_seen','off_category',
              'older_than_checkpoint','optional_routes_absent')
    counters = {source:Counter({field:0 for field in fields}) for source in publishers}
    seen_urls = {source:set() for source in publishers}
    for route in seed_routes(manifest):
        store.enqueue(route,run,refresh=True)
    active = {}
    rotation = set()
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=8)
    try:
        while time.monotonic() < deadline:
            occupied = {task['source'] for task in active.values()}
            while len(active) < 8:
                ready = store.ready(limit=1,exclude_sources=tuple(occupied | rotation))
                if not ready:
                    rotation.clear()
                    ready = store.ready(limit=1,exclude_sources=tuple(occupied))
                if not ready:
                    break
                task = ready[0]
                rotation.add(task['source'])
                if task['kind']=='article' and store.evidence(task['url'],task['hint']) is not None:
                    counters[task['source']]['cache_hits'] += 1
                    store.finish(task['id'],run)
                    continue
                occupied.add(task['source'])
                store.running(task['id'])
                counters[task['source']]['requests_started'] += 1
                active[pool.submit(_execute,task,publishers,cutoffs,now,fetcher)] = task
            if not active:
                break
            done,_ = concurrent.futures.wait(active,timeout=min(1,max(0,deadline-time.monotonic())),
                                              return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                task = active.pop(future)
                counter = counters[task['source']]
                try:
                    result = future.result()
                    counter['documents_retrieved'] += 1
                    counter['usable_indexes'] += result['index_confirmed']
                    if result['evidence'] is not None:
                        evidence = result['evidence']
                        store.save_evidence(task['source'],task['url'],task['hint'],evidence)
                        counter['articles_retrieved'] += 1
                        counter['readable_this_run'] += evidence['status']=='text_extracted'
                        if evidence['status'] != 'text_extracted':
                            raise ValueError('article retrieval '+evidence['status'])
                    children = result['tasks']
                    for hint in result['articles']:
                        pub = _date(hint.get('published'))
                        if pub is not None and pub < cutoffs[task['source']]:
                            counter['older_than_checkpoint'] += 1
                            continue
                        article = dict(source=task['source'],kind='article',url=hint['url'],hint=hint,
                                       priority=1 if hint.get('published') else 2)
                        children.append(article)
                        counter['article_links_seen'] += 1
                        if hint['url'] not in seen_urls[task['source']]:
                            seen_urls[task['source']].add(hint['url'])
                            counter['distinct_urls_seen'] += 1
                    store.enqueue_many(children,run,refresh=True)
                    store.finish(task['id'],run)
                except Exception as exc:
                    # A missing guessed sitemap/robots file is an absent optional
                    # index, not successful article retrieval or an access bypass.
                    optional = task['kind']=='robots' or task['hint'].get('optional')
                    if isinstance(exc,PublicHTTPError) and exc.status==404 and optional:
                        if task['kind']=='robots':
                            for path in ('/news-sitemap.xml','/sitemap.xml','/sitemap_index.xml'):
                                store.enqueue(dict(source=task['source'],kind='sitemap',url=urljoin(task['url'],path),
                                                   priority=3,hint={'optional':True}),run,refresh=True)
                        store.finish(task['id'],run)
                        counter['optional_routes_absent'] += 1
                    else:
                        delay = 300
                        if isinstance(exc,PublicHTTPError):
                            try:delay=max(delay,float(exc.retry_after))
                            except (TypeError,ValueError):pass
                        store.fail(task['id'],type(exc).__name__+': '+str(exc),retry_after=delay)
                        counter['failed_requests'] += 1
        # Requests have finite network limits. Keep unfinished work pending;
        # no source checkpoint advances merely because the time budget ended.
    finally:
        pool.shutdown(wait=True,cancel_futures=True)
        for future,task in active.items():
            store.fail(task['id'],'crawl deadline; request result not consumed',retry_after=1)
    try:
        return _snapshot(store,publishers,now,counters,started,checkpoint=True)
    finally:
        store.close()


def _snapshot(store, publishers, now, counters, started, *, checkpoint):
    counters = {source:counters.get(source,Counter()) for source in publishers}
    leads, evidence_by_url = [], {}
    for row in store.articles(max_age=3600,status='text_extracted'):
        evidence = row['evidence']
        if (row['source'] not in publishers or evidence.get('status')!='text_extracted'
                or not 0 <= time.time()-row['fetched_at'] <= 3600):
            continue
        publisher = publishers[row['source']]
        if not owned(evidence.get('url',''),publisher):
            continue
        published = published_at({'published':evidence.get('published') or row['hint'].get('published')})
        if not published or not is_recent_for_slot(published,now):
            continue
        title, text = str(evidence.get('title') or row['hint'].get('title') or ''),str(evidence.get('text') or '')
        if topic_error(publisher['category'],title,text,tags=row['hint'].get('tags',[]),url=row['url']):
            counters[row['source']]['off_category'] += 1
            continue
        leads.append({'url':row['url'],'source':row['source'],'category':publisher['category'],
            'lane':publisher['category'].upper(),'title':title,'summary':text[:650],
            'published':published.isoformat(),'tags':row['hint'].get('tags',[]),'discovery_only':False,
            'readable_primary':True})
        evidence_by_url[row['url']] = evidence
    audits = []
    for source,publisher in publishers.items():
        status = store.source_status(source)
        complete = checkpoint and bool(counters[source]['usable_indexes']) and store.checkpoint(source,now.timestamp())
        audits.append({**status,**dict(counters[source]),'category':publisher['category'],
            'url':'https://'+publisher['domains'][0]+'/',
            'status':'complete' if complete else 'incomplete',
            'scope':'configured public feeds, listings and discovered sitemaps',
            'eligible':sum(lead['source']==source for lead in leads)})
    report = {'run':now.isoformat(),'registered_publishers':len(publishers),'elapsed_seconds':round(time.time()-started,1),
              'publishers_attempted_this_pass':sum(a.get('requests_started',0)>0 for a in audits),
              'complete_publishers':sum(a['status']=='complete' for a in audits),
              'articles_retrieved':sum(a.get('articles_retrieved',0) for a in audits),
              'cached_articles':sum(a.get('cache_hits',0) for a in audits),
              'stored_readable_articles':sum(a['stored_readable'] for a in audits),
              'eligible_articles':len(leads),
              'pending_tasks':sum(a['pending'] for a in audits),'publishers':audits}
    return leads,audits,evidence_by_url,report


if __name__ == '__main__':
    import argparse
    from news_source_policy import MANIFEST
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--budget',type=float,default=240)
    args = parser.parse_args()
    _,_,_,report = collect(MANIFEST,args.state,budget_seconds=args.budget)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temporary.replace(args.output)
    print('383 INGESTION '+json.dumps({k:v for k,v in report.items() if k!='publishers'}),flush=True)
