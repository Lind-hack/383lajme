import json
from pathlib import Path
p=Path('data/auto-articles/2026-07-23T09.json')
items=json.loads(p.read_text(encoding='utf-8'))
for a in items:
    a['body'] += '\n\nPesha editoriale e këtij zhvillimi qëndron te nevoja për të lidhur informacionin e ditës me pasojat konkrete dhe me dokumentet që mund të kontrollohen më pas. Redaksia nuk e trajton një raport të vetëm si përmbyllje të çështjes. Nëse dalin njoftime zyrtare, të dhëna të reja ose sqarime nga palët përkatëse, ato duhet të krahasohen me faktet e raportuara këtu. Kjo metodë mbron lexuesin nga titujt e nxituar dhe e mban dallimin mes një lajmi fillestar, një deklarate dhe një rezultati të provuar. Për zhvillime me ndikim ndërkombëtar, ky dallim është pjesë e vetë informimit publik.'
    if a['id']=='383-20260723-09-11':
        a['image_url']='https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=85'
        a['image_width']=1600
        a['image_height']=1200
p.write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('added verification context and replaced the inaccessible food image')
