import json
from pathlib import Path
path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
for article in articles:
    url = article.get('image_url', '')
    if 'Protests_in_Serbia' in url:
        article['image_width'], article['image_height'] = 1280, 853
    elif 'Nigeria_U-20' in url:
        article['image_width'], article['image_height'] = 1280, 855
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('aligned Wikimedia dimensions')
