#!/usr/bin/env python3
"""Validate social/source diversity rules for 383 Lajme cloud batches."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse


SOCIAL_DOMAINS = {
    "instagram.com": "instagram",
    "tiktok.com": "tiktok",
    "twitter.com": "x/twitter",
    "x.com": "x/twitter",
    "threads.net": "threads",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "reddit.com": "reddit",
    "polymarket.com": "polymarket",
    "linkedin.com": "linkedin",
    "pinterest.com": "pinterest",
    "github.com": "github",
}
MIN_ARTICLES_PER_BATCH = 1
MAX_ARTICLES_PER_BATCH = 22
MAX_X_ARTICLES = 2
MAX_SOCIAL_SHARE = 0.40
MIN_SOURCE_FAMILIES = 6


def hostname(value: object) -> str:
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


def platform_from_domain(value: object) -> str:
    text = str(value or "").strip().lower()
    for domain, platform in SOCIAL_DOMAINS.items():
        if domain in text:
            return platform
    return ""


def social_platform(article: dict) -> str:
    explicit = str(article.get("social_platform") or article.get("source_platform") or "").strip().lower()
    if explicit:
        if explicit in {"x", "twitter", "x/twitter"}:
            return "x/twitter"
        return explicit
    return (
        platform_from_domain(article.get("social_post_url"))
        or platform_from_domain(article.get("source_post_url"))
        or platform_from_domain(article.get("url"))
        or platform_from_domain(article.get("source"))
    )


def source_family(article: dict) -> str:
    platform = social_platform(article)
    if platform:
        return platform
    for field in ("url", "source", "social_post_url", "source_post_url"):
        host = hostname(article.get(field))
        if not host:
            continue
        if host in {"x.com", "twitter.com"}:
            return "x/twitter"
        parts = host.split(".")
        return ".".join(parts[-2:]) if len(parts) >= 2 else host
    return str(article.get("source") or "unknown").strip().lower() or "unknown"


def validate(path: Path) -> int:
    articles = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(articles, list):
        print(f"SOURCE MIX failed: {path} is not a JSON array")
        return 2

    families = [source_family(article) for article in articles if isinstance(article, dict)]
    unique_families = {family for family in families if family and family != "unknown"}
    x_count = sum(1 for family in families if family == "x/twitter")
    social_count = sum(1 for article in articles if isinstance(article, dict) and social_platform(article))
    errors: list[str] = []

    if len(articles) < MIN_ARTICLES_PER_BATCH:
        errors.append(
            f"batch has only {len(articles)} articles; publish at least "
            f"{MIN_ARTICLES_PER_BATCH} fresh Kosovo-audience stories per cron run"
        )
    if len(articles) > MAX_ARTICLES_PER_BATCH:
        errors.append(
            f"batch has {len(articles)} articles; cap each run at "
            f"{MAX_ARTICLES_PER_BATCH} high-quality stories"
        )

    if len(articles) >= 4:
        if x_count > MAX_X_ARTICLES:
            errors.append(
                f"too many X/Twitter-based articles ({x_count}); cap X/Twitter at {MAX_X_ARTICLES} articles per batch"
            )
        max_social = max(1, int(len(articles) * MAX_SOCIAL_SHARE))
        if social_count > max_social:
            errors.append(
                f"too many social-driven articles ({social_count}); cap social platforms at {max_social} of {len(articles)} articles"
            )
        if len(unique_families) < min(MIN_SOURCE_FAMILIES, len(articles)):
            errors.append(
                "not enough source variety: "
                f"{len(unique_families)} families found ({', '.join(sorted(unique_families)) or 'none'})"
            )

    for index, article in enumerate(articles, 1):
        if not isinstance(article, dict):
            continue
        category = str(article.get("category") or "")
        if category != "Teknologji":
            continue
        account = str(article.get("social_post_account") or article.get("source_account") or "").lower()
        source = str(article.get("source") or "").lower()
        url_host = hostname(article.get("url"))
        social_host = hostname(article.get("social_post_url") or article.get("source_post_url"))
        mentions_rundown = "rundown" in source or "rundown" in account or "therundown" in url_host or "therundown" in social_host
        if mentions_rundown and url_host != "therundown.ai":
            errors.append(
                f"article {index} uses The Rundown for Teknologji but main url is {url_host or 'missing'}; "
                "use therundown.ai website pages, not X/Twitter"
            )

    if errors:
        print("SOURCE MIX failed:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print(
        "SOURCE MIX ok: "
        f"{len(unique_families)} families ({', '.join(sorted(unique_families)) or 'none'}), "
        f"X/Twitter articles={x_count}, social-driven articles={social_count}"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    args = parser.parse_args()
    return validate(Path(args.file))


if __name__ == "__main__":
    raise SystemExit(main())
