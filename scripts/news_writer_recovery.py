"""Recover missing allocations using alternatives not already refused in a brief."""
import argparse
import json
from collections import Counter
from pathlib import Path

from news_source_policy import CATEGORIES


def prepare(discovery: Path, batch: Path, folder: Path, attempted: Path) -> list[tuple[str,int]]:
    data=json.loads(discovery.read_text(encoding='utf-8'))
    articles=json.loads(batch.read_text(encoding='utf-8'))
    used=set(json.loads(attempted.read_text(encoding='utf-8'))) if attempted.exists() else set()
    used.update(row['url'] for row in articles)
    for manifest in folder.glob('*-brief.sources.json'):
        name=manifest.name.removesuffix('-brief.sources.json')
        output=folder/(name+'.json')
        # A successful composer may leave suitable spare stories unused. Only
        # an empty/failed call excludes its entire considered candidate scope.
        rows=json.loads(output.read_text(encoding='utf-8')) if output.exists() else []
        if not rows:
            used.update(row['url'] for row in json.loads(manifest.read_text(encoding='utf-8')))
    payload=json.dumps(sorted(used),ensure_ascii=False)
    attempted.write_text(payload,encoding='utf-8')
    (folder/'recovery-attempted.txt').write_text(payload,encoding='utf-8')
    counts=Counter(row['category'] for row in articles)
    desks=sorted(CATEGORIES,key=lambda c:counts[c])
    from news_coverage import category_ceiling
    return [(c,min(category_ceiling(c),data['publication_plan'].get(c,0))-counts[c]) for c in desks
            if counts[c]<min(category_ceiling(c),data['publication_plan'].get(c,0))][:3]


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('discovery','batch','folder','attempted'):parser.add_argument(name,type=Path)
    args=parser.parse_args()
    for category,count in prepare(args.discovery,args.batch,args.folder,args.attempted):
        print(category+'\t'+str(count))
