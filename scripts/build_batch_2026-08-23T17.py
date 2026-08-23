#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build 2026-08-23T17.json — verified direct-publisher batch (editorial writer: GPT-5.6 Terra)."""
import json

STAMP = "2026-08-23T17"
CREATED = "2026-08-23T17:35:00+02:00"

def art(idx, slug, url, title, excerpt, body, source, category, published_at,
        engagement_score, score_reason, breakdown, source_flag,
        image_url, image_width, image_height, tone="informues", featured=False):
    return {
        "id": f"383-{STAMP}-{idx:02d}",
        "slug": slug,
        "url": url,
        "dispatch": "cloud-news-discovery-current + direct publisher verification",
        "title": title,
        "excerpt": excerpt,
        "body": body,
        "source": source,
        "source_flag": source_flag,
        "source_bias": "neutral",
        "tone": tone,
        "category": category,
        "published_at": published_at,
        "featured": featured,
        "engagement_score": engagement_score,
        "score_reason": score_reason,
        "score_breakdown": {
            "relevance": breakdown[0], "urgency": breakdown[1],
            "public_impact": breakdown[2], "local_depth": breakdown[3],
            "controversy_interest": breakdown[4], "credibility": breakdown[5],
            "corroboration": breakdown[6], "editorial_safety": breakdown[7],
        },
        "score_formula": "weighted editorial ranking",
        "reading_time": 2,
        "image_url": image_url,
        "image_width": image_width,
        "image_height": image_height,
        "created_at": CREATED,
    }

articles = []

# 1. Kosovo — US court overturns immigrant-visa suspension (BGNES)
articles.append(art(
    1, "gjykata-us-heq-ndalimin-e-vizave-emigrante-per-75-vende-ne-to-kosova",
    "https://www.bgnes.com/society/us-court-overturns-suspension-of-immigrant-visa-processing-for-75-countries-including-kosovo-and-bosnia-and-herzegovina",
    "Gjykata amerikane e kthen pas ndalimin e vizave emigrante për 75 vende, përfshirë Kosovën dhe Shqipërinë",
    "Gjyqtarja Jeanette Vargas e shpalli të paligjshme vendimin e janarit dhe vlerësoi se sekretari i shtetit Marco Rubio e ka tejkaluar autoritetin e tij.",
    "<p>Një gjykatë federale amerikane e ka rrëzuar ndalimin e procesimit të aplikimeve për viza emigrimi për qytetarët e 75 vendeve, një listë ku bënin pjesë Kosova, Shqipëria, Maqedonia e Veriut, Mali i Zi dhe Bosnja e Hercegovina. Vendimin ka marrë gjyqtarja Jeanette Vargas e Gjykatës Distriktore të SHBA-së për Jugun e Nju Jorkut, e cila e ka vlerësuar masën si «të paligjshme», raporton agjencia BGNES.</p>"
    "<p>Masa kishte hyrë në fuqi në janar dhe kishte suspenduar procesimin e aplikimeve për viza emigrimi për shtetasit e vendeve përkatëse. Departamenti i Shtetit e kishte justifikuar vendimin me pretendimin se emigrantët nga këto vende marrin një «nivel të papranueshëm të përfitimeve sociale» nga taksapaguesit amerikanë dhe se masa do të mbetej në fuqi derisa Uashingtoni të sigurohej se të ardhurit e rinj nuk do ta abuzonin sistemin e mirëqenies.</p>"
    "<p>Sipas vendimit, sekretari i shtetit Marco Rubio e ka tejkaluar autoritetin e tij me miratimin e ndalimit. Gjyqtarja Vargas konstatoi se funksionarët konsullorë ishin udhëzuar në mënyrë të paligjshme që t'u mohojnë visat aplikantëve vetëm në bazë të vendit të origjinës — praktikë që bie ndesh me ligjin për imigracion.</p>"
    "<p>Visat emigrante janë ato aplikime që çojnë drejt statusit të banorit të përhershëm në Shtetet e Bashkuara, ndërkohë që vendimi i gjykatës i referohet vetëm procesimit të tyre dhe jo masave të tjera konsullore të administratës.</p>"
    "<p>Para hyrjes në fuqi të masës, më 4 janar, presidenti Donald Trump kishte publikuar në Truth Social një listë vendesh, ku sipas postimit të tij 46% e imigrantëve nga Kosova në SHBA merrnin përfitime sociale — një shifër e cituar atëherë nga administrata amerikane, por e pakonfirmuar nga burime të pavarura statistikore.</p>"
    "<p>Lista e plotë e vendeve të prekura përfshinte gjithashtu Afganistanin, Egjiptin, Brazilin, Irakun, Nigerinë, Somalinë, Tajlandën dhe Jemenin, sipas burimeve të cituara nga Radio Evropa e Lirë në raportimin e BGNES. Gjatë fushatës për mandatin e dytë, Trump kishte vendosur deportimet dhe kufizimin e imigracionit në qendër të programit të tij. Për mijëra qytetarë të Kosovës dhe Shqipërisë me dosje aktuale pranë ambasadave amerikane, vendimi hap perspektivën e vazhdimit të procedurave sipas rregullave të mëparshme, pas disa muajsh ndalimi të plotë.</p>",
    "BGNES", "Kosovo", "2026-08-23T12:39:00+02:00",
    8.4,
    "Vendim gjykate amerikane që i rikthen procesimet e vizave emigrante qytetarëve të Kosovës e Shqipërisë, i dokumentuar sot nga botuesi direkt me detajet e aktgjykimit.",
    (9, 7, 9, 9, 7, 8, 7, 8), "🇽🇰",
    "https://www.bgnes.com/static/images/news/2026/08/23/21641/1280X720-19820.webp", 1280, 720,
    featured=True))

