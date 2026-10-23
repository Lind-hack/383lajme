"""Review replacement drafts without rewriting already approved articles."""
import argparse
import json
from pathlib import Path
from collections import Counter

from news_coverage import replacement_plan, CATEGORY_CEILING
from news_source_policy import CATEGORIES


def replacements(approved: list[dict], candidates: list[dict]) -> list[dict]:
    by_url = {article["url"]: article for article in candidates}
    if any(by_url.get(article["url"]) != article for article in approved):
        raise ValueError("Replacement writing changed an approved article")
    urls = {article["url"] for article in approved}
    return [article for article in candidates if article["url"] not in urls]


def merge(approved: list[dict], reviewed: list[dict]) -> list[dict]:
    urls = {article["url"] for article in approved}
    if any(article["url"] in urls for article in reviewed):
        raise ValueError("Replacement review repeated an approved source URL")
    return approved + reviewed


def rewrite_input(approved: list[dict], rejected: list[dict]) -> list[dict]:
    """Only remaining category slots; give a new composer facts/identity, not copied prose."""
    seen = {article["url"] for article in approved}
    candidates = []
    for article in rejected:
        if article.get("category") not in CATEGORIES:
            raise ValueError("rejected story has an unknown category")
        if article["url"] not in seen:
            candidates.append(article)
            seen.add(article["url"])
    plan = replacement_plan(approved, candidates, [article["url"] for article in approved])
    counts = Counter(article["category"] for article in approved)
    pools = {category: [article for article in candidates if article["category"] == category] for category in CATEGORIES}
    selected = []
    fields = ("id", "slug", "url", "source", "category", "city", "dispatch", "created_at", "published_at",
              "corroborating_sources", "rejection_reason")
    for level in range(1, CATEGORY_CEILING + 1):
        for category in CATEGORIES:
            while counts[category] < min(level, plan[category]) and pools[category]:
                article = pools[category].pop(0)
                selected.append({key: article[key] for key in fields if key in article})
                counts[category] += 1
    return selected


def groups(folder: Path, output: Path) -> int:
    """Drafts from the parallel desk-group writers, one array; a group that
    failed or answered with something else is skipped."""
    rows, seen = [], set()
    for path in sorted(folder.glob("*.json")):
        try:
            part = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for row in part if isinstance(part, list) else []:
            if isinstance(row, dict) and row.get("slug") and row.get("url") not in seen:
                seen.add(row["url"])
                rows.append(row)
    if not rows:
        raise SystemExit("383 WRITER GROUPS: no desk group returned drafts")
    output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"383 WRITER GROUPS: {len(rows)} drafts from parallel desk groups")
    return len(rows)


if __name__ == "__main__":
    import sys
    if sys.argv[1:2] == ["groups"]:
        groups(Path(sys.argv[2]), Path(sys.argv[3]))
        raise SystemExit(0)
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["split", "merge", "rewrite-input"])
    parser.add_argument("approved", type=Path)
    parser.add_argument("candidates", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    read = lambda path: json.loads(path.read_text(encoding="utf-8"))
    action = {"split": replacements, "merge": merge, "rewrite-input": rewrite_input}[args.action]
    rows = action(read(args.approved), read(args.candidates))
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
