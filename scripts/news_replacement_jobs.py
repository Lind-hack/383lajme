"""Disjoint one-story replacement jobs; never modify already approved articles."""
import argparse
import json
import re
from pathlib import Path

from news_writer_brief import build
from news_source_policy import source_error


def prepare(discovery: Path, approved: Path, attempted: Path, folder: Path, limit: int = 3) -> list[dict]:
    if not 1 <= limit <= 3:
        raise ValueError('replacement requests are limited to three concurrent stories')
    folder.mkdir(parents=True, exist_ok=True)
    selection = folder/'selection.json'
    build(discovery, folder/'selected-brief.md', approved=approved, attempted=attempted,
          limit=limit, selection_output=selection)
    selected = json.loads(selection.read_text(encoding='utf-8'))
    leads = selected['ready_leads']
    if len(leads) > limit:
        raise ValueError('replacement selection exceeds the requested limit')
    jobs = []
    for index, lead in enumerate(leads):
        key = f'job-{index}'
        scope = folder/(key+'.input.json')
        brief = folder/(key+'.md')
        scope.write_text(json.dumps({'publication_plan': {lead['category']: 1}, 'ready_leads': [lead]},
                                   ensure_ascii=False)+'\n', encoding='utf-8')
        build(scope, brief, lead['category'], cap=1, identity_output=brief.with_suffix('.sources.json'))
        jobs.append({'key': key, 'category': lead['category'], 'url': lead['url'],
                     'brief': str(brief), 'output': str(folder/(key+'.json'))})
    (folder/'jobs.json').write_text(json.dumps({'jobs': jobs}, ensure_ascii=False)+'\n', encoding='utf-8')
    print(f'383 REPLACEMENT JOBS prepared={len(jobs)}; one source per request; approved copy excluded')
    return jobs


def collect(folder: Path, output: Path) -> list[dict]:
    jobs = json.loads((folder/'jobs.json').read_text(encoding='utf-8'))['jobs']
    if not isinstance(jobs, list) or len(jobs) > 3:
        raise ValueError('replacement manifest exceeds the bounded batch')
    rows, seen = [], set()
    for job in jobs:
        if not isinstance(job, dict):
            print('383 REPLACEMENT JOB isolated=invalid manifest entry')
            continue
        try:
            if not re.fullmatch(r'job-[0-2]', str(job.get('key', ''))) or source_error(job.get('category'), job.get('url')):
                raise ValueError('invalid replacement identity')
            expected = folder/(job['key']+'.json')
            if Path(job['output']).resolve() != expected.resolve() or expected.resolve().parent != folder.resolve():
                raise ValueError('replacement output escaped its job folder')
            result = json.loads(expected.read_text(encoding='utf-8'))
            if not isinstance(result, list) or len(result) != 1:
                raise ValueError('one complete article required')
            row = result[0]
            if (not isinstance(row, dict) or not all(row.get(key) for key in ('url', 'category', 'slug', 'title', 'body'))
                    or row['url'] != job['url'] or row['category'] != job['category'] or row['url'] in seen):
                raise ValueError('replacement left its exact source/category scope')
            rows.append(row)
            seen.add(row['url'])
        except (OSError, ValueError, TypeError, KeyError) as exc:
            print(f"383 REPLACEMENT JOB isolated={str(job.get('key', 'invalid'))!r} reason={type(exc).__name__}")
    if not rows:
        raise ValueError('no replacement request returned a scoped article')
    output.write_text(json.dumps(rows, ensure_ascii=False)+'\n', encoding='utf-8')
    print(f'383 REPLACEMENT JOBS collected={len(rows)} of {len(jobs)}; all still require editorial review')
    return rows


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'collect'])
    parser.add_argument('--folder', required=True, type=Path)
    parser.add_argument('--discovery', type=Path)
    parser.add_argument('--approved', type=Path)
    parser.add_argument('--attempted', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.action == 'prepare':
        if not all((args.discovery, args.approved, args.attempted)):
            parser.error('prepare requires discovery, approved and attempted records')
        prepare(args.discovery, args.approved, args.attempted, args.folder)
    else:
        if not args.output:
            parser.error('collect requires output')
        collect(args.folder, args.output)
