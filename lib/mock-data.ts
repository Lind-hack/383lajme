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
    title: "BE publikon raportin e progresit pÃ«r KosovÃ«n: Hapa pozitivÃ« por sfida mbeten",
    excerpt:
      "Komisioni Evropian ka vlerÃ«suar pÃ«rparimin e KosovÃ«s drejt anÃ«tarÃ«simit, duke theksuar reformat gjyqÃ«sore dhe luftÃ«n kundÃ«r korrupsionit.",
    body: `Komisioni Evropian ka publikuar raportin vjetor te progresit per Kosoven, duke vleresuar ne menyre gjitheperfshines ecurine e reformave ne te gjithe fushat kryesore te integrimit europian. Dokumenti i zgjeruar perfshin analiza te detajuara mbi sektoret e drejtesise, luften kunder korrupsionit, lirite themelore dhe te drejtat e komuniteteve ne te gjitha dimensionet e tyre. Vleresimi pozitiv per zbatimin e marreveshjes bazike me Serbine dhe per reformat gjyqesore pershkruhet si arritja kryesore e periudhes se fundit. Komisioni veÃ§on permiresimin e efikasitetit te sistemit te drejtesise si hap kritik drejt standardeve europiane te shtetet aspirante per anetaresim. Megjithate, dokumenti 120 faqesh identifikon sfida te mbetura serioze te cilat kerkojne adresim te vazhdueshÃ«m dhe konsistent nga institucionet kosovare. Papunesia e larte sidomos tek te rinjte, emigrimi masiv i kapitalit njerezor dhe pabarazia rajonale mbeten sfida prioritare qe kerkojne politika strukturore afatgjate dhe te koordinuara me partnerÃ«t nderkombetare. Kryeministri kosovar priti raportin me qendrim konstruktiv dhe theksoi angazhimin e qeverise per zbatimin e te gjithe pikave te rekomanduara per periudhÃ«n qe vjen. Ai veÃ§oi liberalizimin e vizave si nje nga arritjet me konkrete qe ka ndikuar drejtperdrejt ne cilesine e jetes se qytetareve kosovar. Opozita parlamentare kerkoi llogaridhenie per vonesÃ«n e reformave dhe theksoi se ritmi i progresit eshte ngadalesuar nen qeverine aktuale ne disa sektore specifike te identifikuara nga Komisioni. Organizatat e shoqerise civile vleresuan raportin si realist dhe theksuan nevojÃ«n per monitorim te pavarur te zbatimit te reformave te rekomanduara nga qeveria. Ato kerkuan transparencÃ« me te madhe ne institucionet publike dhe permiresim te mekanizmave te llogaridheniÃ«s per zyrtaret ne te gjitha nivelet e administrates publike. Parlamenti Europian do te diskutoje gjeresisht raportin ne sesionin plenar te muajit te ardhshem ku priten debate te rendesishme per perspektiven e anetaresimit. Statusi i kandidatit per anetaresim mbetet prioriteti strategjik i politikes se jashtem kosovare dhe nje objektive me mbeshtetje te gjere publike ndermjet partive politike kryesore. Bashkimi Europian ka konfirmuar vazhdimesine e fondeve te asistences per zbatimin e reformave te rekomanduara. Instrumenti IPA dhe mekanizmat e tjere te financimit europian do te mbeshtesin financiarisht procesin e transformimit institucional te nevojshem per integrimin e plote ne komunitetin europian.`,
    source: "Reuters",
    sourceFlag: "ðŸ‡¬ðŸ‡§",
    sourceBias: "neutral",
    tone: "positive",
    category: "PolitikÃ«",
    publishedAt: "2025-05-20T08:00:00Z",
    readingTime: 4,
    featured: true,
    imageUrl: "https://picsum.photos/seed/kosova-be-raport/800/500",
  },
  {
    id: "2",
    slug: "ekonomia-kosoves-rritje",
    dispatch: "02",
    title: "FMN: Ekonomia e KosovÃ«s pritet tÃ« rritet 4.2% nÃ« 2025",
    excerpt:
      "Fondi Monetar NdÃ«rkombÃ«tar ka rishikuar parashikimet ekonomike pÃ«r KosovÃ«n, duke projeksionuar rritje mÃ« tÃ« lartÃ« se sa pritej.",
    body: `Parashikimet ekonomike te Fondit Monetar Nderkombetar per Kosoven jane rishikuar ne drejtim pozitiv, duke projektuar nje rritje te GDP-se prej 4.8 perqind per vitin aktual. Ky nivel tejkalon mesataren rajonale dhe pasqyron performancÃ«n pozitive te sektoreve kryesore si ndertimi, tregtia me shumice dhe sherbimet financiare te vendit. Analiza e FMN-se thekson se stabiliteti fiskal i Kosoves ka qene i qendrueshÃ«m gjate viteve te fundit dhe ka rritur besueshmÃ«rinÃ« e vendit si partner ekonomik rajonal. Te ardhurat tatimore dhe doganore jane rritur ne menyre te vazhdueshme duke kontribuar ne stabilitetin e buxhetit dhe duke lejuar rritje te investimeve publike ne infrastrukture. Megjithate, ekspertet nderkombetare theksojne sfida strukturore qe kerkojne adresim prioritar per nje rritje ekonomike me te qendrueshme dhe gjitheperfshirese. Investimet e huaja direkte mbeten nen potencialin e vendit dhe kufizojne transferimin e teknologjise dhe krijimin e vendeve te punes te kualifikuara ne sektore strategjike te ekonomise. Sektori bankar vlerÃ«sohet si i qendrueshÃ«m nga ana e FMN-se me tregues te pranueshme te kapitalizimit dhe likuiditetit. Normat e kredive jo-performuese ndodhen ne nivel te kontrollueshem ndersa huazimi per sektorin privat ka shenuar rritje te konsiderueshme ne vitet e fundit. Inflacioni ka zbritur gradualisht nga kulmet e arritura gjate krizÃ«s energjetike globale dhe tashme ndodhet brenda kufijve te pranueshÃ«m per nje ekonomi te hapur europiane. Ministri i Financave priti me optimizem vleresimin e FMN-se dhe prezantoi planin ambicioz per investime publike ne infrastrukturÃ« rrugore, energjetike dhe dixhitale per periudhÃ«n e ardhshme. Ekspertet e shoqerise civile dhe organizatat nderkombetare kerkojne qe rimÃ«kembja ekonomike te shoqerohet me politika sociale efektive qe adresojne pabarazine ne te ardhura midis popullates urbane dhe asaj rurale. Komuniteti i biznesit kosovar ka vleresuar me optimizem parashikimet e FMN-se dhe ka kerkuar vazhdimin e reformave per te permiresuar ambientin rregullator dhe per te reduktuar barrÃ«n administrative mbi kompanitÃ«. Sipas analisteve te pavarur, reformimi i tregut te punes dhe investimet ne arsim te larte e formim profesional jane parakushte thelbësorë per nje rritje ekonomike te qendrueshme ne afat te gjate. Projektet infrastrukturore te financuara nga BE dhe institucionet financiare nderkombetare jane identifikuara si katalizatore kryesore te zhvillimit ekonomik kosovar per dekadat qe vijne.`,
    source: "Bloomberg",
    sourceFlag: "ðŸ‡ºðŸ‡¸",
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
    title: "NATO dhe KFOR intensifikojnÃ« stÃ«rvitjet nÃ« veri tÃ« KosovÃ«s",
    excerpt:
      "Forcat e NATO-s kanÃ« filluar njÃ« seri stÃ«rvitjesh ushtarake nÃ« veri tÃ« KosovÃ«s, duke dÃ«rguar mesazh qartÃ« pÃ«r angazhimin e aleancÃ«s.",
    body: `Forcat e KFOR-it te udhehequra nga NATO zhvilluan nje ushtrim te madh operacional per te testuar gatishmerine ne terren ne Kosove gjate dy diteve te fundit. Ushtrimi gjitheperfshines perfshiu mbi gjashteqind ushtare nga njezet vende anetare qe testuan koordinimin e forcave ndermjet shteteve qe kontribuojne ne mision, interoperabilitetin e sistemeve te ndryshme te armÃ«ve dhe pajisjeve dhe procedurat standarde te punes nen skenarÃ« te simuluar te tensionit dhe krizÃ«s. Komandanti i KFOR-it theksoi se ushtrimi demonstruar me sukses gatishmerine e larte operacionale te forcave nderkombetare. Ai shtoi se prania e KFOR-it ne Kosove vazhdon te jete nje garanci vendimtare per stabilitetin e rajonit dhe per mbeshtetjen e institucioneve vendase te sigurise ne Ã§do skenar te mundshÃ«m te destabilizimit. Sipas deklaratÃ«s zyrtare, ushtrimi perfshiu skenarÃ« te rendesishme operacionale duke filluar nga menaxhimi i turmave dhe kufizimi i incidenteve te mundshme, kalimi ne zonat kufitare, dhe deri tek operacionet komplekse te kerkimit dhe shpetimit ne terren malor e te veshtire. Skenari me sfidues ishte ai i fundit, qe testoi ne menyre intensive bashkÃ«punimin operacional ndermjet KFOR-it, ForcÃ«s se Sigurise se Kosoves dhe sherbimeve te emergjencÃ«s civile. Forca e Sigurise se Kosoves mori pjese aktive ne disa faza te ushtrimit, duke demonstruar kapacitetet e saj ne rritje. Komandanti i FSK-se tha se institucionet vendase te sigurise po zhvillohen ne menyre te shpejte dhe jane ne nje rruge te drejte drejt integrimit me te plote me strukturat aleate sipas standardeve te dakorduar. BashkÃ«punimi mes KFOR-it dhe FSK-se u vleresua pozitivisht nga vezhguesit ushtarake nderkombetare te pranishem gjate ushtrimit. NATO ka shtuar prezencÃ«n e saj ne Ballkan si pjese e nje politike me te gjere rajonale per te forcuar stabilitetin. Investimet ne kapacitetet e forcave lokale te sigurise dhe ne trajnimin e personelit ushtarak kosovar jane rritur ne vitet e fundit. Analiste te sigurise theksojne se stabiliteti i Kosoves eshte i lidhur ngushte me perspektivÃ«n europiane te vendit dhe me procesin e integrimit ne strukturat atlantike. Normalizimi i marrÃ«dhÃ«nieve me Serbine, si edhe reformat e brendshme institucionale, jane elemente kryesore per nje arkitekture te qendrueshme sigurie afatgjate ne regjion. Keshilli Kombetar i Sigurise te Kosoves ka miratuar nje strategji te rishikuar te sigurise kombetare qe perfshin rreziqet e reja te identifikuara ne mjedisin rajonal dhe global. Dokumenti i rishikuar vendos prioritet bashkepunimin me aleatÃ«t, forcimin e kapaciteteve te inteligjencÃ«s dhe zhvillimin e nje sistemi reagimi me efektiv ndaj kercÃ«nimeve te reja. Ministria e Mbrojtjes ka njoftuar nje plan pesevjecar per modernizimin e FSK-se i cili parashikon blerje te pajisjeve te reja te sferÃ«s ushtarake, trajnime intensive dhe permiresim te strukturÃ«s komanduese. Fondimi do te vije pjeserisht nga buxheti kombetar dhe pjeserisht nga mbeshtetja e aleateve perindimore. Bashkesia nderkombetare ka qene unanime ne mbeshtetjen e stabilitetit te Kosoves. Shtetet e Bashkuara e Amerikes, Mbreteria e Bashkuar, Gjermania dhe vendet e tjera te G7 kane konfirmuar vazhdimesine e angazhimit te tyre per sigurine e vendit. Parlamenti i Kosoves ka debatuar gjeresisht per politiken e mbrojtjes dhe per perspektiven e anetaresimit ne NATO. Grupet parlamentare ndajne mendimin se anÃ«taresia ne NATO eshte objektive strategjike dhe se duhet te behet prioritet i politikes se jashtem. Opinioi publik kosovar mbeshtet me force prezencÃ«n e KFOR-it, sipas sondazheve te fundit te organizatave rajonale te kerkimit. Mbi 75 perqind e qytetareve e shohin forcen nderkombetare si nje faktor stabilizues dhe te dobishÃ«m per qetesine e vendit.`,
    source: "DW",
    sourceFlag: "ðŸ‡©ðŸ‡ª",
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
    title: "Diaspora shqiptare dÃ«rgon mbi 1 miliard euro nÃ« KosovÃ« gjatÃ« 2024",
    excerpt:
      "Remitancat nga diaspora shqiptare kanÃ« arritur nivele rekorde, duke bÃ«rÃ« KosovÃ«n ndÃ«r vendet me varÃ«sinÃ« mÃ« tÃ« lartÃ« nga remitancat.",
    body: `Banka Qendrore e Kosoves ka raportuar nje rritje te remitencave ne vleren rekorde prej nje miliard e dyqind milione euro gjate vitit te kaluar, qe eshte nje rritje prej dyzete milionesh euro krahasuar me vitin e meparshem. Ky trend i vazhdueshem pozitiv tregon se diaspora kosovare vazhdon te mbeshtes familjet vendase dhe te kontribuoje ne menyre te rendesishme ne ekonomine e vendit. Remitencat ndikojne drejtperdrejt ne standardin e jeteses se nje pjese te madhe te familjeve kosovare duke permiresuar fuqinÃ« blerÃ«se te tyre. Buxhetet familjare qe marrin remitenca shpenzojne me teper per arsim, shendetesi, banesa dhe mallra te qendrueshme te konsumit. Kjo shpenzim stimulon aktivitetin ekonomik vendor dhe mbeshtet sektoret e ndertimit dhe tregtise me pakicÃ«. Ekonomistet vleresojne se rreth njezet perqind e familjeve ne Kosove marrin rregullisht remitenca nga anetare te diasporÃ«s qe jetojne ne EuropÃ« dhe ne vendet e Gjirit arab. Diaspora kosovare numeron rreth dymijÃ« e pesÃ«qind mije njerezÃ« te shperndare kryesisht ne Gjermani, ZvicÃ«r, Austri, Itali dhe vendet nordike. Komuniteteve te forta ne keto vende kane bere investime te konsiderueshme ne ekonomine e Kosoves, sidomos ne sektorin e hoteleri-turizmit, tregtise dhe ndertimit rezidencial ne qytete te ndryshme. Banka Qendrore ka ndermarre nisma per te zhvilluar produkte financiare qe terhejne me teper kapital te diasporÃ«s per investime produktive afatgjate. Obligacionet e diasporÃ«s, depozitat me afat me norma preferenciale dhe fondet e investimeve ne sektore specifike jane instrumente financiare qe jane duke u studiuar dhe pilotuar ne bashkepunim me institucionet financiare nderkombetare. Analiste theksojne se potenciali total i remitencave eshte me i madhe sesa numrat aktual. Nese vetem njezet perqind e remitencave do te ridrejtohej per investime prodhuese, kjo do te gjeneronte mbi dyqind milione euro investime shtese Ã§do vit per sektore si bujqesia, prodhimi industrial, turizmi dhe industria e teknologjise. Qeveria ka hapur nje agenci te dedikuar per bashkepunim me diasporÃ«n e cila ofron asistence te personalizuar per investitoret qe duan te investojne ne Kosove. Agjencia ndihmon investitoret te kuptojne sistemin ligjor dhe rregullator kosovar, identifikojne mundesi biznesi konkrete dhe lidhen me partnere lokalÃ« te pershtatshem. Komunitetet e diasporÃ«s ne EuropÃ« jane shume te organizuara dhe kane krijuar shoqata kulturore, ekonomike dhe politike efektive ne vendet pritese. Keto shoqata luajne rol te rendesishem si ura lidhese mes Kosoves dhe vendeve pritese, duke avancuar imazhin e vendit dhe duke lobuar per interesat kosovare ne institucionet europiane dhe nderkombetare. Sektori financiar kosovar ka pesuar transformime te rendesishme ne pese vitet e fundit. Hyrja e bankave te reja nderkombetare ka intensifikuar konkurrencen dhe ka permiresuar kushtet per konsumatoret dhe biznesin. Normat e interesit per depozitat jane bere me favorable ndersa kostot e kredive per kompanitÃ« e mesme jane ulur duke lehtesuar aksesin ne kapital per sipermares. Remitencat ndikojne gjithashtu ne tregun e pasurive te paluajtshme. Kerkesa per banesa ne qytetet kryesore si Pristine, Prizren dhe Gjilan mbetet e larte, e ushqyer pjeserisht nga investimet e diasporÃ«s dhe te qytetareve qe kthehen pas viteve te punÃ«s jashtÃ«. Kjo dinamike ka mbeshtetuar industrine e ndertimit por ka rritur gjithashtu Ã§mimet e banesave per familjet me te ardhura te mesme. Ekspertet e ekonomise rekomandojne politika per te diversifikuar burimet e te ardhurave te ekonomise kosovare dhe per te reduktuar varÃ«sinÃ« e tepruar nga remitencat si burim kryesor i te ardhurave valutore. Investimet ne arsimin e larte, kerkimin shkencor dhe sektoret me teknologji te larte mund te prodhojne te ardhura me te larta per brezat e rinj dhe te reduktojne emigracionin ekonomik qe vazhdon ne shkalle te larte. Ministria e Financave ka mbikeqyrur rritjen e buxhetit per investime publike ne infrastrukture duke synuar qe kjo te shtyjÃ« gjithashtu investimet private. Projekte te rendesishme si zgjerimi i rrugeve, permiresimi i aeroportit dhe rehabilitimi i sistemit hekurudhor jane te planifikuara dhe do te ndihmojne ne integrimin ekonomik rajonal. Bashkimi Europian ka ofruar fonde te konsiderueshme per zhvillimin ekonomik te Kosoves nepermjet instrumentit IPA dhe mekanizmave te tjere te mbeshtetjes financiare. Nese keto fonde perdoren efektivisht dhe ne kohe, mund te ndihmojne ne modernizimin e infrastrukturÃ«s fizike dhe dixhitale te vendit duke krijuar kushte me te mira per rritje afatgjate ekonomike.`,
    source: "AP",
    sourceFlag: "ðŸ‡ºðŸ‡¸",
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
    title: "Ekipi kombÃ«tar i KosovÃ«s kualifikohet pÃ«r fazÃ«n e grupeve tÃ« LigÃ«s sÃ« Kombeve",
    excerpt:
      "KombÃ«tarja e futbollit e KosovÃ«s ka arritur kualifikimin historik pas fitoreve tÃ« rÃ«ndÃ«sishme ndaj skuadrave evropiane.",
    body: `Futbollistet e kombetares se Kosoves shperblyen punÃ«n e vazhdueshme te viteve me nje fitore historike kunder njeres nga skuadrat me konkurruese te Europes. Golat e shenuara ne minutat e para te lojÃ«s demonstruan nivelin e larte te gatishmerisÃ« fizike dhe taktike te ekipit nÃ«n drejtimin e trajnerit aktual. Trajneri i kombetares deklaroi se ky rezultat konfirmon progresin e dukshÃ«m qe ka bere ekipi gjate dy viteve te fundit. Ai veÃ§oi perqendrimin kolektiv dhe disiplinÃ«n taktike te lojtareve si faktore vendimtare per fitoren. Mbrojtja e ngurtÃ« e ekipit i mbajti kundershtar te forte pa gola per 90 minuta. Mesfushori yll i kombetares i cili ka luajtur pese vjet ne kampionate te forta europiane u shpreh i lumtur per perqendrimin e demonstruar nga te gjithe lojtarÃ«t ne fushÃ«. Ai tha se besimi i ekipit eshte ne nivelin me te larte te mundshÃ«m dhe se tÃ« gjithe janÃ« te motivuar per te bere histori ne garat qe vijne. Tifo esira qe mbushi stadiumin me kapacitet te plote krijoi nje atmosferÃ« elektrizuese gjate te gjithe ndeshjes, duke ndikuar pozitivisht ne motivimin e lojtareve. Federata e futbollit te Kosoves vleresoi fitoren si tregues i strategjise afatgjate per zhvillimin e talenteve rinore ne e gjithe vendin. Akademia e re e futbollit e ndertuar ne Gjakove dhe qendrat e trajnimit ne Prizren dhe Peje prodhojnÃ« tashme talente te nivelit europian. Trajneret e ekipeve te moshave kane shprehur optimizÃ«m per brezen e ri qe po ngjit ne skuadrat kombetare. Me nje radhÃ« te shquar lojtareve te formuar ne sisteme profesionale europiane Kosova ka kapacitetin real per te arritur suksese te mdha ne garat europiane ne vitet qe vijne. Klube te njohura europiane kane shfaqur interes konkret per disa lojtare te kombetares kosovare pas performances se shkÃ«lqyer te demonstruar ne kete ndeshje. Drejtuesit e Federates se Futbollit te Kosoves jane ne bisedime me UEFA-n per rritjen e numrit te ndeshjeve shtepie ne Pristine dhe per permiresimin e infrastrukturÃ«s se stadiumit kombÃ«tar per te arritur kapacitetin e nevojshem per ndeshjet e kalibrit te larte europian. Fansat kosovar ne diapora ndoqen ndeshjen me entuziazem te madh ne kafe dhe bare ne Gjermani ZvicÃ«r dhe Austri duke e bere kete me teper se nje fitore sportive.`,
    source: "France 24",
    sourceFlag: "ðŸ‡«ðŸ‡·",
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
    title: "Prishtina renditur ndÃ«r qytetet me rritjen mÃ« tÃ« shpejtÃ« tÃ« startupeve tech nÃ« Ballkan",
    excerpt:
      "Raport i ri tregon se ekosistemi i startupeve teknologjike nÃ« PrishtinÃ« ka njohur rritje 60% gjatÃ« dy viteve tÃ« fundit.",
    body: `Nje studim i kryer nga organizata nderkombetare StartupBlink renditi Kosoven ndermjet 50 vendeve me ekosisteme startupesh ne rritje me te shpejte ne EuropÃ« gjate vitit 2025. Raporti vjetore tregoi se Pristina renditet si qyteti me dinamik ne Ballkan nga ana e numrit te startupeve te reja te regjistruara dhe vleres se kapitalit te investuar ne startup-e vendase. Ekosistemi teknologjik kosovar ka pare nje transformim te thellÃ« ne pese vitet e fundit. Numri i kompanive teknologjike aktive ka tejkaluar dyqind firma, nga te cilat tridhjete kane arritur te eksportojne produkte dhe sherbime ne tregjet nderkombetare. Investitoret e kapitalit rreziku jane gjithnje me te interesuar per startup-et kosovare. Fondet europiane dhe rajonale te venture capital kane bere investime ne kompani kosovare ne fushat e fintech, edtech, healthtech dhe inteligjences artificiale. Edhe nje fond i vogel amerikan ka realizuar investimet e para ne Kosove, sinjalizando interesin e nje audience me te gjere nderkombetare. Faktore te shumte terhejne investitoret ne Kosove. Kostoja e talenteve teknologjike eshte me e ulur se ne EuropÃ«n Perendimore por kualifikimi eshte i nivelit te larte dhe krahasueshem. Universitetet kosovare prodhojne mbi dymijÃ« inxhiniere informatike Ã§do vit, shumica e te cilÃ«ve flasin anglisht ne nivel te larte profesional dhe kane njohuri te shkÃ«lqyera te matematikÃ«s. Qeveria ka ndermarre hapa konkrete per te mbeshtur ekosistemi te startupeve. Ligji i ri per startup-et miratuar dy vjet me pare ofron lehtesira tatimore dhe procedura te thjeshtezuara te regjistrimit. BashkÃ«rendim me efektiv mes universiteteve, qeverise dhe sektorit privat po e bÃ«n Kosoven gjithnje me te terhekese si destinacion per startup-et teknologjike. Hub-et teknologjike ne Pristine, Prizren dhe Gjakove jane kthyer ne qendra aktive bashkÃ«punimi te gjalla me atmosferÃ« kreative. Keto hapesira ofrojnÃ« mentoring, akses ne rrjete nderkombetare biznesi dhe mbeshtetje per sipermares ne fazat e hershme te zhvillimit. Programet e akseleratit rajonal dhe europian kane ndihmuar startup-et kosovare te hyjne me sukses ne tregjet perÃ«ndimore. Akseleratoret ofrojne trajnime intensive, kontakte me investitorÃ« te nivelit te larte dhe ekspertize te specializuar sektoriale. Eksportet e sherbimeve IT nga Kosova kane arritur nivelet me te larta historike, qe tregon se sektori po behet nje shtylÃ«le gjithe me e rendesishme e ekonomise kombetare.`,
    source: "TechCrunch",
    sourceFlag: "ðŸ‡ºðŸ‡¸",
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
    title: "Bisedimet KosovÃ«-Serbi rinovohen nÃ«n ndÃ«rmjetÃ«simin e BE-sÃ« nÃ« Bruksel",
    excerpt:
      "Delegacioni kosovar dhe ai serb janÃ« takuar sÃ«risht nÃ« Bruksel, me zyrtarÃ«t e BE-sÃ« duke shpresuar nÃ« zbatimin e marrÃ«veshjes bazÃ«.",
    body: `Bisedimet midis delegacionit te Kosoves dhe Serbise vazhduan sot ne Bruksel nen ndermjetesimin e perfaqesuesit te posaÃ§Ã«m te Bashkimit Europian per dialogun ndermjet Pristines dhe Beogradit. Seanca e sotme e zgjeruar u fokusua kryesisht ne vleresimin e zbatimit te marreveshjeve te arritura ne muajt e meparshem dhe ne identifikimin e hapave konkrete per normalizimin e metejshem te marrÃ«dhÃ«nieve dypaleshÃ«. Kryenegociatori kosovar deklaroi se Kosova eshte treguar e gatshme per dialog konstruktiv dhe ka zbatuar te gjitha detyrimet sipas planit te veprimit te dakorduar me partneret europiane. Ai shtoi se priste angazhim te barabarte nga Serbia per zbatimin e plotÃ« te marreveshjes bazike te normalizimit. Delegacioni serb nga ana e tij shprehu deshiren per dialog te sinqerte dhe zvillimin e zgjidhjes per Ã§eshtjet e hapura. Keto perfshin te drejtat e komuniteteve, administrimin e pasurive, procesimin e personave te zhdukur dhe nderlidhjen infrastrukturore ndermjet dy vendeve fqinje me potencial te madh ekonomik. Perfaqesuesi i posaÃ§Ã«m i BE-se per dialogun u shpreh i kenaqur me progresin e arritur ne Ã§eshtje te caktuara teknike gjate kesaj seance pune. Ai veÃ§oi punÃ«n e perbashket per hartimin e regjistrave kadastrale ne zonat e shkembimit si nje shembull pozitiv i bashkÃ«punimit teknik nen kujdesin dhe koordinimin e Bashkimit Europian. Organizatat e shoqerise civile ne te dy vendet kane shprehur rezerva per qendrueshmÃ«rinÃ« e marreveshjeve pa nje konsensus me te gjere ne popullatat respektive. Sondazhet tregojne se njerezit ne te dy vendet kane pritshmÃ«ri te ndryshme per rezultatin final te procesit te dialogut dhe ky hendek vlerash mbetet sfidÃ« serioze qe duhet adresuar me komunikim dhe transparencÃ«. Ambasadori amerikan ne Kosove tha se Shtetet e Bashkuara mbeshtesin me forca normalizimin dhe besojne qe zgjidhjet e drejtÃ« per Ã§eshtjet e mbetura ekzistojne nese ka vullnet politik nga te dyja palet. Komuniteti serb ne Kosove ka shprehur shqetesime per Ã§eshtje te tilla si arsimimi ne gjuhen amtare, sherbime administrative ne gjuhen serbe dhe participimi me i gjere ne institucionet publike kosovare. Qeveria kosovare ka premtuar dialog te vazhdueshem me keto komunitet dhe ka ndermarre disa hapa pozitive. Parlamenti i Kosoves ka zhvilluar debate te gjera rreth qendrimit te qeverise ne dialogun e Brukselit. Grupet parlamentare kerkuan me shume transparencÃ« dhe informacion publik per ecurine e bisedimeve. Kryeministri premtoi nje konference te plote shtypi me rezultate pas kthimit ne Pristine. Ekipet teknike te dy delegacioneve vazhduan punÃ«n paralele mbi Ã§eshtjet sektoriale te tilla si energjia, transporti, doganat dhe njohja reciproke e kualifikimeve arsimore. Keto grupe pune koordinohen nga ekspertÃ« te Komisionit Europian qe ofrojne udhezim procedural dhe teknik per harmonizimin gradual te praktikave administrative te dy vendeve. Raundi i ardhshem i bisedimeve eshte planifikuar per muajin qe vjen. Tema kryesore pritet te jete Ã§eshtja e kufijve komerciale dhe te barrierave tregtare, nje ndÃ«r pikat me teknike dhe me sensitive te te gjithe agjendÃ«s se normalizimit dypalesh. Ekspertet nderkombetare te politikes rajonale theksojne se dialogu po avancon me ritÃ«m te pranueshÃ«m pavaresisht veshtiresive institucionale. Ata nenvizojne se normalizimi dypalesh eshte i domosdoshÃ«m si per Kosoven ashtu edhe per Serbine ne rrugÃ«n e tyre drejt anetaresimit ne Bashkimin Europian. Mbeshtetja nderkombetare per procesin e dialogut mbetet e gjere dhe e vendosur nga anetaret kryesore te BE-se dhe nga aleatÃ«t transatlantike te regjionit.`,
    source: "BBC",
    sourceFlag: "ðŸ‡¬ðŸ‡§",
    sourceBias: "neutral",
    tone: "neutral",
    category: "PolitikÃ«",
    publishedAt: "2025-05-17T16:00:00Z",
    readingTime: 6,
    featured: false,
    imageUrl: "https://picsum.photos/seed/kosove-serbi-bruksel/800/500",
  },
  {
    id: "8",
    slug: "energji-e-rinovueshme-kosove",
    dispatch: "08",
    title: "Kosova nÃ«nshkruan marrÃ«veshje historike pÃ«r ndÃ«rtimin e parkut tÃ« parÃ« tÃ« erÃ«s",
    excerpt:
      "Qeveria kosovare ka nÃ«nshkruar kontratÃ«n me konsorciun evropian pÃ«r ndÃ«rtimin e parkut tÃ« parÃ« tÃ« erÃ«s me kapacitet 200 MW.",
    body: `Ministria e EkonomisÃ« ka njoftuar nenskrimin e kontratÃ«s me nje konsorcium nderkombÃ«tar firmash europiane per ndertimin e nje parku te madh te energjise diellore ne zonen perÃ«ndimore te Kosoves prane Prizrenit. Projekti ambicioz, i financuar kryesisht nga kapital privat nderkombÃ«tar me bashkefinancim te programeve europiane te mbeshtetjes, pritet te prodhojÃ« energji te mjaftueshme elektrike per ushqyer mbi tridhjete mije familje kosovare ne nje menyre te qendrueshme dhe mjedisisht miqesore. Ministri i Ekonomise theksoi se ky projekt shenon nje moment historik ne procesin e tranzicionit energjetik te Kosoves. Ai shtoi se vendi ka potencial te jashtÃ«zakonshÃ«m per burime te rinovueshme energjetike, vecanerisht diellore dhe erore, te cilin duhet ta shfrytezojÃ« me strategji te qarte per perfitimet afatgjate te vendit. Projekti ka rendesi te veÃ§antÃ« per angazhimet mjedisore te Kosoves. Vendi eshte i angazhuar per respektimin e marreveshjes se Parizit dhe ka perfshire ne strategjinÃ« e tij energjetike kombetare reduktimin e ndjeshÃ«m te emetimeve te dioksidit te karbonit deri ne vitin 2030. Centralet e vjetÃ«ra te karbonit te cilat kane qenÃ« burime kryesore te ndotjes se ajrit do te mbyllen gradualisht ndersa kapacitetet e reja te rinovueshme hyjne progressivisht ne operacion komercial. Konsorciumi ndertues perbehet nga firma te specializuara gjermane, spanjole dhe austriake me dekada eksperience te akumuluar ne projekte te ngjashme te energjise diellore ne EuropÃ« dhe ne boten. Teknologjia qe do te perdoret eshte nga gjenerata me e fundit dhe me efikase e disponueshme ne tregun global te paneleve fotovoltaike, me tregues eficience superiore ndaj asaj qe ishte ne dispozicion deri pak vjet me pare. Punimet zyrtare do te fillojne ne pranvere te vitit qe vjen dhe pritet te perfundojne brenda gjashtÃ«mbÃ«dhjetÃ« muajve nga Ã§elja formale e kantierit. Ne fazÃ«n e ndertimit projekti do te gjenerojÃ« mbi pesÃ«qind vende pune direkte per punonjÃ«s kosovar, ndersa ne fazÃ«n e operimit te qendrueshÃ«m do te kerkojÃ« rreth pesedhjete profesioniste te kualifikuar per mbikeqyrjen teknike dhe mirÃ«mbajtjen e te gjitha pajisjeve. Bashkia e Prizrenit e mirepriti projektin si nje mundesi reale per zhvillimin ekonomik te qendrueshÃ«m te komunÃ«s. Kryetari i bashkise theksoi se nje perqindje e te ardhurave te gjeneruara nga projekti do te derdhÃ« drejtperdrejt ne buxhetin komunal sipas kushteve te specifikuara ne kontratÃ«n e nenÃ«shkruar mes paleve. Keto fonde komunale do te shfrytÃ«zohen per investime prioritare ne infrastrukturÃ«n lokale. Organizatat e mjedisit te Kosoves e vleresuan pozitivisht nisjen e projektit dhe te gjitha sinjalet qe jep per orientimin e politikÃ«s energjetike. Ato kerkojnÃ« monitorim te rreptÃ« te ndikimit mjedisor gjate te gjitha fazave te ndertimit dhe te operimit. TheksojnÃ« gjithashtu nevojÃ«n per konsultime te vazhdueshme dhe te hapur me komunitetet lokale qe jetojnÃ« prane zones dhe qe ndikohen drejtperdrejt nga ky projekt industrial. Bashkimi Europian ka bere tranzicionin energjetik nje prioritet qendror te politikes rajonale te zgjerimit. Kosovo eshte nje nga perfitieset kryesore te fondeve IPA per energjinÃ« e rinovueshme dhe eficiencÃ«n energjetike. Keto fonde eshte planifikuar te perdoren per modernizimin e rrjetit te transmetimit dhe te shperndarjes se energjisÃ« elektrike ne te gjithe territorin e vendit. Operatori i sistemit te transmetimit ka hartuar nje plan te detajuar modernizimi te infrastrukturÃ«s rrjetore qe do te shoqerojÃ« rritjen e kapaciteteve te rinovueshme. Rrjeti aktual i ndertuar kryesisht ne dekadat e kaluara ka nevoje per investime te konsiderueshme per te absorbuar efektivisht prodhimin e variabÃ«l nga burimet diellore dhe eolike pa shkaktuar debalancime te sistemit. Sektori privat kosovar dhe nderkombetarÃ« ka shfaqur interes gjithnje ne rritje per investimet ne energjinÃ« e rinovueshme. Kompani te ndryshme lokale dhe nderkombetare kane aplikuar ne Ministrine e Ekonomise per licenca per ndertimin e parqeve te reja erore ne malet e veriut dhe juglindjes ku era eshte konstante dhe e mjaftueshme per prodhim efikas te energjisÃ«. Ã‡mimi i energjise elektrike per konsumatoret kosovare eshte shtrenjtuar gjate periudhes se fundit per shkak te krizÃ«s globale te Ã§mimeve te lÃ«ndÃ«ve djegese. Qeveria ka nderhyrÃ« me subvencione te synuara per mbrojtjen e shtresave me vulnerabÃ«l te popullsise. Analistet e energjisÃ« theksojnÃ« qe investimet sistematike ne burime te rinovueshme do te stabilizojnÃ« Ã§mimet ne periudhÃ«n afatmesme duke reduktuar varÃ«sinÃ« nga importet e shtrenjta. Partneritetet publiko-private jane identifikuar si modeli me efektiv dhe me i shpejte per te mobilizuar investime ne energjinÃ« e rinovueshme. Kuadri ligjor per keto partneritete eshte permiresuar gjate viteve te fundit dhe ofron garanci me te mira per investitoret private duke reduktuar rreziqet rregullatore dhe duke siguruar nje mjedis me te parashikueshÃ«m per planifikimin afatgjate te kapitalit ne sektorin strategjik te energjisÃ«.`,
    source: "Der Spiegel",
    sourceFlag: "ðŸ‡©ðŸ‡ª",
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
    title: "Filmi kosovar 'Lumi i BardhÃ«' fiton Ã§mimin kryesor nÃ« Festivalin e Berlinit",
    excerpt:
      "Regjisorja Donika Hasani ka fituar Arinjin e ArtÃ« me filmin e saj tÃ« parÃ« tregimtar, duke vÃ«nÃ« KosovÃ«n nÃ« hartÃ«n e kinemasÃ« ndÃ«rkombÃ«tare.",
    body: `Kinematografia kosovare ka shenuar nje dekade te arit ne prodhimin e filmave te cilat pasqyrojne rrefimet autentike ballkanase per audiencën nderkombetare. Festivalet nderkombetare te filmit ne Berlinale Cannes dhe Sundance kane shfaqur vepra te regjisoreve te rinj kosovar duke rritur dukshem prezencen e artit kosovar ne skenat me te rendesishme boterore te kinematografise. Regjisoret e rinj si ata te diplomuar nga Akademia e Arteve ne Pristine jane duke eksploruar tema komplekse lidhur me tranzicionin pas luftes identitetin dhe emigracionin nepermjet gjuhes filmike moderne. Filmi i fundit kosovar i nominuar per çmim nderkombetare ka ardhur pas investimeve te reja te qeverise kosovare ne fondet kombetare per financimin e prodhimeve artistike me potencial nderkombëtar. Kosova Film Center ka rritur buxhetin per ko-prodhime nderkombetare duke terhequr bashkepunim me shtudiot europiane dhe duke hapur dere per distributim me te gjere te filmave kosovar jashte kufijve. Festivali Nderkombëtar i Filmit i Pristinës eshte ngritur ne nje nga ngjarjet kulturore me te rendesishme te rajonit duke terhequr regjisorë producente dhe kritike nga mbi tridhjet shtete europiane. Aktoret kosovar fillojne te merren me role ne prodhimet europiane dhe ne seriale nderkombetare duke demonstruar se talenti i vendit eshte konkurrues edhe ne tregjet me te medha te industrise filmike. Ekspertet e industrise vleresojne se nevojiten investime te vazhdueshme ne infrastrukturën kinematografike ne pajisjet profesionale dhe ne arsimin artistik per ta konsoliduar pozicionin e Kosoves ne harten e kinematografise boterore. Bashkimi Europian nepermjet programit Creative Europe ka perfshire Kosoven si shtet i plote perfitonjës duke mundësuar financim per projektet kinematografike dhe mbeshtetje per bashkepunimin nderkombëtar. Shoqata e kinemase kosovare ka hapur dialog me platformat dixhitale nderkombetare si Netflix dhe Mubi per perfshirjen e filmave kosovar ne katalogjet e tyre duke hapur nje kanal te ri per distribucioni global te artit kosovar. Kritiku kosovar i filmit vleresojne se dekada e ardhshme pritet te jete me e rendesishmja per kinematografine kosovare duke vendosur themeletet e nje industrie te qendrueshme dhe konkurruese ne nivel rajonal dhe europian. Kjo do te sjelle nje valë re entuziastesh te rinj ne industrine kinematografike kosovare.`,
    source: "Le Monde",
    sourceFlag: "ðŸ‡«ðŸ‡·",
    sourceBias: "neutral",
    tone: "positive",
    category: "KulturÃ«",
    publishedAt: "2025-05-15T18:00:00Z",
    readingTime: 4,
    featured: false,
    imageUrl: "https://picsum.photos/seed/kultura-film-berlin/800/500",
  },
  {
    id: "10",
    slug: "arsimi-kosove-reforma",
    dispatch: "10",
    title: "UNICEF: Kosova ka bÃ«rÃ« progres tÃ« konsiderueshÃ«m nÃ« arsimin parauniversitar",
    excerpt:
      "Raporti i ri i UNICEF-it vlerÃ«son pozitivisht reformat nÃ« arsimin fillor dhe tÃ« mesÃ«m, por shton se nevojiten investime shtesÃ«.",
    body: `Sistemi arsimor kosovar eshte duke kaluar neper nje seri reformash gjitheperfshirese te koordinuara nga Ministria e Arsimit me mbeshtetjen e organizatave nderkombetare te specializuara ne zhvillimin e kapaciteteve arsimore. Kurrikula e re kombetare e hartuar ne bashkepunim me ekspertet europiane integron kompetenca dixhitale mendje krijtive dhe aftesi sociale si lende kryesore ne te gjitha nivelet e sistemit arsimor. Investimet ne infrastrukturën shkollore kane arritur nivele rekord me ndertimin e rishikimin e qindra objekteve shkollore ne zona urbane dhe rurale duke reduktuar pabarazine ne qasjen ndaj arsimit cilesor. Reformimi i sistemit te vleresimit eshte procesi qendror i ndryshimit ku vleresimi i bazuar ne kompetenca po zevendeson gradualisht sistemin tradicional te notave duke kerkuar pergatitje intensive te mesuesve. Trajnimi i vazhdueshem i personelit mesimdhenes eshte identifikuar si prioritet strategjik dhe mijera mesues jane regjistruar ne programet e rikualifikimit te financuara nga buxheti kombetar dhe fondet europiane. Universitetet kosovare po forcojne bashkepunimin me institucionet akademike europiane nepermjet programeve Erasmus duke rritur dukshem mobilitetin e studenteve kosovar neper kampuset europiane. Numri i studenteve kosovar qe studiojne jashte vendit ka shënuar rritje te vazhdueshme por autoritetet arsimore po punojne per te krijuar kushte me teper terhequse per kthimin e talenteve te formuara jashte ne ekonomine kosovare. Ministria e Arsimit ka njoftuar rritjen e page te mesuesve si nje nga masat emergjente per te rritur terhiqeshmerine e profesionit mesimdhenes dhe per te kufizuar largimin e mesuesve te kualifikuar drejt sektoreve me fitimprurese te ekonomise. Nje sistem i ri i certifikimit te mesuesve bazuar ne standarde europiane do te implementohet gjate vitit te ardhshem duke standardizuar cilesine e mesimdheniese ne shkallën kombëtare. Projektet pilot te teknologjise se integrimit te inteligjences artificiale ne procesin mesimor jane nisur ne dhjetë shkolla publike ne Pristine si hap i pare per nje sistem arsimor te modernizuar dhe konkurrues. Ekspertet nderkombetare te arsimit vleresojne se me kete ritëm reformash dhe investimesh te duhura Kosova ka potencialin te ndertoje nje sistem arsimor te kategorise europiane brenda nje dekade qe do te pergatise gjeneratat e reja per tregun e punes globale.`,
    source: "Guardian",
    sourceFlag: "ðŸ‡¬ðŸ‡§",
    sourceBias: "neutral",
    tone: "positive",
    category: "ShoqÃ«ri",
    publishedAt: "2025-05-14T11:00:00Z",
    readingTime: 3,
    featured: false,
    imageUrl: "https://picsum.photos/seed/arsimi-unicef-kosove/800/500",
  },
];

