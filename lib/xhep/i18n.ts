/**
 * Kosova në xhep speaks English first (foreign visitors) with a one-tap
 * switch to Albanian (diaspora families). One typed dictionary: a key missing
 * from either language fails the typecheck instead of rendering blank.
 *
 * Resolution order: ?lang= in the URL, then the xhep_lang cookie, then EN.
 */

export const XHEP_LANGS = ["en", "sq"] as const;
export type XhepLang = (typeof XHEP_LANGS)[number];
export const XHEP_DEFAULT_LANG: XhepLang = "en";
export const XHEP_LANG_COOKIE = "xhep_lang";

export function isXhepLang(value: unknown): value is XhepLang {
  return typeof value === "string" && (XHEP_LANGS as readonly string[]).includes(value);
}

export function resolveXhepLang(param: unknown, cookie: unknown): XhepLang {
  const fromParam = Array.isArray(param) ? param[0] : param;
  if (isXhepLang(fromParam)) return fromParam;
  if (isXhepLang(cookie)) return cookie;
  return XHEP_DEFAULT_LANG;
}

type CrossingId = "kulle" | "merdare" | "hani-i-elezit" | "vermice-morine";
type ServiceKind = "police" | "hospital" | "fire_station" | "fuel";

type XhepDict = {
  meta: { title: string; description: string };
  toggle: { label: string; en: string; sq: string };
  hero: {
    skipToTools: string;
    helpNow: string;
    greeting: string;
    titleLead: string;
    titleRest: string;
    lead: string;
    emergency: string;
    modeLabel: string;
    borderMode: string;
    borderModeHint: string;
    cityMode: string;
    cityModeHint: string;
    privacy: string;
    waitsTitle: string;
    refreshing: string;
    autoRefresh: string;
    noData: string;
  };
  common: {
    kosovo: string;
    countries: Record<CrossingId, string>;
    emergency: Record<"112" | "192" | "193" | "194", string>;
    services: Record<ServiceKind, string>;
    openDirections: string;
    openDirectionsGoogle: string;
  };
  meter: { noData: string; label: (minutes: number, level: "green" | "amber" | "red") => string; levels: Record<"green" | "amber" | "red", string> };
  time: { now: string; minutesAgo: (minutes: number) => string };
  border: {
    title: string;
    intro: string;
    crossing: string;
    direction: string;
    entry: string;
    exit: string;
    entryShort: string;
    exitShort: string;
    findHelp: string;
    findHelpHint: string;
    progressLabel: string;
    report: string;
    reportHint: string;
    locationNote: string;
    updatedAt: (value: string) => string;
    awaitingUpdate: string;
    communityMedian: (median: number, count: number) => string;
    noVerifiedReport: string;
    cardBrand: string;
    sideMark: string;
    footerNote: string;
    download: string;
    downloading: string;
    downloadHint: string;
    loadFailed: string;
  };
  locate: {
    ready: string;
    asking: string;
    confirmed: string;
    analysing: string;
    preparing: string;
    done: string;
    failed: string;
    unsupported: string;
    denied: string;
    mapFailed: string;
    degraded: string;
    found: string;
  };
  report: {
    heading: (crossing: string) => string;
    identityLabel: string;
    withAccount: string;
    anonymous: string;
    signInPrompt: string;
    signInLink: string;
    signInRest: string;
    minutesLabel: string;
    locationRule: string;
    submit: string;
    submitting: string;
    checking: string;
    accepted: string;
    quarantined: string;
    errors: { invalid: string; signIn: string; tooFar: (distanceKm: number | null) => string; tooSoon: string; saveFailed: string; generic: string };
    dashboard: string;
    live: (count: number) => string;
    tableLabel: (crossing: string) => string;
    columns: { time: string; source: string; wait: string; confidence: string };
    sourceAccount: string;
    sourceAnonymous: string;
    confidence: { high: string; medium: string; low: string };
    empty: string;
  };
  nearby: {
    openNearest: string;
    askLocation: string;
    mapSearch: string;
    photoLinked: string;
    openStreetView: string;
    photoUnverified: string;
    photoAlt: (name: string) => string;
  };
  city: {
    title: string;
    intro: string;
    picker: string;
    curatedStops: (count: number) => string;
    pickerHint: string;
    added: string;
    add: (city: string) => string;
    brand: string;
    yourCards: string;
    packageCount: (count: number) => string;
    downloadAll: string;
    downloadingAll: string;
    download: string;
    remove: string;
    stopsWithPhotos: (count: number) => string;
  };
  offline: {
    htmlLang: string;
    utilityBrand: string;
    travelBrand: string;
    fine: string;
    title: string;
    citiesTitle: string;
    latestWaits: string;
    nearestServices: string;
    emergencyNumbers: string;
    autoRefreshEvery: string;
    openNearestSearch: string;
    noOfflinePhoto: string;
    placePhoto: string;
    kmAway: (km: string) => string;
    allowLocationFirst: string;
  };
};

