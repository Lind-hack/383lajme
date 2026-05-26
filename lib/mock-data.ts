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
    body: `Komisioni Evropian publikoi sot raportin vjetor të progresit për Kosovën, duke vlerësuar hapat e bërë drejt integrimit evropian. Raporti thekson reformat gjyqësore si arritje kryesore, por paralajmëron se lufta kundër korrupsionit dhe krimit të organizuar ka nevojë për intensifikim.\n\nPërgjigjja e qeverisë kosovare ka qenë pozitive, duke premtuar intensifikimin e reformave gjatë vitit 2025.`,
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
    body: `Fondi Monetar Ndërkombëtar ka publikuar parashikimet e tij të fundit ekonomike për vendet e Ballkanit Perëndimor, ku Kosova shquhet me projeksionin e rritjes prej 4.2% për vitin 2025. Kjo është mbi mesataren rajonale dhe pasqyron qëndrueshmërinë e ekonomisë kosovare.`,
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
    body: `Forcat e KFOR-it, të udhëhequra nga NATO, kanë nisur stërvitjet më të mëdha të vitit të fundit në veri të Kosovës. Ky zhvillim vjen në kontekstin e tensioneve të vazhdueshme dhe synon të forcojë sigurinë në rajon.`,
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
    body: `Banka Qendrore e Kosovës ka raportuar se remitancat nga diaspora shqiptare kanë tejkaluar shifrën e 1 miliard eurove gjatë vitit 2024, duke shënuar rekord historik. Shumica e fondeve vijnë nga diaspora në Gjermani, Zvicër dhe Shtetet e Bashkuara.`,
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
    body: `Futbollistët e Kosovës kanë shkruar histori duke u kualifikuar për herë të parë në fazën e grupeve të Ligës B të Kombeve UEFA. Trajneri kombëtar ka shprehur krenari për arritjen, duke e konsideruar hap të madh drejt futbollit profesional.`,
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
    body: `Një studim i kryer nga organizata StartupBlink rendit Prishtinën si njërin nga qytetet me zhvillimin më të shpejtë teknologjik në Ballkan. Faktori kyç është popullata e re dhe numri i madh i të diplomuarve në fushën e TIK-ut.`,
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
    body: `Bisedimet midis delegacionit të Kosovës dhe Serbisë janë rinisur në Bruksel nën ndërmjetësimin e Bashkimit Evropian. Ky takim shënon tentativën e re për të zbatuar marrëveshjen e Ohrit, e cila deri tani ka hasur shumë pengesa.`,
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
    body: `Ministria e Ekonomisë ka njoftuar nënshkrimin e kontratës me një konsorcium të kompanive gjermane dhe austriake për ndërtimin e parkut të erës në fushën e Dukagjinit. Ky projekt pritet të furnizojë rreth 150,000 shtëpi me energji të rinovueshme deri në vitin 2027.`,
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
    body: `Ky sukses historik shënon arritjen më të lartë të kinemasë kosovare në festivalet ndërkombëtare. Filmi 'Lumi i Bardhë' tregon historinë e familjes kosovare gjatë periudhës së pasluftës dhe është xhiruar tërësisht në Kosovë me aktorë vendorë.`,
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
    body: `UNICEF ka publikuar raportin e tij vjetor për arsimin në Kosovë, duke vlerësuar pozitivisht reformat e fundit. Shkalla e regjistrimit në shkollat fillore ka arritur 97%, ndërsa cilësia e mësimdhënies vazhdon të jetë sfida kryesore.`,
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
