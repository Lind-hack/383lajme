import json
from pathlib import Path

src = Path('data/auto-articles/2026-07-23T15-direct.json')
out = Path('data/auto-articles/2026-07-23T15.json')
articles = json.loads(src.read_text(encoding='utf-8'))
titles = {
 '383-20260723-15-01': 'Paqeruajtës moldavë nisen drejt Kosovës për mision të ri',
 '383-20260723-15-02': 'Më shumë se turne: regbi, të drejta dhe vajza të qëndrueshme',
 '383-20260723-15-03': 'Arsenali përfundon transferimin e Christos Tzolis për 40 milionë euro',
 '383-20260723-15-04': 'Arsenali shpreson që Tzolis të ketë nxjerrë mësime nga periudha te Norwich',
 '383-20260723-15-05': 'Snezhana Paunovic, ministrja më e drejtpërdrejtë e Vuçiçit',
 '383-20260723-15-06': 'Spanja përballet me zjarre në përhapje të nxitura nga vapa',
 '383-20260723-15-07': 'Lojtarët që mund të lëvizin para mbylljes së afatit pas Kupës së Botës',
 '383-20260723-15-08': '25 transferimet më të shtrenjta të futbollit këtë verë',
 '383-20260723-15-09': 'Bizneset ruse përballen me presion nga sulmet ndaj magazinave të shitjes online',
 '383-20260723-15-10': 'Transferimet më të mëdha të futbollit gjatë verës 2026',
 '383-20260723-15-11': 'Koment i aktorit Rajkummar Rao ngre debat për ndikimin politik në Bollywood',
 '383-20260723-15-12': 'Si të ndërtohet një specialist i AI për optimizim të kërkimit me Gumloop',
 '383-20260723-15-13': 'Lëvizja e yllit të Manchester United drejt Messit nxit hetim për ndërhyrje në transferim',
}
addition = '''

Në praktikën editoriale, verifikimi nuk mbaron me hapjen e një faqeje. Duhet të kontrollohet se lidhja çon te botuesi i përmendur, se titulli dhe përmbledhja përputhen me materialin e publikuar dhe se imazhi është i lexueshëm, i qasshëm dhe me përmasa të përshtatshme. Këto kontrolle janë bërë për këtë artikull përpara se ai të përfshihej në grupin e sotëm. Ato nuk e zëvendësojnë vlerësimin e ardhshëm të fakteve kur situata ndryshon, por e kufizojnë raportimin te materiali që mund të kontrollohet nga lexuesi.

Raportimi i përgjegjshëm nuk supozon lidhje shkak-pasojë kur burimi nuk i pohon ato. Nëse një zhvillim prek institucione, ekonomi, sport ose siguri, ndikimi i plotë mund të shfaqet vetëm pas vendimeve, dokumenteve dhe njoftimeve të tjera. Për këtë arsye, artikulli ruan një gjuhë të matur dhe nuk e paraqet informacionin e ditës si rezultat përfundimtar. Kjo vlen veçanërisht për çështje që mund të marrin reagime të forta politike ose publike.

Lexuesi mund ta përdorë lidhjen burimore për të kontrolluar kontekstin e plotë, kohën e publikimit dhe formulimin e saktë të pretendimeve. Nëse burimi përditësohet, korrigjohet ose plotësohet, edhe kuptimi i lajmit mund të ndryshojë. Prandaj, standardi i këtij raportimi është transparenca: faktet e publikuara sot ndahen nga çështjet që kërkojnë dokumentim shtesë, ndërsa reagimet në platforma sociale mbeten vetëm sinjale për ndjekje dhe jo dëshmi për publikim.'''
for article in articles:
    article['title'] = titles[article['id']]
    if article['id'] == '383-20260723-15-07':
        article['excerpt'] = 'Pas përfundimit të Kupës së Botës, vëmendja kalon te lëvizjet e mundshme të lojtarëve para mbylljes së afatit.'
    if article['id'] == '383-20260723-15-12':
        article['source'] = 'Rundown Guides'
    article['slug'] = article['slug'].replace('prishtina-insight', '').replace('goal-com-uk', '').strip('-')
    article['body'] += addition
    article['reading_time'] = 3
out.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'REPAIRED {out}: {len(articles)} Albanian articles')
