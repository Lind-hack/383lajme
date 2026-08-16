export type BorderCrossingId = "kulle" | "merdare" | "hani-i-elezit" | "vermice-morine";

export type BorderDirection = "entry" | "exit";

export type BorderCrossing = {
  id: BorderCrossingId;
  name: string;
  officialName: string;
  otherSide: string;
  country: string;
  latitude: number;
  longitude: number;
};

export const BORDER_CROSSINGS: readonly BorderCrossing[] = [
  {
    id: "kulle",
    name: "Kullë",
    officialName: "Kullë",
    otherSide: "Kula",
    country: "Mali i Zi",
    latitude: 42.657,
    longitude: 20.057,
  },
  {
    id: "merdare",
    name: "Merdarë",
    officialName: "Merdarë",
    otherSide: "Merdare",
    country: "Serbi",
    latitude: 42.936998,
    longitude: 21.242724,
  },
  {
    id: "hani-i-elezit",
    name: "Hani i Elezit",
    officialName: "Hani i Elezit",
    otherSide: "Blace",
    country: "Maqedoni e Veriut",
    latitude: 42.142296,
    longitude: 21.302479,
  },
  {
    id: "vermice-morine",
    name: "Vërmicë / Morinë",
    officialName: "Vërmicë",
    otherSide: "Morinë",
    country: "Shqipëri",
    latitude: 42.1538,
    longitude: 20.5505,
  },
] as const;

export const EMERGENCY_NUMBERS = [
  { label: "Urgjenca", number: "112", note: "Numri i përgjithshëm emergjent" },
  { label: "Policia", number: "192", note: "Policia e Kosovës" },
  { label: "Zjarrfikësit", number: "193", note: "Zjarr dhe shpëtim" },
  { label: "Ambulanca", number: "194", note: "Ndihmë mjekësore urgjente" },
] as const;

export type CityId =
  | "prishtine"
  | "prizren"
  | "peje"
  | "gjakove"
  | "mitrovice"
  | "gjilan"
  | "ferizaj";

export type CityPlace = {
  name: string;
  category: string;
  description: string;
  visitHint: string;
  mapsQuery: string;
  image: string;
  imageAlt: string;
};

export type KosovoCity = {
  id: CityId;
  name: string;
  region: string;
  tagline: string;
  palette: "sky" | "sun" | "pine" | "coral" | "river" | "plum" | "lime";
  sourceName: string;
  sourceUrl: string;
  places: readonly CityPlace[];
};

