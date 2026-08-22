import json
from pathlib import Path
path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
articles[5]['image_url'] = 'https://commons.wikimedia.org/wiki/Special:FilePath/Jezero_Gazivode.jpg?width=1280'
articles[5]['image_width'] = 1280
articles[5]['image_height'] = 853
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('replaced the remaining direct Wikimedia CDN URL')
