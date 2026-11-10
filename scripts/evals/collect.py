"""EVAL: one row per story a run touched, with where it ended up and why."""
import os
ROOT=os.environ.get('L383_EVAL_ROOT','D:/383-evals')
import json,glob,re,sys,os,collections
sys.stdout.reconfigure(encoding='utf-8')
def runs(prefix='run'):
    for d in ['showbiz','ekonomi','bote']:
        for r in sorted(glob.glob(f'{ROOT}/runs/{d}/{prefix}-*'),key=lambda p:int(p.split('-')[-1])):
            if os.path.exists(r+'/state/hourly-runs/outcome.json'): yield d,r
def stories(prefix='run'):
    out=[]
    for d,r in runs(prefix):
        log=open(r+'/log.txt',encoding='utf-8',errors='replace').read()
        ev={}
        try:
            for row in json.load(open(r+'/state/qa-reliable/outcome/evaluations.json',encoding='utf-8')): ev[row['url']]=row
        except Exception: pass
        approved={}
        for p in glob.glob(r+'/state/qa-reliable/reserve/*/*.json'):
            try: e=json.load(open(p,encoding='utf-8')); approved[e['article']['url']]=e['article']
            except Exception: pass
        drafts={}
        for p in sorted(glob.glob(r+'/model-calls.d/*.prompt.txt')):
            t=open(p,encoding='utf-8').read()
            if 'Write ONE original Albanian article' not in t: continue
            a=open(p.replace('.prompt.','.answer.'),encoding='utf-8').read()
            m=re.search(r'"url":\s*"(https://[^"]+)"',t[t.find('COMPLETE REFERENCE'):]); url=m.group(1) if m else ''
            s,e=a.rfind('383_JSON_BEGIN'),a.rfind('383_JSON_END')
            try: row=json.loads(a[s+14:e])[0]; url=row.get('url') or url
            except Exception: row=None
            if url: drafts[url]=row
        held={m.group(1):m.group(2) for m in re.finditer(r'383 STORY HELD (\S+): (.*)',log)}
        dropped={m.group(1):m.group(2) for m in re.finditer(r"383 EDITOR DROP url='([^']+)' reason=(.*)",log)}
        rejected=dict(re.findall(r'REJECTED copyright candidate (\S+): (.*)',log))
        for url in {*ev,*drafts,*held,*approved}:
            row=ev.get(url,{}); rv=row.get('review',{}) or {}; dr=drafts.get(url) or approved.get(url)
            slug=(dr or {}).get('slug','')
            if url in approved: end,why='approved',''
            elif url in dropped: end,why='editor_drop',dropped[url]
            elif slug in rejected: end,why='originality_reject',rejected[slug]
            elif url in held:
                h=held[url]
                end=('gate_overlap' if 'exact source overlap' in h else 'gate_banned_topic' if 'banned topic' in h else 'writer_failed' if 'news_model_response' in h
                     else 'gate_other' if 'checks failed' in h else 'held_other'); why=h
            elif url in drafts: end,why='draft_unfinished',''
            elif rv.get('decision')=='consider' and rv.get('score',0)>=4: end,why='competitive_not_written',''
            elif row.get('status')=='reviewed': end,why='review_'+str(rv.get('decision')),rv.get('reason','')
            else: end,why='not_reviewed',row.get('status','')
            out.append(dict(cat=d,run=int(r.split('-')[-1]),url=url,source=row.get('source') or (dr or {}).get('source',''),title=(dr or {}).get('title') or row.get('title',''),
                            source_title=row.get('title',''),review_score=rv.get('score'),end=end,why=why[:400],words=len(re.sub('<[^>]+>',' ',(dr or {}).get('body','')).split()) if dr else 0,
                            body=(dr or {}).get('body',''),drafted=url in drafts or url in approved))
    return out
if __name__=='__main__':
    prefix=sys.argv[1] if len(sys.argv)>1 else 'run'
    rows=stories(prefix); json.dump(rows,open(f'stories-{prefix}.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
    for d in ['showbiz','ekonomi','bote']:
        s=[r for r in rows if r['cat']==d]; n=len({r['run'] for r in s})
        print(f'\n== {d}: {n} runs, {len({r["url"] for r in s})} distinct stories touched')
        print('  ends:',dict(collections.Counter(r['end'] for r in s).most_common()))
        dr=[r for r in s if r['drafted']]; print('  drafted',len(dr),'approved',sum(r['end']=='approved' for r in s),'approved/run %.1f'%(sum(r['end']=='approved' for r in s)/max(n,1)))