# 2. Botë — Zelensky rejects wartime elections (Al Jazeera/AFP/Reuters)
articles.append(art(
    2, "zelenski-zgjedhjet-gate-luftes-do-te-ishin-cunami-qe-do-ta-ndante-ukrainen",
    "https://www.aljazeera.com/news/2026/8/23/zelenskyy-says-wartime-elections-could-destroy-ukraine",
    "Zelenski: Zgjedhjet gjatë luftës do të ishin «cunami» që do ta ndante Ukrainën",
    "Presidenti ukrainas i është përgjigjur thirrjes së ish-ministrit të Mbrojtjes Mihailo Fedorov, duke e quajtur votimin në kohë lufte risk i madh për vendin.",
    "<p>Presidenti i Ukrainës, Volodimir Zelenski, e ka refuzuar thirrjen e ish-ministrit të Mbrojtjes për organizimin e zgjedhjeve gjatë luftës, duke e quajtur votimin në kohë lufte një «risk të madh» dhe një «cunami për vendin që do ta ndante Ukrainën», raportojnë Al Jazeera, AFP dhe Reuters me komentet e presidentit të publikuara të dielën. Ai foli të shtunën gjatë një briefingje të gjerë me gazetarët, ndërsa deklaratat u bënë publike nesër.</p>"
    "<p>Ligji ukrainas ia ndalon zgjedhjet ndërkohë që vendi është në gjendje lufte — normë që nuk ishte sfiduar publikisht derisa Mihailo Fedorov, ministri i Mbrojtjes i shkarkuar në korrik, kërkoi javën e kaluar organizimin e një votimi. Fedorovi, 35 vjeç dhe një figurë popullore në vend, e mbajti postin vetëm gjashtë muaj, ndërsa shkarkimi i tij u pasua me protesta në qytete ukrainase.</p>"
    "<p>Të martën ish-ministri publikoi një video nëntë-minutëshe në YouTube, ku tha se demokracia ukrainase «nuk mund të merret peng nga Rusia». «A mundet Rusija të përcaktojë se kur ukrainasit mund t'i zgjedhin autoritetet e tyre herën tjetër? Unë jam i sigurt se jo», tha ai, duke folur për një «krizë sistemike të qeverisjes» në vend.</p>"
    "<p>«Besoj se në një luftë si kjo, zgjedhjet si të tilla janë një risk i madh. Zgjedhjet tani janë një cunami për vendin që do ta ndante Ukrainën», tha Zelenski. «Nëse duam ta shkatërrojmë vendin, mund të ecim drejt zgjedhjeve gjatë kohës së luftës», shtoi ai. Sipas një sondazhi të Institutit të Sociologjisë së Kyivit të cituar nga France 24, vetëm 15% e të anketuarve duan zgjedhje në këtë moment.</p>"
    "<p>Ekspertët e cituar nga Al Jazeera vlerësojnë se një votim gjatë luftës do të ishte praktikisht i pamundur për shkak të sfidave logistike dhe të sigurisë, nga milionat e personave të zhvendosur te fronti aktiv — një realitet me të cilin, sipas mediave, pajtohet shumica e qytetarëve ukrainas. Në këto kushte, thirrja e Fedorovit mbetet për momentin një sfidë politike brenda vendit dhe jo një perspektivë elektorale reale.</p>",
    "Al Jazeera", "Botë", "2026-08-23T14:19:00+02:00",
    8.1,
    "Zhvillim politik i madh në frontin më të ndjekur global: refuzimi i zgjedhjeve të kohës së luftës nga presidenti Zelenski dhe konflikti i hapur me ish-ministrin e Mbrojtjes.",
    (9, 8, 8, 4, 8, 9, 9, 9), "🌐",
    "https://www.aljazeera.com/wp-content/uploads/2026/08/reuters_6a8acc62-1787481186.jpg?resize=1920%2C1440", 1920, 1440))

# 3. Politikë — Rama's delegate meeting in Pogradec (Euronews Albania)
articles.append(art(
    3, "rama-mblidh-te-deleguarit-socialiste-ne-pogradec-besa-shkrirja-e-bashkive-dhe-2027",
    "https://euronews.al/dalin-pamjet-nga-takimi-i-rames-me-te-deleguarit-politike-ne-pogradec-video/",
    "Rama mban takim me të deleguarit socialistë në Pogradec, diskutohet Besa, shkrirja e bashkive dhe 2027-a",
    "Kryeministri u ka kërkuar drejtuesve politikë të fillojnë të mendojnë për emrat e zgjedhjeve lokale të 2027-ës dhe më tepër prani në komunitet, sipas burimeve që citon reportazhi.",
    "<p>Kryetari i Partisë Socialiste dhe kryeministër Edi Rama i ka mbajtur sot takimin e deleguarëve politikë dhe kryetarëve socialistë të komisioneve parlamentare në Pogradec, dhe janë publikuar pamjet e zhvillimit, transmeton Euronews Albania. Në to shfaqen momente nga diskutimet, ndarja e opinioneve dhe reflektimet e disa pjesëmarrësve mbi dokumentet «Besa» dhe «Prania Besnike». Formati i deleguarëve politikë është ai i përfaqësuesve të partisë në bazë, të mbledhur zakonisht para cikleve të rëndësishme politike.</p>"
    "<p>Sipas burimeve të cituara nga media, gjatë fjalës së tij Rama ka kërkuar që të lexohen të dy dokumentet dhe është diskutuar edhe skema e shkrirjes së bashkive. Kryeministri i ka pyetur drejtuesit politikë të atyre bashkive ku flitet për shkrirje pse ka patur revoltë me partinë dhe u ka kërkuar t'u shpjegojnë qytetarëve se ky proces do të sillte më shumë shërbime dhe më shpejt.</p>"
    "<p>Rama mësohet gjithashtu se u ka kërkuar drejtuesve politikë të fillojnë të mendojnë për emrat e zgjedhjeve lokale të vitit 2027, duke kërkuar emra e figura më afër komunitetit. Ai është ndalur veçmas tek dokumenti «Besa», ku ka shprehur se ai duhet t'u shpërndahet jo vetëm deputetëve, por edhe kryetarëve të bashkive dhe kryetarëve të partive përkatëse, që të gjithë të njihen me përmbajtjen e tij.</p>"
    "<p>Kryeministri u ka kërkuar drejtuesve politikë më tepër prani në komunitet, ndërsa kryetarëve të komisioneve parlamentare më tepër aktivizim në media dhe më kujdes në mënyrën se si ligjet i përcillen drejt publikut. Takimi i të dielës vjen ndërsa tema e shkrirjes së bashkive ka zënë vend në debatin publik javën e fundit, me kryebashkiakë e struktura vendore që kanë shprehur rezerva.</p>"
    "<p>Pamjet e publikuara e dokumentojnë formatin e punës të socialistëve para ciklit legjislativ të vjeshtës: dokumente programore që u lexohen deleguarëve, diskutime mbi qeverisjen vendore dhe nisja e përgatitjes për garën elektorale të 2027-ës, që pritet të jetë testi i parë i madh pas çdo riorganizimi territorial.</p>"
    "<p>Nëse skema e shkrirjes do të përfundonte në një reformë territoriale zyrtare, ajo do të prekte drejtpërdrejtë administratën vendore dhe buxhetet e bashkive pak para ciklit zgjedhor të ardhshëm — një nga arsyet pse tema ka nxitur reagime brenda vetë partisë.</p>",
    "Euronews Albania", "Politikë", "2026-08-23T16:00:58+02:00",
    8.0,
    "Takim i brendshëm i kryeministrit Rama me strukturat e partisë në Pogradec, me dokumente programore dhe agjendën e zgjedhjeve të 2027-ës; lajm aktual i ditës me interes të drejtë për qytetarët.",
    (8, 8, 7, 8, 7, 8, 6, 8), "🇦🇱",
    "https://euronews.al/wp-content/uploads/2026/08/Screenshot_25.png", 1191, 885))

