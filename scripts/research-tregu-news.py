"""Bounded original-page research for open non-sports markets, stored privately.

RSS supplies discovery and publication timestamps, never the scoring body.
No model calls, news publication, prices, positions or payouts are changed here.
"""
import argparse, concurrent.futures, hashlib, json, os, re, unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit
import feedparser, requests
from read_news_source import read

ROOT=Path(os.environ.get('L383_REPO') or Path(__file__).resolve().parent.parent)
NOW=datetime.now(timezone.utc)

def fold(value):
    return ''.join(c for c in unicodedata.normalize('NFKD',str(value).lower()) if not unicodedata.combining(c))

def terms(market):
    entities=(market.get('pre_match_analysis') or {}).get('proposition',{}).get('entities',[])
    if entities:return [x for x in entities if len(x)>=2]
    return [x for x in re.findall(r'\b[A-ZÇË][a-zA-ZçëÇË]{1,}\b',market['question']) if x not in ('Brenda','Gjate')]

def has_term(text,term):
    # Albanian case endings and English names refer to the same named party.
    aliases=[('shqiper',r'(?:shqiper\w*|albania\w*)'),('izrael',r'(?:izrael\w*|israel\w*)'),
        ('liban',r'(?:liban\w*|lebanon|lebanese)'),('rusi',r'(?:rusi\w*|russia\w*)'),
        ('ukrain',r'ukrain\w*'),('bitcoin',r'(?:bitcoin|btc)')]
    for prefix,pattern in aliases:
        if fold(term).startswith(prefix):return re.search(r'(?<!\w)'+pattern+r'(?!\w)',fold(text)) is not None
    if not re.fullmatch('[A-Z]{2,3}',term):text,term=fold(text),fold(term)
    return re.search(r'(?<!\w)'+re.escape(term)+r'(?!\w)',text) is not None

COUNTRY_ALIASES={
    'kosov':('kosov',), 'shqiper':('shqiper','albania','albanian'),
    'spanj':('spanj','spain','spanish','espana'),
    'argjentin':('argjentin','argentina','argentine'),
    'britan':('britan','britain','british','uk'),
    'mbreteria e bashkuar':('britain','british','united kingdom','uk'),
    'serbi':('serbi','serbia','serbian'),
    'franc':('franc','france','french'),
    'gjerman':('gjerman','germany','german'),
    'shba':('shba','usa','united states','american'),
}
GENERIC_ENTITY_WORDS={'qeveria','qeverise','presidenti','presidentit','kuvendi','kuvendit',
    'kongresi','kongresit','deputeteve','tribunali','nderkombetar','kombetar','ministria',
    'republika','shteti','bashkuar','drejten','detit','the','of','and'}
GENERIC_TOPIC_WORDS={'resolution','decision','action','market','official','formal','government',
    'country','world','kosovo','albania','spain','argentina','serbia','france','united','kingdom'}
TOPIC_ALIASES={
    'presidency':('presiden',), 'president':('presiden',),
    'eviction':('evict','eviction','deport','debim'),
    'tariff':('tariff','tarif'), 'lawsuit':('lawsuit','legal','padi','court'),
    'legal':('legal','lawsuit','padi','court','tribunal'),
    'election':('elect','election','zgjedh','vote','vot'),
    'appointment':('appoint','emer','zgjedh','selection'),
    'legislation':('legislat','law','bill','ligj','congress','parliament'),
    'ban':('ban','ndalim','ndalo'),
}

def match_variant(text,variant):
    words=fold(variant).split()
    if len(words)>1:return ' '.join(words) in fold(text)
    return re.search(r'(?<!\w)'+re.escape(words[0])+r'\w*',fold(text)) is not None

def entity_variants(market):
    result=set()
    for name in terms(market):
        normalized=fold(name)
        if len(normalized)>4:result.add(normalized)
        for prefix,aliases in COUNTRY_ALIASES.items():
            if prefix in normalized:result.update(aliases)
        for word in re.findall(r'[a-z]{4,}',normalized):
            if word not in GENERIC_ENTITY_WORDS and not any(prefix in word for prefix in COUNTRY_ALIASES):
                result.add(word)
    return result

