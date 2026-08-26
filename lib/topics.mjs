/**
 * Dosje: the standing topics 383 covers continuously, and the timeline each one
 * carries.
 *
 * A topic has two halves. The milestones below are authored history - the fixed
 * points a reader needs to make sense of today's story, most of which predate
 * this archive entirely. The recent half is the archive itself: articles match a
 * topic by its surface forms, so nothing has to be tagged by hand and every
 * story published from here on joins its dossier automatically.
 *
 * EDITORIAL NOTE: the milestone text is a first draft written from well-known
 * public record. Dates and framing must be checked by an editor before this is
 * treated as reference material. Prefer deleting an entry you cannot verify over
 * publishing one you are unsure of - a dossier is only worth having if it is
 * right.
 */

/** Lowercase, accent-tolerant comparison key. */
function fold(text) {
  return String(text ?? "")
    .toLowerCase()
    .replaceAll("\u00eb", "e")
    .replaceAll("\u00e7", "c")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const TOPICS = [
  {
    "slug": "dialogu-kosove-serbi",
    "title": "Dialogu Kosovë–Serbi",
    "blurb": "Bisedimet e ndërmjetësuara nga BE-ja, marrëveshjet e arritura dhe zbatimi i tyre.",
    "forms": [
      "dialogu kosove serbi",
      "kosove serbi",
      "kosova serbia",
      "bruksel",
      "brukselit",
      "ohri",
      "ohrit",
      "normalizim",
      "normalizimit",
      "asociacioni",
      "asociacionin",
      "vucic",
      "petkovic",
      "lajcak",
      "mitrovica",
      "veriu i kosoves",
      "targat",
      "banjska",
      "banjske",
      "dinar",
      "dinarit"
    ],
    "milestones": [
      {
        "year": "1999",
        "date": "Qershor 1999",
        "tag": "Baza",
        "title": "Lufta përfundon dhe hyn në fuqi Rezoluta 1244",
        "summary": "Pas fushatës ajrore të NATO-s, forcat serbe tërhiqen nga Kosova. Këshilli i Sigurimit miraton Rezolutën 1244, që vendos administrim ndërkombëtar dhe një prani ushtarake të udhëhequr nga NATO.",
        "why": "Është teksti që Beogradi citon ende sot kur kundërshton vendimet e Prishtinës, dhe baza ligjore e pranisë së KFOR-it."
      },
      {
        "year": "2008",
        "date": "17 shkurt 2008",
        "tag": "Pavarësia",
        "title": "Kosova shpall pavarësinë",
        "summary": "Kuvendi i Kosovës shpall pavarësinë. Serbia nuk e njeh dhe nis një fushatë të gjatë diplomatike kundër njohjeve të reja.",
        "why": "Mosnjohja është burimi i çdo bllokimi të mëvonëshëm, nga anëtarësimet ndërkombëtare te kodi telefonik."
      },
      {
        "year": "2010",
        "date": "22 korrik 2010",
        "tag": "GJND",
        "title": "Gjykata Ndërkombëtare e Drejtësisë jep opinionin",
        "summary": "GJND-ja vlerëson se shpallja e pavarësisë nuk shkeli të drejtën ndërkombëtare. Opinioni është këshillimor dhe nuk shprehet për statusin.",
        "why": "Hapi rrugën për dialogun: pas tij, Asambleja e OKB-së ia kaloi çështjen BE-së."
      },
      {
        "year": "2011",
        "date": "Mars 2011",
        "tag": "Nisja",
        "title": "Dialogu teknik nis në Bruksel",
        "summary": "Nis raundi i parë i bisedimeve të ndërmjetësuara nga BE-ja, për çështje praktike: lëvizja e lirë, kadastra, diplomat, vulat doganore.",
        "why": "Ky format, BE-ja si ndërmjetëse e jo si arbitre, mbetet korniza brenda së cilës zhvillohet çdo bisedim edhe sot."
      },
      {
        "year": "2011",
        "date": "Korrik–shtator 2011",
        "tag": "Kriza",
        "title": "Kriza e pikave kufitare në veri",
        "summary": "Prishtina dërgon njesi speciale për të marrë kontrollin e pikave Jarinje dhe Bërnjak. Pasojnë barrikada, djegia e një pike kufitare dhe ndërhyrja e KFOR-it.",
        "why": "Modeli u përsërit për një dekadë: një vendim administrativ në veri kthehet në krizë sigurie brenda ditesh."
      },
      {
        "year": "2012",
        "date": "Tetor 2012",
        "tag": "Niveli politik",
        "title": "Dialogu ngrihet në nivel kryeministrash",
        "summary": "Bisedimet kalojnë nga niveli teknik në atë politik, me takime të drejtpërdrejta mes kryeministrave të dy vendeve.",
        "why": "Pa këtë ngritje nuk do të kishte pasur Marrëveshje të Parë gjashtë muaj më vonë."
      },
      {
        "year": "2013",
        "date": "19 prill 2013",
        "tag": "Marrëveshje",
        "title": "Marrëveshja e Parë e Brukselit",
        "summary": "Palët bien dakord për peswëmbedhjetë pika: shpërbërjen e strukturave paralele të sigurisë në veri, integrimin e policisë dhe gjyqësorit në sistemin e Kosovës, dhe krijimin e një Asociacioni të komunave me shumicë serbe.",
        "why": "Është dokumenti bazë i gjithë dialogut. Çdo bisedim i mëvonëshëm i referohet atij, dhe pika e Asociacionit mbetet e pazbatuar."
      },
      {
        "year": "2013",
        "date": "Nëntor 2013",
        "tag": "Integrimi",
        "title": "Zgjedhjet lokale mbahen edhe në veri",
        "summary": "Për herë të parë zgjedhjet lokale mbahen në katër komunat veriore sipas ligjit të Kosovës, pas thirrjes së Beogradit për pjesëmarrje.",
        "why": "Ishte prova e parë praktike se Marrëveshja e Parë mund të zbatohej në terren."
      },
      {
        "year": "2015",
        "date": "25 gusht 2015",
        "tag": "Asociacioni",
        "title": "Parimet e Asociacionit dhe marrëveshjet për energjinë",
        "summary": "Arrihet pajtimi për parimet e përgjithshme të Asociacionit të komunave me shumicë serbe, së bashku me marrëveshje për energjinë, telekomin dhe urën e Mitrovicës.",
        "why": "Teksti u bë menjëherë i diskutueshem brenda Kosovës, dhe mbetet nyja më e ngurtë e të gjithë procesit."
      },
      {
        "year": "2015",
        "date": "Dhjetor 2015",
        "tag": "Kushtetuta",
        "title": "Gjykata Kushtetuese vlerëson parimet e Asociacionit",
        "summary": "Gjykata Kushtetuese e Kosovës konstaton se disa nga parimet e dakorduara nuk janë plotësisht në pajtim me Kushtetutën.",
        "why": "Ky vendim është arsyeja juridike që Prishtina përmend sa herë kërkohet zbatimi i menjëhershëm i Asociacionit."
      },
      {
        "year": "2017",
        "date": "Janar 2017",
        "tag": "Incident",
        "title": "Treni me mbishkrimin “Kosova është Serbi”",
        "summary": "Një tren i nisur nga Beogradi drejt Mitrovicës, i lyer me mbishkrimin “Kosova është Serbi” në njezet gjuhë, ndalet në kufi dhe kthehet.",
        "why": "Tregoi se simbolika, jo vetëm politika, mjafton për të ngrirë dialogun për muaj të terë."
      },
      {
        "year": "2018",
        "date": "Nëntor 2018",
        "tag": "Taksa",
        "title": "Kosova vendos takën 100 për qind ndaj mallrave serbe",
        "summary": "Pas dështimit të anëtarësimit në Interpol, Qeveria e Kosovës vendos takë doganore 100 për qind ndaj mallrave nga Serbia dhe Bosnja.",
        "why": "Dialogu u ndal për më shumë se një vit e gjysmë: pa heqjen e takës, Beogradi refuzoi të ulej në tavolinë."
      },
      {
        "year": "2020",
        "date": "Prill 2020",
        "tag": "Taksa",
        "title": "Taksa hiqet",
        "summary": "Pas presionit të fortë amerikan dhe evropian, taksa hiqet në faza gjatë pranëverës së 2020-tës.",
        "why": "Heqja ishte kushti për rinisjen e bisedimeve, dhe çoi drejtpërdrejt te takimi i Uashingtonit."
      },
      {
        "year": "2020",
        "date": "4 shtator 2020",
        "tag": "Uashington",
        "title": "Marrëveshjet e Uashingtonit",
        "summary": "Në Shtëpinë e Bardhë, Kosova dhe Serbia nënshkruajnë veçmas dokumente për normalizim ekonomik: infrastrukturë, energji, lidhje ajrore dhe hekurudhore.",
        "why": "Shënoi hyrjen e Uashingtonit si tavolinë paralele me Brukselin, jo gjithnjë me të njëjtin drejtim."
      },
      {
        "year": "2021",
        "date": "Shtator 2021",
        "tag": "Targat",
        "title": "Kriza e parë e targave",
        "summary": "Vendimi për targa të përkohshme për automjetet me targa serbe sjell barrikada në veri dhe një bllokim dyjavesh të pikave kufitare.",
        "why": "Nisi ciklin e krizave të targave që do të dominonte dy vitet në vijim."
      },
      {
        "year": "2022",
        "date": "Gusht–nëntor 2022",
        "tag": "Targat",
        "title": "Kriza e targave rikthehet dhe serbët dalin nga institucionet",
        "summary": "Afati për riregjistrimin e automjeteve sjell barrikada të reja. Në nëntor, zyrtarët serbë japin dorëheqje masive nga policia, gjyqësori dhe komunat në veri.",
        "why": "Dorëheqjet krijuan zbrazëtinë institucionale që çoi te zgjedhjet e kontestuara të vitit 2023."
      },
      {
        "year": "2023",
        "date": "27 shkurt 2023",
        "tag": "Marrëveshje",
        "title": "Marrëveshja për rrugën drejt normalizimit",
        "summary": "Në Bruksel arrihet pajtimi për një marrëveshje bazë: njohje reciproke e dokumenteve, mosbllokim i anëtarësimeve ndërkombëtare, dhe vetëqeverisje për komunitetin serb. Asnjëra palë nuk e nënshkruan.",
        "why": "Mosnënshkrimi është arsyeja që të dyja palët e lexojnë tekstin ndryshe deri sot."
      },
      {
        "year": "2023",
        "date": "18 mars 2023",
        "tag": "Ohri",
        "title": "Aneksi i zbatimit në Ohër",
        "summary": "Në Ohër të Maqedonisë së Veriut, palët bien dakord për aneksin që përcakton se si zbatohet marrëveshja e shkurtit.",
        "why": "Aneksi hoqi radhën e hapave, por jo detyrimin për nënshkrim, prandaj zbatimi mbeti çështje interpretimi."
      },
      {
        "year": "2023",
        "date": "Maj 2023",
        "tag": "Përplasje",
        "title": "Kryetarët hyjnë në komunat veriore dhe ushtarë të KFOR-it lëndohen",
        "summary": "Pas zgjedhjeve me pjesëmarrje nën tre për qind, kryetarët e rinj hyjnë në godinat komunale me shoqërim policor. Më 29 maj, dhjetëra ushtarë të KFOR-it lëndohen në përballje me protestues.",
        "why": "Ishte hera e parë pas shumë vitesh që trupat e NATO-s pësuan lëndime të shumta, dhe solli masa ndëshkuese të BE-së ndaj Prishtinës."
      },
      {
        "year": "2023",
        "date": "24 shtator 2023",
        "tag": "Banjskë",
        "title": "Sulmi i armatosur në Banjskë",
        "summary": "Një grup i armatosur i zihet presë policisë së Kosovës te Banjska e Zveçanit. Vritet një polic i Kosovës dhe tre sulmues; gjendet një arsenal i konsiderueshem armatimi.",
        "why": "Ndryshoi tonin e dialogut dhe çoi në rritje të pranisë ndërkombëtare të sigurisë në veri."
      },
      {
        "year": "2024",
        "date": "Shkurt 2024",
        "tag": "Dinari",
        "title": "Rregullorja e Bankës Qendrore për paranë e gatshme",
        "summary": "Hyn në fuqi rregullorja që përcakton euron si të vetëmen monedhë për pagesa në para të gatshme, duke prekur pagesat në dinarë për komunitetin serb.",
        "why": "U kritikua nga partnerët ndërkombëtarë për mungese periudhe kalimtare, dhe u bë tema kryesore e dialogut atë vit."
      }
    ],
    "videos": [
      {
        "id": "hpGAwEJMAt4",
        "channel": "CSIS",
        "title": "Recognition and History: Understanding Kosovo-Serbia Relations"
      },
      {
        "id": "hjdzKXLIHj0",
        "channel": "Al Jazeera English",
        "title": "Kosovo: The Making of a State (People & Power)"
      },
      {
        "id": "fRS7c4j6nFE",
        "channel": "BBC Stories",
        "title": "Growing up in Kosovo: I've never met a Serb"
      }
    ]
  },
  {
    "slug": "kfor",
    "title": "KFOR-i në Kosovë",
    "blurb": "Prania ushtarake e NATO-s, mandati i saj dhe roli në situatat e sigurisë.",
    "forms": [
      "kfor",
      "nato",
      "paqeruajtes",
      "ura mbi iber",
      "iber",
      "zvecan",
      "zvecani"
    ],
    "milestones": [
      {
        "year": "1999",
        "date": "Qershor 1999",
        "tag": "Mandati",
        "title": "KFOR-i vendoset në Kosovë",
        "summary": "Pas fushatës ajrore të NATO-s dhe Rezolutës 1244, rreth 50 mijë trupa të udhëhequr nga NATO hyjnë në Kosovë për të garantuar një mjedis të sigurt.",
        "why": "Mandati i vitit 1999 është ende baza ligjore e pranisë së KFOR-it sot, pavarësisht ndryshimit të madh të kontekstit."
      },
      {
        "year": "2004",
        "date": "Mars 2004",
        "tag": "Trazirat",
        "title": "Trazirat e marsit",
        "summary": "Dy ditë dhune ndëretnike në më shumë se tridhjetë vendbanime lëçojnë dhjetëra viktima, mijëra të zhvendosur dhe dëmtim të objekteve fetare. KFOR-i kritikohet për reagim të ngadaltë.",
        "why": "Ndryshoi doktrinën e KFOR-it: që nga ajo kohë forca mban rezerva të gëndëshme për reagim të shpejtë."
      },
      {
        "year": "2008",
        "date": "Shkurt 2008",
        "tag": "Statusi",
        "title": "KFOR-i mbetet pas shpalljes së pavarësisë",
        "summary": "Me shpalljen e pavarësisë, NATO konfirmon se KFOR-i qendron në bazë të Rezolutës 1244, pavarësisht ndryshimit të statusit.",
        "why": "Prandaj KFOR-i nuk është forcë e Kosovës dhe nuk merr urdhera nga Prishtina."
      },
      {
        "year": "2013",
        "date": "2013",
        "tag": "Zvogëlimi",
        "title": "Forca zvogëlohet në rreth pesë mijë trupa",
        "summary": "Pas viteve me përmirësim të gjendjes së sigurisë, NATO redukton ndjeshëm numrin e trupave dhe kalon në një model me rezerva jashtë vendit.",
        "why": "Zvogëlimi shpjegon pse çdo krizë e mëvonshme kërkon dërgim të shpejtë forcash shtesë nga jashtë."
      },
      {
        "year": "2023",
        "date": "29 maj 2023",
        "tag": "Përplasje",
        "title": "Ushtarë të KFOR-it lëndohen në veri",
        "summary": "Gjatë protestave para godinave komunale në Zveçan, dhjetëra ushtarë italianë dhe hungarezë të KFOR-it lëndohen në përballje me protestues.",
        "why": "Ishte hera e parë pas shumë vitesh që trupat e NATO-s pësuan lëndime të shumta në Kosovë."
      },
      {
        "year": "2023",
        "date": "Shtator–tetor 2023",
        "tag": "Përforcim",
        "title": "Forca shtesë pas Banjskës",
        "summary": "Pas sulmit të armatosur në Banjskë, NATO dërgon batalione shtesë dhe rrit patrullimin në veri.",
        "why": "Prania e sotme e KFOR-it është pasojë e drejtpërdrejtë e vjeshtës 2023."
      }
    ],
    "videos": [
      {
        "id": "sMAowyCo4As",
        "channel": "Frontline by ITN",
        "title": "Kosovo War Day by Day (1998-1999), Part 1"
      },
      {
        "id": "VrcAMyWW9yw",
        "channel": "HistoryLegends",
        "title": "The Uncomfortable War Europe Forgot About"
      }
    ]
  },
  {
    "slug": "anetaresimi-ne-be",
    "title": "Rruga e Kosovës drejt BE-së",
    "blurb": "Marrëveshjet, aplikimi për anëtarësim, vizat dhe kushtëzimet.",
    "forms": [
      "bashkimi evropian",
      "bashkimin evropian",
      "be-ja",
      "be-se",
      "anetaresim",
      "anetaresimi",
      "integrim evropian",
      "stabilizim asociim",
      "liberalizim",
      "vizave",
      "komisioni evropian",
      "parlamenti evropian",
      "eulex",
      "kandidat",
      "kandidate"
    ],
    "milestones": [
      {
        "year": "2008",
        "date": "Dhjetor 2008",
        "tag": "EULEX",
        "title": "Misioni EULEX vendoset në Kosovë",
        "summary": "BE-ja vendos misionin më të madh civil të saj, me mandat në polici, drejtësi dhe dogana.",
        "why": "EULEX-i ishte forma e parë konkrete e pranisë evropiane, dhe modeli i saj u bë i diskutueshëm për vite."
      },
      {
        "year": "2015",
        "date": "Tetor 2015",
        "tag": "MSA",
        "title": "Marrëveshja e Stabilizim-Asociimit nënshkruhet",
        "summary": "Pas një studimi fizibiliteti dhe negociatash disavjeçare, MSA-ja nënshkruhet në Strasburg.",
        "why": "Ishte marrëveshja e parë kontraktuale mes Kosovës dhe BE-së, e nënshkruar pa u kërkuar njohje nga të pesë shtënë anëtare mosnjohëse."
      },
      {
        "year": "2016",
        "date": "1 prill 2016",
        "tag": "MSA",
        "title": "MSA-ja hyn në fuqi",
        "summary": "Marrëveshja hyn në fuqi dhe krijon kornizën ligjore të marrëdhënies, me detyrime konkrete për reforma.",
        "why": "Është hapi që e kthen raportin me BE-në nga politikë ndihme në detyrime të ndërsjella."
      },
      {
        "year": "2018",
        "date": "Korrik 2018",
        "tag": "Vizat",
        "title": "Komisioni konfirmon plotësimin e kritereve për viza",
        "summary": "Komisioni Evropian konstaton se Kosova i ka përmbushur të gjitha kriteret për liberalizim vizash, përfshirë demarkacionin me Malin e Zi.",
        "why": "Mes këtij konfirmimi dhe heqjes reale të vizave kaluan më shumë se pesë vjet bllokimi në Këshill."
      },
      {
        "year": "2022",
        "date": "14 dhjetor 2022",
        "tag": "Aplikimi",
        "title": "Kosova aplikon për anëtarësim në BE",
        "summary": "Qeveria e Kosovës dorëzon aplikimin formal për anëtarësim në Bashkimin Evropian.",
        "why": "Aplikimi mbetet pa statusin e vendit kandidat, çka e bën rrugën e Kosovës të ndryshme nga fqinjët."
      },
      {
        "year": "2023",
        "date": "Qershor 2023",
        "tag": "Masat",
        "title": "BE-ja vendos masa ndaj Kosovës",
        "summary": "Pas krizes së majit në veri, BE-ja pezullon disa programe dhe takime të nivelit të lartë me Prishtinën.",
        "why": "Ishte hera e parë që Brukseli përdori masa ndëshkuese ndaj një vendi aspirant të Ballkanit Përendimor."
      },
      {
        "year": "2024",
        "date": "1 janar 2024",
        "tag": "Vizat",
        "title": "Liberalizimi i vizave hyn në fuqi",
        "summary": "Qytetarët e Kosovës me pasaportë biometrike mund të udhëtojnë pa viza në zonën Schengen për nentëdhjetë ditë brenda njeqind e të tetëdhjetëve.",
        "why": "Kosova ishte e fundit në rajon që e fitoi këtë të drejtë, pas më shumë se një dekade pritjeje."
      }
    ],
    "videos": [
      {
        "id": "oXGmXkEtExw",
        "channel": "euronews",
        "title": "Kosovo formally applies for EU membership"
      },
      {
        "id": "5NscKkAfuUE",
        "channel": "DW News",
        "title": "Kosovo and Serbia: No EU membership without normalizing relations"
      },
      {
        "id": "uKxbe4e9R2k",
        "channel": "TVP World",
        "title": "Challenges ahead of joining the EU - Albin Kurti"
      }
    ]
  },
  {
    "slug": "diaspora",
    "title": "Diaspora dhe të drejtat e saj",
    "blurb": "Votimi, remitancat, shërbimet konsullore dhe lidhja e mërgatës me vendin.",
    "forms": [
      "diaspora",
      "diasporen",
      "diaspores",
      "mergata",
      "mergimtar",
      "mergimtaret",
      "remitanca",
      "remitancat",
      "konsullata",
      "ambasada"
    ],
    "milestones": [
      {
        "year": "1990",
        "date": "Vitet 1990",
        "tag": "Fillimet",
        "title": "Vala e madhe e largimit",
        "summary": "Gjatë viteve nentëdhjetë, qindra mijë kosovarë largohen drejt Zvicrës, Gjermanisë, Austrisë dhe vendeve nordike, si për arsye politike ashtu edhe ekonomike.",
        "why": "Harta e sotme e diasporës, dhe rrjedhimisht e remitancave, u vizatua në atë dhjetëvjeçar."
      },
      {
        "year": "1999",
        "date": "1999",
        "tag": "Solidariteti",
        "title": "Fondi i diasporës gjatë luftës",
        "summary": "Diaspora financon në mënyrë masive strukturat civile dhe ndihmen humanitare gjatë luftës dhe menjëherë pas saj.",
        "why": "Kjo periudhë krijoi pritshmërinë, ende të gjallë, se mërgata mbron vendin kur institucionet nuk munden."
      },
      {
        "year": "2024",
        "date": "Në vijim",
        "tag": "Remitancat",
        "title": "Remitancat si shtyllë e ekonomisë",
        "summary": "Dërgesat nga jashtë përbëjnë një pjesë të konsiderueshme të bruto produktit vendor dhe mbajnë konsumin familjar në shumë komuna.",
        "why": "Çdo politikë për diasporën prek drejtpërdrejt të ardhurat e familjeve, jo vetëm ndjenjat."
      },
      {
        "year": "Çdo vit",
        "date": "Vera",
        "tag": "Kthimi",
        "title": "Vala verore e kthimit",
        "summary": "Qindra mijë mërgimtarë kthehen çdo verë, duke ngarkuar pikat kufitare, hotelet dhe shërbimet komunale, dhe duke ndikuar ndjeshëm në ekonominë e sezonit.",
        "why": "Është momenti i vitit kur politikat për diasporën testohen praktikisht: nga radhët në kufi te çmimet e qirave."
      },
      {
        "year": "Në vijim",
        "date": "Në vijim",
        "tag": "Votimi",
        "title": "Votimi nga jashtë vendit",
        "summary": "Mënyra e regjistrimit dhe e dërgimit të votës nga jashtë mbetet çështje e përsëritur para çdo pale zgjedhjesh, me afate të shkurtra dhe kushte që ndryshojnë.",
        "why": "Numri i votuesve të diasporës është mjaft i madh sa të ndikojë rezultatin, prandaj rregullat janë vazhdimisht të diskutueshme."
      }
    ],
    "videos": []
  },
  {
    "slug": "trump-dhe-ballkani",
    "title": "Trump dhe Ballkani",
    "blurb": "Politika amerikane ndaj Kosovës dhe rajonit nën administratën Trump.",
    "forms": [
      "trump",
      "trumpi",
      "trumpit",
      "shtepia e bardhe",
      "uashington",
      "administrata amerikane",
      "shba"
    ],
    "milestones": [
      {
        "year": "2018",
        "date": "2018–2019",
        "tag": "Ndryshimi",
        "title": "Uashingtoni merr rol të drejtpërdrejtë",
        "summary": "Administrata amerikane emëron të dërguar të posaçëm për Ballkanin dhe nis një kanal negociimi paralel me atë të Brukselit, me fokus te marrëveshjet ekonomike.",
        "why": "Nga ky moment Prishtina dhe Beogradi negociojnë në dy tavolina njeherësh, jo gjithnjë me të njëjtat kushte."
      },
      {
        "year": "2020",
        "date": "4 shtator 2020",
        "tag": "Uashington",
        "title": "Marrëveshjet e Uashingtonit nënshkruhen në Shtëpinë e Bardhë",
        "summary": "Kosova dhe Serbia nënshkruajnë veçmas dokumente për normalizim ekonomik, në një ceremoni në Zyrën Ovale.",
        "why": "Modeli i ndërmjetësimit amerikan, i shpejtë dhe i drejtpërdrejtë, kthehet si pikë referimi sa herë ndryshon administrata."
      },
      {
        "year": "2025",
        "date": "2025",
        "tag": "Rikthimi",
        "title": "Administrata e re dhe pritjet në rajon",
        "summary": "Rikthimi i administratës Trump rihap pyetjen se sa do të angazhohet Uashingtoni në Ballkan dhe me çfarë kushtesh.",
        "why": "Për Kosovën, mbështetja amerikane ka qenë historikisht garancia kryesore e sigurisë, prandaj çdo ndryshim toni ndiqet nga afer."
      }
    ],
    "videos": []
  }
];

const BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));

