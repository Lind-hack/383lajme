"""Review replacement drafts without rewriting already approved articles."""
import argparse
import json
from pathlib import Path


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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["split", "merge"])
    parser.add_argument("approved", type=Path)
    parser.add_argument("candidates", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    read = lambda path: json.loads(path.read_text(encoding="utf-8"))
    rows = (replacements if args.action == "split" else merge)(read(args.approved), read(args.candidates))
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
