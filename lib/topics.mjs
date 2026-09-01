import { matchTopic, MIN_TOPIC_SCORE } from "./dosje-match.mjs";
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
        "summary": "Pas gjashtë muajsh bisedimesh në nivel kryeministrash, palët bien dakord për peswëmbedhjetë pika. Strukturat paralele të sigurisë në veri shpërbehen dhe policia e gjyqësori integrohen në sistemin e Kosovës, me një komandant rajonal serb për katër komunat veriore. Në këmbëngulje të Beogradit, teksti parasheh edhe një Asociacion të komunave me shumicë serbe. Asnjëra palë nuk pranon se marrëveshja prek statusin.",
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
        "summary": "Në Shtëpinë e Bardhë, Kosova dhe Serbia nënshkruajnë veçmas dy dokumente pothuajse identike për normalizim ekonomik: autostrada dhe hekurudha lidhëse, njohje reciproke e diplomave, pjesëmarrje në mini-Schengenin rajonal dhe bashkëpunim energjetik. Dokumentet përmbajnë edhe pika që nuk kanë lidhje me njera-tjetrën, si zhvendosja e ambasadave në Jerusalem.",
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
        "summary": "Afati për riregjistrimin e automjeteve me targa serbe sjell barrikada të reja në veri dhe ndërhyrje të KFOR-it në rrugët kryesore. Në nëntor, rreth gjashtëqind zyrtarë serbë — policë, gjyqtarë, prokurorë dhe anëtarë të kuvendeve komunale — japin dorëheqje të njehkohshme, duke lënë katër komuna pa administratë funksionale.",
        "why": "Dorëheqjet krijuan zbrazëtinë institucionale që çoi te zgjedhjet e kontestuara të vitit 2023."
      },
      {
        "year": "2023",
        "date": "27 shkurt 2023",
        "tag": "Marrëveshje",
        "title": "Marrëveshja për rrugën drejt normalizimit",
        "summary": "Teksti i njembedhjetë neneve parasheh njohje reciproke të dokumenteve dhe simboleve, mosbllokim të anëtarësimeve ndërkombëtare, dhe një nivel të përshtatshëm vetëqeverisjeje për komunitetin serb në Kosovë. Asnjëra palë nuk e nënshkruan: Prishtina kërkon nënshkrim, Beogradi refuzon, dhe BE-ja e trajton si të detyrueshëm politikisht pavarësisht mungeses së firmave.",
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
        "why": "Ndryshoi tonin e dialogut dhe çoi në rritje të pranisë ndërkombëtare të sigurisë në veri.",
        "source": "Balkan Insight; RFE/RL"
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
    ],
    "context": ["kosove", "kosova", "kosoves", "kosovo", "serbi", "serbia", "kurti", "vucic", "petkovic", "lajcak", "mitrovica"],
    "researchGroups": [["kosovo","serbia"],["kosovo","dialogue"],["kosovo","normalization"],["kosovo","brussels"]],
    "matchGroups": [["dialogu"],["kosove","serbi"],["bruksel","normalizim"],["bruksel","normalizimin"],["ohri"],["asociacioni"],["asociacionin"],["banjska"],["targat"],["dinar"],["kurti","vucic"],["kosove","vucic"],["kurti","petkovic"],["lajcak","dialogu"]],
    "anchors": [
      "dialogu kosove serbi",
      "kosove serbi",
      "kosova serbia",
      "kosove",
      "kosova",
      "kosoves",
      "mitrovica",
      "mitrovice",
      "veriu i kosoves",
      "banjska",
      "banjske",
      "vucic",
      "petkovic",
      "kurti",
      "asociacioni",
      "asociacionin",
      "targat"
    ],
    "signals": [
      "bruksel",
      "brukselit",
      "ohri",
      "ohrit",
      "normalizim",
      "normalizimit",
      "lajcak",
      "dinar",
      "dinarit",
      "marreveshje"
    ],
    "excludes": [
      "turqi",
      "turqia",
      "turqine",
      "ankara",
      "stambolli",
      "ukraine",
      "ukraina",
      "ukrraine",
      "rusi",
      "rusia",
      "moska",
      "izrael",
      "gaza",
      "siri",
      "afganistan",
      "iran",
      "stervitje",
      "stervitjet",
      "manovra"
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
        "summary": "Pas fushatës ajrore të NATO-s dhe tërheqjes së forcave serbe, Këshilli i Sigurimit miraton Rezolutën 1244 dhe autorizon një prani ndërkombëtare sigurie. Rreth 50 mijë trupa nga më shumë se tridhjetë shtete hyjnë në Kosovë, të ndarë në pesë zona përgjegjësie. Detyra e parë është ndalja e armiqesive, çarmatimi i formacioneve të armatosura dhe kthimi i qindra mijë njerezve të zhvendosur. Nga ky moment siguria në Kosovë nuk është më çështje e Beogradit.",
        "why": "Mandati i vitit 1999 është ende baza ligjore e pranisë së KFOR-it sot, pavarësisht ndryshimit të madh të kontekstit."
      },
      {
        "year": "2004",
        "date": "17–18 mars 2004",
        "tag": "Trazirat",
        "title": "Trazirat e marsit",
        "summary": "Dy ditë dhune ndëretnike shpërthejnë pas raportimeve të pavertetuara se tre fëmijë shqiptarë ishin mbytur në Ibër. Vriten nendëmbedhjetë veta — njembedhjetë shqiptarë dhe tetë serbë — dhe më shumë se nenteqind mbeten të plagosur. Rreth katër mijë njerez zhvendosen, pesëqind e pesedhjetë shtëpi shkatërrohen dhe njezetë e shtatë kisha e manastire ortodokse digjen.",
        "why": "KFOR-i dhe policia ndërkombëtare u kritikuan ashër për reagim të ngadaltë dhe për mungese të një zinxhiri të vetëm komandimi; pas 2004-ës doktrina e forcës ndryshoi.",
        "source": "Human Rights Watch, “Failure to Protect” (2004)"
      },
      {
        "year": "2008",
        "date": "Shkurt 2008",
        "tag": "Statusi",
        "title": "KFOR-i mbetet pas shpalljes së pavarësisë",
        "summary": "Me shpalljen e pavarësisë, NATO konfirmon se KFOR-i qendron dhe se baza e mandatit mbetet Rezoluta 1244, jo ftesa e një shteti të ri. Kjo zgjedhje mban brenda aleancës edhe shtetet që nuk e njohin Kosovën, sepse asnjëra nuk detyrohet të ndryshojë qendrim për të mbajtur trupat në terren. Prandaj KFOR-i nuk është forcë e Kosovës, nuk merr urdhëra nga Prishtina dhe raporton në Bruksel.",
        "why": "Prandaj KFOR-i nuk është forcë e Kosovës dhe nuk merr urdhera nga Prishtina."
      },
      {
        "year": "2013",
        "date": "2013",
        "tag": "Zvogëlimi",
        "title": "Forca zvogëlohet në rreth pesë mijë trupa",
        "summary": "Pas disa vitesh me përmirësim të gjendjes, NATO kalon nga një prani e madhe e përhershme në një forcë të vogël me rezerva të vendosura jashtë vendit. Numri bie në rreth pesë mijë trupa dhe shumë baza dorëzohen. Modeli mbeshtetet te supozimi se përforcimet mund të mbërrijnë brenda ditesh, gjë që do të testohet seriozisht një dekadë më vonë.",
        "why": "Zvogëlimi shpjegon pse çdo krizë e mëvonshme kërkon dërgim të shpejtë forcash shtesë nga jashtë."
      },
      {
        "year": "2023",
        "date": "29 maj 2023",
        "tag": "Përplasje",
        "title": "Ushtarë të KFOR-it lëndohen në veri",
        "summary": "Pas zgjedhjeve lokale me pjesëmarrje nën tre për qind, kryetarët e rinj hyjnë në godinat komunale të veriut me shoqërim policor. Protestat përshkallezohen para komunës së Zveçanit dhe dhjetëra ushtarë italianë e hungarezë të KFOR-it lëndohen, disa rëndësisht. NATO dërgon menjëherë rreth pesëqind trupa shtesë, ndersa BE-ja vendos masa ndaj Prishtinës për mënyrën si u veprua.",
        "why": "Ishte hera e parë pas shumë vitesh që trupat e NATO-s pësuan lëndime të shumta në Kosovë."
      },
      {
        "year": "2023",
        "date": "Shtator–tetor 2023",
        "tag": "Përforcim",
        "title": "Forca shtesë pas Banjskës",
        "summary": "Sulmi i armatosur në Banjskë, ku u vra një polic i Kosovës dhe u gjet një sasi e madhe armatimi, ndryshon vlerësimin e riskut. NATO dërgon batalione shtesë, rrit patrullimin në veri dhe kthen në Kosovë pajisje të rënda që ishin tërhequr vite më parë. Prania e sotme e KFOR-it, më e madhe se në një dekadë, është pasojë e drejtpërdrejtë e vjeshtës 2023.",
        "why": "Prania e sotme e KFOR-it është pasojë e drejtpërdrejtë e vjeshtës 2023."
      }
    ],
    "videos": [
      {
        "id": "sMAowyCo4As",
        "channel": "Frontline by ITN",
        "title": "Kosovo War Day by Day (1998-1999), Part 1"
      }
    ],
    "context": ["kosove", "kosova", "kosoves", "kosovo", "kfor", "mitrovica", "mitrovice", "iber", "zvecan"],
    "researchGroups": [["kosovo","kfor"],["kosovo","nato"],["kosovo","mitrovica"]],
    "matchGroups": [["kfor"],["ura","iber"],["mitrovica","kfor"],["mitrovice","kfor"],["zvecan","kfor"],["zvecani","kfor"],["paqeruajtes","kosove"],["leposaviq","kfor"],["zubin","kfor"]],
    "anchors": [
      "kfor",
      "kosove",
      "kosova",
      "kosoves",
      "mitrovice",
      "mitrovica",
      "ura mbi iber",
      "iber",
      "zvecan",
      "zvecani",
      "leposaviq",
      "zubin potok"
    ],
    "signals": [
      "nato",
      "paqeruajtes",
      "trupa",
      "siguri",
      "ushtarake",
      "batalion"
    ],
    "excludes": [
      "turqi",
      "turqia",
      "turqine",
      "ankara",
      "stambolli",
      "ukraine",
      "ukraina",
      "ukrraine",
      "rusi",
      "rusia",
      "moska",
      "izrael",
      "gaza",
      "siri",
      "afganistan",
      "iran",
      "stervitje",
      "stervitjet",
      "manovra"
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
        "summary": "Qeveria e Kosovës dorëzon aplikimin formal për anëtarësim në Pragen, presidenën e radhës të Këshillit. Aplikimi vjen pak ditë pas hyrjes në fuqi të marrëveshjes për targat dhe në një moment kur pesë shtete anëtare ende nuk e njohin pavarësinë, çka do të thotë se edhe hapi i parë procedural kërkon unanimitet që nuk ekziston.",
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
        "summary": "Qytetarët e Kosovës me pasaportë biometrike mund të udhëtojnë pa viza në zonën Schengen për nentëdhjetë ditë brenda çdo periudhe njeqind e tetëdhjetë ditore. Kosova ishte vendi i fundit i Ballkanit Përendimor pa këtë të drejtë, më shumë se pesë vjet pasi Komisioni kishte konfirmuar se të gjitha kriteret ishin përmbushur.",
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
    ],
    "context": ["kosove", "kosova", "kosoves", "kosovo", "prishtina", "kurti", "osmani"],
    "researchGroups": [["kosovo","european","union"],["kosovo","visa"],["kosovo","eulex"],["kosovo","membership"]],
    "matchGroups": [["anetaresim"],["anetaresimi"],["eulex"],["stabilizim","asociim"],["integrim","evropian"],["liberalizim","vizave"],["bashkimi","evropian"],["kandidat","kosove"],["komisioni","evropian"],["parlamenti","evropian"]],
    "anchors": [
      "kosove",
      "kosova",
      "kosoves",
      "anetaresim",
      "anetaresimi",
      "eulex",
      "stabilizim asociim",
      "integrim evropian"
    ],
    "signals": [
      "bashkimi evropian",
      "bashkimin evropian",
      "be-ja",
      "be-se",
      "liberalizim",
      "vizave",
      "komisioni evropian",
      "parlamenti evropian",
      "kandidat",
      "kandidate",
      "raport"
    ],
    "excludes": [
      "turqi",
      "turqia",
      "turqine",
      "ankara",
      "stambolli",
      "ukraine",
      "ukraina",
      "ukrraine",
      "rusi",
      "rusia",
      "moska",
      "izrael",
      "gaza",
      "siri",
      "afganistan",
      "iran",
      "stervitje",
      "stervitjet",
      "manovra"
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
    "videos": [],
    "context": ["kosove", "kosova", "kosoves", "kosovo", "prishtina", "mergata"],
    "researchGroups": [["kosovo","diaspora"],["kosovo","remittances"],["kosovo","emigration"]],
    "matchGroups": [["diaspora"],["mergata"],["remitanca"],["konsullata","kosove"],["ambasada","kosove"],["votimi","jashte"],["votim","jashte"],["kthimi","mergim"],["kthim","mergim"]],
    "anchors": [
      "diaspora",
      "diasporen",
      "diaspores",
      "mergata",
      "mergimtar",
      "mergimtaret",
      "remitanca",
      "remitancat"
    ],
    "signals": [
      "konsullata",
      "ambasada",
      "kosove",
      "kosova",
      "kthimi",
      "valuta"
    ],
    "excludes": [
      "turqi",
      "turqia",
      "turqine",
      "ankara",
      "stambolli",
      "ukraine",
      "ukraina",
      "ukrraine",
      "rusi",
      "rusia",
      "moska",
      "izrael",
      "gaza",
      "siri",
      "afganistan",
      "iran",
      "stervitje",
      "stervitjet",
      "manovra"
    ]
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
    "videos": [
      {
        "id": "crI59JJV8Y4",
        "channel": "Bloomberg Television",
        "title": "Trump Announces Kosovo and Serbia Agree to Economic Deal"
      },
      {
        "id": "qgr1HgcNH0I",
        "channel": "TRT World",
        "title": "Trump's Businesslike Approach to the Balkans?"
      },
      {
        "id": "4I0SahMOR_4",
        "channel": "euronews",
        "title": "New Trump administration's involvement bewilders Kosovo ahead of elections"
      }
    ],
    "context": ["kosove", "kosova", "kosoves", "kosovo", "ballkan", "ballkani", "serbi", "serbia"],
    "researchGroups": [["kosovo","trump"],["kosovo","balkans"],["kosovo","serbia"]],
    "matchGroups": [["trump","kosove"],["trump","ballkan"],["trump","serbi"],["uashington","kosove"],["shtepia","bardhe","kosove"],["shba","kosove"]],
    "anchors": [
      "kosove",
      "kosova",
      "kosoves",
      "ballkani",
      "ballkanit",
      "serbi",
      "serbia"
    ],
    "signals": [
      "trump",
      "trumpi",
      "trumpit",
      "shtepia e bardhe",
      "uashington",
      "administrata amerikane",
      "shba",
      "i derguari"
    ],
    "excludes": [
      "turqi",
      "turqia",
      "turqine",
      "ankara",
      "stambolli",
      "ukraine",
      "ukraina",
      "ukrraine",
      "rusi",
      "rusia",
      "moska",
      "izrael",
      "gaza",
      "siri",
      "afganistan",
      "iran",
      "stervitje",
      "stervitjet",
      "manovra"
    ]
  },
  {
    "slug": "bllokada-institucionale-kosove",
    "title": "Bllokada institucionale e Kosovës",
    "blurb": "Zgjedhjet e përsëritura, formimi i Kuvendit dhe bllokimi i zgjedhjes së presidentit.",
    "forms": ["bllokada institucionale", "ngerc institucional", "kriza institucionale", "zgjedhja e presidentit", "zgjedhjet e parakohshme", "formimi i kuvendit", "formimi i qeverise", "zgjedhje parlamentare"],
    "milestones": [],
    "videos": [],
    "context": ["kosove", "kosova", "kosoves", "kosovo", "konjufca", "lvv", "vetvendosje", "kurti", "abdixhiku", "osmani"],
    "researchGroups": [["kosovo","president"],["kosovo","parliament"],["kosovo","election"],["kosovo","deadlock"],["kosovo","assembly"],["kosovo","government"]],
    "matchGroups": [
      ["president", "konjufca"], ["president", "lvv"], ["president", "emrat"],
      ["president", "zgjedhje"], ["president", "zgjedhjeve"], ["president", "kuvend"],
      ["president", "kuvendi"], ["president", "parlament"], ["zgjedhje", "kuvend"],
      ["zgjedhje", "parlament"], ["formimi", "kuvend"], ["formimi", "qeveri"],
      ["bllokada", "kuvend"], ["bllokaden", "kuvend"], ["ngerc", "kuvend"],
      ["ngerc", "parlament"], ["koalicion", "president"], ["votimi", "president"],
      ["votimit", "president"], ["kuorum", "president"], ["shumice", "president"]
    ],
    "anchors": ["president", "kuvend", "parlament", "zgjedhje", "bllokada"],
    "signals": ["mandat", "koalicion", "kuorum", "votim", "qeveri"],
    "excludes": []
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
  // A story belongs in one file only when that file is its unique best topic.
  const match = matchTopic(article, TOPICS);
  return Boolean(match && match.topic.slug === topic.slug && match.score >= MIN_TOPIC_SCORE);
}

