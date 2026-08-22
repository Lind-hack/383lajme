import json
from pathlib import Path
path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
for article in articles:
    if 'Nigeria_U-20_Women' in article.get('image_url', ''):
        article['image_url'] = "https://commons.wikimedia.org/wiki/Special:FilePath/Nigeria_U-20_Women's_National_team.JPG?width=1280"
        article['image_width'] = 1280
        article['image_height'] = 855
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('replaced remaining Wikimedia CDN URL')
