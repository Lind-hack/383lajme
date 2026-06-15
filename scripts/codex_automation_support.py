#!/usr/bin/env python3
"""
Support utilities for the Codex/GPT-5.5 hourly news automation.

The Codex automation still performs the editorial work. This script handles the
repeatable parts that should not be improvised each run: env loading, JSON
validation, email reporting, Vercel deploy hook calls, and git publishing.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import smtplib
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
AUTO_DIR = REPO_ROOT / "data" / "auto-articles"
PARENT_ENV = REPO_ROOT.parent / ".env"
ENV_FILES = [
    PARENT_ENV,
    REPO_ROOT / ".env",
    REPO_ROOT / ".env.local",
    REPO_ROOT / ".env.automation",
]

REQUIRED_FIELDS = {
    "id",
    "slug",
    "url",
    "dispatch",
    "title",
    "excerpt",
    "body",
    "source",
    "source_flag",
    "source_bias",
    "tone",
    "category",
    "published_at",
    "reading_time",
    "featured",
    "engagement_score",
    "score_reason",
    "score_breakdown",
    "score_formula",
    "image_url",
    "created_at",
}

VALID_CATEGORIES = {
    "Politikë",
    "Ekonomi",
    "Botë",
    "Siguri",
    "Sport",
    "Teknologji",
    "Kulturë",
    "Shoqëri",
    "Showbiz",
}

SCORE_WEIGHTS = {
    "relevance": 0.35,
    "urgency": 0.20,
    "interest": 0.30,
    "credibility": 0.15,
}


def load_env() -> list[str]:
    loaded: list[str] = []
    for env_file in ENV_FILES:
        if not env_file.exists():
            continue
        loaded.append(str(env_file))
        for raw_line in env_file.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    return loaded


def latest_batch_path() -> Path | None:
    files = sorted(AUTO_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def read_articles(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path.name} must contain a JSON array")
    return data


def _score_from_breakdown(breakdown: dict[str, Any]) -> float:
    total = 0.0
    for key, weight in SCORE_WEIGHTS.items():
        value = float(breakdown.get(key, 0))
        total += max(1.0, min(10.0, value)) * weight
    return round(total, 1)


def validate_batch(path: Path) -> list[dict[str, Any]]:
    articles = read_articles(path)
    errors: list[str] = []
    seen_urls: set[str] = set()
    seen_slugs: set[str] = set()
    seen_images: set[str] = set()

    if not articles:
        errors.append(f"{path.name} contains no articles")

    for index, article in enumerate(articles, 1):
        label = f"article {index}"
        missing = sorted(REQUIRED_FIELDS - set(article))
        if missing:
            errors.append(f"{label} missing fields: {', '.join(missing)}")

        category = str(article.get("category", ""))
        if category not in VALID_CATEGORIES:
            errors.append(f"{label} invalid category: {category!r}")

        url = str(article.get("url", ""))
        if not url.startswith(("http://", "https://")):
            errors.append(f"{label} invalid url: {url!r}")
        if url in seen_urls:
            errors.append(f"{label} duplicate url in batch: {url}")
        seen_urls.add(url)

        slug = str(article.get("slug", ""))
        if not re.fullmatch(r"[a-z0-9-]{8,120}", slug):
            errors.append(f"{label} suspicious slug: {slug!r}")
        if slug in seen_slugs:
            errors.append(f"{label} duplicate slug in batch: {slug}")
        seen_slugs.add(slug)

        image = str(article.get("image_url", ""))
        if image and image in seen_images:
            errors.append(f"{label} duplicate image in batch: {image}")
        if image:
            seen_images.add(image)

        for field in ("title", "excerpt", "body", "source", "score_reason"):
            value = str(article.get(field, ""))
            if not value.strip():
                errors.append(f"{label} empty {field}")
            if "Ã" in value or "Â" in value:
                errors.append(f"{label} possible mojibake in {field}")

        try:
            reading_time = int(article.get("reading_time", 0))
            if reading_time < 1:
                errors.append(f"{label} reading_time must be >= 1")
        except Exception:
            errors.append(f"{label} reading_time is not an integer")

        breakdown = article.get("score_breakdown")
        if not isinstance(breakdown, dict):
            errors.append(f"{label} score_breakdown must be an object")
        else:
            for key in SCORE_WEIGHTS:
                if key not in breakdown:
                    errors.append(f"{label} score_breakdown missing {key}")
            try:
                expected = _score_from_breakdown(breakdown)
                actual = round(float(article.get("engagement_score", 0)), 1)
                if abs(expected - actual) > 0.2:
                    errors.append(f"{label} score mismatch: expected {expected}, got {actual}")
            except Exception:
                errors.append(f"{label} engagement_score is not numeric")

    if errors:
        raise ValueError("\n".join(errors))
    return articles


def env_status() -> int:
    load_env()
    checks = {
        "GMAIL_USER": bool(os.environ.get("GMAIL_USER", "").strip()),
        "GMAIL_APP_PASSWORD": bool(os.environ.get("GMAIL_APP_PASSWORD", "").strip()),
        "RECIPIENT_EMAIL": bool(os.environ.get("RECIPIENT_EMAIL", "").strip()),
        "SITE_URL": bool(os.environ.get("SITE_URL", "").strip()),
        "REMOVE_SECRET": bool(os.environ.get("REMOVE_SECRET", "").strip()),
        "ADMIN_SECRET": bool(os.environ.get("ADMIN_SECRET", "").strip()),
        "VERCEL_DEPLOY_HOOK_URL": bool(os.environ.get("VERCEL_DEPLOY_HOOK_URL", "").strip()),
    }
    print("Env files loaded:")
    for env_file in [str(p) for p in ENV_FILES if p.exists()]:
        print(f"  - {env_file}")
    print("Secret/config presence:")
    for key, present in checks.items():
        print(f"  - {key}: {'present' if present else 'missing'}")

    hook = os.environ.get("VERCEL_DEPLOY_HOOK_URL", "").strip()
    if hook and "/v1/integrations/deploy/" not in hook:
        print("WARN VERCEL_DEPLOY_HOOK_URL does not look like a Vercel deploy hook URL.")
    return 0


def test_email_login() -> int:
    load_env()
    user = os.environ.get("GMAIL_USER", "").strip()
    password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    if not user or not password:
        print("EMAIL missing GMAIL_USER or GMAIL_APP_PASSWORD")
        return 2
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
            smtp.login(user, password)
        print("EMAIL login ok")
        return 0
    except smtplib.SMTPAuthenticationError:
        print("EMAIL login failed: Gmail rejected GMAIL_USER/GMAIL_APP_PASSWORD. Use a Google app password for this Gmail account.")
        return 1
    except Exception as exc:
        print(f"EMAIL login failed: {type(exc).__name__}")
        return 1


def post_vercel_hook() -> int:
    load_env()
    hook = os.environ.get("VERCEL_DEPLOY_HOOK_URL", "").strip()
    if not hook:
        print("VERCEL skipped: VERCEL_DEPLOY_HOOK_URL missing")
        return 2
    if "/v1/integrations/deploy/" not in hook:
        print("VERCEL failed: URL does not look like a Vercel deploy hook. Re-copy the Deploy Hook URL from Vercel.")
        return 1

    attempts = [
        ("empty", b"", {}),
        ("json", b"{}", {"Content-Type": "application/json"}),
    ]
    for label, body, headers in attempts:
        try:
            request = urllib.request.Request(hook, data=body, method="POST", headers=headers)
            with urllib.request.urlopen(request, timeout=30) as response:
                status = response.getcode()
                if 200 <= status < 300:
                    print(f"VERCEL deploy hook ok via {label} POST")
                    return 0
                print(f"VERCEL {label} POST status {status}")
        except urllib.error.HTTPError as exc:
            detail = exc.read(200).decode("utf-8", errors="replace")
            print(f"VERCEL {label} POST failed HTTP {exc.code}: {detail}")
        except Exception as exc:
            print(f"VERCEL {label} POST failed: {type(exc).__name__}")
    return 1


def send_report(path: Path) -> int:
    load_env()
    articles = validate_batch(path)
    user = os.environ.get("GMAIL_USER", "").strip()
    password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    recipient = os.environ.get("RECIPIENT_EMAIL", "").strip() or "lindsylqa@gmail.com"
    site_url = os.environ.get("SITE_URL", "").strip().rstrip("/")
    remove_secret = os.environ.get("REMOVE_SECRET", "").strip()
    if not user or not password:
        print("EMAIL skipped: GMAIL_USER or GMAIL_APP_PASSWORD missing")
        return 2

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    rows: list[str] = []
    for article in articles:
        title = str(article["title"])
        score = float(article["engagement_score"])
        category = str(article["category"])
        source = str(article["source"])
        original_url = str(article["url"])
        breakdown = article.get("score_breakdown", {})
        edit_link = ""
        remove_link = ""
        if site_url:
            edit_link = f'{site_url}/admin?id={article["id"]}'
            if remove_secret:
                remove_link = f'{site_url}/api/remove?id={article["id"]}&file={path.name}&secret={remove_secret}'
        rows.append(
            "<tr><td style='padding:14px;border-bottom:1px solid #333'>"
            f"<b>{title}</b><br>"
            f"{category} · {source} · <b>{score:.1f}/10</b><br>"
            f"relevance {breakdown.get('relevance')} · urgency {breakdown.get('urgency')} · "
            f"interest {breakdown.get('interest')} · credibility {breakdown.get('credibility')}<br>"
            f"{article.get('score_reason', '')}<br>"
            f"<a href='{original_url}'>Original</a>"
            + (f" · <a href='{edit_link}'>Edit</a>" if edit_link else "")
            + (f" · <a href='{remove_link}'>Remove</a>" if remove_link else "")
            + "</td></tr>"
        )

    html = (
        "<html><body style='background:#111;color:#eee;font-family:Arial,sans-serif'>"
        "<div style='max-width:760px;margin:auto;background:#1a1a1a'>"
        f"<h2 style='padding:18px;margin:0'>383 Lajme: {len(articles)} artikuj të rinj</h2>"
        f"<p style='padding:0 18px;color:#aaa'>{now} · Scoring: relevance 35% + urgency 20% + interest 30% + credibility 15%</p>"
        "<table width='100%' cellspacing='0' cellpadding='0'>"
        + "".join(rows)
        + "</table></div></body></html>"
    )
    message = MIMEMultipart("alternative")
    message["Subject"] = f"383 Lajme — {len(articles)} artikuj të rinj [{now}]"
    message["From"] = user
    message["To"] = recipient
    message.attach(MIMEText(html, "html", "utf-8"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
            smtp.login(user, password)
            smtp.sendmail(user, recipient, message.as_string())
        print(f"EMAIL report sent to {recipient}")
        return 0
    except smtplib.SMTPAuthenticationError:
        print("EMAIL failed: Gmail rejected GMAIL_USER/GMAIL_APP_PASSWORD. Use a Google app password for this Gmail account.")
        return 1
    except Exception as exc:
        print(f"EMAIL failed: {type(exc).__name__}")
        return 1


def git_publish(path: Path) -> int:
    validate_batch(path)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    commands = [
        ["git", "config", "user.name", "383 Codex News Bot"],
        ["git", "config", "user.email", "bot@383lajme.com"],
        ["git", "add", str(path.relative_to(REPO_ROOT)).replace("\\", "/")],
        ["git", "diff", "--staged", "--quiet"],
    ]
    for command in commands[:3]:
        subprocess.run(command, cwd=REPO_ROOT, check=True)
    diff = subprocess.run(commands[3], cwd=REPO_ROOT)
    if diff.returncode == 0:
        print("GIT no staged article changes")
        return 0
    subprocess.run(["git", "commit", "-m", f"chore: GPT-5.5 verified news run {timestamp}"], cwd=REPO_ROOT, check=True)
    subprocess.run(["git", "pull", "--rebase", "--autostash", "origin", "main"], cwd=REPO_ROOT, check=True)
    subprocess.run(["git", "push", "origin", "main"], cwd=REPO_ROOT, check=True)
    print("GIT published article batch")
    return 0


def finalize(path: Path) -> int:
    articles = validate_batch(path)
    print(f"VALID {path.name}: {len(articles)} articles")
    git_publish(path)

    deploy_code = post_vercel_hook()
    if deploy_code != 0:
        print("WARN deploy hook did not complete. If Vercel is connected to GitHub, the git push may still deploy automatically.")

    email_code = send_report(path)
    if email_code != 0:
        print("WARN SMTP email did not complete. Use the Outlook Email connector to send the report if available.")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["env-status", "validate", "test-email", "deploy", "send-report", "publish", "finalize"])
    parser.add_argument("--file", help="Article JSON file. Defaults to latest data/auto-articles/*.json")
    args = parser.parse_args()

    path = Path(args.file).resolve() if args.file else latest_batch_path()
    if args.command in {"validate", "send-report", "publish", "finalize"}:
        if path is None:
            print("No article batch found")
            return 2
        if not path.exists():
            print(f"Article batch not found: {path}")
            return 2

    if args.command == "env-status":
        return env_status()
    if args.command == "validate":
        assert path is not None
        articles = validate_batch(path)
        print(f"VALID {path.name}: {len(articles)} articles")
        return 0
    if args.command == "test-email":
        return test_email_login()
    if args.command == "deploy":
        return post_vercel_hook()
    if args.command == "send-report":
        assert path is not None
        return send_report(path)
    if args.command == "publish":
        assert path is not None
        return git_publish(path)
    if args.command == "finalize":
        assert path is not None
        return finalize(path)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
