export interface Article {
  id: string;
  slug: string;
  url?: string;
  dispatch: string;
  title: string;
  excerpt: string;
  body: string;
  source: string;
  sourceFlag: string;
  sourceBias: 'neutral' | 'pro-kosovo' | 'critical' | 'hostile';
  tone: 'positive' | 'neutral' | 'negative';
  category: string;
  publishedAt: string;
  createdAt?: string;
  readingTime: number;
  featured: boolean;
  imageUrl?: string;
  engagementScore?: number;
  videoClipUrl?: string;
}

export const MOCK_ARTICLES: Article[] = [
  {
    id: "1",
    slug: "kosova-be-raport-2025",
    dispatch: "01",
    title: "BE publikon raportin e progresit për Kosovën: Hapa pozitivë por sfida mbeten",
    excerpt:
      "Komisioni Evropian ka vlerësuar përparimin e Kosovës drejt anëtarësimit, duke theksuar reformat gjyqësore dhe luftën kundër korrupsionit.",
    body: `Komisioni Evropian ka publikuar raportin vjetor te progresit per Kosoven, duke vleresuar ne menyre gjitheperfshines ecurine e reformave ne te gjithe fushat kryesore te integrimit europian. Dokumenti i zgjeruar perfshin analiza te detajuara mbi sektoret e drejtesise, luften kunder korrupsionit, lirite themelore dhe te drejtat e komuniteteve ne te gjitha dimensionet e tyre. Vleresimi pozitiv per zbatimin e marreveshjes bazike me Serbine dhe per reformat gjyqesore pershkruhet si arritja kryesore e periudhes se fundit. Komisioni veçon permiresimin e efikasitetit te sistemit te drejtesise si hap kritik drejt standardeve europiane te shtetet aspirante per anetaresim. Megjithate, dokumenti 120 faqesh identifikon sfida te mbetura serioze te cilat kerkojne adresim te vazhdueshëm dhe konsistent nga institucionet kosovare. Papunesia e larte sidomos tek te rinjte, emigrimi masiv i kapitalit njerezor dhe pabarazia rajonale mbeten sfida prioritare qe kerkojne politika strukturore afatgjate dhe te koordinuara me partnerët nderkombetare. Kryeministri kosovar priti raportin me qendrim konstruktiv dhe theksoi angazhimin e qeverise per zbatimin e te gjithe pikave te rekomanduara per periudhën qe vjen. Ai veçoi liberalizimin e vizave si nje nga arritjet me konkrete qe ka ndikuar drejtperdrejt ne cilesine e jetes se qytetareve kosovar. Opozita parlamentare kerkoi llogaridhenie per vonesën e reformave dhe theksoi se ritmi i progresit eshte ngadalesuar nen qeverine aktuale ne disa sektore specifike te identifikuara nga Komisioni. Organizatat e shoqerise civile vleresuan raportin si realist dhe theksuan nevojën per monitorim te pavarur te zbatimit te reformave te rekomanduara nga qeveria. Ato kerkuan transparencë me te madhe ne institucionet publike dhe permiresim te mekanizmave te llogaridheniës per zyrtaret ne te gjitha nivelet e administrates publike. Parlamenti Europian do te diskutoje gjeresisht raportin ne sesionin plenar te muajit te ardhshem ku priten debate te rendesishme per perspektiven e anetaresimit. Statusi i kandidatit per anetaresim mbetet prioriteti strategjik i politikes se jashtem kosovare dhe nje objektive me mbeshtetje te gjere publike ndermjet partive politike kryesore. Bashkimi Europian ka konfirmuar vazhdimesine e fondeve te asistences per zbatimin e reformave te rekomanduara. Instrumenti IPA dhe mekanizmat e tjere te financimit europian do te mbeshtesin financiarisht procesin e transformimit institucional te nevojshem per integrimin e plote ne komunitetin europian.`,
    source: "Reuters",
    sourceFlag: "🇬🇧",
    sourceBias: "neutral",
    tone: "positive",
    category: "Politikë",
    publishedAt: "2025-05-20T08:00:00Z",
    readingTime: 4,
    featured: true,
    imageUrl: "https://picsum.photos/seed/kosova-be-raport/800/500",
  },
  {
    id: "2",
    slug: "ekonomia-kosoves-rritje",
    dispatch: "02",
    title: "FMN: Ekonomia e Kosovës pritet të rritet 4.2% në 2025",
    excerpt:
      "Fondi Monetar Ndërkombëtar ka rishikuar parashikimet ekonomike për Kosovën, duke projeksionuar rritje më të lartë se sa pritej.",
    body: `Parashikimet ekonomike te Fondit Monetar Nderkombetar per Kosoven jane rishikuar ne drejtim pozitiv, duke projektuar nje rritje te GDP-se prej 4.8 perqind per vitin aktual. Ky nivel tejkalon mesataren rajonale dhe pasqyron performancën pozitive te sektoreve kryesore si ndertimi, tregtia me shumice dhe sherbimet financiare te vendit. Analiza e FMN-se thekson se stabiliteti fiskal i Kosoves ka qene i qendrueshëm gjate viteve te fundit dhe ka rritur besueshmërinë e vendit si partner ekonomik rajonal. Te ardhurat tatimore dhe doganore jane rritur ne menyre te vazhdueshme duke kontribuar ne stabilitetin e buxhetit dhe duke lejuar rritje te investimeve publike ne infrastrukture. Megjithate, ekspertet nderkombetare theksojne sfida strukturore qe kerkojne adresim prioritar per nje rritje ekonomike me te qendrueshme dhe gjitheperfshirese. Investimet e huaja direkte mbeten nen potencialin e vendit dhe kufizojne transferimin e teknologjise dhe krijimin e vendeve te punes te kualifikuara ne sektore strategjike te ekonomise. Sektori bankar vlerësohet si i qendrueshëm nga ana e FMN-se me tregues te pranueshme te kapitalizimit dhe likuiditetit. Normat e kredive jo-performuese ndodhen ne nivel te kontrollueshem ndersa huazimi per sektorin privat ka shenuar rritje te konsiderueshme ne vitet e fundit. Inflacioni ka zbritur gradualisht nga kulmet e arritura gjate krizës energjetike globale dhe tashme ndodhet brenda kufijve te pranueshëm per nje ekonomi te hapur europiane. Ministri i Financave priti me optimizem vleresimin e FMN-se dhe prezantoi planin ambicioz per investime publike ne infrastrukturë rrugore, energjetike dhe dixhitale per periudhën e ardhshme. Ekspertet e shoqerise civile dhe organizatat nderkombetare kerkojne qe rimëkembja ekonomike te shoqerohet me politika sociale efektive qe adresojne pabarazine ne te ardhura midis popullates urbane dhe asaj rurale. Komuniteti i biznesit kosovar ka vleresuar me optimizem parashikimet e FMN-se dhe ka kerkuar vazhdimin e reformave per te permiresuar ambientin rregullator dhe per te reduktuar barrën administrative mbi kompanitë. Sipas analisteve te pavarur, reformimi i tregut te punes dhe investimet ne arsim te larte e formim profesional jane parakushte thelbësorë per nje rritje ekonomike te qendrueshme ne afat te gjate. Projektet infrastrukturore te financuara nga BE dhe institucionet financiare nderkombetare jane identifikuara si katalizatore kryesore te zhvillimit ekonomik kosovar per dekadat qe vijne.`,
    source: "Bloomberg",
    sourceFlag: "🇺🇸",
    sourceBias: "neutral",
    tone: "positive",
    category: "Ekonomi",
    publishedAt: "2025-05-20T06:30:00Z",
    readingTime: 3,
    featured: false,
    imageUrl: "https://picsum.photos/seed/ekonomia-kosoves/800/500",
  },
  {
    id: "3",
    slug: "nato-kosove-stervitje",
    dispatch: "03",
    title: "NATO dhe KFOR intensifikojnë stërvitjet në veri të Kosovës",
    excerpt:
      "Forcat e NATO-s kanë filluar një seri stërvitjesh ushtarake në veri të Kosovës, duke dërguar mesazh qartë për angazhimin e aleancës.",
    body: `Forcat e KFOR-it te udhehequra nga NATO zhvilluan nje ushtrim te madh operacional per te testuar gatishmerine ne terren ne Kosove gjate dy diteve te fundit. Ushtrimi gjitheperfshines perfshiu mbi gjashteqind ushtare nga njezet vende anetare qe testuan koordinimin e forcave ndermjet shteteve qe kontribuojne ne mision, interoperabilitetin e sistemeve te ndryshme te armëve dhe pajisjeve dhe procedurat standarde te punes nen skenarë te simuluar te tensionit dhe krizës. Komandanti i KFOR-it theksoi se ushtrimi demonstruar me sukses gatishmerine e larte operacionale te forcave nderkombetare. Ai shtoi se prania e KFOR-it ne Kosove vazhdon te jete nje garanci vendimtare per stabilitetin e rajonit dhe per mbeshtetjen e institucioneve vendase te sigurise ne çdo skenar te mundshëm te destabilizimit. Sipas deklaratës zyrtare, ushtrimi perfshiu skenarë te rendesishme operacionale duke filluar nga menaxhimi i turmave dhe kufizimi i incidenteve te mundshme, kalimi ne zonat kufitare, dhe deri tek operacionet komplekse te kerkimit dhe shpetimit ne terren malor e te veshtire. Skenari me sfidues ishte ai i fundit, qe testoi ne menyre intensive bashkëpunimin operacional ndermjet KFOR-it, Forcës se Sigurise se Kosoves dhe sherbimeve te emergjencës civile. Forca e Sigurise se Kosoves mori pjese aktive ne disa faza te ushtrimit, duke demonstruar kapacitetet e saj ne rritje. Komandanti i FSK-se tha se institucionet vendase te sigurise po zhvillohen ne menyre te shpejte dhe jane ne nje rruge te drejte drejt integrimit me te plote me strukturat aleate sipas standardeve te dakorduar. Bashkëpunimi mes KFOR-it dhe FSK-se u vleresua pozitivisht nga vezhguesit ushtarake nderkombetare te pranishem gjate ushtrimit. NATO ka shtuar prezencën e saj ne Ballkan si pjese e nje politike me te gjere rajonale per te forcuar stabilitetin. Investimet ne kapacitetet e forcave lokale te sigurise dhe ne trajnimin e personelit ushtarak kosovar jane rritur ne vitet e fundit. Analiste te sigurise theksojne se stabiliteti i Kosoves eshte i lidhur ngushte me perspektivën europiane te vendit dhe me procesin e integrimit ne strukturat atlantike. Normalizimi i marrëdhënieve me Serbine, si edhe reformat e brendshme institucionale, jane elemente kryesore per nje arkitekture te qendrueshme sigurie afatgjate ne regjion. Keshilli Kombetar i Sigurise te Kosoves ka miratuar nje strategji te rishikuar te sigurise kombetare qe perfshin rreziqet e reja te identifikuara ne mjedisin rajonal dhe global. Dokumenti i rishikuar vendos prioritet bashkepunimin me aleatët, forcimin e kapaciteteve te inteligjencës dhe zhvillimin e nje sistemi reagimi me efektiv ndaj kercënimeve te reja. Ministria e Mbrojtjes ka njoftuar nje plan pesevjecar per modernizimin e FSK-se i cili parashikon blerje te pajisjeve te reja te sferës ushtarake, trajnime intensive dhe permiresim te strukturës komanduese. Fondimi do te vije pjeserisht nga buxheti kombetar dhe pjeserisht nga mbeshtetja e aleateve perindimore. Bashkesia nderkombetare ka qene unanime ne mbeshtetjen e stabilitetit te Kosoves. Shtetet e Bashkuara e Amerikes, Mbreteria e Bashkuar, Gjermania dhe vendet e tjera te G7 kane konfirmuar vazhdimesine e angazhimit te tyre per sigurine e vendit. Parlamenti i Kosoves ka debatuar gjeresisht per politiken e mbrojtjes dhe per perspektiven e anetaresimit ne NATO. Grupet parlamentare ndajne mendimin se anëtaresia ne NATO eshte objektive strategjike dhe se duhet te behet prioritet i politikes se jashtem. Opinioi publik kosovar mbeshtet me force prezencën e KFOR-it, sipas sondazheve te fundit te organizatave rajonale te kerkimit. Mbi 75 perqind e qytetareve e shohin forcen nderkombetare si nje faktor stabilizues dhe te dobishëm per qetesine e vendit.`,
    source: "DW",
    sourceFlag: "🇩🇪",
    sourceBias: "neutral",
    tone: "neutral",
    category: "Siguri",
    publishedAt: "2025-05-19T14:00:00Z",
    readingTime: 5,
    featured: false,
    imageUrl: "https://picsum.photos/seed/nato-kosove-kfor/800/500",
  },
  {
    id: "4",
    slug: "diaspora-investime-kosove",
    dispatch: "04",
    title: "Diaspora shqiptare dërgon mbi 1 miliard euro në Kosovë gjatë 2024",
    excerpt:
      "Remitancat nga diaspora shqiptare kanë arritur nivele rekorde, duke bërë Kosovën ndër vendet me varësinë më të lartë nga remitancat.",
    body: `Banka Qendrore e Kosoves ka raportuar nje rritje te remitencave ne vleren rekorde prej nje miliard e dyqind milione euro gjate vitit te kaluar, qe eshte nje rritje prej dyzete milionesh euro krahasuar me vitin e meparshem. Ky trend i vazhdueshem pozitiv tregon se diaspora kosovare vazhdon te mbeshtes familjet vendase dhe te kontribuoje ne menyre te rendesishme ne ekonomine e vendit. Remitencat ndikojne drejtperdrejt ne standardin e jeteses se nje pjese te madhe te familjeve kosovare duke permiresuar fuqinë blerëse te tyre. Buxhetet familjare qe marrin remitenca shpenzojne me teper per arsim, shendetesi, banesa dhe mallra te qendrueshme te konsumit. Kjo shpenzim stimulon aktivitetin ekonomik vendor dhe mbeshtet sektoret e ndertimit dhe tregtise me pakicë. Ekonomistet vleresojne se rreth njezet perqind e familjeve ne Kosove marrin rregullisht remitenca nga anetare te diasporës qe jetojne ne Europë dhe ne vendet e Gjirit arab. Diaspora kosovare numeron rreth dymijë e pesëqind mije njerezë te shperndare kryesisht ne Gjermani, Zvicër, Austri, Itali dhe vendet nordike. Komuniteteve te forta ne keto vende kane bere investime te konsiderueshme ne ekonomine e Kosoves, sidomos ne sektorin e hoteleri-turizmit, tregtise dhe ndertimit rezidencial ne qytete te ndryshme. Banka Qendrore ka ndermarre nisma per te zhvilluar produkte financiare qe terhejne me teper kapital te diasporës per investime produktive afatgjate. Obligacionet e diasporës, depozitat me afat me norma preferenciale dhe fondet e investimeve ne sektore specifike jane instrumente financiare qe jane duke u studiuar dhe pilotuar ne bashkepunim me institucionet financiare nderkombetare. Analiste theksojne se potenciali total i remitencave eshte me i madhe sesa numrat aktual. Nese vetem njezet perqind e remitencave do te ridrejtohej per investime prodhuese, kjo do te gjeneronte mbi dyqind milione euro investime shtese çdo vit per sektore si bujqesia, prodhimi industrial, turizmi dhe industria e teknologjise. Qeveria ka hapur nje agenci te dedikuar per bashkepunim me diasporën e cila ofron asistence te personalizuar per investitoret qe duan te investojne ne Kosove. Agjencia ndihmon investitoret te kuptojne sistemin ligjor dhe rregullator kosovar, identifikojne mundesi biznesi konkrete dhe lidhen me partnere lokalë te pershtatshem. Komunitetet e diasporës ne Europë jane shume te organizuara dhe kane krijuar shoqata kulturore, ekonomike dhe politike efektive ne vendet pritese. Keto shoqata luajne rol te rendesishem si ura lidhese mes Kosoves dhe vendeve pritese, duke avancuar imazhin e vendit dhe duke lobuar per interesat kosovare ne institucionet europiane dhe nderkombetare. Sektori financiar kosovar ka pesuar transformime te rendesishme ne pese vitet e fundit. Hyrja e bankave te reja nderkombetare ka intensifikuar konkurrencen dhe ka permiresuar kushtet per konsumatoret dhe biznesin. Normat e interesit per depozitat jane bere me favorable ndersa kostot e kredive per kompanitë e mesme jane ulur duke lehtesuar aksesin ne kapital per sipermares. Remitencat ndikojne gjithashtu ne tregun e pasurive te paluajtshme. Kerkesa per banesa ne qytetet kryesore si Pristine, Prizren dhe Gjilan mbetet e larte, e ushqyer pjeserisht nga investimet e diasporës dhe te qytetareve qe kthehen pas viteve te punës jashtë. Kjo dinamike ka mbeshtetuar industrine e ndertimit por ka rritur gjithashtu çmimet e banesave per familjet me te ardhura te mesme. Ekspertet e ekonomise rekomandojne politika per te diversifikuar burimet e te ardhurave te ekonomise kosovare dhe per te reduktuar varësinë e tepruar nga remitencat si burim kryesor i te ardhurave valutore. Investimet ne arsimin e larte, kerkimin shkencor dhe sektoret me teknologji te larte mund te prodhojne te ardhura me te larta per brezat e rinj dhe te reduktojne emigracionin ekonomik qe vazhdon ne shkalle te larte. Ministria e Financave ka mbikeqyrur rritjen e buxhetit per investime publike ne infrastrukture duke synuar qe kjo te shtyjë gjithashtu investimet private. Projekte te rendesishme si zgjerimi i rrugeve, permiresimi i aeroportit dhe rehabilitimi i sistemit hekurudhor jane te planifikuara dhe do te ndihmojne ne integrimin ekonomik rajonal. Bashkimi Europian ka ofruar fonde te konsiderueshme per zhvillimin ekonomik te Kosoves nepermjet instrumentit IPA dhe mekanizmave te tjere te mbeshtetjes financiare. Nese keto fonde perdoren efektivisht dhe ne kohe, mund te ndihmojne ne modernizimin e infrastrukturës fizike dhe dixhitale te vendit duke krijuar kushte me te mira per rritje afatgjate ekonomike.`,
    source: "AP",
    sourceFlag: "🇺🇸",
    sourceBias: "neutral",
    tone: "positive",
    category: "Ekonomi",
    publishedAt: "2025-05-19T10:00:00Z",
    readingTime: 3,
    featured: false,
    imageUrl: "https://picsum.photos/seed/diaspora-investime/800/500",
  },
  {
    id: "5",
    slug: "kosova-sport-kampionat",
    dispatch: "05",
    title: "Ekipi kombëtar i Kosovës kualifikohet për fazën e grupeve të Ligës së Kombeve",
    excerpt:
      "Kombëtarja e futbollit e Kosovës ka arritur kualifikimin historik pas fitoreve të rëndësishme ndaj skuadrave evropiane.",
    body: `Futbollistet e kombetares se Kosoves shperblyen punën e vazhdueshme te viteve me nje fitore historike kunder njeres nga skuadrat me konkurruese te Europes. Golat e shenuara ne minutat e para te lojës demonstruan nivelin e larte te gatishmerisë fizike dhe taktike te ekipit nën drejtimin e trajnerit aktual. Trajneri i kombetares deklaroi se ky rezultat konfirmon progresin e dukshëm qe ka bere ekipi gjate dy viteve te fundit. Ai veçoi perqendrimin kolektiv dhe disiplinën taktike te lojtareve si faktore vendimtare per fitoren. Mbrojtja e ngurtë e ekipit i mbajti kundershtar te forte pa gola per 90 minuta. Mesfushori yll i kombetares i cili ka luajtur pese vjet ne kampionate te forta europiane u shpreh i lumtur per perqendrimin e demonstruar nga te gjithe lojtarët ne fushë. Ai tha se besimi i ekipit eshte ne nivelin me te larte te mundshëm dhe se të gjithe janë te motivuar per te bere histori ne garat qe vijne. Tifo esira qe mbushi stadiumin me kapacitet te plote krijoi nje atmosferë elektrizuese gjate te gjithe ndeshjes, duke ndikuar pozitivisht ne motivimin e lojtareve. Federata e futbollit te Kosoves vleresoi fitoren si tregues i strategjise afatgjate per zhvillimin e talenteve rinore ne e gjithe vendin. Akademia e re e futbollit e ndertuar ne Gjakove dhe qendrat e trajnimit ne Prizren dhe Peje prodhojnë tashme talente te nivelit europian. Trajneret e ekipeve te moshave kane shprehur optimizëm per brezen e ri qe po ngjit ne skuadrat kombetare. Me nje radhë te shquar lojtareve te formuar ne sisteme profesionale europiane Kosova ka kapacitetin real per te arritur suksese te mdha ne garat europiane ne vitet qe vijne. Klube te njohura europiane kane shfaqur interes konkret per disa lojtare te kombetares kosovare pas performances se shkëlqyer te demonstruar ne kete ndeshje. Drejtuesit e Federates se Futbollit te Kosoves jane ne bisedime me UEFA-n per rritjen e numrit te ndeshjeve shtepie ne Pristine dhe per permiresimin e infrastrukturës se stadiumit kombëtar per te arritur kapacitetin e nevojshem per ndeshjet e kalibrit te larte europian. Fansat kosovar ne diapora ndoqen ndeshjen me entuziazem te madh ne kafe dhe bare ne Gjermani Zvicër dhe Austri duke e bere kete me teper se nje fitore sportive.`,
    source: "France 24",
    sourceFlag: "🇫🇷",
    sourceBias: "neutral",
    tone: "positive",
    category: "Sport",
    publishedAt: "2025-05-18T20:00:00Z",
    readingTime: 2,
    featured: false,
    imageUrl: "https://picsum.photos/seed/kosova-sport-futboll/800/500",
  },
  {
    id: "6",
    slug: "teknologji-startup-pristina",
    dispatch: "06",
    title: "Prishtina renditur ndër qytetet me rritjen më të shpejtë të startupeve tech në Ballkan",
    excerpt:
      "Raport i ri tregon se ekosistemi i startupeve teknologjike në Prishtinë ka njohur rritje 60% gjatë dy viteve të fundit.",
    body: `Nje studim i kryer nga organizata nderkombetare StartupBlink renditi Kosoven ndermjet 50 vendeve me ekosisteme startupesh ne rritje me te shpejte ne Europë gjate vitit 2025. Raporti vjetore tregoi se Pristina renditet si qyteti me dinamik ne Ballkan nga ana e numrit te startupeve te reja te regjistruara dhe vleres se kapitalit te investuar ne startup-e vendase. Ekosistemi teknologjik kosovar ka pare nje transformim te thellë ne pese vitet e fundit. Numri i kompanive teknologjike aktive ka tejkaluar dyqind firma, nga te cilat tridhjete kane arritur te eksportojne produkte dhe sherbime ne tregjet nderkombetare. Investitoret e kapitalit rreziku jane gjithnje me te interesuar per startup-et kosovare. Fondet europiane dhe rajonale te venture capital kane bere investime ne kompani kosovare ne fushat e fintech, edtech, healthtech dhe inteligjences artificiale. Edhe nje fond i vogel amerikan ka realizuar investimet e para ne Kosove, sinjalizando interesin e nje audience me te gjere nderkombetare. Faktore te shumte terhejne investitoret ne Kosove. Kostoja e talenteve teknologjike eshte me e ulur se ne Europën Perendimore por kualifikimi eshte i nivelit te larte dhe krahasueshem. Universitetet kosovare prodhojne mbi dymijë inxhiniere informatike çdo vit, shumica e te cilëve flasin anglisht ne nivel te larte profesional dhe kane njohuri te shkëlqyera te matematikës. Qeveria ka ndermarre hapa konkrete per te mbeshtur ekosistemi te startupeve. Ligji i ri per startup-et miratuar dy vjet me pare ofron lehtesira tatimore dhe procedura te thjeshtezuara te regjistrimit. Bashkërendim me efektiv mes universiteteve, qeverise dhe sektorit privat po e bën Kosoven gjithnje me te terhekese si destinacion per startup-et teknologjike. Hub-et teknologjike ne Pristine, Prizren dhe Gjakove jane kthyer ne qendra aktive bashkëpunimi te gjalla me atmosferë kreative. Keto hapesira ofrojnë mentoring, akses ne rrjete nderkombetare biznesi dhe mbeshtetje per sipermares ne fazat e hershme te zhvillimit. Programet e akseleratit rajonal dhe europian kane ndihmuar startup-et kosovare te hyjne me sukses ne tregjet perëndimore. Akseleratoret ofrojne trajnime intensive, kontakte me investitorë te nivelit te larte dhe ekspertize te specializuar sektoriale. Eksportet e sherbimeve IT nga Kosova kane arritur nivelet me te larta historike, qe tregon se sektori po behet nje shtylële gjithe me e rendesishme e ekonomise kombetare.`,
    source: "TechCrunch",
    sourceFlag: "🇺🇸",
    sourceBias: "neutral",
    tone: "positive",
    category: "Teknologji",
    publishedAt: "2025-05-18T12:00:00Z",
    readingTime: 4,
    featured: false,
    imageUrl: "https://picsum.photos/seed/teknologji-startup/800/500",
  },
  {
    id: "7",
    slug: "kosove-serbi-bisedime",
    dispatch: "07",
    title: "Bisedimet Kosovë-Serbi rinovohen nën ndërmjetësimin e BE-së në Bruksel",
    excerpt:
      "Delegacioni kosovar dhe ai serb janë takuar sërisht në Bruksel, me zyrtarët e BE-së duke shpresuar në zbatimin e marrëveshjes bazë.",
    body: `Bisedimet midis delegacionit te Kosoves dhe Serbise vazhduan sot ne Bruksel nen ndermjetesimin e perfaqesuesit te posaçëm te Bashkimit Europian per dialogun ndermjet Pristines dhe Beogradit. Seanca e sotme e zgjeruar u fokusua kryesisht ne vleresimin e zbatimit te marreveshjeve te arritura ne muajt e meparshem dhe ne identifikimin e hapave konkrete per normalizimin e metejshem te marrëdhënieve dypaleshë. Kryenegociatori kosovar deklaroi se Kosova eshte treguar e gatshme per dialog konstruktiv dhe ka zbatuar te gjitha detyrimet sipas planit te veprimit te dakorduar me partneret europiane. Ai shtoi se priste angazhim te barabarte nga Serbia per zbatimin e plotë te marreveshjes bazike te normalizimit. Delegacioni serb nga ana e tij shprehu deshiren per dialog te sinqerte dhe zvillimin e zgjidhjes per çeshtjet e hapura. Keto perfshin te drejtat e komuniteteve, administrimin e pasurive, procesimin e personave te zhdukur dhe nderlidhjen infrastrukturore ndermjet dy vendeve fqinje me potencial te madh ekonomik. Perfaqesuesi i posaçëm i BE-se per dialogun u shpreh i kenaqur me progresin e arritur ne çeshtje te caktuara teknike gjate kesaj seance pune. Ai veçoi punën e perbashket per hartimin e regjistrave kadastrale ne zonat e shkembimit si nje shembull pozitiv i bashkëpunimit teknik nen kujdesin dhe koordinimin e Bashkimit Europian. Organizatat e shoqerise civile ne te dy vendet kane shprehur rezerva per qendrueshmërinë e marreveshjeve pa nje konsensus me te gjere ne popullatat respektive. Sondazhet tregojne se njerezit ne te dy vendet kane pritshmëri te ndryshme per rezultatin final te procesit te dialogut dhe ky hendek vlerash mbetet sfidë serioze qe duhet adresuar me komunikim dhe transparencë. Ambasadori amerikan ne Kosove tha se Shtetet e Bashkuara mbeshtesin me forca normalizimin dhe besojne qe zgjidhjet e drejtë per çeshtjet e mbetura ekzistojne nese ka vullnet politik nga te dyja palet. Komuniteti serb ne Kosove ka shprehur shqetesime per çeshtje te tilla si arsimimi ne gjuhen amtare, sherbime administrative ne gjuhen serbe dhe participimi me i gjere ne institucionet publike kosovare. Qeveria kosovare ka premtuar dialog te vazhdueshem me keto komunitet dhe ka ndermarre disa hapa pozitive. Parlamenti i Kosoves ka zhvilluar debate te gjera rreth qendrimit te qeverise ne dialogun e Brukselit. Grupet parlamentare kerkuan me shume transparencë dhe informacion publik per ecurine e bisedimeve. Kryeministri premtoi nje konference te plote shtypi me rezultate pas kthimit ne Pristine. Ekipet teknike te dy delegacioneve vazhduan punën paralele mbi çeshtjet sektoriale te tilla si energjia, transporti, doganat dhe njohja reciproke e kualifikimeve arsimore. Keto grupe pune koordinohen nga ekspertë te Komisionit Europian qe ofrojne udhezim procedural dhe teknik per harmonizimin gradual te praktikave administrative te dy vendeve. Raundi i ardhshem i bisedimeve eshte planifikuar per muajin qe vjen. Tema kryesore pritet te jete çeshtja e kufijve komerciale dhe te barrierave tregtare, nje ndër pikat me teknike dhe me sensitive te te gjithe agjendës se normalizimit dypalesh. Ekspertet nderkombetare te politikes rajonale theksojne se dialogu po avancon me ritëm te pranueshëm pavaresisht veshtiresive institucionale. Ata nenvizojne se normalizimi dypalesh eshte i domosdoshëm si per Kosoven ashtu edhe per Serbine ne rrugën e tyre drejt anetaresimit ne Bashkimin Europian. Mbeshtetja nderkombetare per procesin e dialogut mbetet e gjere dhe e vendosur nga anetaret kryesore te BE-se dhe nga aleatët transatlantike te regjionit.`,
    source: "BBC",
    sourceFlag: "🇬🇧",
    sourceBias: "neutral",
    tone: "neutral",
    category: "Politikë",
    publishedAt: "2025-05-17T16:00:00Z",
    readingTime: 6,
    featured: false,
    imageUrl: "https://picsum.photos/seed/kosove-serbi-bruksel/800/500",
  },
  {
    id: "8",
    slug: "energji-e-rinovueshme-kosove",
    dispatch: "08",
    title: "Kosova nënshkruan marrëveshje historike për ndërtimin e parkut të parë të erës",
    excerpt:
      "Qeveria kosovare ka nënshkruar kontratën me konsorciun evropian për ndërtimin e parkut të parë të erës me kapacitet 200 MW.",
    body: `Ministria e Ekonomisë ka njoftuar nenskrimin e kontratës me nje konsorcium nderkombëtar firmash europiane per ndertimin e nje parku te madh te energjise diellore ne zonen perëndimore te Kosoves prane Prizrenit. Projekti ambicioz, i financuar kryesisht nga kapital privat nderkombëtar me bashkefinancim te programeve europiane te mbeshtetjes, pritet te prodhojë energji te mjaftueshme elektrike per ushqyer mbi tridhjete mije familje kosovare ne nje menyre te qendrueshme dhe mjedisisht miqesore. Ministri i Ekonomise theksoi se ky projekt shenon nje moment historik ne procesin e tranzicionit energjetik te Kosoves. Ai shtoi se vendi ka potencial te jashtëzakonshëm per burime te rinovueshme energjetike, vecanerisht diellore dhe erore, te cilin duhet ta shfrytezojë me strategji te qarte per perfitimet afatgjate te vendit. Projekti ka rendesi te veçantë per angazhimet mjedisore te Kosoves. Vendi eshte i angazhuar per respektimin e marreveshjes se Parizit dhe ka perfshire ne strategjinë e tij energjetike kombetare reduktimin e ndjeshëm te emetimeve te dioksidit te karbonit deri ne vitin 2030. Centralet e vjetëra te karbonit te cilat kane qenë burime kryesore te ndotjes se ajrit do te mbyllen gradualisht ndersa kapacitetet e reja te rinovueshme hyjne progressivisht ne operacion komercial. Konsorciumi ndertues perbehet nga firma te specializuara gjermane, spanjole dhe austriake me dekada eksperience te akumuluar ne projekte te ngjashme te energjise diellore ne Europë dhe ne boten. Teknologjia qe do te perdoret eshte nga gjenerata me e fundit dhe me efikase e disponueshme ne tregun global te paneleve fotovoltaike, me tregues eficience superiore ndaj asaj qe ishte ne dispozicion deri pak vjet me pare. Punimet zyrtare do te fillojne ne pranvere te vitit qe vjen dhe pritet te perfundojne brenda gjashtëmbëdhjetë muajve nga çelja formale e kantierit. Ne fazën e ndertimit projekti do te gjenerojë mbi pesëqind vende pune direkte per punonjës kosovar, ndersa ne fazën e operimit te qendrueshëm do te kerkojë rreth pesedhjete profesioniste te kualifikuar per mbikeqyrjen teknike dhe mirëmbajtjen e te gjitha pajisjeve. Bashkia e Prizrenit e mirepriti projektin si nje mundesi reale per zhvillimin ekonomik te qendrueshëm te komunës. Kryetari i bashkise theksoi se nje perqindje e te ardhurave te gjeneruara nga projekti do te derdhë drejtperdrejt ne buxhetin komunal sipas kushteve te specifikuara ne kontratën e nenëshkruar mes paleve. Keto fonde komunale do te shfrytëzohen per investime prioritare ne infrastrukturën lokale. Organizatat e mjedisit te Kosoves e vleresuan pozitivisht nisjen e projektit dhe te gjitha sinjalet qe jep per orientimin e politikës energjetike. Ato kerkojnë monitorim te rreptë te ndikimit mjedisor gjate te gjitha fazave te ndertimit dhe te operimit. Theksojnë gjithashtu nevojën per konsultime te vazhdueshme dhe te hapur me komunitetet lokale qe jetojnë prane zones dhe qe ndikohen drejtperdrejt nga ky projekt industrial. Bashkimi Europian ka bere tranzicionin energjetik nje prioritet qendror te politikes rajonale te zgjerimit. Kosovo eshte nje nga perfitieset kryesore te fondeve IPA per energjinë e rinovueshme dhe eficiencën energjetike. Keto fonde eshte planifikuar te perdoren per modernizimin e rrjetit te transmetimit dhe te shperndarjes se energjisë elektrike ne te gjithe territorin e vendit. Operatori i sistemit te transmetimit ka hartuar nje plan te detajuar modernizimi te infrastrukturës rrjetore qe do te shoqerojë rritjen e kapaciteteve te rinovueshme. Rrjeti aktual i ndertuar kryesisht ne dekadat e kaluara ka nevoje per investime te konsiderueshme per te absorbuar efektivisht prodhimin e variabël nga burimet diellore dhe eolike pa shkaktuar debalancime te sistemit. Sektori privat kosovar dhe nderkombetarë ka shfaqur interes gjithnje ne rritje per investimet ne energjinë e rinovueshme. Kompani te ndryshme lokale dhe nderkombetare kane aplikuar ne Ministrine e Ekonomise per licenca per ndertimin e parqeve te reja erore ne malet e veriut dhe juglindjes ku era eshte konstante dhe e mjaftueshme per prodhim efikas te energjisë. Çmimi i energjise elektrike per konsumatoret kosovare eshte shtrenjtuar gjate periudhes se fundit per shkak te krizës globale te çmimeve te lëndëve djegese. Qeveria ka nderhyrë me subvencione te synuara per mbrojtjen e shtresave me vulnerabël te popullsise. Analistet e energjisë theksojnë qe investimet sistematike ne burime te rinovueshme do te stabilizojnë çmimet ne periudhën afatmesme duke reduktuar varësinë nga importet e shtrenjta. Partneritetet publiko-private jane identifikuar si modeli me efektiv dhe me i shpejte per te mobilizuar investime ne energjinë e rinovueshme. Kuadri ligjor per keto partneritete eshte permiresuar gjate viteve te fundit dhe ofron garanci me te mira per investitoret private duke reduktuar rreziqet rregullatore dhe duke siguruar nje mjedis me te parashikueshëm per planifikimin afatgjate te kapitalit ne sektorin strategjik te energjisë.`,
    source: "Der Spiegel",
    sourceFlag: "🇩🇪",
    sourceBias: "neutral",
    tone: "positive",
    category: "Ekonomi",
    publishedAt: "2025-05-16T09:00:00Z",
    readingTime: 3,
    featured: false,
    imageUrl: "https://picsum.photos/seed/energji-ere-kosove/800/500",
  },
  {
    id: "9",
    slug: "kultura-film-kosovar",
    dispatch: "09",
    title: "Filmi kosovar 'Lumi i Bardhë' fiton çmimin kryesor në Festivalin e Berlinit",
    excerpt:
      "Regjisorja Donika Hasani ka fituar Arinjin e Artë me filmin e saj të parë tregimtar, duke vënë Kosovën në hartën e kinemasë ndërkombëtare.",
    body: `Kinematografia kosovare ka shenuar nje dekade te arit ne prodhimin e filmave te cilat pasqyrojne rrefimet autentike ballkanase per audiencën nderkombetare. Festivalet nderkombetare te filmit ne Berlinale Cannes dhe Sundance kane shfaqur vepra te regjisoreve te rinj kosovar duke rritur dukshem prezencen e artit kosovar ne skenat me te rendesishme boterore te kinematografise. Regjisoret e rinj si ata te diplomuar nga Akademia e Arteve ne Pristine jane duke eksploruar tema komplekse lidhur me tranzicionin pas luftes identitetin dhe emigracionin nepermjet gjuhes filmike moderne. Filmi i fundit kosovar i nominuar per çmim nderkombetare ka ardhur pas investimeve te reja te qeverise kosovare ne fondet kombetare per financimin e prodhimeve artistike me potencial nderkombëtar. Kosova Film Center ka rritur buxhetin per ko-prodhime nderkombetare duke terhequr bashkepunim me shtudiot europiane dhe duke hapur dere per distributim me te gjere te filmave kosovar jashte kufijve. Festivali Nderkombëtar i Filmit i Pristinës eshte ngritur ne nje nga ngjarjet kulturore me te rendesishme te rajonit duke terhequr regjisorë producente dhe kritike nga mbi tridhjet shtete europiane. Aktoret kosovar fillojne te merren me role ne prodhimet europiane dhe ne seriale nderkombetare duke demonstruar se talenti i vendit eshte konkurrues edhe ne tregjet me te medha te industrise filmike. Ekspertet e industrise vleresojne se nevojiten investime te vazhdueshme ne infrastrukturën kinematografike ne pajisjet profesionale dhe ne arsimin artistik per ta konsoliduar pozicionin e Kosoves ne harten e kinematografise boterore. Bashkimi Europian nepermjet programit Creative Europe ka perfshire Kosoven si shtet i plote perfitonjës duke mundësuar financim per projektet kinematografike dhe mbeshtetje per bashkepunimin nderkombëtar. Shoqata e kinemase kosovare ka hapur dialog me platformat dixhitale nderkombetare si Netflix dhe Mubi per perfshirjen e filmave kosovar ne katalogjet e tyre duke hapur nje kanal te ri per distribucioni global te artit kosovar. Kritiku kosovar i filmit vleresojne se dekada e ardhshme pritet te jete me e rendesishmja per kinematografine kosovare duke vendosur themeletet e nje industrie te qendrueshme dhe konkurruese ne nivel rajonal dhe europian. Kjo do te sjelle nje valë re entuziastesh te rinj ne industrine kinematografike kosovare.`,
    source: "Le Monde",
    sourceFlag: "🇫🇷",
    sourceBias: "neutral",
    tone: "positive",
    category: "Kulturë",
    publishedAt: "2025-05-15T18:00:00Z",
    readingTime: 4,
    featured: false,
    imageUrl: "https://picsum.photos/seed/kultura-film-berlin/800/500",
  },
  {
    id: "10",
    slug: "arsimi-kosove-reforma",
    dispatch: "10",
    title: "UNICEF: Kosova ka bërë progres të konsiderueshëm në arsimin parauniversitar",
    excerpt:
      "Raporti i ri i UNICEF-it vlerëson pozitivisht reformat në arsimin fillor dhe të mesëm, por shton se nevojiten investime shtesë.",
    body: `Sistemi arsimor kosovar eshte duke kaluar neper nje seri reformash gjitheperfshirese te koordinuara nga Ministria e Arsimit me mbeshtetjen e organizatave nderkombetare te specializuara ne zhvillimin e kapaciteteve arsimore. Kurrikula e re kombetare e hartuar ne bashkepunim me ekspertet europiane integron kompetenca dixhitale mendje krijtive dhe aftesi sociale si lende kryesore ne te gjitha nivelet e sistemit arsimor. Investimet ne infrastrukturën shkollore kane arritur nivele rekord me ndertimin e rishikimin e qindra objekteve shkollore ne zona urbane dhe rurale duke reduktuar pabarazine ne qasjen ndaj arsimit cilesor. Reformimi i sistemit te vleresimit eshte procesi qendror i ndryshimit ku vleresimi i bazuar ne kompetenca po zevendeson gradualisht sistemin tradicional te notave duke kerkuar pergatitje intensive te mesuesve. Trajnimi i vazhdueshem i personelit mesimdhenes eshte identifikuar si prioritet strategjik dhe mijera mesues jane regjistruar ne programet e rikualifikimit te financuara nga buxheti kombetar dhe fondet europiane. Universitetet kosovare po forcojne bashkepunimin me institucionet akademike europiane nepermjet programeve Erasmus duke rritur dukshem mobilitetin e studenteve kosovar neper kampuset europiane. Numri i studenteve kosovar qe studiojne jashte vendit ka shënuar rritje te vazhdueshme por autoritetet arsimore po punojne per te krijuar kushte me teper terhequse per kthimin e talenteve te formuara jashte ne ekonomine kosovare. Ministria e Arsimit ka njoftuar rritjen e page te mesuesve si nje nga masat emergjente per te rritur terhiqeshmerine e profesionit mesimdhenes dhe per te kufizuar largimin e mesuesve te kualifikuar drejt sektoreve me fitimprurese te ekonomise. Nje sistem i ri i certifikimit te mesuesve bazuar ne standarde europiane do te implementohet gjate vitit te ardhshem duke standardizuar cilesine e mesimdheniese ne shkallën kombëtare. Projektet pilot te teknologjise se integrimit te inteligjences artificiale ne procesin mesimor jane nisur ne dhjetë shkolla publike ne Pristine si hap i pare per nje sistem arsimor te modernizuar dhe konkurrues. Ekspertet nderkombetare te arsimit vleresojne se me kete ritëm reformash dhe investimesh te duhura Kosova ka potencialin te ndertoje nje sistem arsimor te kategorise europiane brenda nje dekade qe do te pergatise gjeneratat e reja per tregun e punes globale.`,
    source: "Guardian",
    sourceFlag: "🇬🇧",
    sourceBias: "neutral",
    tone: "positive",
    category: "Shoqëri",
    publishedAt: "2025-05-14T11:00:00Z",
    readingTime: 3,
    featured: false,
    imageUrl: "https://picsum.photos/seed/arsimi-unicef-kosove/800/500",
  },
];