# 4. Sport — Harry Kane German footballer of the year (BBC Sport)
articles.append(art(
    4, "harry-kane-futbollisti-i-vitit-ne-gjermani-anglezi-i-pare-ne-histori",
    "https://www.bbc.co.uk/sport/football/articles/c4g4g83v25yo",
    "Harry Kane shpallet futbollisti i vitit në Gjermani, anglezi i parë në histori i çmimit",
    "Sulmuesi i Bayern Munich mori 272 vota nga anëtarët e shoqatës së gazetarëve sportive gjermanë, teksa Michael Olise u rendit i dyti me 203 vota.",
    "<p>Sulmuesi i Bayern Munich, Harry Kane, është votuar futbollisti i vitit 2026 në Gjermani dhe bëhet anglezi i parë në histori që fiton këtë çmim, njofton BBC Sport. Votimin e organizon revista gjermane Kicker, ndërsa të drejtë vote kanë 695 anëtarë të shoqatës së gazetarëve sportive gjermanë.</p>"
    "<p>Kane mori 272 vota dhe u nda qartë nga shoku i skuadrës Michael Olise, i dyti me 203 vota — i njëjti vend që francezi e zuri edhe vitin e kaluar, kur u rendit pas Florian Wirtzit. Sipas rregullave të çmimit, për të mund të votohen lojtarë të Bundesligës ose futbollistë gjermanë që luajnë jashtë vendit.</p>"
    "<p>Stinori i 33-vjeçarit ishte i jashtëzakonshëm: 61 gola në të gjitha garat, titulli i Bundesligës, Kupa e Gjermanisë dhe gjysmëfinalja e Ligës së Kampionëve me Bayern Munich. BBC thekson se Kane ka qenë golashënuesi më i mirë i Bundesligës në secilën prej tre stinorëve të tij te klubi bavarez, ndërsa roli i tij si kapiten i Anglisë i shton peshë simbolike njohjes.</p>"
    "<p>Çmimi i gazetarëve gjermanë konsiderohet një nga dallimet më tradicionale kombëtare në futbollin evropian dhe për herë të parë në historinë e tij shkon te një lojtar anglez. Fitorja vjen në vitin kur Bayern Munich u rikthye në krye të futbollit gjerman, me anglezin si referencën sulmuese të skuadrës dhe autorin e pjesës më të madhe të golave vendimtare.</p>"
    "<p>Kane e ka nisur aventurën gjermane në verën e 2023-s dhe u vendos menjëherë në krye të listës së golashënuesve të Bundesligës, pozicion që e ka ruajtur në secilën stinorë. Kjo qëndrueshmëri është edhe argumenti kryesor me të cilin gazetarët gjermanë e justifikuan zgjedhjen e tij për dallimin e vitit.</p>"
    "<p>Aktualisht Kane vazhdon të jetë golashënuesi kryesor i Bayern Munich në fillimet e sezonit të ri të Bundesligës. Njohja nga gazetarët gjermanë vjen edhe si mirënjohje për qëndrueshmërinë e tij: tre stinore radhazi në krye të listës të golashënuesve janë një arritje e rrallë në futbollin modern evropian dhe e forcojnë statusin e anglezit si një nga sulmuesit më produktivë të dekadës.</p>",
    "BBC Sport", "Sport", "2026-08-23T16:16:00+02:00",
    7.9,
    "Rekord historik i dokumentuar: anglezi i parë fiton çmimin e futbollistit të vitit në Gjermani, me sezon 61-golësh dhe dyfishin kampionat-kupë; rezultat zyrtar i votimit të Kicker.",
    (8, 6, 7, 5, 6, 9, 8, 10), "⚽",
    "https://ichef.bbci.co.uk/ace/branded_sport/1200/cpsprodpb/971e/live/f5c72370-9ef9-11f1-aed4-af6fe65bfcd6.jpg", 1200, 675))

# 5. Ekonomi — lek deposits cross 50% (Euronews Albania)
articles.append(art(
    5, "depozitat-ne-lek-kalojne-50-per-qind-te-totalit-por-hera-e-pare-ne-dekade",
    "https://euronews.al/frika-nga-kursi-shqiptaret-i-kthejne-kursimet-ne-lek/",
    "Depozitat në lek kalojnë pragun 50% për herë të parë në dekadë, shqiptarët i largohen euros",
    "Sipas të dhënave të Bankës së Shqipërisë, depozitat në lek janë rritur 13.5% brenda një viti, ndërsa ato në valutë 10.5%.",
    "<p>Shqiptarët po ia kthejnë kursimet monedhës vendase: depozitat në lek zënë për herë të parë në dekadën e fundit rreth 50.1% të totalit, sipas të dhënave të Bankës së Shqipërisë të raportuara të dielën nga Euronews Albania. Zhvlerësimi i euros ndaj lekut po e ndryshon vendimmarrjen e qytetarëve se ku t'i mbajnë paratë e kursimit.</p>"
    "<p>Brenda një viti, depozitat në lek janë rritur me 13.5%, ndërsa ato në valutë me 10.5%. Banka centrale i lidh ritmet e ndryshme me ndërmjetësimin financiar më të thelluar në monedhën vendase nga ana e bankave, zgjerimin e ofertës monetare në lek dhe prirjen e vazhdueshme të agjentëve ekonomikë për t'i mbajtur ose investuar kursimet përmes sistemit bankar.</p>"
    "<p>Zgjerimi vjetor i depozitave në valutë është mbështetur kryesisht nga kontributi më i lartë i depozitave të bizneseve, në linjë me rritjen e aktivitetit turistik dhe hyrjet e valutës në vend. Megjithatë, prej më shumë se një viti depozitat në lek po rriten më shpejt se ato në valutë, duke e zhvendosur strukturën e kursimeve në favor të lekut.</p>"
    "<p>Pragu 50% ka vlerë simbolike për politikat e de-eurolizimit që Banka e Shqipërisë nxit prej vitesh. Për familjet, zhvendosja vjen edhe si mbrojtje natyrale nga luhatjet e kursit, pasi pagat, qiratë dhe shpenzimet e përditshme paguhet kryesisht në lek; për bizneset, ajo thjeshton planifikimin e investimeve dhe të furnizimeve brenda vendit.</p>"
    "<p>Të dhënat vijnë në një moment kur euro ka humbur peshë ndaj lekut për disa vite radhazi dhe ka bërë monedhën evropiane më pak atraktive për kursim, ndërsa ritmi i fortë i depozitave në valutë mbetet i lidhur me sezonin turistik dhe hyrjet nga jashtë. Balanci midis dy monedhave pritet të mbetet temë kyçe e politikës monetare, pasi struktura e kursimeve ndikon drejtëpërdrejtë në likuiditetin e bankave dhe në koston e kreditimit.</p>"
    "<p>Kjo është hera e parë që nga viti 2016 kur struktura e kursimeve kalon në shumicë të lekut, duke e kthyer monedhën vendase në standardin e ri të referencës për bankat dhe për politikën monetare të vendit.</p>",
    "Euronews Albania", "Ekonomi", "2026-08-23T16:34:13+02:00",
    7.8,
    "Të dhëna zyrtare të Bankës së Shqipërisë: depozitat në lek kalojnë 50% të totalit për herë të parë në dekadë — pikë kthese reale për kursimet e familjeve shqiptare.",
    (8, 6, 8, 8, 5, 9, 7, 9), "🇦🇱",
    "https://euronews.al/wp-content/uploads/2026/08/Screenshot_36-2.jpg", 1307, 743))

