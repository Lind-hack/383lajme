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
  sourceBias: 'neutral' | 'pro-kosovo' | 'critical';
  tone: 'positive' | 'neutral' | 'negative';
  category: string;
  publishedAt: string;
  readingTime: number;
  featured: boolean;
  imageUrl?: string;
  engagementScore?: number;
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

export const TONE_STATS = [
  { country: "Gjermani", flag: "🇩🇪", positive: 58, neutral: 30, negative: 12 },
  { country: "SHBA",     flag: "🇺🇸", positive: 72, neutral: 22, negative: 6  },
  { country: "Britani",  flag: "🇬🇧", positive: 61, neutral: 28, negative: 11 },
  { country: "Francë",   flag: "🇫🇷", positive: 55, neutral: 35, negative: 10 },
  { country: "Itali",    flag: "🇮🇹", positive: 70, neutral: 24, negative: 6  },
];

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
      href: "#",
    },
    {
      id: "d-de-2",
      title: "Kosovo-Diaspora in Deutschland: Eine Generation zwischen zwei Welten",
      source: "Der Spiegel",
      flag: "🇩🇪",
      excerpt: "Rreth 300,000 kosovarë jetojnë në Gjermani — brezi i ri po ndërton identitetin e vet midis dy kulturave.",
      href: "#",
    },
    {
      id: "d-de-3",
      title: "Windenergie-Projekt in Kosovo: Deutsches Konsortium gewinnt Ausschreibung",
      source: "Süddeutsche Zeitung",
      flag: "🇩🇪",
      excerpt: "Kompani gjermane fitojnë tenderin historik për ndërtimin e parkut të parë të erës në Kosovë.",
      href: "#",
    },
  ],
  zvicra: [
    {
      id: "d-ch-1",
      title: "Kosovo auf dem Weg nach Europa: Hoffnung und Hindernisse",
      source: "NZZ",
      flag: "🇨🇭",
      excerpt: "Zvicra, si partnere e rëndësishme, ndjek me vëmendje procesin e integrimit të Kosovës në BE.",
      href: "#",
    },
    {
      id: "d-ch-2",
      title: "Kosovo: 200'000 Kosovaren leben in der Schweiz — ihr Geld formt die Heimat",
      source: "20 Minuten",
      flag: "🇨🇭",
      excerpt: "Diaspora kosovare në Zvicër dërgon mbi 400 milionë euro çdo vit — remitancat mbajnë familjet.",
      href: "#",
    },
    {
      id: "d-ch-3",
      title: "Pristina: Die aufstrebende Technikmetropole des Balkans",
      source: "Tages-Anzeiger",
      flag: "🇨🇭",
      excerpt: "Prishtina po bëhet qendër e teknologjisë në Ballkan — startupet tërheqin vëmendjen e investitorëve zviceranë.",
      href: "#",
    },
  ],
  italia: [
    {
      id: "d-it-1",
      title: "Kosovo, la piccola nazione che punta all'Europa",
      source: "La Repubblica",
      flag: "🇮🇹",
      excerpt: "Italia është ndër vendet që mbështesin fuqishëm rrugën e Kosovës drejt Bashkimit Evropian.",
      href: "#",
    },
    {
      id: "d-it-2",
      title: "Pristina, la nuova Silicon Valley dei Balcani",
      source: "Corriere della Sera",
      flag: "🇮🇹",
      excerpt: "Ekosistemi i startupeve në Prishtinë po tërheq vëmendjen e mediave italiane si model suksesi.",
      href: "#",
    },
    {
      id: "d-it-3",
      title: "Kosovo: il cinema di Donika Hasani conquista Berlino",
      source: "La Stampa",
      flag: "🇮🇹",
      excerpt: "Kinematografia kosovare merr vëmendjen ndërkombëtare — filmi 'Lumi i Bardhë' fiton Arinjin e Artë.",
      href: "#",
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
