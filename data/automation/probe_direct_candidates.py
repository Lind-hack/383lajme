from __future__ import annotations
import html, re
from io import BytesIO
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from PIL import Image

urls = [
'https://www.intellinews.com/kosovo-trade-deficit-widens-16-1-to-578-3mn-in-june-456515/',
'https://www.b92.net/info/kosovo/252760/pucnjava-na-kosovu-i-metohiji/vest',
'https://www.euronews.com/business/2026/07/23/ecb-hostage-to-oil-prices-lagarde-leaves-door-open-for-a-september-hike',
'https://www.euronews.com/my-europe/2026/07/23/one-dead-and-four-injured-after-czech-military-helicopter-crashes-at-air-base',
'https://www.euronews.com/2026/07/23/more-than-80700-sign-petition-demanding-world-cup-final-replay',
'https://www.aljazeera.com/news/2026/7/23/us-house-votes-to-limit-iran-war-for-first-time-since-ceasefire-breakdown?traffic_source=rss',
'https://www.aljazeera.com/news/2026/7/23/more-than-100-uk-millionaires-ask-new-pm-andy-burnham-to-tax-them-more',
'https://techcrunch.com/2026/07/23/openai-makes-chatgpt-health-available-to-all-u-s-users/',
'https://techcrunch.com/2026/07/23/google-will-now-let-you-sign-in-to-your-account-with-a-selfie-video/',
'https://techcrunch.com/2026/07/23/ai-chip-startup-etched-defies-skeptics-hits-10-3b-valuation-from-big-name-investors/',
'https://www.theguardian.com/world/2026/jul/23/two-russian-men-jailed-angola-terrorism-and-spying',
'https://www.theguardian.com/uk-news/2026/jul/23/british-army-cancel-training-kenya-defence-agreement-dispute',
'https://n1info.rs/vesti/kfor-smanjenje-broja-vojnika-kosovo/',
'https://www.tanjug.rs/english/politics/268105/mojsilovic-meets-with-kfor-commander-requests-protection-for-kosovo-metohija-serbs-heritage/vest',
'https://www.france24.com/en/after-meeting-with-moscow-washington-reiterates-wish-to-mediate-ukraine-war',
'https://www.france24.com/en/the-bayeux-tapestry-in-london-a-diplomatic-operation-that-almost-never-happened',
'https://www.bbc.co.uk/news/articles/cx2djnzrqk2o?at_medium=RSS&at_campaign=rss',
'https://www.bbc.co.uk/news/articles/cpw9xzx9r4ko?at_medium=RSS&at_campaign=rss',
]
def meta(page, name):
  for pat in (rf'<meta[^>]+(?:property|name)=["\']{re.escape(name)}["\'][^>]+content=["\']([^"\']+)',rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(name)}["\']'):
    m=re.search(pat,page,re.I)
    if m:return html.unescape(m.group(1).strip())
  return ''
for url in urls:
  try:
    with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=60) as r:
      page=r.read(1500000).decode('utf-8','replace'); final=r.url
    image=meta(page,'og:image'); title=meta(page,'og:title')
    with urlopen(Request(image,headers={'User-Agent':'Mozilla/5.0'}),timeout=60) as r: body=r.read(15000000)
    with Image.open(BytesIO(body)) as im: size=im.size
    print('OK',urlparse(final).netloc, size, title[:70], image)
  except Exception as e: print('FAIL',url,type(e).__name__,str(e)[:180])