export function topicBySlug(slug) {
  return BY_SLUG.get(String(slug ?? "")) ?? null;
}

function formHits(article, topic) {
  const hay = " " + fold((article?.title ?? "") + " " + (article?.excerpt ?? "") + " " + (article?.category ?? "")) + " ";
  return (topic?.forms ?? []).filter((form) => {
    const f = fold(form);
    return f.length > 2 && hay.includes(" " + f + " ");
  }).length;
}

/**
 * Whether an article belongs to a topic. Matches whole words inside the folded
 * title, excerpt and category, so "bruksel" hits "Brukselit" while a short form
 * can never match the middle of an unrelated word.
 */
export function articleMatchesTopic(article, topic) {
  if (!article || !topic) return false;
  return formHits(article, topic) > 0;
}

/** The single best topic for an article: most surface-form hits wins. */
export function topicForArticle(article) {
  let best = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    const score = formHits(article, topic);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  return best;
}

export function articlesForTopic(slug, articles) {
  const topic = topicBySlug(slug);
  if (!topic) return [];
  return (articles ?? [])
    .filter((a) => articleMatchesTopic(a, topic))
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));
}

/**
 * The dossier timeline: authored history oldest-first, then this archive's own
 * coverage, with the article being read marked in place so a reader can see
 * where today sits in the longer story.
 */
export function timelineFor(slug, articles, currentSlug) {
  const current = currentSlug ?? null;
  const topic = topicBySlug(slug);
  if (!topic) return [];

  const milestones = (topic.milestones ?? []).map((m) => ({
    kind: "milestone",
    id: "m:" + m.date + ":" + m.title,
    ...m,
  }));

  const recent = articlesForTopic(slug, articles)
    .slice(0, 14)
    .reverse()
    .map((a) => ({
      kind: "article",
      id: "a:" + a.slug,
      year: String(a.publishedAt ?? "").slice(0, 4),
      date: a.publishedAt,
      tag: a.category,
      title: a.title,
      summary: a.excerpt,
      slug: a.slug,
      imageUrl: a.imageUrl ?? null,
      source: a.source ?? null,
      publishedAt: a.publishedAt ?? null,
      isCurrent: Boolean(current) && a.slug === current,
    }));

  return [...milestones, ...recent];
}
