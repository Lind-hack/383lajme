"""EVAL: how much would an average Kosovo reader care about each headline? Haiku judge."""
import os
ROOT=os.environ.get('L383_EVAL_ROOT','D:/383-evals')
import json,sys,os,subprocess,shutil,re
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
RUBRIC = """You judge headlines for 383, a general news site for ordinary readers in Kosovo (Albanian speakers; they also follow Albania, the diaspora in Switzerland/Germany, big world events, football, famous global and Albanian celebrities, prices, wages, jobs, travel, tech they use).
Score each headline for the AVERAGE reader, not a specialist:
5 = most readers would click: directly affects them or names someone/something nearly everyone knows, with a real development
4 = clearly interesting to many readers
3 = fine, some readers care
2 = niche: only fans of a small scene, or a local matter of another country with no stake for Kosovo readers
1 = almost no reader in Kosovo would care or even know the subject
Also give: known = true if the main person/company/place is widely known in Kosovo; stake = true if the story changes something for the reader (money, safety, travel, rights, a team or star they follow) or is a major world event.
Return ONLY a JSON array, one object per headline, in order: {"i": <number>, "score": 1-5, "known": true/false, "stake": true/false, "why": "<max 8 words>"}."""
def ask(prompt):
    env={k:v for k,v in os.environ.items() if k!='ANTHROPIC_API_KEY'}
    done=subprocess.run([shutil.which('claude'),'-p','--model','haiku','--tools','','--strict-mcp-config','--disable-slash-commands','--no-session-persistence','--setting-sources','','--system-prompt','You are a strict news editor. Return only JSON.'],input=prompt,capture_output=True,text=True,encoding='utf-8',cwd=ROOT+'/shim/cwd',env=env)
    m=re.search(r'\[.*\]',done.stdout,re.S)
    return json.loads(m.group(0))
def judge(items):
    out=[]
    for s in range(0,len(items),40):
        part=items[s:s+40]
        listing='\n'.join(f'{i}. [{it["cat"]}] {it["title"]}' for i,it in enumerate(part))
        for attempt in range(2):
            try:
                rows=ask(RUBRIC+'\n\nHEADLINES:\n'+listing); assert len(rows)==len(part); break
            except Exception as e: rows=None
        for it,row in zip(part,rows or [{}]*len(part)): out.append({**it,**{k:row.get(k) for k in ('score','known','stake','why')}})
    return out
if __name__=='__main__':
    src,dst=sys.argv[1],sys.argv[2]
    items=[{'cat':o['cat'],'title':o['title'],**{k:o[k] for k in o if k in('slug','date','source','stage','run')}} for o in json.load(open(src,encoding='utf-8'))]
    out=judge(items); json.dump(out,open(dst,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    import collections,statistics
    for c in sorted({o['cat'] for o in out}):
        s=[o for o in out if o['cat']==c and o.get('score')]
        print(c,len(s),'mean',round(statistics.mean(o['score'] for o in s),2),'dist',sorted(collections.Counter(o['score'] for o in s).items()),'niche(<=2) %d%%'%(100*sum(o['score']<=2 for o in s)/len(s)),'known %d%%'%(100*sum(bool(o['known']) for o in s)/len(s)),'stake %d%%'%(100*sum(bool(o['stake']) for o in s)/len(s)))