# 6. Ekonomi — Bitcoin near $80K, biggest rally of 2026 (The Crypto Times)
articles.append(art(
    6, "bitkoini-i-qaset-80-mije-dollarve-ne-ralline-me-te-madhe-te-2026-es",
    "https://www.cryptotimes.io/2026/08/23/mstr-coin-circle-surge-as-bitcoin-nears-80k-in-biggest-rally-of-2026/",
    "Bitcoin-i i qaset 80 mijë dollarëve në rallinë më të madhe të 2026-s, aksionet kripto shënojnë javën më të fortë",
    "Likuiditeti makro, rregullat e reja të SEC-s dhe shtyrja për CLARITY Act sollën 2.75 miliardë dollarë likuidime pozicionesh bearish dhe 517 milionë dollarë hyrje në ETF-të e Bitcoin-it.",
    "<p>Bitcoin-i po i qaset pragut 80 mijë dollarësh në rallinë më të madhe të vitit 2026, ndërsa aksionet e lidhura me kriptomonedhat regjistrojnë javën më të fortë kolektive që nga fundi i 2024-ës, raporton The Crypto Times. Pas një vere të kaluar mes 60 dhe 70 mijë dollarëve, monedha e ka theluar tavën vjetore brenda pak ditësh.</p>"
    "<p>Shkaktari kryesor ishte makro: të mërkurën, më 19 gusht, Thesari amerikan njoftoi dyfishimin e shlyerjeve të obligacioneve afatgjata nga 2 në 4 miliardë dollarë për operacion, duke e ulur rendimentin 30-vjeçar nga maksimumi 19-vjeçar i 5.34% në 5.19% dhe duke i hapur rrugën aseteve me risk.</p>"
    "<p>Të njëjtën javë, kryetari i SEC-së, Paul Atkins, prezantoi kornizën «Regulation Crypto Assets», që përfshin një shteg sigurie prej 75 milionë dollarësh për lëshimin e tokeneve, ndërsa presidenti Donald Trump përdori një event në Shtëpinë e Bardhë për të kërkuar publikisht miratimin e CLARITY Act. Në dhomë ishin drejtuesi i Coinbase Brian Armstrong, bashkë-drejtuesi i Kraken Arjun Sethi dhe drejtuesi i Robinhood Vlad Tenev; Coinbase ka konfirmuar se votimi procedural i radhës për ligjin pritet më 15 shtator.</p>"
    "<p>Java u shënua edhe nga likuidime masive: deri në mbylljen e të enjtes, rreth 2.75 miliardë dollarë pozicione bearish ishin likuiduar brenda 24 orësh, ndërsa ETF-të amerikane spot për Bitcoin regjistruan hyrje neto prej 517.19 milionë dollarësh më 20 gusht — daily më e madhe në mbi tre muaj. Aksionet si MicroStrategy, Coinbase dhe Circle udhëhoqën sukseset e javës.</p>"
    "<p>Rritja erdhi pas një vere të pasigurt, gjatë së cilës Bitcoin-u luhati mes 60 dhe 70 mijë dollarëve dhe investitorët prisnin sinjalet e para të lehtësimit nga autoritetet amerikane. Kombinimi i rendimenteve në rënie me lajmet rregullatore e detyroi tregun ta ripriceshte riskun brenda pak ditësh.</p>"
    "<p>Për ndjekësit në Evropë dhe në rajon, kombinimi i lehtësimit monetar amerikan dhe i sqarimit rregulator cilësohet si themeli i rallisë: media e vlerëson javën 16–22 gusht si «pivot strukturor» për portofolet e lidhura me sektorin, me vëmendjen tashmë të drejtuar drejt votimit të shtatorit mbi CLARITY Act.</p>",
    "The Crypto Times", "Ekonomi", "2026-08-23T15:51:00+02:00",
    7.7,
    "Levizje e madhe e tregut të kriptomonedhave të dokumentuar me shifra: Bitcoin afër 80 mijë dollarëve, 2.75 miliardë dollarë likuidime dhe 517 milionë dollarë hyrje ditore në ETF — me CLARITY Act aktual.",
    (8, 7, 8, 4, 7, 7, 7, 9), "₿",
    "https://www.cryptotimes.io/wp-content/uploads/2026/08/MSTR-COIN-Circle-Surge-as-Bitcoin-Nears-80K-in-Biggest-Rally-of-2026.png", 1280, 720))

# 7. Ekonomi — Iran sanctions standoff (Euronews Albania)
articles.append(art(
    7, "irani-i-quan-deshperuese-sanksionet-e-reja-amerikane-thote-araghchi",
    "https://euronews.al/irani-sanksionet-e-reja-te-vendosura-nga-shba-ja-e-deshperuar-do-te-deshtojne/",
    "Irani i quan «dëshpëruese» sanksionet e reja amerikane, Araghchi premton se Teherani nuk dorëzohet",
    "Ministri i jashtëm Abbas Araghchi e hodhi poshtë kërcënimin e Scott Bessent për «sanksionet më të ashpra në histori», teksa bllokada e Hormuzit vazhdon ta mbajë naftën e shtrenjtë.",
    "<p>Ministri i jashtëm i Iranit, Abbas Araghchi, hodhi poshtë të dielën kërcënimin e sanksioneve të reja amerikane si «shenjë dëshpërimi» dhe tha se masat e pritura nuk do ta mposhtin Teheranin, raporton Euronews Albania. Sekretari i Thesarit të SHBA-së, Scott Bessent, kishte paralajmëruar «sanksionet më të ashpra në histori» ndaj Republikës Islame.</p>"
    "<p>Ekonomia iraniane është tashmë nën presion të madh nga sanksionet ndërkombëtare, ndërsa infrastruktura e saj është goditur vazhdimisht në sulmet ajrore që kur SHBA-ja dhe Izraeli nisën ofensivën më 28 shkurt. Sipas bilancit të cituar në raportim, mijëra persona kanë humbur jetën në këto sulme gjatë gati gjashtë muajve të luftës, ndërsa Teherani mbetet sfidues.</p>"
    "<p>Duke përshkruar ato që i quajti «skenarë të përsëritur», Araghchi tha në një video të postuar në Telegram se fakti që udhëheqja amerikane ka hequr dorë nga operacionet ushtarake për të kthyer «planet e vjetra» ekonomike tregon dëshpërimin e Uashingtonit. Mesazhi vjen ditë pas deklaratës së Bessent dhe pak para nisjes zyrtare të paketës së re të masave.</p>"
    "<p>Në terren, Irani e mban praktikisht të bllokuar Ngushticën e Hormuzit për tankerët e paautorizuar — rrugën ujore jetike për transportin global të naftës — gjë që, siç thekson raportimi, ka rritur çmimet globale të karburantit dhe ka bërë që transportuesit të shmangen rrugës për javë të tëra. Bllokada është kthyer në levën kryesore të presionit të Teheranit ndaj koalicionit që drejtohet nga Uashingtoni.</p>"
    "<p>Për Evropën dhe rajonin e Gjirit, qëndrimi i Iranit mbi Hormuzin mbetet faktori kryesor i rrezikut për furnizimin me energji dhe për inflacionin. Një valë e re sanksionesh, nëse do të miratohej siç paralajmërohet, do ta thellonte izolimin ekonomik të Iranit dhe do të shtonte presionin mbi aftësinë e Teheranit për të financuar strukturat e saj, por edhe tendosjen mes aleatëve të SHBA-së që kërkojnë një dalje diplomatike nga kriza. Përgjigja e Araghchit tregon se Teherani po e trajton konfrontimin ekonomik si pjesë të një lufte më të gjatë, ku sanksionet dhe bllokada detare funksionojnë si armë të kthyeshme.</p>",
    "Euronews Albania", "Ekonomi", "2026-08-23T16:03:53+02:00",
    7.6,
    "Përballim i drejtpërdrejtë Teheran–Uashington mbi sanksionet dhe Ngushticën e Hormuzit, me efekt të dokumentuar në çmimet e naftës; i raportuar sot nga botuesi direkt.",
    (7, 7, 8, 4, 7, 8, 7, 9), "🇮🇷",
    "https://euronews.al/wp-content/uploads/2026/08/Screenshot_34-2.jpg", 1102, 724))

