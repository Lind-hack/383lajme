#!/usr/bin/env python3
"""
Support utilities for the Codex/GPT-5.5 hourly news automation.

The Codex automation still performs the editorial work. This script handles the
repeatable parts that should not be improvised each run: env loading, JSON
validation, email reporting, Vercel deploy hook calls, and git publishing.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import smtplib
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
AUTO_DIR = REPO_ROOT / "data" / "auto-articles"
PARENT_ENV = REPO_ROOT.parent / ".env"
CODEX_WORKTREE_ENV = Path.home() / ".codex" / "worktrees" / "a27e" / ".env"
ENV_FILES = [
    PARENT_ENV,
    REPO_ROOT / ".env",
    REPO_ROOT / ".env.local",
    REPO_ROOT / ".env.automation",
    CODEX_WORKTREE_ENV,
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
    "relevance": 0.22,
    "urgency": 0.14,
    "public_impact": 0.16,
    "local_depth": 0.10,
    "controversy_interest": 0.10,
    "credibility": 0.16,
    "corroboration": 0.08,
    "editorial_safety": 0.04,
}

DEFAULT_SITE_URL = "https://383lajme.vercel.app"


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
                    try:
                        payload = json.loads(response.read().decode("utf-8", errors="replace") or "{}")
                        deployment_url = payload.get("url")
                        if deployment_url:
                            print(f"VERCEL deployment url: https://{deployment_url}")
                    except Exception:
                        pass
                    return 0
                print(f"VERCEL {label} POST status {status}")
        except urllib.error.HTTPError as exc:
            detail = exc.read(200).decode("utf-8", errors="replace")
            print(f"VERCEL {label} POST failed HTTP {exc.code}: {detail}")
        except Exception as exc:
            print(f"VERCEL {label} POST failed: {type(exc).__name__}")
    return 1


def _cache_busted_url(site_url: str) -> str:
    separator = "&" if "?" in site_url else "?"
    return f"{site_url}{separator}codexVerify={int(time.time())}"


def verify_public_site(path: Path) -> int:
    load_env()
    articles = validate_batch(path)
    site_url = (os.environ.get("SITE_URL", "").strip() or DEFAULT_SITE_URL).rstrip("/")
    if not site_url.startswith(("http://", "https://")):
        print(f"SITE VERIFY skipped: invalid SITE_URL {site_url!r}")
        return 2

    expected_markers = [
        (
            str(article.get("slug", "")).strip(),
            str(article.get("title", "")).strip(),
        )
        for article in articles
    ]
    timeout_seconds = int(os.environ.get("SITE_VERIFY_TIMEOUT_SECONDS", "240"))
    interval_seconds = int(os.environ.get("SITE_VERIFY_INTERVAL_SECONDS", "20"))
    deadline = time.time() + max(0, timeout_seconds)
    attempt = 0
    last_status = "not checked"
    last_cache = "unknown"
    last_age = "unknown"
    last_etag = "unknown"

    while True:
        attempt += 1
        try:
            request = urllib.request.Request(
                _cache_busted_url(site_url),
                headers={
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "User-Agent": "383-codex-site-verifier/1.0",
                },
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                html_text = response.read().decode("utf-8", errors="replace")
                last_status = str(response.getcode())
                last_cache = response.headers.get("x-vercel-cache", "unknown")
                last_age = response.headers.get("age", "unknown")
                last_etag = response.headers.get("etag", "unknown")
                matched_slug = next(
                    (
                        slug
                        for slug, title in expected_markers
                        if (slug and slug in html_text) or (title and title in html_text)
                    ),
                    "",
                )
                if matched_slug:
                    print(
                        "SITE VERIFY ok: "
                        f"{site_url} contains batch marker {matched_slug!r} "
                        f"(attempt {attempt}, cache {last_cache}, age {last_age})"
                    )
                    return 0
                print(
                    "SITE VERIFY pending: "
                    f"{site_url} missing all {len(expected_markers)} batch markers "
                    f"(attempt {attempt}, status {last_status}, cache {last_cache}, age {last_age})"
                )
        except urllib.error.HTTPError as exc:
            last_status = f"HTTP {exc.code}"
            last_cache = exc.headers.get("x-vercel-cache", "unknown")
            last_age = exc.headers.get("age", "unknown")
            last_etag = exc.headers.get("etag", "unknown")
            print(f"SITE VERIFY pending: {site_url} returned {last_status}")
        except Exception as exc:
            last_status = type(exc).__name__
            print(f"SITE VERIFY pending: {site_url} check failed with {last_status}")

        if time.time() >= deadline:
            break
        time.sleep(max(1, interval_seconds))

    print(
        "SITE VERIFY failed: "
        f"{site_url} still does not contain any marker from {path.name}. "
        f"Last status {last_status}, cache {last_cache}, age {last_age}, etag {last_etag}. "
        "If GitHub main has the batch, the Vercel hook/domain is stale or targets a different deployment."
    )
    return 1


def _score_color(score: float) -> tuple[str, str]:
    if score >= 9.0:
        return "#ecfdf5", "#047857"
    if score >= 8.0:
        return "#eff6ff", "#1d4ed8"
    if score >= 7.0:
        return "#fffbeb", "#b45309"
    if score >= 6.0:
        return "#fff7ed", "#c2410c"
    return "#fef2f2", "#b91c1c"


def _article_score(article: dict[str, Any]) -> float:
    return round(float(article.get("engagement_score", 0)), 1)


def _breakdown_text(article: dict[str, Any]) -> str:
    breakdown = article.get("score_breakdown", {})
    if not isinstance(breakdown, dict):
        return ""
    parts: list[str] = []
    for key in SCORE_WEIGHTS:
        if key in breakdown:
            label = key.replace("_", " ")
            parts.append(f"{label} {breakdown.get(key)}")
    return " | ".join(parts)


def _article_card(article: dict[str, Any], path: Path, site_url: str, remove_secret: str, compact: bool = False) -> str:
    score = _article_score(article)
    score_bg, score_fg = _score_color(score)
    title = html.escape(str(article.get("title", "")))
    category = html.escape(str(article.get("category", "")))
    source = html.escape(str(article.get("source", "")))
    reason = html.escape(str(article.get("score_reason", "")))
    original_url = html.escape(str(article.get("url", "")), quote=True)
    image_url = html.escape(str(article.get("image_url", "")).strip(), quote=True)
    breakdown = html.escape(_breakdown_text(article))
    score_formula = html.escape(str(article.get("score_formula", "")))

    image_cell = ""
    if image_url:
        image_cell = (
            "<td width='128' style='padding:0 14px 0 0;vertical-align:top'>"
            f"<img src='{image_url}' alt='' width='128' "
            "style='width:128px;max-width:128px;height:82px;object-fit:cover;border-radius:8px;display:block;background:#e5e7eb'>"
            "</td>"
        )

    edit_link = ""
    remove_link = ""
    if site_url:
        edit_link = html.escape(f'{site_url}/admin?id={article["id"]}', quote=True)
        if remove_secret:
            remove_link = html.escape(f'{site_url}/api/remove?id={article["id"]}&file={path.name}&secret={remove_secret}', quote=True)

    links = f"<a href='{original_url}' style='color:#2563eb;text-decoration:none;font-weight:700'>Original</a>"
    if edit_link:
        links += f" <span style='color:#94a3b8'>|</span> <a href='{edit_link}' style='color:#2563eb;text-decoration:none;font-weight:700'>Edit</a>"
    if remove_link:
        links += f" <span style='color:#94a3b8'>|</span> <a href='{remove_link}' style='color:#dc2626;text-decoration:none;font-weight:700'>Remove</a>"

    details = "" if compact else (
        f"<div style='font-size:12px;line-height:1.55;color:#475569;margin-top:8px'>{breakdown}</div>"
        f"<div style='font-size:12px;line-height:1.55;color:#64748b;margin-top:4px'>{score_formula}</div>"
        f"<div style='font-size:13px;line-height:1.55;color:#334155;margin-top:8px'>{reason}</div>"
    )
    padding = "14px 0" if compact else "18px 0"
    return (
        f"<table width='100%' cellspacing='0' cellpadding='0' style='border-bottom:1px solid #e2e8f0;padding:{padding}'>"
        "<tr>"
        f"{image_cell}"
        "<td style='vertical-align:top'>"
        f"<div style='font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:700'>{category} | {source}</div>"
        f"<div style='font-size:17px;line-height:1.35;color:#0f172a;font-weight:800;margin-top:4px'>{title}</div>"
        f"<div style='margin-top:8px'><span style='display:inline-block;background:{score_bg};color:{score_fg};border:1px solid {score_fg};border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800'>Score {score:.1f}/10</span></div>"
        f"{details}"
        f"<div style='font-size:13px;margin-top:10px'>{links}</div>"
        "</td>"
        "</tr></table>"
    )


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
    sorted_articles = sorted(articles, key=_article_score, reverse=True)
    breaking_articles = [article for article in sorted_articles if _article_score(article) >= 8.5][:5]

    breaking_html = (
        "<div style='padding:16px 22px 8px'>"
        "<div style='display:inline-block;background:#b91c1c;color:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase'>Breaking News</div>"
        "<div style='font-size:13px;color:#64748b;margin-top:8px'>High-score stories that should be checked first.</div>"
        + (
            "".join(_article_card(article, path, site_url, remove_secret, compact=True) for article in breaking_articles)
            if breaking_articles
            else "<div style='font-size:13px;color:#64748b;padding:14px 0;border-bottom:1px solid #e2e8f0'>No article crossed the breaking threshold in this run.</div>"
        )
        + "</div>"
    )

    category_order = ["Politikë", "Ekonomi", "Siguri", "Sport", "Showbiz", "Botë", "Teknologji", "Kulturë", "Shoqëri"]
    category_sections: list[str] = []
    for category in category_order:
        category_articles = [article for article in sorted_articles if str(article.get("category")) == category]
        if not category_articles:
            continue
        category_sections.append(
            "<div style='padding:16px 22px 0'>"
            f"<div style='font-size:14px;color:#0f172a;font-weight:900;border-bottom:2px solid #0f172a;padding-bottom:6px'>{html.escape(category)}</div>"
            + "".join(_article_card(article, path, site_url, remove_secret) for article in category_articles)
            + "</div>"
        )

    scoring_note = (
        "Scoring: relevance 22% + urgency 14% + public impact 16% + local depth 10% + "
        "controversy/interest 10% + credibility 16% + corroboration 8% + editorial safety 4%."
    )
    report_html = (
        "<html><body style='margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif'>"
        "<div style='max-width:820px;margin:0 auto;background:#ffffff'>"
        "<div style='background:#0f172a;color:#ffffff;padding:22px'>"
        f"<h2 style='font-size:24px;line-height:1.2;padding:0;margin:0'>383 Lajme: {len(articles)} artikuj të rinj</h2>"
        f"<p style='font-size:13px;line-height:1.5;margin:8px 0 0;color:#cbd5e1'>{now} | Images shown are the article image_url values published with the batch.</p>"
        "</div>"
        f"<div style='padding:12px 22px;background:#f8fafc;color:#475569;font-size:13px;line-height:1.45'>{scoring_note}</div>"
        + breaking_html
        + "".join(category_sections)
        + "<div style='padding:18px 22px;color:#64748b;font-size:12px;line-height:1.5'>Review skipped or excluded stories separately for accuracy limits before republishing them.</div>"
        + "</div></body></html>"
    )
    message = MIMEMultipart("alternative")
    message["Subject"] = f"383 Lajme — {len(articles)} artikuj të rinj [{now}]"
    message["From"] = user
    message["To"] = recipient
    message.attach(MIMEText(report_html, "html", "utf-8"))
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

    verify_code = verify_public_site(path)
    if verify_code != 0:
        print("ERROR public site verification did not confirm the new batch on the production domain.")
        return 1

    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["env-status", "validate", "test-email", "deploy", "verify-site", "send-report", "publish", "finalize"])
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
    if args.command == "verify-site":
        return verify_public_site(path)
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
