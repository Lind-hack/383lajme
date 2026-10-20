"""Deliver encrypted site operator mail through Gmail; never contact Resend."""
import json
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formataddr
from newsletter_mail_worker import api, decode_job, failure_status


def send(payload, config, job_id):
    if payload['to'].strip().lower() != 'lindsylqa@gmail.com':
        raise ValueError('Operator queue recipient is not allowed')
    message = EmailMessage()
    message['From'] = formataddr((payload.get('fromName') or '383 · Raport', config['GMAIL_USER']))
    message['To'] = payload['to']
    message['Subject'] = payload['subject']
    message['Message-ID'] = '<operator-' + job_id + '@383ks.com>'
    for name in ('List-Unsubscribe', 'List-Unsubscribe-Post'):
        if name in payload.get('headers', {}):
            message[name] = payload['headers'][name]
    message.set_content(payload.get('text') or 'Hape këtë email në një aplikacion që shfaq HTML.')
    message.add_alternative(payload['html'], subtype='html')
    smtp = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=20, context=ssl.create_default_context())
    try:
        smtp.login(config['GMAIL_USER'], config['GMAIL_APP_PASSWORD'])
        refused = smtp.send_message(message)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
    finally:
        # DATA acceptance decides delivery. A failed QUIT must never resubmit it.
        try:
            smtp.close()
        except OSError:
            pass


def run(config, *, api_call=api, sender=send):
    for _ in range(10):
        jobs = api_call(config, 'rpc/claim_site_smtp_mail', {}) or []
        if not jobs:
            return
        job = jobs[0]
        try:
            payload = decode_job(job, config['NEWSLETTER_SECRET'])
            sender(payload, config, job['id'])
        except Exception as error:
            status = 'failed' if isinstance(error, (ValueError, KeyError)) else failure_status(error)
            api_call(config, 'rpc/finish_site_smtp_mail', {'p_id': job['id'], 'p_status': status, 'p_error': type(error).__name__})
            continue
        # A receipt-write failure must not issue a second SMTP send.
        api_call(config, 'rpc/finish_site_smtp_mail', {'p_id': job['id'], 'p_status': 'sent'})
        print(json.dumps({'operator_mail': job['id'], 'status': 'sent', 'via': 'gmail_smtp'}))


if __name__ == '__main__':
    with open(sys.argv[1]) as source:
        run(json.load(source))