# 8. Teknologji — humanoid robot breaks Bolt's record (Euronews Albania)
articles.append(art(
    8, "roboti-humanoid-kinez-vrapon-100-metra-ne-9-39-sekonda-thyen-rekordin-e-bolt",
    "https://euronews.al/roboti-humanoid-kinez-thyen-rekordin-boteror-te-usain-bolt-vrapoi-100-metra-per-9-39-sekonda/",
    "Roboti humanoid kinez vrapon 100 metra në 9.39 sekonda, thyen rekordbotërorin e Usain Bolt",
    "Humanoidi i Qendrës së Pekinit për Robotikë Humanoide e uli rekordbotërorin e xhamajanit nga 9.58 sekonda, në Lojërat Botërore të Robotëve Humanoide në Pekin.",
    "<p>Një robot humanoid i prodhuar nga Qendra e Pekinit për Robotikë Humanoide ka vrapuar 100 metra në 9.39 sekonda në Lojërat Botërore të Robotëve Humanoide të shtunën, duke e kaluar rekordbotërorin e Usain Bolt prej 9.58 sekondash, të vendosur në Olympiastadion të Berlinit më 2009, transmeton Euronews Albania.</p>"
    "<p>Organizatorët e lojërave e quajtën arritjen «sukses jashtëzakonisht mbresëlënës» në një postim në X, duke kujtuar se koha fituese e vitit të kaluar ishte 21.50 sekonda. «Vetëm brenda një viti, robotët konkurrues janë bërë dy herë më të shpejtë», shkruan ata, duke e cilësuar ritmin si provë e përparimit të robotikës kineze si në treg ashtu edhe në laborator.</p>"
    "<p>Lojërat po mbahen në stadiumin «Ice Ribbon» të Pekinit dhe i bashkojnë 666 ekipe me 2,056 robotë nga 16 vende, që garojnë në disiplina të ndryshme: atletikë, boks, futboll, ngritje pesha dhe gjimnastikë. Pamjet me humanoidët që bien në dyshekët e mëdhenj pas linjës së finishit janë bërë virale në rrjetet sociale gjatë ditëve të fundit, edhe pse organizatorët kërkojnë që publiku t'i vlerësojë arritjet me seriozitet.</p>"
    "<p>Pas skenës sportive, interesi ekonomik është masiv: Morgan Stanley Research vlerëson se tregu i robotëve humanoidë mund të arrijë në 5 trilionë dollarë deri në vitin 2050, me mbi një miliard robotë potencialisht në përdorim. Sipas raportit të bankës të cituar në raportim, vetëm Kina pritet të ketë rreth 302.3 milionë robotë të tillë.</p>"
    "<p>Kina e ka mbështetur fort industrinë e robotëve humanoidë me politika shtetërore e financime, dhe investitorët duket se i besojnë drejtimin: garat e këtij viti, të transmetuara gjerësisht, e kthyen Pekinin për një javë në skenën globale të teknologjisë, ndërsa prodhuesit garojnë për kohë që dikur dukej të paimagjinueshme për makineri.</p>"
    "<p>Pavarësisht spektaklit, organizatorët theksojnë se garat kanë funksion serioz testimi: çdo sekondë e fituar mbi pistën mat përparimet reale të motorëve, të materialit dhe të inteligjencës artificiale që i kontrollojnë robotët — të dhëna që prodhuesit i përdorin pastaj për modelet komerciale.</p>",
    "Euronews Albania", "Teknologji", "2026-08-23T15:40:18+02:00",
    7.5,
    "Arritje teknologjike me jehondë globale: humanoidi kinez e kalon rekordbotërorin e Bolt-it në garë zyrtare, me statistika të dokumentuara të eventit dhe projeksione të tregut nga Morgan Stanley.",
    (8, 6, 7, 4, 8, 8, 7, 10), "🤖",
    "https://euronews.al/wp-content/uploads/2026/08/Screenshot_33-2.jpg", 1307, 743))

# 9. Botë — CrossCountry cancels almost all services (BBC News / The Guardian)
articles.append(art(
    9, "crosscountry-anulon-pothejse-te-gjitha-sherbimet-hekurudhore-ne-mbreterine-e-bashkuar",
    "https://www.bbc.co.uk/news/articles/cy9w9y0lz5go",
    "CrossCountry anulon pothuajse të gjitha trenat në Britani pas ndërprerjes së energjisë në qendrën e kontrollit",
    "Operatori i cilësuar më i keqi i hekurudhës britanike e përshkruan situatën si «ndërprerje të rëndë dhe të paparë», ndërsa sekretarja e Transportit ka kërkuar shërbime shtesë nga operatorët.",
    "<p>Operatori hekurudhor britanik CrossCountry ka anuluar të dielën pothuajse të gjitha shërbimet e tij në Mbretërinë e Bashkuar, pasi një ndërprerje energjie në Birmingham e la jashtë funksionimit qendrën e kontrollit, raportojnë BBC News dhe The Guardian. Shumica e linjave mbeten të pezulluara «derisa të njoftohet ndryshe».</p>"
    "<p>Ndarja e rrymës nisi të shtunën dhe, si pasojë, shumë prej sistemeve që përdoren për menaxhimin e hekurudhës janë të papërdorshme, tha operatori. Anulimet prekin shumicën e rrugëve, nga Glasgow në Penzance dhe nga Leeds në Manchester, ndërsa The Guardian renditon mes shërbimeve të ndalura edhe linjat Manchester–Birmingham, Cheltenham–Cardiff dhe Newcastle–Edinburgh.</p>"
    "<p>Sekretarja e Transportit, Heidi Alexander, tha se ishte «e shqetësuar të mësonte për ndërprerjen» dhe ka kërkuar nga operatorët e shtetit që të vendosin «shërbime shtesë ku të jetë e mundur». «Kemi dërguar gjithashtu ekipet e energjisë të Network Rail, të cilat janë në vendin e ngjarjes dhe po punojnë për të rikthyer rrymën dhe sistemet sa më shpejt», shtoi ajo.</p>"
    "<p>Kompania e cilësoi situatën «ndërprerje të rëndë dhe të paparë». BBC kujton se CrossCountry u vlerësua në qershor si operatori më i keq i hekurudhës britanike, ndërsa udhëtarët po shprehin zemërim në rrjetet sociale, duke e quajtur kolapsin «skenarin më të keq të mundshëm» për udhëtimet e fundit të verës.</p>"
    "<p>Incidenti, i dokumentuar në të njëjtën ditë nga dy botues kryesorë, e ringjall debatin britanik mbi rezistencën e infrastrukturës kritike ndaj avariye të energjisë dhe mbi performancën e operatorëve të linjave të gjata. CrossCountry operon rrugë afatgjata që kalojnë nëpër disa rajone, prandaj çdo prishje e sistemit të kontrollit i lë mijëra udhëtarë pa alternativa të menjëhershme.</p>"
    "<p>Kjo është ndërprerja e dytë e madhe energjetike e raportuar në Britani brenda dy ditësh — pas sulmit kibernetik që mbylli për katër ditë një termocentral të vogël — dhe vjen pikërisht në një nga fundjavat më të ngarkuara të sezonit të udhëtimeve verore, kur hekurudha mbart familjet që kthehen nga pushimet. Operatori ka bërë të ditur se shërbimet mbeten të anuluarra deri në njoftim të mëtejshëm, ndërsa rikthimi i energjisë në qendrën e kontrollit është parakushti për normalizimin e trafikut.</p>",
    "BBC News", "Botë", "2026-08-23T16:05:00+02:00",
    7.3,
    "Kolaps operacional i një rrjeti hekurudhor kombëtar, i dokumentuar sot nga dy botues direkt me deklarata zyrtare të qeverisë britanike dhe ndikim masiv mbi udhëtarët.",
    (7, 8, 7, 3, 6, 9, 8, 9), "🇬🇧",
    "https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/8766/live/9b0d2440-9ef2-11f1-aed4-af6fe65bfcd6.jpg", 1200, 675))

