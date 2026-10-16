#!/usr/bin/env python3
"""Email Lind when the social-research / video run starts and when it ends.

    video_mail.py start
    video_mail.py finish <exit status>

"finish" reads the report video_curation.py writes (last-run.json next to its
state) and lists every video approved this run with its TikTok/YouTube link
and its 383 link, plus how many videos the site now carries. Sent to
L383_VIDEO_EMAIL, else RECIPIENT_EMAIL, through Gmail SMTP (GMAIL_USER,
GMAIL_APP_PASSWORD from news-pipeline.env, the pipeline's primary mail),
else Resend (RESEND_API_KEY, EMAIL_FROM). A failed email never fails the run.
"""
from __future__ import annotations

import html
import json
import os
import smtplib
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from zoneinfo import ZoneInfo

STATE = Path(os.environ.get("L383_VIDEO_STATE", "/opt/data/video-curation/judged.json"))
REPORT = STATE.with_name("last-run.json")
STARTED = STATE.with_name("run-started.txt")
SITE = "https://383ks.com"
TZ = ZoneInfo("Europe/Belgrade")


PLATFORMS = {"tiktok": "TikTok", "instagram": "Instagram", "youtube": "YouTube"}


def site_link(pick: dict) -> str:
    vid = str(pick.get("id", ""))
    prefix = {"tiktok": "tt-", "instagram": "ig-"}.get(str(pick.get("platform")), "")
    return f"{SITE}/video/{prefix}{vid}"


def compact(n: object) -> str:
    try:
        n = int(n)
    except (TypeError, ValueError):
        return "?"
    for size, unit in ((1_000_000, "M"), (1_000, "K")):
        if n >= size:
            return f"{n / size:.1f}".rstrip("0").rstrip(".") + unit
    return str(n)


def send(subject: str, body_html: str) -> None:
    """Gmail SMTP first (the pipeline's EMAIL_PRIMARY), Resend if that fails."""
    to = os.environ.get("L383_VIDEO_EMAIL") or os.environ.get("RECIPIENT_EMAIL", "")
    user, password = os.environ.get("GMAIL_USER", ""), os.environ.get("GMAIL_APP_PASSWORD", "")
    if to and user and password:
        msg = EmailMessage()
        msg["Subject"], msg["From"], msg["To"] = subject, formataddr(("383 Video", user)), to
        msg.set_content("This email is HTML; open it in a mail app that shows HTML.")
        msg.add_alternative(body_html, subtype="html")
        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as smtp:
                smtp.login(user, password)
                smtp.send_message(msg)
            print(f"VIDEO MAIL: sent '{subject}' (gmail)")
            return
        except (smtplib.SMTPException, OSError) as exc:
            print(f"VIDEO MAIL: gmail failed: {exc}; trying Resend", file=sys.stderr)
    key = os.environ.get("RESEND_API_KEY", "")
    sender = os.environ.get("EMAIL_FROM", "")
    if not (key and to and sender):
        print("VIDEO MAIL: no working mail settings; not sent", file=sys.stderr)
        return
    payload = {"from": f"383 Video <{sender}>", "to": [a.strip() for a in to.split(",") if a.strip()],
               "subject": subject, "html": body_html}
    req = urllib.request.Request("https://api.resend.com/emails", data=json.dumps(payload).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                                          # Resend sits behind Cloudflare, which refuses Python's default agent.
                                          "User-Agent": "383NewsVideo/1.0 (https://383ks.com)"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            print(f"VIDEO MAIL: sent '{subject}' ({res.status})")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"VIDEO MAIL: not sent: {exc}", file=sys.stderr)


def wrap(inner: str) -> str:
    return ('<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#111">'
            f"{inner}</div>")


def start() -> None:
    now = datetime.now(timezone.utc)
    STARTED.write_text(now.isoformat(), encoding="utf-8")
    local = now.astimezone(TZ).strftime("%H:%M")
    send(f"383 Video: run started {local}", wrap(
        f"<h2 style='margin:0 0 8px'>Run started at {local}</h2>"
        "<p style='margin:0;color:#555'>Social watchlists, then the video editor: official TikTok accounts' outliers, "
        "teaching videos on this run's topics (TikTok + Instagram), official Instagram reels (Agent Reach / Exa search, "
        "TikTok's embed stats, Instagram's embed rendered headless) and official YouTube Shorts, watched and judged "
        "for engagement, safety and copyright. You get the results when it finishes.</p>"))


