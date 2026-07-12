#!/usr/bin/env python3
"""
Support utilities for the Codex/GPT-5.5 hourly news automation.

The Codex automation still performs the editorial work. This script handles the
repeatable parts that should not be improvised each run: env loading, JSON
validation, email reporting, Vercel deploy hook calls, and git publishing.
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import math
import os
import re
import smtplib
import socket
import subprocess
import sys
import time
import urllib.error
from urllib.parse import urlparse
import urllib.request
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from io import BytesIO
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
    "image_width",
    "image_height",
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

KOSOVO_COMPETITOR_SOURCES = {
    "albanian post",
    "bota sot",
    "dukagjini",
    "ekonomia online",
    "express",
    "gazeta express",
    "indeksonline",
    "insajderi",
    "kallxo",
    "klan kosova",
    "koha",
    "koha.net",
    "kosovapress",
    "lajmi.net",
    "nacionale",
    "periskopi",
    "reporteri",
    "rtk",
    "sinjali",
    "telegrafi",
    "zeri",
}

SOCIAL_DOMAINS = {
    "instagram.com": "Instagram",
    "tiktok.com": "TikTok",
    "twitter.com": "X/Twitter",
    "x.com": "X/Twitter",
    "threads.net": "Threads",
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "reddit.com": "Reddit",
    "polymarket.com": "Polymarket",
    "linkedin.com": "LinkedIn",
    "pinterest.com": "Pinterest",
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
DEFAULT_GITHUB_REPO = "Lind-hack/383lajme"
MIN_ARTICLES_PER_BATCH = 20
MAX_ARTICLES_PER_BATCH = 22
MAX_X_ARTICLES = 2
MAX_SOCIAL_SHARE = 0.40
MIN_SOCIAL_ARTICLES = 4
MIN_SOURCE_FAMILIES = 8
MIN_ARTICLE_WORDS = 500
MIN_ARTICLE_PARAGRAPHS = 5
WORDS_PER_READING_MINUTE = 200
MIN_IMAGE_WIDTH = 1200
MIN_IMAGE_HEIGHT = 675


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


def normalize_batch(path: Path) -> list[dict[str, Any]]:
    """Correct deterministic fields that the editorial model should not calculate."""
    articles = read_articles(path)
    changed = 0
    for article in articles:
        breakdown = article.get("score_breakdown")
        if isinstance(breakdown, dict) and all(key in breakdown for key in SCORE_WEIGHTS):
            score = _score_from_breakdown(breakdown)
            if article.get("engagement_score") != score:
                article["engagement_score"] = score
                changed += 1

        reading_time = max(1, math.ceil(_body_word_count(article.get("body")) / WORDS_PER_READING_MINUTE))
        if article.get("reading_time") != reading_time:
            article["reading_time"] = reading_time
            changed += 1

        image_url = str(article.get("image_url") or "").strip()
        if image_url.startswith(("http://", "https://")):
            dimensions = _fetch_image_dimensions(image_url)
            if dimensions:
                width, height = dimensions
                if article.get("image_width") != width:
                    article["image_width"] = width
                    changed += 1
                if article.get("image_height") != height:
                    article["image_height"] = height
                    changed += 1

    if changed:
        path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"NORMALIZED {path.name}: {changed} deterministic field update(s)")
    return articles


def _score_from_breakdown(breakdown: dict[str, Any]) -> float:
    total = 0.0
    for key, weight in SCORE_WEIGHTS.items():
        value = float(breakdown.get(key, 0))
        total += max(1.0, min(10.0, value)) * weight
    return round(total, 1)


def _source_key(source: object) -> str:
    value = str(source or "").strip().lower()
    value = re.sub(r"^www\.", "", value)
    value = value.removesuffix(".com").removesuffix(".net").removesuffix(".org")
    return value


def _domain_platform(value: object) -> str:
    text = str(value or "").strip().lower()
    for domain, platform in SOCIAL_DOMAINS.items():
        if domain in text:
            return platform
    return ""


def _social_platform(article: dict[str, Any]) -> str:
    explicit = str(article.get("social_platform") or article.get("source_platform") or "").strip()
    if explicit:
        return explicit
    return _domain_platform(article.get("social_post_url")) or _domain_platform(article.get("source_post_url")) or _domain_platform(article.get("url")) or _domain_platform(article.get("source"))


def _social_post_url(article: dict[str, Any]) -> str:
    return str(article.get("social_post_url") or article.get("source_post_url") or "").strip()


def _social_account(article: dict[str, Any]) -> str:
    return str(article.get("social_post_account") or article.get("source_account") or "").strip()


def _social_basis(article: dict[str, Any]) -> str:
    return str(article.get("social_post_basis") or article.get("source_post_basis") or article.get("source_post_quote") or "").strip()


def _reader_facing_source_terms(article: dict[str, Any]) -> list[str]:
    terms: list[str] = []
    source = str(article.get("source") or "").strip()
    account = _social_account(article).lstrip("@").strip()
    platform = _social_platform(article).strip()
    for value in (source, account, platform):
        normalized = value.casefold()
        if len(normalized) >= 4 and normalized not in terms:
            terms.append(normalized)
    return terms


def _hostname(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if not text.startswith(("http://", "https://")):
        text = f"https://{text}"
    try:
        host = urlparse(text).netloc.lower()
    except Exception:
        return ""
    if "@" in host:
        host = host.rsplit("@", 1)[-1]
    return re.sub(r"^www\.", "", host.split(":", 1)[0])


def _source_family(article: dict[str, Any]) -> str:
    platform = _social_platform(article).strip().lower()
    if platform:
        if platform in {"x", "twitter", "x/twitter"}:
            return "x/twitter"
        return platform

    for field in ("url", "source", "social_post_url", "source_post_url"):
        host = _hostname(article.get(field))
        if host:
            if host in {"x.com", "twitter.com"}:
                return "x/twitter"
            parts = host.split(".")
            if len(parts) >= 2:
                return ".".join(parts[-2:])
            return host
    return _source_key(article.get("source", "")) or "unknown"


def _body_word_count(value: object) -> int:
    return len(re.findall(r"\b\w+[\w'-]*\b", str(value or ""), flags=re.UNICODE))


def _paragraph_count(value: object) -> int:
    return len([part for part in re.split(r"\n\s*\n", str(value or "").strip()) if part.strip()])


def _fetch_image_dimensions(image_url: str) -> tuple[int, int]:
    """Fetch a public image and return decoded pixel dimensions."""
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Pillow is required for strict image validation") from exc

    request = urllib.request.Request(
        image_url,
        headers={"User-Agent": "383-Lajme-Image-Validator/1.0"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = response.read(15_000_000)
    if not payload:
        raise ValueError("empty response")
    with Image.open(BytesIO(payload)) as image:
        image.verify()
    with Image.open(BytesIO(payload)) as image:
        return image.size


def validate_batch(path: Path) -> list[dict[str, Any]]:
    articles = read_articles(path)
    errors: list[str] = []
    seen_urls: set[str] = set()
    seen_slugs: set[str] = set()
    seen_images: set[str] = set()
    source_families: list[str] = []
    x_based_count = 0
    social_based_count = 0
    image_dimensions: dict[str, tuple[int, int] | str] = {}

    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3])\.json", path.name):
        errors.append(f"{path.name} must use UTC hour format YYYY-MM-DDTHH.json with HH from 00 to 23")

    if not articles:
        errors.append(f"{path.name} contains no articles")
    if len(articles) < MIN_ARTICLES_PER_BATCH:
        errors.append(
            f"{path.name} contains only {len(articles)} articles; publish at least "
            f"{MIN_ARTICLES_PER_BATCH} fresh Kosovo-audience stories per cron run."
        )
    if len(articles) > MAX_ARTICLES_PER_BATCH:
        errors.append(
            f"{path.name} contains {len(articles)} articles; cap each run at "
            f"{MAX_ARTICLES_PER_BATCH} high-quality stories so weak filler is not published."
        )

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
        if not image.startswith(("http://", "https://")):
            errors.append(f"{label} missing valid image_url")
        if image and image in seen_images:
            errors.append(f"{label} duplicate image in batch: {image}")
        if image:
            seen_images.add(image)
            dimensions = image_dimensions.get(image)
            if dimensions is None:
                try:
                    dimensions = _fetch_image_dimensions(image)
                except Exception as exc:
                    dimensions = f"{type(exc).__name__}: {exc}"
                image_dimensions[image] = dimensions
            if isinstance(dimensions, str):
                errors.append(f"{label} image_url could not be fetched and decoded: {dimensions}")
            else:
                actual_width, actual_height = dimensions
                try:
                    declared_width = int(article.get("image_width", 0))
                    declared_height = int(article.get("image_height", 0))
                except Exception:
                    declared_width = declared_height = 0
                if declared_width != actual_width or declared_height != actual_height:
                    errors.append(
                        f"{label} image dimensions do not match image_url: declared "
                        f"{declared_width}x{declared_height}, actual {actual_width}x{actual_height}"
                    )
                if actual_width < MIN_IMAGE_WIDTH or actual_height < MIN_IMAGE_HEIGHT:
                    errors.append(
                        f"{label} image is too small ({actual_width}x{actual_height}); require at least "
                        f"{MIN_IMAGE_WIDTH}x{MIN_IMAGE_HEIGHT}"
                    )

        source_key = _source_key(article.get("source", ""))
        if source_key in KOSOVO_COMPETITOR_SOURCES:
            errors.append(
                f"{label} uses Kosovo competitor as main source: {article.get('source')!r}. "
                "Use outside/primary/social discovery sources and Kosovo outlets only for context."
            )

        social_platform = _social_platform(article)
        social_post_url = _social_post_url(article)
        social_account = _social_account(article)
        social_basis = _social_basis(article)
        source_family = _source_family(article)
        source_families.append(source_family)
        if source_family == "x/twitter":
            x_based_count += 1
        if social_platform:
            social_based_count += 1
            if not social_post_url and _domain_platform(article.get("url")).lower() != social_platform.lower():
                errors.append(
                    f"{label} is social-driven but missing social_post_url/source_post_url. "
                    "Include the exact post/status URL used as the basis."
                )
            if not social_account:
                errors.append(f"{label} is social-driven but missing social_post_account/source_account.")
            if not social_basis:
                errors.append(f"{label} is social-driven but missing social_post_basis/source_post_basis.")

        reader_text = f"{article.get('title', '')} {article.get('excerpt', '')}".casefold()
        for term in _reader_facing_source_terms(article):
            if term in reader_text:
                errors.append(
                    f"{label} reader-facing title/excerpt mentions source, platform, or account {term!r}. "
                    "Keep source attribution in metadata or the body only when necessary."
                )

        if category == "Teknologji":
            combined_source = f"{article.get('source', '')} {social_account}".lower()
            url_host = _hostname(article.get("url"))
            social_host = _hostname(social_post_url)
            if "rundown" in combined_source or "therundown" in url_host or "therundown" in social_host:
                if url_host != "therundown.ai":
                    errors.append(
                        f"{label} uses The Rundown for Teknologji but the main article URL is not therundown.ai. "
                        "Use The Rundown website articles/newsletter pages, not X/Twitter."
                    )

        for field in ("title", "excerpt", "body", "source", "score_reason"):
            value = str(article.get(field, ""))
            if not value.strip():
                errors.append(f"{label} empty {field}")
            if "Ã" in value or "Â" in value:
                errors.append(f"{label} possible mojibake in {field}")

        word_count = _body_word_count(article.get("body"))
        paragraph_count = _paragraph_count(article.get("body"))
        if not social_platform:
            if word_count < MIN_ARTICLE_WORDS:
                errors.append(f"{label} body is too short ({word_count} words); require at least {MIN_ARTICLE_WORDS}")
            if paragraph_count < MIN_ARTICLE_PARAGRAPHS:
                errors.append(
                    f"{label} body has only {paragraph_count} paragraphs; require at least {MIN_ARTICLE_PARAGRAPHS}"
                )

        try:
            reading_time = int(article.get("reading_time", 0))
            if reading_time < 1:
                errors.append(f"{label} reading_time must be >= 1")
            expected_reading_time = max(1, math.ceil(word_count / WORDS_PER_READING_MINUTE))
            if reading_time != expected_reading_time:
                errors.append(
                    f"{label} reading_time must equal {expected_reading_time} for {word_count} body words; got {reading_time}"
                )
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

    if len(articles) >= 4:
        unique_families = {family for family in source_families if family and family != "unknown"}
        if x_based_count > MAX_X_ARTICLES:
            errors.append(
                f"batch is too X/Twitter-heavy: {x_based_count} articles are based on X/Twitter. "
                f"Use X as one signal only and cap it at {MAX_X_ARTICLES} articles per batch."
            )
        max_social = max(1, int(len(articles) * MAX_SOCIAL_SHARE))
        if social_based_count < MIN_SOCIAL_ARTICLES:
            errors.append(
                f"batch needs at least {MIN_SOCIAL_ARTICLES} social-driven stories from the required listening lanes; "
                f"found {social_based_count}."
            )
        if social_based_count > max_social:
            errors.append(
                f"batch is too social-heavy: {social_based_count} articles are social-driven. "
                f"Cap social-driven stories at {max_social} of {len(articles)} articles."
            )
        if len(unique_families) < min(MIN_SOURCE_FAMILIES, len(articles)):
            errors.append(
                f"batch source variety is too low: {len(unique_families)} source families found "
                f"({', '.join(sorted(unique_families)) or 'none'}). Use at least {MIN_SOURCE_FAMILIES} source families when possible."
            )

    if errors:
        raise ValueError("\n".join(errors))
    return articles


def env_status() -> int:
    load_env()
    github_token = _github_token()
    checks = {
        "GMAIL_USER": bool(os.environ.get("GMAIL_USER", "").strip()),
        "GMAIL_APP_PASSWORD": bool(os.environ.get("GMAIL_APP_PASSWORD", "").strip()),
        "RECIPIENT_EMAIL": bool(os.environ.get("RECIPIENT_EMAIL", "").strip()),
        "SITE_URL": bool(os.environ.get("SITE_URL", "").strip()),
        "REMOVE_SECRET": bool(os.environ.get("REMOVE_SECRET", "").strip()),
        "ADMIN_SECRET": bool(os.environ.get("ADMIN_SECRET", "").strip()),
        "VERCEL_DEPLOY_HOOK_URL": bool(os.environ.get("VERCEL_DEPLOY_HOOK_URL", "").strip()),
        "GITHUB_TOKEN/GITHUB_PAT/GH_TOKEN": bool(github_token),
        "RESEND_API_KEY": bool(os.environ.get("RESEND_API_KEY", "").strip()),
        "EMAIL_FROM": bool(os.environ.get("EMAIL_FROM", "").strip()),
        "SCRAPECREATORS_API_KEY": bool(os.environ.get("SCRAPECREATORS_API_KEY", "").strip()),
        "XAI_API_KEY": bool(os.environ.get("XAI_API_KEY", "").strip()),
        "INCLUDE_SOURCES": bool(os.environ.get("INCLUDE_SOURCES", "").strip()),
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
    origin = _git_stdout(["git", "remote", "get-url", "origin"])
    print(f"Git origin: {'present' if origin else 'missing'}")
    return 0


def test_email_login() -> int:
    load_env()
    if os.environ.get("RESEND_API_KEY", "").strip():
        sender = _email_from()
        recipient = os.environ.get("RECIPIENT_EMAIL", "").strip() or "lindsylqa@gmail.com"
        print(f"EMAIL HTTP provider configured: Resend ({sender} -> {recipient})")
        return 0

    user = os.environ.get("GMAIL_USER", "").strip()
    password = _gmail_app_password()
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
    except (TimeoutError, socket.timeout, OSError) as exc:
        print(f"EMAIL login failed: {type(exc).__name__}. SMTP may be blocked in this cloud environment or Gmail is unreachable.")
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


def _social_basis_html(article: dict[str, Any]) -> str:
    platform = _social_platform(article)
    if not platform:
        return ""

    post_url = _social_post_url(article) or str(article.get("url", "")).strip()
    account = _social_account(article)
    basis = _social_basis(article)

    bits: list[str] = [f"Platform: {html.escape(platform)}"]
    if account:
        bits.append(f"Account: {html.escape(account)}")

    line = " | ".join(bits)
    if post_url:
        safe_url = html.escape(post_url, quote=True)
        line += f" | <a href='{safe_url}' style='color:#2563eb;text-decoration:none;font-weight:700'>Source post</a>"
    if basis:
        line += f"<div style='margin-top:4px;color:#475569'>{html.escape(basis)}</div>"

    return (
        "<div style='font-size:12px;line-height:1.55;color:#334155;margin-top:8px;"
        "background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px'>"
        f"<strong>Social basis:</strong> {line}"
        "</div>"
    )


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
    social_basis = _social_basis_html(article)

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

    details = social_basis if compact else (
        f"<div style='font-size:12px;line-height:1.55;color:#475569;margin-top:8px'>{breakdown}</div>"
        f"<div style='font-size:12px;line-height:1.55;color:#64748b;margin-top:4px'>{score_formula}</div>"
        f"{social_basis}"
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


def _cron_slot_label() -> str:
    return os.environ.get("CRON_SLOT_LABEL", "").strip()


def _kosovo_time_label() -> str:
    previous_tz = os.environ.get("TZ")
    os.environ["TZ"] = "Europe/Belgrade"
    if hasattr(time, "tzset"):
        time.tzset()
    try:
        return datetime.now().strftime("%Y-%m-%d %H:%M Kosovo time")
    finally:
        if previous_tz is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = previous_tz
        if hasattr(time, "tzset"):
            time.tzset()

def send_report(path: Path) -> int:
    load_env()
    articles = validate_batch(path)
    user = os.environ.get("GMAIL_USER", "").strip()
    password = _gmail_app_password()
    recipient = os.environ.get("RECIPIENT_EMAIL", "").strip() or "lindsylqa@gmail.com"
    site_url = os.environ.get("SITE_URL", "").strip().rstrip("/")
    remove_secret = os.environ.get("REMOVE_SECRET", "").strip()
    resend_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not resend_key and (not user or not password):
        print("EMAIL skipped: set RESEND_API_KEY or GMAIL_USER/GMAIL_APP_PASSWORD")
        return 2

    now = _kosovo_time_label()
    cron_slot = _cron_slot_label()
    cron_slot_html = html.escape(cron_slot)
    run_line = (
        f"Cron slot: {cron_slot_html} | Email sent: {now}"
        if cron_slot
        else f"Email sent: {now}"
    )
    subject_time = cron_slot or now
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
        f"<p style='font-size:13px;line-height:1.5;margin:8px 0 0;color:#cbd5e1'>{run_line}</p>"
        "<p style='font-size:13px;line-height:1.5;margin:6px 0 0;color:#cbd5e1'>Images shown are the article image_url values published with the batch.</p>"
        "</div>"
        f"<div style='padding:12px 22px;background:#f8fafc;color:#475569;font-size:13px;line-height:1.45'>{scoring_note}</div>"
        + breaking_html
        + "".join(category_sections)
        + "<div style='padding:18px 22px;color:#64748b;font-size:12px;line-height:1.5'>Review skipped or excluded stories separately for accuracy limits before republishing them.</div>"
        + "</div></body></html>"
    )
    subject = f"383 Lajme - {len(articles)} artikuj te rinj [{subject_time}]"
    if resend_key:
        resend_code = _send_resend_report(resend_key, recipient, subject, report_html)
        if resend_code == 0:
            return 0
        if not user or not password:
            return resend_code
        print("EMAIL Resend failed; trying Gmail SMTP fallback.")

    return _send_gmail_report(user, password, recipient, subject, report_html)


def send_status_report(message: str) -> int:
    """Send a cron outcome when a run has no batch to publish."""
    load_env()
    user = os.environ.get("GMAIL_USER", "").strip()
    password = _gmail_app_password()
    recipient = os.environ.get("RECIPIENT_EMAIL", "").strip() or "lindsylqa@gmail.com"
    resend_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not resend_key and (not user or not password):
        print("EMAIL skipped: set RESEND_API_KEY or GMAIL_USER/GMAIL_APP_PASSWORD")
        return 2

    now = _kosovo_time_label()
    cron_slot = _cron_slot_label()
    subject_time = cron_slot or now
    report_html = (
        "<html><body style='margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif'>"
        "<div style='max-width:720px;margin:0 auto;background:#ffffff'>"
        "<div style='background:#0f172a;color:#ffffff;padding:22px'>"
        "<h2 style='font-size:22px;line-height:1.2;padding:0;margin:0'>383 Lajme: pa publikim të ri</h2>"
        f"<p style='font-size:13px;line-height:1.5;margin:8px 0 0;color:#cbd5e1'>Cron slot: {html.escape(cron_slot or 'Manual run')} | Kontrolluar: {html.escape(now)}</p>"
        "</div>"
        f"<div style='padding:22px;font-size:15px;line-height:1.55'>{html.escape(message)}</div>"
        "</div></body></html>"
    )
    subject = f"383 Lajme - pa artikuj të rinj [{subject_time}]"
    if resend_key:
        resend_code = _send_resend_report(resend_key, recipient, subject, report_html)
        if resend_code == 0:
            return 0
        if not user or not password:
            return resend_code
        print("EMAIL Resend failed; trying Gmail SMTP fallback.")
    return _send_gmail_report(user, password, recipient, subject, report_html)


def _send_gmail_report(user: str, password: str, recipient: str, subject: str, report_html: str) -> int:
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
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
    except (TimeoutError, socket.timeout, OSError) as exc:
        print(f"EMAIL failed: {type(exc).__name__}. SMTP may be blocked in this cloud environment or Gmail is unreachable.")
        return 1
    except Exception as exc:
        print(f"EMAIL failed: {type(exc).__name__}")
        return 1


def _email_from() -> str:
    return os.environ.get("EMAIL_FROM", "").strip() or "383 Lajme <onboarding@resend.dev>"


def _cron_slot_label() -> str:
    return os.environ.get("CRON_SLOT_LABEL", "").strip()


def _send_resend_report(api_key: str, recipient: str, subject: str, report_html: str) -> int:
    payload = json.dumps(
        {
            "from": _email_from(),
            "to": [recipient],
            "subject": subject,
            "html": report_html,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "383-codex-news-bot",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status = response.getcode()
            body = response.read().decode("utf-8", errors="replace")
            if 200 <= status < 300:
                try:
                    message_id = json.loads(body or "{}").get("id", "")
                except Exception:
                    message_id = ""
                suffix = f" ({message_id})" if message_id else ""
                print(f"EMAIL report sent via Resend to {recipient}{suffix}")
                return 0
            print(f"EMAIL Resend failed HTTP {status}")
            return 1
    except urllib.error.HTTPError as exc:
        detail = exc.read(300).decode("utf-8", errors="replace")
        print(f"EMAIL Resend failed HTTP {exc.code}: {detail}")
        return 1
    except Exception as exc:
        print(f"EMAIL Resend failed: {type(exc).__name__}")
        return 1


def _gmail_app_password() -> str:
    return re.sub(r"\s+", "", os.environ.get("GMAIL_APP_PASSWORD", ""))


def _clean_github_token(value: str) -> str:
    token = value.strip().strip('"').strip("'")
    token = re.sub(r"^export\s+", "", token).strip()
    for key in ("GITHUB_TOKEN", "GITHUB_PAT", "GH_TOKEN"):
        if token.startswith(f"{key}="):
            token = token.split("=", 1)[1].strip().strip('"').strip("'")
    token = re.sub(r"\s+", "", token)
    return token


def _github_token_pair() -> tuple[str, str]:
    candidates: list[tuple[str, str]] = []
    for key in ("GITHUB_TOKEN", "GITHUB_PAT", "GH_TOKEN"):
        raw_value = os.environ.get(key, "")
        token = _clean_github_token(raw_value)
        if token:
            candidates.append((key, token))

    for key, token in candidates:
        if token.startswith(("ghp_", "github_pat_", "gho_", "ghu_", "ghs_", "ghr_")):
            return key, token

    if candidates:
        return candidates[0]
    return "", ""


def _github_token() -> str:
    _, token = _github_token_pair()
    return token


def _token_shape(token: str) -> str:
    if not token:
        return "missing"
    if token.startswith("ghp_"):
        prefix = "classic ghp_"
    elif token.startswith("github_pat_"):
        prefix = "fine-grained github_pat_"
    elif token.startswith(("gho_", "ghu_", "ghs_", "ghr_")):
        prefix = "GitHub token"
    else:
        prefix = "unknown prefix"
    return f"{prefix}, length {len(token)}"


def _github_repo() -> str:
    repo = os.environ.get("GITHUB_REPOSITORY", "").strip() or DEFAULT_GITHUB_REPO
    return repo.removeprefix("https://github.com/").removesuffix(".git")


def github_auth_status() -> int:
    load_env()
    token_key, token = _github_token_pair()
    repo = _github_repo()
    if not token:
        print("GITHUB auth: missing GITHUB_TOKEN/GITHUB_PAT/GH_TOKEN")
        return 2
    print(f"GITHUB auth: using {token_key} ({_token_shape(token)})")

    request = urllib.request.Request(
        f"https://api.github.com/repos/{repo}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "383-codex-news-bot",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8", errors="replace"))
            permissions = payload.get("permissions") or {}
            print(f"GITHUB auth: token can read repo {repo}")
            print(f"GITHUB permission pull: {bool(permissions.get('pull'))}")
            print(f"GITHUB permission push: {bool(permissions.get('push'))}")
            print(f"GITHUB permission admin: {bool(permissions.get('admin'))}")
            if not permissions.get("push"):
                if os.environ.get("GITHUB_ACTIONS") == "true" and token_key == "GITHUB_TOKEN":
                    print(
                        "GITHUB auth: GitHub Actions built-in token does not expose repo permissions "
                        "through this endpoint; continuing because workflow permissions control push access."
                    )
                    return 0
                print("GITHUB auth failed: token does not have push permission for this repository.")
                return 1
            return 0
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            print("GITHUB auth failed: token is invalid, expired, revoked, or copied incorrectly.")
        elif exc.code == 403:
            print("GITHUB auth failed: token is valid but blocked from this repo/org. Check repo access, org SSO authorization, or token scopes.")
        elif exc.code == 404:
            print(f"GITHUB auth failed: repo {repo} is not visible to this token.")
        else:
            print(f"GITHUB auth failed: GitHub API returned HTTP {exc.code}.")
        return 1
    except Exception as exc:
        print(f"GITHUB auth check failed: {type(exc).__name__}")
        return 1


def _git_stdout(command: list[str]) -> str:
    result = subprocess.run(command, cwd=REPO_ROOT, text=True, capture_output=True)
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def _run_git(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, cwd=REPO_ROOT, text=True, capture_output=True)
    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        if _is_git_auth_failure(detail) and ("403" in detail or "Permission denied" in detail):
            print(
                "GIT failed: GitHub denied write access. "
                "Use a GitHub token with Contents: Read and write for "
                f"{_github_repo()}, or connect a GitHub app/account with repository write access."
            )
        elif "Repository not found" in detail:
            print(f"GIT failed: repository {_github_repo()} was not found or token cannot access it.")
        elif "Authentication failed" in detail or "could not read Username" in detail:
            print("GIT failed: authentication failed. Check GITHUB_TOKEN/GITHUB_PAT/GH_TOKEN.")
        else:
            print("GIT failed while running a repository command.")
            if detail:
                print(detail[-800:])
        result.check_returncode()
    return result


def _is_git_auth_failure(detail: str) -> bool:
    lowered = detail.lower()
    return any(
        phrase in lowered
        for phrase in (
            "authentication failed",
            "permission denied",
            "could not read username",
            "repository not found",
            "403",
        )
    )


def _ensure_git_origin() -> None:
    remote = f"https://github.com/{_github_repo()}.git"
    current = _git_stdout(["git", "remote", "get-url", "origin"])
    if current:
        if current != remote and "github.com" in current:
            _run_git(["git", "remote", "set-url", "origin", remote])
        return
    _run_git(["git", "remote", "add", "origin", remote])
    print("GIT origin configured")


def _git_auth_extraheader() -> list[str]:
    existing = _git_stdout(["git", "config", "--get-all", "http.https://github.com/.extraheader"])
    if existing:
        return []
    token = _github_token()
    if not token:
        return []
    encoded = base64.b64encode(f"x-access-token:{token}".encode("utf-8")).decode("ascii")
    return ["-c", f"http.https://github.com/.extraheader=AUTHORIZATION: basic {encoded}"]


def _git(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    auth_args = _git_auth_extraheader()
    if auth_args:
        result = _run_git(["git"] + auth_args + command, check=False)
        detail = (result.stderr or result.stdout or "").strip()
        if result.returncode == 0 or not _is_git_auth_failure(detail):
            if check and result.returncode != 0:
                _run_git(["git"] + auth_args + command, check=True)
            return result
        print("GIT token authentication failed; retrying with the runner's configured Git credentials.")
    return _run_git(["git"] + command, check=check)


def git_publish(path: Path) -> int:
    load_env()
    validate_batch(path)
    _ensure_git_origin()
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    _git(["config", "user.name", "383 Codex News Bot"])
    _git(["config", "user.email", "bot@383lajme.com"])
    _git(["fetch", "origin", "main"])
    _git(["pull", "--rebase", "--autostash", "origin", "main"])
    _git(["add", str(path.relative_to(REPO_ROOT)).replace("\\", "/")])
    diff = _git(["diff", "--staged", "--quiet"], check=False)
    if diff.returncode == 0:
        ahead_count = _git_stdout(["git", "rev-list", "--count", "origin/main..HEAD"])
        if ahead_count and int(ahead_count) > 0:
            _git(["push", "origin", "HEAD:main"])
            print(f"GIT pushed {ahead_count} existing local commit(s)")
            return 0
        print("GIT no staged article changes")
        return 0
    _git(["commit", "-m", f"chore: GPT-5.4 verified news run {timestamp}"])
    _git(["push", "origin", "HEAD:main"])
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
        print("WARN email report did not complete.")
        if os.environ.get("REQUIRE_EMAIL_REPORT", "").strip().lower() in {"1", "true", "yes"}:
            print("ERROR email report is required for this run.")
            return 1

    verify_code = verify_public_site(path)
    if verify_code != 0:
        print("ERROR public site verification did not confirm the new batch on the production domain.")
        return 1

    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["env-status", "github-auth", "normalize", "validate", "test-email", "deploy", "verify-site", "send-report", "send-status-report", "publish", "finalize"])
    parser.add_argument("--file", help="Article JSON file. Defaults to latest data/auto-articles/*.json")
    parser.add_argument("--message", help="Status text for send-status-report")
    args = parser.parse_args()

    path = Path(args.file).resolve() if args.file else latest_batch_path()
    if args.command in {"normalize", "validate", "send-report", "publish", "finalize"}:
        if path is None:
            print("No article batch found")
            return 2
        if not path.exists():
            print(f"Article batch not found: {path}")
            return 2

    if args.command == "env-status":
        return env_status()
    if args.command == "github-auth":
        return github_auth_status()
    if args.command == "normalize":
        assert path is not None
        normalize_batch(path)
        return 0
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
    if args.command == "send-status-report":
        return send_status_report(args.message or "Nuk u gjet asnjë artikull i verifikuar për publikim në këtë kontroll.")
    if args.command == "publish":
        assert path is not None
        return git_publish(path)
    if args.command == "finalize":
        assert path is not None
        return finalize(path)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