# 10. Showbiz/Kulturë — Koran Festival in Pogradec (Euronews Albania)
articles.append(art(
    10, "festa-e-koranit-kthen-pogradecin-ne-kryeqender-te-tradites-rreth-2-milione-rasate",
    "https://euronews.al/festa-e-koranit-tradita-qe-rikthehet-cdo-vere-ne-pogradec/",
    "Festa e Koranit mbush Pogradecin: rreth 2 milionë rasatë rinovojnë Liqenin e Ohrit",
    "Kuzhinierët e zonës prezantuan recetat tradicionale me «mbretin e liqenit», ndërsa zëvendësministri i Bujqësisë premtoi vazhdimin e ripopullimit me koran.",
    "<p>Festa e Koranit e ka kthyer sërish Pogradecin në kryeqendrën verore të traditës kulinarke, në periudhën kur Liqeni i Ohrit nis pasurimin me rasatë e koranit, raporton Euronews Albania. Vetëm këtë vit pritet të hidhen rreth 2 milionë rasatë e rinj të asaj që banorët e quajtin «mbretin e liqenit».</p>"
    "<p>Në aktivitetin e këtij viti u bashkuan kuzhinierë të zonës, të cilët u prezantuan vizitorëve gatime të ndryshme me koran, të përgatitura sipas recetave tradicionale të Pogradecit. Sipas tyre, «mbreti i liqenit» vijon të jetë një nga shijet më të kërkuara nga pushuesit dhe turistët që e zgjedhin qytetin liqenor në majat e gushtit.</p>"
    "<p>Për kuzhinierin e MasterChef-it shqiptar, Arian Ceka, kulinaria pogradecare ka ardhur duke u përmirësuar në vitet e fundit, me produktin vendor gjithmonë më të pranishëm në menytë e restoranteve. Zëvendësministri i Bujqësisë, Arian Jaupllari, tha se procesi i ripopullimit të liqenit do të vijojë, me synim rritjen e rezervave të koranit.</p>"
    "<p>Muajt gusht dhe shtator përkojnë me periudhën natyrore të pasurimit të Ohrit me rasatë e reja, çka i ka dhënë festës karakterin e një tradite të përvitshme që kombinon kuzhinën, muzikën dhe promovimin e produktit lokal për mijëra pushues që e zgjedhin qytetin në majat e sezonit.</p>"
    "<p>Festa nuk u kufizua te kulinaria: pushuesit që kanë zgjedhur Pogradecin për gushtin patën mundësi të ndjekin edhe një mbrëmje muzikore me disa prej emrave më të njohur të muzikës së Kosovës. Kombinimi i gatimeve tradicionale, i koncerteve dhe i promovimit të koranit e ka kthyer festivallin në një motor të vogël të turizmit liqenor në fundjavën e madhe të gushtit.</p>"
    "<p>Korani i Ohrit është specie endemike e liqenit dhe prej vitesh objekt i programeve të ripopullimit të organizuara nga institucionet e dy vendeve që e ndajnë ujin. Ripopullimi me rasatë mbetet edhe projekt mjedisor: rritja e rezervave mban në jetë ciklin e peshkimit të kontrolluar dhe siguron që produkti simbol i Pogradecit ta ruajë vendin e tij në tryeza e tregje lokale.</p>",
    "Euronews Albania", "Showbiz", "2026-08-23T16:39:40+02:00",
    7.2,
    "Festival kulturor-veror me numra konkretë (rreth 2 milionë rasatë), pjesëmarrje institucionale dhe muzikë të njohur shqiptare; temë e gjerë në majat e sezonit turistik.",
    (7, 5, 6, 8, 5, 8, 6, 9), "🎬",
    "https://euronews.al/wp-content/uploads/2026/08/Screenshot_38-1.jpg", 1307, 743))

