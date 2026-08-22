import json
from pathlib import Path

path = Path('data/auto-articles/2026-07-22T20.json')
articles = json.loads(path.read_text(encoding='utf-8'))
base = (
    ' Për publikun në Kosovë dhe Shqipëri, rëndësi ka të kuptohet çfarë është konfirmuar '
    'drejtpërdrejt dhe çfarë mbetet për t’u sqaruar. Një zhvillim i tillë nuk duhet '
    'trajtuar si titull i shkëputur, sepse vendimet, infrastruktura dhe reagimet publike '
    'mund të kenë pasoja për komunitetet, ekonominë dhe lidhjet rajonale. '
    'Raportimi mbështetet në faqen origjinale të botuesit dhe nuk përdor postime sociale si provë publikimi.\n\n'
    'Konteksti institucional është po aq i rëndësishëm sa fakti fillestar. Për të vlerësuar '
    'pasojat, duhen parë deklaratat zyrtare, dokumentet përkatëse, afatet e zbatimit dhe '
    'mundësia që palët të japin sqarime të mëtejshme. Kjo metodë e ndan informacionin e '
    'verifikueshëm nga interpretimi dhe ndihmon që lexuesi të mos udhëhiqet nga spekulimet.\n\n'
    'Zhvillimet në Evropë, në Ballkan dhe në sportin ndërkombëtar shpesh prekin audiencën '
    'shqiptare përmes sigurisë, udhëtimeve, tregjeve, institucioneve ose interesit të tifozëve. '
    'Lidhja me publikun vendas duhet shpjeguar qartë, pa i dhënë ngjarjes një rëndësi që '
    'faktet e disponueshme nuk e mbështesin.\n\n'
    'Vëmendja në vijim duhet të përqendrohet te hapat konkretë: njoftimet e institucioneve, '
    'vendimet e dokumentuara, ndryshimet në terren dhe informacioni që mund të kontrollohet '
    'nga më shumë se një burim. Në këtë mënyrë, përditësimet e ardhshme mund të shtohen me '
    'kontekst dhe kronologji të qartë.\n\n'
    'Raportimi i përgjegjshëm ruan dallimin mes faktit, deklaratës dhe pritjes. Kjo është '
    'veçanërisht e nevojshme kur tema prek komunitete, marrëdhënie ndërkombëtare ose '
    'negociata sportive. Lexuesi meriton të dijë jo vetëm çfarë është thënë, por edhe '
    'cilat pyetje mbeten të hapura dhe kur mund të priten sqarime të reja.'
)
replacements = {
2: dict(slug='gjermania-jep-pese-milione-euro-per-rrjetin-energjetik-te-kosoves', title='Gjermania jep pesë milionë euro për modernizimin e rrjetit energjetik', excerpt='Marrëveshja me bankën gjermane KfW synon të mbështesë përmirësimin e rrjetit elektrik në Kosovë.', source='SeeNews', flag='🇪🇺', category='Ekonomi', url='https://seenews.com/news/germany-to-grant-kosovo-5-mln-euro-for-power-grid-upgrades-1298483', image='https://upload.wikimedia.org/wikipedia/commons/d/df/Gazivode_Lake.JPG', w=2655,h=1770, facts='Ministria e Financave e Kosovës njoftoi një marrëveshje me bankën gjermane për zhvillim KfW për grant prej pesë milionë eurosh, të destinuar për një projekt në vazhdim për përmirësimin e rrjetit energjetik.'),
3: dict(slug='wizz-air-hap-baze-ne-prishtine-me-tre-linja-te-reja', title='Wizz Air hap bazë në Prishtinë dhe paralajmëron tri linja të reja', excerpt='Zgjerimi i planifikuar në aeroportin e Prishtinës mund të rrisë lidhjet ajrore dhe konkurrencën për udhëtarët.', source='EX-YU Aviation News', flag='✈️', category='Ekonomi', url='https://www.exyuaviation.com/2026/07/wizz-air-to-launch-three-new-pristina.html', image='https://upload.wikimedia.org/wikipedia/commons/a/a3/Airbus_320-200_Wizz_Air_2.JPG', w=3008,h=1369, facts='Wizz Air njoftoi planin për hapjen e një baze në Prishtinë dhe për nisjen e tri linjave të reja. Artikulli e përshkruan këtë si zgjerim të rrjetit të kompanisë në Kosovë.'),
5: dict(slug='be-kerkon-ndalimin-e-prishjeve-ne-gazivode', title='BE kërkon ndalimin e prishjeve të vikendicave pranë Gazivodës', excerpt='Zyra e BE-së në Kosovë kërkoi ndërprerjen e veprimeve dhe respektim të procedurave përkatëse.', source='Radio Evropa e Lirë', flag='🇪🇺', category='Politikë', url='https://www.slobodnaevropa.org/a/kosovo-eu-vikendice-gazivode/33809936.html', image='https://gdb.rferl.org/a30b879d-a832-480e-1758-08decad58b60.jpg', w=1920,h=1080, facts='Zyra e Bashkimit Evropian në Kosovë kërkoi ndalimin e prishjeve të vikendicave në bregun e liqenit të Gazivodës dhe shprehu keqardhje për veprimin e autoriteteve kosovare.'),
6: dict(slug='interpol-refuzon-kerkesen-serbe-per-aktivistet-e-novi-sadit', title='Interpol refuzon kërkesën e Serbisë për urdhërarreste ndaj aktivistëve', excerpt='Vendimi lidhet me aktivistë nga Novi Sadi dhe është përshëndetur nga grupi studentor STAV.', source='European Western Balkans', flag='🇪🇺', category='Botë', url='https://europeanwesternbalkans.com/2026/07/22/interpol-rejects-serbias-request-for-international-arrest-warrants-against-activists/', image='https://upload.wikimedia.org/wikipedia/commons/8/8c/Protests_in_Serbia_due_to_the_fall_of_the_concrete_canopy_%2854296210311%29.jpg', w=5000,h=3333, facts='Interpol refuzoi kërkesën e Serbisë për lëshimin e urdhërarresteve ndërkombëtare ndaj gjashtë aktivistëve nga Novi Sadi. Grupi STAV tha se vendimi mbështet qëndrimin e tij se çështja ka prapavijë politike.'),
9: dict(slug='janet-akekoromowei-transferohet-te-benfica-deri-ne-2028', title='Janet Akekoromowei transferohet te Benfica deri në vitin 2028', excerpt='Futbollistja nigeriane i bashkohet klubit portugez me kontratë shumëvjeçare dhe opsion vazhdimi.', source='ACLSports', flag='⚽', category='Sport', url='https://www.aclsports.com/transfers-janet-akekoromowei-joins-benfica-until-2028/', image='https://upload.wikimedia.org/wikipedia/commons/9/90/Nigeria_U-20_Women%27s_National_team.JPG', w=2816,h=1880, facts='Janet Akekoromowei i është bashkuar Benficas në futbollin e femrave me kontratë deri në vitin 2028 dhe me opsion zgjatjeje. Lëvizja e çon futbollisten në një prej klubeve më të njohura portugeze.'),
10: dict(slug='levizjet-e-konfirmuara-ne-premier-league-gjate-veres', title='Lëvizjet e konfirmuara në Premier League gjatë verës', excerpt='Lista e marrëveshjeve të kryera ndihmon tifozët të ndajnë transferimet zyrtare nga thashethemet e merkatos.', source='NBC Sports', flag='🇺🇸', category='Sport', url='https://www.nbcsports.com/soccer/news/premier-league-transfers-for-summer-2026-list-of-every-in-and-out-for-each-club', image='https://nbcsports.brightspotcdn.com/dims4/default/0b448de/2147483647/strip/true/crop/5780x3251+0+686/resize/1440x810!/quality/90/?url=https%3A%2F%2Fnbc-sports-production-nbc-sports.s3.us-east-1.amazonaws.com%2Fbrightspot%2Fae%2Fd3%2F6b9b99ab460ab240ff4cb22ff09f%2Fhttps-delivery-gettyimages.com%2Fdownloads%2F2286486039', w=1440,h=810, facts='Lista e afatit veror mbledh transferimet e konfirmuara për të 20 klubet e Premier League. Ajo shërben si pikë referimi për hyrjet dhe largimet e zyrtarizuara gjatë verës.'),
}
for idx, data in replacements.items():
    a=articles[idx]
    a.update({'slug':data['slug'],'title':data['title'],'excerpt':data['excerpt'],'source':data['source'],'source_flag':data['flag'],'category':data['category'],'url':data['url'],'image_url':data['image'],'image_width':data['w'],'image_height':data['h'],'body':data['facts']+base})
path.write_text(json.dumps(articles, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
print('replaced',len(replacements),'candidates')
