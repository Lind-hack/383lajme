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
    body: `Komisioni Evropian publikoi sot raportin vjetor tÃ« progresit pÃ«r KosovÃ«n, duke vlerÃ«suar hapat e bÃ«rÃ« drejt integrimit evropian. Raporti thekson reformat gjyqÃ«sore si arritje kryesore, por paralajmÃ«ron se lufta kundÃ«r korrupsionit dhe krimit tÃ« organizuar ka nevojÃ« pÃ«r intensifikim.\n\nPÃ«rgjigjja e qeverisÃ« kosovare ka qenÃ« pozitive, duke premtuar intensifikimin e reformave gjatÃ« vitit 2025.`,
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
    body: `Fondi Monetar NdÃ«rkombÃ«tar ka publikuar parashikimet e tij tÃ« fundit ekonomike pÃ«r vendet e Ballkanit PerÃ«ndimor, ku Kosova shquhet me projeksionin e rritjes prej 4.2% pÃ«r vitin 2025. Kjo Ã«shtÃ« mbi mesataren rajonale dhe pasqyron qÃ«ndrueshmÃ«rinÃ« e ekonomisÃ« kosovare.`,
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
    body: `Forcat e KFOR-it, tÃ« udhÃ«hequra nga NATO, kanÃ« nisur stÃ«rvitjet mÃ« tÃ« mÃ«dha tÃ« vitit tÃ« fundit nÃ« veri tÃ« KosovÃ«s. Ky zhvillim vjen nÃ« kontekstin e tensioneve tÃ« vazhdueshme dhe synon tÃ« forcojÃ« sigurinÃ« nÃ« rajon.`,
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
    body: `Banka Qendrore e KosovÃ«s ka raportuar se remitancat nga diaspora shqiptare kanÃ« tejkaluar shifrÃ«n e 1 miliard eurove gjatÃ« vitit 2024, duke shÃ«nuar rekord historik. Shumica e fondeve vijnÃ« nga diaspora nÃ« Gjermani, ZvicÃ«r dhe Shtetet e Bashkuara.`,
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
    body: `FutbollistÃ«t e KosovÃ«s kanÃ« shkruar histori duke u kualifikuar pÃ«r herÃ« tÃ« parÃ« nÃ« fazÃ«n e grupeve tÃ« LigÃ«s B tÃ« Kombeve UEFA. Trajneri kombÃ«tar ka shprehur krenari pÃ«r arritjen, duke e konsideruar hap tÃ« madh drejt futbollit profesional.`,
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
    body: `NjÃ« studim i kryer nga organizata StartupBlink rendit PrishtinÃ«n si njÃ«rin nga qytetet me zhvillimin mÃ« tÃ« shpejtÃ« teknologjik nÃ« Ballkan. Faktori kyÃ§ Ã«shtÃ« popullata e re dhe numri i madh i tÃ« diplomuarve nÃ« fushÃ«n e TIK-ut.`,
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
    body: `Bisedimet midis delegacionit tÃ« KosovÃ«s dhe SerbisÃ« janÃ« rinisur nÃ« Bruksel nÃ«n ndÃ«rmjetÃ«simin e Bashkimit Evropian. Ky takim shÃ«non tentativÃ«n e re pÃ«r tÃ« zbatuar marrÃ«veshjen e Ohrit, e cila deri tani ka hasur shumÃ« pengesa.`,
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
    body: `Ministria e EkonomisÃ« ka njoftuar nÃ«nshkrimin e kontratÃ«s me njÃ« konsorcium tÃ« kompanive gjermane dhe austriake pÃ«r ndÃ«rtimin e parkut tÃ« erÃ«s nÃ« fushÃ«n e Dukagjinit. Ky projekt pritet tÃ« furnizojÃ« rreth 150,000 shtÃ«pi me energji tÃ« rinovueshme deri nÃ« vitin 2027.`,
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
    body: `Ky sukses historik shÃ«non arritjen mÃ« tÃ« lartÃ« tÃ« kinemasÃ« kosovare nÃ« festivalet ndÃ«rkombÃ«tare. Filmi 'Lumi i BardhÃ«' tregon historinÃ« e familjes kosovare gjatÃ« periudhÃ«s sÃ« pasluftÃ«s dhe Ã«shtÃ« xhiruar tÃ«rÃ«sisht nÃ« KosovÃ« me aktorÃ« vendorÃ«.`,
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
    body: `UNICEF ka publikuar raportin e tij vjetor pÃ«r arsimin nÃ« KosovÃ«, duke vlerÃ«suar pozitivisht reformat e fundit. Shkalla e regjistrimit nÃ« shkollat fillore ka arritur 97%, ndÃ«rsa cilÃ«sia e mÃ«simdhÃ«nies vazhdon tÃ« jetÃ« sfida kryesore.`,
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
