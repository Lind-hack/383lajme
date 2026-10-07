#!/usr/bin/env python3
"""Build a bounded, live-checked social-native candidate memo for the 383 writer."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sys
from urllib.parse import unquote, urlparse

import codex_automation_support as support

MAX_PROBES = 24
MAX_CANDIDATES = 12
SOCIAL_HOSTS = {
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "youtube.com",
}


def _field(line: str, prefix: str) -> str:
    if line.startswith(prefix):
        return line.split(":", 1)[1].strip()
    return ""


def _platform(url: str) -> str:
    host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    for domain in SOCIAL_HOSTS:
        if host == domain or host.endswith("." + domain):
            return support._domain_platform(url)
    return ""


def _account(url: str, platform: str) -> str:
    parsed = urlparse(url)
    parts = [unquote(part).strip() for part in parsed.path.split("/") if part.strip()]
    if not parts:
        return ""
    if platform == "Instagram" and parts[0].lower() in {"p", "reel", "tv"}:
        return ""
    if platform == "TikTok" and parts[0].startswith("@"):
        return parts[0]
    if platform == "YouTube" and parts[0].startswith("@"):
        return parts[0]
    if platform in {"Facebook", "Instagram", "X/Twitter"}:
        return parts[0].lstrip("@")
    return ""


def _records(text: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    in_social_section = False
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("# ") or line.startswith("## "):
            heading = line.lstrip("# ").lower()
            in_social_section = (
                "social" in heading
                or "agent research /" in heading
                or "agent-research" in heading
            )
            continue
        if not in_social_section:
            continue
        if line.startswith("- Title:"):
            if current:
                records.append(current)
            current = {"title": _field(line, "- Title")}
            continue
        if current is None:
            continue
        for key, prefix in (
            ("publisher", "- Publisher/indexed source"),
            ("published", "- Published"),
            ("url", "- URL"),
            ("summary", "- Summary"),
        ):
            value = _field(line, prefix)
            if value:
                current[key] = value
                break
    if current:
        records.append(current)
    return records


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: prepare_social_native_candidates.py DISCOVERY OUTPUT", file=sys.stderr)
        return 2
    discovery = Path(sys.argv[1])
    output = Path(sys.argv[2])
    text = discovery.read_text(encoding="utf-8")
    candidates: list[dict[str, str]] = []
    probes = 0
    seen: set[str] = set()
    for record in _records(text):
        url = record.get("url", "")
        if not url or url in seen or probes >= MAX_PROBES:
            continue
        seen.add(url)
        platform = _platform(url)
        if not platform:
            continue
        path = urlparse(url).path.lower()
        if platform == "Facebook" and "/posts/" not in path and "/permalink/" not in path:
            continue
        if platform == "Instagram" and "/p/" not in path and "/reel/" not in path:
            continue
        if platform == "TikTok" and "/video/" not in path:
            continue
        if platform == "X/Twitter" and "/status/" not in path:
            continue
        account = _account(url, platform)
        if not account:
            continue
        probes += 1
        evidence = {
            "url": url,
            "social_post_url": url,
            "social_platform": platform,
            "social_post_account": account,
            "social_post_basis": record.get("summary") or record.get("title") or "Public post fetched from the exact URL.",
        }
        try:
            support._verify_social_post(evidence, timeout=8)
        except Exception:
            continue
        candidates.append({
            "platform": platform,
            "account": account,
            "url": url,
            "published": record.get("published", "unknown"),
            "title": record.get("title", "").replace("\n", " ").strip(),
            "summary": record.get("summary", "").replace("\n", " ").strip(),
        })
        if len(candidates) >= MAX_CANDIDATES:
            break

    output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Verified social-native candidates",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        f"Live-checked candidates: {len(candidates)} (probes attempted: {probes})",
        "",
        "These are writer inputs, not publication approvals. The writer must open the exact post, confirm that it supports the proposed story, write full Albanian reporting, and set the provenance fields. The normalizer will fetch the exact post again.",
        "",
    ]
    if not candidates:
        lines.append("No exact reachable social post passed the pre-writer probe.")
    else:
        for idx, candidate in enumerate(candidates, 1):
            lines.extend([
                f"## Candidate {idx}",
                f"- Platform: {candidate['platform']}",
                f"- Account: {candidate['account']}",
                f"- Published/discovered: {candidate['published']}",
                f"- Exact post URL: {candidate['url']}",
                f"- Discovery title: {candidate['title']}",
                f"- Discovery summary: {candidate['summary']}",
                "",
            ])
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"SOCIAL CANDIDATES wrote {len(candidates)} live-checked candidates to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
