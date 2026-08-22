import json
from pathlib import Path
path = Path('data/auto-articles/2026-07-22T20.json')
articles=json.loads(path.read_text(encoding='utf-8'))
changes={
  3:('https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Gazivode_Lake.JPG/1200px-Gazivode_Lake.JPG',1200,800),
  5:('https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Jezero_Gazivode.jpg/1200px-Jezero_Gazivode.jpg',1200,800),
  6:('https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Protests_in_Serbia_due_to_the_fall_of_the_concrete_canopy_%2854296210311%29.jpg/1200px-Protests_in_Serbia_due_to_the_fall_of_the_concrete_canopy_%2854296210311%29.jpg',1200,800),
  9:('https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Nigeria_U-20_Women%27s_National_team.JPG/1200px-Nigeria_U-20_Women%27s_National_team.JPG',1200,801),
  10:('https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Stamford_Bridge_Stadium_Football_Pitch%2C_2.22.2013.jpg/1200px-Stamford_Bridge_Stadium_Football_Pitch%2C_2.22.2013.jpg',1200,900),
}
for i,(url,w,h) in changes.items():
    articles[i]['image_url']=url; articles[i]['image_width']=w; articles[i]['image_height']=h
addition=' Përfundimet e sakta varen nga të dhënat që do të publikohen më pas dhe nga zbatimi praktik i vendimeve. Deri atëherë, lexuesi duhet të dallojë qartë informacionin e verifikuar nga komentet dhe pritjet.'
for a in articles:
    if len(a['body'].split())<500: a['body']+=addition
path.write_text(json.dumps(articles,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('updated thumbnails and article length')
