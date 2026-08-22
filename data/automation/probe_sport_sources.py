from __future__ import annotations
import html,re
from io import BytesIO
from urllib.request import Request,urlopen
from PIL import Image
urls=['https://www.goal.com/en/lists/transfer-trades-biggest-done-deals/blt6310969e9fa345ea','https://www.football365.com/news/transfer-window-summer-2026-rumours-ranked','https://www.espn.com/soccer/story/_/id/48955344/premier-league-2026-summer-transfers-all-confirmed-ins-outs-every-club','https://metro.co.uk/2026/07/23/newcastle-united-question-arsenal-bruno-guimaraes-transfer-agreement-29203125/','https://businessupturn.com/entertainment/celebrity/rajkummar-rao-s-instagram-comment-sparks-debate-over-government-influence-in-bollywood/']
def meta(p,n):
 for x in (rf'<meta[^>]+(?:property|name)=["\']{re.escape(n)}["\'][^>]+content=["\']([^"\']+)',rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(n)}["\']'):
  y=re.search(x,p,re.I)
  if y:return html.unescape(y.group(1).strip())
 return ''
for u in urls:
 try:
  with urlopen(Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as r:p=r.read(1500000).decode('utf8','replace');f=r.url
  im=meta(p,'og:image')
  with urlopen(Request(im,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as r:b=r.read(15000000)
  with Image.open(BytesIO(b)) as x: print('OK',f,x.size,meta(p,'og:title')[:75],im)
 except Exception as e:print('FAIL',u,type(e).__name__,str(e)[:100])
