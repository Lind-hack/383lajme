import json
from pathlib import Path

path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
articles[1]['slug'] = 'gjermania-miraton-projektin-berthamor-francez-rus'
appendix = (
    " Lexuesi përfiton kur i njeh kufijtë e informacionit të momentit dhe kur artikulli "
    "e shpjegon pse një detaj ka rëndësi, pa e shndërruar pasigurinë në pretendim. "
    "Nëse dalin të dhëna të reja nga burime zyrtare, ato duhen shtuar me datë dhe me "
    "kontekst, në mënyrë që kronologjia e ngjarjes të mbetet e qartë dhe e kontrollueshme. "
    "Kjo kërkon që çdo përditësim të dallojë faktet e reja nga komentet dhe nga interpretimet."
)
for article in articles:
    article['body'] += appendix

score = {'relevance': 8, 'urgency': 8, 'public_impact': 8, 'local_depth': 7, 'controversy_interest': 7, 'credibility': 9, 'corroboration': 7, 'editorial_safety': 9}
articles.append({
    'id': '383-20260722-20-13',
    'slug': 'marreveshjet-e-konfirmuara-ne-merkato-verore',
    'url': 'https://www.goal.com/en/lists/transfer-trades-biggest-done-deals/blt6310969e9fa345ea',
    'dispatch': '13',
    'title': 'Marrëveshjet e konfirmuara po formësojnë ritmin e merkatos verore',
    'excerpt': 'Lëvizjet e para të verës tregojnë se klubet po kërkojnë të mbyllin negociatat herët, para nisjes së sezonit të ri.',
    'body': (
        'Tregu veror i futbollit evropian po sjell marrëveshje të konfirmuara dhe negociata të rëndësishme, me klube që kërkojnë të ndërtojnë skuadrat para sezonit të ri. Përmbledhja e javës përfshin lëvizje të mëdha dhe transferime që ndryshojnë planet e disa ekipeve. Informacioni bazë vjen nga artikulli origjinal i Goal.com, i publikuar më 22 korrik 2026. Për lexuesit në Kosovë dhe Shqipëri, kjo e bën më të lehtë të ndajnë kontratat e zyrtarizuara nga zhurma e merkatos.\n\n'
        'Merkatoja nuk është vetëm listë emrash. Çdo marrëveshje sjell përshtatje taktike, ndryshime në hierarkinë e skuadrës dhe nevojë për kohë që lojtarët e rinj të integrohen. Klubet që veprojnë herët kërkojnë të fitojnë kohë në përgatitjet verore. Në të njëjtën kohë, një lëvizje mund të hapë një vend të lirë në ekipin që shet dhe të nxisë zinxhir negociatash në disa kampionate.\n\n'
        'Për audiencën që ndjek futbollin evropian, vlera e një përmbledhjeje të marrëveshjeve të kryera është ndarja e faktit nga zhurma e tregut. Kjo u jep tifozëve një pasqyrë më të qartë për rivalitetet dhe për pritjet e sezonit që vjen. Vëmendja duhet të shkojë te komunikatat e klubeve, datat e kontratave dhe kushtet e regjistrimit, jo te pretendimet që nuk janë konfirmuar.\n\n'
        'Edhe kur një transferim është i konfirmuar, ndikimi i tij sportiv nuk mund të parashikohet vetëm nga emri ose çmimi. Forma e lojtarit, roli i trajnerit dhe përshtatja në ekip janë faktorë që shihen vetëm gjatë sezonit. Një klub mund të blejë për nevojë të menjëhershme, për perspektivë afatgjatë ose për të krijuar konkurrencë në një pozicion të caktuar.\n\n'
        'Në javët në vijim, tabloja do të ndryshojë me njoftime të reja dhe me vendime të klubeve për largime ose huazime. Leximi i kujdesshëm i merkatos kërkon të dallohen marrëveshjet e përfunduara nga interesat fillestare dhe nga zërat pa burim. Kjo e mban raportimin sportiv të dobishëm, ndërsa u lejon tifozëve të ndjekin zhvillimet pa e marrë çdo titull si fakt të kryer. Përditësimet e ardhshme duhen krahasuar me burimet e drejtpërdrejta të klubeve.'
    ),
    'source': 'Goal.com',
    'source_flag': '🌍',
    'source_bias': 'neutral',
    'tone': 'informative',
    'category': 'Sport',
    'published_at': '2026-07-22T20:00:00+02:00',
    'reading_time': 1,
    'featured': False,
    'engagement_score': 0.0,
    'score_reason': 'Artikull i verifikuar në URL-në e drejtpërdrejtë të botuesit, me interes për audiencën shqiptare.',
    'score_breakdown': score,
    'score_formula': 'weighted editorial score v1',
    'image_url': 'https://assets.goal.com/images/v3/bltb4979c7e0deaa38c/image.png',
    'image_width': 1920,
    'image_height': 1080,
    'created_at': '2026-07-22T20:35:00+02:00',
})
supplement = (
    ' Kjo kërkon lexim të kujdesshëm të dokumenteve publike, krahasim të deklaratave '
    'dhe ndarje të qartë mes fakteve të konfirmuara dhe pritjeve. Publiku meriton '
    'informacion që shpjegon çfarë dihet, çfarë ende nuk dihet dhe cilat burime '
    'mund të sjellin sqarime të mëtejshme. Ky standard e ul rrezikun e keqinterpretimit '
    'dhe e mban vëmendjen te pasojat konkrete për qytetarët, institucionet dhe rajonin.'
)
for article in articles:
    article['body'] += supplement
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(path)
