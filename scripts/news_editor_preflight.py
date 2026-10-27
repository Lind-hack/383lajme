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


def prepare_repair(batch: Path, evidence: Path, output: Path) -> list[dict]:
    """Give each repair worker only defective copy and its matching sources."""
    feedback = diagnostics(batch, evidence)
    urls = {item['url'] for item in feedback}
    articles = [a for a in json.loads(batch.read_text(encoding='utf-8')) if a['url'] in urls]
    slugs = {a['slug'] for a in articles}
    records = [r for r in json.loads(evidence.read_text(encoding='utf-8')) if r.get('slug') in slugs]
    if {r.get('slug') for r in records} != slugs:
        raise ValueError('repair evidence does not match every selected draft')
    from news_model_evidence import write_readable_evidence
    output.write_text(json.dumps(articles, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    output.with_suffix('.editor-sources.json').write_text(json.dumps(records, ensure_ascii=False)+'\n', encoding='utf-8')
    write_readable_evidence(output.with_suffix('.editor-sources.md'), records)
    return feedback


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', required=True, type=Path)
    parser.add_argument('--evidence', required=True, type=Path)
    parser.add_argument('--repair-output', type=Path)
    args = parser.parse_args()
    result = (prepare_repair(args.file, args.evidence, args.repair_output) if args.repair_output
              else diagnostics(args.file, args.evidence))
    print(json.dumps(result, ensure_ascii=False))
