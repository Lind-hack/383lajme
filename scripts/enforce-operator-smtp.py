"""Run inside Hermes: disable Resend only for operator reports, preserving other work."""
import ast
import os
from pathlib import Path
import re
import shutil
from datetime import datetime, timezone

root = Path('/opt/data/workspaces/383lajme-news-current')
backup = Path('/opt/data/backups/operator-smtp-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(parents=True, exist_ok=True, mode=0o700)

def save(path, text):
    ast.parse(text) if path.suffix == '.py' else None
    before = path.read_text()
    if text == before:
        return
    copy = backup / (str(path).strip('/').replace('/', '_'))
    shutil.copy2(path, copy)
    copy.chmod(0o600)
    path.write_text(text)
    print('Updated', str(path))

for path in [Path('/opt/data/news-pipeline.env'), root / '.env.automation']:
    if path.exists():
        text = path.read_text()
        text = re.sub(r'(?m)^(?:export )?RESEND_API_KEY=.*(?:\n|$)', '', text)
        text = re.sub(r'(?m)^EMAIL_PRIMARY=.*$', 'EMAIL_PRIMARY=gmail', text)
        save(path, text)

for path in [root / 'scripts/codex_automation_support.py', root / 'scripts/clarity_daily_report.py', root / 'scripts/video_mail.py']:
    if not path.exists():
        continue
    text = path.read_text()
    if path.name == 'codex_automation_support.py':
        # Older callers can still import this helper, but it can no longer use HTTPS mail.
        tree = ast.parse(text)
        node = next((n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_send_resend_report'), None)
        if node:
            lines = text.splitlines(keepends=True)
            replacement = ['def _send_resend_report(api_key, recipient, subject, report_html):\n',
              '    return _send_gmail_report(os.environ.get("GMAIL_USER", "").strip(), _gmail_app_password(), recipient, subject, report_html)\n']
            text = ''.join(lines[:node.lineno-1] + replacement + lines[node.end_lineno:])
    elif path.name == 'clarity_daily_report.py':
        text = text.replace('_send_resend_report, _send_gmail_report', '_send_gmail_report')
        text = re.sub(r"    resend = os.environ.get\('RESEND_API_KEY'.*?\n    user =", '    user =', text, flags=re.S)
    elif path.name == 'video_mail.py':
        start = text.find('    key = os.environ.get("RESEND_API_KEY"', text.find('def send('))
        end = text.find('\n\ndef wrap(', start)
        if start >= 0 and end > start:
            text = text[:start] + '    print("VIDEO MAIL: Gmail SMTP unavailable; Resend is disabled for operator reports", file=sys.stderr)\n' + text[end:]
        text = text.replace('else Resend (RESEND_API_KEY, EMAIL_FROM).', 'with no Resend fallback.')
        text = text.replace("Gmail SMTP first (the pipeline's EMAIL_PRIMARY), Resend if that fails.", 'Gmail SMTP only; never consume the transactional Resend quota.')
        text = text.replace('; trying Resend', '; no provider fallback')
    save(path, text)
print('Operator SMTP policy applied; reader/auth credentials were not changed.')