export const XHEP_DICT = {
  en: {
    meta: {
      title: "Kosova në xhep: border waits and city guide | 383",
      description:
        "Live Kosovo border waits, nearby emergency services and downloadable city travel cards for visitors and the diaspora.",
    },
    toggle: { label: "Language", en: "English", sq: "Shqip" },
    hero: {
      skipToTools: "Skip to the travel tools",
      helpNow: "Help now",
      greeting: "Welcome to Kosovo",
      titleLead: "Kosova",
      titleRest: "në xhep — Kosovo in your pocket.",
      lead: "Border waits, help near you, and the places worth seeing.",
      emergency: "Help now - 112",
      modeLabel: "Choose a card",
      borderMode: "Border card",
      borderModeHint: "Waits and help nearby",
      cityMode: "City card",
      cityModeHint: "Five places in every city",
      privacy: "No account. Your location is only asked for when you choose.",
      waitsTitle: "Border crossings and waits",
      refreshing: "Updating...",
      autoRefresh: "Updates automatically",
      noData: "No data",
    },
    common: {
      kosovo: "Kosovo",
      countries: { kulle: "Montenegro", merdare: "Serbia", "hani-i-elezit": "North Macedonia", "vermice-morine": "Albania" },
      emergency: { "112": "Emergency", "192": "Police", "193": "Fire", "194": "Ambulance" },
      services: { police: "Police", hospital: "Ambulance", fire_station: "Fire brigade", fuel: "Fuel" },
      openDirections: "Get directions",
      openDirectionsGoogle: "Get directions in Google Maps",
    },
    meter: {
      noData: "No wait data",
      label: (minutes, level) => `${minutes} minutes, ${level} level`,
      levels: { green: "short", amber: "moderate", red: "long" },
    },
    time: { now: "Just now", minutesAgo: (minutes) => `${minutes} min ago` },
    border: {
      title: "Check the wait. Pick your crossing. Leave calmer.",
      intro:
        "The four main crossings update every 10 minutes. Traveller reports appear only after their location confirms they are at the border.",
      crossing: "Border crossing",
      direction: "Direction",
      entry: "Entering Kosovo",
      exit: "Leaving Kosovo",
      entryShort: "Entry",
      exitShort: "Exit",
      findHelp: "Find the nearest help",
      findHelpHint: "Police, ambulance, fire brigade and fuel",
      progressLabel: "Search progress",
      report: "Report the wait now",
      reportHint: "1 minute • accepted only near the border",
      locationNote: "Your location is used only for this search and is not stored.",
      updatedAt: (value) => `Updated ${value}`,
      awaitingUpdate: "Waiting for an update",
      communityMedian: (median, count) => `${median} min from ${count} ${count === 1 ? "report" : "reports"}`,
      noVerifiedReport: "No verified report",
      cardBrand: "BORDER CARD",
      sideMark: "BORDER",
      footerNote: "Your location is used only for the check you ask for.",
      download: "Download the card",
      downloading: "Preparing...",
      downloadHint: "Places and tappable directions",
      loadFailed: "Waits can't be updated right now.",
    },
    locate: {
      ready: "Ready to search",
      asking: "Asking for location permission",
      confirmed: "Location confirmed",
      analysing: "Looking for services within 10 km",
      preparing: "Preparing the 383 card",
      done: "Search complete",
      failed: "Search didn't finish",
      unsupported: "This browser doesn't support location.",
      denied: "Location permission wasn't given. Turn it on in your browser settings.",
      mapFailed: "The map service didn't respond.",
      degraded: "The links open the nearest search on the map.",
      found: "Found services near you. Your location isn't stored.",
    },
    report: {
      heading: (crossing) => `Report for ${crossing}`,
      identityLabel: "Choose how to report",
      withAccount: "With my account",
      anonymous: "Anonymous",
      signInPrompt: "Want to report with an account?",
      signInLink: "Sign in here",
      signInRest: "Anonymous reporting works without one.",
      minutesLabel: "How many minutes are you waiting?",
      locationRule: "Allow location. A report is accepted only within 1 km of the chosen crossing.",
      submit: "Verify and report",
      submitting: "Verifying...",
      checking: "Checking that you're near the chosen crossing...",
      accepted: "Report verified and added to the community wait.",
      quarantined: "Report received but not published: it differed too much from the current wait.",
      errors: {
        invalid: "Choose a crossing, a direction and a wait between 0 and 240 minutes.",
        signIn: "Sign in, or choose anonymous reporting.",
        tooFar: (distanceKm) => (distanceKm === null ? "You need to be within 1 km of the crossing to report." : `You need to be within 1 km of the crossing to report (you're ${distanceKm} km away).`),
        tooSoon: "Wait 10 minutes before sending another report.",
        saveFailed: "The report couldn't be saved. Try again.",
        generic: "The report wasn't saved.",
      },
      dashboard: "Verified reports",
      live: (count) => `${count} live`,
      tableLabel: (crossing) => `Latest reports for ${crossing}`,
      columns: { time: "Time", source: "Source", wait: "Wait", confidence: "Confidence" },
      sourceAccount: "Account",
      sourceAnonymous: "Anonymous",
      confidence: { high: "High", medium: "Medium", low: "Basic" },
      empty: "No verified report for this direction yet. The first one could be yours.",
    },
    nearby: {
      openNearest: "Open the nearest",
      askLocation: "Find my location",
      mapSearch: "Map search",
      photoLinked: "Photo linked to this place",
      openStreetView: "Open the real view of the place",
      photoUnverified: "Exact photo not verified",
      photoAlt: (name) => `${name}, verified photo of the place`,
    },
    city: {
      title: "Pick a city. We'll prepare the day.",
      intro: "Every card has five places, each with its own photo, a short description and ready Google Maps directions.",
      picker: "City",
      curatedStops: (count) => `${count} hand-picked stops`,
      pickerHint: "Download just this city, or build a pack.",
      added: "Card added",
      add: (city) => `Add the ${city} card`,
      brand: "CITY CARD",
      yourCards: "Your cards",
      packageCount: (count) => `${count} ${count === 1 ? "city" : "cities"} in this trip's pack`,
      downloadAll: "Download all",
      downloadingAll: "Preparing...",
      download: "Download",
      remove: "Remove",
      stopsWithPhotos: (count) => `${count} stops with photos and directions`,
    },
    offline: {
      htmlLang: "en",
      utilityBrand: "BORDER CARD",
      travelBrand: "KOSOVO TO EXPERIENCE",
      fine: "Save this card for the trip. Waits and conditions can change. In an emergency call 112.",
      title: "Border card - 383",
      citiesTitle: "City cards - 383",
      latestWaits: "Latest waits",
      nearestServices: "Nearest services",
      emergencyNumbers: "Emergency numbers",
      autoRefreshEvery: "Updates automatically every 10 minutes",
      openNearestSearch: "Open the nearest search",
      noOfflinePhoto: "No exact photo is verified for offline use.",
      placePhoto: "Photo of the place",
      kmAway: (km) => `${km} km away`,
      allowLocationFirst: "Allow location before downloading to add the nearest services.",
    },
  },
  sq: {
    meta: {
      title: "Kosova në xhep: pritjet në kufi dhe udhërrëfyesi i qyteteve | 383",
      description:
        "Pritjet live në kufijtë e Kosovës, shërbimet emergjente pranë teje dhe karta qytetesh për vizitorët dhe diasporën.",
    },
    toggle: { label: "Gjuha", en: "English", sq: "Shqip" },
    hero: {
      skipToTools: "Kalo te mjetet e udhëtimit",
      helpNow: "Ndihmë tani",
      greeting: "Mirë se erdhe në shtëpi",
      titleLead: "Kosova",
      titleRest: "në xhep, para kufirit.",
      lead: "Pritjet në kufi, ndihma pranë teje dhe vendet që ia vlen t'i shohësh.",
      emergency: "Ndihmë tani - 112",
      modeLabel: "Zgjidh llojin e kartës",
      borderMode: "Karta e kufirit",
      borderModeHint: "Pritjet dhe ndihma afër",
      cityMode: "Karta e qytetit",
      cityModeHint: "Pesë vende për çdo qytet",
      privacy: "Pa llogari. Vendndodhja kërkohet vetëm kur e zgjedh ti.",
      waitsTitle: "Pikat kufitare dhe pritjet",
      refreshing: "Po përditësohet...",
      autoRefresh: "Përditësim automatik",
      noData: "Pa të dhëna",
    },
    common: {
      kosovo: "Kosovë",
      countries: { kulle: "Mali i Zi", merdare: "Serbi", "hani-i-elezit": "Maqedoni e Veriut", "vermice-morine": "Shqipëri" },
      emergency: { "112": "Urgjenca", "192": "Policia", "193": "Zjarrfikësit", "194": "Ambulanca" },
      services: { police: "Policia", hospital: "Ambulanca", fire_station: "Zjarrfikësit", fuel: "Karburanti" },
      openDirections: "Hap drejtimet",
      openDirectionsGoogle: "Hap drejtimet në Google Maps",
    },
    meter: {
      noData: "Nuk ka të dhëna për pritjen",
      label: (minutes, level) => `${minutes} minuta, niveli ${level}`,
      levels: { green: "i shkurtër", amber: "mesatar", red: "i gjatë" },
    },
    time: { now: "Tani", minutesAgo: (minutes) => `${minutes} min më parë` },
    border: {
      title: "Shiko pritjen. Zgjidh pikën. Nisu më i qetë.",
      intro:
        "Katër pikat kryesore përditësohen çdo 10 minuta. Raportet e udhëtarëve shfaqen vetëm pasi vendndodhja konfirmon se janë pranë kufirit.",
      crossing: "Pika kufitare",
      direction: "Drejtimi",
      entry: "Hyrje në Kosovë",
      exit: "Dalje nga Kosova",
      entryShort: "Hyrje",
      exitShort: "Dalje",
      findHelp: "Gjej ndihmën më të afërt",
      findHelpHint: "Polici, ambulancë, zjarrfikës dhe karburant",
      progressLabel: "Përparimi i analizës",
      report: "Raporto pritjen tani",
      reportHint: "1 minutë • pranohet vetëm pranë kufirit",
      locationNote: "Vendndodhja përdoret vetëm për këtë kërkim dhe nuk ruhet.",
      updatedAt: (value) => `Përditësuar ${value}`,
      awaitingUpdate: "Duke pritur përditësimin",
      communityMedian: (median, count) => `${median} min nga ${count} raport${count === 1 ? "" : "e"}`,
      noVerifiedReport: "Pa raport të verifikuar",
      cardBrand: "KARTA E KUFIRIT",
      sideMark: "KUFIRI",
      footerNote: "Vendndodhja përdoret vetëm për kontrollin që kërkon ti.",
      download: "Shkarko kartën",
      downloading: "Po përgatitet...",
      downloadHint: "Vende dhe drejtime të klikueshme",
      loadFailed: "Pritjet nuk mund të përditësohen tani.",
    },
    locate: {
      ready: "Gati për analizë",
      asking: "Po kërkohet leja e vendndodhjes",
      confirmed: "Vendndodhja u konfirmua",
      analysing: "Po analizohen shërbimet brenda 10 km",
      preparing: "Po përgatitet karta 383",
      done: "Analiza u krye",
      failed: "Analiza nuk u përfundua",
      unsupported: "Shfletuesi nuk mbështet vendndodhjen.",
      denied: "Leja e vendndodhjes nuk u dha. Aktivizoje nga cilësimet e shfletuesit.",
      mapFailed: "Shërbimi i hartës nuk u përgjigj.",
      degraded: "Lidhjet hapin kërkimin më të afërt në hartë.",
      found: "U gjetën shërbimet pranë teje. Vendndodhja nuk ruhet.",
    },
    report: {
      heading: (crossing) => `Raport për ${crossing}`,
      identityLabel: "Zgjidh si do të raportosh",
      withAccount: "Me llogarinë time",
      anonymous: "Anonim",
      signInPrompt: "Dëshiron ta raportosh me llogari?",
      signInLink: "Hyr këtu",
      signInRest: "Raportimi anonim funksionon pa llogari.",
      minutesLabel: "Sa minuta po pret?",
      locationRule: "Lejo vendndodhjen. Raporti pranohet vetëm brenda 1 km nga pika e zgjedhur.",
      submit: "Verifiko dhe raporto",
      submitting: "Po verifikohet...",
      checking: "Po kontrollojmë nëse je pranë pikës së zgjedhur...",
      accepted: "Raporti u verifikua dhe u shtua te pritja e komunitetit.",
      quarantined: "Raporti u mor, por nuk u publikua sepse ndryshonte shumë nga pritja aktuale.",
      errors: {
        invalid: "Zgjidh pikën, drejtimin dhe një pritje mes 0 dhe 240 minutash.",
        signIn: "Hyr në llogari ose zgjidh raportimin anonim.",
        tooFar: (distanceKm) => (distanceKm === null ? "Duhet të jesh brenda 1 km nga pika për të raportuar." : `Duhet të jesh brenda 1 km nga pika për të raportuar (je ${distanceKm} km larg).`),
        tooSoon: "Prit 10 minuta para se të dërgosh një raport tjetër.",
        saveFailed: "Raporti nuk mund të ruhej. Provo sërish.",
        generic: "Raporti nuk u ruajt.",
      },
      dashboard: "Raportet e verifikuara",
      live: (count) => `${count} live`,
      tableLabel: (crossing) => `Raportet e fundit për ${crossing}`,
      columns: { time: "Koha", source: "Burimi", wait: "Pritja", confidence: "Besimi" },
      sourceAccount: "Me llogari",
      sourceAnonymous: "Anonim",
      confidence: { high: "Lartë", medium: "Mesatar", low: "Bazë" },
      empty: "Ende s'ka raport të verifikuar për këtë drejtim. Raporti i parë mund të jetë i yti.",
    },
    nearby: {
      openNearest: "Hap më të afërtën",
      askLocation: "Kërko vendndodhjen",
      mapSearch: "Kërkim në hartë",
      photoLinked: "Foto e lidhur me këtë vend",
      openStreetView: "Hap pamjen reale të vendit",
      photoUnverified: "Foto e saktë s'është verifikuar",
      photoAlt: (name) => `${name}, foto e verifikuar e vendit`,
    },
    city: {
      title: "Zgjidh qytetin. Ne ta përgatisim ditën.",
      intro: "Çdo kartë ka pesë vende me fotografinë e vet, përshkrim të shkurtër dhe drejtimin e gatshëm në Google Maps.",
      picker: "Qyteti",
      curatedStops: (count) => `${count} ndalesa të përzgjedhura`,
      pickerHint: "Mund ta shkarkosh vetëm këtë qytet ose të ndërtosh një paketë.",
      added: "Karta është shtuar",
      add: (city) => `Shto kartën e ${city}`,
      brand: "KARTA E QYTETIT",
      yourCards: "Kartat e tua",
      packageCount: (count) => `${count} qytet${count === 1 ? "" : "e"} në paketën e këtij udhëtimi`,
      downloadAll: "Shkarko të gjitha",
      downloadingAll: "Po përgatiten...",
      download: "Shkarko",
      remove: "Hiq",
      stopsWithPhotos: (count) => `${count} ndalesa me fotografi dhe drejtime`,
    },
    offline: {
      htmlLang: "sq",
      utilityBrand: "KARTA E KUFIRIT",
      travelBrand: "KOSOVA PËR TA PËRJETUAR",
      fine: "Ruaje kartën për udhëtim. Pritjet dhe kushtet mund të ndryshojnë. Në emergjencë telefono 112.",
      title: "Karta e kufirit - 383",
      citiesTitle: "Kartat e qyteteve - 383",
      latestWaits: "Pritjet e fundit",
      nearestServices: "Shërbimet më të afërta",
      emergencyNumbers: "Numrat e emergjencës",
      autoRefreshEvery: "Përditësim automatik çdo 10 minuta",
      openNearestSearch: "Hap kërkimin më të afërt",
      noOfflinePhoto: "Foto e saktë nuk është e verifikuar për përdorim offline.",
      placePhoto: "Foto e vendit",
      kmAway: (km) => `${km} km larg`,
      allowLocationFirst: "Lejo vendndodhjen para shkarkimit për të shtuar shërbimet më të afërta.",
    },
  },
} as const satisfies Record<XhepLang, XhepDict>;

export function xhepDict(lang: XhepLang): XhepDict {
  return XHEP_DICT[lang];
}
