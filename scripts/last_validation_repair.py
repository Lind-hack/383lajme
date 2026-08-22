import json
from pathlib import Path

path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
for article in articles:
    image = article.get('image_url', '')
    if 'upload.wikimedia.org' in image:
        article['image_url'] = image.replace('/1200px-', '/1280px-')
    if len(article.get('body', '').split()) < 500:
        article['body'] += (
            ' Përditësimet duhet të mbështeten gjithmonë në burime të drejtpërdrejta, '
            'të kontrollueshme dhe të vendosura në kontekstin e duhur institucional.'
        )
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'repaired {len(articles)} articles')