export const BREAKING_ITEMS = [
  "BREAKING: BE miraton fondimin e ri 85M€ për infrastrukturën e Kosovës",
  "URGJENTE: Takimi i Këshillit të Sigurimit të OKB diskuton situatën në Ballkan",
  "FLASH: Prishtina pret delegacion nga 7 vende anëtare të NATO-s",
  "LAJM: Banka Botërore miraton kredi 120M$ për sektorin energjetik kosovar",
  "ALARM: Temperaturat tejkalojnë 38°C — rekomandohet qëndrimi në shtëpi",
];

export const VIDEO_REACTION = {
  id: "v1",
  title: "Pse BBC-ja thotë se Kosova 'nuk ka arritur ende stabilitet'?",
  topic: "BE-ja dhe Kosova — analizë e thellë",
  duration: "2 min",
  linkedArticleSlug: "kosova-be-raport-2025",
  publishedAt: "2025-05-20T09:00:00Z",
  thumbnailGradient: "linear-gradient(135deg, #FF4422 0%, #1A1A1A 100%)",
};

export const THROWBACK_ARTICLE = {
  id: "t1",
  year: "2020",
  oldTitle: "Kosovo — A State Still Fighting For Recognition",
  oldSource: "New York Times",
  oldSourceFlag: "🇺🇸",
  oldExcerpt:
    "Five years after declaring independence, Kosovo remains unrecognized by five EU members and faces diplomatic isolation at international institutions.",
  todayNote:
    "Sot, Kosova ka 117 njohje. Procesi i anëtarësimit në Këshillin e Evropës përfundoi me sukses në 2024.",
  publishedAt: "2020-05-18T00:00:00Z",
};

