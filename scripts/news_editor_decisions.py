"""Apply explicit, source-bound editorial decisions without rewriting passing copy."""
from collections import Counter

CHECKS = ("facts", "attribution", "originality", "photo_fit", "language")
PROSE = {"title", "excerpt", "body"}
DEFECTS = {"factual", "attribution", "originality", "language", "title", "photo_angle"}
METADATA = {"score_breakdown", "score_reason", "score_formula", "required_attribution"}


def apply_decisions(articles: list[dict], decisions: list[dict]) -> list[dict]:
    if not decisions:
        raise ValueError("Editor returned no explicit article decisions")
    counts = Counter(row.get("url") for row in decisions if isinstance(row, dict)
                     and isinstance(row.get("url"), str))
    by_url = {row["url"]: row for row in decisions if isinstance(row, dict)
              and isinstance(row.get("url"), str) and counts[row["url"]] == 1}
    retained, reviewed, invalid = [], 0, 0
    for article in articles:
        decision = by_url.get(article["url"])
        try:
            if not decision:
                raise ValueError("missing or duplicate editorial identity")
            action = decision.get("action")
            if action == "drop":
                if not isinstance(decision.get("reason"), str) or len(decision["reason"].strip()) < 20:
                    raise ValueError("drop requires a concrete reason")
                reviewed += 1
                continue
            if not isinstance(action, str) or action not in {"keep", "correct"}:
                raise ValueError("unknown editorial action")
            checks = decision.get("checks")
            if not isinstance(checks, dict) or not all(checks.get(key) is True for key in CHECKS):
                raise ValueError("retained copy requires every editorial check")
            edits = decision.get("edits", [])
            metadata = decision.get("metadata", {})
            if not isinstance(edits, list) or not isinstance(metadata, dict) or set(metadata) - METADATA:
                raise ValueError("invalid editorial changes")
            if (action == "keep" and edits) or (action == "correct" and not edits):
                raise ValueError("editorial action does not match its changes")
            edited = dict(article)
            for edit in edits:
                if (not isinstance(edit, dict) or not isinstance(edit.get("field"), str) or edit["field"] not in PROSE
                        or not isinstance(edit.get("defect"), str) or edit["defect"] not in DEFECTS):
                    raise ValueError("only explicit prose corrections are permitted")
                before, after = edit.get("before"), edit.get("after")
                if (not isinstance(before, str) or not before or not isinstance(after, str)
                        or not isinstance(edit.get("reason"), str) or len(edit["reason"].strip()) < 20):
                    raise ValueError("correction needs an exact span and concrete reason")
                field = edit["field"]
                if not isinstance(edited.get(field), str) or edited[field].count(before) != 1:
                    raise ValueError("correction span is absent or ambiguous")
                edited[field] = edited[field].replace(before, after, 1)
            edited.update(metadata)
            retained.append(edited)
            reviewed += 1
        except ValueError:
            invalid += 1
    if not reviewed:
        raise ValueError("Editor returned no valid source-bound decisions")
    print(f"383 EDITOR DECISIONS retained={len(retained)} reviewed={reviewed} unreviewed={invalid}")
    return retained
