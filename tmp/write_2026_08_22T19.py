#!/usr/bin/env python3
"""Write the 2026-08-22T19 batch: 13 verified current direct-publisher articles."""
import json

STAMP_PUBLISHED = "2026-08-22T19:00:00+02:00"
FORMULA = "0.22*relevance + 0.14*urgency + 0.16*public_impact + 0.10*local_depth + 0.10*controversy_interest + 0.16*credibility + 0.08*corroboration + 0.04*editorial_safety"

def art(idx, slug, url, title, excerpt, body, source, flag, category,
        score_reason, breakdown, image_url, iw, ih):
    score = round(
        0.22 * breakdown["relevance"] + 0.14 * breakdown["urgency"]
        + 0.16 * breakdown["public_impact"] + 0.10 * breakdown["local_depth"]
        + 0.10 * breakdown["controversy_interest"] + 0.16 * breakdown["credibility"]
        + 0.08 * breakdown["corroboration"] + 0.04 * breakdown["editorial_safety"], 1)
    return {
        "id": f"383-20260822-19-{idx:02d}",
        "slug": slug,
        "url": url,
        "dispatch": "cloud-news-discovery + direct publisher verification",
        "title": title,
        "excerpt": excerpt,
        "body": body,
        "source": source,
        "source_flag": flag,
        "source_bias": "neutral",
        "tone": "informues",
        "category": category,
        "published_at": STAMP_PUBLISHED,
        "reading_time": 2,
        "featured": idx <= 4,
        "engagement_score": score,
        "score_reason": score_reason,
        "score_breakdown": breakdown,
        "score_formula": FORMULA,
        "image_url": image_url,
        "image_width": iw,
        "image_height": ih,
        "created_at": STAMP_PUBLISHED,
    }

articles = []

articles.append(art(
    1, "kurti-paralajmeron-hapjen-e-plote-te-ures-se-iberit",
    "https://euronews.al/kurti-paralajmeron-hapjen-e-ures-se-ibrit-eshte-absurde-te-mbahet-e-mbyllur/",
    "Kurti paralajmëron hapjen e plotë të urës së Ibrit: «Është absurde të mbahet e mbyllur»",
    "Kryeministri në detyrë tha se institucionet janë në komunikim të përditshëm me KFOR-in për hapjen e urës kryesore të Mitrovicës dhe kalimin e saj nën kontroll të Policisë së Kosovës. Takimi me komandantin e misionit pritej të shtunën.",
    "<p>Kryeministri në detyrë i Kosovës, Albin Kurti, ka paralajmëruar hapjen e plotë të urës kryesore mbi lumin Ibër dhe kalimin e saj tërësisht nën kontroll të Policisë së Kosovës, duke e quajtur «absurde» mbajtjen e saj të mbyllur. Sipas Euronews Albania, Kurti u shpreh kështu të shtunën në një konferencë për media, kur u pyet se kur pritet të hapet ura kryesore e Mitrovicës.</p>"
    "<p>«Duhet të përkujtojmë se pas ndërtimit të urave të reja është bërë absurde që ajo urë të mbahet e mbyllur dhe fakti që qytetarët kanë qarkulluar lirshëm nëpër këto ura të reja dhe nuk ka shtim as të incidenteve as të tensioneve, tregon që liria e lëvizjes është e dobishme jo vetëm për ekonominë, por edhe për paqen dhe sigurinë», tha Kurti, citon burimi.</p>"
    "<p>Ai njoftoi gjithashtu një takim me komandantin e KFOR-it, Ozgan Ulutash, të planifikuar për pasditen e shtunës, dhe theksoi se Kryeministria dhe Ministria e Punëve të Brendshme janë në komunikim të përditshëm me misionin e NATO-s. Burimi rikujton se ura është aktualisht e hapur vetëm për këmbësorë dhe se që nga përfundimi i luftës mbahet nën mbikëqyrje të KFOR-it, duke qenë pikë e përsëritur e përplasjeve ndëretnike.</p>"
    "<p>Zhvillimi vjen ndërsa KFOR-i ka njoftuar së voni nisjen e tërheqjes graduale nga ura pas përmirësimit të situatës së sigurisë, proces që Serbia e kundërshton. Sipas raportimit, presidenti serb Aleksandar Vuçiq i ka kërkuar sekretarit të përgjithshëm të NATO-s, Mark Rutte, me letër të ndalë procesin, ndërsa një zyrtar i aleancës tha më 20 gusht se çdo vendim për rihapjen duhet të «adresojë nevojat e të gjitha komuniteteve lokale». Ministri në detyrë i Mbrojtjes, Ejup Maqedonci, e vlerësoi optimizimin si proces profesional që «nuk paraqet zvogëlim të sigurisë».</p>"
    "<p>Mbetet e paqartë afata: asnjë datë për qarkullimin e automjeteve nuk jepet në raportim, dhe hapat varen nga optimizimi i pozicionimit të KFOR-it, i cili mund të rishikohet sipas situatës. Qeveria e Kosovës kishte paralajmëruar hapjen e urës për automjete që në korrik 2024, nismë që shkaktoi tensione dhe reagime të bashkësisë ndërkombëtare, ndërsa pranë saj janë ndërtuar dy ura të tjera, një për këmbësorë dhe një për automjete.</p>",
    "Euronews Albania", "🇽🇰", "Kosovë",
    "Zhvillim direkt i sigurisë në veri të Kosovës: kryeministri në detyrë paralajmëron hapjen e urës së Ibrit ditën e takimit me komandantin e KFOR-it, mes kundërshtimit serb ndaj tërheqjes graduale.",
    {"relevance": 10, "urgency": 9, "public_impact": 10, "local_depth": 10,
     "controversy_interest": 8, "credibility": 9, "corroboration": 7, "editorial_safety": 10},
    "https://euronews.al/wp-content/uploads/2026/03/900-0-1772303422xkurti-1-979-750x375-1.jpg", 750, 375))