def topic_variants(market):
    analysis=market.get('pre_match_analysis') or {}
    key=fold(analysis.get('topic_key') or '')
    question=fold(market.get('question') or '')
    result=set()
    for word in re.findall(r'[a-z]{4,}',key):
        if word not in GENERIC_TOPIC_WORDS:
            result.add(word)
            result.update(TOPIC_ALIASES.get(word,()))
    for word in re.findall(r'[a-z]{5,}',question):
        if word.startswith(('presiden','debim','zgjedh','vot','tarif','ligj','padi')):
            result.add(word[:6])
    return result

def lead_score(market,lead):
    if lead.get('parent_slug') in set(market.get('source_article_slugs') or []):return 1000
    text=lead.get('title','')+' '+lead.get('summary','')
    entity_hits=sum(match_variant(text,variant) for variant in entity_variants(market))
    if not entity_hits:return 0
    topic_hits=sum(match_variant(text,variant) for variant in topic_variants(market))
    if not topic_hits:return 0
    return min(entity_hits,4)*10+min(topic_hits,5)*3

def persisted_leads(base,headers,markets):
    """Use newsroom rows only to discover direct publisher URLs, never as scoring text."""
    since=(NOW-timedelta(days=14)).isoformat()
    response=requests.get(base+'/rest/v1/news_articles',headers=headers,params={
        'select':'slug,url,title,excerpt,published_at,source',
        'published_at':'gte.'+since,'order':'published_at.desc','limit':'500'},timeout=20)
    response.raise_for_status()
    rows=response.json()
    pinned={str(slug) for market in markets for slug in market.get('source_article_slugs') or []}
    if pinned:
        response=requests.get(base+'/rest/v1/news_articles',headers=headers,params={
            'select':'slug,url,title,excerpt,published_at,source,raw_article',
            'slug':'in.('+','.join(sorted(pinned))+')','limit':'100'},timeout=20)
        response.raise_for_status()
        pinned_rows=response.json()
        rows.extend(pinned_rows)
    else:pinned_rows=[]
    leads=[];seen=set()
    for row in rows:
        url=str(row.get('url') or '')
        published=str(row.get('published_at') or '')
        try:age=NOW-datetime.fromisoformat(published.replace('Z','+00:00'))
        except (ValueError,TypeError):continue
        if not timedelta(0)<=age<=timedelta(days=14):continue
        if urlsplit(url).scheme!='https' or 'google.com' in (urlsplit(url).hostname or ''):continue
        if url not in seen:
            seen.add(url)
            leads.append({'url':url,'title':str(row.get('title') or ''),
                'summary':str(row.get('excerpt') or ''),'source':str(row.get('source') or ''),
                'publishedAt':published,'parent_slug':row.get('slug')})
    for row in pinned_rows:
        raw=row.get('raw_article') or {}
        if not isinstance(raw,dict):continue
        for item in raw.get('corroborating_sources') or []:
            if not isinstance(item,dict):continue
            url=str(item.get('url') or '')
            if url in seen or urlsplit(url).scheme!='https' or 'google.com' in (urlsplit(url).hostname or ''):continue
            seen.add(url)
            leads.append({'url':url,'title':str(row.get('title') or ''),
                'summary':str(row.get('excerpt') or ''),'source':str(item.get('source') or ''),
                'publishedAt':str(row.get('published_at') or ''),'parent_slug':row.get('slug')})
    return leads

def feed(spec):
    try:
        with requests.get(spec['url'],timeout=(5,12),stream=True) as r:
            r.raise_for_status(); chunks=[];size=0
            for chunk in r.iter_content(65536):
                size+=len(chunk)
                if size>3_000_000:raise ValueError('oversized feed')
                chunks.append(chunk)
        entries=[]
        for e in feedparser.parse(b''.join(chunks)).entries[:100]:
            stamp=e.get('published_parsed')
            if not stamp:continue
            published=datetime(*stamp[:6],tzinfo=timezone.utc)
            if not NOW-timedelta(days=14)<=published<=NOW:continue
            url=e.get('link','')
            if urlsplit(url).scheme!='https' or 'google.com' in (urlsplit(url).hostname or ''):continue
            entries.append({'url':url,'title':e.get('title',''),'summary':e.get('summary',''),
                'source':spec['source'],'publishedAt':published.isoformat()})
        return entries,{'source':spec['source'],'status':'ok','leads':len(entries)}
    except Exception as exc:return [],{'source':spec['source'],'status':'unavailable','error':type(exc).__name__}

