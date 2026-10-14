"""One-off contextual-photo backfill. Never creates or retranslates articles."""
import argparse,json,sys
from concurrent.futures import ThreadPoolExecutor,as_completed
import httpx
from openai import AuthenticationError
from bota_gpt import SITE,secret,resolve_runtime,editorial_request,fetch_source
from bota_photo import select_bota_photo

def repair_one(article,runtime,headers,dry_run=False):
    source={'id':article['id'],'url':article['url'],'title':article['title'],'outlet':article['outlet'],
            'sourceParagraphs':article['paragraphs'],'imageUrl':article.get('imageUrl')}
    # Compare against current publisher images too, without replacing the
    # published text with a page that may have changed since publication.
    try:
        current=fetch_source(article['url'])
        source['imageCandidates']=list(dict.fromkeys([url for url in [current.get('imageUrl'),*current.get('imageCandidates',[])] if url]))[:4]
    except Exception:pass
    try:plan,receipt=editorial_request(runtime,source,photo_only=True)
    except AuthenticationError:
        runtime=resolve_runtime();plan,receipt=editorial_request(runtime,source,photo_only=True)
    photo=select_bota_photo(source,plan)
    if not photo.get('imageUrl'):return {'id':article['id'],'status':'no_cleared_photo'}
    if dry_run:return {'id':article['id'],'status':'selected_not_published','subject':photo['imageSubject'],'license':photo['imageRights']['license']}
    response=httpx.patch(SITE+'/api/automation/bota/photos',headers=headers,json={'id':article['id'],'sourceHash':article['sourceHash'],**photo},timeout=40)
    response.raise_for_status()
    if response.json().get('updated') is not True:raise RuntimeError('Photo update unverified')
    return {'id':article['id'],'status':'updated','subject':photo['imageSubject'],'license':photo['imageRights']['license']}

def run(limit=100,dry_run=False):
    headers={'Authorization':'Bearer '+secret()};articles=[];cursor=None
    while len(articles)<limit:
        response=httpx.get(SITE+'/api/automation/bota/photos',headers=headers,params={'after':cursor} if cursor else {},timeout=40)
        response.raise_for_status();page=response.json();articles.extend(page['articles'])
        if not page.get('hasMore'):break
        if not page.get('after') or page['after']==cursor:raise RuntimeError('Repair cursor did not advance')
        cursor=page['after']
    articles=articles[:limit]
    if not articles:return {'status':'ok','candidates':0,'updated':0}
    runtime=resolve_runtime();results=[]
    with ThreadPoolExecutor(max_workers=4) as pool:
        pending={pool.submit(repair_one,article,runtime,headers,dry_run):article['id'] for article in articles}
        for future in as_completed(pending):
            try:result=future.result()
            except Exception as error:result={'id':pending[future],'status':'failed','reason':type(error).__name__}
            results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
    updated=sum(r['status']=='updated' for r in results);failed=sum(r['status']=='failed' for r in results)
    summary={'status':('partial' if updated else 'failed') if failed else 'ok','candidates':len(articles),'updated':updated,'no_cleared_photo':sum(r['status']=='no_cleared_photo' for r in results),'failed':failed}
    return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--limit',type=int,default=100);parser.add_argument('--dry-run',action='store_true');args=parser.parse_args()
    summary=run(max(1,min(args.limit,400)),args.dry_run)
    print(json.dumps(summary),flush=True)
    if summary['status']=='failed':sys.exit(1)