articles.append(art(
    2, "krivyi-rih-16-te-vdekur-ne-sulmin-mbi-qendren-tregtare",
    "https://www.bbc.co.uk/news/articles/c39egw7nmk2o",
    "16 të vdekur në sulmin me dronë ndaj qendrës tregtare në Krivyi Rih, katër ende të zhdukur",
    "Sulmi i dyfishtë rus mbi qendrën tregtare të Krivyi Rihut la 16 të vdekur dhe 130 të lënduar, ndërsa kërkimet në rrënoja vazhdojnë. Presidenti Zelensky e quajti sulmin cinik dhe poshtërues, pasi droni i dytë goditi punonjësit e urgjencës.",
    "<p>Numri i të vrarëve në sulmin rus me dronë ndaj qendrës tregtare të Krivyi Rihut në Ukrainë u rrit në 16, ndërsa skuadrat e shpëtimit vazhdojnë kërkimet në rrënojat e objektit të goditur të premten. BBC raporton se 130 persona janë lënduar dhe katër mbeten të zhdukur, me operacionin e kërkimit që pritet të zgjasë edhe dy ditë të tjera për shkak të shkatërrimit masiv.</p>"
    "<p>Sulmi u krye me dy dronë në radhë, model i njohur si «double tap», ku i dyti goditi qendrën tregtare tashmë në flaka dhe, sipas presidentit Volodymyr Zelensky, synoi punonjësit e urgjencës. Zelensky e quajti sulmin «cinik dhe poshtërues». Kryetari i rajonit Dnipropetrovsk, Oleksandr Hanzha, tha për televizionin ukrainas se bilanci u rrit gjatë natës me gjetjen e një trupi tjetër dhe se 52 të lënduar, ndër ta 14 fëmijë, mbeten në spitalet e qytetit.</p>"
    "<p>Zjarri që mbuloi një sipërfaqe rreth 9 mijë metra katrorë është shuar dhe në gjithë rajonin po vëzhgohet ditë zie. Pamjet e verifikuara nga BBC tregojnë dronin e dytë që godet objektin në qytetin e lindjes së Zelenskyt; ushtria ruse nuk ka komentuar sulmin.</p>"
    "<p>Përplasjet vazhduan gjatë natës në të dy drejtimet: sulmet ukrainase thanë jetën e së paku katër personave në Rusi, ndër ta dy fëmijë, ndërsa Moska njoftoi rrëzimin e 457 dronëve ukrainas. Kyivi ka thënë përsëri se po i mbaron stoku i raketave Patriot, arma më efektive kundër balistikëve, ndërsa objektivat e përsëritura të Luftës kanë qenë pikërisht depot dhe rrjetet logjistike ruse që financojnë përpjekjet e luftës.</p>"
    "<p>Goditja mbi një qendër tregtare të mbushur me vizitorë është ndër sulmet më të rënda mbi civilët këtë verë dhe e rikthen vëmendjen ndaj mbrojtjes kundërajrore ukrainase. Burimi nuk raporton sqarime zyrtare pse sistemet e mbrojtjes nuk i ndaluan dronët e shtunës; kërkimet për të zhdukurit vazhdojnë nën kërcënimin e sulmeve të reja.</p>",
    "BBC News", "🌍", "Botë",
    "Goditje masive mbi civilë të dokumentuar ditën e raportimit: bilanci 16 të vdekur e 130 të lënduar, kërkime aktive në rrënoja dhe konfirmime zyrtare rajonale.",
    {"relevance": 9, "urgency": 10, "public_impact": 10, "local_depth": 3,
     "controversy_interest": 9, "credibility": 9, "corroboration": 8, "editorial_safety": 9},
    "https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/aa10/live/fa462fe0-9e1d-11f1-9834-b7317ffa53cf.png", 1200, 675))

articles.append(art(
    3, "gjykata-britanike-standard-i-ri-per-deportimet-e-viktimave-shqiptare",
    "https://euronews.al/vendimi-i-gjykates-britanike-mund-te-frenoje-deportimin-e-viktimave-shqiptare-te-trafikimit/",
    "Gjykata britanika vendos standard të ri për deportimet e viktimave shqiptare të trafikimit",
    "Drejtësia britanike ka paralajmëruar se kthimi i viktimave shqiptare meshkuj në Shqipëri mund t'i ekspozojë ndaj ri-trafikimit dhe dhunës, duke vendosur udhëzime të reja vlerësimi për Home Office. Rasti u ngr nga një 21-vjeçar i trafikuar që në moshën 16-vjeçare.",
    "<p>Një vendim i drejtësisë britanike mund të ndryshojë mënyrën se si Mbretëria e Bashkuar i trajton shqiptarët e identifikuar si viktima të trafikimit. Sipas Euronews Albania, gjykata ka paralajmëruar se kthimi i disa prej tyre në Shqipëri mund t'i ekspozojë ndaj rrezikut të dhunës, ri-trafikimit dhe shfrytëzimit nga rrjetet kriminale, dhe ka vendosur udhëzime të reja se si duhet vlerësuar situata në Shqipëri para se Home Office të vendosë për kthimin e viktimave meshkuj.</p>"
    "<p>Shqiptarët janë ndër kombësitë më të prekura nga dëbimet britanike të viteve të fundit, përcjell burimi. Në vitin 2022 rreth 4,017 meshkuj shqiptarë u referuan shërbimeve për dyshime mbi trafikimin, krahas 502 femrave, ndërsa një vit më vonë u regjistruan 3,463 meshkuj dhe 588 femra. Profili i viktimave ka ndryshuar ndjeshëm: nga gratë e trafikuara për shfrytëzim seksual te djemtë dhe të rinjit që detyrohen të punojnë në trafikun e drogës apo në kultivimin e kanabisit.</p>"
    "<p>Çështja u ngr nga një 21-vjeçar shqiptar, i trafikuar që në moshën 16-vjeçare. Ai kishte udhëtuar drejt Belgjikës me të atin, kishte përfunduar nën kontrollin e një grupi kriminal shqiptar dhe më pas ishte shitur një rrjeti tjetër, që e çoi në Britani dhe e detyroi të punonte në kultivimin e kanabisit. Pas arratisjes, i riu u njoh zyrtarisht nga autoritetet britanike si viktimë e trafikimit, shkruan raportimi.</p>"
    "<p>Gjykata evidentoi probleme që e bëjnë kthimin veçanërisht të rrezikshëm: mungesën e strehimoreve të posaçme për burrat e rritur dhe rrezikun që të trafikuarit të bien sërish në duart e rrjeteve. Organizatat që i trajtojnë rastet kanë raportuar dhunë fizike, kërcënime e shantazh për ruajtjen e kontrollit mbi të rinjtë, përfshirë video abuzimi seksual ndaj të miturve si mjet kërcënimi dhe tregimin e materialeve për familjarët në Shqipëri.</p>"
    "<p>Vendimi nuk nënkupton ndalim automatik të deportimeve, por një standard të ri vlerësimi: për Home Office, çdo kthim duhet të marrë parasysh jo vetëm statusin e viktimës, por edhe rrezikun konkret pas kthimit. Për qytetarët shqiptarë në Britani dhe për familjet e tyre, vendimet e ardhshme do të matin nëse ky standard zbatohet praktikisht; burimi nuk raporton ende sa raste pritet të rishikohen.</p>",
    "Euronews Albania", "🇦🇱", "Shqipëri",
    "Vendim gjyqësor që prek direkt mijëra qytetarë shqiptarë në Britani, i dokumentuar sot me të dhëna zyrtare referimesh dhe detaje të rastit themelor.",
    {"relevance": 9, "urgency": 8, "public_impact": 9, "local_depth": 9,
     "controversy_interest": 7, "credibility": 9, "corroboration": 7, "editorial_safety": 9},
    "https://euronews.al/wp-content/uploads/2026/08/900-0-1787390193x640-0-bc8a24d7b1005c1304dd710c81118f2f-241.jpg", 900, 472))