export const THROWBACK_ARTICLES = [
  { id: "t1", year: "2021", oldTitle: "Kosovo's Kurti Wins Landslide Election on Anti-Corruption Mandate", oldSource: "BBC News", oldSourceFlag: "🇬🇧", oldExcerpt: "Albin Kurti's Vetevendosje movement wins an outright majority — the first in Kosovo's history — promising to fight corruption and push for EU membership.", todayNote: "Qeveria Kurti ka zbatuar reformat anti-korrupsion dhe ka fuqizuar bashkëpunimin me BE-në. Procesi i integrimeve është në fazën më aktive të dekadës." },
  { id: "t2", year: "2021", oldTitle: "Kosovo Applies for Council of Europe Membership", oldSource: "Reuters", oldSourceFlag: "🇬🇧", oldExcerpt: "Kosovo formally applies to join the Council of Europe, a major step toward European integration requiring support from two-thirds of member states.", todayNote: "Kosova u anëtarësua me sukses në Këshillin e Evropës në maj 2024 — arritja diplomatike më e madhe që nga pavarësia." },
  { id: "t3", year: "2021", oldTitle: "EU Parliament Approves Kosovo Visa Liberalization", oldSource: "Deutsche Welle", oldSourceFlag: "🇩🇪", oldExcerpt: "The European Parliament votes to grant Kosovo citizens visa-free travel to Schengen countries, ending decades of isolation for ordinary citizens.", todayNote: "Liberalizimi i vizave hyri në fuqi dhe u bë ndryshimi më i ndjeshëm për qytetarët kosovarë — mbi 2 milion udhëtime u realizuan brenda 18 muajve të parë." },
  { id: "t4", year: "2020", oldTitle: "Kosovo — A State Still Fighting For Recognition", oldSource: "New York Times", oldSourceFlag: "🇺🇸", oldExcerpt: "Five years after declaring independence, Kosovo remains unrecognized by five EU members and faces diplomatic isolation at international institutions.", todayNote: "Sot, Kosova ka 117 njohje. Anëtarësimi në Këshillin e Evropës u kompletua me sukses në 2024." },
  { id: "t5", year: "2021", oldTitle: "Kosovo's Economy Grows Despite Regional Headwinds", oldSource: "Bloomberg", oldSourceFlag: "🇺🇸", oldExcerpt: "Kosovo posts 6.4% GDP growth, outpacing most Western Balkan neighbors, driven by diaspora remittances and a construction boom.", todayNote: "Ekonomia kosovare vazhdon të rritet me mesatare 4-5% në vit. FMN-ja e rendit si ndër ekonomitë më dinamike të rajonit." },
  { id: "t6", year: "2021", oldTitle: "Kosovo Reaches 100 State Recognitions", oldSource: "AP", oldSourceFlag: "🇺🇸", oldExcerpt: "Kosovo crosses the landmark of 100 state recognitions as Israel and several Pacific nations formally acknowledge its independence.", todayNote: "Kosova ka 117 njohje sot, me procese aktive diplomatike në Afrikë dhe Azi." },
  { id: "t7", year: "2021", oldTitle: "Pristina's Tech Scene Draws Silicon Valley Eyes", oldSource: "Forbes", oldSourceFlag: "🇺🇸", oldExcerpt: "With a young population and low costs, Kosovo's capital is becoming a surprising hub for software outsourcing and startup activity.", todayNote: "Prishtina u rendit ndër 5 qytetet me rritjen më të shpejtë të startupeve në Ballkan sipas raportit StartupBlink 2025." },
  { id: "t8", year: "2021", oldTitle: "Kosovo's Film 'Hive' Earns Oscar Nomination", oldSource: "The Guardian", oldSourceFlag: "🇬🇧", oldExcerpt: "Fahrije Hoti's story, told in Kosovo's first ever Oscar-nominated film, brings global attention to Kosovo's post-war women's strength.", todayNote: "Filmi 'Hive/Zgjoi' mbahet si arritja artistike që hapi dyert e Kosovës për industrinë ndërkombëtare të filmit." },
  { id: "t9", year: "2021", oldTitle: "KFOR Marks 22 Years of Peacekeeping in Kosovo", oldSource: "NATO", oldSourceFlag: "🇧🇪", oldExcerpt: "NATO's KFOR mission celebrates 22 years in Kosovo, reaffirming its commitment to maintaining peace and security in the Western Balkans.", todayNote: "KFOR vazhdon të jetë prezent me mbi 4,500 trupa. Misioni konsiderohet ndër operacionet e suksesshme të NATO-s." },
  { id: "t10", year: "2021", oldTitle: "Kosovo Diaspora Sends Record €1.1 Billion in Remittances", oldSource: "Financial Times", oldSourceFlag: "🇬🇧", oldExcerpt: "Remittances from the Kosovo diaspora hit an all-time high despite the pandemic, making up nearly 17% of the country's GDP.", todayNote: "Remitancat tejkaluan 1.2 miliard euro në 2024, me diasporën e Gjermanisë dhe Zvicrës si kontribuuesit kryesorë." },
  { id: "t11", year: "2021", oldTitle: "Kosovo's Young Footballers Eye UEFA Nations League Promotion", oldSource: "The Guardian", oldSourceFlag: "🇬🇧", oldExcerpt: "With an average age of 24, Kosovo's national football team is one of Europe's youngest squads and climbing UEFA's rankings.", todayNote: "Kombëtarja kosovare u kualifikua për Ligën B të Kombeve UEFA — arritja historike e futbollit kosovar." },
  { id: "t12", year: "2021", oldTitle: "Solar Energy Project to Power 20,000 Kosovo Homes Breaks Ground", oldSource: "Deutsche Welle", oldSourceFlag: "🇩🇪", oldExcerpt: "A new 100MW solar plant backed by the EBRD breaks ground near Pristina, Kosovo's first utility-scale renewable energy project.", todayNote: "Kosova ka nënshkruar projekte diellore dhe eolike me kapacitet mbi 300 MW — synon 35% energji e rinovueshme deri në 2030." },
  { id: "t13", year: "2021", oldTitle: "Kosovo Wins First Olympic Gold Medals in Judo at Tokyo", oldSource: "BBC Sport", oldSourceFlag: "🇬🇧", oldExcerpt: "Judoka Nora Gjakova and Distria Krasniqi win gold medals at the Tokyo Olympics, Kosovo's most successful Games to date.", todayNote: "Xhudo kosovare vazhdon të shquhet ndërkombëtarisht — Kosova renditet ndër vendet me medaljet olimpike per capita." },
  { id: "t14", year: "2020", oldTitle: "Serbia's Campaign Blocks Kosovo's UNESCO Bid", oldSource: "Reuters", oldSourceFlag: "🇬🇧", oldExcerpt: "Kosovo's application for UNESCO membership fails to reach a vote after Serbia and Russia campaign heavily against it.", todayNote: "Si anëtar i Këshillit të Evropës, Kosova ka peshë më të madhe ndërkombëtare. Lufta diplomatike vazhdon." },
  { id: "t15", year: "2021", oldTitle: "Kosovo Opens New Highway Linking Pristina to North Macedonia", oldSource: "AP", oldSourceFlag: "🇺🇸", oldExcerpt: "The Ibrahim Rugova Highway section is completed, cutting travel time between Kosovo and North Macedonia by 40%.", todayNote: "Rrjeti rrugor kosovar vazhdon zgjerimin — autostrada lidh Kosovën me Shqipërinë, Maqedoninë dhe Serbinë." },
  { id: "t16", year: "2021", oldTitle: "Kosovo Introduces Digital Tax System to Fight Shadow Economy", oldSource: "Balkan Insight", oldSourceFlag: "🇷🇸", oldExcerpt: "The government launches mandatory digital fiscal receipts for all businesses, aiming to bring Kosovo's shadow economy into the tax base.", todayNote: "Sistemi fiskal dixhital ka rritur të ardhurat tatimore me 23% — modeli kosovar studiohet nga vendet rajonale." },
  { id: "t17", year: "2020", oldTitle: "Kosovo Women Make Up 40% of Parliament — A Regional First", oldSource: "Time", oldSourceFlag: "🇺🇸", oldExcerpt: "Following the February elections, Kosovo's parliament achieves 40% female representation, the highest in the Western Balkans.", todayNote: "Përfaqësimi i grave mbetet ndër më të lartët në rajon, me rritje të vazhdueshme në role ekzekutive." },
  { id: "t18", year: "2021", oldTitle: "Kosovo's Startup Scene Attracts €30M in Venture Capital", oldSource: "TechCrunch", oldSourceFlag: "🇺🇸", oldExcerpt: "A record year for Kosovo tech investment as European VCs back local startups in fintech, edtech, and SaaS sectors.", todayNote: "Ekosistemi i startupeve kosovare ka arritur financime mbi 80 milionë euro — Prishtina ndër 10 qytetet me rritje teknologjike." },
  { id: "t19", year: "2020", oldTitle: "Brussels Dialogue on Kosovo-Serbia Normalization Stalls Again", oldSource: "Politico Europe", oldSourceFlag: "🇧🇪", oldExcerpt: "EU-mediated talks between Pristina and Belgrade fail to produce results for the third consecutive year.", todayNote: "Marrëveshja e Ohrit 2023 ka hapur rrugë të reja, megjithëse zbatimi mbetet sfidë aktive." },
  { id: "t20", year: "2021", oldTitle: "Kosovo's Education Reform Raises University Enrollment by 15%", oldSource: "Le Monde", oldSourceFlag: "🇫🇷", oldExcerpt: "A new student loan program and quality improvements at Pristina's main university drive a significant jump in higher education participation.", todayNote: "Bashkëpunimet me universitetet evropiane janë trefishuar në 3 vitet e fundit." },
  { id: "t21", year: "2021", oldTitle: "Kosovo's COVID Vaccination Campaign Reaches 30% of Adults", oldSource: "Reuters", oldSourceFlag: "🇬🇧", oldExcerpt: "Kosovo ramps up vaccination with donated doses from the EU and US, reaching 30% adult coverage faster than regional neighbors.", todayNote: "Spitale të reja rajonale po ndërtohen me financim të BE-së — kapacitetet shëndetësore janë shtuar pas pandemisë." },
  { id: "t22", year: "2020", oldTitle: "Kosovo Hosts First International Fashion Week", oldSource: "Vogue", oldSourceFlag: "🇺🇸", oldExcerpt: "Pristina's first Fashion Week draws 40 international designers and signals the country's emerging creative industry.", todayNote: "Prishtina Fashion Week ka zhvilluar 4 edicione — talente kosovare eksportohen në Milano, Paris dhe Londër." },
  { id: "t23", year: "2021", oldTitle: "Kosovo's Banking Sector Shows Strongest Growth in Balkans", oldSource: "Financial Times", oldSourceFlag: "🇬🇧", oldExcerpt: "Kosovo's banks post 12% credit growth, driven by SME lending and a housing boom, with non-performing loans at record lows.", todayNote: "Kosova ka treguesin më të ulët të kredive jo-performuese në rajon (3.2%) — sektori bankar mbetet i shëndoshë." },
  { id: "t24", year: "2021", oldTitle: "Pristina Tram Project Green-lit by European Investment Bank", oldSource: "Der Spiegel", oldSourceFlag: "🇩🇪", oldExcerpt: "The EIB approves €95 million for a light rail system in Kosovo's capital, the country's largest urban mobility project.", todayNote: "Projekti i tramit të Prishtinës është në fazën e tenderimit — ndërtimi pritet të fillojë brenda tre viteve." },
  { id: "t25", year: "2020", oldTitle: "Kosovo's Wine Industry Wins European Gold Medals", oldSource: "Decanter", oldSourceFlag: "🇬🇧", oldExcerpt: "Stone Castle and Çohu wineries earn international recognition as Kosovo's wine exports reach €4 million for the first time.", todayNote: "Vera kosovare eksportohet sot në 25 vende — Stone Castle është renditur ndër 100 vreshtat më të mira të Evropës." },
  { id: "t26", year: "2021", oldTitle: "Kosovo Joins CERN as Associate Member State", oldSource: "Nature", oldSourceFlag: "🇬🇧", oldExcerpt: "Kosovo becomes an associate member of CERN, giving its physicists access to Europe's leading particle research center.", todayNote: "Hulumtues kosovarë punojnë aktivisht në projektet e CERN-it — bashkëpunimi shkencor është zgjeruar edhe me ESA-n." },
  { id: "t27", year: "2020", oldTitle: "Kosovo Border Sees First Commercial Truck Since the 1990s", oldSource: "AP", oldSourceFlag: "🇺🇸", oldExcerpt: "A commercial truck crosses the Kosovo-Serbia border following a Washington trade agreement, the first such crossing since the 1990s.", todayNote: "Tregëtia me Serbinë mbetet e kufizuar — dialogu i Brukselit synon normalizimin ekonomik si hap paraprak." },
  { id: "t28", year: "2021", oldTitle: "Kosovo's Nurses Lead WHO-backed Mental Health Reform", oldSource: "The Lancet", oldSourceFlag: "🇬🇧", oldExcerpt: "A WHO-backed program trains 400 community mental health nurses across Kosovo, shifting care from asylum to community-based services.", todayNote: "Kosova u vlerësua nga OBSH për progresin e bërë — qendrat komunitare të shëndetit mendor janë zgjeruar." },
  { id: "t29", year: "2021", oldTitle: "Kosovo Celebrates 13th Anniversary of Independence", oldSource: "AFP", oldSourceFlag: "🇫🇷", oldExcerpt: "Crowds gather in Pristina's main square as Kosovo marks 13 years of independence, with youth holding signs reading 'We are Europe'.", todayNote: "17 vjet pavarësi — sot Kosova ecën si anëtare e Këshillit të Evropës me rrugën drejt BE-së të hapur." },
  { id: "t30", year: "2021", oldTitle: "Kosovo's Beekeepers Export Organic Honey to Germany for First Time", oldSource: "Deutsche Welle", oldSourceFlag: "🇩🇪", oldExcerpt: "Kosovo beekeeping cooperatives achieve EU food safety certification, allowing organic mountain honey to reach German supermarket shelves.", todayNote: "Produktet bujqësore kosovare eksportohen tashmë në 30 vende — mjalti, vera dhe djathi kosovar fitojnë terren në tregjet evropiane." },
];

