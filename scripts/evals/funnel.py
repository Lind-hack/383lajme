import os
ROOT=os.environ.get('L383_EVAL_ROOT','D:/383-evals')
import json,glob,sys,collections,os
sys.stdout.reconfigure(encoding='utf-8')
for d in ['showbiz','ekonomi','bote']:
    for r in sorted(glob.glob(f'{ROOT}/runs/{d}/run-*'),key=lambda p:int(p.split('-')[-1])):
        try:o=json.load(open(r+'/state/hourly-runs/outcome.json',encoding='utf-8'))
        except Exception: continue
        v=o.get('visual_review',{}); log=open(r+'/log.txt',encoding='utf-8',errors='replace').read()
        calls=[json.loads(l) for l in open(r+'/model-calls.jsonl',encoding='utf-8')] if os.path.exists(r+'/model-calls.jsonl') else []
        print(f"{d} {r.split('-')[-1]:>2} {o.get('status'):12} read {o.get('readable_candidates')} pubs {o.get('readable_publishers')} rev {v.get('reviewed_articles')} comp {v.get('competitive_articles')} ready {o.get('writer_ready')} drafts {o.get('saved_drafts')} appr {o.get('approvals')} qa {o.get('qa_approved')} | editor keep {log.count('383 EDITOR KEEP')+log.count('383 EDITOR CORRECT')} drop {log.count('383 EDITOR DROP')} held {log.count('383 STORY HELD')} | calls {len(calls)} ${sum(c.get('cost_usd') or 0 for c in calls):.2f} | {o.get('shortfall_reasons')}")