export const KOSOVO_CITIES: readonly KosovoCity[] = [
  {
    id: "prishtine",
    name: "Prishtinë",
    region: "Rajoni i Prishtinës",
    tagline: "Arkitekturë e guximshme, kafe dhe ritëm urban.",
    palette: "sky",
    sourceName: "Kosovo Tourism Strategy 2024-2030",
    sourceUrl: "https://kryeministri.rks-gov.net/wp-content/uploads/2024/07/Tourism-Strategy-2024-2030.pdf",
    places: [
      { name: "Biblioteka Kombëtare", category: "Arkitekturë", description: "Një nga ndërtesat moderniste më të dallueshme të Prishtinës, me kupola dhe rrjetë metalike që nuk ngatërrohet me asgjë tjetër.", visitHint: "30-45 min", mapsQuery: "National Library of Kosovo Prishtina", image: "/visit/places/prishtine-library.webp", imageAlt: "Biblioteka Kombëtare e Kosovës në Prishtinë" },
      { name: "Monumenti NEWBORN", category: "Qytet", description: "Shenja publike e pavarësisë ndryshon pamje me kalimin e kohës dhe është një ndalesë e shpejtë pranë qendrës.", visitHint: "15-25 min", mapsQuery: "NEWBORN Monument Prishtina", image: "/visit/places/prishtine-newborn.webp", imageAlt: "Monumenti NEWBORN në Prishtinë" },
      { name: "Parku i Gërmisë", category: "Natyrë", description: "Hapësira më e dashur e qytetit për ecje, biçikletë dhe ajër të pastër, vetëm pak minuta nga qendra.", visitHint: "1-3 orë", mapsQuery: "Germia Park Prishtina", image: "/visit/places/prishtine-germia.webp", imageAlt: "Shtigje dhe gjelbërim në Parkun e Gërmisë" },
      { name: "Muzeu Kombëtar", category: "Histori", description: "Një hyrje kompakte në arkeologjinë, historinë dhe kulturën materiale të Kosovës në një ndërtesë të periudhës austro-hungareze.", visitHint: "45-75 min", mapsQuery: "Kosovo Museum Prishtina", image: "/visit/places/prishtine-museum.webp", imageAlt: "Ndërtesa e Muzeut Kombëtar të Kosovës" },
      { name: "Muzeu Etnologjik", category: "Trashëgimi", description: "Kompleksi Emin Gjiku ruan ambiente shtëpie, veshje dhe objekte që tregojnë jetën qytetare të Kosovës ndër breza.", visitHint: "45-60 min", mapsQuery: "Ethnological Museum Prishtina", image: "/visit/places/prishtine-ethnological.webp", imageAlt: "Oborri i Muzeut Etnologjik në Prishtinë" },
    ],
  },
  {
    id: "prizren",
    name: "Prizren",
    region: "Rajoni i Prizrenit",
    tagline: "Gur, lumë dhe një mbrëmje nën Kala.",
    palette: "sun",
    sourceName: "Visit Prizren",
    sourceUrl: "https://visit-prizren.com/en/",
    places: [
      { name: "Kalaja e Prizrenit", category: "Pamje", description: "Ngjitja e shkurtër shpërblehet me pamjen më të plotë mbi çatitë, Lumbardhin dhe Malet e Sharrit.", visitHint: "60-90 min", mapsQuery: "Prizren Fortress", image: "/visit/places/prizren-fortress.webp", imageAlt: "Pamje e Prizrenit dhe Kalasë" },
      { name: "Shadërvani", category: "Qendër", description: "Zemra e qytetit të vjetër, e rrethuar nga kafene, gurë të lëmuar dhe rrugica që zbulohen më mirë në këmbë.", visitHint: "45-90 min", mapsQuery: "Shadervan Prizren", image: "/visit/places/prizren-shadervan.webp", imageAlt: "Qendra historike e Prizrenit pranë Shadërvanit" },
      { name: "Ura e Gurit", category: "Shëtitje", description: "Ura e vogël osmane lidh dy anët e qendrës dhe hap pamjen klasike drejt Kalasë dhe xhamisë.", visitHint: "20-30 min", mapsQuery: "Stone Bridge Prizren", image: "/visit/places/prizren-stone-bridge.webp", imageAlt: "Ura e Gurit mbi Lumbardh në Prizren" },
      { name: "Xhamia e Sinan Pashës", category: "Trashëgimi", description: "Monument i shekullit të shtatëmbëdhjetë me një brendësi të pasur. Hyr me respekt dhe kontrollo oraret e faljes.", visitHint: "25-40 min", mapsQuery: "Sinan Pasha Mosque Prizren", image: "/visit/places/prizren-sinan.webp", imageAlt: "Xhamia e Sinan Pashës në peizazhin e Prizrenit" },
      { name: "Lidhja e Prizrenit", category: "Histori", description: "Kompleksi muzeal shpjegon një moment themelor të organizimit politik e kulturor shqiptar në fund të shekullit të nëntëmbëdhjetë.", visitHint: "45-60 min", mapsQuery: "Albanian League of Prizren Museum", image: "/visit/places/prizren-league.webp", imageAlt: "Kompleksi i Lidhjes së Prizrenit" },
    ],
  },
  {
    id: "peje",
    name: "Pejë",
    region: "Rrafshi i Dukagjinit",
    tagline: "Qyteti ku mali nis menjëherë.",
    palette: "pine",
    sourceName: "Kosovo Tourism Strategy 2024-2030",
    sourceUrl: "https://kryeministri.rks-gov.net/wp-content/uploads/2024/07/Tourism-Strategy-2024-2030.pdf",
    places: [
      { name: "Gryka e Rugovës", category: "Natyrë", description: "Kanioni nis menjëherë pas qytetit dhe të çon drejt shtigjeve, fshatrave dhe pamjeve dramatike të Bjeshkëve të Nemuna.", visitHint: "2-5 orë", mapsQuery: "Rugova Canyon Kosovo", image: "/visit/places/peje-rugova.webp", imageAlt: "Rruga malore në Grykën e Rugovës" },
      { name: "Çarshia e Pejës", category: "Qytet", description: "Një shëtitje mes dyqaneve të vogla, argjendarive dhe kafeneve, me malet që shfaqen në fund të rrugës.", visitHint: "45-90 min", mapsQuery: "Peja Old Bazaar", image: "/visit/places/peje-market-day.webp", imageAlt: "Rruga e Çarshisë së Pejës" },
      { name: "Patrikana e Pejës", category: "Trashëgimi", description: "Kompleks mesjetar pranë hyrjes së Rugovës, i njohur për kishat, afresket dhe oborrin e qetë. Merr dokument identifikimi.", visitHint: "45-75 min", mapsQuery: "Patriarchate of Peja Kosovo", image: "/visit/places/peje-city.webp", imageAlt: "Peja dhe peizazhi malor përreth" },
      { name: "Burimi i Drinit të Bardhë", category: "Ujëvarë", description: "Një dalje e lehtë nga Peja drejt ujëvarës dhe burimit në Radavc, e përshtatshme për një gjysmë dite.", visitHint: "2-3 orë", mapsQuery: "White Drin Waterfall Radavc Kosovo", image: "/visit/places/peje-square.webp", imageAlt: "Peizazh i Pejës pranë maleve" },
      { name: "Muzeu i Pejës", category: "Kulturë", description: "Një ndalesë e vogël në qytet për objekte etnografike dhe historinë e rajonit para se të vazhdosh drejt maleve.", visitHint: "35-50 min", mapsQuery: "Peja Museum Kosovo", image: "/visit/places/peje-market-evening.webp", imageAlt: "Çarshia e Pejës në mbrëmje" },
    ],
  },
  {
    id: "gjakove",
    name: "Gjakovë",
    region: "Rrafshi i Dukagjinit",
    tagline: "Çarshi, zeje dhe oborre me histori.",
    palette: "coral",
    sourceName: "Kosovo Tourism Strategy 2024-2030",
    sourceUrl: "https://kryeministri.rks-gov.net/wp-content/uploads/2024/07/Tourism-Strategy-2024-2030.pdf",
    places: [
      { name: "Çarshia e Madhe", category: "Shëtitje", description: "Një nga çarshitë më të gjata në Ballkan, me rrugë me kalldrëm, dyqane druri, kafene dhe punishte artizanale.", visitHint: "1-2 orë", mapsQuery: "Grand Bazaar Gjakova", image: "/visit/places/gjakove-bazaar-winter.webp", imageAlt: "Dyqanet tradicionale në Çarshinë e Madhe të Gjakovës" },
      { name: "Xhamia e Hadumit", category: "Trashëgimi", description: "Xhamia e shekullit të gjashtëmbëdhjetë formon bërthamën historike të çarshisë dhe ruan dekorim të pasur të brendshëm.", visitHint: "25-40 min", mapsQuery: "Hadum Mosque Gjakova", image: "/visit/places/gjakove-bazaar-shops.webp", imageAlt: "Çarshia e Gjakovës me minaren e Xhamisë së Hadumit" },
      { name: "Muzeu Etnografik", category: "Kulturë", description: "Një shtëpi tradicionale që mbledh veshje, mjete dhe ambiente të jetës familjare të zonës së Gjakovës.", visitHint: "40-60 min", mapsQuery: "Ethnographic Museum Gjakova", image: "/visit/places/gjakove-bazaar-cobbles.webp", imageAlt: "Kalldrëmi dhe dyqanet historike të Gjakovës" },
      { name: "Kulla e Sahatit", category: "Arkitekturë", description: "Pikë orientimi në qendrën e vjetër dhe një ndalesë e mirë për ta kuptuar ritmin tregtar të qytetit.", visitHint: "20-30 min", mapsQuery: "Clock Tower Gjakova Kosovo", image: "/visit/places/gjakove-bazaar-shops.webp", imageAlt: "Arkitektura e çarshisë së Gjakovës" },
      { name: "Ujëvarat e Mirushës", category: "Ekskursion", description: "Një varg kanionesh dhe ujëvarash jashtë qytetit. Shko me këpucë të mira dhe shmang shtigjet e rrëshqitshme pas shiut.", visitHint: "3-5 orë", mapsQuery: "Mirusha Waterfalls Kosovo", image: "/visit/places/gjakove-bazaar-winter.webp", imageAlt: "Peizazh i rajonit të Gjakovës" },
    ],
  },
  {
    id: "mitrovice",
    name: "Mitrovicë",
    region: "Rajoni i Mitrovicës",
    tagline: "Industri, muzikë dhe lumenj.",
    palette: "river",
    sourceName: "Kosovo Tourism Strategy 2024-2030",
    sourceUrl: "https://kryeministri.rks-gov.net/wp-content/uploads/2024/07/Tourism-Strategy-2024-2030.pdf",
    places: [
      { name: "Monumenti i Minatorëve", category: "Arkitekturë", description: "Monumenti brutalist mbi qytet nderon minatorët dhe ofron një nga pamjet më të forta të Mitrovicës.", visitHint: "45-75 min", mapsQuery: "Miners Monument Mitrovica Kosovo", image: "/visit/places/mitrovice-miners-web.webp", imageAlt: "Monumenti i Minatorëve në Mitrovicë" },
      { name: "Muzeu i Kristaleve", category: "Gjeologji", description: "Koleksioni i Trepçës tregon mineralet dhe kristalet që e formësuan historinë industriale të rajonit.", visitHint: "60-90 min", mapsQuery: "Trepca Crystal Museum Kosovo", image: "/visit/places/mitrovice-crystals-web.webp", imageAlt: "Kristale të ekspozuara nga miniera e Trepçës" },
      { name: "Liqeni Akumulues", category: "Shëtitje", description: "Promenadë e qetë me urë të bardhë, hapësira për familje dhe një pamje të gjelbër pak larg qendrës.", visitHint: "60-120 min", mapsQuery: "Mitrovica Artificial Lake Kosovo", image: "/visit/places/mitrovice-lake.webp", imageAlt: "Liqeni Akumulues dhe ura e bardhë në Mitrovicë" },
      { name: "Ura mbi Ibër", category: "Qytet", description: "Një pikë qendrore e jetës dhe historisë së sotme të qytetit. Vizitoje me vëmendje ndaj udhëzimeve lokale.", visitHint: "25-40 min", mapsQuery: "Ibar Bridge Mitrovica Kosovo", image: "/visit/places/mitrovice-new-bridge.webp", imageAlt: "Ura e re mbi lumin Ibër në Mitrovicë" },
      { name: "Liqeni i Ujmanit", category: "Ekskursion", description: "Një dalje panoramike drejt ujit dhe kodrave në veri të rajonit. Kontrollo rrugën dhe kushtet lokale para nisjes.", visitHint: "3-5 orë", mapsQuery: "Gazivoda Lake Kosovo", image: "/visit/places/mitrovice-lake.webp", imageAlt: "Peizazh ujor në rajonin e Mitrovicës" },
    ],
  },
  {
    id: "gjilan",
    name: "Gjilan",
    region: "Anamoravë",
    tagline: "Shesh i gjallë dhe dalje drejt fortesave të lindjes.",
    palette: "plum",
    sourceName: "Tourism Sector, Ministry of Industry",
    sourceUrl: "https://mik.rks-gov.net/tourism-sector/",
    places: [
      { name: "Sheshi i Qytetit", category: "Qendër", description: "Nisja më e lehtë për të kuptuar ritmin lokal, me kafene, shëtitore dhe aktivitet qytetar gjatë gjithë ditës.", visitHint: "45-90 min", mapsQuery: "Gjilan City Center Kosovo", image: "/visit/places/gjilan-center.webp", imageAlt: "Sheshi dhe qendra e Gjilanit" },
      { name: "Kalaja e Novobërdës", category: "Histori", description: "Fortesa mesjetare ngrihet mbi kodrat e Anamoravës dhe ruan gjurmët e një qendre të rëndësishme minerare.", visitHint: "2-3 orë", mapsQuery: "Novo Brdo Fortress Kosovo", image: "/visit/places/gjilan-novoberde.webp", imageAlt: "Muret e Kalasë së Novobërdës" },
      { name: "Teatri i Gjilanit", category: "Kulturë", description: "Skena kryesore e qytetit për teatër dhe ngjarje kulturore. Kontrollo programin para se të shkosh.", visitHint: "Sipas programit", mapsQuery: "Gjilan City Theatre Kosovo", image: "/visit/places/gjilan-theatre.webp", imageAlt: "Teatri i Qytetit të Gjilanit" },
      { name: "Parku i Qytetit", category: "Pushim", description: "Hapësirë e gjelbër pranë qendrës për një pauzë të lehtë mes shëtitjes dhe kafeneve.", visitHint: "30-60 min", mapsQuery: "City Park Gjilan Kosovo", image: "/visit/places/gjilan-center.webp", imageAlt: "Qendra e gjelbër e Gjilanit" },
      { name: "Liqeni i Përlepnicës", category: "Natyrë", description: "Një dalje e qetë jashtë qytetit për peizazh dhe ajër të pastër. Merr ujë dhe mos u mbështet në shërbime në vend.", visitHint: "2-3 orë", mapsQuery: "Perlepnica Lake Kosovo", image: "/visit/places/gjilan-night.webp", imageAlt: "Pamje e mbrëmjes në rajonin e Gjilanit" },
    ],
  },
  {
    id: "ferizaj",
    name: "Ferizaj",
    region: "Rajoni i Ferizajt",
    tagline: "Qytet i gjallë mes Sharrit dhe fushës.",
    palette: "lime",
    sourceName: "Kosovo Tourism Strategy 2024-2030",
    sourceUrl: "https://kryeministri.rks-gov.net/wp-content/uploads/2024/07/Tourism-Strategy-2024-2030.pdf",
    places: [
      { name: "Kisha dhe Xhamia", category: "Qendër", description: "Dy objekte kulti pranë njëra-tjetrës formojnë pamjen më të njohur të Ferizajt dhe tregojnë historinë e përbashkët të qendrës.", visitHint: "30-45 min", mapsQuery: "Church and Mosque Ferizaj Kosovo", image: "/visit/places/ferizaj-faith.webp", imageAlt: "Kisha dhe xhamia pranë njëra-tjetrës në Ferizaj" },
      { name: "Stacioni i Vjetër", category: "Histori", description: "Ndërtesa e hekurudhës lidhet drejtpërdrejt me lindjen e qytetit modern dhe sot mban edhe art mural.", visitHint: "25-40 min", mapsQuery: "Old Train Station Ferizaj Kosovo", image: "/visit/places/ferizaj-station.webp", imageAlt: "Stacioni historik i trenit në Ferizaj" },
      { name: "Muralet e Qytetit", category: "Art", description: "MuralFest ka kthyer fasada dhe hapësira publike në një galeri të hapur. Ec në qendër dhe zbuloji pa itinerar të ngurtë.", visitHint: "60-90 min", mapsQuery: "MuralFest Ferizaj Kosovo", image: "/visit/places/ferizaj-mural.webp", imageAlt: "Mural në stacionin e Ferizajt" },
      { name: "Bifurkacioni i Nerodimes", category: "Natyrë", description: "Fenomeni gjeografik ku rrjedha ndahet drejt dy pellgjeve detare është një dalje e veçantë pranë qytetit.", visitHint: "1-2 orë", mapsQuery: "Nerodime Bifurcation Kosovo", image: "/visit/places/ferizaj-station.webp", imageAlt: "Peizazh pranë rajonit të Ferizajt" },
      { name: "Brezovicë", category: "Mal", description: "Qendra malore e Sharrit ofron ski në dimër dhe dalje në natyrë gjatë stinëve të tjera. Kontrollo motin dhe qasjen.", visitHint: "Gjysmë dite", mapsQuery: "Brezovica Kosovo", image: "/visit/places/ferizaj-brezovica.webp", imageAlt: "Qendra e skijimit në Brezovicë" },
    ],
  },
] as const;

export const VISIT_SOURCE_REVIEWED_AT = "2026-08-15";