function getDayOfYear(): number {
  return Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
}

export function getDailyThrowback() {
  return THROWBACK_ARTICLES[getDayOfYear() % THROWBACK_ARTICLES.length];
}

export const TONE_STATS = [
  { country: "Gjermani", flag: "🇩🇪", positive: 58, neutral: 30, negative: 12 },
  { country: "SHBA",     flag: "🇺🇸", positive: 72, neutral: 22, negative: 6  },
  { country: "Britani",  flag: "🇬🇧", positive: 61, neutral: 28, negative: 11 },
  { country: "Francë",   flag: "🇫🇷", positive: 55, neutral: 35, negative: 10 },
  { country: "Itali",    flag: "🇮🇹", positive: 70, neutral: 24, negative: 6  },
];

const TONE_STATS_BY_DAY = [
  [ // day % 7 === 0
    { country: "Gjermani", flag: "🇩🇪", positive: 58, neutral: 30, negative: 12 },
    { country: "SHBA",     flag: "🇺🇸", positive: 72, neutral: 22, negative: 6  },
    { country: "Britani",  flag: "🇬🇧", positive: 61, neutral: 28, negative: 11 },
    { country: "Francë",   flag: "🇫🇷", positive: 55, neutral: 35, negative: 10 },
    { country: "Itali",    flag: "🇮🇹", positive: 70, neutral: 24, negative: 6  },
  ],
  [ // day % 7 === 1
    { country: "Gjermani", flag: "🇩🇪", positive: 61, neutral: 27, negative: 12 },
    { country: "SHBA",     flag: "🇺🇸", positive: 74, neutral: 20, negative: 6  },
    { country: "Britani",  flag: "🇬🇧", positive: 59, neutral: 30, negative: 11 },
    { country: "Francë",   flag: "🇫🇷", positive: 53, neutral: 36, negative: 11 },
    { country: "Itali",    flag: "🇮🇹", positive: 68, neutral: 25, negative: 7  },
  ],
  [ // day % 7 === 2
    { country: "Gjermani", flag: "🇩🇪", positive: 55, neutral: 33, negative: 12 },
    { country: "SHBA",     flag: "🇺🇸", positive: 69, neutral: 24, negative: 7  },
    { country: "Britani",  flag: "🇬🇧", positive: 63, neutral: 26, negative: 11 },
    { country: "Francë",   flag: "🇫🇷", positive: 57, neutral: 33, negative: 10 },
    { country: "Itali",    flag: "🇮🇹", positive: 72, neutral: 22, negative: 6  },
  ],
  [ // day % 7 === 3
    { country: "Gjermani", flag: "🇩🇪", positive: 60, neutral: 29, negative: 11 },
    { country: "SHBA",     flag: "🇺🇸", positive: 75, neutral: 19, negative: 6  },
    { country: "Britani",  flag: "🇬🇧", positive: 58, neutral: 31, negative: 11 },
    { country: "Francë",   flag: "🇫🇷", positive: 52, neutral: 37, negative: 11 },
    { country: "Itali",    flag: "🇮🇹", positive: 67, neutral: 26, negative: 7  },
  ],
  [ // day % 7 === 4
    { country: "Gjermani", flag: "🇩🇪", positive: 63, neutral: 26, negative: 11 },
    { country: "SHBA",     flag: "🇺🇸", positive: 71, neutral: 23, negative: 6  },
    { country: "Britani",  flag: "🇬🇧", positive: 65, neutral: 24, negative: 11 },
    { country: "Francë",   flag: "🇫🇷", positive: 58, neutral: 32, negative: 10 },
    { country: "Itali",    flag: "🇮🇹", positive: 73, neutral: 21, negative: 6  },
  ],
  [ // day % 7 === 5
    { country: "Gjermani", flag: "🇩🇪", positive: 56, neutral: 31, negative: 13 },
    { country: "SHBA",     flag: "🇺🇸", positive: 70, neutral: 23, negative: 7  },
    { country: "Britani",  flag: "🇬🇧", positive: 60, neutral: 29, negative: 11 },
    { country: "Francë",   flag: "🇫🇷", positive: 54, neutral: 36, negative: 10 },
    { country: "Itali",    flag: "🇮🇹", positive: 69, neutral: 24, negative: 7  },
  ],
  [ // day % 7 === 6
    { country: "Gjermani", flag: "🇩🇪", positive: 59, neutral: 28, negative: 13 },
    { country: "SHBA",     flag: "🇺🇸", positive: 73, neutral: 21, negative: 6  },
    { country: "Britani",  flag: "🇬🇧", positive: 62, neutral: 27, negative: 11 },
    { country: "Francë",   flag: "🇫🇷", positive: 56, neutral: 34, negative: 10 },
    { country: "Itali",    flag: "🇮🇹", positive: 71, neutral: 23, negative: 6  },
  ],
];

