"""Keep drafts that passed the deterministic gates unchanged during repairs."""
import argparse
import json
import os
from pathlib import Path

from news_copyright_review import evidence_records
from originality_gate import originality_errors
from journalism_quality_gate import journalism_errors
from editorial_rules_v2 import article_errors
from topic_selection_gate import evidence_errors


def preserve(before: Path, after: Path, evidence: Path) -> int:
    original = json.loads(before.read_text(encoding="utf-8"))
    edited = json.loads(after.read_text(encoding="utf-8"))
    if not isinstance(original, list) or not isinstance(edited, list):
        raise ValueError("repair requires article arrays")
    records = evidence_records(evidence)
    allowed = {article["url"] for article in original}
    by_url = {article["url"]: article for article in edited}
    if len(by_url) != len(edited) or not set(by_url) <= allowed:
        raise ValueError("repair introduced or duplicated a source")
    retained, untouched = [], 0
    for article in original:
        errors = (originality_errors(article, records.get(article["slug"], {}))
                  + journalism_errors(article) + article_errors(article)
                  + evidence_errors([article], evidence))
        if not errors:
            retained.append(article)
            untouched += 1
        elif article["url"] in by_url:
            retained.append(by_url[article["url"]])
    temporary = after.with_suffix(".preserve.tmp")
    temporary.write_text(json.dumps(retained, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, after)
    print(f"383 REPAIR preserved={untouched} previously passing draft(s); retained={len(retained)}")
    return len(retained)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument("evidence", type=Path)
    args = parser.parse_args()
    preserve(args.before, args.after, args.evidence)
