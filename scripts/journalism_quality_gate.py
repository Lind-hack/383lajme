"""Reject weak copy and unnecessary publisher framing before publication."""
from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

from editorial_rules_v2 import fold
from news_source_policy import MANIFEST


def journalism_errors(article: dict) -> list[str]:
    body = html.unescape(str(article.get("body") or ""))
    text = fold(re.sub(r"<[^>]*>", " ", body))
    errors = []
    if len(re.findall(r"\w+", text)) < 140 or len(re.findall(r"<p\b[^>]*>.*?</p>", body, re.I | re.S)) < 3:
        errors.append("write at least 140 grounded words in three readable paragraphs")
    publisher_names = {fold(publisher["source"]) for publisher in MANIFEST["publishers"]}
    publisher_names.add(fold(str(article.get("source") or "")))
    attribution = article.get("required_attribution")
    justified = (isinstance(attribution, dict) and attribution.get("kind") in
                 {"direct_quote", "exclusive_reporting", "unconfirmed_claim"}
                 and len(str(attribution.get("reason") or "").strip()) >= 20)
    for field in ("title", "excerpt", "body"):
        value = fold(html.unescape(re.sub(r"<[^>]*>", " ", str(article.get(field) or ""))))
        for publisher in publisher_names - {""}:
            name_pattern = re.escape(publisher) + r"(?:it|in|i|t|s|ut|u|n|se|es)?"
            if publisher.endswith(("a", "e", "i")):
                name_pattern = r"(?:" + name_pattern + "|" + re.escape(publisher[:-1]) + r"(?:a|e|i|es|en|it|in|ut|un|s|se|t))"
            framed = (re.search(r"\b(?:sipas|raporton|raportoi|shkruan|shkroi|publikon|njofton|nga portali|nga media|nga mediat|nga gazeta|burimi)\b[^.!?]{0,65}\b" + name_pattern + r"\b", value)
                      or re.search(r"\b" + name_pattern + r"\b[^.!?]{0,40}\b(?:raporton|raportoi|raportuan|raportojne|shkruan|shkroi|shkruajne)\b", value))
            if framed and (field != "body" or not justified):
                errors.append(f"{field} uses unnecessary publisher framing ({publisher}); write from verified facts, or explain necessary body attribution for a quote/exclusive/unconfirmed claim")
                break
    return errors


def validate(path: Path) -> int:
    articles = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(articles, list) or any(not isinstance(article, dict) for article in articles):
        print("JOURNALISM failed: expected an article array")
        return 1
    kept = []
    for index, article in enumerate(articles, 1):
        errors = journalism_errors(article)
        if errors:
            print(f"REJECTED journalism candidate {index}: {'; '.join(errors)}")
        else:
            kept.append(article)
    path.write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"JOURNALISM GATE kept={len(kept)} rejected={len(articles) - len(kept)}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, type=Path)
    raise SystemExit(validate(parser.parse_args().file))
