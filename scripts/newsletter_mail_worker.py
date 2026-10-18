"""Private queue worker on the existing server; no public mail relay or listener."""
import base64
import hashlib
import json
import smtplib
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def api(config, path, body=None):
    request = urllib.request.Request(config['SUPABASE_URL'].rstrip('/') + '/rest/v1/' + path,
        data=None if body is None else json.dumps(body).encode(),
        headers={'apikey': config['SUPABASE_SERVICE_ROLE_KEY'],
                 'Authorization': 'Bearer ' + config['SUPABASE_SERVICE_ROLE_KEY'],
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=15) as response:
        value = response.read()
        return json.loads(value) if value else None


def decode_job(job, secret):
    payload = job['payload']
    ciphertext = base64.b64decode(payload['ciphertext']) + base64.b64decode(payload['tag'])
    raw = AESGCM(hashlib.sha256(secret.encode()).digest()).decrypt(
        base64.b64decode(payload['iv']), ciphertext, job['id'].encode())
    return json.loads(raw)


def message_for(payload, config, job_id):
    message = EmailMessage()
    message['From'] = formataddr(('383 · Përmbledhja javore', config['GMAIL_USER']))
    message['To'] = payload['to']
    message['Reply-To'] = config['NEWSLETTER_FROM']
    message['Subject'] = payload['subject']
    message['Message-ID'] = '<' + job_id + '@383ks.com>'
    for name in ('List-Unsubscribe', 'List-Unsubscribe-Post'):
        if name in payload.get('headers', {}):
            message[name] = payload['headers'][name]
    message.set_content(payload['text'])
    message.add_alternative(payload['html'], subtype='html')
    return message


def deliver(config, payload, job_id):
    # Authentication occurs before DATA. Failures there cannot have sent mail.
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=15, context=ssl.create_default_context()) as smtp:
        smtp.login(config['GMAIL_USER'], config['GMAIL_APP_PASSWORD'])
        rejected = smtp.send_message(message_for(payload, config, job_id))
        if rejected:
            raise smtplib.SMTPRecipientsRefused(rejected)
    return 'gmail:' + job_id


def failure_status(error):
    # An explicit negative SMTP response did not accept the message. Connection
    # loss after DATA is uncertain: hold it for receipt inspection, never resend.
    if isinstance(error, smtplib.SMTPRecipientsRefused):
        codes = [value[0] for value in error.recipients.values()]
        return 'pending' if codes and all(code < 500 for code in codes) else 'failed'
    if isinstance(error, smtplib.SMTPResponseException):
        return 'pending' if error.smtp_code < 500 else 'failed'
    return 'held'


def run(config, limit=5):
    result = {'sent': 0, 'held': 0, 'failed': 0, 'cancelled': 0}
    for _ in range(limit):
        jobs = api(config, 'rpc/claim_newsletter_mail', {})
        if not jobs:
            break
        job = jobs[0]
        receipt = None
        try:
            payload = decode_job(job, config['NEWSLETTER_SECRET'])
            rows = api(config, 'newsletter_subscribers?id=eq.' + urllib.parse.quote(job['subscriber_id']) + '&select=email,status,confirm_token_hash')
            subscriber = rows[0] if rows else None
            allowed = subscriber and subscriber['email'] == payload['to'] and (
                subscriber['status'] == 'active' if job['issue_id'] else
                subscriber['status'] == 'pending' and subscriber['confirm_token_hash'] == job['confirmation_hash'])
            if not allowed:
                status, error = 'cancelled', 'consent_changed'
            else:
                receipt = deliver(config, payload, job['id'])
                status, error = 'sent', None
        except Exception as exc:
            status, error = failure_status(exc), type(exc).__name__
        # If persistence fails after SMTP accepted, the job stays `sending` and
        # later becomes held. Re-running the worker cannot duplicate the send.
        api(config, 'rpc/finish_newsletter_mail', {'p_id': job['id'], 'p_status': status,
            'p_provider_id': receipt, 'p_error': error})
        result['held' if status == 'pending' else status] += 1
    print(json.dumps(result), flush=True)  # Counts only; no tokens or email addresses.
    return result


if __name__ == '__main__':
    with open(sys.argv[1], encoding='utf-8') as source:
        settings = json.load(source)
    totals = run(settings)
    if totals['held'] or totals['failed']:
        sys.exit(1)