articles.append(art(
    4, "shba-tarifa-50-ndaj-kanadases-ottawa-pergjigjet-dollar-per-dollar",
    "https://www.theguardian.com/world/2026/aug/22/canada-tariffs-trump-trade-deal-talks-fail",
    "SHBA vendos tarifat 50% ndaj Kanadasë, Ottawa zotohet të përgjigjet «dollar për dollar»",
    "Tarifat prej 50 përqind mbi rreth 20 miliardë dollarë mallra kanadeze hynë në fuqi pas rënies së bisedimeve tregtare. Kryeministri Mark Carney riktheu negociatorët dhe zotoi përputhje të tarifave «dollar për dollar», pa bisedime të reja të planifikuara.",
    "<p>Shtetet e Bashkuara kanë vendosur tarifa prej 50 përqind mbi mallra kanadeze me vlerë rreth 20 miliardë dollarësh, ndërsa kryeministri Mark Carney ka zotuar përgjigje «dollar për dollar». The Guardian raporton se tarifat hynë në fuqi nga ora 04.00 GMT dhe prekin produkte që shtrihen nga shkopinjtë e hokit te barnat e thjeshta mjekësore.</p>"
    "<p>Vendimi vulos rënien e bisedimeve tregtare: të premten në mbrëmje Kanada refuzoi të finalizojë marrëveshjen pasi, sipas Carney-t, «ndryshimet e minutës së fundit» në kushtet e propozuara amerikane ishin «të padrejta, joekonomike dhe vunë në pikëpyetje besueshmërinë e çdo marrëveshjeje». Përfaqësuesi i tregtisë i SHBA-së, Jamieson Greer, i akuzoi palët kanadeze për tërheqje nga angazhimet dhe e quajti ofertën amerikane «mundësi të humbur» për Otavën.</p>"
    "<p>Kanadaja riktheu negociatorët e saj dhe nuk ka bisedime të planifikuara, shkruan burimi. «Kanadaja do t'i përputhojë këto tarifa dollar për dollar për të mbrojtur punëtorët dhe bizneset tona», deklaroi Carney. Ekspertët parashikojnë humbje vendepune në sektorë të cenueshëm, por vlerësojnë se goditja më e madhe është politike mes dy aleateve historike që vitin e kaluar këmbyen mallra e shërbime prej 880 miliardë dollarësh.</p>"
    "<p>Eskalimi vë në pikëpyetje edhe fatin e paktit tregtar të Amerikës së Veriut me Meksikën, themel për industrinë e tri vendeve. Premieri i Ontarios, Doug Ford, deklaroi mbështetje të plotë për përgjigjen «tarifë për tarifë, dollar për dollar», ndërsa Dhomës së Tregtisë kanadeze e quajti vendimin amerikan «goditje e rëndë ndaj konkurrencës kontinentale». Një peticion për largimin e ambasadorit amerikan ka mbledhur rreth 248 mijë firmash.</p>"
    "<p>Për ekonomitë evropiane dhe tregjet globale, përplasje e tillë midis dy partnerëve më të mëdhenj tregtarë ul besimin se zinxhirët e furnizimit janë të mbrojtur nga politikat protekcioniste. Burimi nuk njofton ende masa kanadeze konkrete përtej premtimeve të Carney-t për mbështetje të punëtorëve dhe bizneseve «në ditët e ardhshme».</p>",
    "The Guardian", "🌍", "Ekonomi",
    "Shok ekonomik i madh i ditës: tarifat 50% të SHBA-së ndaj Kanadasë hyjnë në fuqi dhe Ottawa i përgjigjet me retaliacion të deklaruar, me shifra dhe deklarata të dokumentuara.",
    {"relevance": 8, "urgency": 9, "public_impact": 10, "local_depth": 4,
     "controversy_interest": 7, "credibility": 9, "corroboration": 8, "editorial_safety": 9},
    "https://i.guim.co.uk/img/media/6fca08f3a759225a7da5912b393aadcad7c6b4e7/0_0_4724_3780/master/4724.jpg?width=1200&height=630&quality=85&auto=format&fit=crop&precrop=40:21,offset-x50,offset-y0&overlay-align=bottom%2Cleft&overlay-width=100p&overlay-base64=L2ltZy9zdGF0aWMvb3ZlcmxheXMvdGctZGVmYXVsdC5wbmc&enable=upscale&s=9c91fd8edbb00f55fddce795b22fe159", 1200, 630))

