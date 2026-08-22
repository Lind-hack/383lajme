from __future__ import annotations
import html,re
from io import BytesIO
from urllib.request import Request,urlopen
from PIL import Image
urls=['https://www.kosovo-online.com/en/news/politics/british-embassy-we-call-integration-kosovos-multiethnic-population-judicial-system-23','https://kossev.info/en/posle-eu-reagovala-i-velika-britanija-zabrinuti-zbog-razresenja-srpskih-tuzilaca-poziv-na-ocuvanje-multietnickog-pravosudja/','https://direktno.rs/magazin/kultura/710445/rados-bajic-nagrada-palic-izjava-direktno.html','https://ednews.net/en/austrian-chancellor-urges-serbia-to-engage-in-dialogue-with-kosovo/','https://www.danas.rs/vesti/politika/kosovski-analiticar-pitanje-srba-i-severa-narusilo-odnose-pristine-i-sad/']
def meta(p,n):
 for x in (rf'<meta[^>]+(?:property|name)=["\']{re.escape(n)}["\'][^>]+content=["\']([^"\']+)',rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(n)}["\']'):
  m=re.search(x,p,re.I)
  if m:return html.unescape(m.group(1).strip())
 return ''
for u in urls:
 try:
  with urlopen(Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as r:p=r.read(1500000).decode('utf8','replace');f=r.url
  im=meta(p,'og:image')
  with urlopen(Request(im,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as r:b=r.read(15000000)
  with Image.open(BytesIO(b)) as x:print('OK',f,x.size,meta(p,'og:title')[:100],im)
 except Exception as e:print('FAIL',u,type(e).__name__,str(e)[:120])
