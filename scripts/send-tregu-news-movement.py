"""Deliver persisted news-movement audits; failed mail remains pending for retry."""
import fcntl,html,json,os,smtplib
from io import BytesIO
from datetime import datetime,timezone
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import quote,urlsplit
import requests
from PIL import Image,ImageDraw

def history(base,headers,move):
    market_id=str(move.get('market_id') or '')
    if not market_id:
        found=requests.get(base+'/markets',headers=headers,params={'select':'id','slug':'eq.'+str(move['slug']),'limit':'1'},timeout=20)
        found.raise_for_status()
        rows=found.json()
        market_id=str(rows[0]['id']) if rows else ''
    if not market_id:return []
    response=requests.get(base+'/market_snapshots',headers=headers,params={
        'select':'created_at,market_prob,oracle_kind','market_id':'eq.'+market_id,
        'order':'created_at.desc','limit':'40'},timeout=20)
    response.raise_for_status()
    points=[]
    for row in reversed(response.json()):
        try:probability=float(row['market_prob'])
        except (KeyError,TypeError,ValueError):continue
        if 0 <= probability <= 1 and row.get('created_at'):
            points.append((str(row['created_at']),probability))
    return points


def chart_png(points,before,after):
    # Include the two persisted run values, even when an older market has no
    # snapshot history. These are exact audit values, never inferred samples.
    values=[value for _,value in points]
    if not values or abs(values[-1]-after)>0.00001:values.append(after)
    if len(values)<2:values.insert(0,before)
    width,height=640,206
    image=Image.new('RGB',(width,height),'#ffffff')
    draw=ImageDraw.Draw(image)
    left,right,top,bottom=52,width-22,24,height-38
    low=max(0,min(values)-0.05);high=min(1,max(values)+0.05)
    if high-low<0.10:high=min(1,low+0.10)
    if high-low<0.10:low=max(0,high-0.10)
    for fraction in (0,0.5,1):
        y=round(bottom-fraction*(bottom-top))
        draw.line((left,y,right,y),fill='#e4e7ec',width=1)
        draw.text((5,y-7),f'{(low+fraction*(high-low))*100:.0f}%',fill='#667085')
    coords=[(round(left+i*(right-left)/(len(values)-1)),round(bottom-(value-low)/(high-low)*(bottom-top))) for i,value in enumerate(values)]
    draw.line(coords,fill='#155eef',width=4,joint='curve')
    for x,y in (coords[0],coords[-1]):draw.ellipse((x-5,y-5,x+5,y+5),fill='#155eef')
    draw.text((left,height-27),f'{before*100:.2f}% before',fill='#475467')
    draw.text((right-126,height-27),f'{after*100:.2f}% now',fill='#175cd3')
    output=BytesIO();image.save(output,format='PNG');return output.getvalue()


def render(run,charts=None):
    moves=run['details'].get('email_updates',[])
    text=[];cards=[]
    for move in moves:
        before=float(move['before_probability'])*100;after=float(move['after_probability'])*100
        title=str(move.get('question') or move['slug']);url='https://383ks.com/tregu/'+quote(move['slug'],safe='')
        reason=str(move.get('reason') or 'new_evidence')
        relative=f'{(after-before)/before*100:+.2f}%' if before else 'n/a'
        text.extend([title,f'PO: {before:.2f}% → {after:.2f}% ({after-before:+.2f} percentage points; {relative} relative)',
                     'Provider: '+str(move.get('provider') or 'unknown'),'Reason: '+reason,
                     'Changed at: '+str(move.get('timestamp') or run.get('run_key') or ''),url])
        sources=[]
        for source in move.get('verified_sources',[]):
            link=str(source.get('url') or '')
            if urlsplit(link).scheme!='https':continue
            label=str(source.get('title') or source.get('label') or link)
            text.append(label+' — '+link)
            sources.append('<li><a href="'+html.escape(link,quote=True)+'">'+html.escape(label)+'</a></li>')
        cid=(charts or {}).get(str(move['slug']))
        graph='<p><img src="cid:'+html.escape(cid,quote=True)+'" alt="PO probability history from persisted market snapshots" width="640" style="display:block;max-width:100%;height:auto"></p>' if cid else ''
        cards.append('<section style="padding:20px;border:1px solid #ddd;margin:12px 0;border-radius:12px"><h2>'+html.escape(title)+'</h2><p style="font-size:24px">'+f'{before:.2f}% → <strong>{after:.2f}%</strong></p><p>{after-before:+.2f} pp · {html.escape(relative)} relative</p><p>Provider: '+html.escape(str(move.get('provider') or 'unknown'))+'<br>Reason: '+html.escape(reason)+'<br>Changed at: '+html.escape(str(move.get('timestamp') or run.get('run_key') or ''))+'</p>'+graph+'<h3>Verified sources</h3><ul>'+''.join(sources)+'</ul><a href="'+html.escape(url,quote=True)+'">Hap tregun →</a></section>')
    return '\n'.join(text),'<main style="font-family:Arial;max-width:680px;margin:auto"><h1>383 Tregu — ndryshim i gjasave</h1>'+''.join(cards)+'</main>'

