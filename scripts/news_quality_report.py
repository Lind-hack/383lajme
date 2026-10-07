"""Record category/source metrics without conflating no news with an outage."""
import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from news_source_policy import CATEGORIES, MANIFEST, publisher_for


def report(batch: Path, status: str) -> dict:
    articles = json.loads(batch.read_text()) if batch.exists() else []
    discovery = Path(__file__).resolve().parents[1] / ".last30days/cloud-news-discovery-current.json"
    data = json.loads(discovery.read_text()) if discovery.exists() else {}
    counts = Counter(item["category"] for item in articles)
    metrics = {"status": status, "at": datetime.now(timezone.utc).isoformat(),
               "registry_version": MANIFEST["version"], "batch": str(batch),
               "article_count": len(articles), "categories": {c: counts[c] for c in CATEGORIES},
               "source_ready_categories": data.get("source_ready_categories", {}),
               "source_health": data.get("sources", []),
               "families": dict(Counter((publisher_for(a.get("url")) or {}).get("family", "unknown") for a in articles))}
    target = discovery.parent / "hourly-quality-latest.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("383 QUALITY " + json.dumps({k: metrics[k] for k in ("status", "article_count", "categories")}, ensure_ascii=False))
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--status", required=True)
    args = parser.parse_args()
    report(args.file, args.status)