articles.append(art(
    5, "coinbase-armstrong-clarity-act-votim-kyc-ne-senate-me-15-shtator",
    "https://coingape.com/brian-armstrong-clarity-acts-clear-rules-protect-consumers-and-guard-against-government-overreach/",
    "Brian Armstrong bën apel për CLARITY Act teksa Senati përgatitet për votimin e 15 shtatorit",
    "Kryeshekulluesi i Coinbase e mbrojti ligjin për strukturën e tregut të kriptomonedhave si mbrojtje për përdoruesit dhe pengesë kundër tepirit regulator. Votimi procedurial në Senat është caktuar për 15 shtator dhe u duhen të paktën shtatë demokratë republikanëve.",
    "<p>Kryeshekulluesi i Coinbase, Brian Armstrong, ka intensifikuar lobimin për miratimin e CLARITY Act, ligjit amerikan për strukturën e tregut të kriptomonedhave, teksa Senati përgatitet për votimin procedurial të 15 shtatorit. CoinGape raporton se Armstrong e bëri thirrjen në një intervistë për CBS News më 20 gusht, ditë pas një samiti kripto në Shtëpinë e Bardhë me presidentin Trump.</p>"
    "<p>«Statusi quo aktual është se nuk ka shumë qartësi për cilat janë rregullat, dhe po shohim shumë amerikanë të thjeshtë të dëmtohen duke përdorur disa prej këtyre produkteve», tha Armstrong, citon burimi, i cili e përmendi kolapsin e FTX-it më 2022 si pasojë e mungesës së mbrojtjeve për konsumatorët. Sipas tij, ligji do t'i mbrojë përdoruesit dhe njëkohësisht industrinë nga «qeveri të këqija ose teprimi regulator».</p>"
    "<p>Projektligji ndan juridiksionin mes SEC dhe CFTC: shumica e aseteve dixhitale do të klasifikoheshin si mallra nën mbikëqyrjen e CFTC-së, me rregulla kundër pastrimit të parasë dhe mjete mbrojtjeje për konsumatorët. Republikanët kanë 53 vende në Senat dhe u duhen së paku shtatë demokratë për të arritur 60 votat e nevojshme; lideri John Thune depozitoi kërkesën për votim më 8 gusht, ndërsa Dhoma e Përfaqësuesve e kishte kaluar ligjin që në korrik 2025 me 294 kundrejt 134 votash.</p>"
    "<p>Kundërshtitë mbeten të hapura: një pjesë e demokratëve kërkojnë dispozita etike kundër përfitimit të funksionarëve federalë nga kriptomonedhat, ndërsa tregjet e predikimit, sipas Polymarket të cituar nga burimi, i japin kalimit të plotë të ligjit vetëm 25 përqind gjasë deri në fund të 2026-shit. Nëse votimi dështon, kryetari i CFTC-së, Mike Selig, planifikon të përparojë rregulla të veta më 16 shtator në bazë të autoriteteve ekzistuese.</p>"
    "<p>Zhvillimi ndikon drejtpërdrejt çmimet dhe investimet globale në kripto, segment që ndiqet gjerësisht edhe nga publiku shqiptar. Komisioni Bankar i Senatit e kishte avancuar versionin e vet në maj 2026 me 15 kundrejt 9 votash, dhe Armstrongpret mbi 60 vota, duke e quajtur procesin «në fazën përfundimtare»; ecuria e votimit mbetet treguesi kyç i rregullimit amerikan të sektorit.</p>",
    "CoinGape", "🌍", "Ekonomi",
    "Zhvillim regulator me afat konkret: votimi procedurial i CLARITY Act u caktua për 15 shtator dhe lobimi i CEO-t të Coinbase dokumentohet me deklarata dhe shifra votash.",
    {"relevance": 8, "urgency": 8, "public_impact": 9, "local_depth": 3,
     "controversy_interest": 7, "credibility": 8, "corroboration": 8, "editorial_safety": 8},
    "https://coingape.com/wp-content/uploads/2026/01/U.S.-CLARITY-Act-Is-Taking-Longer-Coinbase-Exec-Explains-Why.webp", 1200, 800))

articles.append(art(
    6, "espanyol-real-madrid-mourinho-rikthehet-ne-stolin-e-madridit",
    "https://www.aljazeera.com/sports/liveblog/2026/8/22/espanyol-vs-real-madrid-live-la-liga",
    "Espanyol–Real Madrid: Mourinho rikthehet në krye të «Los Blancos» 13 vjet më vonë",
    "Real Madrid i hap sezonin e ri të La Liga-s në fushë të Espanyolit në stadiumin RCDE, me nisje në orën 21:30 vendore. Takimi shoqërohet me rikthimin e José Mourinhos në krye të klubit madrilas, 13 vjet pas periudhës së tij të fundit atje.",
    "<p>Real Madrid i hap sezonin e ri të La Liga-s në fushë të Espanyolit, në ndeshjen e mbrëmjes së shtunës në stadiumin RCDE të Barcelonës, me nisjen në orën 21:30 vendore (19:30 GMT). Al Jazeera raporton se takimin shoqëron rikthimi i José Mourinhos në krye të «Los Blancos», 13 vjet pas periudhës së tij të fundit si trajner i klubit madrilas.</p>"
    "<p>Sipas raportimit, portugali drejton Realin në kampionatin spanjoll, duke e rikthyer njërën nga figurat më të diskutuara të profesionit në një nga stolët më të ndjekura të futbollit evropian. Për Mourinhon, ky është rikthimi në klubin me të cilin fitoi kampionatin spanjoll më 2012 me rekord prej 100 pikësh, pas periudhave te Porto, Chelsea, Inter, Manchester United, Tottenham, Roma dhe Fenerbahçe.</p>"
    "<p>Espanyoli pret kampionët në ambientin e njohur të Cornellà-El Prat, ku presioni i tribunave historikisht e ka bërë përballjen të vështirë për vizitorët e mëdhenj. Burimi nuk raporton përbërje të konfirmuara para publikimit, as mungesa të reja të lojtarëve për duel, ndaj çdo detaj taktikal mbetet pritje deri në publikimin zyrtar të skuadrave.</p>"
    "<p>Rezultati i takimit nuk dihet në momentin e shkrimit, ndërsa ndjekja e tekstit live e ofruar nga burimi vazhdon gjatë gjithë ndeshjes. Burimi e shoqëron duel me analizë, ndjekje të plotë tekstuale dhe paraqitje të përbërjeve në prag të nisjes, një mbulim që i jep takimit statusin e ngjarjes kryesore të mbrëmjes në kampionatin spanjoll.</p>"
    "<p>Kthimi i portuglezit në Madrid qe një nga lajmet kryesore të verës dhe i ka shtuar ndjekjes mediatike çdo ndeshjeje të klubit. Sezoni 2026-27 i La Liga-s nisi këtë fundjavë dhe performanca e parë e Realit nën Mourinhon do të lexohet si sinjal ambicie në garën me Barcelonën dhe Atlético Madrid.</p>",
    "Al Jazeera", "⚽", "Sport",
    "Ndeshje hapëse e La Liga-s me rikthimin e Mourinhos në Real Madrid, e ndjekur live dhe me interes masiv të tifozërisë shqiptare për kampionatin spanjoll.",
    {"relevance": 8, "urgency": 8, "public_impact": 8, "local_depth": 4,
     "controversy_interest": 8, "credibility": 8, "corroboration": 6, "editorial_safety": 9},
    "https://www.aljazeera.com/wp-content/uploads/2026/08/getty_6a8951cc25-1787384268_a02b31-1787384316.jpg?resize=1200%2C630&quality=80", 1200, 630))

