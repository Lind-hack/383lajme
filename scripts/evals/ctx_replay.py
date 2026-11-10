"""EVAL: replay stored model answers through the card/figure checks of a given checkout (no first-call cost)."""
import json,sys,os,collections
sys.stdout.reconfigure(encoding='utf-8')
for line in (open(os.environ['L383_EVAL_ENV'],encoding='utf-8') if os.environ.get('L383_EVAL_ENV') else []):  # a file holding GOOGLE_AI_API_KEY
    if line.startswith('GOOGLE_AI_API_KEY') and '=' in line:
        k,v=line.strip().split('=',1); os.environ.setdefault(k,v.strip().strip('"'))
os.environ.setdefault('L383_SOCIAL_MODELS','gemini-3.1-flash-lite,gemini-2.5-flash')
sys.path.insert(0,sys.argv[1])
import news_article_context as ctx
c=collections.Counter(); out=[]
for x in json.load(open('ctx-results.json',encoding='utf-8')):
    m=x.get('model') or {}; row=m.get('row') or {}
    if not m.get('evidence') or not isinstance(row,dict): continue
    art=dict(title=x['title'],body=x['body'],url=x['url'],excerpt=x.get('excerpt',''))  # the card may quote the excerpt
    checks={}; card=ctx.checked_card(row,art,m['evidence'],checks)
    fig=ctx.checked_figures(row.get('figures'),art,m['evidence'])
    new='figures' in ctx.second_look.__code__.co_varnames
    if card['why'] or (new and fig):
        look=(ctx.second_look(art,card,row.get('why_quotes'),[],fig) if new else ctx.second_look(art,card,row.get('why_quotes'),[])) or {}
        if card['why'] and look.get('why_supported') is not True: card['why']='' ; checks['why']='second_look_refused'
        if new and fig and look.get('figures_on_topic') is not True: fig=None; checks['figures']='off_topic'
    c['n']+=1; c['what']+=bool(card['what']); c['why']+=bool(card['why']); c['figures']+=bool(fig)
    for k,v in checks.items(): c[f'{k}:{v}']+=1
    out.append(dict(title=x['title'],category=x['category'],what=card['what'],why=card['why'],figures=fig,checks=checks))
print(dict(c)); json.dump(out,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False,indent=1)