# 11. Sport — Kim Le Court wins Tour of Britain Women (The Guardian)
articles.append(art(
    11, "kim-le-court-fiton-tour-of-britain-women-wiebes-me-fitoren-e-137-te-etape",
    "https://www.theguardian.com/sport/2026/aug/23/kim-le-court-tour-of-britain-women-lorena-wiebes-cycling",
    "Kim Le Court triumfon në Tour of Britain Women, Wiebes me fitoren e 137-të etape në karrierë",
    "Mauriciusja vulosi suksesin më të madh të karrierës në Royal Leamington Spa, ndërsa holandezja u imponua në sprintin e etapës finale.",
    "<p>Kim Le Court e ka vulosur fitoren e përgjithshme në Tour of Britain Women në Royal Leamington Spa, edhe pse Lorena Wiebes u imponua në sprintin e etapës finale, raporton The Guardian. Për holandezën ishte fitorja e katërt e edicionit të këtij viti dhe e 137-ta në të gjithë karrierën.</p>"
    "<p>Për mauriciusjen Le Court, e cila më parë këtë verë fitoi një etapë dhe u rendit e nënta në Tour de France Femmes, ky është triumfi më i rëndësishëm i karrierës në garat etapore. Suksesin ajo e ndërtoi me fitoren solo të të premtes drejt Great Orme, mbi qytetin bregdetar Llandudno, ku i shkëputi të gjitha rivale.</p>"
    "<p>Në etapën e fundit, Wiebes duhej ta punojë fitoren: Sara Martín e Movistar, britanikja Alice Towers dhe Eva van Agt i shkëputën pelotonit me 110 kilometra nga finishi dhe ndërtuan një avantazh që u afrua në dy minuta e gjysmë. Ishin ngjitjet e Sun Rising Hill dhe Burton Dassett që e konsumuan përpjekjen e trios, përpara se grupi kryesor ta rifitonte garën para sprintit.</p>"
    "<p>Van Agt është shoqe skuadre e fitueses së Tour de France Femmes, Demi Vollering, në FDJ United-Suez — një detaj që flet për thellësinë e ekipave evropiane edhe në garat britanike. Wiebes, ndër sprinteret më të shpejta të gjeneratës, e mbyll edicionin me katër fitore etape, ndërsa 11 sukseset e saj në garën britanike e bëjnë atë rideren më e suksesshme e historisë së saj.</p>"
    "<p>Fitoret e Le Court dhe të Wiebes në të njëjtin edicion e dëshmojnë nivelin e ciklizmit femror, që vit pas viti po e zgjeron kalendarin britanik e botëror. Për mauriciusjen, triumfi i Leamington Spa hyn si fitorja më e rëndësishme etapore e një përfaqësueseje të Mauritiusit në ciklizmin ndërkombëtar.</p>"
    "<p>Klasifikimi i përgjithshem u vendos para sprintit të fundit: avantazhi i fituar në Great Orme mbeti i pandryshueshëm edhe pas fitorjes së Wiebes, pasi diferenzat e kohës së garës së premte ishin më të mëdha se ato që mund të kompensoheshin te bonuset sekondare të etapës.</p>",
    "The Guardian", "Sport", "2026-08-23T16:11:10+02:00",
    7.1,
    "Rezultate sportive të dokumentuara live: fitore e përgjithshme në Tour of Britain Women dhe fitorja e 137-të etape e Wiebes; raportim direkt nga gara e ditës.",
    (7, 6, 6, 4, 6, 9, 8, 10), "🚴",
    "https://i.guim.co.uk/img/media/407a57ab1682058fbdb82a4fe510b0596e32c895/571_0_4470_3576/master/4470.jpg?width=1200&dpr=1&s=none", 1200, 960))

# 12. Showbiz/Teknologji — TikTok steers Gen Z travel (Euronews Albania)
articles.append(art(
    12, "tiktok-udheheq-zgjedhjet-e-pushimeve-48-per-qind-e-brezit-z-frymezohet-nga-videot",
    "https://euronews.al/e-pashe-ne-tiktok-48-e-te-rinjve-te-brezit-z-frymezohen-nga-videot-e-shkurtra-per-udhetimet/",
    "«E pashë në TikTok»: 48% e Brezit Z e frymëzon platforma për vendet e pushimeve",
    "Studimi i TUI Musement në Spanjë, Itali dhe Britani tregon se videot e shkurtra po i kalojnë edhe këshillat e miqve në zgjedhjen e destinacioneve.",
    "<p>Gati gjysma e të rinjve e përdorin TikTok-un si burim frymëzimi për pushimet: 48% e pjesëtarëve të Brezit Z thonë se videot e shkurtra i ndikojnë drejtëpërdrejtë në zgjedhjen e destinacioneve dhe aktiviteteve, tregon studimi i platformës TUI Musement i realizuar në Spanjë, Itali dhe Mbretërinë e Bashkuar, i raportuar nga Euronews Albania.</p>"
    "<p>Sipas kompanisë, përmbajtja vizuale dhe videot e shkurtra po fitojnë peshë ndaj burimeve tradicionale të informacionit: më shumë se katër në dhjetë udhëtarë thanë se një postim viral i kishte shtyrë të rezervonin një udhëtim ose aktivitet. Ndikimi del edhe pak më i fortë te mijëvjeçarët sesa te Brezi Z, i lindur mes viteve 1997 dhe 2012, që sipas raportimit po e udhëheq ndryshimin në mënyrën si turistët zbulojnë, rezervojnë dhe ndajnë me të tjerët pushimet e tyre.</p>"
    "<p>Krijuesit e përmbajtjes po bëhen faktorë të vërtetë vendimmarrës: rreth 27% e të anketuarve thanë se e kishin ndryshuar destinacionin pas rekomandimit të një influencieri. Po ashtu, pothuajse katër në dhjetë turistë kanë vizituar një atraksion kryesisht për ta fotografuar ose filmuar, një trend që rishkruan mënyrën si planifikohen rrugëtimet.</p>"
    "<p>Presioni social vazhdon edhe pas mbërritjes në destinacion: më shumë se një e treta e udhëtarëve ndiejnë detyrimin t'i paraqesin pushimet më emocionuese në profilet e tyre. Platforma vlerësohet tashmë më e rëndësishme se këshillat e miqve për zgjedhjen e destinacioneve — kthesë që studimi e quan ndryshim gjeneracional në sjelljen e turistëve.</p>"
    "<p>Për bizneset e turizmit shqiptar, të dhënat konfirmojnë se prania në videot e shkurtra është kthyer në kanal kryesor të marketingut drejt brezave të rinj, nga plazhet e Rivierës te destinacionet malore e urbane. Studimi u realizua në tre prej tregjeve kryesore emituese të turistëve që vizitojnë bregdetin shqiptar, çka e bën të zbatueshme drejtëpërdrejt për rajonin.</p>"
    "<p>Strukturat e akomodimit që nuk prodhojnë përmbajtje vizuale të shkurtër rrezikojnë thjesht të mos shihen nga publiku që planifikon me telefonin në dorë, ndërsa restorantet dhe atraksionet fitojnë vizibilitet pikërisht nga videot virale të vizitorëve.</p>",
    "Euronews Albania", "Showbiz", "2026-08-23T16:43:05+02:00",
    7.0,
    "Studim i citueshëm me shifra konkrete mbi sjelljen e Brezit Z në turizëm, i dokumentuar sot nga botuesi direkt; i lidhur drejtëpërdrejtë me industrinë e turizmit shqiptar.",
    (7, 5, 6, 7, 5, 8, 7, 9), "📱",
    "https://euronews.al/wp-content/uploads/2026/08/Screenshot_39-2.jpg", 1307, 743))

