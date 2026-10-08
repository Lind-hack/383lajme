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


def replacement_plan(articles: list[dict], ready: list[dict], attempted: list[str]) -> dict[str, int]:
    from prepare_editor_sources import coverage_plan
    from news_source_policy import hourly_targets
    unavailable = set(attempted)
    plan = coverage_plan(articles + [lead for lead in ready if lead.get("url") not in unavailable])
    approved = Counter(article.get("category") for article in articles)
    plan = {category: max(count, approved[category]) for category, count in plan.items()}
    targets = hourly_targets()
    while sum(plan.values()) > 20:
        reducible = [category for category in plan if plan[category] > approved[category]]
        if not reducible:
            raise ValueError("Approved articles exceed the publication cap")
        category = max(reducible, key=lambda key: plan[key] / targets[key])
        plan[category] -= 1
    return plan


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("batch", type=Path)
    parser.add_argument("discovery", type=Path)
    parser.add_argument("--balance", action="store_true")
    parser.add_argument("--attempted", type=Path)
    args = parser.parse_args()
    articles = json.loads(args.batch.read_text(encoding="utf-8"))
    if isinstance(articles, dict):
        articles = articles["articles"]
    data = json.loads(args.discovery.read_text(encoding="utf-8"))
    plan = data["publication_plan"]
    if args.attempted:
        plan = replacement_plan(articles, data["ready_leads"], json.loads(args.attempted.read_text(encoding="utf-8")))
        data["publication_plan"] = plan
        args.discovery.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.balance:
        articles = balance(articles, plan)
        args.batch.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(deficits(articles, plan), ensure_ascii=False))
