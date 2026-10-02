"""Email only verified Bota outcomes; reuse the VPS's existing SMTP credentials."""
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from html import escape
import json
import os
from pathlib import Path
import smtplib
import ssl
from concurrent.futures import ThreadPoolExecutor

RECIPIENT='lindsylqa@gmail.com'
SITE='https://383ks.com'

def verify_public(report, get=None):
    import httpx
    get=get or httpx.get
    response=get(SITE+'/api/bota',timeout=30);response.raise_for_status()
    snapshot=response.json().get('outlets',{})
    if snapshot.get('lastUpdated')!=report['date'] or snapshot.get('stanceVersion')!=5:
        raise ValueError('Public batch date or portrayal version mismatch')
    cards=[a for country in snapshot.get('countries',{}).values() for outlet in country.get('outlets',[]) for a in outlet.get('articles',[]) if a.get('firstSeen')==report['date']]
    if not cards or len(cards)!=snapshot.get('totalArticles'):
        raise ValueError('Public article count does not match the daily batch')
    def verify_reader(article):
        reader_url='/bota-per-kosoven/artikull/'+article['id']
        if article.get('readerUrl')!=reader_url:raise ValueError('Invalid internal article link')
        reader=get(SITE+reader_url,timeout=30);reader.raise_for_status()
        if 'Përkthim në shqip' not in reader.text or escape(article['albanianTitle']) not in reader.text:
            raise ValueError('Albanian reader attribution or title mismatch')
    with ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(verify_reader,cards))
    if report['result'] in ('published_verified','dry_run_no_publication'):
        responses=report.get('responses',[])
        if not responses or len(responses)!=report.get('articleCount') or any(r.get('actualModel')!='gpt-6-luna' or r.get('actualReasoningEffort')!='xhigh' for r in responses):
            raise ValueError('Actual GPT model provenance is missing or wrong')
    country_counts={country:sum(a.get('firstSeen')==report['date'] for outlet in data.get('outlets',[]) for a in outlet.get('articles',[])) for country,data in snapshot.get('countries',{}).items()}
    country_counts={c:n for c,n in country_counts.items() if n}
    return {'http':200,'date':snapshot['lastUpdated'],'articleCount':len(cards),'readerCount':len(cards),'sourceCount':snapshot.get('sourceCount'),'countryCount':sum(c!='Të tjera' for c in country_counts),'countries':country_counts, 'readerUrls':[SITE+a['readerUrl'] for a in cards]}

def render_report(outcome, started, finished):
    status=outcome.get('status');result=outcome.get('result')
    labels={'published_verified':'SUCCESS — new batch published and verified','already_published':'SUCCESS — existing daily batch and readers verified','dry_run_no_publication':'TEST PASSED — fresh extraction and GPT translations; no publication','already_running':'SKIPPED — another run holds the lock'}
    if status=='ok':
        if result not in labels or outcome.get('public',{}).get('http')!=200:raise ValueError('Success email requires public verification')
        label=labels[result]
        if result=='published_verified' and outcome.get('publication',{}).get('published') is not True:label='SUCCESS — saved batch and readers verified after retry'
        if result!='dry_run_no_publication' and outcome['public']['articleCount']<50:label='SHORTFALL — verified publication; daily minimum of 50 not reached'
    elif status=='skipped' and result=='already_running':label=labels[result]
    else:label='FAILED — pipeline or public verification did not complete'
    rows=[('Date',outcome['date']),('Result',label),('Started (Europe/Warsaw)',started),('Finished (Europe/Warsaw)',finished),('Model setting','Hermes / OpenAI Codex subscription / GPT-6 Luna / xhigh')]
    if status=='ok':
        public=outcome['public']
        fresh='0 — already published; no GPT call needed' if result=='already_published' else '0 — reused the saved translation packet' if outcome.get('reusedSavedPacket') else str(outcome.get('articleCount',0))
        changed='No — test only' if result=='dry_run_no_publication' else 'Yes' if outcome.get('publication',{}).get('published') is True else 'No — preserved existing batch'
        rows += [('Published articles today',str(public['articleCount'])),('Verified Albanian readers',str(public['readerCount'])),('Fresh verified GPT translations in this run',fresh),('Rejected candidates',str(outcome.get('failed',0))),('Deferred candidates',str(outcome.get('deferred',0))),('Publication changed',changed),('Live feature',SITE+'/bota-per-kosoven')]
        rows += [('Daily target','50–100 unique articles'),('Countries represented',str(public.get('countryCount',0))),('Articles by country',', '.join(c+': '+str(n) for c,n in sorted(public.get('countries',{}).items()))),('Shortfall below 50',str(max(0,50-public['articleCount'])))]
        rows += [('Reader',url) for url in public['readerUrls']]
    else:rows += [('Failure type',outcome.get('reason','WorkflowError')),('Details','See the protected Hermes run log. No success is claimed by this email.')]
    subject='383 Bota | '+outcome['date']+' | '+label
    text='Bota për Kosovën — pipeline run report\n\n'+'\n\n'.join(k+': '+str(v) for k,v in rows)
    html='<html><body style="font-family:Arial,sans-serif;line-height:1.6"><h2>Bota për Kosovën</h2>'+''.join('<p><strong>'+escape(k)+'</strong><br>'+escape(str(v))+'</p>' for k,v in rows)+'</body></html>'
    return {'subject':subject,'text':text,'html':html}

def send_report(report, config=None, smtp_factory=None):
    if config is None:
        from dotenv import dotenv_values
        config=dict(dotenv_values('/opt/data/.env'))
        for key in ('EMAIL_ADDRESS','EMAIL_PASSWORD','EMAIL_SMTP_HOST','EMAIL_SMTP_PORT'):
            if os.environ.get(key):config[key]=os.environ[key]
    sender,password=config.get('EMAIL_ADDRESS'),config.get('EMAIL_PASSWORD')
    host,port=config.get('EMAIL_SMTP_HOST') or 'smtp.gmail.com',int(config.get('EMAIL_SMTP_PORT') or 587)
    if not sender or not password:raise RuntimeError('SMTP sender credentials unavailable')
    if host!='smtp.gmail.com' or port!=587:raise ValueError('Configured Gmail STARTTLS route required')
    message=EmailMessage();message['From']='383 Bota <'+sender+'>';message['To']=RECIPIENT;message['Subject']=report['subject'];message['Date']=formatdate(localtime=True);message['Message-ID']=make_msgid(domain='383ks.com');message['Auto-Submitted']='auto-generated'
    message.set_content(report['text']);message.add_alternative(report['html'],subtype='html')
    server=(smtp_factory or smtplib.SMTP)(host,port,timeout=15)
    try:
        server.ehlo();server.starttls(context=ssl.create_default_context());server.ehlo();server.login(sender,password)
        if server.send_message(message,from_addr=sender,to_addrs=[RECIPIENT]):raise RuntimeError('Email recipient refused')
        return {'status':'accepted','recipient':RECIPIENT,'messageId':str(message['Message-ID'])}
    finally:
        try:server.quit()
        except Exception:server.close()

def save_private(path,data):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_suffix('.tmp');descriptor=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(descriptor,'w') as file:json.dump(data,file,ensure_ascii=False,indent=2)
    os.replace(temporary,path)