# 13. Kulturë — Serenades of Ziçisht (Euronews Albania)
articles.append(art(
    13, "serenatat-e-zicishtit-tingujt-qe-i-rezistojne-harreses-ne-fshatin-e-devollit",
    "https://euronews.al/serenatat-e-zicishtit-tradita-qe-i-reziston-kohes/",
    "Serenatat e Ziçishtit, tingujt që i rezistojnë harresës në fshatin e Devollit",
    "Tingujt e kitarës dhe këngët e dashurisë u kthyen në një mbrëmje festive që i bashkoi banorët dhe të rinjtë e fshatit rreth trashëgimisë së tyre.",
    "<p>Serenatat mbeten një nga traditat më të veçanta të fshatit Ziçisht të Devollit, një pasuri kulturore e ruajtur brez pas brezi dhe e kthyer në simbol të identitetit dhe kujtesës së komunitetit, raporton Euronews Albania. Tingujt e kitarës dhe këngët e dashurisë kanë qenë pjesë e jetës së këtij fshati korçar për gjenerata të tëra, të kënduara në oborret e shtëpive në netët e verës.</p>"
    "<p>Për banorët, ruajtja e serenatave ka kuptimin e mbajtjes gjallë të historisë dhe traditës së vendit. Edhe brezat e rinj po u rikthehen këtyre këngëve — dëshmi se kjo kulturë vazhdon të ketë vend edhe sot dhe nuk është reduktuar thjesht në kujtime familjare apo në arkiva lokale.</p>"
    "<p>Pikërisht për ta promovuar këtë trashëgimi u organizua një mbrëmje kushtuar serenatave të Ziçishtit. Muzika, tingujt e kitarave dhe performancat rikthyen atmosferën e netëve të dikurshme të serenatave, duke i sjellë bashkë banorët e vjetër dhe të rinjtë e fshatit, me repertorin që ka kaluar gojarisht nga një brez te tjetri.</p>"
    "<p>Në një kohë kur shumë tradita të vjetra rrezikohen nga harresa dhe nga largimi i të rinjve drejt qyteteve, aktivitete të tilla synojnë t'u japin atyre një jetë të re dhe t'i përcjellin te brezat e ardhshëm. Serenatat mbeten momenti qendror i takimeve verore të fshatit, kur oborret dhe rrugicat mbushen përsëri me këngë.</p>"
    "<p>Trashëgimia e serenatave e ka bërë fshatin të njohur edhe përtej kufijve të tij, dhe banorët shpresojnë që aktivitetet e përvitshme ta forcojnë Ziçishtin si pikë referimi të turizmit kulturor në zonën e Devollit, ku muzika mbetet gjuha më e përbashkët e brezave.</p>"
    "<p>Reportazhi thekson se serenatat nuk janë thjesht spektakël për vizitorët, por praktikë e gjallë shoqërore: në to ruhen dialekti i zonës, mënyra e vjetër e shprehjes së dashurisë dhe lidhja e fshatit me kalendrin e festave të verës. Mbrëmja e organizuar synoi ta rikthejë pikërisht këtë atmosferë, me performanca që i përkthyen këngët e trashëguara në një festë të hapur për komunitetin.</p>",
    "Euronews Albania", "Kulturë", "2026-08-23T16:46:28+02:00",
    6.9,
    "Reportazh kulturor i ditës mbi një traditë të gjallë të muzikës shqiptare në Ziçisht, me aktivitet të dokumentuar sot; vlerë identitare e njohur për publikun e gjerë.",
    (6, 4, 6, 8, 5, 8, 6, 10), "🎵",
    "https://euronews.al/wp-content/uploads/2026/08/Screenshot_40-1.jpg", 1307, 743))

# 14. Sport/Botë — Nordic nations lose confidence in Infantino (Al Jazeera/Reuters)
articles.append(art(
    14, "gjashte-vendet-nordike-e-humbin-besimin-te-infantino-kerkojne-reforma-ne-fifa",
    "https://www.aljazeera.com/sports/2026/8/23/nordic-nations-have-lost-confidence-in-infantino-demand-fifa-reforms",
    "Gjashtë vendet nordike e humbasin besimin te Infantino, kërkojnë reforma në FIFA",
    "Danimarka, Finlanda, Islanda, Norvegjia, Suedia dhe Ishujt Faroe kërkuan dorëheqjen e presidentit dhe hetim të pavarur mbi planin e shitjes së aksioneve të Kupës së Botës.",
    "<p>Gjashtë federatat nordike të futbollit kanë dërguar një goditje të unifikuar presidentit të FIFA-s, Gianni Infantino: Danimarka, Finlanda, Islanda, Norvegjia, Suedia dhe Ishujt Faroe u mblodhën në Helsinki dhe publikuan të dielën një deklaratë të përbashkët ku thonë se «kanë humbur besimin» ndaj tij, raporton Reuters përmes Al Jazeera.</p>"
    "<p>Nordikët mbështesin thirrjet për dorëheqjen e Infantinos, të ngritura nga tre konfederatat kryesore rajonale, dhe kërkojnë një hetim të pavarur mbi propozimin e tij për shitjen e një aksioni në evente si Kupa e Botës te investitorët privatë — plan që u braktis shpejt përballë një reagimi negativ global.</p>"
    "<p>«Federatat nordike të futbollit e kanë humbur besimin ndaj presidentit të FIFA-s dhe janë të shqetësuara për qeverisjen dhe marrjen e vendimeve në nivelin më të lartë të organizatës», thuhet në deklaratë. Ato shtojnë se presojnë «garanci detyruese» për qeverisjen e FIFA-s dhe se mbështesin masat e propozuara nga UEFA bashkërisht me anëtarët e saj kombëtarë.</p>"
    "<p>Infantino është në kërkim të një mandati të katërt në krye të FIFA-s, që do ta shtrihej deri në 2031, në zgjedhjet e marsit. Konfrontimi i hapur me federatat e Europës Veriore vjen në një moment delikat për organizatën dhe mund të peshojë në balancën e votimit të kongresit të ardhshëm.</p>"
    "<p>Lëvizja e koordinuar e gjashtë anëtarëve nordikë tregon se pakënaqësia me qeverisjen e FIFA-s po kalon nga kritika individuale në presion të organizuar, pak muaj përpara votimit presidencial, me UEFA-n në pozicionin e aleates kryesore të reformatorëve.</p>"
    "<p>Deklarata e Helsinkit është e rrallë sepse federatat nordike tradicionalisht votojnë veçmas në kongreset e FIFA-s; unifikimi i tyre i jep kampit reformator pesë vota të garantuara dhe një model që federata të tjera të vogla mund ta ndjekin në muajt në ardhshëm.</p>"
    "<p>Infantino drejton FIFA-n që nga viti 2016, me selinë e organizatës në Cyrih, ndërsa mandati aktual i tij përfundon në vitin 2027. Në Kongresin e FIFA-s çdo federatë anëtare disponon nga një votë, çka i bën blloqet rajonale vendimtare për fatin e zgjedhjeve presidenciale.</p>",
    "Al Jazeera", "Sport", "2026-08-23T15:50:00+02:00",
    6.8,
    "Konflikt institucional i dokumentuar me deklaratë të përbashkët zyrtare të gjashtë federatave kundër presidentit të FIFA-s; zhvillim me rëndësi për qeverisjen e sportit global.",
    (7, 6, 6, 3, 7, 9, 8, 9), "⚽",
    "https://www.aljazeera.com/wp-content/uploads/2026/07/2026-07-28T162945Z_1037867588_RC28KJAED3SY_RTRMADP_3_SOCCER-FIFA-STAKE-1785425233.jpg?resize=1920%2C1440", 1920, 1440))

with open("/opt/data/workspaces/383lajme/data/auto-articles/2026-08-23T17.json", "w", encoding="utf-8") as f:
    json.dump(articles, f, ensure_ascii=False, indent=2)
print(f"Wrote {len(articles)} articles to data/auto-articles/{STAMP}.json")