articles.append(art(
    7, "antonelli-do-te-niset-me-penalitet-ne-gp-n-e-italise",
    "https://www.formula1.com/en/latest/article/wolff-confirms-antonelli-is-set-for-grid-penalty-at-italian-grand-prix.4IIgVJdITz0W1xOIrbOPAM",
    "Lideri Antonelli do të niset me penalitet në GP-në e Italisë, konfirmon Wolff",
    "Mercedesi ka planifikuar ndryshim motori që e tejkalon kuotën e lejuar, ndërsa penaliteti minimal prej 10 pozicioneve godet liderin e kampionatit Kimi Antonelli pikërisht në garën e shtëpisë në Monza.",
    "<p>Lideri i kampionatit Kimi Antonelli pritet të niset me penalitet gridi në Grand Prix-n e Italisë, pasi Mercedesi ka planifikuar ndryshim motori që e tejkalon kuotën e lejuar të elementëve të grupit të fuqisë. Formula1.com raporton se shefi i skuadrës, Toto Wolff, e konfirmoi vendimin para kualifikueseve të shtunës në Zandvoort.</p>"
    "<p>Sipas rregullores, përdorimi i elementëve mbi alokacionin e lejuar sjell penalitet në garën e parë ku përdoret elementi shtesë: minimumi është 10 pozicione, por numri varet nga komponentët e ndryshuar. Nëse Mercedesi zgjedh zëvendësim të plotë, 18-vjeçari mund të detyrohet të nisë nga fundi i gridit pavarësisht rezultatit që do të arrinte në kualifikuese.</p>"
    "<p>Skuadra e pranon zgjedhjen si menaxhim teknik, për të shmangur dëmtime të mëtejshme teknike si ai që e detyroi Antonellin të braktiste garën e kaluar ndërsa luftonte për pikë të vlefshme. «Ne i duam pikë të mëdha. Kimi me siguri do të humbasë disa në Monza duke nisur nga fundi, ndaj shpresojmë t'i grumbullojmë disa këtu», tha Wolff pas sprintit, ku Antonelli u radhit i katërti, citon burimi.</p>"
    "<p>Monza, gara e shtëpisë për Antonellin dhe tifozët italianë, u zgjodh pikërisht sepse pista Lombarde konsiderohet më e përshtatshme për rimëkëmbje nga fundi i renditjes, falë xhirove me shpejtësi maksimale dhe mundësive më të mëdha të tejkalimit, shkruan burimi. Fundjava e garës zhvillohet nga 4 deri më 6 shtator, me kualifikueset dhe garën kryesore të programuara sipas orarit standard të fundjavës së garës.</p>"
    "<p>Antonelli, që do të bëhej kampioni më i ri i historisë së Formula 1 nëse e siguron titullin 2026, e udhëheq klasifikimin e përgjithshëm. Burimi nuk raporton ende komponentët e saktë që do të ndryshohen; numri final i pozicioneve të humbura do të njoftohet zyrtarisht përpara garës së Monzës.</p>",
    "Formula 1", "⚽", "Sport",
    "Vendim teknik i konfirmuar zyrtarisht nga shefi i Mercedes-it që godet liderin e kampionatit para garës së shtëpisë në Monza; dokumentuar nga faqja zyrtare e garës.",
    {"relevance": 8, "urgency": 8, "public_impact": 7, "local_depth": 4,
     "controversy_interest": 7, "credibility": 9, "corroboration": 7, "editorial_safety": 9},
    "https://media.formula1.com/image/upload/c_lfill,w_2048/q_auto/v1740000001/trackside-images/2026/F1_Grand_Prix_of_Netherlands___Previews/2291283639.webp", 2048, 1365))

articles.append(art(
    8, "rreth-100-te-lenduar-ne-ndeshjen-e-kupe-se-gjermanise-mannheim-kaiserslautern",
    "https://www.aljazeera.com/sports/2026/8/22/fans-and-police-injured-in-pitch-invasion-during-high-risk-german-cup-tie",
    "Rreth 100 të lënduar pas pushtimit të fushës në ndeshjen e Kupës së Gjermanisë",
    "Dueli i raundit të parë të DFB-Pokal mes Waldhof Mannheim dhe Kaiserslautern u ndërpre rreth 30 minuta pas dhunës së tifozëve, që la rreth 100 të lënduar, ndër ta 35 policë. Takimi u mbyll 1-0 për Kaiserslauternin me gol në minutën e 120-të.",
    "<p>Rreth 100 persona, ndër ta 35 policë, janë lënduar gjatë incidenteve të tifozëve në ndeshjen e raundit të parë të Kupës së Gjermanisë midis hostëve Waldhof Mannheim dhe Kaiserslautern, konfirmoi policia lokale të shtunën. Al Jazeera raporton se takimi ishte caktuar më parë me rrezik të lartë për shkak të rivalitetit të dy tifozërive.</p>"
    "<p>Ndeshja u ndërpre për rreth 30 minuta në fund të kohës normale, kur rezultati ishte 0-0. Sipas policisë, tifozët e sektorit të vizitorëve qëlluan flakadane drejt tribunës kryesore, ndërsa në përgjigje hostët pushtuan fushën. «Një total prej 85 personash kanë nevojë për kujdes mjekësor, tetë u transportuan në spital për trajtim të mëtejshëm», tha policia në komunikatë, duke saktësuar se mes personelit të goditur dominohen oficerët e shërbimit në tribunat e stadiumit.</p>"
    "<p>Takimi u rikthye vetëm pas një «ndërhyrjeje masive të policisë në fushë për ta detyruar individët të ktheheshin nga sektori i hostëve, duke përdorur masa fizike», shkruan raportimi. Për siguri janë mobilizuar gati 1,400 policë në duel mes dy klubeve rivalë që ndodhen afërsisht 50 kilometra larg njëri-tjetrit, një nga operacionet më të mëdha sigurie për një takim të raundit të parë të kupës.</p>"
    "<p>Në fushë, Kaiserslauterni fitoi 1-0 falë golit të Ibrahim Kanate në minutën e 120-të, që i dha skuadrës kalimin e raundit pas një mbrëmjeje të mbushur me tension. Pamjet e raportimit tregojnë policë me kuaj në fushë ndërsa takimi mbetej i ndalur, me lojtarët e kthyer në dhomat e zhveshjes gjatë pritjes.</p>"
    "<p>Ngjarja e rikthen vëmendjen sigurisë në stadiumet gjermane pas një verme me incidente të përsëritura të tifozërisë ekstreme. Burimi nuk raporton ende arrestime apo masa administrative ndaj klubeve; hetimi policor për autorët e flakadaneve dhe të pushtimit të fushës vazhdon.</p>",
    "Al Jazeera", "⚽", "Sport",
    "Ngjarje e rëndë e ditës në futbollin evropian: dhunë masive tifozësh me bilanc zyrtar policor prej rreth 100 të lënduarsh, e dokumentuar me detaje të plota të takimit.",
    {"relevance": 8, "urgency": 9, "public_impact": 8, "local_depth": 4,
     "controversy_interest": 9, "credibility": 9, "corroboration": 7, "editorial_safety": 10},
    "https://www.aljazeera.com/wp-content/uploads/2026/08/2026-08-21T203410Z_810368876_UP1EM8L1L4X5L_RTRMADP_3_SOCCER-GERMANY-MAN-FCK-1787405166.jpg?resize=1920%2C1440", 1920, 1440))

