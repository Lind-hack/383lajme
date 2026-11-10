"""EVAL: run the real article-context job (dry, nothing saved) on drafts the desk runs wrote.
usage: ctx_eval.py <out.json> <limit>   -- reads writer answers from runs/*/run-*/model-calls.d
"""
import os
ROOT=os.environ.get('L383_EVAL_ROOT','D:/383-evals')
import json,sys,os,glob,re,time
sys.stdout.reconfigure(encoding='utf-8')
for line in (open(os.environ['L383_EVAL_ENV'],encoding='utf-8') if os.environ.get('L383_EVAL_ENV') else []):  # a file holding GOOGLE_AI_API_KEY
    if line.startswith('GOOGLE_AI_API_KEY') and '=' in line:
        k,v=line.strip().split('=',1); os.environ.setdefault(k,v.strip().strip('"'))
os.environ['L383_SOCIAL_PYTHON']=ROOT+'/none/python'   # X/Instagram lookups are VPS-only
os.environ.setdefault('L383_SOCIAL_MODELS','gemini-3.1-flash-lite,gemini-2.5-flash')
sys.path.insert(0,ROOT+'/wt/scripts')
import news_article_context as ctx
def drafts():
    seen={}
    for p in sorted(glob.glob(ROOT+'/runs/*/run-*/model-calls.d/*.prompt.txt')):
        t=open(p,encoding='utf-8').read()
        if not t.lstrip().startswith('All referenced documents') or 'Write ONE original Albanian article' not in t: continue
        a=open(p.replace('.prompt.','.answer.'),encoding='utf-8').read()
        s,e=a.rfind('383_JSON_BEGIN'),a.rfind('383_JSON_END')
        try: rows=json.loads(a[s+14:e])
        except Exception: continue
        m=re.search(r'"url":\s*"(https://[^"]+)"',t[t.find('COMPLETE REFERENCE'):]) 
        for r in rows:
            if not isinstance(r,dict) or not r.get('title') or not r.get('body'): continue
            url=r.get('url') or (m.group(1) if m else '')
            pid=r.get('source_pair_id')
            if not url and pid:
                mm=re.search(r'"pair_id":\s*"%s".{0,400}?"url":\s*"(https://[^"]+)"'%re.escape(pid),t,re.S) or re.search(r'"url":\s*"(https://[^"]+)".{0,400}?"pair_id":\s*"%s"'%re.escape(pid),t,re.S)
                url=mm.group(1) if mm else url
            if not url or url in seen: continue
            seen[url]=dict(r,url=url,published_at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),raw_article={'corroborating_sources':r.get('corroborating_sources') or []},run=p.split('runs')[1][1:].split('model-calls')[0])
    return list(seen.values())
raw={}
_ask=ctx.ask
def ask(article,evidence,posts):
    row=_ask(article,evidence,posts); raw[article['url']]=dict(row=row,evidence_chars=len(evidence),evidence=evidence); return row
ctx.ask=ask
out_path,limit=sys.argv[1],int(sys.argv[2])
done=json.load(open(out_path,encoding='utf-8')) if os.path.exists(out_path) else []
have={d['url'] for d in done}
for a in drafts():
    if a['url'] in have or len(done)>=limit: continue
    try: c=ctx.enrich(a)
    except Exception as e: c={'status':'error','error':repr(e)[:200]}
    done.append(dict(url=a['url'],run=a['run'],category=a.get('category'),title=a['title'],body=a['body'],context=c,model=raw.get(a['url'])))
    json.dump(done,open(out_path,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    c=c or {}
    print(a.get('category'),'|',a['title'][:60],'| what',bool(c.get('what')),'why',bool(c.get('why')),'media',len(c.get('media') or []),'fig',bool(c.get('figures')),'chart',bool(c.get('chart')),'|',c.get('checks'))
