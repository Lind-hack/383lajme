#!/usr/bin/env python3
"""Send a Tregu HTML receipt and fail closed when SMTP does not accept it."""

import argparse
import html
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path


def send_email(recipient, subject, html_body, *, env=None, smtp_factory=None):
    env = os.environ if env is None else env
    smtp_factory = smtplib.SMTP_SSL if smtp_factory is None else smtp_factory
    sender = str(env.get("GMAIL_USER", "")).strip()
    password = re.sub(r"\s+", "", str(env.get("GMAIL_APP_PASSWORD", "")))
    if not sender or not password:
        raise RuntimeError("GMAIL_USER and GMAIL_APP_PASSWORD are required")
    if "@" not in recipient or "\n" in recipient or "\r" in recipient:
        raise ValueError("A valid recipient is required")
    if not subject.strip() or not html_body.strip():
        raise ValueError("Subject and HTML body must be nonempty")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    plain = html.unescape(re.sub(r"<[^>]+>", " ", html_body))
    message.set_content(re.sub(r"\s+", " ", plain).strip())
    message.add_alternative(html_body, subtype="html")

    with smtp_factory("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=30) as smtp:
        smtp.login(sender, password)
        refused = smtp.send_message(message)
    if refused:
        raise RuntimeError("SMTP refused a recipient")
    print(f"TREGU SMTP ACCEPTED recipient={recipient}")


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipient", required=True)
    parser.add_argument("--subject", required=True)
    parser.add_argument("--html-file", required=True)
    args = parser.parse_args(argv)
    html_body = Path(args.html_file).read_text(encoding="utf-8")
    send_email(args.recipient, args.subject, html_body)


if __name__ == "__main__":
    main()