export const BREAKING_ITEMS = [
  "BREAKING: BE miraton fondimin e ri 85Mâ‚¬ pÃ«r infrastrukturÃ«n e KosovÃ«s",
  "URGJENTE: Takimi i KÃ«shillit tÃ« Sigurimit tÃ« OKB diskuton situatÃ«n nÃ« Ballkan",
  "FLASH: Prishtina pret delegacion nga 7 vende anÃ«tare tÃ« NATO-s",
  "LAJM: Banka BotÃ«rore miraton kredi 120M$ pÃ«r sektorin energjetik kosovar",
  "ALARM: Temperaturat tejkalojnÃ« 38Â°C â€” rekomandohet qÃ«ndrimi nÃ« shtÃ«pi",
];

export const VIDEO_REACTION = {
  id: "v1",
  title: "Pse BBC-ja thotÃ« se Kosova 'nuk ka arritur ende stabilitet'?",
  topic: "BE-ja dhe Kosova â€” analizÃ« e thellÃ«",
  duration: "2 min",
  linkedArticleSlug: "kosova-be-raport-2025",
  publishedAt: "2025-05-20T09:00:00Z",
  thumbnailGradient: "linear-gradient(135deg, #FF4422 0%, #1A1A1A 100%)",
};

export const THROWBACK_ARTICLE = {
  id: "t1",
  year: "2020",
  oldTitle: "Kosovo â€” A State Still Fighting For Recognition",
  oldSource: "New York Times",
  oldSourceFlag: "ðŸ‡ºðŸ‡¸",
  oldExcerpt:
    "Five years after declaring independence, Kosovo remains unrecognized by five EU members and faces diplomatic isolation at international institutions.",
  todayNote:
    "Sot, Kosova ka 117 njohje. Procesi i anÃ«tarÃ«simit nÃ« KÃ«shillin e EvropÃ«s pÃ«rfundoi me sukses nÃ« 2024.",
  publishedAt: "2020-05-18T00:00:00Z",
};