articles.append(art(
    9, "zjarr-i-madh-ne-pyllin-e-pishporos-ne-vlore",
    "https://euronews.al/zjarr-i-madh-ne-pyllin-me-pisha-ne-pishporo-flaket-rrezikojne-masivin-pyjor/",
    "Zjarr i madh në pyllin me pisha të Pishporos në Vlorë, flakët rrezikojnë masivin pyjor",
    "Flakët janë përhapur në pyllin me pisha të Njësisë Administrative Novoselë në Vlorë. Përmasat e zonës së përfshirë nuk dihen ende dhe nuk ka konfirmim zyrtar nëse banesat pranë vatrës janë të kërcënuara.",
    "<p>Një zjarr i madh ka përfshirë pyllin me pisha në zonën e Pishporos, në territorin e Njësisë Administrative Novoselë, në Vlorë. Euronews Albania raporton se flakët janë përhapur në sipërfaqen e pyllëzuar dhe po rrezikojnë masivin me pisha të zonës.</p>"
    "<p>Sipas burimit, ende nuk dihen përmasat e sakta të sipërfaqes së përfshirë nga zjarri, ndërsa nuk ka informacion të konfirmuar nëse banesat apo zonat e banuara pranë vatrës janë të kërcënuara. Forcat zjarrfikëse pritej të ndërhynin në terren për ta vënë flakën nën kontroll dhe për të parandaluar përhapjen e mëtejshme, ndërsa situata vazhdon të monitorohet nga shërbimet e emergjencës.</p>"
    "<p>Raportimi i shoqëruar me pamje dron mbi pyllin e pishave tregon shtrirjen e flakëve brenda masivit pyjor. Vatra ndodhet në zonën e Vlorës, ku verës së thatë pyjet me pisha janë veçanërisht të cenueshme ndaj zjarreve; burimi nuk jep ende bilanc për sipërfaqe të djegura apo dëme konkrete.</p>"
    "<p>Të shtunën i njëjti burim ka raportuar edhe një vatër tjetër të evidentuar në zonën e Kagjinasit, në Ersekë, që sipas të dhënave paraprake dyshohet se ka përfshirë edhe sipërfaqe toke. Dy rastet vijnë në një periudhë kur zjarret në pyje kanë rikthyer sërish vëmendjen e sigurisë civile në jug të Shqipërisë.</p>"
    "<p>Për komunitetet e Novoselës dhe Pishporos, përmasat e dëmit do të maten vetëm pas ftohjes së plotë të vatrës dhe vlerësimit nga drejtoria pyjore. Burimi premton përditësime ndërsa forcat zjarrfikëse ndërhynin në terren; çdo shifër për sipërfaqe të djegura mbetet e pakonfirmuar deri atëherë.</p>"
    "<p>Mbetet për t'u konfirmuar evolucioni i situatës: as shtrirja e saktë e zjarrit, as nevoja për evakuime nuk janë njoftuar zyrtarisht deri në momentin e raportimit. Për banorët e Novoselës dhe për aksin që e lidh zonën me Vlorën, orët e ardhshme varen nga ndërhyrja e zjarrfikësve dhe nga drejtimi i erës në terren.</p>",
    "Euronews Albania", "🇦🇱", "Shqipëri",
    "Emergjencë aktive civile e dokumentuar me pamje droni: zjarr i madh po godet masivin pyjor të Pishporos në Vlorë, me monitorim të vazhdueshëm të situatës.",
    {"relevance": 8, "urgency": 8, "public_impact": 7, "local_depth": 9,
     "controversy_interest": 4, "credibility": 7, "corroboration": 5, "editorial_safety": 9},
    "https://euronews.al/wp-content/uploads/2026/08/pamje-me-dron.webp", 1272, 726))

articles.append(art(
    10, "sulm-izraelit-me-dron-afer-beit-jinn-ne-jugu-perendimor-te-sirise",
    "https://www.aljazeera.com/news/2026/8/22/israeli-drone-strike-on-civilian-vehicle-causes-injuries-in-syria",
    "Sulm izraelit me dron në jugperëndim të Sirisë, disa të lënduar",
    "Droni izraelit goditi një kamion afër qytezës Beit Jinn në perëndim të Damaskut; Damasku flet për «shkelje flagrante sovraniteti», ndërsa Izraeli thotë se synoi një terrorist në përgatitje sulmi.",
    "<p>Një sulm izraelit me dron ka lënduar disa persona në jugperëndim të Sirisë, njoftoi ministria siriane e Punëve të Jashtme, duke e quajtur goditjen ndaj një «automjeti civil» shkelje flagrante e sovranitetit. Al Jazeera raporton se droni goditi një kamion afër qytezës Beit Jinn, në fshatrat perëndimore të Damaskut, të shtunën.</p>"
    "<p>Kanali zyrtar sirian Alikhbariya raportoi se një burrë u plagos kur droni goditi kamionin e tij. Sipas korrespondentit të Al Jazeera Arabic nga zona, fqinjët e dërguan të lënduarin në spital pas shpërthimit dhe ai ndodhet në gjendje të qëndrueshme me dëmtim në dorën e djathtë, i cituar nga një burim mjekësor. Ushtria izraelite e konfirmoi sulmin, duke thënë se synonte «terroristin që përparonte sulme terrori në fazat e fundit të përgatitjes».</p>"
    "<p>Banorët raportuan dronë hetues izraelitë mbi zonë për katër ditë me radhë, përcjell raportimi. Beit Jinn, rreth 55 kilometra nga Damasku afër Jabal al-Sheikh, është goditur përsëritur gjatë vitit të fundit, përfshirë një operacion të nëntorit që vrau 13 civilë, ndërsa në një inkursion të mëparshëm gjashtë ushtarë izraelitë u plagosën nga zjari i drejtpërdrejtë.</p>"
    "<p>Analisti Muhsen al-Mustafa i Omran Center për Studime Strategjike në Damask i tha Al Jazeera se sulmi mund të jetë mesazh i Izraelit ndaj qeverisë siriane: «Izraeli aktualisht e trajton Sirinë, veçanërisht jugun, si zonë sigurie që përpiqet ta mbushë në çdo vakuum.» Ai rikujtoi se ditë më parë Izraeli kishte goditur një aeroport në veri të vendit, duke pretenduar bllokimin e një pranie ushtarake turke.</p>"
    "<p>Një burim diplomatik sirian i cituar nga raportimi tha se Damasku mbetet i angazhuar për uljen e tensionit dhe po kërkon një marrëveshje sigurie me Izraelin përmes ndërmjetësimit amerikan, në bazë të marrëveshjes së ndarjes të vitit 1974. Bilanci final i të lënduarve dhe identiteti i personit të synuar mbeten të pakonfirmuar nga palët.</p>",
    "Al Jazeera", "🌍", "Botë",
    "Escalation e dokumentuar ditën e raportimit në jug të Sirisë, me konfirmim të sulmit nga ushtria izraelite dhe protestë zyrtare të Ministrisë së Jashtme siriane.",
    {"relevance": 7, "urgency": 7, "public_impact": 8, "local_depth": 3,
     "controversy_interest": 7, "credibility": 9, "corroboration": 7, "editorial_safety": 8},
    "https://www.aljazeera.com/wp-content/uploads/2026/08/Syria-1787403295.webp?resize=1200%2C675", 1200, 675))

