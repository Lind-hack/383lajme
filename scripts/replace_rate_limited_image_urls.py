import json
from pathlib import Path

path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
updates = {
    3: ('https://commons.wikimedia.org/wiki/Special:FilePath/Gazivode_Lake.JPG?width=1280', 1280, 853),
    6: ('https://commons.wikimedia.org/wiki/Special:FilePath/Protests_in_Serbia_due_to_the_fall_of_the_concrete_canopy_(54296210311).jpg?width=1280', 1280, 853),
    10: ('https://commons.wikimedia.org/wiki/Special:FilePath/Stamford_Bridge_Stadium_Football_Pitch,_2.22.2013.jpg?width=1280', 1280, 960),
}
for index, (url, width, height) in updates.items():
    articles[index]['image_url'] = url
    articles[index]['image_width'] = width
    articles[index]['image_height'] = height
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('replaced rate-limited Wikimedia CDN URLs with verified Special:FilePath URLs')