def original(lead):
    try:
        data=read(lead['url'])
        if data.get('status')!='text_extracted' or len(data.get('text','').split())<80:return None
        # A preview or partial extraction cannot support final settlement.
        final_url=data['url']
        title=data.get('title') or ''
        parts=re.split(r'\s+(?:\||-|–|—)\s+',title)
        if len(parts)>1 and fold(parts[-1]).replace(' ','')==fold(lead.get('source','')).replace(' ',''):
            title=' - '.join(parts[:-1])
        published=lead['publishedAt']
        source_published=data.get('published')
        if source_published:
            try:
                parsed=datetime.fromisoformat(str(source_published).replace('Z','+00:00'))
                if parsed.tzinfo is None:parsed=parsed.replace(tzinfo=timezone.utc)
                discovered=datetime.fromisoformat(str(published).replace('Z','+00:00'))
                if discovered.tzinfo is None:discovered=discovered.replace(tzinfo=timezone.utc)
                if parsed<=discovered:published=parsed.isoformat()
            except (TypeError,ValueError):pass
        return {'slug':'research-'+hashlib.sha256(final_url.encode()).hexdigest()[:24],
            'title':title, 'excerpt':data['text'][:400],
            'body':data['text'],'source':urlsplit(final_url).hostname.removeprefix('www.'),'url':final_url,
            'discovery_url':lead['url'],
            'publishedAt':published,'category':'Botë','verification':'original_page_extracted',
            'fetchedAt':NOW.isoformat(),'truncated':data.get('truncated',False)}
    except Exception:return None

def main(dry_run=False,output=None):
    from codex_automation_support import load_env
    load_env()
    base=os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
    token=os.environ['SUPABASE_SERVICE_ROLE_KEY']
    headers={'apikey':token,'Authorization':'Bearer '+token}
    r=requests.get(base+'/rest/v1/markets',headers=headers,params={
        'select':'id,question,pre_match_analysis,source_article_slugs,category,live_event,sport_outcomes',
        'status':'eq.open','market_classification':'eq.general_news','market_type':'eq.binary'},timeout=20)
    r.raise_for_status()
    markets=[m for m in r.json() if m['category'] not in ('sport','f1','football','basketball') and not m['live_event'] and m['sport_outcomes'] is None]
    specs=json.loads((ROOT/'scripts/news_sources.json').read_text())['feeds']
    specs=[s for s in specs if s.get('kind')!='html']
    specs.append({'url':'https://openai.com/news/rss.xml','source':'OpenAI'})
    leads=[];audits=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for found,audit in pool.map(feed,specs):leads.extend(found);audits.append(audit)
    try:
        newsroom_leads=persisted_leads(base,headers,markets)
        newsroom_status='ok'
    except (requests.RequestException,ValueError,TypeError):
        # RSS can still supply directly extracted original pages during a
        # transient newsroom-row lookup failure.
        newsroom_leads=[]
        newsroom_status='unavailable'
    leads.extend(newsroom_leads)
    selected={};by_market={}
    for market in markets:
        ranked=sorted(leads,key=lambda x:lead_score(market,x),reverse=True)
        chosen=list({x['url']:x for x in ranked if lead_score(market,x)>0}.values())[:18]
        by_market[market['id']]=[x['url'] for x in chosen]
        selected.update({x['url']:x for x in chosen})
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        extracted={x['discovery_url']:x for x in pool.map(original,selected.values()) if x}
    payload={'generated_at':NOW.isoformat(),'sources':audits,
        'markets':{mid:[extracted[u] for u in urls if u in extracted] for mid,urls in by_market.items()}}
    if output:
        if not dry_run:raise ValueError('research packet output is available only during dry runs')
        Path(output).write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
    if not dry_run:
        result=requests.post(base+'/storage/v1/object/market-research/latest.json',headers={**headers,
            'Content-Type':'application/json','x-upsert':'true'},data=json.dumps(payload,ensure_ascii=False).encode(),timeout=30)
        result.raise_for_status()
    print(json.dumps({'status':'completed','markets':len(markets),'leads':len(leads),
        'newsroom_leads':len(newsroom_leads),
        'newsroom_status':newsroom_status,
        'selected_per_market':{k:len(v) for k,v in by_market.items()},
        'originals_read':len(extracted),'evidence_per_market':{k:len(v) for k,v in payload['markets'].items()},
        'unavailable_sources':[x['source'] for x in audits if x['status']!='ok']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--dry-run',action='store_true')
    parser.add_argument('--output')
    args=parser.parse_args()
    main(args.dry_run,args.output)
