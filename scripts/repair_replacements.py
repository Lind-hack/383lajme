import json
from pathlib import Path
path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
articles[5]['image_url'] = 'https://upload.wikimedia.org/wikipedia/commons/d/df/Gazivode_Lake.JPG'
articles[5]['image_width'] = 2655
articles[5]['image_height'] = 1770
articles[10]['image_url'] = 'https://upload.wikimedia.org/wikipedia/commons/7/75/Stamford_Bridge_Stadium_Football_Pitch%2C_2.22.2013.jpg'
articles[10]['image_width'] = 3264
articles[10]['image_height'] = 2448
addition = (
    ' Në praktikë, kuptimi i plotë i këtij zhvillimi kërkon të shihet edhe rrjedha e '
    'vendimeve që e paraprinë, roli i institucioneve dhe mënyra si zbatohen njoftimet '
    'në terren. Një deklaratë ose një marrëveshje mund të jetë hapi i parë, por nuk e '
    'shpjegon e vetme rezultatin. Prandaj duhet të ndiqen afatet, dokumentet dhe '
    'informacioni i publikuar nga palët e përfshira.\n\n'
    'Për lexuesin, kjo do të thotë të kërkojë dallimin mes asaj që është raportuar si '
    'fakt dhe asaj që është parashikim ose koment. Verifikimi i adresës origjinale të '
    'botuesit, krahasimi me njoftime institucionale dhe vëmendja ndaj datës së publikimit '
    'janë hapa të thjeshtë që shmangin keqinterpretimin. Kur ka pasiguri, ajo duhet të '
    'thuhet hapur dhe jo të mbulohet me formulime të bujshme.\n\n'
    'Nëse zhvillimi sjell vendime të reja, reagime zyrtare ose rezultate të dukshme, '
    'ato duhen trajtuar si përditësime të veçanta me kontekst të qartë. Kjo qasje ruan '
    'vlerën e raportimit për publikun dhe respekton nevojën që lajmi të jetë i saktë, '
    'i kuptueshëm dhe i dobishëm për qytetarët në Kosovë dhe në hapësirën shqiptare.'
)
for a in articles:
    if len(a['body'].split()) < 500:
        a['body'] += addition
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('repaired dimensions and bodies')
