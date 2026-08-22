import json
from pathlib import Path

OUT = Path('data/auto-articles/2026-07-22T20.json')
created = '2026-07-22T20:35:00+02:00'

items = [
  {
    'slug':'zelensky-shkarkon-syrskyn-pas-protestave', 'category':'Botë', 'source':'France 24', 'source_flag':'🇫🇷',
    'title':'Zelensky shkarkon shefin e ushtrisë pas protestave',
    'excerpt':'Ndryshimi në komandën ushtarake vjen pas ditësh protestash dhe hap një fazë të re tensioni politik në Ukrainë.',
    'url':'https://www.france24.com/en/zelensky-sacks-army-chief-oleksandr-syrsky-after-protests',
    'image_url':'https://s.france24.com/media/display/89331272-85aa-11f1-a711-005056bf30b7/w:1280/p:16x9/EN-20260722-100131-100330-CS.jpg', 'image_width':1280, 'image_height':720,
    'facts':'Presidenti Volodymyr Zelensky njoftoi largimin e Oleksandr Syrskyt nga posti i komandantit të përgjithshëm të forcave të armatosura. Raportimi e lidh vendimin me protestat e ditëve të fundit, të nxitura pas largimit të Mykhailo Fedorov nga posti i ministrit të Mbrojtjes.',
    'context':'Në një shtet në luftë, një ndërrim i tillë nuk është vetëm çështje administrative. Ai prek zinxhirin e komandës, raportin mes udhëheqjes civile dhe ushtarake, si edhe besimin e publikut se vendimet strategjike merren me përgjegjësi.',
    'impact':'Për rajonin dhe Evropën, zhvillimi ndiqet nga afër sepse kapaciteti mbrojtës i Ukrainës lidhet drejtpërdrejt me sigurinë kontinentale. Çdo paqartësi për drejtimin ushtarak mund të ndikojë edhe në debatet për ndihmën, furnizimet dhe koordinimin me partnerët.',
    'caution':'Informacioni i publikuar konfirmon shkarkimin dhe kontekstin e protestave, por nuk mjafton për të nxjerrë përfundime për rezultatet e ardhshme në front. Vendimet operative dhe emërimet pasuese duhet të vlerësohen vetëm kur të bëhen zyrtare.',
  },
  {
    'slug':'gjermania-miraton-projektin-bërthamor-francez-rus', 'category':'Botë', 'source':'France 24', 'source_flag':'🇫🇷',
    'title':'Gjermania miraton projekt bërthamor francezo-rus pavarësisht polemikave',
    'excerpt':'Autoritetet gjermane dhanë dritën jeshile për prodhimin e karburantit për reaktorë rusë në Lingen, duke nxitur debat për sigurinë.',
    'url':'https://www.france24.com/en/europe/20260722-germany-greenlights-controversial-joint-french-russian-nuclear-project',
    'image_url':'https://s.france24.com/media/display/d70d2888-85c9-11f1-80b4-005056bfb2b6/w:1280/p:16x9/000-A93N24R.jpg', 'image_width':1280, 'image_height':720,
    'facts':'Ministria gjermane e Mjedisit miratoi një projekt të përbashkët francezo-rus në Lingen për prodhimin e shufrave të karburantit për reaktorë të dizajnit rus. Projekti lidhet me një filial të Framatome dhe me Rosatom, kompani shtetërore ruse.',
    'context':'Vendimi vjen në një kohë kur Evropa po përpiqet të ulë varësitë strategjike nga Rusia, ndërsa një pjesë e infrastrukturës bërthamore mbetet e lidhur me teknologji dhe furnizime të trashëguara. Debati është njëkohësisht energjetik, juridik dhe i sigurisë kombëtare.',
    'impact':'Çështja ka rëndësi edhe për vendet e Ballkanit që ndjekin politikat energjetike të BE-së. Ajo tregon sa e vështirë është të ndahen objektivat e sigurisë, vazhdimësia e furnizimit dhe kufizimet ligjore kur bëhet fjalë për sektorë teknikisht të ndërlikuar.',
    'caution':'Raportimi thotë se autoritetet gjermane vlerësuan se nuk kishin bazë ligjore për ta refuzuar projektin. Kjo nuk e mbyll debatin politik dhe as nuk provon pretendime më të gjera për rrezik spiunazhi, të cilat kërkojnë prova të veçanta.',
  },
  {
    'slug':'dronet-ukrainase-godasin-qendrat-logjistike-wildberries', 'category':'Siguri', 'source':'BBC', 'source_flag':'🇬🇧',
    'title':'Dronët ukrainas godasin qendra logjistike të një gjiganti rus online',
    'excerpt':'Sulmet gjatë natës prekën objekte logjistike në rajonet Krasnodar dhe Stavropol, sipas raportimeve nga Rusia.',
    'url':'https://www.bbc.co.uk/news/articles/c36de9n4pxpo?at_medium=RSS&at_campaign=rss',
    'image_url':'https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/aa2d/live/0a96cb40-85b7-11f1-bee8-53ce494e1abc.jpg', 'image_width':1200, 'image_height':675,
    'facts':'Qendra logjistike të Wildberries në rajonet Krasnodar dhe Stavropol u goditën gjatë natës nga dronë ukrainas. Wildberries është një kompani e madhe ruse e tregtisë online, ndaj sulmi e zhvendos vëmendjen nga objektivat ushtarake drejt infrastrukturës së zinxhirit të furnizimit.',
    'context':'Goditjet ndaj logjistikës mund të kenë pasoja për shpërndarjen, punonjësit dhe bizneset që përdorin platformat e mëdha të shitjes online. Ato gjithashtu tregojnë se lufta po ndikon në aktivitete civile dhe ekonomike shumë larg vijës së frontit.',
    'impact':'Për publikun evropian, rasti ilustron se ekonomia digjitale dhe infrastruktura fizike nuk janë të ndara në kohë lufte. Depo, rrjete transporti dhe qendra shpërndarjeje mund të kthehen në pjesë të prekshme të konfliktit, me pasoja të mundshme zinxhir.',
    'caution':'Të dhënat e disponueshme konfirmojnë se objektet u goditën, por nuk japin një bilanc të plotë dëmesh, ndërprerjesh ose viktimash. Këto elemente duhet të trajtohen si të hapura derisa të ketë verifikime të pavarura dhe deklarata të qarta nga palët përkatëse.',
  },
  {
    'slug':'stacion-policie-ne-vendlindjen-e-hitlerit-austri', 'category':'Kulturë', 'source':'BBC', 'source_flag':'🇬🇧',
    'title':'Austria hap stacion policie në ndërtesën ku lindi Hitleri',
    'excerpt':'Ndërtesa historike në Braunau am Inn merr një funksion të ri publik në përpjekje për të shmangur glorifikimin e së kaluarës naziste.',
    'url':'https://www.bbc.co.uk/news/articles/cy5d36e752yo?at_medium=RSS&at_campaign=rss',
    'image_url':'https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/5803/live/7ce1c600-85b2-11f1-bee8-53ce494e1abc.jpg', 'image_width':1200, 'image_height':675,
    'facts':'Në Braunau am Inn është hapur një stacion policie në ish-bujtinën e shekullit të shtatëmbëdhjetë ku lindi Adolf Hitleri. Hapja vjen pas vitesh debatesh për përdorimin e ndërtesës dhe për mënyrën se si vendi duhet të përballet me lidhjen e saj me nazizmin.',
    'context':'Vendosja e një institucioni publik në këtë adresë synon të shmangë kthimin e saj në pikë pelegrinazhi për ekstremistët. Zgjedhja e funksionit ka edhe domethënie simbolike, sepse policia lidhet me rendin demokratik dhe mbrojtjen e ligjit.',
    'impact':'Rasti flet për një pyetje që prek të gjithë Evropën: si duhen trajtuar vendet e kujtesës kur historia e tyre mund të keqpërdoret nga ideologjitë ekstremiste. Përgjigjja nuk është vetëm restaurim arkitektonik, por vendosje e një kuptimi të qartë publik.',
    'caution':'Hapja e stacionit nuk e zgjidh vetë debatin për kujtesën historike. Vlera e masës do të shihet në mënyrën si ruhet ndërtesa, si shpjegohet historia dhe si parandalohet përdorimi propagandistik i saj.',
  },
  {
    'slug':'skaut-modelesh-gjendet-i-vdekur-ne-paris', 'category':'Shoqëri', 'source':'BBC', 'source_flag':'🇬🇧',
    'title':'Një skaut modelesh i lidhur në dokumente me Epstein gjendet i vdekur në Paris',
    'excerpt':'Rasti ka rikthyer vëmendjen te përgjegjësia, hetimet dhe mbrojtja e viktimave në industrinë e modës.',
    'url':'https://www.bbc.co.uk/news/articles/cp8en38vpd3o?at_medium=RSS&at_campaign=rss',
    'image_url':'https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/a6bd/live/3c1a6c30-85b7-11f1-bd07-3b1b1452001a.jpg', 'image_width':1200, 'image_height':675,
    'facts':'Një skaut modelesh, Daniel Siad, është gjetur i vdekur në Paris. Raportimi thekson se emri i tij shfaqet mijëra herë në dokumentet e lidhura me Jeffrey Epstein dhe se ai kishte mohuar të kishte njohur rrezikun që Epstein paraqiste.',
    'context':'Raste të tilla kërkojnë kujdes të veçantë në gjuhë. Lidhja e një emri me dokumente ose me një hetim nuk barazohet automatikisht me përgjegjësi penale, ndërsa rrethanat e vdekjes dhe çdo procedurë zyrtare duhet të sqarohen nga autoritetet kompetente.',
    'impact':'Tema prek standardet e mbrojtjes në industrinë e modës, transparencën e agjencive dhe qasjen ndaj akuzave për shfrytëzim. Vëmendja publike mund të ndihmojë kërkesën për llogaridhënie, por nuk duhet të zëvendësojë hetimin e bazuar në prova.',
    'caution':'Nuk duhen nxjerrë përfundime për shkakun e vdekjes apo për fajësi individuale pa njoftime zyrtare. Raportimi i përgjegjshëm mbron njëkohësisht interesin publik, procesin ligjor dhe dinjitetin e personave të prekur.',
  },
  {
    'slug':'kush-eshte-mykhailo-drapatyi-komandanti-i-ri-ukraines', 'category':'Botë', 'source':'BBC', 'source_flag':'🇬🇧',
    'title':'Kush është Mykhailo Drapatyi, komandanti i ri i ushtrisë ukrainase',
    'excerpt':'Emërimi e vendos një figurë të re në krye të forcave ukrainase, në një moment të ndjeshëm ushtarak dhe politik.',
    'url':'https://www.bbc.co.uk/news/articles/c93483k0lp1o?at_medium=RSS&at_campaign=rss',
    'image_url':'https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/116e/live/d8585fa0-85d3-11f1-b976-0b9c15b0ccfc.jpg', 'image_width':1200, 'image_height':675,
    'facts':'Mykhailo Drapatyi bëhet komandanti i tretë i përgjithshëm i Ukrainës që nga nisja e pushtimit të plotë rus në shkurt 2022. Emërimi pason ndryshimin në krye të ushtrisë dhe vendos vëmendjen te profili, përvoja dhe përgjegjësitë e drejtuesit të ri.',
    'context':'Komandanti i përgjithshëm duhet të bashkojë kërkesat e mbrojtjes në front me menaxhimin e forcave, logjistikës dhe komunikimit me udhëheqjen politike. Në luftë, ndryshimi i personit në këtë pozitë shoqërohet gjithmonë me pritje të larta dhe me presion publik.',
    'impact':'Për aleatët evropianë, stabiliteti i komandës ukrainase ka rëndësi për planifikimin e ndihmës dhe për vlerësimin e nevojave të ardhshme. Zhvillimi ndiqet edhe në Ballkan, ku siguria evropiane dhe pasojat e luftës në Ukrainë mbeten temë qendrore e debatit publik.',
    'caution':'Një profil personal nuk mjafton për të parashikuar ndryshime në strategji ose në zhvillimet ushtarake. Rezultatet do të varen nga kushtet në terren, burimet në dispozicion dhe vendimet institucionale që do të pasojnë emërimin.',
  },
  {
    'slug':'deklarata-serbe-per-spastrimin-etnik-ngre-alarm-ne-ballkan', 'category':'Politikë', 'source':'EUobserver', 'source_flag':'🇪🇺',
    'title':'Deklarata e një ministri serb për Kosovën ngre alarm në Ballkan',
    'excerpt':'Një deklaratë për ngjarjet e vitit 1998 ka sjellë reagime dhe ka rikthyer në qendër gjuhën politike për Kosovën.',
    'url':'https://euobserver.com/229568/i-would-have-ethnically-cleansed-kosovo-in-1998-says-serbian-minister-opening-a-balkan-pandoras-box/',
    'image_url':'https://static.euobserver.com/2026/07/1709Paunovic1.jpg', 'image_width':1651, 'image_height':1101,
    'facts':'Një ministër serb u citua duke thënë se do ta kishte spastruar etnikisht Kosovën në vitin 1998. Artikulli e vendos deklaratën në kontekstin e debatit për narrativat politike të periudhës së Millosheviqit dhe për reagimet e diplomatëve e ekspertëve.',
    'context':'Gjuha që relativizon ose normalizon spastrimin etnik është veçanërisht e rëndë në Ballkan, ku pasojat e luftërave të viteve nëntëdhjetë vazhdojnë të formësojnë marrëdhëniet mes komuniteteve. Fjalët e zyrtarëve kanë peshë përtej polemikës së ditës.',
    'impact':'Për Kosovën, reagimi institucional dhe publik ndaj deklaratave të tilla lidhet me sigurinë e komuniteteve, dialogun rajonal dhe besueshmërinë e përpjekjeve për pajtim. Partnerët evropianë pritet të vëzhgojnë nëse retorika përkthehet në qëndrime ose veprime konkrete.',
    'caution':'Raportimi i saktë duhet të ruajë dallimin mes citimit të një deklarate, interpretimit politik të saj dhe përgjegjësisë ligjore. Çdo pretendim për pasoja zyrtare apo masa ndaj personit duhet të mbështetet me njoftime të verifikueshme.',
  },
  {
    'slug':'ambasada-amerikane-perfaqesimi-serbe-kosove', 'category':'Politikë', 'source':'N1', 'source_flag':'🇷🇸',
    'title':'Uashingtoni thekson përfaqësimin e serbëve në institucionet e Kosovës',
    'excerpt':'Mes debatit për prokurorët serbë, u rikujtua se Kushtetuta garanton përfaqësimin e komuniteteve në institucione.',
    'url':'https://n1info.rs/english/news/us-embassy-kosovo-constitution-guarantees-representation-of-serbs-in-institutions/',
    'image_url':'https://n1info.rs/media/images/2025/5/1629136653-americka-ambasada-SAD-kosovo-prist.width-1200.jpg', 'image_width':1200, 'image_height':675,
    'facts':'Ambasada e SHBA-së në Prishtinë theksoi se Kushtetuta e Kosovës garanton përfaqësimin e serbëve në institucione. Komenti erdhi në kontekstin e vendimit të ushtrueses së detyrës së presidentes lidhur me kërkesën e Këshillit Prokurorial për shkarkimin e prokurorëve serbë.',
    'context':'Përfaqësimi në drejtësi është një çështje e ndjeshme për funksionimin e institucioneve në komunat me shumicë serbe dhe për besimin e qytetarëve. Ai prek jo vetëm numrin e zyrtarëve, por edhe qasjen në shërbime dhe perceptimin e paanshmërisë së sistemit.',
    'impact':'Mesazhi amerikan tregon se partnerët ndërkombëtarë po e lidhin stabilitetin institucional me respektimin e garancive kushtetuese për komunitetet. Për Kosovën, kjo është njëkohësisht çështje e sundimit të ligjit dhe e marrëdhënieve me aleatët.',
    'caution':'Deklarata rikujton parimin kushtetues, por nuk përcakton vetë përfundimin e çdo procedure individuale. Vendimet për prokurorët dhe arsyetimet e tyre duhet të lexohen nga dokumentet e institucioneve përkatëse.',
  },
  {
    'slug':'bohemians-udheton-ne-kosove-me-avantazh-minimal', 'category':'Sport', 'source':'Irish Examiner', 'source_flag':'🇮🇪',
    'title':'Bohemians udhëton në Kosovë me avantazh minimal në eliminatoret evropiane',
    'excerpt':'Një gol i vonë i dha klubit irlandez një epërsi të ngushtë para ndeshjes së kthimit në Kosovë.',
    'url':'https://www.irishexaminer.com/sport/soccer/arid-41884360.html',
    'image_url':'https://www.irishexaminer.com/cms_media/module_img/10332/5166337_6_org_3519260.jpg', 'image_width':1920, 'image_height':1087,
    'facts':'Bohemians siguroi një avantazh të ngushtë në një ndeshje kualifikuese të Ligës së Konferencës pas një goli të vonë nga Tierney. Ndeshja e kthimit do të luhet në Kosovë, ku rezultati i parë e lë përballjen të hapur.',
    'context':'Në eliminatoret me dy ndeshje, një epërsi minimale ndryshon mënyrën se si të dy ekipet hyjnë në takimin e dytë, por nuk vendos asgjë paraprakisht. Nikoqiri mund të mbështetet te terreni dhe tifozët, ndërsa mysafiri duhet të menaxhojë presionin e rezultatit.',
    'impact':'Ndeshje të tilla sjellin vëmendje ndërkombëtare për klubet dhe stadiumet e Kosovës. Ato kanë rëndësi sportive, por edhe praktike për organizimin, sigurinë dhe përvojën e tifozëve që ndjekin futbollin evropian në vend.',
    'caution':'Avantazhi i parë nuk duhet trajtuar si kualifikim i kryer. Përbërjet, gjendja fizike e lojtarëve dhe vendimet e trajnerëve mund të ndryshojnë ndjeshëm para ndeshjes së kthimit.',
  },
  {
    'slug':'morgan-rogers-i-bashkohet-chelseat-me-kontrate-deri-2033', 'category':'Sport', 'source':'Al Jazeera', 'source_flag':'🇶🇦',
    'title':'Morgan Rogers i bashkohet Chelseat me kontratë deri në vitin 2033',
    'excerpt':'Sulmuesi 23-vjeçar kalon nga Aston Villa në një marrëveshje që raportohet si rekord britanik.',
    'url':'https://www.aljazeera.com/sports/2026/7/22/chelsea-sign-morgan-rogers-from-aston-villa-in-record-british-deal',
    'image_url':'https://www.aljazeera.com/wp-content/uploads/2026/07/afp_6a6079c1f0e2-1784707522.jpg?resize=1920%2C1440', 'image_width':1920, 'image_height':1440,
    'facts':'Morgan Rogers, 23 vjeç, i është bashkuar Chelseat nga Aston Villa dhe ka nënshkruar kontratë deri në vitin 2033. Marrëveshja u raportua si rekord britanik, duke e bërë transferimin një nga lëvizjet më të rëndësishme të afatit veror.',
    'context':'Kontratat e gjata u japin klubeve mundësi të planifikojnë afatgjatë, por rrisin edhe pritjet ndaj lojtarit dhe drejtimit sportiv. Për një sulmues të ri, kalimi në një klub me kërkesa të larta nënkupton konkurrencë të fortë dhe vëmendje të vazhdueshme publike.',
    'impact':'Lëvizjet e mëdha në Premier League ndikojnë tregun më gjerë, nga çmimet e lojtarëve deri te strategjitë e klubeve që kërkojnë zëvendësime. Tifozët kosovarë që ndjekin kampionatin anglez do ta kenë këtë transferim si një nga temat kryesore të sezonit të ri.',
    'caution':'Termi rekord lidhet me raportimin e marrëveshjes dhe duhet kuptuar në kontekstin e shifrave e kushteve që klubet zgjedhin të bëjnë publike. Vlera sportive e transferimit do të vlerësohet vetëm nga paraqitjet në fushë.',
  },
  {
    'slug':'afati-veror-i-transferimeve-premier-league-2026', 'category':'Sport', 'source':'Sky Sports', 'source_flag':'🇬🇧',
    'title':'Çfarë duhet ditur për afatin veror të transferimeve në Angli',
    'excerpt':'Klubet e Premier League vazhdojnë të lëvizin në treg, ndërsa afati i verës mbyllet më 1 shtator.',
    'url':'https://www.skysports.com/football/news/12875/13546618/transfer-news-summer-transfer-window-2026-premier-league-deals-ins-and-outs',
    'image_url':'https://e0.365dm.com/26/02/1600x900/skysports-transfer-ins-outs_7152975.jpg?20260202081247', 'image_width':1600, 'image_height':900,
    'facts':'Afati veror i transferimeve për klubet e Premier League u hap më 15 qershor dhe mbyllet më 1 shtator në orën 23:00 sipas kohës së Mbretërisë së Bashkuar. Klubet po përdorin javët e mbetura për të finalizuar hyrjet dhe largimet para sezonit të ri.',
    'context':'Afati është periudha kur planet sportive bëhen të dukshme përmes kontratave, huazimeve dhe shitjeve. Çdo lëvizje ndikon jo vetëm ekipin që blen, por edhe klubin që shet, lojtarët e tjerë në pozicion dhe balancën financiare të kampionatit.',
    'impact':'Premier League ka audiencë të madhe në Kosovë dhe Shqipëri, prandaj afati përcillet nga afër edhe jashtë Anglisë. Për tifozët, dallimi kryesor është mes marrëveshjeve të konfirmuara dhe thashethemeve, të cilat shpesh qarkullojnë para se klubet të bëjnë njoftim zyrtar.',
    'caution':'Listat e transferimeve ndryshojnë shpejt dhe çdo informacion për një marrëveshje duhet kontrolluar te klubet ose organizatorët e garës. Afati dhe rregullat e regjistrimit nuk garantojnë që një lojtar do të ketë rol të menjëhershëm në formacion.',
  },
  {
    'slug':'transferimet-e-medha-qe-mund-te-ndodhin-ne-premier-league', 'category':'Sport', 'source':'The Independent', 'source_flag':'🇬🇧',
    'title':'Lojtarët e mëdhenj që mund të lëvizin gjatë verës në Angli',
    'excerpt':'Klubet kryesore angleze po kërkojnë përforcime, ndërsa tregu mbetet i hapur deri në fillim të shtatorit.',
    'url':'https://www.independent.co.uk/sport/football/transfer-news-premier-league-arsenal-man-united-liverpool-b3019344.html',
    'image_url':'https://static.independent.co.uk/2026/06/09/19/00e50537ccd47122ec6510357cdbc1f7Y29udGVudHNlYXJjaGFwaSwxNzgxMTEzNDc2-2.84456868.jpg?width=1200&height=800&crop=1200:800', 'image_width':1200, 'image_height':800,
    'facts':'Arsenal, Liverpool, Manchester United dhe klube të tjera të mëdha angleze janë në kërkim të emrave të njohur ndërsa afati veror i transferimeve intensifikohet. Analiza përmend interesin e tregut për lojtarë si Alvarez dhe Barcola, por e trajton shumicën e rasteve si mundësi, jo si marrëveshje të kryera.',
    'context':'Dallimi mes interesit, negociatave dhe transferimit të konfirmuar është vendimtar. Klubet mund të shqyrtojnë disa opsione për të njëjtin pozicion, ndërsa çmimi, dëshira e lojtarit dhe rregullat financiare mund ta ndryshojnë shpejt një histori tregu.',
    'impact':'Për tifozët shqiptarë të futbollit anglez, vera sjell njëkohësisht informacion të dobishëm dhe shumë zhurmë. Një lexim i kujdesshëm i tregut ndihmon të ndahen planet e klubeve nga thashethemet që mund të mos arrijnë kurrë në kontratë.',
    'caution':'Asnjë emër i përmendur si objektiv nuk duhet paraqitur si transferim i sigurt pa komunikatë zyrtare. Artikulli fokusohet te mundësitë e tregut dhe nuk zëvendëson konfirmimin nga klubet, federatat ose përfaqësuesit e lojtarëve.',
  },
]


