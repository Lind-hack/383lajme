"""Evidence anchors for reviewer rejections; never convert missing proof into approval."""
import html
import re

CLARIFICATION = (
    "First verify every fact, date, number, relationship, attribution and uncertainty. A factual defect still fails claims_supported. "
    "Then separate public facts from expression before judging copying. Mentally subtract correct names, dates, numbers, roles, "
    "event outcomes, publicly announced schedules/specifications and ordinary relationships. Multiple factual sentences or "
    "chronological factual background do not by themselves establish copied expression. Identify what distinctive wording, "
    "imagery, close sentence construction, or outlet-specific narrative/analysis remains beyond those necessary facts. "
    "For every reject decision add rejection_basis. Its kind is copy_expression (two or more close sentence translations), "
    "copy_structure (an outlet-specific narrative or analysis), copy_headline (distinctive headline framing), "
    "borrowed_expression (distinctive imagery, phrasing, anecdote or exclusive material), factual, or attribution. "
    "Copying grounds require facts_only=false, a specific why_expression of at least 40 characters explaining what remains "
    "after removing the public facts, and matches containing exact source_span and article_span strings. copy_expression and "
    "copy_structure require at least two distinct matched passages; copy_headline must identify the whole article headline; "
    "borrowed_expression may identify one distinctive passage. Do not invent source quotations or mark matching public facts "
    "as distinctive expression. Factual/attribution grounds require the exact article_span, explanation (at least 40 characters), "
    "and an actual source_span for a contradiction, or support=absent when no supplied source supports the claim. "
    "Keep all original approval criteria and boolean checks. Missing or unverifiable grounds trigger another review or block "
    "publication; they never mean automatic approval."
)


def _normal(value):
    if not isinstance(value, str):
        return ""
    text = html.unescape(re.sub(r"<[^>]+>", " ", value)).translate(str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-"}))
    return " ".join(text.split()).casefold()


def grounded_rejection(decision: dict, article: dict, record: dict) -> bool:
    basis, checks = decision.get("rejection_basis"), decision.get("checks")
    if decision.get("verdict") != "reject" or not isinstance(basis, dict) or not isinstance(checks, dict):
        return False
    own = _normal(" ".join(str(article.get(key) or "") for key in ("title", "excerpt", "body")))
    evidence = [record.get("evidence", {})] + [r.get("evidence", {}) for r in record.get("corroborating", []) if isinstance(r, dict)]
    sources = [_normal(" ".join(str(item.get(key) or "") for key in ("title", "text"))) for item in evidence if isinstance(item, dict)]

    def located(span, texts):
        value = _normal(span)
        return len(value) >= 8 and any(value in text for text in texts)

    kind = basis.get("kind")
    if not isinstance(kind, str):
        return False
    if kind in {"factual", "attribution"}:
        failed = checks.get("claims_supported") is False if kind == "factual" else any(
            checks.get(key) is False for key in ("attribution_supported", "no_false_firsthand_reporting"))
        explanation = basis.get("explanation")
        return bool(failed and isinstance(explanation, str) and len(explanation.strip()) >= 40
                    and located(basis.get("article_span"), [own])
                    and (located(basis.get("source_span"), sources) or basis.get("support") == "absent"))
    if kind not in {"copy_expression", "copy_structure", "copy_headline", "borrowed_expression"}:
        return False
    why = basis.get("why_expression")
    failed = any(checks.get(key) is False for key in (
        "independent_composition", "not_close_translation", "no_borrowed_exclusive_expression"))
    if (not failed or basis.get("facts_only") is not False or not isinstance(why, str) or len(why.strip()) < 40
            or not isinstance(basis.get("matches"), list)):
        return False
    valid = []
    for match in basis["matches"]:
        if not isinstance(match, dict) or not located(match.get("source_span"), sources) or not located(match.get("article_span"), [own]):
            continue
        valid.append((_normal(match["source_span"]), _normal(match["article_span"])))
    needed = 2 if kind in {"copy_expression", "copy_structure"} else 1
    # A separately failed exclusive-expression check needs one actual
    # distinctive passage under the existing policy, even if another quote
    # in the same response has a typo. Never infer an approval from bad proof.
    if checks.get("no_borrowed_exclusive_expression") is False:
        needed = 1
    if len({a for a, _ in valid}) < needed or len({b for _, b in valid}) < needed:
        return False
    if kind == "copy_headline" and not any(b == _normal(article.get("title")) for _, b in valid):
        return False
    if kind == "borrowed_expression" and checks.get("no_borrowed_exclusive_expression") is not False:
        return False
    return True
