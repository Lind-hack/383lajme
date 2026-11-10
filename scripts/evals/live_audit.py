import json,re,urllib.request,html,concurrent.futures as cf,collections,statistics
def get(slug):
    try: return urllib.request.urlopen(urllib.request.Request('https://383ks.com/article/'+slug,headers={'User-Agent':'383-eval'}),timeout=60).read().decode('utf-8','replace')
    except Exception as e: return ''
txt=lambda s: re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s))).strip()
rows=[(c,i) for c in ['showbiz','ekonomi','bote'] for i in json.load(open(c+'.json',encoding='utf-8'))['items']]
def one(ci):
    c,i=ci; h=get(i['slug'])
    dd=re.findall(r'ctx-label">([^<]+)</dt>\s*<dd[^>]*>(.*?)</dd>',h,re.S)
    card={k:txt(v) for k,v in dd}
    m=re.search(r'<div style="font-size:17px;line-height:1.85[^>]*>(.*?)<section class="pyet-block',h,re.S)
    body=m.group(1) if m else ''
    paras=[txt(p) for p in re.findall(r'<p style="margin:0 0 28px">(.*?)</p>',body,re.S)]
    media=re.findall(r'class="ctx-media-source" href="([^"]+)"',h)
    return dict(cat=c,slug=i['slug'],title=i['title'],excerpt=i['excerpt'],date=i['publishedAt'][:16],ok=bool(h),
      what=card.get('Çfarë ndodhi',''),why=card.get('Pse ndodhi',''),labels=list(card),
      paras=paras,words=sum(len(p.split()) for p in paras),media=[html.unescape(u) for u in media],
      nfig=h.count('ctx-fig'),chart=h.count('ctx-chart'),img=i.get('imageUrl') or '')
with cf.ThreadPoolExecutor(6) as ex: out=list(ex.map(one,rows))
json.dump(out,open('audit.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
host=lambda u: re.sub(r'https?://(www\.)?([^/]+)/.*',r'\2',u)
for c in ['showbiz','ekonomi','bote']:
    s=[o for o in out if o['cat']==c and o['ok']]; w=[o['words'] for o in s]
    print('\n==',c,len(s),'words med',statistics.median(w),'min',min(w),'max',max(w),'<50:',sum(x<50 for x in w),'<120:',sum(x<120 for x in w),'>220:',sum(x>220 for x in w))
    print(' card what',sum(bool(o['what']) for o in s),'why',sum(bool(o['why']) for o in s),'labels',collections.Counter(l for o in s for l in o['labels']))
    print(' with media',sum(bool(o['media']) for o in s),collections.Counter(host(u) for o in s for u in o['media']).most_common(8))
    print(' figs',sum(o['nfig']>0 for o in s),'charts',sum(o['chart']>0 for o in s))
    print(' img hosts',collections.Counter(host(o['img']) for o in s).most_common(12))
    print(' titlelen med',statistics.median(len(o['title']) for o in s),'paras med',statistics.median(len(o['paras']) for o in s))