def card(p: dict) -> str:
    platform = PLATFORMS.get(str(p.get("platform")), "YouTube")
    cover = p.get("cover") if p.get("platform") in ("tiktok", "instagram") else f"https://i.ytimg.com/vi/{p.get('id')}/oardefault.jpg"
    stats = (f"{compact(p.get('views'))} views · " if p.get("views") else "") + f"{compact(p.get('likes'))} likes"
    if p.get("kind") == "learn":
        stats = f"Mëso: {html.escape(str(p.get('topic', '')))} · " + stats
    if p.get("outlier"):
        stats += f" · {p['outlier']}× the account's usual"
    img = (f"<img src='{html.escape(str(cover))}' width='90' height='160' alt='' "
           "style='width:90px;height:160px;object-fit:cover;border-radius:10px;background:#222;display:block'>") if cover else ""
    return (
        "<tr><td style='padding:10px 12px 10px 0;vertical-align:top'>" + img + "</td>"
        "<td style='padding:10px 0;vertical-align:top'>"
        f"<div style='font-size:12px;color:#777;font-weight:700'>{html.escape(str(p.get('section', '')))} · "
        f"{html.escape(str(p.get('channel', '')))} · {platform} · score {p.get('score', '?')}/10</div>"
        f"<div style='font-size:16px;font-weight:800;margin:3px 0'>{html.escape(str(p.get('title', '')))}</div>"
        f"<div style='font-size:13px;color:#444;margin-bottom:6px'>{html.escape(str(p.get('why', '')))}</div>"
        f"<div style='font-size:12px;color:#777;margin-bottom:6px'>{stats}</div>"
        f"<a href='{html.escape(site_link(p))}' style='color:#FF4422;font-weight:800'>On 383</a> &nbsp;·&nbsp; "
        f"<a href='{html.escape(str(p.get('url', '')))}' style='color:#111'>Original on {platform}</a>"
        "</td></tr>"
    )


def finish(status: int) -> None:
    now = datetime.now(timezone.utc).astimezone(TZ)
    try:
        started = STARTED.read_text(encoding="utf-8").strip()
    except OSError:
        started = ""
    try:
        report = json.loads(REPORT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        report = {}
    # A report older than this run's start is the previous run's: the curation did not finish.
    if not isinstance(report, dict) or (started and str(report.get("startedAt", "")) < started):
        send(f"383 Video: run finished {now:%H:%M}: curation did not complete", wrap(
            f"<h2>Run finished at {now:%H:%M} without a video report</h2>"
            f"<p>Exit status {status}. The site keeps the videos it had. Check "
            "<code>journalctl -u social-research</code> on the VPS.</p>"))
        return
    approved = [p for p in report.get("approved") or [] if isinstance(p, dict)]
    by = report.get("publishedByPlatform") or {}
    rejected = report.get("rejected") or {}
    reasons = "".join(f"<li>{html.escape(str(k))}: {v}</li>" for k, v in sorted(rejected.items(), key=lambda kv: -kv[1]))
    summary = (
        f"<p style='margin:0 0 4px'><b>{len(approved)}</b> new videos approved and published "
        f"(live on 383 within 5 minutes). The site now carries <b>{report.get('published', 0)}</b> "
        f"({by.get('tiktok', 0)} TikTok, {by.get('instagram', 0)} Instagram, {by.get('youtube', 0)} YouTube; "
        f"{report.get('publishedLearn', 0)} of them Mëso).</p>"
        f"<p style='margin:0;color:#555;font-size:13px'>Searched: {report.get('tiktok_accounts_ok', 0)} official TikTok "
        f"accounts, {report.get('exa_queries', 0)} Agent Reach (Exa) searches, {report.get('instagram_rendered', 0)} "
        f"Instagram reels rendered; to judge: {report.get('tiktok_candidates', 0)} TikTok outliers, "
        f"{report.get('learn_tiktok_candidates', 0)} TikTok Mëso, {report.get('instagram_candidates', 0)} Instagram reels, "
        f"{report.get('youtube_candidates', 0)} YouTube Shorts; {report.get('judged', 0)} judged. Exit status {status}.</p>"
    )
    rows = "".join(card(p) for p in approved) or "<tr><td style='color:#777;padding:10px 0'>No new video passed this run.</td></tr>"
    send(f"383 Video: {len(approved)} new videos published ({now:%H:%M})", wrap(
        f"<h2 style='margin:0 0 8px'>Run finished at {now:%H:%M}</h2>{summary}"
        f"<table style='width:100%;border-collapse:collapse;margin-top:12px'>{rows}</table>"
        + (f"<p style='margin-top:14px;font-size:13px;color:#555'>Not approved:</p><ul style='font-size:13px;color:#555'>{reasons}</ul>" if reasons else "")
        + f"<p style='margin-top:14px'><a href='{SITE}' style='color:#FF4422;font-weight:800'>Open 383ks.com</a></p>"))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if mode == "start":
            start()
        elif mode == "finish":
            finish(int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].lstrip("-").isdigit() else 0)
        else:
            print(__doc__)
    except Exception as exc:  # noqa: BLE001 — an email must never fail the run
        print(f"VIDEO MAIL: {exc}", file=sys.stderr)
    raise SystemExit(0)