export const THROWBACK_ARTICLES = [
  { id: "t1", year: "2021", oldTitle: "Kosovo's Kurti Wins Landslide Election on Anti-Corruption Mandate", oldSource: "BBC News", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Albin Kurti's Vetevendosje movement wins an outright majority â€” the first in Kosovo's history â€” promising to fight corruption and push for EU membership.", todayNote: "Qeveria Kurti ka zbatuar reformat anti-korrupsion dhe ka fuqizuar bashkÃ«punimin me BE-nÃ«. Procesi i integrimeve Ã«shtÃ« nÃ« fazÃ«n mÃ« aktive tÃ« dekadÃ«s." },
  { id: "t2", year: "2021", oldTitle: "Kosovo Applies for Council of Europe Membership", oldSource: "Reuters", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Kosovo formally applies to join the Council of Europe, a major step toward European integration requiring support from two-thirds of member states.", todayNote: "Kosova u anÃ«tarÃ«sua me sukses nÃ« KÃ«shillin e EvropÃ«s nÃ« maj 2024 â€” arritja diplomatike mÃ« e madhe qÃ« nga pavarÃ«sia." },
  { id: "t3", year: "2021", oldTitle: "EU Parliament Approves Kosovo Visa Liberalization", oldSource: "Deutsche Welle", oldSourceFlag: "ðŸ‡©ðŸ‡ª", oldExcerpt: "The European Parliament votes to grant Kosovo citizens visa-free travel to Schengen countries, ending decades of isolation for ordinary citizens.", todayNote: "Liberalizimi i vizave hyri nÃ« fuqi dhe u bÃ« ndryshimi mÃ« i ndjeshÃ«m pÃ«r qytetarÃ«t kosovarÃ« â€” mbi 2 milion udhÃ«time u realizuan brenda 18 muajve tÃ« parÃ«." },
  { id: "t4", year: "2020", oldTitle: "Kosovo â€” A State Still Fighting For Recognition", oldSource: "New York Times", oldSourceFlag: "ðŸ‡ºðŸ‡¸", oldExcerpt: "Five years after declaring independence, Kosovo remains unrecognized by five EU members and faces diplomatic isolation at international institutions.", todayNote: "Sot, Kosova ka 117 njohje. AnÃ«tarÃ«simi nÃ« KÃ«shillin e EvropÃ«s u kompletua me sukses nÃ« 2024." },
  { id: "t5", year: "2021", oldTitle: "Kosovo's Economy Grows Despite Regional Headwinds", oldSource: "Bloomberg", oldSourceFlag: "ðŸ‡ºðŸ‡¸", oldExcerpt: "Kosovo posts 6.4% GDP growth, outpacing most Western Balkan neighbors, driven by diaspora remittances and a construction boom.", todayNote: "Ekonomia kosovare vazhdon tÃ« rritet me mesatare 4-5% nÃ« vit. FMN-ja e rendit si ndÃ«r ekonomitÃ« mÃ« dinamike tÃ« rajonit." },
  { id: "t6", year: "2021", oldTitle: "Kosovo Reaches 100 State Recognitions", oldSource: "AP", oldSourceFlag: "ðŸ‡ºðŸ‡¸", oldExcerpt: "Kosovo crosses the landmark of 100 state recognitions as Israel and several Pacific nations formally acknowledge its independence.", todayNote: "Kosova ka 117 njohje sot, me procese aktive diplomatike nÃ« AfrikÃ« dhe Azi." },
  { id: "t7", year: "2021", oldTitle: "Pristina's Tech Scene Draws Silicon Valley Eyes", oldSource: "Forbes", oldSourceFlag: "ðŸ‡ºðŸ‡¸", oldExcerpt: "With a young population and low costs, Kosovo's capital is becoming a surprising hub for software outsourcing and startup activity.", todayNote: "Prishtina u rendit ndÃ«r 5 qytetet me rritjen mÃ« tÃ« shpejtÃ« tÃ« startupeve nÃ« Ballkan sipas raportit StartupBlink 2025." },
  { id: "t8", year: "2021", oldTitle: "Kosovo's Film 'Hive' Earns Oscar Nomination", oldSource: "The Guardian", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Fahrije Hoti's story, told in Kosovo's first ever Oscar-nominated film, brings global attention to Kosovo's post-war women's strength.", todayNote: "Filmi 'Hive/Zgjoi' mbahet si arritja artistike qÃ« hapi dyert e KosovÃ«s pÃ«r industrinÃ« ndÃ«rkombÃ«tare tÃ« filmit." },
  { id: "t9", year: "2021", oldTitle: "KFOR Marks 22 Years of Peacekeeping in Kosovo", oldSource: "NATO", oldSourceFlag: "ðŸ‡§ðŸ‡ª", oldExcerpt: "NATO's KFOR mission celebrates 22 years in Kosovo, reaffirming its commitment to maintaining peace and security in the Western Balkans.", todayNote: "KFOR vazhdon tÃ« jetÃ« prezent me mbi 4,500 trupa. Misioni konsiderohet ndÃ«r operacionet e suksesshme tÃ« NATO-s." },
  { id: "t10", year: "2021", oldTitle: "Kosovo Diaspora Sends Record â‚¬1.1 Billion in Remittances", oldSource: "Financial Times", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Remittances from the Kosovo diaspora hit an all-time high despite the pandemic, making up nearly 17% of the country's GDP.", todayNote: "Remitancat tejkaluan 1.2 miliard euro nÃ« 2024, me diasporÃ«n e GjermanisÃ« dhe ZvicrÃ«s si kontribuuesit kryesorÃ«." },
  { id: "t11", year: "2021", oldTitle: "Kosovo's Young Footballers Eye UEFA Nations League Promotion", oldSource: "The Guardian", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "With an average age of 24, Kosovo's national football team is one of Europe's youngest squads and climbing UEFA's rankings.", todayNote: "KombÃ«tarja kosovare u kualifikua pÃ«r LigÃ«n B tÃ« Kombeve UEFA â€” arritja historike e futbollit kosovar." },
  { id: "t12", year: "2021", oldTitle: "Solar Energy Project to Power 20,000 Kosovo Homes Breaks Ground", oldSource: "Deutsche Welle", oldSourceFlag: "ðŸ‡©ðŸ‡ª", oldExcerpt: "A new 100MW solar plant backed by the EBRD breaks ground near Pristina, Kosovo's first utility-scale renewable energy project.", todayNote: "Kosova ka nÃ«nshkruar projekte diellore dhe eolike me kapacitet mbi 300 MW â€” synon 35% energji e rinovueshme deri nÃ« 2030." },
  { id: "t13", year: "2021", oldTitle: "Kosovo Wins First Olympic Gold Medals in Judo at Tokyo", oldSource: "BBC Sport", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Judoka Nora Gjakova and Distria Krasniqi win gold medals at the Tokyo Olympics, Kosovo's most successful Games to date.", todayNote: "Xhudo kosovare vazhdon tÃ« shquhet ndÃ«rkombÃ«tarisht â€” Kosova renditet ndÃ«r vendet me medaljet olimpike per capita." },
  { id: "t14", year: "2020", oldTitle: "Serbia's Campaign Blocks Kosovo's UNESCO Bid", oldSource: "Reuters", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Kosovo's application for UNESCO membership fails to reach a vote after Serbia and Russia campaign heavily against it.", todayNote: "Si anÃ«tar i KÃ«shillit tÃ« EvropÃ«s, Kosova ka peshÃ« mÃ« tÃ« madhe ndÃ«rkombÃ«tare. Lufta diplomatike vazhdon." },
  { id: "t15", year: "2021", oldTitle: "Kosovo Opens New Highway Linking Pristina to North Macedonia", oldSource: "AP", oldSourceFlag: "ðŸ‡ºðŸ‡¸", oldExcerpt: "The Ibrahim Rugova Highway section is completed, cutting travel time between Kosovo and North Macedonia by 40%.", todayNote: "Rrjeti rrugor kosovar vazhdon zgjerimin â€” autostrada lidh KosovÃ«n me ShqipÃ«rinÃ«, MaqedoninÃ« dhe SerbinÃ«." },
  { id: "t16", year: "2021", oldTitle: "Kosovo Introduces Digital Tax System to Fight Shadow Economy", oldSource: "Balkan Insight", oldSourceFlag: "ðŸ‡·ðŸ‡¸", oldExcerpt: "The government launches mandatory digital fiscal receipts for all businesses, aiming to bring Kosovo's shadow economy into the tax base.", todayNote: "Sistemi fiskal dixhital ka rritur tÃ« ardhurat tatimore me 23% â€” modeli kosovar studiohet nga vendet rajonale." },
  { id: "t17", year: "2020", oldTitle: "Kosovo Women Make Up 40% of Parliament â€” A Regional First", oldSource: "Time", oldSourceFlag: "ðŸ‡ºðŸ‡¸", oldExcerpt: "Following the February elections, Kosovo's parliament achieves 40% female representation, the highest in the Western Balkans.", todayNote: "PÃ«rfaqÃ«simi i grave mbetet ndÃ«r mÃ« tÃ« lartÃ«t nÃ« rajon, me rritje tÃ« vazhdueshme nÃ« role ekzekutive." },
  { id: "t18", year: "2021", oldTitle: "Kosovo's Startup Scene Attracts â‚¬30M in Venture Capital", oldSource: "TechCrunch", oldSourceFlag: "ðŸ‡ºðŸ‡¸", oldExcerpt: "A record year for Kosovo tech investment as European VCs back local startups in fintech, edtech, and SaaS sectors.", todayNote: "Ekosistemi i startupeve kosovare ka arritur financime mbi 80 milionÃ« euro â€” Prishtina ndÃ«r 10 qytetet me rritje teknologjike." },
  { id: "t19", year: "2020", oldTitle: "Brussels Dialogue on Kosovo-Serbia Normalization Stalls Again", oldSource: "Politico Europe", oldSourceFlag: "ðŸ‡§ðŸ‡ª", oldExcerpt: "EU-mediated talks between Pristina and Belgrade fail to produce results for the third consecutive year.", todayNote: "MarrÃ«veshja e Ohrit 2023 ka hapur rrugÃ« tÃ« reja, megjithÃ«se zbatimi mbetet sfidÃ« aktive." },
  { id: "t20", year: "2021", oldTitle: "Kosovo's Education Reform Raises University Enrollment by 15%", oldSource: "Le Monde", oldSourceFlag: "ðŸ‡«ðŸ‡·", oldExcerpt: "A new student loan program and quality improvements at Pristina's main university drive a significant jump in higher education participation.", todayNote: "BashkÃ«punimet me universitetet evropiane janÃ« trefishuar nÃ« 3 vitet e fundit." },
  { id: "t21", year: "2021", oldTitle: "Kosovo's COVID Vaccination Campaign Reaches 30% of Adults", oldSource: "Reuters", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Kosovo ramps up vaccination with donated doses from the EU and US, reaching 30% adult coverage faster than regional neighbors.", todayNote: "Spitale tÃ« reja rajonale po ndÃ«rtohen me financim tÃ« BE-sÃ« â€” kapacitetet shÃ«ndetÃ«sore janÃ« shtuar pas pandemisÃ«." },
  { id: "t22", year: "2020", oldTitle: "Kosovo Hosts First International Fashion Week", oldSource: "Vogue", oldSourceFlag: "ðŸ‡ºðŸ‡¸", oldExcerpt: "Pristina's first Fashion Week draws 40 international designers and signals the country's emerging creative industry.", todayNote: "Prishtina Fashion Week ka zhvilluar 4 edicione â€” talente kosovare eksportohen nÃ« Milano, Paris dhe LondÃ«r." },
  { id: "t23", year: "2021", oldTitle: "Kosovo's Banking Sector Shows Strongest Growth in Balkans", oldSource: "Financial Times", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Kosovo's banks post 12% credit growth, driven by SME lending and a housing boom, with non-performing loans at record lows.", todayNote: "Kosova ka treguesin mÃ« tÃ« ulÃ«t tÃ« kredive jo-performuese nÃ« rajon (3.2%) â€” sektori bankar mbetet i shÃ«ndoshÃ«." },
  { id: "t24", year: "2021", oldTitle: "Pristina Tram Project Green-lit by European Investment Bank", oldSource: "Der Spiegel", oldSourceFlag: "ðŸ‡©ðŸ‡ª", oldExcerpt: "The EIB approves â‚¬95 million for a light rail system in Kosovo's capital, the country's largest urban mobility project.", todayNote: "Projekti i tramit tÃ« PrishtinÃ«s Ã«shtÃ« nÃ« fazÃ«n e tenderimit â€” ndÃ«rtimi pritet tÃ« fillojÃ« brenda tre viteve." },
  { id: "t25", year: "2020", oldTitle: "Kosovo's Wine Industry Wins European Gold Medals", oldSource: "Decanter", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Stone Castle and Ã‡ohu wineries earn international recognition as Kosovo's wine exports reach â‚¬4 million for the first time.", todayNote: "Vera kosovare eksportohet sot nÃ« 25 vende â€” Stone Castle Ã«shtÃ« renditur ndÃ«r 100 vreshtat mÃ« tÃ« mira tÃ« EvropÃ«s." },
  { id: "t26", year: "2021", oldTitle: "Kosovo Joins CERN as Associate Member State", oldSource: "Nature", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "Kosovo becomes an associate member of CERN, giving its physicists access to Europe's leading particle research center.", todayNote: "Hulumtues kosovarÃ« punojnÃ« aktivisht nÃ« projektet e CERN-it â€” bashkÃ«punimi shkencor Ã«shtÃ« zgjeruar edhe me ESA-n." },
  { id: "t27", year: "2020", oldTitle: "Kosovo Border Sees First Commercial Truck Since the 1990s", oldSource: "AP", oldSourceFlag: "ðŸ‡ºðŸ‡¸", oldExcerpt: "A commercial truck crosses the Kosovo-Serbia border following a Washington trade agreement, the first such crossing since the 1990s.", todayNote: "TregÃ«tia me SerbinÃ« mbetet e kufizuar â€” dialogu i Brukselit synon normalizimin ekonomik si hap paraprak." },
  { id: "t28", year: "2021", oldTitle: "Kosovo's Nurses Lead WHO-backed Mental Health Reform", oldSource: "The Lancet", oldSourceFlag: "ðŸ‡¬ðŸ‡§", oldExcerpt: "A WHO-backed program trains 400 community mental health nurses across Kosovo, shifting care from asylum to community-based services.", todayNote: "Kosova u vlerÃ«sua nga OBSH pÃ«r progresin e bÃ«rÃ« â€” qendrat komunitare tÃ« shÃ«ndetit mendor janÃ« zgjeruar." },
  { id: "t29", year: "2021", oldTitle: "Kosovo Celebrates 13th Anniversary of Independence", oldSource: "AFP", oldSourceFlag: "ðŸ‡«ðŸ‡·", oldExcerpt: "Crowds gather in Pristina's main square as Kosovo marks 13 years of independence, with youth holding signs reading 'We are Europe'.", todayNote: "17 vjet pavarÃ«si â€” sot Kosova ecÃ«n si anÃ«tare e KÃ«shillit tÃ« EvropÃ«s me rrugÃ«n drejt BE-sÃ« tÃ« hapur." },
  { id: "t30", year: "2021", oldTitle: "Kosovo's Beekeepers Export Organic Honey to Germany for First Time", oldSource: "Deutsche Welle", oldSourceFlag: "ðŸ‡©ðŸ‡ª", oldExcerpt: "Kosovo beekeeping cooperatives achieve EU food safety certification, allowing organic mountain honey to reach German supermarket shelves.", todayNote: "Produktet bujqÃ«sore kosovare eksportohen tashmÃ« nÃ« 30 vende â€” mjalti, vera dhe djathi kosovar fitojnÃ« terren nÃ« tregjet evropiane." },
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
  { country: "Gjermani", flag: "ðŸ‡©ðŸ‡ª", positive: 58, neutral: 30, negative: 12 },
  { country: "SHBA",     flag: "ðŸ‡ºðŸ‡¸", positive: 72, neutral: 22, negative: 6  },
  { country: "Britani",  flag: "ðŸ‡¬ðŸ‡§", positive: 61, neutral: 28, negative: 11 },
  { country: "FrancÃ«",   flag: "ðŸ‡«ðŸ‡·", positive: 55, neutral: 35, negative: 10 },
  { country: "Itali",    flag: "ðŸ‡®ðŸ‡¹", positive: 70, neutral: 24, negative: 6  },
];

const TONE_STATS_BY_DAY = [
  [ // day % 7 === 0
    { country: "Gjermani", flag: "ðŸ‡©ðŸ‡ª", positive: 58, neutral: 30, negative: 12 },
    { country: "SHBA",     flag: "ðŸ‡ºðŸ‡¸", positive: 72, neutral: 22, negative: 6  },
    { country: "Britani",  flag: "ðŸ‡¬ðŸ‡§", positive: 61, neutral: 28, negative: 11 },
    { country: "FrancÃ«",   flag: "ðŸ‡«ðŸ‡·", positive: 55, neutral: 35, negative: 10 },
    { country: "Itali",    flag: "ðŸ‡®ðŸ‡¹", positive: 70, neutral: 24, negative: 6  },
  ],
  [ // day % 7 === 1
    { country: "Gjermani", flag: "ðŸ‡©ðŸ‡ª", positive: 61, neutral: 27, negative: 12 },
    { country: "SHBA",     flag: "ðŸ‡ºðŸ‡¸", positive: 74, neutral: 20, negative: 6  },
    { country: "Britani",  flag: "ðŸ‡¬ðŸ‡§", positive: 59, neutral: 30, negative: 11 },
    { country: "FrancÃ«",   flag: "ðŸ‡«ðŸ‡·", positive: 53, neutral: 36, negative: 11 },
    { country: "Itali",    flag: "ðŸ‡®ðŸ‡¹", positive: 68, neutral: 25, negative: 7  },
  ],
  [ // day % 7 === 2
    { country: "Gjermani", flag: "ðŸ‡©ðŸ‡ª", positive: 55, neutral: 33, negative: 12 },
    { country: "SHBA",     flag: "ðŸ‡ºðŸ‡¸", positive: 69, neutral: 24, negative: 7  },
    { country: "Britani",  flag: "ðŸ‡¬ðŸ‡§", positive: 63, neutral: 26, negative: 11 },
    { country: "FrancÃ«",   flag: "ðŸ‡«ðŸ‡·", positive: 57, neutral: 33, negative: 10 },
    { country: "Itali",    flag: "ðŸ‡®ðŸ‡¹", positive: 72, neutral: 22, negative: 6  },
  ],
  [ // day % 7 === 3
    { country: "Gjermani", flag: "ðŸ‡©ðŸ‡ª", positive: 60, neutral: 29, negative: 11 },
    { country: "SHBA",     flag: "ðŸ‡ºðŸ‡¸", positive: 75, neutral: 19, negative: 6  },
    { country: "Britani",  flag: "ðŸ‡¬ðŸ‡§", positive: 58, neutral: 31, negative: 11 },
    { country: "FrancÃ«",   flag: "ðŸ‡«ðŸ‡·", positive: 52, neutral: 37, negative: 11 },
    { country: "Itali",    flag: "ðŸ‡®ðŸ‡¹", positive: 67, neutral: 26, negative: 7  },
  ],
  [ // day % 7 === 4
    { country: "Gjermani", flag: "ðŸ‡©ðŸ‡ª", positive: 63, neutral: 26, negative: 11 },
    { country: "SHBA",     flag: "ðŸ‡ºðŸ‡¸", positive: 71, neutral: 23, negative: 6  },
    { country: "Britani",  flag: "ðŸ‡¬ðŸ‡§", positive: 65, neutral: 24, negative: 11 },
    { country: "FrancÃ«",   flag: "ðŸ‡«ðŸ‡·", positive: 58, neutral: 32, negative: 10 },
    { country: "Itali",    flag: "ðŸ‡®ðŸ‡¹", positive: 73, neutral: 21, negative: 6  },
  ],
  [ // day % 7 === 5
    { country: "Gjermani", flag: "ðŸ‡©ðŸ‡ª", positive: 56, neutral: 31, negative: 13 },
    { country: "SHBA",     flag: "ðŸ‡ºðŸ‡¸", positive: 70, neutral: 23, negative: 7  },
    { country: "Britani",  flag: "ðŸ‡¬ðŸ‡§", positive: 60, neutral: 29, negative: 11 },
    { country: "FrancÃ«",   flag: "ðŸ‡«ðŸ‡·", positive: 54, neutral: 36, negative: 10 },
    { country: "Itali",    flag: "ðŸ‡®ðŸ‡¹", positive: 69, neutral: 24, negative: 7  },
  ],
  [ // day % 7 === 6
    { country: "Gjermani", flag: "ðŸ‡©ðŸ‡ª", positive: 59, neutral: 28, negative: 13 },
    { country: "SHBA",     flag: "ðŸ‡ºðŸ‡¸", positive: 73, neutral: 21, negative: 6  },
    { country: "Britani",  flag: "ðŸ‡¬ðŸ‡§", positive: 62, neutral: 27, negative: 11 },
    { country: "FrancÃ«",   flag: "ðŸ‡«ðŸ‡·", positive: 56, neutral: 34, negative: 10 },
    { country: "Itali",    flag: "ðŸ‡®ðŸ‡¹", positive: 71, neutral: 23, negative: 6  },
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
      flag: "ðŸ‡©ðŸ‡ª",
      excerpt: "Kosova ka bÃ«rÃ« hapa tÃ« rÃ«ndÃ«sishÃ«m drejt integrimit evropian, sipas analistÃ«ve gjermanÃ«.",
      href: "https://www.dw.com/search/?languageCode=en&item=kosovo",
    },
    {
      id: "d-de-2",
      title: "Kosovo-Diaspora in Deutschland: Eine Generation zwischen zwei Welten",
      source: "Der Spiegel",
      flag: "ðŸ‡©ðŸ‡ª",
      excerpt: "Rreth 300,000 kosovarÃ« jetojnÃ« nÃ« Gjermani â€” brezi i ri po ndÃ«rton identitetin e vet midis dy kulturave.",
      href: "https://www.spiegel.de/thema/kosovo/",
    },
    {
      id: "d-de-3",
      title: "Windenergie-Projekt in Kosovo: Deutsches Konsortium gewinnt Ausschreibung",
      source: "SÃ¼ddeutsche Zeitung",
      flag: "ðŸ‡©ðŸ‡ª",
      excerpt: "Kompani gjermane fitojnÃ« tenderin historik pÃ«r ndÃ«rtimin e parkut tÃ« parÃ« tÃ« erÃ«s nÃ« KosovÃ«.",
      href: "https://www.sueddeutsche.de/thema/Kosovo",
    },
  ],
  zvicra: [
    {
      id: "d-ch-1",
      title: "Kosovo auf dem Weg nach Europa: Hoffnung und Hindernisse",
      source: "NZZ",
      flag: "ðŸ‡¨ðŸ‡­",
      excerpt: "Zvicra, si partnere e rÃ«ndÃ«sishme, ndjek me vÃ«mendje procesin e integrimit tÃ« KosovÃ«s nÃ« BE.",
      href: "https://www.nzz.ch/international/",
    },
    {
      id: "d-ch-2",
      title: "Kosovo: 200'000 Kosovaren leben in der Schweiz â€” ihr Geld formt die Heimat",
      source: "20 Minuten",
      flag: "ðŸ‡¨ðŸ‡­",
      excerpt: "Diaspora kosovare nÃ« ZvicÃ«r dÃ«rgon mbi 400 milionÃ« euro Ã§do vit â€” remitancat mbajnÃ« familjet.",
      href: "https://www.20min.ch/ausland/",
    },
    {
      id: "d-ch-3",
      title: "Pristina: Die aufstrebende Technikmetropole des Balkans",
      source: "Tages-Anzeiger",
      flag: "ðŸ‡¨ðŸ‡­",
      excerpt: "Prishtina po bÃ«het qendÃ«r e teknologjisÃ« nÃ« Ballkan â€” startupet tÃ«rheqin vÃ«mendjen e investitorÃ«ve zviceranÃ«.",
      href: "https://www.tagesanzeiger.ch/ausland/",
    },
  ],
  italia: [
    {
      id: "d-it-1",
      title: "Kosovo, la piccola nazione che punta all'Europa",
      source: "La Repubblica",
      flag: "ðŸ‡®ðŸ‡¹",
      excerpt: "Italia Ã«shtÃ« ndÃ«r vendet qÃ« mbÃ«shtesin fuqishÃ«m rrugÃ«n e KosovÃ«s drejt Bashkimit Evropian.",
      href: "https://www.repubblica.it/esteri/",
    },
    {
      id: "d-it-2",
      title: "Pristina, la nuova Silicon Valley dei Balcani",
      source: "Corriere della Sera",
      flag: "ðŸ‡®ðŸ‡¹",
      excerpt: "Ekosistemi i startupeve nÃ« PrishtinÃ« po tÃ«rheq vÃ«mendjen e mediave italiane si model suksesi.",
      href: "https://www.corriere.it/esteri/",
    },
    {
      id: "d-it-3",
      title: "Kosovo: il cinema di Donika Hasani conquista Berlino",
      source: "La Stampa",
      flag: "ðŸ‡®ðŸ‡¹",
      excerpt: "Kinematografia kosovare merr vÃ«mendjen ndÃ«rkombÃ«tare â€” filmi 'Lumi i BardhÃ«' fiton Arinjin e ArtÃ«.",
      href: "https://www.lastampa.it/esteri/",
    },
  ],
  shba: [
    {
      id: "d-us-1",
      title: "Kosovo's Path to NATO: Why Washington Remains Its Most Reliable Ally",
      source: "AP",
      flag: "ðŸ‡ºðŸ‡¸",
      excerpt: "SHBA mbetet garantuesi kryesor i sigurisÃ« kosovare â€” roli amerikan nÃ« Ballkan po shtohet me investime dhe praninÃ« diplomatike.",
      href: "https://apnews.com/hub/kosovo",
    },
    {
      id: "d-us-2",
      title: "A Young Democracy's Fight: Kosovo's Anti-Corruption Push Under Kurti",
      source: "New York Times",
      flag: "ðŸ‡ºðŸ‡¸",
      excerpt: "Kurti's government earns praise from US observers for transparency reforms, even as critics warn of risks to regional stability.",
      href: "https://www.nytimes.com/topic/destination/kosovo",
    },
    {
      id: "d-us-3",
      title: "Kosovo's Tech Boom: The Balkans' Unlikely Startup Success Story",
      source: "Bloomberg",
      flag: "ðŸ‡ºðŸ‡¸",
      excerpt: "InvestitorÃ«t amerikanÃ« po shikojnÃ« nga Prishtina â€” ekosistemi i startupeve Ã«shtÃ« rritur 60% brenda dy viteve.",
      href: "https://www.bloomberg.com/europe",
    },
  ],
  britania: [
    {
      id: "d-gb-1",
      title: "Kosovo at a Crossroads: Europe's Youngest State Eyes EU Membership",
      source: "The Guardian",
      flag: "ðŸ‡¬ðŸ‡§",
      excerpt: "Britania vazhdon tÃ« mbÃ«shtesÃ« pavarÃ«sinÃ« e KosovÃ«s â€” Guardian ndjek nga afÃ«r rrugÃ«n e KosovÃ«s drejt integrimit europian.",
      href: "https://www.theguardian.com/world/kosovo",
    },
    {
      id: "d-gb-2",
      title: "Kosovo's Olympic Judokas Prove a Nation's Strength Goes Beyond Borders",
      source: "BBC Sport",
      flag: "ðŸ‡¬ðŸ‡§",
      excerpt: "Nora Gjakova dhe Distria Krasniqi bÃ«jnÃ« historinÃ« â€” medaljet e arit olimpike vÃ«nÃ« KosovÃ«n nÃ« hartÃ«n sportive ndÃ«rkombÃ«tare.",
      href: "https://www.bbc.com/news/topics/cnx753jejyjt",
    },
    {
      id: "d-gb-3",
      title: "Kosovo's Council of Europe Bid: A Diplomatic Win Years in the Making",
      source: "Reuters",
      flag: "ðŸ‡¬ðŸ‡§",
      excerpt: "AnÃ«tarÃ«simi nÃ« KÃ«shillin e EvropÃ«s shÃ«non arritjen diplomatike mÃ« tÃ« madhe tÃ« KosovÃ«s qÃ« nga shpallja e pavarÃ«sisÃ«.",
      href: "https://www.reuters.com/world/europe/",
    },
  ],
  austria: [
    {
      id: "d-at-1",
      title: "Kosovo auf dem Weg nach BrÃ¼ssel: Wien setzt auf Dialog",
      source: "Der Standard",
      flag: "ðŸ‡¦ðŸ‡¹",
      excerpt: "Austria mbÃ«shtet integrimin e KosovÃ«s â€” Vienna ka rolin e ndÃ«rmjetÃ«sit aktiv nÃ« dialogun KosovÃ«-Serbi.",
      href: "https://www.derstandard.at/international",
    },
    {
      id: "d-at-2",
      title: "Kosovos Wirtschaft wÃ¤chst â€” Ã¶sterreichische Firmen profitieren",
      source: "Die Presse",
      flag: "ðŸ‡¦ðŸ‡¹",
      excerpt: "KompanitÃ« austriake janÃ« ndÃ«r investitorÃ«t kryesorÃ« nÃ« sektorin energjetik dhe ndÃ«rtimin e infrastrukturÃ«s kosovare.",
      href: "https://www.diepresse.com/aussenpolitik",
    },
    {
      id: "d-at-3",
      title: "Pristina als Kulturhauptstadt: Kosovo entdeckt seine kreative Energie",
      source: "ORF",
      flag: "ðŸ‡¦ðŸ‡¹",
      excerpt: "Prishtina po zhvillohet si qendÃ«r kulturore rajonale â€” kinema, muzikÃ« dhe art bashkÃ«kohor tÃ«rheqin vÃ«mendjen europiane.",
      href: "https://orf.at/stories/",
    },
  ],
  suedia: [
    {
      id: "d-se-1",
      title: "Kosovo och EU: En lÃ¥ng resa mot europeisk integration",
      source: "SVT",
      flag: "ðŸ‡¸ðŸ‡ª",
      excerpt: "Suedia ka qenÃ« ndÃ«r mbÃ«shtetÃ«set kryesore tÃ« KosovÃ«s â€” anÃ«tarÃ«simi nÃ« KÃ«shillin e EvropÃ«s shihet si hap historik.",
      href: "https://www.svt.se/nyheter/utrikes/",
    },
    {
      id: "d-se-2",
      title: "Kosovos ungdomar bygger framtidens Balkan med teknik och innovation",
      source: "Aftonbladet",
      flag: "ðŸ‡¸ðŸ‡ª",
      excerpt: "Brezi i ri kosovar po ndÃ«rton tÃ« ardhmen me teknologji â€” diaspora kosovare nÃ« Suedi Ã«shtÃ« njÃ« urÃ« e rÃ«ndÃ«sishme inovacioni.",
      href: "https://www.aftonbladet.se/nyheter/",
    },
    {
      id: "d-se-3",
      title: "Kosovo: Landet som vill bli en del av Europa",
      source: "Dagens Nyheter",
      flag: "ðŸ‡¸ðŸ‡ª",
      excerpt: "DN analizon rrugÃ«n e KosovÃ«s â€” nga pavarÃ«sia drejt integrimit europian, sfida dhe mundÃ«sitÃ« e vendit.",
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