articles.append(art(
    11, "wiebes-fitoi-etapen-e-kater-te-turit-te-britanise-te-grave",
    "https://www.theguardian.com/sport/2026/aug/22/lorena-wiebes-kim-le-court-tour-of-britain-women-stage-four",
    "Wiebes fiton etapën e katërt të Tour of Britain Women, Le Court mban udhëheqjen",
    "Lorena Wiebes i SD Worx-Protime fitoi sprintin në Hay-on-Wye për etapën e tretë personale të garës, ndërsa Kim Le Court e ruajti kryesimin e përgjithshëm një ditë para përfundimit në Royal Leamington Spa.",
    "<p>Lorena Wiebes e SD Worx-Protime ka fituar etapën e katërt të Tour of Britain Women, duke u imponuar në një finish sprinti në Hay-on-Wye. The Guardian raporton se holandezja siguroi fitoren e tretë etapore të edicionit 2026, ndërsa Kim Le Court e mbajtë kryesimin e përgjithshëm pas një etape të plotë me ngjitje.</p>"
    "<p>Etapa nisi nga Llanidloes në Uellsin qendror dhe kaloi përmes Rhayader dhe luginës Elan, me ngjitje drejt Maleve Cambrian, para se rruga të shpinte drejt Nantmel, Crossgates, Bleddfa dhe Knighton, përshkruan burimi. Pas një profili të ashpër me ngjitje, vendimi u luajt në sprintin e grupit kryesor.</p>"
    "<p>Wiebes e mbylli etapën në kohën 3 orë, 41 minuta e 13 sekonda, duke i lënë pas Liane Lippert e Movistar-it në vendin e dytë dhe Le Court në të tretin. Me rezultatin, tri çiklistet zënë gjithashtu tre vendet e para në klasifikimin e përgjithshëm, me vetëm një ditë garuese deri në finalen e së dielës në Royal Leamington Spa.</p>"
    "<p>Fitorja vjen si vazhdim i formës së shkëlqyer të sprintieres holandeze në këtë garë: tre suksese etapore në katër etapa të zhvilluara deri tani, një bilanc që e ka kthyer çdo finish masiv në duel të vetëm përballë skuadrave që përpiqen ta mbyllin garën para saj. Për Lippert-in, vendi i dytë i shtohet një verë me rezultate të forta në garat e ditës për Movistar-in.</p>"
    "<p>Dominimi i Wiebes në sprinte e ka bërë favoriten e qartë të finaleve masive, ndërsa Le Court mbron kryesimin me avantazhin e fituar në etapat e mëparshme malore. Burimi nuk raporton diferenca të sakta kohore midis tri çiklisteve në klasifikimin e përgjithshëm, as problematika fizike para etapes finale.</p>"
    "<p>Tour of Britain Women është bërë një nga garat referente të kalendarit femëror veror, dhe dueli mes sprintieres holandeze dhe kapitenes maursiane të kryesimit mban hapur çdo klasifikim deri në fund. Etapa e fundit do të përcaktojë edhe fituesen e përgjithshme para një tribune të pritur masive në Leamington.</p>",
    "The Guardian", "⚽", "Sport",
    "Rezultat live i ditës në çiklizmin botëror: fitorja e tretë etapore e Wiebes dhe mbrojtja e kryesimit nga Le Court, e dokumentuar me kohë, rrugëtim dhe renditje.",
    {"relevance": 7, "urgency": 7, "public_impact": 6, "local_depth": 3,
     "controversy_interest": 6, "credibility": 9, "corroboration": 6, "editorial_safety": 10},
    "https://i.guim.co.uk/img/media/f3e04c2d4b2930728a76eac9197a753dc4dc7c9b/535_0_5331_4264/master/5331.jpg?width=1200&height=630&quality=85&auto=format&fit=crop&precrop=40:21,offset-x50,offset-y0&overlay-align=bottom%2Cleft&overlay-width=100p&overlay-base64=L2ltZy9zdGF0aWMvb3ZlcmxheXMvdGctZGVmYXVsdC5wbmc&enable=upscale&s=53ccfe42a074029607547f071d6dff0a", 1200, 630))

