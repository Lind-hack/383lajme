import json
from datetime import datetime, timezone
from pathlib import Path

leads = {item['url']: item for item in json.loads(Path('data/automation/selected-direct-leads.json').read_text(encoding='utf-8'))}
now = '2026-07-23T09:15:00+00:00'
score = {'relevance': 8, 'urgency': 8, 'public_impact': 8, 'local_depth': 7, 'controversy_interest': 6, 'credibility': 8, 'corroboration': 7, 'editorial_safety': 9}

def article(no, url, slug, title, excerpt, category, lead, facts, meaning, limits, next_step, featured=False):
    item = leads[url]
    image = item['image_url']
    width, height = item['image_dimensions']
    body = '\n\n'.join([
        lead,
        facts,
        meaning,
        limits,
        next_step,
        'Për këtë raport u përdor lidhja e drejtpërdrejtë e publikuar nga burimi origjinal, e kontrolluar më 23 korrik. Rrjetet sociale dhe komentet publike u trajtuan vetëm si sinjale për ndjekje, jo si provë për publikim. Titulli dhe hyrja i ndajnë faktet e raportuara nga vlerësimet: aty ku burimi përdor formulime si “sipas”, “tha” ose “pretendohet”, edhe ky tekst e ruan të njëjtin kufi. Kjo transparencë është veçanërisht e rëndësishme për lexuesit në Kosovë, Shqipëri dhe diasporë, sepse zhvillimet ndërkombëtare lëvizin shpejt dhe mund të marrin interpretime të ndryshme.'
    ])
    return {
        'id': f'383-20260723-09-{no:02d}', 'slug': slug, 'url': url, 'dispatch': 'cron-direct-supabase',
        'title': title, 'excerpt': excerpt, 'body': body, 'source': item['publisher'], 'source_flag': 'Ndërkombëtar',
        'source_bias': 'neutral', 'tone': 'informues', 'category': category, 'published_at': now,
        'reading_time': 1, 'featured': featured, 'engagement_score': 0, 'score_reason': 'Burim i drejtpërdrejtë aktual, i verifikuar dhe me rëndësi publike për audiencën shqiptare.',
        'score_breakdown': score, 'score_formula': 'weighted editorial score', 'image_url': image, 'image_width': width, 'image_height': height, 'created_at': now
    }

