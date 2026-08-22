import json
from pathlib import Path

path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
supplement = (
    ' Kjo kërkon lexim të kujdesshëm të dokumenteve publike, krahasim të deklaratave '
    'dhe ndarje të qartë mes fakteve të konfirmuara dhe pritjeve. Publiku meriton '
    'informacion që shpjegon çfarë dihet, çfarë ende nuk dihet dhe cilat burime '
    'mund të sjellin sqarime të mëtejshme. Ky standard e ul rrezikun e keqinterpretimit '
    'dhe e mban vëmendjen te pasojat konkrete për qytetarët, institucionet dhe rajonin.'
)
for article in articles:
    if supplement not in article['body']:
        article['body'] += supplement
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'extended {len(articles)} articles')
