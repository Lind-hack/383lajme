"""Bounded original-page research for open non-sports markets, stored privately.

RSS supplies discovery and publication timestamps, never the scoring body.
No model calls, news publication, prices, positions or payouts are changed here.
"""
import concurrent.futures, hashlib, json, os, re, unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit
import feedparser, requests
from read_news_source import read

ROOT=Path(__file__).resolve().parent.parent
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
        return {'slug':'research-'+hashlib.sha256(final_url.encode()).hexdigest()[:24],
            'title':title, 'excerpt':data['text'][:400],
            'body':data['text'],'source':urlsplit(final_url).hostname.removeprefix('www.'),'url':final_url,
            'discovery_url':lead['url'],
            'publishedAt':lead['publishedAt'],'category':'Botë','verification':'original_page_extracted',
            'fetchedAt':NOW.isoformat(),'truncated':data.get('truncated',False)}
    except Exception:return None

def main():
    from codex_automation_support import load_env
    load_env()
    base=os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
    token=os.environ['SUPABASE_SERVICE_ROLE_KEY']
    headers={'apikey':token,'Authorization':'Bearer '+token}
    r=requests.get(base+'/rest/v1/markets',headers=headers,params={
        'select':'id,question,pre_match_analysis,category,live_event,sport_outcomes',
        'status':'eq.open','market_classification':'eq.general_news','market_type':'eq.binary'},timeout=20)
    r.raise_for_status()
    markets=[m for m in r.json() if m['category'] not in ('sport','f1','football','basketball') and not m['live_event'] and m['sport_outcomes'] is None]
    specs=json.loads((ROOT/'scripts/news_sources.json').read_text())['feeds']
    specs=[s for s in specs if s.get('kind')!='html']
    specs.append({'url':'https://openai.com/news/rss.xml','source':'OpenAI'})
    leads=[];audits=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for found,audit in pool.map(feed,specs):leads.extend(found);audits.append(audit)
    selected={};by_market={}
    for market in markets:
        names=terms(market)
        ranked=sorted(leads,key=lambda x:sum(has_term(x['title']+' '+x['summary'],t) for t in names),reverse=True)
        chosen=list({x['url']:x for x in ranked if any(has_term(x['title']+' '+x['summary'],t) for t in names)}.values())[:12]
        by_market[market['id']]=[x['url'] for x in chosen]
        selected.update({x['url']:x for x in chosen})
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        extracted={x['discovery_url']:x for x in pool.map(original,selected.values()) if x}
    payload={'generated_at':NOW.isoformat(),'sources':audits,
        'markets':{mid:[extracted[u] for u in urls if u in extracted] for mid,urls in by_market.items()}}
    result=requests.post(base+'/storage/v1/object/market-research/latest.json',headers={**headers,
        'Content-Type':'application/json','x-upsert':'true'},data=json.dumps(payload,ensure_ascii=False).encode(),timeout=30)
    result.raise_for_status()
    print(json.dumps({'status':'completed','markets':len(markets),'leads':len(leads),
        'originals_read':len(extracted),'evidence_per_market':{k:len(v) for k,v in payload['markets'].items()},
        'unavailable_sources':[x['source'] for x in audits if x['status']!='ok']}))

if __name__=='__main__':main()