/**
 * The dossier an article belongs to, or none.
 *
 * This delegates to lib/dosje-match.mjs rather than scoring surface forms
 * itself, because there were two answers to this question and the one readers
 * got was the wrong one. The old rule attached a dossier on any single form
 * hit, so "nato" alone pinned the Kosovo KFOR file to a NATO summit in Ankara,
 * "shba" pinned the diaspora file to an embassy notice in Tirana, and a tie
 * was broken by whichever topic sat first in the array.
 *
 * The better rule was written, tested, and wired only to the automation job
 * that maps articles for research — so every property it guaranteed was false
 * on the page. One implementation now, used by both.
 */
export function topicForArticle(article) {
  const m = matchTopic(article, TOPICS);
  return m ? m.topic : null;
}

export function articlesForTopic(slug, articles) {
  const topic = topicBySlug(slug);
  if (!topic) return [];
  return (articles ?? [])
    .filter((a) => articleMatchesTopic(a, topic))
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));
}

/** Words too common to carry meaning when matching a milestone to a photo. */
/**
 * Words that carry no subject.
 *
 * The `length > 3` filter below already removes most short function words, so
 * what matters here are the long ones: ordinary Albanian verbs and nouns that
 * appear in every second headline and therefore match everything. Two of them
 * — "fuqi" and "vendos" — were the entire evidence for pairing the end of the
 * 1999 war with a story about US tariffs on Canada.
 */
