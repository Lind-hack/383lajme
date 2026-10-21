"""Keep hourly drafting balanced against the prepared category plan."""
import argparse
import json
from collections import Counter
from pathlib import Path

from news_source_policy import CATEGORIES, hourly_targets

COVERAGE_FLOOR = 2
CATEGORY_CEILING = 3


def plan_counts(counts: dict[str, int], total: int = 20) -> dict[str, int]:
    """Give every available desk two places before assigning third places."""
    targets = hourly_targets()
    plan = {category: 0 for category in CATEGORIES}
    for level in (1, COVERAGE_FLOOR, CATEGORY_CEILING):
        for category in CATEGORIES:
            if sum(plan.values()) >= total:
                return plan
            if plan[category] < min(level, targets[category], counts.get(category, 0)):
                plan[category] += 1
    # A spare third story is permitted, but a missing desk never creates a
    # fourth World story. With all desks available the declared targets win.
    for category in CATEGORIES:
        if sum(plan.values()) >= total:
            break
        if plan[category] < min(CATEGORY_CEILING, counts.get(category, 0)):
            plan[category] += 1
    return plan


def balance(articles: list[dict], plan: dict[str, int]) -> list[dict]:
    counts = Counter()
    kept = []
    for article in articles:
        category = article.get("category")
        if counts[category] < min(CATEGORY_CEILING, plan.get(category, 0)):
            kept.append(article)
            counts[category] += 1
    return kept


def deficits(articles: list[dict], plan: dict[str, int]) -> dict[str, int]:
    counts = Counter(article.get("category") for article in articles)
    return {category: max(0, target - counts[category]) for category, target in plan.items()}


def replacement_plan(articles: list[dict], ready: list[dict], attempted: list[str]) -> dict[str, int]:
    unavailable = set(attempted)
    combined = articles + [lead for lead in ready if lead.get("url") not in unavailable]
    plan = plan_counts(Counter(article.get("category") for article in combined))
    approved = Counter(article.get("category") for article in articles)
    plan = {category: max(count, approved[category]) for category, count in plan.items()}
    if any(approved[category] > CATEGORY_CEILING for category in CATEGORIES):
        raise ValueError("Approved articles exceed the three-per-category ceiling")
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
    parser.add_argument("--approved", type=Path, help="Pre-refill approved batch used to retain its feasible allocation")
    args = parser.parse_args()
    articles = json.loads(args.batch.read_text(encoding="utf-8"))
    if isinstance(articles, dict):
        articles = articles["articles"]
    data = json.loads(args.discovery.read_text(encoding="utf-8"))
    plan = data["publication_plan"]
    if args.attempted:
        approved = json.loads(args.approved.read_text(encoding="utf-8")) if args.approved else articles
        plan = replacement_plan(approved, data["ready_leads"], json.loads(args.attempted.read_text(encoding="utf-8")))
        # Feasibility changes as candidates are exhausted. Never overwrite the
        # original intended coverage with that smaller, achievable plan.
    if args.balance:
        articles = balance(articles, plan)
        args.batch.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(deficits(articles, plan), ensure_ascii=False))