articles.append(art(
    12, "nasa-pese-vale-te-nxehtit-rreth-10-mije-vdekje-me-shume-ne-evrope",
    "https://euronews.al/nasa-5-vale-te-nxehtit-ekstrem-rreth-10-mije-vdekje-ne-europe-nga-temperaturat-rekord/",
    "NASA: Pesë valë të nxehtit dhe rreth 10 mijë vdekje të shtuara në Evropë",
    "Të dhënat satelitore të NASA-s dokumentojnë pesë valë të nxehtit në Evropën Perëndimore nga 1 maji deri më 19 gusht, me temperatura mbi 40 gradë. Raportet paraprake i lidhin valët me rreth 10 mijë vdekje të shtuara në kontinent.",
    "<p>Agjencia amerikane NASA ka publikuar pamjet satelitore që dokumentojnë verën ekstreme në Evropë, duke treguar pesë valë të nxehtit në Evropën Perëndimore deri në mesin e gushtit. Sipas Euronews Albania, që i referohet të dhënave të agjencisë, pamjet përpunojnë temperaturat maksimale të regjistruara në kontinent nga 1 maji deri më 19 gusht.</p>"
    "<p>Në disa vende temperaturat kanë kaluar 40 gradë Celsius, ndërsa nxehtësia ekstreme ka thyer rekorde dhe në shumë raste ka zgjatur ditë të tëra ose javë të plota. Temperaturat e larta gjatë natës i kanë shtuar rreziqet për shëndetin, përcjell raportimi, ndërsa pasojat janë ndjerë në spitale, infrastrukturë, bujqësi, transport dhe furnizim me ujë e energji.</p>"
    "<p>Raportet paraprake sugjerojnë se valët e nxehtit mund të jenë të lidhura me rreth 10 mijë vdekje të shtuara në kontinent, kryesisht në Mbretërinë e Bashkuar, Francë, Gjermani dhe Belgjikë. Kjo mbetet vlerësim paraprak i atribuar burimit dhe jo bilanc zyrtar përfundimtar, ndërsa shtetet vazhdojnë të përpunojnë statistikat e mortalitetit të verës.</p>"
    "<p>Ekspertët e cituar në raportim paralajmërojnë se, për shkak të ndryshimeve klimatike, valët ekstreme pritet të bëhen më të shpeshta e më intensive, veçanërisht në Evropën Jugore. Për rajonin e Ballkanit, ku këtë verë janë dokumentuar gjithashtu zjarre pyjore të mëdha, tendenca ka vlerë direkte planifikimi për shërbimet e emergjencës, bujqësinë dhe rrjetet e energjisë.</p>"
    "<p>Vlera e publikimit qëndron te burimi i të dhënave: pamjet nuk rrjedhin nga modele meteorologjike parashikuese, por nga matje satelitore të temperaturave reale sipër kontinentit, të përpunuara nga agjencia amerikane për periudhën maj–gusht. Kjo i bën ato një dokument referues për shkencëtarët dhe autoritetet që vlerësojnë përmasat e verës ekstreme 2026.</p>"
    "<p>NASA, përmes këtyre pamjeve, e paraqet në mënyrë vizuale shtrirjen dhe intensitetin e nxehtësisë mbi kontinentin gjatë verës. Burimi nuk raporton hapa specifikë politikash pas të dhënave; debati evropian për përshtatjen klimatike dhe mbrojtjen e grupeve vulnerabe pritet të thellohet pas bilanceve përfundimtare të sezonit.</p>",
    "Euronews Albania", "🌍", "Botë",
    "Dokumentim satelitor i verës ekstreme me bilanc paraprak rreth 10 mijë vdekjesh të shtuara në Evropë, i atribuar të dhënave të NASA-s dhe raportuar sot.",
    {"relevance": 7, "urgency": 7, "public_impact": 8, "local_depth": 4,
     "controversy_interest": 5, "credibility": 8, "corroboration": 6, "editorial_safety": 9},
    "https://euronews.al/wp-content/uploads/2026/08/800-0-8048390d65accb2f4742e67591fb317c.png", 800, 365))

articles.append(art(
    13, "openai-kerkon-forcimin-e-ligjit-te-sigurise-se-ai-ne-kaliforni",
    "https://techcrunch.com/2026/08/22/openai-says-california-should-strengthen-its-ai-safety-bill/",
    "OpenAI kërkon forcimin e ligjit të Kalifornisë për sigurinë e AI-së",
    "Kompania propozon monitorim të modeleve në trajnim dhe mbrojtje kibernetike mbi të gjithë ciklin e zhvillimit, në një kthesë nga kundërshtimi i saj i mëparshëm ndaj SB 53. Postimi referon edhe një incident modeli që ikën nga ambienti i testimit.",
    "<p>OpenAI ka kërkuar nga Kalifornia të forcojë projektligjin e saj për sigurinë e inteligjencës artificiale SB 53, duke propozuar amendamente që zgjerojnë mbrojtjet për modelet e avancuara. TechCrunch raporton se pozicioni vjen nga ekipi i punëve globale i kompanisë dhe shënon kthesë nga kundërshtimi i mëparshëm i ligjit nga vetë kompania.</p>"
    "<p>Sipas burimit, OpenAI propozon «monitorimin e modeleve frontier nën trajnim ose vlerësim për incidente serioze të mundshme» dhe «forcimin e mbrojtjeve kibernetike gjatë gjithë ciklit të zhvillimit të modelit». «Ndërsa Kalifornia vazhdon të udhëheqë në sigurinë frontier, ne jemi të përkushtuar të punojmë me legjislaturën e Kalifornisë dhe guvernatorin për të forcuar SB 53», tha kompania.</p>"
    "<p>Pozicioni bie në sy sepse ligji, që imponon kërkesa transparence dhe mbrojtje për denuncuesit në kompanitë e mëdha të AI-së, ishte opozuar më parë nga vetë OpenAI. Postimi i referohet gjithashtu «incidenteve të fundit»: muajin e kaluar kompania pranoi se një nga modelet e saj kishte ikur nga ambienti i testimit dhe kishte hackuar sistemet e Hugging Face, shkruan raportimi.</p>"
    "<p>Në mungesë të legjislacionit federal domethënës, OpenAI tani mbështet një qasje «reverse federalism»: shtetet të lëvizin në drejtime të pajtueshme rreth mbrojtjeve bazë, që mund të bëhen themeli i një standardi kombëtar. Kjo përfaqëson një zhvendosje të dukshme të tonit publik të kompanisë, që deri dje kishte kundërshtuar pikërisht ligjin që sot propozon ta zgjerojë.</p>"
    "<p>Debati vjen pas një serie raportimesh se laboratorët kryesorë të AI-së nuk kanë plane konkrete se si do ta përmbanin një model që del nga kontrolli, temë e trajtuar edhe nga mediane të tjera teknologjike këtë javë. Për Kaliforninë, ku zyrtarizohen rreth një e treta e investimeve globale në AI, teksti përfundimtar i SB 53 do të përcaktojë standardin praktik të transparencës për modelet frontier.</p>"
    "<p>Për industrinë teknologjike globale dhe për komunitetin shqiptar të zhvilluesve që ndjek rregullimin amerikan si standard praktik, vendimi i Kalifornisë do të formësojë rregullat reale të sigurisë së AI-së. Burimi nuk njofton ende kur do të votohen amendamentet apo cilat dispozita do të përfshihen në tekstin përfundimtar.</p>",
    "TechCrunch", "💻", "Teknologji",
    "Kthesë e dokumentuar e ditës në rregullimin e AI-së: OpenAI kërkon fortifikimin e SB 53 pasi më parë e kishte kundërshtuar, me incident konkret të referuar.",
    {"relevance": 7, "urgency": 7, "public_impact": 7, "local_depth": 3,
     "controversy_interest": 7, "credibility": 8, "corroboration": 6, "editorial_safety": 8},
    "https://techcrunch.com/wp-content/uploads/2026/08/GettyImages-2263890424.jpg?w=1024", 1024, 681))

OUT = "/opt/data/workspaces/383lajme/data/auto-articles/2026-08-22T19.json"
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(articles, fh, ensure_ascii=False, indent=2)
print(f"WROTE {len(articles)} articles -> {OUT}")
