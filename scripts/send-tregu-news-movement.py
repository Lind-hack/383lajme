"""Deliver persisted news-movement audits; failed mail remains pending for retry."""
import fcntl,html,json,os,smtplib
from datetime import datetime,timezone
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import quote,urlsplit
import requests

def render(run):
    moves=run['details'].get('email_updates',[])
    text=[];cards=[]
    for move in moves:
        before=float(move['before_probability'])*100;after=float(move['after_probability'])*100
        title=str(move.get('question') or move['slug']);url='https://383ks.com/tregu/'+quote(move['slug'],safe='')
        reason=str(move.get('reason') or 'new_evidence')
        text.extend([title,f'PO: {before:.4f}% → {after:.4f}% ({after-before:+.4f} pp)',reason,url])
        sources=[]
        for source in move.get('verified_sources',[]):
            link=str(source.get('url') or '')
            if urlsplit(link).scheme!='https':continue
            label=str(source.get('title') or source.get('label') or link)
            text.append(label+' — '+link)
            sources.append('<li><a href="'+html.escape(link,quote=True)+'">'+html.escape(label)+'</a></li>')
        cards.append('<section style="padding:20px;border:1px solid #ddd;margin:12px 0;border-radius:12px"><h2>'+html.escape(title)+'</h2><p style="font-size:24px">'+f'{before:.4f}% → <strong>{after:.4f}%</strong></p><p>{after-before:+.4f} pp · '+html.escape(reason)+'</p><ul>'+''.join(sources)+'</ul><a href="'+html.escape(url,quote=True)+'">Hap tregun →</a></section>')
    return '\n'.join(text),'<main style="font-family:Arial;max-width:680px;margin:auto"><h1>383 Tregu — ndryshim i gjasave</h1>'+''.join(cards)+'</main>'

def main():
    from codex_automation_support import load_env
    load_env()
    state=Path('/opt/data/state/tregu-news-mail');state.mkdir(parents=True,exist_ok=True)
    with (state/'sender.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        since=state/'enabled-at'
        if not since.exists():since.write_text(datetime.now(timezone.utc).isoformat())
        base=os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')+'/rest/v1/market_automation_runs'
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
                message=EmailMessage();message['From']=os.environ['GMAIL_USER'];message['To']='lindsylqa@gmail.com'
                message['Subject']=f'383 Tregu — gjasat ndryshuan në {len(moves)} tregje'
                message['Message-ID']='<tregu-news-'+run['id']+'@383ks.com>'
                plain,rich=render(run);message.set_content(plain);message.add_alternative(rich,subtype='html')
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