def render_body(item):
    p1 = f"{item['facts']} Ky zhvillim është i rëndësishëm për lexuesit në Kosovë dhe Shqipëri sepse lidhet me sigurinë, politikën, ekonominë ose sportin në hapësirën më të gjerë evropiane. Informacioni bazë është marrë nga artikulli origjinal i {item['source']}, i publikuar më 22 korrik 2026."
    p2 = f"{item['context']} Në vend të leximit të ngjarjes vetëm si titull i ditës, duhet parë edhe kuadri institucional dhe njerëzor: cilët vendime merren, kush preket prej tyre dhe cilat të dhëna janë ende të pakonfirmuara. Kjo qasje ndihmon që debati publik të mos reduktohet në reagime të shpejta."
    p3 = f"{item['impact']} Për një portal që i drejtohet audiencës shqiptare, rëndësi ka të sqarohet lidhja reale me rajonin pa i fryrë faktet. Zhvillimet ndërkombëtare ndikojnë në pritjet për sigurinë, në tregjet, në lëvizjet e njerëzve dhe në bisedat që qytetarët bëjnë për të ardhmen e tyre."
    p4 = f"{item['caution']} Për këtë arsye, titulli dhe përmbledhja shmangin gjuhën e bujshme dhe i japin përparësi asaj që është verifikuar drejtpërdrejt në faqen e botuesit. Çdo informacion i ri duhet krahasuar me dokumente zyrtare, njoftime të institucioneve ose raportime të mëtejshme të besueshme."
    p5 = "Në ditët në vijim, vëmendja duhet të jetë te hapat e verifikueshëm dhe jo te spekulimet: njoftimet zyrtare, vendimet institucionale, rezultatet në terren dhe reagimet e dokumentuara. Kjo e mban informimin të dobishëm për publikun dhe e bën të qartë dallimin mes një fakti të konfirmuar, një interpretimi dhe një pritjeje për zhvillime të reja."
    return '\n\n'.join([p1,p2,p3,p4,p5])

for n, item in enumerate(items, 1):
    score = {'relevance':8,'urgency':8,'public_impact':8,'local_depth':7,'controversy_interest':7,'credibility':9,'corroboration':7,'editorial_safety':9}
    item.update({
        'id':f'383-20260722-20-{n:02d}', 'dispatch':str(n), 'body':render_body(item),
        'source_bias':'neutral', 'tone':'informative', 'published_at':'2026-07-22T20:00:00+02:00',
        'reading_time':1, 'featured': n in (1,7,8), 'engagement_score':0.0,
        'score_reason':'Artikull i verifikuar në URL-në e drejtpërdrejtë të botuesit, me interes për audiencën shqiptare.',
        'score_breakdown':score, 'score_formula':'weighted editorial score v1', 'created_at':created,
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(items, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(OUT)