def main():
    from codex_automation_support import load_env
    load_env()
    state=Path('/opt/data/state/tregu-news-mail');state.mkdir(parents=True,exist_ok=True)
    with (state/'sender.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        since=state/'enabled-at'
        if not since.exists():since.write_text(datetime.now(timezone.utc).isoformat())
        rest=os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')+'/rest/v1'
        base=rest+'/market_automation_runs'
        key=os.environ['SUPABASE_SERVICE_ROLE_KEY'];headers={'apikey':key,'Authorization':'Bearer '+key}
        # The existing completed-run audit is the durable outbox. No new table
        # or second SMTP sender is needed, and no odds are changed by delivery.
        r=requests.get(base,headers=headers,params={'select':'id,run_key,details','action':'in.(reprice,tregu_live)',
            'status':'eq.succeeded','started_at':'gte.'+since.read_text().strip(),
            'details->>news_email_processed_at':'is.null','order':'started_at.asc','limit':'30'},timeout=20)
        r.raise_for_status();sent=0
        for run in r.json():
            details=run.get('details') or {};moves=details.get('email_updates') or []
            if moves:
                charts={};attachments=[]
                for index,move in enumerate(moves):
                    cid=f'tregu-news-{run["id"]}-{index}@383ks.com'
                    points=history(rest,headers,move)
                    png=chart_png(points,float(move['before_probability']),float(move['after_probability']))
                    charts[str(move['slug'])]=cid
                    attachments.append((cid,png))
                message=EmailMessage();message['From']=os.environ['GMAIL_USER'];message['To']='lindsylqa@gmail.com'
                message['Subject']=f'383 Tregu — gjasat ndryshuan në {len(moves)} tregje'
                message['Message-ID']='<tregu-news-'+run['id']+'@383ks.com>'
                plain,rich=render(run,charts);message.set_content(plain);message.add_alternative(rich,subtype='html')
                html_part=message.get_body(preferencelist=('html',))
                for cid,png in attachments:html_part.add_related(png,maintype='image',subtype='png',cid='<'+cid+'>',filename='tregu-odds.png')
                password=os.environ.get('GMAIL_APP_PASSWORD') or os.environ.get('GMAIL_PASSWORD')
                with smtplib.SMTP_SSL('smtp.gmail.com',465,timeout=25) as smtp:
                    smtp.login(os.environ['GMAIL_USER'],password);smtp.send_message(message)
                sent+=1
            details={**details,'news_email_processed_at':datetime.now(timezone.utc).isoformat(),
                'news_email_delivery':'sent' if moves else 'no_change_suppressed'}
            saved=requests.patch(base,headers=headers,params={'id':'eq.'+run['id'],'status':'eq.succeeded'},json={'details':details},timeout=20)
            saved.raise_for_status()
        print(json.dumps({'news_movement_emails_sent':sent,'recipient':'lindsylqa@gmail.com'}))

if __name__=='__main__':main()