const STOP = new Set([
  "sipas", "gjate", "midis", "eshte", "ishte", "ishin", "kete", "kjo",
  "vendos", "vendosi", "vendim", "vendimi", "fuqi", "fuqine", "mbetet",
  "mbeti", "shume", "vitit", "vitin", "viti", "ceshtje", "ceshtjen",
  "pjese", "pjesen", "pasi", "para", "brenda", "jashte", "shpall",
  "shpalli", "merr", "marre", "jep", "dhene", "behet", "bere", "kane",
  "kishte", "kishin", "duke", "tjera", "tjeter", "tjeret", "reja",
  "madh", "madhe", "vogel", "sot", "dje", "sonte", "tani", "kur",
  "raporton", "raportuar", "thote", "thene", "deklaroi", "deklaruar",
  "njofton", "njoftoi", "pret", "pritet", "vazhdon", "vazhduar",
]);

function keywords(text) {
  return new Set(
    fold(text)
      .split(" ")
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
}

/**
 * A photograph for an authored milestone, taken from this archive's own
 * coverage of the same subject.
 *
 * These are historical events and 383 holds no photograph of most of them, so
 * nothing here claims to be one. The image is the strongest match from the
 * archive on the milestone's own words, and it is always credited to the
 * article it came from — the caption is what keeps an illustration from
 * reading as documentation. A milestone with no decent match gets no image
 * rather than a loose one.
 */
/**
 * One photograph per moment, and never the same one twice.
 *
 * These are historical events and this archive holds no photograph of most of
 * them, so nothing here claims to be one. Every milestone is scored against
 * every article that carries an image, the strongest pairs are assigned first,
 * and an article is spent once it is used — which is what stops a dossier
 * showing the same picture down its whole length, the way a per-milestone
 * search independently picking its own best match would.
 *
 * The topic's own coverage is preferred and scored higher, but the pool is the
 * whole archive: a dossier with four articles to its name cannot give eight
 * moments a distinct picture out of four.
 *
 * Each result carries whether it is genuinely about that moment, because the
 * caption changes accordingly. An uncaptioned illustration beside a historical
 * entry reads as documentation of it.
 */
/**
 * How much shared subject a photograph needs before it may sit beside a
 * moment. Below this the moment shows no photograph, which is the correct
 * outcome: a dossier with fewer pictures is honest, one with a wrong picture
 * is not. Do not lower this to increase coverage.
 */
export const MIN_IMAGE_SCORE = 3;

/**
 * The year a milestone happened, when it is a real year. Some are deliberately
 * vague ("Çdo vit", "Në vijim") and those can never be date-matched.
 */
function milestoneYear(m) {
  const y = String(m?.year ?? "");
  return /^\d{4}$/.test(y) ? y : null;
}

function assignImages(milestones, articles, topic) {
  // Only this dossier's own coverage is eligible. The pool was previously the
  // whole archive, which is how a Bitcoin story became a picture of the 2013
  // NATO drawdown: an unrelated article needed only to share two filler words
  // to outscore the topic bonus.
  const pool = articlesForTopic(topic.slug, articles ?? []).filter((a) => a?.imageUrl);
  if (!pool.length) return new Map();

  const pairs = [];
  milestones.forEach((m, mi) => {
    const want = keywords(`${m.title} ${m.tag ?? ""} ${m.summary ?? ""}`);
    pool.forEach((art, ai) => {
      const have = keywords(`${art.title ?? ""} ${art.excerpt ?? ""}`);
      let score = 0;
      for (const w of want) if (have.has(w)) score += 1;
      pairs.push({ mi, ai, score });
    });
  });

  pairs.sort((x, y) => y.score - x.score || x.mi - y.mi || x.ai - y.ai);

  const out = new Map();
  const takenArticle = new Set();
  for (const { mi, ai, score } of pairs) {
    if (out.has(mi) || takenArticle.has(ai)) continue;
    // The floor. Without it the loop assigns every moment something as long as
    // the pool has anything left, so the tail of a dossier receives whatever
    // remains — which is exactly how this failed before.
    if (score < MIN_IMAGE_SCORE) continue;
    const art = pool[ai];

    // The event and the photograph must belong to the same year. This archive
    // begins in 2026 and nearly every milestone predates it, so in practice a
    // historical moment simply has no photograph here — which is the honest
    // result. Words alone cannot make a 2026 picture into a picture of 1999.
    const year = milestoneYear(milestones[mi]);
    if (!year) continue;
    if (String(art.publishedAt ?? "").slice(0, 4) !== year) continue;

    // No anonymous photographs: without a credit and a link back to the report
    // it came from, a reader has no way to check what they are looking at.
    if (!art.source || !art.slug) continue;

    out.set(mi, {
      imageUrl: art.imageUrl,
      imageCredit: art.source,
      imageSlug: art.slug,
    });
    takenArticle.add(ai);
  }
  return out;
}

/**
 * The dossier timeline: authored history oldest-first, then this archive's own
 * coverage, with the article being read marked in place so a reader can see
 * where today sits in the longer story.
 */
export function timelineFor(slug, articles, currentSlug, currentArticle) {
  const current = currentSlug ?? null;
  const topic = topicBySlug(slug);
  if (!topic) return [];

  const picked = assignImages(topic.milestones ?? [], articles, topic);

  const milestones = (topic.milestones ?? []).map((m, i) => ({
    kind: "milestone",
    id: "m:" + m.date + ":" + m.title,
    ...m,
    ...(picked.get(i) ?? {}),
  }));

  // The reader's own article, and nothing published after it.
  //
  // The page hands over the fifty most recent articles, so a reader on an
  // older story found their own piece missing from its own file. And because
  // the list is simply the newest fourteen, the account ran past the story
  // being read and ended on someone else's later report — a file that closes
  // after the page it is attached to reads as though the reader arrived late.
  //
  // Passing the article itself fixes both: it joins the pool whether or not
  // the fetch happened to include it, and it sets the point the account stops.
  const pool = articles ?? [];
  const withCurrent =
    currentArticle?.slug && !pool.some((a) => a?.slug === currentArticle.slug)
      ? [...pool, currentArticle]
      : pool;

  const cutoff = Date.parse(currentArticle?.publishedAt ?? "");
  const upToCurrent = (a) => {
    if (Number.isNaN(cutoff)) return true;
    if (a.slug === currentArticle.slug) return true;
    const at = Date.parse(a.publishedAt ?? "");
    return Number.isNaN(at) || at <= cutoff;
  };

  const recent = articlesForTopic(slug, withCurrent)
    .filter(upToCurrent)
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
