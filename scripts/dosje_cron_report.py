#!/usr/bin/env python3
"""Call a Dosje route and email its exact result via Gmail SMTP."""
from __future__ import annotations
import argparse, html, json, os, smtplib, ssl, sys
import urllib.error, urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

DEFAULT_RECIPIENT = "lindsylqa@gmail.com"

def parse_args(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--stage", required=True, choices=["research", "subjects", "reverify", "media"])
    p.add_argument("--url", required=True)
    p.add_argument("--secret", default=os.environ.get("CRON_SECRET", ""))
    p.add_argument("--method", default="POST", choices=["GET", "POST"])
    p.add_argument("--timeout", type=int, default=300)
    p.add_argument("--allowed-status", default="200")
    p.add_argument("--soft-fail", action="store_true")
    p.add_argument("--workflow-url", default="")
    p.add_argument("--event", default=os.environ.get("GITHUB_EVENT_NAME", "unknown"))
    return p.parse_args(argv)

def decode(raw):
    text = raw.decode("utf-8", errors="replace").strip()
    if not text:
        return {"error": "empty_response"}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_response": text}

def call(url, secret, method, timeout):
    if not secret:
        return 0, {"error": "CRON_SECRET is missing"}
    req = urllib.request.Request(url, method=method, headers={"Authorization": f"Bearer {secret}", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return int(res.status), decode(res.read())
    except urllib.error.HTTPError as err:
        return int(err.code), decode(err.read())
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        return 0, {"error": f"request_failed: {type(err).__name__}: {err}"}

def summary(data):
    if not isinstance(data, dict):
        return "non-object JSON result"
    keys = ("reason", "outcome", "drafted", "written", "checked", "stillLive", "failedThisRun", "momentsDemoted", "newlyDead", "articlesScanned", "matched")
    values = [f"{key}={data[key]}" for key in keys if key in data]
    return "; ".join(values) or "JSON result returned without standard summary fields"

def compose(stage, status, data, workflow, event, recipient):
    label = str(status) if status else "network-error"
    pretty = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
    subject = f"383 Dosje — {stage} — HTTP {label} — {summary(data)[:120]}"
    text = "\n".join(["383 Dosje automation report", f"Stage: {stage}", f"HTTP status: {label}", f"Workflow event: {event}", f"Summary: {summary(data)}", f"Workflow: {workflow or '(not supplied)' }", "", "Exact route result:", pretty])
    html_body = ("<div style='font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;color:#172033'><div style='max-width:760px;margin:auto;background:#fff;border:1px solid #d9e0ea;border-radius:12px;padding:24px'>" + f"<h1>383 Dosje automation report</h1><p><b>Stage:</b> {html.escape(stage)}<br><b>HTTP status:</b> {html.escape(label)}<br><b>Workflow event:</b> {html.escape(event)}<br><b>Summary:</b> {html.escape(summary(data))}<br><b>Workflow:</b> {html.escape(workflow or '(not supplied)')}</p><h2>Exact route result</h2><pre style='white-space:pre-wrap;background:#f8fafc;border:1px solid #e4e7ec;border-radius:8px;padding:14px;font-size:12px'>{html.escape(pretty)}</pre></div></div>")
    msg = MIMEMultipart("alternative")
    msg["From"] = os.environ["GMAIL_USER"]
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg

def send(msg):
    user = os.environ.get("GMAIL_USER", "").strip()
    password = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    if not user or not password:
        raise RuntimeError("GMAIL_USER and GMAIL_APP_PASSWORD are required")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=30) as smtp:
        smtp.login(user, password)
        smtp.send_message(msg)

def main(argv=None):
    a = parse_args(argv)
    status, data = call(a.url, a.secret, a.method, a.timeout)
    try:
        recipient = os.environ.get("RECIPIENT_EMAIL", DEFAULT_RECIPIENT).strip() or DEFAULT_RECIPIENT
        send(compose(a.stage, status, data, a.workflow_url, a.event, recipient))
    except Exception as err:
        print(f"DOSJE_EMAIL_ERROR: {type(err).__name__}: {err}", file=sys.stderr)
        return 1
    print(json.dumps({"stage": a.stage, "http_status": status, "summary": summary(data), "email_sent": True}, ensure_ascii=False))
    if a.soft_fail:
        return 0
    allowed = {int(x.strip()) for x in a.allowed_status.split(",") if x.strip()}
    return 0 if status in allowed else 1

if __name__ == "__main__":
    raise SystemExit(main())