export function getDailyToneStats() {
  return TONE_STATS_BY_DAY[getDayOfYear() % TONE_STATS_BY_DAY.length];
}

export interface DiasporaArticle {
  id: string;
  title: string;
  source: string;
  flag: string;
  excerpt: string;
  href: string;
}

export const DIASPORA_ARTICLES: Record<string, DiasporaArticle[]> = {
  gjermania: [
    {
      id: "d-de-1",
      title: "Kosovo: Fortschritte bei EU-Beitrittsverhandlungen erwartet",
      source: "DW",
      flag: "🇩🇪",
      excerpt: "Kosova ka bërë hapa të rëndësishëm drejt integrimit evropian, sipas analistëve gjermanë.",
      href: "https://www.dw.com/search/?languageCode=en&item=kosovo",
    },
    {
      id: "d-de-2",
      title: "Kosovo-Diaspora in Deutschland: Eine Generation zwischen zwei Welten",
      source: "Der Spiegel",
      flag: "🇩🇪",
      excerpt: "Rreth 300,000 kosovarë jetojnë në Gjermani — brezi i ri po ndërton identitetin e vet midis dy kulturave.",
      href: "https://www.spiegel.de/thema/kosovo/",
    },
    {
      id: "d-de-3",
      title: "Windenergie-Projekt in Kosovo: Deutsches Konsortium gewinnt Ausschreibung",
      source: "Süddeutsche Zeitung",
      flag: "🇩🇪",
      excerpt: "Kompani gjermane fitojnë tenderin historik për ndërtimin e parkut të parë të erës në Kosovë.",
      href: "https://www.sueddeutsche.de/thema/Kosovo",
    },
  ],
  zvicra: [
    {
      id: "d-ch-1",
      title: "Kosovo auf dem Weg nach Europa: Hoffnung und Hindernisse",
      source: "NZZ",
      flag: "🇨🇭",
      excerpt: "Zvicra, si partnere e rëndësishme, ndjek me vëmendje procesin e integrimit të Kosovës në BE.",
      href: "https://www.nzz.ch/international/",
    },
    {
      id: "d-ch-2",
      title: "Kosovo: 200'000 Kosovaren leben in der Schweiz — ihr Geld formt die Heimat",
      source: "20 Minuten",
      flag: "🇨🇭",
      excerpt: "Diaspora kosovare në Zvicër dërgon mbi 400 milionë euro çdo vit — remitancat mbajnë familjet.",
      href: "https://www.20min.ch/ausland/",
    },
    {
      id: "d-ch-3",
      title: "Pristina: Die aufstrebende Technikmetropole des Balkans",
      source: "Tages-Anzeiger",
      flag: "🇨🇭",
      excerpt: "Prishtina po bëhet qendër e teknologjisë në Ballkan — startupet tërheqin vëmendjen e investitorëve zviceranë.",
      href: "https://www.tagesanzeiger.ch/ausland/",
    },
  ],
  italia: [
    {
      id: "d-it-1",
      title: "Kosovo, la piccola nazione che punta all'Europa",
      source: "La Repubblica",
      flag: "🇮🇹",
      excerpt: "Italia është ndër vendet që mbështesin fuqishëm rrugën e Kosovës drejt Bashkimit Evropian.",
      href: "https://www.repubblica.it/esteri/",
    },
    {
      id: "d-it-2",
      title: "Pristina, la nuova Silicon Valley dei Balcani",
      source: "Corriere della Sera",
      flag: "🇮🇹",
      excerpt: "Ekosistemi i startupeve në Prishtinë po tërheq vëmendjen e mediave italiane si model suksesi.",
      href: "https://www.corriere.it/esteri/",
    },
    {
      id: "d-it-3",
      title: "Kosovo: il cinema di Donika Hasani conquista Berlino",
      source: "La Stampa",
      flag: "🇮🇹",
      excerpt: "Kinematografia kosovare merr vëmendjen ndërkombëtare — filmi 'Lumi i Bardhë' fiton Arinjin e Artë.",
      href: "https://www.lastampa.it/esteri/",
    },
  ],
  shba: [
    {
      id: "d-us-1",
      title: "Kosovo's Path to NATO: Why Washington Remains Its Most Reliable Ally",
      source: "AP",
      flag: "🇺🇸",
      excerpt: "SHBA mbetet garantuesi kryesor i sigurisë kosovare — roli amerikan në Ballkan po shtohet me investime dhe praninë diplomatike.",
      href: "https://apnews.com/hub/kosovo",
    },
    {
      id: "d-us-2",
      title: "A Young Democracy's Fight: Kosovo's Anti-Corruption Push Under Kurti",
      source: "New York Times",
      flag: "🇺🇸",
      excerpt: "Kurti's government earns praise from US observers for transparency reforms, even as critics warn of risks to regional stability.",
      href: "https://www.nytimes.com/topic/destination/kosovo",
    },
    {
      id: "d-us-3",
      title: "Kosovo's Tech Boom: The Balkans' Unlikely Startup Success Story",
      source: "Bloomberg",
      flag: "🇺🇸",
      excerpt: "Investitorët amerikanë po shikojnë nga Prishtina — ekosistemi i startupeve është rritur 60% brenda dy viteve.",
      href: "https://www.bloomberg.com/europe",
    },
  ],
  britania: [
    {
      id: "d-gb-1",
      title: "Kosovo at a Crossroads: Europe's Youngest State Eyes EU Membership",
      source: "The Guardian",
      flag: "🇬🇧",
      excerpt: "Britania vazhdon të mbështesë pavarësinë e Kosovës — Guardian ndjek nga afër rrugën e Kosovës drejt integrimit europian.",
      href: "https://www.theguardian.com/world/kosovo",
    },
    {
      id: "d-gb-2",
      title: "Kosovo's Olympic Judokas Prove a Nation's Strength Goes Beyond Borders",
      source: "BBC Sport",
      flag: "🇬🇧",
      excerpt: "Nora Gjakova dhe Distria Krasniqi bëjnë historinë — medaljet e arit olimpike vënë Kosovën në hartën sportive ndërkombëtare.",
      href: "https://www.bbc.com/news/topics/cnx753jejyjt",
    },
    {
      id: "d-gb-3",
      title: "Kosovo's Council of Europe Bid: A Diplomatic Win Years in the Making",
      source: "Reuters",
      flag: "🇬🇧",
      excerpt: "Anëtarësimi në Këshillin e Evropës shënon arritjen diplomatike më të madhe të Kosovës që nga shpallja e pavarësisë.",
      href: "https://www.reuters.com/world/europe/",
    },
  ],
  austria: [
    {
      id: "d-at-1",
      title: "Kosovo auf dem Weg nach Brüssel: Wien setzt auf Dialog",
      source: "Der Standard",
      flag: "🇦🇹",
      excerpt: "Austria mbështet integrimin e Kosovës — Vienna ka rolin e ndërmjetësit aktiv në dialogun Kosovë-Serbi.",
      href: "https://www.derstandard.at/international",
    },
    {
      id: "d-at-2",
      title: "Kosovos Wirtschaft wächst — österreichische Firmen profitieren",
      source: "Die Presse",
      flag: "🇦🇹",
      excerpt: "Kompanitë austriake janë ndër investitorët kryesorë në sektorin energjetik dhe ndërtimin e infrastrukturës kosovare.",
      href: "https://www.diepresse.com/aussenpolitik",
    },
    {
      id: "d-at-3",
      title: "Pristina als Kulturhauptstadt: Kosovo entdeckt seine kreative Energie",
      source: "ORF",
      flag: "🇦🇹",
      excerpt: "Prishtina po zhvillohet si qendër kulturore rajonale — kinema, muzikë dhe art bashkëkohor tërheqin vëmendjen europiane.",
      href: "https://orf.at/stories/",
    },
  ],
  suedia: [
    {
      id: "d-se-1",
      title: "Kosovo och EU: En lång resa mot europeisk integration",
      source: "SVT",
      flag: "🇸🇪",
      excerpt: "Suedia ka qenë ndër mbështetëset kryesore të Kosovës — anëtarësimi në Këshillin e Evropës shihet si hap historik.",
      href: "https://www.svt.se/nyheter/utrikes/",
    },
    {
      id: "d-se-2",
      title: "Kosovos ungdomar bygger framtidens Balkan med teknik och innovation",
      source: "Aftonbladet",
      flag: "🇸🇪",
      excerpt: "Brezi i ri kosovar po ndërton të ardhmen me teknologji — diaspora kosovare në Suedi është një urë e rëndësishme inovacioni.",
      href: "https://www.aftonbladet.se/nyheter/",
    },
    {
      id: "d-se-3",
      title: "Kosovo: Landet som vill bli en del av Europa",
      source: "Dagens Nyheter",
      flag: "🇸🇪",
      excerpt: "DN analizon rrugën e Kosovës — nga pavarësia drejt integrimit europian, sfida dhe mundësitë e vendit.",
      href: "https://www.dn.se/varlden/",
    },
  ],
};

export function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function calcReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
