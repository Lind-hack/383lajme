import json
import re
import ssl
from html import unescape
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image

leads = json.loads(Path('data/automation/direct-rss-supplement.json').read_text(encoding='utf-8'))
base = json.loads(Path('data/automation/direct-publisher-metadata.json').read_text(encoding='utf-8'))
selected_urls = {
'https://www.bbc.co.uk/news/articles/cj03r59z73po?at_medium=RSS&at_campaign=rss',
'https://www.bbc.co.uk/news/articles/cpw9xzx9r4ko?at_medium=RSS&at_campaign=rss',
'https://www.bbc.co.uk/news/articles/c235n47g8g8o?at_medium=RSS&at_campaign=rss',
'https://europeanwesternbalkans.com/2026/07/23/most-eu-supporters-oppose-the-sns-government-what-should-brussels-take-away-from-this/',
'https://www.danas.rs/vesti/politika/kosovski-analiticar-pitanje-srba-i-severa-narusilo-odnose-pristine-i-sad/',
'https://www.ansa.it/nuova_europa/en/news/sections/culture/2026/07/23/a-focus-on-italy-at-the-short-film-forum-in-kosovo_22dc4bf6-f7d3-4bf0-9d91-90572ccbf9f5.html',
'https://www.france24.com/en/europe/20260723-eu-ambassadors-agree-21st-sanctions-package-against-russia',
'https://www.bbc.co.uk/news/articles/cvg9n2y61w6o?at_medium=RSS&at_campaign=rss',
'https://www.france24.com/en/europe/20260723-wildfires-ravage-spain-france-and-italy-killing-three-firefighters',
'https://www.france24.com/en/europe/20260722-ukrainians-welcome-new-army-chief-but-seek-return-of-fired-defence-minister',
'https://www.aljazeera.com/news/2026/7/23/top-us-and-russian-diplomats-discuss-ukraine-war-in-manila?traffic_source=rss',
'https://techcrunch.com/2026/07/22/servicenow-bets-40m-on-indian-firm-businessnext-at-700m-valuation-to-deepen-banking-ai-push/',
'https://techcrunch.com/2026/07/22/soundcloud-acquires-decentralized-music-platform-nina-protocol-months-after-its-shutdown/',
'https://www.theguardian.com/global-development/2026/jul/21/healthy-diet-too-expensive-for-one-in-three-people-globally-un-report-finds',
}
all_leads = {x.get('url'): x for x in base + leads}
headers = {'User-Agent': 'Mozilla/5.0 (compatible; 383Lajme/1.0; +https://383ks.com)'}
results = []
for url in selected_urls:
    row = dict(all_leads[url])
    try:
        request = Request(url, headers=headers)
        with urlopen(request, timeout=25, context=ssl.create_default_context()) as response:
            html = response.read(1_500_000).decode('utf-8', errors='replace')
        for prop, field in [('og:title','og_title'),('og:description','og_description'),('og:image','image_url')]:
            match = re.search(r'<meta[^>]+(?:property|name)=["\']'+re.escape(prop)+r'["\'][^>]+content=["\']([^"\']+)', html, re.I)
            if not match:
                match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']'+re.escape(prop)+r'["\']', html, re.I)
            row[field] = unescape(match.group(1).strip()) if match else row.get(field, '')
        image_request = Request(row['image_url'], headers=headers)
        with urlopen(image_request, timeout=25, context=ssl.create_default_context()) as image_response:
            image_bytes = image_response.read(15_000_000)
        with Image.open(BytesIO(image_bytes)) as image:
            image.verify()
        with Image.open(BytesIO(image_bytes)) as image:
            row['image_dimensions'] = list(image.size)
        row['verified'] = True
    except Exception as exc:
        row['verified'] = False
        row['error'] = f'{type(exc).__name__}: {exc}'
    results.append(row)
Path('data/automation/selected-direct-leads.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'verified {sum(bool(x.get("verified")) for x in results)}/{len(results)} selected direct leads')
