import sys
sys.path.insert(0,'scripts')
from codex_automation_support import _fetch_image_dimensions
urls=[
'https://balkaninsight.com/wp-content/uploads/2026/07/Villa-demolition-Kosovo-north-3.png',
'https://europeanwesternbalkans.com/wp-content/uploads/2025/05/Blokada_studenti_aktivisti_Novi_Sad_45_021.jpg',
'https://static.euobserver.com/2026/07/1709Paunovic1.jpg',
'https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/116e/live/d8585fa0-85d3-11f1-b976-0b9c15b0ccfc.jpg',
'https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/aa2d/live/0a96cb40-85b7-11f1-bee8-53ce494e1abc.jpg',
'https://cdn.seenews.com/images/t1920x1200/germany-to-grant-kosovo-5-mln-euro-for-power-grid-upgrades-1298483-1784727125.webp',
'https://cdn.seenews.com/images/t1920x1200/wizz-air-opens-base-in-kosovos-pristina-1298468-1784723045.webp',
'https://www.aljazeera.com/wp-content/uploads/2026/07/afp_6a6079c1f0e2-1784707522.jpg?resize=1920%2C1440',
'https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/5803/live/7ce1c600-85b2-11f1-bee8-53ce494e1abc.jpg',
'https://europeanwesternbalkans.com/wp-content/uploads/2026/07/IMG_9819-1.jpeg',
'https://balkaninsight.com/wp-content/uploads/2026/07/cover-v7-1280x768.png',
'https://wp.technologyreview.com/wp-content/uploads/2026/07/GettyImages-2194586709.jpg?resize=1920,1080',
'https://static.time.com/v3/assets/bltea6093859af6183b/bltb646cfa2984c71f1/6a5a422025e8785a3dda4ed9/weekend-essay-social-media.jpg?branch=production&width=3840&quality=75&auto=webp&crop=16:9'
]
for u in urls:
 try: print(_fetch_image_dimensions(u),u)
 except Exception as e: print('ERROR',type(e).__name__,e,u)
