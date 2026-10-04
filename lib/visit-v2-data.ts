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
    // OSM node 2493088781 "Granični prelaz Kula", where the Pejë–Rožaje road
    // leaves Kosovo. The old point (42.657, 20.057) was ~18 km away inside
    // Montenegro, so reports from the real crossing failed the 1 km check.
    latitude: 42.80039,
    longitude: 20.22122,
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
  imageSourceUrl?: string;
  imageCredit?: string;
  imageLicense?: string;
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
      { name: "Katedralja Nënë Tereza", category: "Arkitekturë", description: "Katedralja katolike e Prishtinës, kushtuar Shën Nënë Terezës. Ngjitu në kambanore për pamjen më të gjerë mbi qytet.", visitHint: "30-45 min", mapsQuery: "Cathedral of Saint Mother Teresa Pristina", image: "/visit/places/prishtine-cathedral.webp", imageAlt: "Katedralja Nënë Tereza me kambanoren në Prishtinë", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Mother_Teresa_Cathedral3.jpg", imageCredit: "Arianit", imageLicense: "CC BY-SA 4.0" },
      { name: "Xhamia e Mbretit", category: "Histori", description: "E ndërtuar më 1461 nga Sulltan Mehmeti II, një nga ndërtesat osmane më të rëndësishme në Ballkan, pranë Kullës së Sahatit. Hyr jashtë kohës së faljes.", visitHint: "20-30 min", mapsQuery: "Imperial Mosque Pristina", image: "/visit/places/prishtine-imperial-mosque.webp", imageAlt: "Xhamia e Mbretit dhe Kulla e Sahatit në Prishtinë", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Sultan_Mehmet_Fatih_mosque_and_clock_tower.jpg", imageCredit: "Arianit Sahiti", imageLicense: "CC BY-SA 4.0" },
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
      { name: "Kalaja e Prizrenit", category: "Pamje", description: "Ngjitja e shkurtër shpërblehet me pamjen më të plotë mbi çatitë, Lumbardhin dhe Malet e Sharrit.", visitHint: "60-90 min", mapsQuery: "Prizren Fortress", image: "/visit/places/prizren-fortress-walls.webp", imageAlt: "Pamja mbi Prizren nga muret e Kalasë", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Prizren_Fortress_(Kalaja_e_Prizrenit).jpg", imageCredit: "Tom.whitehead337", imageLicense: "CC BY-SA 4.0" },
      { name: "Shadërvani", category: "Qendër", description: "Zemra e qytetit të vjetër, e rrethuar nga kafene, gurë të lëmuar dhe rrugica që zbulohen më mirë në këmbë.", visitHint: "45-90 min", mapsQuery: "Shadervan Prizren", image: "/visit/places/prizren-shadervan-fountain.webp", imageAlt: "Kroi i Shadërvanit në qendër të Prizrenit", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Kroi_i_Shatervanit.JPG", imageCredit: "Fissnik", imageLicense: "CC BY-SA 3.0" },
      { name: "Ura e Gurit", category: "Shëtitje", description: "Ura e vogël osmane lidh dy anët e qendrës dhe hap pamjen klasike drejt Kalasë dhe xhamisë.", visitHint: "20-30 min", mapsQuery: "Stone Bridge Prizren", image: "/visit/places/prizren-stone-bridge.webp", imageAlt: "Ura e Gurit mbi Lumbardh në Prizren" },
      { name: "Xhamia e Sinan Pashës", category: "Trashëgimi", description: "Monument i shekullit të shtatëmbëdhjetë me një brendësi të pasur. Hyr me respekt dhe kontrollo oraret e faljes.", visitHint: "25-40 min", mapsQuery: "Sinan Pasha Mosque Prizren", image: "/visit/places/prizren-sinan-pasha.webp", imageAlt: "Xhamia e Sinan Pashës në mbrëmje", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Sinan_Pasha_Mosque,_Prizren,_Kosovo.jpg", imageCredit: "Ravi Dwivedi", imageLicense: "CC BY-SA 4.0" },
      { name: "Lidhja e Prizrenit", category: "Histori", description: "Kompleksi muzeal shpjegon një moment themelor të organizimit politik e kulturor shqiptar në fund të shekullit të nëntëmbëdhjetë.", visitHint: "45-60 min", mapsQuery: "Albanian League of Prizren Museum", image: "/visit/places/prizren-league.webp", imageAlt: "Kompleksi i Lidhjes së Prizrenit" },
      { name: "Hamami i Gazi Mehmet Pashës", category: "Trashëgimi", description: "Hamam osman me kupola në qendër të qytetit të vjetër, i ndërtuar si \"çifte hamam\" me pjesë për burra e për gra.", visitHint: "25-40 min", mapsQuery: "Gazi Mehmed Pasha Hamam Prizren", image: "/visit/places/prizren-hamam.webp", imageAlt: "Kupolat e Hamamit të Gazi Mehmet Pashës në Prizren", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Stari_amam_u_Prizrenu.jpg", imageCredit: "Vladimir Vukotic", imageLicense: "CC BY-SA 3.0" },
      { name: "Kisha e Shën Premtes", category: "Trashëgimi", description: "Kishë e shekullit XIV me afreske, pjesë e trashëgimisë botërore të UNESCO-s. Shpesh shihet nga jashtë; pyet për orarin para se të shkosh.", visitHint: "20-30 min", mapsQuery: "Our Lady of Ljevis Prizren", image: "/visit/places/prizren-shen-premte.webp", imageAlt: "Kisha e Shën Premtes mes çative të Prizrenit", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Our_Lady_of_Ljevi%C5%A1,_Prizren,_2010._View_from_clock_tower.jpg", imageCredit: "Photo Balkan", imageLicense: "CC BY-SA 3.0" },
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
      { name: "Patrikana e Pejës", category: "Trashëgimi", description: "Kompleks mesjetar pranë hyrjes së Rugovës, i njohur për kishat, afresket dhe oborrin e qetë. Merr dokument identifikimi.", visitHint: "45-75 min", mapsQuery: "Patriarchate of Peja Kosovo", image: "/visit/places/peje-patriarchate.webp", imageAlt: "Patrikana e Pejës pranë hyrjes së Grykës së Rugovës", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Patriarchate_of_Pe%C4%87_Monastery_in_Kosovo_2.jpg", imageCredit: "Quinn Dombrowski", imageLicense: "CC BY-SA 2.0" },
      { name: "Burimi i Drinit të Bardhë", category: "Ujëvarë", description: "Një dalje e lehtë nga Peja drejt ujëvarës dhe burimit në Radavc, e përshtatshme për një gjysmë dite.", visitHint: "2-3 orë", mapsQuery: "White Drin Waterfall Radavc Kosovo", image: "/visit/places/peje-white-drin.webp", imageAlt: "Ujëvara e Drinit të Bardhë në Radavc", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Radavac_2018.jpg", imageCredit: "Fjolle Ramadani", imageLicense: "CC BY-SA 4.0" },
      { name: "Muzeu i Pejës", category: "Kulturë", description: "Një ndalesë e vogël në qytet për objekte etnografike dhe historinë e rajonit para se të vazhdosh drejt maleve.", visitHint: "35-50 min", mapsQuery: "Peja Museum Kosovo", image: "/visit/places/peje-museum.webp", imageAlt: "Ndërtesa e Muzeut Rajonal të Pejës", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Regional_Museum-_Ethnological_sector-_Pej%C3%AB.jpg", imageCredit: "Arianselmani", imageLicense: "CC BY-SA 3.0" },
      { name: "Xhamia e Bajraklisë", category: "Histori", description: "Xhamia kryesore e Çarshisë, e ndërtuar më 1471, me kupolën më të vjetër e më të lartë të qytetit. Ndalesë e natyrshme gjatë shëtitjes në Çarshi.", visitHint: "15-25 min", mapsQuery: "Bajrakli Mosque Peja", image: "/visit/places/peje-bajrakli.webp", imageAlt: "Xhamia e Bajraklisë në qendër të Çarshisë së Pejës", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Bajrakli_Mosque,_Peja_1.jpg", imageCredit: "Arianit", imageLicense: "CC BY-SA 4.0" },
      { name: "Maja e Hajlës", category: "Mal", description: "Mali në kufi me Malin e Zi, me maja mbi 2.400 metra mbi Grykën e Rugovës. Shteg për një ditë të plotë; nisu herët, vetëm në verë, me këpucë mali dhe qëndro në shtigjet e shënuara.", visitHint: "5-7 orë", mapsQuery: "Hajla Rugova", image: "/visit/places/peje-hajla.webp", imageAlt: "Livadhi në anën jugore të Hajlës", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Peaks_of_the_Balkans_-_97_(25019631228).jpg", imageCredit: "Bruno Rijsman", imageLicense: "CC BY 2.0" },
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
      { name: "Xhamia e Hadumit", category: "Trashëgimi", description: "Xhamia e shekullit të gjashtëmbëdhjetë formon bërthamën historike të çarshisë dhe ruan dekorim të pasur të brendshëm.", visitHint: "25-40 min", mapsQuery: "Hadum Mosque Gjakova", image: "/visit/places/gjakove-hadum-mosque.webp", imageAlt: "Xhamia e Hadumit mbi çatitë e Çarshisë së Madhe", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Gjakova_-_%C3%87arshia_e_Madhe_-_Big_Baazar_Panorama.JPG", imageCredit: "Shkëlzen Rexha (Valed Promotion)", imageLicense: "CC BY-SA 3.0" },
      { name: "Muzeu Etnografik", category: "Kulturë", description: "Një shtëpi tradicionale që mbledh veshje, mjete dhe ambiente të jetës familjare të zonës së Gjakovës.", visitHint: "40-60 min", mapsQuery: "Ethnographic Museum Gjakova", image: "/visit/places/gjakove-museum.webp", imageAlt: "Fasada e Muzeut Etnografik të Gjakovës", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Ethnographical_Museum_Gjakova_1_(OSCAL19_trip).jpg", imageCredit: "albinfo", imageLicense: "CC0" },
      { name: "Kulla e Sahatit", category: "Arkitekturë", description: "Pikë orientimi në qendrën e vjetër dhe një ndalesë e mirë për ta kuptuar ritmin tregtar të qytetit.", visitHint: "20-30 min", mapsQuery: "Clock Tower Gjakova Kosovo", image: "/visit/places/gjakove-clock-tower.webp", imageAlt: "Kulla e Sahatit në Gjakovë", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Clock_Tower_of_Gjakova.jpg", imageCredit: "Irvi Hyka", imageLicense: "CC BY-SA 3.0" },
      { name: "Ujëvarat e Mirushës", category: "Ekskursion", description: "Një varg kanionesh dhe ujëvarash jashtë qytetit. Shko me këpucë të mira dhe shmang shtigjet e rrëshqitshme pas shiut.", visitHint: "3-5 orë", mapsQuery: "Mirusha Waterfalls Kosovo", image: "/visit/places/gjakove-mirusha.webp", imageAlt: "Një nga ujëvarat e Mirushës", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Mirusha_waterfall,_Kline,_Kosovo._By_Musli_Berisha-miber.jpg", imageCredit: "Musli Berisha", imageLicense: "CC BY-SA 4.0" },
      { name: "Ura e Terzive", category: "Trashëgimi", description: "Urë osmane me harqe mbi lumin Erenik, pranë Bishtazhinit, e lidhur me esnafin e rrobaqepësve të Gjakovës. E bukur në dritën e pasdites.", visitHint: "30-45 min", mapsQuery: "Terzi Bridge Gjakova", image: "/visit/places/gjakove-terzi-bridge.webp", imageAlt: "Ura e Terzive mbi lumin Erenik", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Ura_e_Terzive_-_Gjakov%C3%AB.jpg", imageCredit: "Agonsta24", imageLicense: "CC BY-SA 4.0" },
      { name: "Teqja e Madhe", category: "Trashëgimi", description: "Teqeja e tarikatit Saadi pranë Çarshisë, e njohur si më e vjetra e këtij urdhri në Ballkan. Oborr i qetë; hyr me respekt.", visitHint: "20-30 min", mapsQuery: "Teqja e Madhe Gjakove", image: "/visit/places/gjakove-great-tekke.webp", imageAlt: "Teqja e Madhe në Gjakovë", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Teqja_e_Madhe_Gjakove2.jpg", imageCredit: "Arianit", imageLicense: "CC BY-SA 4.0" },
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
      { name: "Liqeni Akumulues", category: "Shëtitje", description: "Liqen artificial në shtratin e Ibrit, i ndërtuar më 2016–17, me shëtitore, shtigje vrapimi dhe urë të bardhë për këmbësorë, pak jashtë qendrës.", visitHint: "60-120 min", mapsQuery: "Mitrovica Artificial Lake Kosovo", image: "/visit/places/mitrovice-lake.webp", imageAlt: "Liqeni Akumulues dhe ura e bardhë në Mitrovicë" },
      { name: "Ura mbi Ibër", category: "Qytet", description: "Një pikë qendrore e jetës dhe historisë së sotme të qytetit. Vizitoje me vëmendje ndaj udhëzimeve lokale.", visitHint: "25-40 min", mapsQuery: "Ibar Bridge Mitrovica Kosovo", image: "/visit/places/mitrovice-new-bridge.webp", imageAlt: "Ura e re mbi lumin Ibër në Mitrovicë" },
      { name: "Liqeni i Ujmanit", category: "Ekskursion", description: "Liqeni i madh i Ujmanit (Gazivodës) mes kodrave të Zubin Potokut. Kontrollo gjendjen para nisjes: qeveria britanike paralajmëron për rrezik protestash në komunat veriore.", visitHint: "3-5 orë", mapsQuery: "Ujman Gazivoda Lake Kosovo", image: "/visit/places/mitrovice-ujman.webp", imageAlt: "Liqeni i Ujmanit i parë nga ajri", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Ujemani_or_Gazivoda_Lake_as_seen_from_the_Air.jpg", imageCredit: "SUHEJLO", imageLicense: "CC BY 4.0" },
      { name: "Kalaja e Vushtrrisë", category: "Histori", description: "Kala mesjetare në mes të Vushtrrisë, rreth 11 km nga Mitrovica. Kombinoje me urën e vjetër të gurit në afërsi.", visitHint: "20-40 min", mapsQuery: "Vushtrri Castle", image: "/visit/places/mitrovice-vushtrri-fortress.webp", imageAlt: "Muret e Kalasë së Vushtrrisë", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Kulla_e_Vjet%C3%ABr,_Vushtrri_-_2.jpg", imageCredit: "Mrinë Godanca", imageLicense: "CC BY-SA 4.0" },
      { name: "Kalaja e Zveçanit", category: "Pamje", description: "Një nga kështjellat më të vjetra të Evropës Juglindore, mbi një vullkan të shuar pranë Ibrit. Ngjitja është e pjerrët; pamja e shpërblen.", visitHint: "1-2 orë", mapsQuery: "Zvecan Fortress", image: "/visit/places/mitrovice-zvecan.webp", imageAlt: "Kalaja e Zveçanit mbi kodrën shkëmbore", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Zvecan_27.jpg", imageCredit: "Geograf208", imageLicense: "CC BY-SA 4.0" },
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
      { name: "Xhamia e Madhe", category: "Trashëgimi", description: "Një pikë e njohur e qendrës së Gjilanit dhe ndalesë e shkurtër për arkitekturën e qytetit. Hyr me respekt dhe kontrollo oraret e faljes.", visitHint: "20-35 min", mapsQuery: "Xhamia e Madhe Gjilan Kosovo", image: "/visit/places/gjilan-great-mosque.webp", imageAlt: "Xhamia e Madhe në Gjilan", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Xhamia_e_Madhe_n%C3%AB_Gjilan.jpg", imageCredit: "Endrit.mstf", imageLicense: "CC BY-SA 4.0" },
      { name: "Liqeni i Livoçit", category: "Natyrë", description: "Një dalje e qetë pranë Gjilanit për peizazh dhe ajër të pastër. Merr ujë dhe mos u mbështet në shërbime në vend.", visitHint: "2-3 orë", mapsQuery: "Livoc Lake Gjilan Kosovo", image: "/visit/places/gjilan-livoc.webp", imageAlt: "Liqeni i Livoçit i parë nga ajri", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Liqeni_i_Livoqit_-_pamje_nga_droni.jpg", imageCredit: "Xhemstar", imageLicense: "CC BY-SA 4.0" },
      { name: "Banjat e Kllokotit", category: "Ekskursion", description: "Qendër termale me ujëra minerale të ngrohta, rreth 12 km nga Gjilani. Merr rroba banje dhe pyet për pishinat e hapura.", visitHint: "2-3 orë", mapsQuery: "Banja e Kllokotit", image: "/visit/places/gjilan-kllokot-spa.webp", imageAlt: "Ndërtesa e Banjës së Kllokotit", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Banja_e_Kllokotit.jpg", imageCredit: "Berishasinan", imageLicense: "CC BY-SA 4.0" },
      { name: "Kisha e Letnicës", category: "Trashëgimi", description: "Kisha e Zojës së Zezë në Letnicë të Vitisë, vend pelegrinazhi me një statujë druri afro 400-vjeçare. Ndërtesa e sotme u ngrit më 1928-1934.", visitHint: "45-60 min", mapsQuery: "Letnica church Viti Kosovo", image: "/visit/places/gjilan-letnica.webp", imageAlt: "Kisha e Zojës së Zezë në Letnicë", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Catholic_church_in_Letnic%C3%AB.jpg", imageCredit: "Bujar Imer Gashi", imageLicense: "CC BY-SA 3.0" },
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
      { name: "Muralet e Qytetit", category: "Art", description: "Që nga viti 2016 kolektivi MuralFest Kosova ka sjellë artistë nga e gjithë bota dhe Ferizaj ka sot rreth 150 murale. Ec nëpër qendër dhe gjeji pa rrugë të caktuar.", visitHint: "60-90 min", mapsQuery: "MuralFest Ferizaj Kosovo", image: "/visit/places/ferizaj-mural.webp", imageAlt: "Mural në stacionin e Ferizajt" },
      { name: "Bifurkacioni i Nerodimes", category: "Natyrë", description: "Fenomeni gjeografik ku rrjedha ndahet drejt dy pellgjeve detare është një dalje e veçantë pranë qytetit.", visitHint: "1-2 orë", mapsQuery: "Nerodime Bifurcation Kosovo", image: "/visit/places/ferizaj-nerodime.webp", imageAlt: "Bifurkacioni i lumit Nerodime", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Nerodime_bifurcation.jpg", imageCredit: "Ottis", imageLicense: "CC BY-SA 4.0" },
      { name: "Brezovicë", category: "Mal", description: "Qendra malore e Sharrit ofron ski në dimër dhe dalje në natyrë gjatë stinëve të tjera. Kontrollo motin dhe qasjen.", visitHint: "Gjysmë dite", mapsQuery: "Brezovica Kosovo", image: "/visit/places/ferizaj-brezovica.webp", imageAlt: "Qendra e skijimit në Brezovicë" },
      { name: "Gryka e Kaçanikut", category: "Natyrë", description: "Gryka mes Kaçanikut dhe kufirit, ku Lepenci ndan Malet e Sharrit nga Karadaku. Ndalo në pikat e shikimit gjatë rrugës drejt jugut.", visitHint: "1-2 orë", mapsQuery: "Kacanik Gorge Kosovo", image: "/visit/places/ferizaj-kacanik-gorge.webp", imageAlt: "Gryka e Kaçanikut pranë Hanit të Elezit", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Elezhan_B%C3%B6lgesi,_Kosova.JPG", imageCredit: "Photo Balkan", imageLicense: "CC BY-SA 3.0" },
      { name: "Liqeni i Jazhincës", category: "Mal", description: "Liqen malor në 2.180 metra në Malet e Sharrit, nën majën e Peskovit. Shteg i gjatë nga zona e Brezovicës; vetëm në verë dhe në shtigjet e shënuara.", visitHint: "4-6 orë", mapsQuery: "Jazhince Lake Sharr Kosovo", image: "/visit/places/ferizaj-jazhince.webp", imageAlt: "Liqeni i Jazhincës në Malet e Sharrit", imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Jazhinc%C3%AB_Lake.jpg", imageCredit: "Arianit", imageLicense: "CC BY-SA 4.0" },
    ],
  },
] as const;

export const VISIT_SOURCE_REVIEWED_AT = "2026-08-15";
