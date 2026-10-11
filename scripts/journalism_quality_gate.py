"""Reject weak copy and any publisher named in public copy before publication."""
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
    # Every article reads as 383's own: no publisher is named anywhere, and a
    # story that cannot be told without one is dropped, not passed off as ours.
    for field, raw in (("title", article.get("title")), ("excerpt", article.get("excerpt")), ("body", body)):
        value = fold(html.unescape(re.sub(r"<[^>]*>", " ", str(raw or ""))))
        for publisher in publisher_names - {""}:
            name_pattern = re.escape(publisher) + r"(?:it|in|i|t|s|ut|u|n|se|es)?"
            if publisher.endswith(("a", "e", "i")):
                name_pattern = r"(?:" + name_pattern + "|" + re.escape(publisher[:-1]) + r"(?:a|e|i|es|en|it|in|ut|un|s|se|t))"
            framed = (re.search(r"\b(?:sipas|raporton|raportoi|shkruan|shkroi|publikon|njofton|transmeton|nga portali|nga media|nga mediat|nga gazeta|burimi)\b[^.!?]{0,65}\b" + name_pattern + r"\b", value)
                      or re.search(r"\b" + name_pattern + r"\b[^.!?]{0,40}\b(?:raporton|raportoi|raportuan|raportojne|shkruan|shkroi|shkruajne|vlereson|vleresoi|vleresojne|thote|thone|informon|informoi|zbulon|zbuloi|ben te ditur|bejne te ditur|beri te ditur|bene te ditur|njofton|njoftoi|publikon|publikoi|transmeton|citon|pohon|pohoi)\b", value))
            if framed:
                errors.append(f"{field} names a publisher ({publisher}); write from verified facts in 383's own voice, or drop a story that rests on that outlet's exclusive")
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