A = []
A.append(article(1,
'https://www.danas.rs/vesti/politika/kosovski-analiticar-pitanje-srba-i-severa-narusilo-odnose-pristine-i-sad/',
'marredheniet-me-shba-ne-fokus-te-debatit-per-veriun',
'Çështja e veriut rikthehet në debatin për marrëdhëniet me SHBA-në',
'Një analizë nga Beogradi e vendos statusin e serbëve dhe veriun e Kosovës në qendër të diskutimit për raportet me Uashingtonin.',
'Politikë',
'Një deklaratë e analistit kosovar Agon Maliçi, e publikuar të enjten, e vë çështjen e serbëve dhe veriun e Kosovës në qendër të debatit për marrëdhëniet ndërmjet Prishtinës dhe Uashingtonit. Vlera e lajmit nuk është se jep një qëndrim të ri zyrtar, por se rikujton sa shpejt temat e sigurisë lokale, përfaqësimit dhe zbatimit të marrëveshjeve mund të bëhen pjesë e komunikimit strategjik me partnerët ndërkombëtarë.',
'Burimi raporton se Maliçi e konsideron këtë çështje arsye kryesore të përkeqësimit të raporteve me Shtetet e Bashkuara. Kjo është një vlerësim i tij dhe nuk duhet lexuar si njoftim institucional apo si konfirmim i një ndryshimi formal të politikës amerikane. Megjithatë, formulimi lidhet me një realitet të njohur: veriu mbetet një provë e përditshme për rendin publik, shërbimet, lirinë e lëvizjes dhe besimin mes komuniteteve.',
'Për Kosovën, pesha e temës qëndron te dallimi ndërmjet menaxhimit të një krize të menjëhershme dhe ndërtimit të një kornize të qëndrueshme politike. Çdo zhvillim që prek komunat me shumicë serbe, mekanizmat e dialogut ose sigurinë në terren ka edhe dimension diplomatik. Kjo e bën të rëndësishme që publiku të kërkojë qartësi për masa konkrete, afate dhe përgjegjësi, jo të mbështetet vetëm te gjuhë e përgjithshme politike.',
'Raporti nuk paraqet dokumente të reja nga qeveritë e Kosovës apo SHBA-së dhe nuk jep shifra të reja për zbatimin e marrëveshjeve. Për këtë arsye, nuk mund të nxirret prej tij përfundimi se është hapur një krizë e re dypalëshe. Artikulli e vendos deklaratën në kontekst dhe ruan dallimin mes analizës së një individi, interesave politike të palëve dhe politikës zyrtare.',
'Hapi që vlen të ndiqet është nëse deklarata të ngjashme shoqërohen me komunikata zyrtare, takime të konfirmuara ose hapa të rinj në dialog. Për lexuesin, pyetja praktike është nëse ato hapa përmirësojnë sigurinë dhe jetën e përditshme në terren. Deri atëherë, debati duhet të lexohet si sinjal për rëndësinë e vazhdueshme të veriut, jo si provë e një vendimi të marrë.', True))
A.append(article(2,
'https://europeanwesternbalkans.com/2026/07/23/most-eu-supporters-oppose-the-sns-government-what-should-brussels-take-away-from-this/',
'sondazhet-ne-serbi-ndajne-mbeshtetjen-per-be-ne-dhe-qeverine',
'Sondazhet në Serbi ndajnë mbështetjen për BE-në nga qëndrimi ndaj qeverisë',
'Të dhënat e cituara në një analizë rajonale sugjerojnë se mbështetja për integrimin evropian nuk përkthehet automatikisht në mbështetje për pushtetin aktual.',
'Politikë',
'Një analizë rajonale e publikuar të enjten sjell në vëmendje lidhjen mes mbështetjes për integrimin evropian dhe kundërshtimit ndaj qeverisë së SNS-së në Serbi. Teksti mbështetet te sondazhe të Qendrës së Beogradit për Politikë të Sigurisë dhe CRTA-së. Për audiencën në Kosovë, tema është e rëndësishme sepse politika e brendshme serbe ndikon drejtpërdrejt në ritmin dhe tonin e debatit rajonal.',
'Artikulli thekson se sondazhet e fundit tregojnë një lidhje të qartë mes orientimit pro-evropian dhe qëndrimit kritik ndaj qeverisë. Ky është përshkrim i të dhënave të cituara nga analiza, jo rezultat zgjedhor. Nuk duhet të ngatërrohet një prirje në kampionë sondazhi me një mandat politik të certifikuar. Metodologjia, madhësia e kampionit dhe pyetjet e sakta janë thelbësore për të matur peshën e çdo përfundimi.',
'Për Brukselin dhe për fqinjët e Serbisë, mesazhi është se politika evropiane nuk mund të lexohet vetëm përmes deklaratave të qeverisë. Brenda shoqërisë mund të bashkëjetojnë pritje për afrim me BE-në, kritika për standardet demokratike dhe shqetësime të ndryshme për ekonominë ose identitetin. Një lexim i tillë ka rëndësi edhe për proceset rajonale, ku premtimet për bashkëpunim shpesh varen nga legjitimiteti i brendshëm.',
'Asnjë sondazh i përmendur nuk është vetë një vendim shtetëror, dhe analiza nuk shpall rezultat të ardhshëm zgjedhor. Prandaj, është e pasaktë të thuhet se opinioni publik ka marrë një drejtim të pakthyeshëm. Ajo që lejon raporti të thuhet është më e kufizuar: mbështetja për Evropën dhe vlerësimi i qeverisë nuk janë domosdoshmërisht e njëjta gjë.',
'Vëmendja tani duhet të jetë te publikimi i plotë i sondazheve, debatet parlamentare dhe mënyra si institucionet evropiane e interpretojnë këtë sinjal. Për Kosovën, çdo ndryshim në klimën politike të Serbisë meriton ndjekje të matur, pa e kthyer një analizë në parashikim. Kjo temë ka më shumë vlerë si dritare mbi debatet shoqërore sesa si instrument për pretendime të shpejta politike.'))
A.append(article(3,
'https://www.aljazeera.com/news/2026/7/23/top-us-and-russian-diplomats-discuss-ukraine-war-in-manila?traffic_source=rss',
'bisedimet-ne-manile-rikthejne-diplomacine-per-luften-ne-ukraine',
'Bisedimet në Manila rikthejnë diplomacinë për luftën në Ukrainë',
'Takimi mes diplomatëve të lartë amerikanë dhe rusë solli deklarata për gatishmëri ndaj një zgjidhjeje politike, pa dëshmi për marrëveshje të re.',
'Botë',
'Takimi në Manila mes diplomatëve të lartë amerikanë dhe rusë e riktheu luftën në Ukrainë në qendër të diplomacisë shumëpalëshe. Raportimi thotë se ministri i Jashtëm rus Sergei Lavrov ka riafirmuar gatishmëri për një zgjidhje politike dhe diplomatike. Formulimi ka peshë, por nuk nënkupton vetvetiu armëpushim, marrëveshje apo ndryshim të verifikuar në vijën e luftës.',
'Fakti i konfirmuar është zhvillimi i bisedimeve në kuadër të mbledhjeve në Manila dhe deklarata e raportuar për gatishmëri diplomatike. Çdo palë në një konflikt përdor gjuhën e negociatave edhe për të formësuar perceptimin ndërkombëtar. Për këtë arsye, një deklaratë duhet krahasuar me propozime të publikuara, mekanizma monitorimi dhe sinjale konkrete nga palët e përfshira.',
'Për Ballkanin Perëndimor, lufta në Ukrainë mbetet çështje sigurie, energjie dhe pozicionimi diplomatik. Sanksionet, lëvizjet e tregjeve dhe tensionet mes fuqive të mëdha prekin edhe vendet që nuk janë palë në konflikt. Për Kosovën dhe Shqipërinë, leximi i saktë i diplomacisë është i rëndësishëm sepse afërsia me BE-në dhe partnerët perëndimorë kërkon reagime të bazuara në informacion të kontrolluar.',
'Raporti nuk tregon se palët kanë pajtuar tekst negociues, datë takimi pasues apo garanci për ndalje të luftimeve. Nuk ka bazë për të shpallur përparim vendimtar vetëm nga fraza për gatishmëri. Edhe burimet e njëjta mund të përshkruajnë një takim si hap simbolik, ndërsa rezultatet praktike të mungojnë për një kohë të gjatë.',
'Zhvillimi që duhet ndjekur është nëse komunikata zyrtare amerikane, ruse ose ndërmjetësuese sjellin hollësi të njëjta mbi çështjet e diskutuara. Transparenca për temat, përfaqësimin dhe hapat vijues do të jetë matësi më i mirë i rëndësisë së takimit. Deri atëherë, lexuesit duhet ta trajtojnë Manilën si kanal diplomatik aktiv, jo si provë se lufta ka hyrë në fazë zgjidhjeje.'))
A.append(article(4,
'https://www.ansa.it/nuova_europa/en/news/sections/culture/2026/07/23/a-focus-on-italy-at-the-short-film-forum-in-kosovo_22dc4bf6-f7d3-4bf0-9d91-90572ccbf9f5.html',
'italia-ne-fokus-te-forumit-te-filmit-te-shkurter-ne-prizren',
'Italia në fokus të forumit të filmit të shkurtër në Prizren',
'Forumi rajonal i projekteve të reja të filmit të shkurtër parashikohet të mbahet nga 9 deri më 12 gusht në kuadër të edicionit të 25-të të DokuFestit.',
'Kulturë',
'Italia pritet të jetë vendi në fokus të edicionit të dytë të Forumit të Filmit të Shkurtër, një platformë rajonale për zhvillimin dhe promovimin e projekteve të reja. Sipas njoftimit të publikuar të enjten, aktiviteti është planifikuar nga 9 deri më 12 gusht, në kuadër të edicionit të 25-të të DokuFestit në Prizren. Kjo e lidh programin me një nga ngjarjet kulturore më të dukshme të verës në Kosovë.',
'Njoftimi e përshkruan forumin si hapësirë për projekte të reja dhe bashkëpunim rajonal. Ky është informacioni i konfirmuar në burim. Ende nuk janë në dispozicion në raport detaje të plota për listën e pjesëmarrësve, përzgjedhjen e projekteve ose format e mbështetjes. Këto hollësi do të përcaktojnë se sa i drejtpërdrejtë do të jetë ndikimi për autorët e rinj dhe profesionistët vendorë.',
'Për Prizrenin, një fokus ndërkombëtar nuk është vetëm program festivali. Ai mund të krijojë takime mes producentëve, autorëve, institucioneve dhe publikut, ndërsa e vendos qytetin në një rrjet më të gjerë kulturor. Për krijuesit shqiptarë, mundësia më e rëndësishme është qasja në bashkëprodhime dhe në njohuri profesionale, jo vetëm prania simbolike e një vendi të ftuar.',
'Është herët të matet rezultati ekonomik ose artistik i programit. Njoftimi nuk premton fonde të reja, kontrata apo projekte të përfunduara. Prandaj, çdo pretendim se forumi do të ndryshojë industrinë duhet shmangur. Vlera e tij e menjëhershme është mundësia e prezantimit dhe e lidhjes profesionale në një moment kur filmi i shkurtër kërkon hapësira më të qëndrueshme zhvillimi.',
'Çfarë mbetet për t’u ndjekur janë programi i plotë, emrat e mentorëve dhe projektet që do të zgjidhen. Ato do të tregojnë nëse fokusi i këtij viti hap mundësi të prekshme për artistë nga Kosova dhe rajoni. Deri atëherë, data dhe kuadri i aktivitetit janë të konfirmuara, ndërsa rezultatet e tij i takojnë procesit që zhvillohet gjatë festivalit.'))
A.append(article(5,
'https://www.bbc.co.uk/news/articles/c235n47g8g8o?at_medium=RSS&at_campaign=rss',
'rritja-e-kostos-se-ai-ve-e-shton-presionin-mbi-kompanite-e-medha',
'Rritja e kostos së AI-ve e shton presionin mbi kompanitë e mëdha',
'Investimet e mëdha në inteligjencën artificiale po rrisin shpenzimet, ndërsa bizneset kërkojnë të arsyetojnë kthimin nga infrastruktura dhe shërbimet cloud.',
'Teknologji',
'Kostoja e garës për inteligjencën artificiale po del në plan të parë, pasi një raport i ri e lidh rritjen e shpenzimeve me investime shumë të mëdha në infrastrukturë. Burimi citon një pritje të publikuar më herët për shpenzime deri në 190 miliardë dollarë për investime në AI. Shifra i përket kompanisë së përmendur në raport dhe nuk është vlerësim për të gjithë industrinë.',
'Pika kryesore është se modelet, qendrat e të dhënave dhe energjia nuk janë kosto abstrakte. Ato kërkojnë kapital, pajisje dhe kapacitet teknik. Kur kompanitë e mëdha rrisin buxhetet, ndikimi mund të shihet te çmimet e shërbimeve cloud, konkurrenca për çipa dhe mënyra se si produktet me AI u ofrohen përdoruesve. Për përdoruesit në Kosovë dhe Shqipëri, kjo mund të prekë qasjen në mjete digjitale dhe koston e shërbimeve të biznesit.',
'Nuk mjafton të shihet vetëm shpenzimi. Pyetja ekonomike është nëse të ardhurat nga cloud, abonimet dhe produktiviteti e përballojnë ritmin e investimit. Raporti e vendos këtë tension mes kostos së lartë dhe kërkesës për të dëshmuar përfitim. Kjo është arsyeja pse debatet për AI nuk janë vetëm teknologjike, por edhe financiare dhe energjetike.',
'Artikulli nuk jep një pasqyrë të plotë të bilancit të çdo kompanie dhe nuk provon se shpenzimi i madh është domosdoshmërisht humbje. Shifra e planifikuar nuk është e barabartë me shpenzim të realizuar, ndërsa rezultatet mund të ndryshojnë sipas tremujorëve. Përfundimet për fituesit ose humbësit e garës kërkojnë raportet financiare dhe të dhëna të krahasueshme.',
'Në javët në vijim vlen të ndiqen raportet e fitimeve, kërkesa për kapacitet cloud dhe komunikimet mbi energjinë e qendrave të të dhënave. Këto do të tregojnë nëse investimi po kthehet në shërbime më të përdorshme apo në presion më të madh kostoje. Për publikun, mesazhi është i thjeshtë: AI ka premtime të mëdha, por funksionon mbi infrastrukturë të kushtueshme.'))
A.append(article(6,
'https://www.france24.com/en/europe/20260723-eu-ambassadors-agree-21st-sanctions-package-against-russia',
'be-ja-arrin-marreveshje-politike-per-paketen-e-re-te-sanksioneve',
'BE-ja arrin marrëveshje politike për paketën e re të sanksioneve',
'Ambasadorët e BE-së arritën marrëveshje politike për masat e reja ndaj Rusisë, përfshirë ngrirjen 12-mujore të kufirit të çmimit të naftës.',
'Botë',
'Ambasadorët e Bashkimit Evropian arritën një marrëveshje politike për një paketë të re sanksionesh ndaj Rusisë lidhur me luftën në Ukrainë. Sipas raportimit, paketa e 21-të përfshin ngrirje 12-mujore të kufirit të çmimit të naftës ruse. Ky është një hap politik i rëndësishëm, por publiku duhet të dallojë marrëveshjen në nivel ambasadorësh nga zbatimi i plotë administrativ dhe ekonomik.',
'Masa e përmendur synon një instrument që lidhet me tregtinë e energjisë dhe presionin ekonomik mbi Moskën. Teksti nuk paraqet këtu të gjitha detajet teknike të paketës, përjashtimet ose datat e hyrjes në fuqi. Në sanksione, formulimi ligjor dhe koordinimi me partnerë të tjerë janë po aq të rëndësishëm sa njoftimi politik, sepse përcaktojnë se çfarë ndryshon realisht për kompanitë dhe tregjet.',
'Për Kosovën dhe Shqipërinë, vendimet e BE-së kanë rëndësi për shkak të lidhjeve politike, energjetike dhe tregtare me hapësirën evropiane. Edhe kur një masë nuk zbatohet drejtpërdrejt në tregun lokal, ajo mund të ndikojë çmimet, rrugët e furnizimit dhe pritjet e bizneseve. Kjo e bën të domosdoshme ndarjen e analizës së tregut nga deklaratat e çastit.',
'Raporti nuk thotë se sanksionet do të prodhojnë menjëherë ndryshim në luftë ose në çmimet për konsumatorët. Rezultatet e masave kufizuese varen nga zbatimi, mbikëqyrja dhe përgjigjet e tregjeve. Nuk është e drejtë të nxirret nga një marrëveshje politike përfundimi se efekti ekonomik është tashmë i matur ose se të gjitha vendet do të reagojnë në të njëjtën mënyrë.',
'Hapi vijues është publikimi i tekstit përfundimtar dhe shpjegimet nga institucionet e BE-së mbi zbatimin. Aty do të shihet çfarë mbulohet, cilat afate vlejnë dhe si do të monitorohet masa. Deri atëherë, marrëveshja duhet parë si sinjal i vazhdimit të linjës evropiane ndaj luftës, jo si përmbyllje e debatit për energjinë dhe sigurinë.'))
A.append(article(7,
'https://www.bbc.co.uk/news/articles/cpw9xzx9r4ko?at_medium=RSS&at_campaign=rss',
'kercenimi-ne-det-te-kuq-ngre-shqetesime-per-rruget-e-naftes',
'Kërcënimi në Det të Kuq ngre shqetësime për rrugët e naftës',
'Houthit pretenduan sulm ndaj cisternave, ndërsa raportimi e lidh zhvillimin me goditje të tjera amerikane ndaj Iranit dhe me rrezikun për transportin detar.',
'Siguri',
'Pretendimi i Houthive për sulm ndaj cisternave në Detin e Kuq e rikthen vëmendjen te siguria e një prej korridoreve më të rëndësishme detare për energjinë dhe tregtinë. Raporti e lidh zhvillimin me sulme të mëtejshme amerikane ndaj Iranit dhe thotë se grupi i mbështetur nga Irani kishte shpallur një embargo detare ndaj Arabisë Saudite. Këto janë rrethana të raportuara në një situatë që mund të ndryshojë shpejt.',
'Pretendimi për sulm dhe njoftimi për embargo kërkojnë verifikim të pavarur për detajet e tyre operacionale. Në konflikte, palët shpesh publikojnë informacion për të krijuar presion ose për të sinjalizuar kapacitet. Ajo që mund të thuhet pa tejkalim është se rreziku i perceptuar për anijet dhe kompanitë e transportit ka pasoja të menjëhershme për planifikimin e rrugëve dhe sigurimet.',
'Për vendet importuese të energjisë, përfshirë tregjet e vogla të Ballkanit, pasiguria në korridoret detare mund të reflektohet te kostot e transportit dhe te pritjet për çmimet. Nuk do të thotë se çdo incident sjell rritje të drejtpërdrejtë në faturat lokale. Por tregjet reagojnë edhe ndaj rrezikut, sidomos kur tensioni prek zonat përmes të cilave kalojnë ngarkesa të mëdha të naftës.',
'Nuk ka në këtë raport një bilanc të pavarur të dëmeve, numër të konfirmuar të anijeve të goditura ose vlerësim për kohëzgjatjen e kërcënimit. Prandaj, artikulli nuk i paraqet pretendimet e palëve si fakte të pakontestueshme. Ndarja mes deklaratës së një grupi, konfirmimit nga autoritetet detare dhe të dhënave të gjurmimit të anijeve mbetet vendimtare.',
'Duhet ndjekur nëse autoritetet detare, kompanitë e sigurisë dhe qeveritë publikojnë konfirmime të pavarura ose ndryshime të këshillave për lundrim. Vetëm atëherë mund të vlerësohet shkalla e ndikimit. Për momentin, lajmi tregon një pikë të re tensioni në një zonë ku siguria detare ka pasoja më të gjera se kufijtë e konfliktit.'))
A.append(article(8,
'https://www.bbc.co.uk/news/articles/cvg9n2y61w6o?at_medium=RSS&at_campaign=rss',
'sulmet-ndaj-magazinave-vendosin-ne-presion-tregtine-ruse-online',
'Sulmet ndaj magazinave vendosin në presion tregtinë ruse online',
'Sulmet me dron ndaj magazinave të një shitësi të madh online në Rusi nxjerrin në pah cenueshmërinë e infrastrukturës civile dhe tregtare gjatë luftës.',
'Ekonomi',
'Sulmet ukrainase me dron ndaj disa magazinave të shitësit të madh online Wildberries kanë vënë nën presion një pjesë të infrastrukturës tregtare të Rusisë. Raportimi thekson se objektet janë goditur brenda pak ditësh. Përtej ngjarjes ushtarake, kjo tregon se lufta mund të prekë zinxhirët e furnizimit, depozitimin dhe shërbimet që përdoren nga qytetarët e zakonshëm.',
'Fakti qendror në raport është goditja e magazinave të kompanisë. Nuk janë dhënë në përmbledhjen e disponueshme të dhëna të plota për ndërprerje porosish, humbje financiare ose rikthim të kapaciteteve. Kjo kërkon kujdes: dëmtimi fizik i një objekti nuk tregon automatikisht shkallën e ndikimit në të gjithë tregtinë online ose në ekonominë ruse.',
'Rasti ka rëndësi më të gjerë sepse platformat e tregtisë elektronike varen nga qendra logjistike të përqendruara. Kur një depo ndërpritet, ndikimi mund të shtrihet nga punëtorët dhe shitësit te konsumatorët, transportuesit dhe furnizuesit. Konflikti po e zhvendos kështu rrezikun edhe te sektori civil, ku funksionimi i përditshëm i shërbimeve lidhet me sigurinë e rrjetit fizik.',
'Artikulli nuk e përdor rastin për të nxjerrë përfundim mbi kapacitetin e përgjithshëm ekonomik të Rusisë. Një seri sulmesh mund të jetë domethënëse lokalisht, por pasojat kombëtare kërkojnë të dhëna për volum, sigurime, riparime dhe alternativat logjistike. Është po ashtu e nevojshme të dallohen raportimet e konfirmuara nga deklaratat e palëve në luftë.',
'Zhvillimi që duhet ndjekur është nëse kompania, autoritetet ose klientët raportojnë ndërprerje të zgjatura dhe nëse sulmet vazhdojnë drejt objekteve të tjera të ngjashme. Kjo do të ndihmonte të kuptohet nëse kemi të bëjmë me incident të kufizuar apo me presion sistematik ndaj logjistikës civile. Për momentin, rasti është shembull i lidhjes mes konfliktit dhe ekonomisë së përditshme.'))
A.append(article(9,
'https://www.france24.com/en/europe/20260723-wildfires-ravage-spain-france-and-italy-killing-three-firefighters',
'zjarret-ne-evropen-jugore-shkaktojne-viktima-dhe-evakuime',
'Zjarret në Evropën jugore shkaktojnë viktima dhe evakuime',
'Zjarret në Spanjë, Francë dhe Itali vranë tre zjarrfikës dhe detyruan mijëra banorë të largohen, ndërsa temperaturat e larta dhe thatësira ushqyen flakët.',
'Shqëri',
'Zjarret e mëdha në pjesë të Spanjës, Francës dhe Italisë kanë shkaktuar vdekjen e tre zjarrfikësve dhe kanë detyruar mijëra njerëz të evakuohen. Raportimi i së enjtes e lidh përhapjen me temperaturat e larta dhe kushtet e thata, ndërsa ekipet e shpëtimit po përballen me dhjetëra vatra. Ky është një zhvillim humanitar dhe i sigurisë publike, jo vetëm një statistikë meteorologjike.',
'Burimi raporton për zjarre në Siçili, jugperëndim të Francës dhe Spanjën qendrore. Përmasat e sakta të dëmit, numri përfundimtar i të evakuuarve dhe gjendja e çdo vatre mund të ndryshojnë me operacionet në terren. Prandaj, shifrat duhet lexuar si gjendje e momentit dhe jo si bilanc përfundimtar i sezonit.',
'Për Kosovën, Shqipërinë dhe rajonin, lajmi ka rëndësi sepse nxehtësia ekstreme dhe zjarret janë rreziqe të njohura sezonale. Mësimi praktik nuk është të bëhet krahasim i drejtpërdrejtë mes vendeve, por të vërehet sa vendimtare janë paralajmërimi i hershëm, qasja në terren, uji, komunikimi me banorët dhe mbrojtja e ekipeve. Zjarret ndërkufitare kërkojnë gjithashtu koordinim që nuk mund të improvizohet në ditën e krizës.',
'Raporti nuk i atribuon zjarret një shkaku të vetëm dhe nuk ofron ende hetime për çdo vatër. Lidhja mes temperaturave, thatësirës dhe rrezikut është e qartë në përshkrimin e situatës, por shkaku konkret i një zjarri mund të jetë tjetër dhe duhet të përcaktohet nga autoritetet. Kjo pengon përhapjen e pretendimeve të pakontrolluara në një moment të ndjeshëm.',
'Vëmendja duhet të jetë te urdhrat zyrtarë të evakuimit, gjendja e zjarrfikësve dhe njoftimet për rrugët e mbyllura. Për banorët dhe udhëtarët, informacioni operacional vlen më shumë se pamjet dramatike. Për rajonin, ngjarja është kujtesë se përgatitja ndaj vapës dhe zjarreve është çështje e sigurisë së përditshme dhe jo temë që mund të shtyhet deri në kulmin e sezonit.'))
A.append(article(10,
'https://www.france24.com/en/europe/20260722-ukrainians-welcome-new-army-chief-but-seek-return-of-fired-defence-minister',
'ndryshimi-ne-komanden-ukrainase-shoqerohet-me-kerkesa-per-sqarim',
'Ndryshimi në komandën ukrainase shoqërohet me kërkesa për sqarim',
'Emërimi i një shefi të ri të ushtrisë u prit pozitivisht nga disa ukrainas, por raportimi tregon se largimi i ministrit të Mbrojtjes vazhdon të nxisë pakënaqësi.',
'Botë',
'Emërimi i Mykhailo Drapaty si shef i ri i ushtrisë ukrainase është pritur pozitivisht nga disa ushtarë dhe qytetarë, por raportimi tregon se pakënaqësia për largimin e ministrit të Mbrojtjes Mykhailo Fedorov vazhdon. Kjo e bën zhvillimin më shumë se ndryshim personeli: ai hap pyetje për besimin publik, mënyrën e komunikimit të vendimeve dhe raportin mes udhëheqjes civile e asaj ushtarake gjatë luftës.',
'Burimi raporton se largimi i Fedorov shkaktoi protestat më të mëdha të lidhura me luftën që nga pushtimi rus i vitit 2022. Ky përshkrim i jep ngjarjes dimension publik, por nuk zëvendëson rezultatet e një procesi institucional. Emërimi i një komandanti të ri mund të prekë organizimin e forcave, ndërsa reagimi ndaj largimit të një ministri lidhet me llogaridhënien politike.',
'Për vendet evropiane që mbështesin Ukrainën, stabiliteti i institucioneve ukrainase është pjesë e vlerësimit të qëndrueshmërisë së saj. Ndryshimet në drejtim mund të jenë të zakonshme në luftë, por transparenca rreth arsyeve dhe pasojave ndihmon të ruhet besimi. Kjo është e rëndësishme edhe për publikun në Ballkan, ku siguria evropiane dhe mbështetja ndërkombëtare ndaj Ukrainës ndjekin zhvillimet e brendshme po aq sa frontin.',
'Raporti nuk sugjeron se emërimi i ri zgjidh automatikisht tensionin politik ose ndryshon situatën ushtarake. Nuk jepen objektiva të rinj operativë, plan reformash apo afat për adresimin e kërkesave të protestuesve. Çdo vlerësim për efektin e ndryshimeve duhet të mbështetet te vendimet që pasojnë, jo vetëm te reagimi i ditës së parë.',
'Tani duhet ndjekur nëse qeveria ukrainase jep shpjegime më të hollësishme për largimin e ministrit dhe nëse komandanti i ri paraqet prioritete publike. Këto do të tregojnë nëse ndryshimi shoqërohet me qartësi institucionale. Deri atëherë, lajmi pasqyron dy procese që ecin paralelisht: pritjen për drejtimin e ri ushtarak dhe kërkesën qytetare për përgjigje politike.'))
A.append(article(11,
'https://www.theguardian.com/global-development/2026/jul/21/healthy-diet-too-expensive-for-one-in-three-people-globally-un-report-finds',
'raporti-i-okb-se-ngre-alarm-per-koston-e-ushqimit-te-shendetshem',
'Raporti i OKB-së ngre alarm për koston e ushqimit të shëndetshëm',
'Një raport i cituar nga media thotë se 2.69 miliardë njerëz nuk mund të përballojnë një dietë të larmishme dhe ushqyese, duke e kthyer çmimin e ushqimit në çështje globale.',
'Ekonomi',
'Një raport i ri i agjencive të OKB-së, i cituar nga media, vlerëson se 2.69 miliardë njerëz nuk mund të përballojnë një dietë të larmishme që plotëson nevojat për energji dhe lëndë ushqyese. Sipas raportimit, një në tre persona përballet me pamundësi për të përballuar ushqim të shëndetshëm. Kjo e zhvendos diskutimin nga sasia e kalorive te cilësia dhe qasja reale në fruta, perime, bulmet dhe produkte të tjera.',
'Burimi thotë se uria globale ra për të tretin vit radhazi në vitin 2025, por paralajmëron se kostoja e ushqimit të shëndetshëm kërkon veprim urgjent. Këto dy të dhëna nuk kundërshtojnë njëra-tjetrën: një përmirësim në një tregues nuk do të thotë se familjet mund të blejnë dietë të balancuar. Për politika publike, dallimi është i rëndësishëm sepse cilësia ushqimore lidhet me shëndetin afatgjatë dhe pabarazinë.',
'Për familjet në Kosovë dhe Shqipëri, debati është i kuptueshëm përmes shportës së përditshme. Kur çmimet e produkteve të freskëta, proteinave ose bulmetit rriten më shpejt se të ardhurat, zgjedhja ushqimore bëhet çështje buxheti. Raporti global nuk është statistikë specifike për Kosovën, por ofron kontekst për të pyetur se si maten përballueshmëria dhe ushqyerja e shëndetshme në tregun lokal.',
'Nuk mund të nxirret nga kjo shifër një përfundim i drejtpërdrejtë për nivelin e varfërisë në secilin vend. Metodat, çmimet vendore dhe politikat sociale ndryshojnë. Raportimi nuk jep një normë të re për Kosovën ose Shqipërinë, ndaj artikulli nuk e paraqet problemin global si statistikë kombëtare. Krahasimet kërkojnë të dhëna zyrtare vendore dhe seri të njëjta metodologjike.',
'Hapi i dobishëm është publikimi i plotë i raportit dhe reagimet e institucioneve që merren me çmimet dhe sigurinë ushqimore. Në nivel familjar, informacioni duhet të shërbejë për debat mbi të ardhurat, furnizimin dhe politikat e ushqimit, jo për alarm pa zgjidhje. Mesazhi kryesor është se përballueshmëria e një diete të shëndetshme mbetet sfidë edhe kur tregues të tjerë globalë përmirësohen.'))
A.append(article(12,
'https://techcrunch.com/2026/07/22/servicenow-bets-40m-on-indian-firm-businessnext-at-700m-valuation-to-deepen-banking-ai-push/',
'investimi-ne-softuerin-bankare-shton-garen-per-ai-ne-financa',
'Investimi në softuerin bankar shton garën për AI në financa',
'Një investim prej 40 milionë dollarësh në një kompani indiane të softuerit bankar synon zgjerimin e përdorimit të AI-së në shërbimet financiare.',
'Teknologji',
'Një investim prej 40 milionë dollarësh në kompaninë indiane BusinessNext e vendos sërish sektorin bankar në qendër të garës për inteligjencën artificiale. Raportimi thotë se investimi i ServiceNow synon të zgjerojë praninë në shërbimet financiare dhe i jep kompanisë partnere një mbështetës për zgjerim global. Vlerësimi i përmendur prej 700 milionë dollarësh i përket marrëveshjes së raportuar, jo një garancie për rezultatet e saj.',
'Bankat po kërkojnë automatizim për procese që shkojnë nga shërbimi ndaj klientit te kontrolli i dokumenteve dhe menaxhimi i rrezikut. Por përdorimi i AI-së në këtë sektor kërkon standarde më të larta për privatësinë, shpjegueshmërinë dhe mbikëqyrjen njerëzore. Lajmi tregon interesin e tregut për këto mjete, jo se teknologjia i ka zgjidhur tashmë këto sfida rregullatore.',
'Për tregjet e Ballkanit, ku bankat po zgjerojnë shërbimet digjitale, marrëveshje të tilla janë sinjal për drejtimin e industrisë. Ato nuk do të thonë se një produkt specifik do të vijë në Kosovë ose Shqipëri, por rrisin presionin konkurrues që institucionet financiare të modernizojnë kanalet e tyre. Për klientin, pyetjet kryesore mbeten siguria e të dhënave, korrigjimi i gabimeve dhe qasja e barabartë në shërbime.',
'Raporti nuk paraqet kontrata të reja bankare në rajon, as rezultate të provuara nga përdorimi i produktit. Investimi nuk është i njëjtë me adoptimin masiv. Edhe kur zgjidhjet implementohen, rezultatet varen nga cilësia e të dhënave, integrimi me sistemet ekzistuese dhe rregullat e secilit vend. Prandaj, lajmi nuk duhet lexuar si premtim për transformim të menjëhershëm.',
'Duhet ndjekur se cilat produkte dhe tregje do të përfshihen pas investimit dhe nëse kompanitë publikojnë standarde për përdorimin e AI-së në banka. Për institucionet financiare lokale, fokusi duhet të jetë te përfitimi i matshëm dhe kontrolli, jo vetëm te etiketa e re teknologjike. Marrëveshja shënon drejtim strategjik, ndërsa ndikimi i saj do të varet nga zbatimi.'))
A.append(article(13,
'https://www.bbc.co.uk/news/articles/cj03r59z73po?at_medium=RSS&at_campaign=rss',
'marreveshja-berthamore-shba-arabi-saudite-hap-debat-per-energjine',
'Marrëveshja bërthamore SHBA-Arabi Saudite hap debat për energjinë',
'Një marrëveshje bashkëpunimi bërthamor për përdorim paqësor pritet t’u japë kompanive amerikane qasje në programin energjetik saudit, sipas Departamentit të Energjisë së SHBA-së.',
'Botë',
'Shtetet e Bashkuara dhe Arabia Saudite kanë nënshkruar një marrëveshje të madhe për bashkëpunim bërthamor, të cilën Departamenti amerikan i Energjisë e përshkruan si paqësore. Sipas raportimit, marrëveshja pritet t’u japë kompanive amerikane qasje të konsiderueshme në programin saudit të energjisë bërthamore. Kjo e bën lajmin relevant për politikën energjetike, biznesin dhe sigurinë rajonale.',
'Termi “paqësor” është formulimi i raportuar nga institucioni amerikan. Kuptimi praktik i marrëveshjes do të varet nga teksti, standardet e mbikëqyrjes, teknologjitë e lejuara dhe mekanizmat ndërkombëtarë të verifikimit. Energjia bërthamore mund të paraqitet si pjesë e diversifikimit energjetik, por çdo projekt kërkon transparencë të lartë për sigurinë, furnizimin dhe përgjegjësinë institucionale.',
'Për Evropën dhe Ballkanin, zhvillimet në Gjirin Persik kanë rëndësi për shkak të tregjeve globale të energjisë dhe lidhjes mes infrastrukturës, gjeopolitikës dhe investimeve. Marrëveshje të tilla mund të ndryshojnë aleancat tregtare dhe zinxhirët e furnizimit pa prekur menjëherë faturat ose projektet lokale. Leximi i kujdesshëm shmang idenë se çdo njoftim energjetik jashtë rajonit prodhon efekt të menjëhershëm në Kosovë.',
'Raportimi nuk paraqet një plan të plotë ndërtimi, numër reaktorësh, afate apo çmime. Nuk ka bazë për të vlerësuar nga ky njoftim se kur do të prodhohet energji ose cilat do të jenë pasojat afatgjata gjeopolitike. Marrëveshja mund të jetë kornizë bashkëpunimi, ndërsa projektet konkrete kërkojnë procedura, financim dhe vlerësime të ndara.',
'Çështjet që duhen ndjekur janë publikimi i kushteve, roli i agjencive ndërkombëtare dhe reagimet e partnerëve rajonalë. Këto do të përcaktojnë peshën reale të marrëveshjes. Për momentin, njoftimi është sinjal se energjia bërthamore po mbetet pjesë e konkurrencës strategjike dhe industriale, me kërkesa të larta për siguri dhe transparencë.'))

out = Path('data/auto-articles/2026-07-23T09.json')
out.write_text(json.dumps(A, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'wrote {len(A)} original Albanian articles to {out}')
