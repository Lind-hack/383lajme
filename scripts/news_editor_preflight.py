"""Give the first editor all known copy defects without pruning any drafts."""
import argparse
import json
from pathlib import Path

from editorial_rules_v2 import article_errors
from journalism_quality_gate import journalism_errors
from originality_gate import originality_errors, _records


def diagnostics(batch: Path, evidence: Path) -> list[dict]:
    articles = json.loads(batch.read_text(encoding='utf-8'))
    if not isinstance(articles, list) or any(not isinstance(a, dict) for a in articles):
        raise ValueError('preflight requires an article array')
    records = _records(evidence)
    result = []
    for article in articles:
        record = records.get(str(article.get('slug')))
        if not record:
            raise ValueError('preflight requires fetched evidence for every draft')
        errors = (originality_errors(article, record) + journalism_errors(article)
                  + article_errors(article))
        if errors:
            # Explicit identities let parallel editors ignore other chunks.
            result.append({'url': article.get('url'), 'title': article.get('title'),
                           'defects': errors})
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', required=True, type=Path)
    parser.add_argument('--evidence', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(diagnostics(args.file, args.evidence), ensure_ascii=False))
