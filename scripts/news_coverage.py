"""Keep hourly drafting balanced against the prepared category plan."""
import argparse
import json
from collections import Counter
from pathlib import Path


def balance(articles: list[dict], plan: dict[str, int]) -> list[dict]:
    counts = Counter()
    kept = []
    for article in articles:
        category = article.get("category")
        if counts[category] < plan.get(category, 0):
            kept.append(article)
            counts[category] += 1
    return kept


def deficits(articles: list[dict], plan: dict[str, int]) -> dict[str, int]:
    counts = Counter(article.get("category") for article in articles)
    return {category: max(0, target - counts[category]) for category, target in plan.items()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("batch", type=Path)
    parser.add_argument("discovery", type=Path)
    parser.add_argument("--balance", action="store_true")
    args = parser.parse_args()
    articles = json.loads(args.batch.read_text(encoding="utf-8"))
    if isinstance(articles, dict):
        articles = articles["articles"]
    data = json.loads(args.discovery.read_text(encoding="utf-8"))
    plan = data["publication_plan"]
    if args.balance:
        articles = balance(articles, plan)
        args.batch.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(deficits(articles, plan), ensure_ascii=False))
