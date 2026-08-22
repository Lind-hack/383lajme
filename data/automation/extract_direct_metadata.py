import json
import re
import ssl
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

source = Path('data/automation/cloud-news-discovery.json').read_text(encoding='utf-8')
entries = []
current = {}
for line in source.splitlines():
    if line.startswith('## '):
        if current:
            entries.append(current)
        current = {'headline': line[3:].strip()}
    elif line.startswith('- ') and ': ' in line and current:
        key, value = line[2:].split(': ', 1)
        current[key.lower()] = value.strip()
if current:
    entries.append(current)
headers = {'User-Agent': 'Mozilla/5.0 (compatible; 383Lajme/1.0; +https://383ks.com)'}
results = []
for item in entries:
    url = item.get('url')
    if not url:
        continue
    row = {k: item.get(k, '') for k in ('headline','publisher','lane','published','summary','url')}
    try:
        req = Request(url, headers=headers)
        with urlopen(req, timeout=20, context=ssl.create_default_context()) as response:
            html = response.read(1_500_000).decode('utf-8', errors='replace')
        row['status'] = 'ok'
        for prop, field in [('og:title','og_title'),('og:description','og_description'),('og:image','image_url')]:
            match = re.search(r'<meta[^>]+(?:property|name)=["\']'+re.escape(prop)+r'["\'][^>]+content=["\']([^"\']+)', html, re.I)
            if not match:
                match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']'+re.escape(prop)+r'["\']', html, re.I)
            row[field] = unescape(match.group(1).strip()) if match else ''
        if row.get('image_url'):
            try:
                from PIL import Image
                from io import BytesIO
                image_request = Request(row['image_url'], headers=headers)
                with urlopen(image_request, timeout=20, context=ssl.create_default_context()) as image_response:
                    image_bytes = image_response.read(15_000_000)
                with Image.open(BytesIO(image_bytes)) as image:
                    image.verify()
                with Image.open(BytesIO(image_bytes)) as image:
                    row['image_dimensions'] = list(image.size)
            except Exception as image_exc:
                row['image_error'] = f'{type(image_exc).__name__}: {image_exc}'
    except Exception as exc:
        row['status'] = f'{type(exc).__name__}: {exc}'
    results.append(row)
Path('data/automation/direct-publisher-metadata.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'wrote {len(results)} direct publisher metadata rows')
