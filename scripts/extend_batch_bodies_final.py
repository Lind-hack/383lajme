import json
from pathlib import Path

path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
addition = (
    ' Në praktikë, kontrolli i vazhdueshëm i burimeve të drejtpërdrejta dhe i '
    'dokumenteve të publikuara mbetet mënyra më e mirë për të përditësuar këtë histori '
    'me përgjegjësi. Kështu ruhet qartësia për lexuesin edhe kur zhvillimet ecin shpejt.'
)
for article in articles:
    article['body'] += addition
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'extended {len(articles)} articles')
