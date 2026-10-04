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

import type { OpenerText } from "@/components/xhep/packs/pack-opener";
import type { DetailText } from "@/components/xhep/packs/card-detail";
import type { BackText } from "@/components/xhep/packs/pack-model";

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
  map: { label: string; country: string; stampTop: string; stampBottom: string; disclaimer: string; disclaimerCompact: string };
  companion: {
    title: string;
    intro: string;
    start: string;
    startHint: string;
    resume: string;
  };
  quiz: {
    progress: (step: number, total: number) => string;
    back: string;
    next: string;
    skip: string;
    finish: string;
    whoTitle: string;
    nameLabel: string;
    namePlaceholder: string;
    types: Record<"first" | "diaspora" | "family", { label: string; hint: string }>;
    whenTitle: string;
    startLabel: string;
    daysLabel: (days: number) => string;
    arriveTitle: string;
    fly: string;
    flyHint: string;
    drive: string;
    driveHint: string;
    crossingLabel: string;
    crossingAny: string;
    interestsTitle: string;
    interestsHint: string;
    interests: Record<"nature" | "history" | "food" | "coffee" | "nightlife" | "skiing", string>;
    citiesTitle: string;
    citiesHint: string;
    budgetTitle: string;
    budgets: Record<"easy" | "mid" | "treat", { label: string; hint: string }>;
    storageNote: string;
  };
  trip: {
    metaTitle: (name: string) => string;
    metaDescription: string;
    heading: (name: string) => string;
    anon: string;
    summary: (days: number, cities: string) => string;
    publicNote: string;
    joinTitle: string;
    joinIntro: string;
    nameLabel: string;
    join: string;
    joining: string;
    replaceConfirm: string;
    invalidTitle: string;
    invalidBody: string;
    openVisit: string;
    travellingWith: (name: string) => string;
  };
  plan: {
    title: string;
    intro: string;
    day: (n: number) => string;
    duration: (minutes: number) => string;
    slots: Record<"morning" | "afternoon" | "evening" | "any", string>;
    directions: string;
    showAll: (n: number) => string;
    showLess: string;
    printNote: string;
    imHere: string;
    checking: string;
    stamped: string;
    stampErrors: { too_far: (m: number | null) => string; low_accuracy: string; denied: string; generic: string };
    stampPrivacy: string;
  };
  memories: {
    title: string;
    intro: string;
    add: string;
    addHint: string;
    count: (n: number, max: number) => string;
    remove: string;
    vibe: string;
    vibes: Record<"prizren" | "rugova" | "prishtina" | "brezovica", string>;
    layout: string;
    layouts: Record<"grid" | "hero" | "strip", string>;
    download: string;
    share: string;
    preparing: string;
    privacy: string;
    errors: Record<"type" | "decode" | "too_large", string>;
    titleText: (name: string) => string;
    showcaseSoon: string;
  };
  help: {
    title: string;
    intro: string;
    personal: string;
    tabs: Record<"route" | "arrival" | "prices" | "phrases" | "events", string>;
    tabsLabel: string;
    source: string;
    checked: (date: string) => string;
    entryLabel: string;
    exitLabel: string;
    places: Record<"fly" | "albania" | "north-macedonia" | "montenegro" | "serbia", string>;
    levels: Record<"stop" | "must" | "know", string>;
    arrivalFly: string;
    arrivalDrive: string;
    pricesIntro: string;
    pricesStale: string;
    perKm: (eur: string) => string;
    phrasesIntro: string;
    phraseOpen: string;
    phraseClose: string;
    customLabel: string;
    customPlaceholder: string;
    customShow: string;
    eventsIntro: string;
    eventsNone: string;
    eventsNoDates: string;
  };
  card: {
    title: string;
    intro: string;
    downloadPass: string;
    downloadStory: string;
    share: string;
    shareText: string;
    preparing: string;
    edit: string;
    reset: string;
    resetConfirm: string;
    qrNote: string;
    shareFailed: string;
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
    openCard: string;
    closeCard: string;
    miniNote: string;
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
  packs: {
    title: string;
    intro: string;
    sealed: string;
    sealedLabel: (city: string) => string;
    openedLabel: (city: string, done: number, total: number) => string;
    stampsShort: (done: number, total: number) => string;
    forYou: string;
    featured: string;
    quizCta: string;
    flipLabel: (city: string) => string;
    flipBack: string;
    flipFront: string;
    box: { title: string; sub: string; close: string };
    back: BackText;
    opener: OpenerText;
    detail: DetailText;
  };
};

export const XHEP_DICT = {
  en: {
    meta: {
      title: "Kosova në xhep: border waits and city guide",
      description:
        "Live Kosovo border waits, nearby emergency services and downloadable city travel cards for visitors and the diaspora.",
    },
    toggle: { label: "Language", en: "English", sq: "Shqip" },
    hero: {
      skipToTools: "Skip to the travel tools",
      helpNow: "Help now",
      greeting: "Welcome to Kosovo",
      titleLead: "Kosova",
      titleRest: "në xhep.",
      lead: "Kosovo in your pocket: border waits, help near you, and the places worth seeing.",
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
    companion: {
      title: "Your Kosovo, in your pocket",
      intro: "Answer six quick questions and get your own woven card, a plan for your days and the help that fits your trip. No account.",
      start: "Make my card",
      startHint: "About 30 seconds",
      resume: "Continue my card",
    },
    quiz: {
      progress: (step, total) => `Step ${step} of ${total}`,
      back: "Back",
      next: "Next",
      skip: "Skip",
      finish: "Weave my card",
      whoTitle: "Who's travelling?",
      nameLabel: "Name on your card (optional)",
      namePlaceholder: "e.g. Lena",
      types: {
        first: { label: "First time in Kosovo", hint: "New to the country" },
        diaspora: { label: "Coming home", hint: "Diaspora, visiting family" },
        family: { label: "Family trip", hint: "Travelling with kids" },
      },
      whenTitle: "When, and for how long?",
      startLabel: "First day in Kosovo (optional)",
      daysLabel: (days) => `${days} ${days === 1 ? "day" : "days"}`,
      arriveTitle: "How are you arriving?",
      fly: "Flying",
      flyHint: "Into Prishtina airport (PRN)",
      drive: "Driving",
      driveHint: "Across a land border",
      crossingLabel: "Which crossing?",
      crossingAny: "Not sure yet",
      interestsTitle: "What do you love?",
      interestsHint: "Pick up to four — they colour your card.",
      interests: { nature: "Mountains & nature", history: "History", food: "Food", coffee: "Coffee culture", nightlife: "Nights out", skiing: "Skiing" },
      citiesTitle: "Where will you go?",
      citiesHint: "Up to six cities. We suggested some from your interests.",
      budgetTitle: "How do you like to travel?",
      budgets: {
        easy: { label: "Easy on the wallet", hint: "Street food, buses, guesthouses" },
        mid: { label: "Comfortable", hint: "Good restaurants, taxis, hotels" },
        treat: { label: "Treat ourselves", hint: "The best tables and stays" },
      },
      storageNote: "Your answers stay on this device.",
    },
    trip: {
      metaTitle: (name) => (name ? `${name}'s Kosovo trip — Kosova në xhep` : "A Kosovo trip — Kosova në xhep"),
      metaDescription: "A Kosovo trip shared from Kosova në xhep by 383. Join it and weave your own card.",
      heading: (name) => `${name}'s trip`,
      anon: "A shared Kosovo trip",
      summary: (days, cities) => `${days} ${days === 1 ? "day" : "days"} · ${cities}`,
      publicNote: "This trip lives in the link itself: anyone with the link can see it, and nothing about it is stored on 383's servers.",
      joinTitle: "Travel together",
      joinIntro: "Join this trip to get the same day-by-day plan and your own card from the same weave.",
      nameLabel: "Your name on the card (optional)",
      join: "Travel together",
      joining: "Weaving your card...",
      replaceConfirm: "You already have a card on this device. Replace it with this trip?",
      invalidTitle: "This trip link doesn't work",
      invalidBody: "It may be incomplete or damaged. Ask for the card again, or make your own.",
      openVisit: "Open Kosova në xhep",
      travellingWith: (name) => `Travelling with ${name}`,
    },
    plan: {
      title: "Your days",
      intro: "A day-by-day plan from your cities and interests, using only places we've checked. Move at your own pace.",
      day: (n) => `Day ${n}`,
      duration: (minutes) => (minutes >= 60 ? `about ${Math.round(minutes / 30) / 2} h` : `about ${minutes} min`),
      slots: { morning: "Morning", afternoon: "Afternoon", evening: "Evening", any: "Any time" },
      directions: "Directions",
      showAll: (n) => `Show all ${n} days`,
      showLess: "Show fewer days",
      printNote: "Opening hours change — check before you go.",
      imHere: "I'm here — stamp it",
      checking: "Checking where you are...",
      stamped: "Stamped — look at your card",
      stampErrors: {
        too_far: (m) => (m ? `Not quite there yet — about ${m} m away.` : "Not quite there yet."),
        low_accuracy: "Your location isn't precise enough yet. Step outside and try again.",
        denied: "Location permission wasn't given, so no stamp this time.",
        generic: "The stamp didn't work. Try again in a moment.",
      },
      stampPrivacy: "Your position is checked once and never stored.",
    },
    memories: {
      title: "Your memories card",
      intro: "After the trip, turn your best photos into a woven keepsake. Pick the photos, a vibe and a layout.",
      add: "Add photos",
      addHint: "JPEG, PNG or WebP (HEIC on iPhone Safari), up to 8.",
      count: (n, max) => `${n} of ${max} photos`,
      remove: "Remove photo",
      vibe: "Vibe",
      vibes: { prizren: "Warm Prizren", rugova: "Rugova pine", prishtina: "Prishtina night", brezovica: "Winter Brezovica" },
      layout: "Layout",
      layouts: { grid: "Grid", hero: "Big moment", strip: "Film strip" },
      download: "Download memories card",
      share: "Share",
      preparing: "Preparing...",
      privacy: "Your photos never leave this device. They're re-encoded here, which removes hidden location data.",
      errors: {
        type: "That file isn't a photo we can use (try JPEG, PNG or WebP).",
        decode: "This browser can't open that photo. On iPhone, Safari handles HEIC; elsewhere, export it as JPEG.",
        too_large: "That photo is over 24 megapixels — please pick a smaller one.",
      },
      titleText: (name) => (name ? `${name}'s Kosovo` : "My Kosovo"),
      showcaseSoon: "Coming next: submit your card to the Kosova në xhep showcase (reviewed by our editors before it appears).",
    },
    help: {
      title: "Help for your trip",
      intro: "Checked facts for getting in, getting around and getting by. Every item shows where it comes from.",
      personal: "Tuned to your answers.",
      tabs: { route: "Route check", arrival: "First 3 hours", prices: "Fair prices", phrases: "Show a local", events: "What's on" },
      tabsLabel: "Trip help",
      source: "Source",
      checked: (date) => `Checked ${date}`,
      entryLabel: "Coming in from",
      exitLabel: "Leaving to",
      places: { fly: "By air", albania: "Albania", "north-macedonia": "North Macedonia", montenegro: "Montenegro", serbia: "Serbia" },
      levels: { stop: "Stop and check", must: "Must do", know: "Good to know" },
      arrivalFly: "You're flying into Prishtina.",
      arrivalDrive: "You're driving in.",
      pricesIntro: "Typical prices in Prishtina, so you know what fair looks like.",
      pricesStale: "These prices are more than four months old and may have changed.",
      perKm: (eur) => `+ €${eur}/km`,
      phrasesIntro: "Tap a phrase to show it full screen — big Albanian text anyone can read.",
      phraseOpen: "Show full screen",
      phraseClose: "Close",
      customLabel: "Your own words (an address, a dish…)",
      customPlaceholder: "e.g. Rruga Garibaldi 7",
      customShow: "Show it",
      eventsIntro: "What's happening while you're here.",
      eventsNone: "Nothing big on our calendar for your dates — a good time for quiet streets.",
      eventsNoDates: "Add your dates in the quiz to see what's on while you're here.",
    },
    card: {
      title: "Your card",
      intro: "Woven from your answers — no two are alike. Save it as your travel pass, or share it. Friends can scan the code to see your trip.",
      downloadPass: "Download card",
      downloadStory: "Story size",
      share: "Share",
      shareText: "My Kosovo card — Kosova në xhep by 383",
      preparing: "Preparing...",
      edit: "Change answers",
      reset: "Start over",
      resetConfirm: "Start over? Your card and answers on this device will be cleared.",
      qrNote: "Scan the code with another phone to open this trip and travel together.",
      shareFailed: "Sharing isn't available here, so the card was downloaded instead.",
    },
    map: {
      label: "Stylized map of Kosovo with the main cities",
      country: "KOSOVO",
      stampTop: "WELCOME",
      stampBottom: "to Kosovo",
      disclaimer: "Stylized border · © OpenStreetMap contributors · Not for navigation",
      disclaimerCompact: "Stylized map - not for navigation",
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
      openCard: "Open the full border card",
      closeCard: "Close",
      miniNote: "Official waits, every 10 minutes. Inside: report yours, help nearby, save offline.",
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
    packs: {
      title: "Open a city",
      intro: "Every city is a pack of 10 cards: places worth your day, your own mural and story, and a stamp card that fills in as you go.",
      sealed: "Sealed",
      sealedLabel: (city) => `Open the ${city} pack`,
      openedLabel: (city, done, total) => `${city}: opened, ${done} of ${total} stamped`,
      stampsShort: (done, total) => `${done}/${total} stamps`,
      forYou: "Picked for you",
      featured: "Start here",
      quizCta: "Answer a few questions, get your packs",
      flipLabel: (city) => `Turn the ${city} pack over`,
      flipBack: "Turn over",
      flipFront: "Front",
      box: { title: "All of Kosovo", sub: "7 cities · 70 cards", close: "Close the box" },
      back: {
        inside: "Inside",
        contents: "10 cards: 7 places · 2 to fill · 1 stamp card",
        places: "The places",
        total: (h) => `About ${h} hours to see it all`,
        open: "Open",
      },
      opener: {
        close: "Close",
        tearHint: "Swipe across the top to tear it open",
        tearHintMouse: "Click and drag across the top to tear it open",
        tearButton: "Open the pack",
        tapNext: "tap for the next card",
        skip: "Show all cards",
        binderTitle: (city) => `${city}: your cards`,
        replay: "Open again",
        soundOn: "Sound on",
        soundOff: "Sound off",
        turn: "Turn it over",
        cardOf: (i, n) => `${i} / ${n}`,
        faces: {
        stampCard: "Stamp card",
        muralCard: "Your mural",
        storyCard: "Your story",
        muralEmpty: "Your trip photos and selfies go here",
        storyEmpty: "What was it like?",
        stampsDone: (n, of) => `${n} of ${of} stamped`,
        photos: (n) => `${n} photo${n === 1 ? "" : "s"}`,
      },
      },
      detail: {
        close: "Close",
        flipToGuide: "Read the guide",
        flipToCard: "Back to the card",
        whatToDo: "What to do",
        timeToSpend: "Time to spend",
        bestTime: "Best time",
        bestTimes: { morning: "Morning", afternoon: "Afternoon", evening: "Evening", any: "Any time", day: "During the day" },
        openMap: "Open in Maps",
        stampGps: "I'm here: stamp with GPS",
        stampHand: "I've been: mark it myself",
        stampedGold: "Stamped at the place",
        stampedHand: "Marked by you",
        stampWorking: "Checking where you are…",
        stampErrors: {
          denied: "Location is off. Allow it for this site, or mark the place yourself.",
          too_far: (km) => `You're about ${km} km away. Come closer, or mark it yourself.`,
          low_accuracy: "Your phone can't tell exactly where you are yet. Step outside and try again.",
          no_location: "This place has no verified map point yet, so it can only be marked by you.",
          generic: "That didn't work. Try again in a moment.",
        },
        stampsTitle: "Stamp card",
        stampsIntro: "Each place you visit colours in its piece of the city. Stamp all of them to finish the picture.",
        stampsDone: (n, of) => `${n} of ${of} stamped`,
        complete: (city) => `You've seen all of ${city}. The picture is yours.`,
        qrLabel: "Trip QR code",
        qrHint: "Scan to open this trip on another phone. Tap anywhere to close.",
        muralTitle: "Your mural",
        muralIntro: "Your photos and selfies from the trip, on one wall. They stay on this phone until you choose to send them.",
        muralAdd: "Add photos",
        muralRemove: "Remove photo",
        muralCount: (n, max) => `${n} of ${max} photos`,
        muralErrors: { type: "That file isn't a photo.", decode: "One photo couldn't be read on this phone.", full: "The mural holds 8 photos; the rest were left out." },
        storyTitle: "Your story",
        storyIntro: "Where you went, what surprised you, who you met. Saved on this phone as you type.",
        storyPlaceholder: "My first evening in the city…",
        storySaved: "Saved",
        send: {
          title: "Send it to 383",
          intro: "Share your trip with other travellers. If an editor picks it, it appears on the Kosova në xhep page as a trip made with the 383ks.com travel guide. Nothing goes up without an editor reading it first.",
          signIn: "Sign in to send it",
          consent: "I agree that 383ks.com may show these photos and words on the Kosova në xhep page, only to showcase trips made with its travel guide, never for ads or anything else. I'm in the photos or have permission from everyone who is. I can ask for them to be removed at any time.",
          send: "Send to 383",
          sending: "Sending…",
          sent: "Sent. An editor will look at it before anything is published.",
          nothing: "Add a photo or a few words first.",
          failed: "It didn't send. Check your connection and try again.",
        },
        faces: {
        stampCard: "Stamp card",
        muralCard: "Your mural",
        storyCard: "Your story",
        muralEmpty: "Your trip photos and selfies go here",
        storyEmpty: "What was it like?",
        stampsDone: (n, of) => `${n} of ${of} stamped`,
        photos: (n) => `${n} photo${n === 1 ? "" : "s"}`,
      },
      },
    },
  },
  sq: {
    meta: {
      title: "Kosova në xhep: pritjet në kufi dhe udhërrëfyesi i qyteteve",
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
    companion: {
      title: "Kosova jote, në xhep",
      intro: "Përgjigju gjashtë pyetjeve të shpejta dhe merr kartën tënde të endur, planin e ditëve dhe ndihmën që i përshtatet udhëtimit. Pa llogari.",
      start: "Krijo kartën time",
      startHint: "Rreth 30 sekonda",
      resume: "Vazhdo kartën time",
    },
    quiz: {
      progress: (step, total) => `Hapi ${step} nga ${total}`,
      back: "Prapa",
      next: "Vazhdo",
      skip: "Kalo",
      finish: "Ende kartën time",
      whoTitle: "Kush po udhëton?",
      nameLabel: "Emri në kartë (opsional)",
      namePlaceholder: "p.sh. Lena",
      types: {
        first: { label: "Herën e parë në Kosovë", hint: "I ri në vend" },
        diaspora: { label: "Po kthehem në shtëpi", hint: "Diaspora, te familja" },
        family: { label: "Udhëtim familjar", hint: "Me fëmijë" },
      },
      whenTitle: "Kur, dhe për sa kohë?",
      startLabel: "Dita e parë në Kosovë (opsionale)",
      daysLabel: (days) => `${days} ditë`,
      arriveTitle: "Si po vjen?",
      fly: "Me aeroplan",
      flyHint: "Në aeroportin e Prishtinës (PRN)",
      drive: "Me makinë",
      driveHint: "Përmes një kufiri tokësor",
      crossingLabel: "Cila pikë kufitare?",
      crossingAny: "Ende s'e di",
      interestsTitle: "Çfarë të pëlqen?",
      interestsHint: "Zgjidh deri në katër — ato i japin ngjyrë kartës.",
      interests: { nature: "Male e natyrë", history: "Histori", food: "Ushqim", coffee: "Kultura e kafes", nightlife: "Jeta e natës", skiing: "Ski" },
      citiesTitle: "Ku do të shkosh?",
      citiesHint: "Deri në gjashtë qytete. Disa i sugjeruam nga interesat e tua.",
      budgetTitle: "Si të pëlqen të udhëtosh?",
      budgets: {
        easy: { label: "Me pak shpenzime", hint: "Ushqim rruge, autobus, bujtina" },
        mid: { label: "Komod", hint: "Restorante të mira, taksi, hotele" },
        treat: { label: "Pa kursim", hint: "Tavolinat dhe qëndrimet më të mira" },
      },
      storageNote: "Përgjigjet ruhen vetëm në këtë pajisje.",
    },
    trip: {
      metaTitle: (name) => (name ? `Udhëtimi i ${name} në Kosovë — Kosova në xhep` : "Një udhëtim në Kosovë — Kosova në xhep"),
      metaDescription: "Një udhëtim në Kosovë i ndarë nga Kosova në xhep e 383. Bashkohu dhe ende kartën tënde.",
      heading: (name) => `Udhëtimi i ${name}`,
      anon: "Një udhëtim i ndarë në Kosovë",
      summary: (days, cities) => `${days} ditë · ${cities}`,
      publicNote: "Ky udhëtim jeton brenda lidhjes: kushdo që e ka lidhjen e sheh, dhe asgjë prej tij nuk ruhet në serverët e 383.",
      joinTitle: "Udhëtoni bashkë",
      joinIntro: "Bashkohu me këtë udhëtim për të marrë të njëjtin plan ditë për ditë dhe kartën tënde nga e njëjta endje.",
      nameLabel: "Emri yt në kartë (opsional)",
      join: "Udhëtoni bashkë",
      joining: "Po endet karta jote...",
      replaceConfirm: "Ke tashmë një kartë në këtë pajisje. Ta zëvendësojmë me këtë udhëtim?",
      invalidTitle: "Kjo lidhje udhëtimi nuk funksionon",
      invalidBody: "Mund të jetë e paplotë ose e dëmtuar. Kërkoje kartën sërish ose krijo tënden.",
      openVisit: "Hap Kosova në xhep",
      travellingWith: (name) => `Udhëton me ${name}`,
    },
    plan: {
      title: "Ditët e tua",
      intro: "Plan ditë për ditë nga qytetet dhe interesat e tua, vetëm me vende që i kemi kontrolluar. Ec me ritmin tënd.",
      day: (n) => `Dita ${n}`,
      duration: (minutes) => (minutes >= 60 ? `rreth ${Math.round(minutes / 30) / 2} orë` : `rreth ${minutes} min`),
      slots: { morning: "Mëngjes", afternoon: "Pasdite", evening: "Mbrëmje", any: "Në çdo kohë" },
      directions: "Drejtimet",
      showAll: (n) => `Shfaq të gjitha ${n} ditët`,
      showLess: "Shfaq më pak ditë",
      printNote: "Oraret ndryshojnë — kontrolloji para se të shkosh.",
      imHere: "Jam këtu — vulose",
      checking: "Po kontrollojmë ku je...",
      stamped: "U vulos — shiko kartën tënde",
      stampErrors: {
        too_far: (m) => (m ? `Ende jo aty — rreth ${m} m larg.` : "Ende jo aty."),
        low_accuracy: "Vendndodhja nuk është ende mjaft e saktë. Dil jashtë dhe provo sërish.",
        denied: "Leja e vendndodhjes nuk u dha, prandaj këtë herë pa vulë.",
        generic: "Vula nuk funksionoi. Provo sërish pas pak.",
      },
      stampPrivacy: "Pozicioni yt kontrollohet një herë dhe nuk ruhet kurrë.",
    },
    memories: {
      title: "Karta e kujtimeve",
      intro: "Pas udhëtimit, ktheji fotot më të mira në një kujtim të endur. Zgjidh fotot, një atmosferë dhe një paraqitje.",
      add: "Shto foto",
      addHint: "JPEG, PNG ose WebP (HEIC në Safari të iPhone), deri në 8.",
      count: (n, max) => `${n} nga ${max} foto`,
      remove: "Hiqe foton",
      vibe: "Atmosfera",
      vibes: { prizren: "Prizreni i ngrohtë", rugova: "Pisha e Rugovës", prishtina: "Nata në Prishtinë", brezovica: "Brezovica në dimër" },
      layout: "Paraqitja",
      layouts: { grid: "Rrjetë", hero: "Momenti i madh", strip: "Shirit filmi" },
      download: "Shkarko kartën e kujtimeve",
      share: "Ndaje",
      preparing: "Po përgatitet...",
      privacy: "Fotot nuk largohen kurrë nga kjo pajisje. Ato ri-kodohen këtu, gjë që heq të dhënat e fshehura të vendndodhjes.",
      errors: {
        type: "Ky skedar nuk është foto që mund ta përdorim (provo JPEG, PNG ose WebP).",
        decode: "Ky shfletues nuk e hap këtë foto. Në iPhone, Safari e hap HEIC; gjetiu, eksportoje si JPEG.",
        too_large: "Kjo foto ka mbi 24 megapiksel — zgjidh një më të vogël.",
      },
      titleText: (name) => (name ? `Kosova · ${name}` : "Kosova ime"),
      showcaseSoon: "Së shpejti: dërgoje kartën në vitrinën e Kosova në xhep (e shqyrtuar nga redaktorët tanë para publikimit).",
    },
    help: {
      title: "Ndihmë për udhëtimin",
      intro: "Fakte të verifikuara për hyrjen, lëvizjen dhe qëndrimin. Çdo element tregon nga vjen.",
      personal: "Përshtatur sipas përgjigjeve të tua.",
      tabs: { route: "Kontrolli i rrugës", arrival: "3 orët e para", prices: "Çmime të drejta", phrases: "Trego një vendasi", events: "Çka ndodh" },
      tabsLabel: "Ndihmë për udhëtimin",
      source: "Burimi",
      checked: (date) => `Kontrolluar më ${date}`,
      entryLabel: "Po vjen nga",
      exitLabel: "Po del drejt",
      places: { fly: "Me aeroplan", albania: "Shqipëria", "north-macedonia": "Maqedonia e Veriut", montenegro: "Mali i Zi", serbia: "Serbia" },
      levels: { stop: "Ndal dhe kontrollo", must: "Detyrimisht", know: "Mirë ta dish" },
      arrivalFly: "Po vjen me aeroplan në Prishtinë.",
      arrivalDrive: "Po vjen me makinë.",
      pricesIntro: "Çmime tipike në Prishtinë, që ta dish çka është e drejtë.",
      pricesStale: "Këto çmime janë më të vjetra se katër muaj dhe mund të kenë ndryshuar.",
      perKm: (eur) => `+ ${eur} €/km`,
      phrasesIntro: "Prek një frazë për ta treguar në ekran të plotë — tekst i madh shqip që e lexon kushdo.",
      phraseOpen: "Trego në ekran të plotë",
      phraseClose: "Mbyll",
      customLabel: "Fjalët e tua (një adresë, një gjellë…)",
      customPlaceholder: "p.sh. Rruga Garibaldi 7",
      customShow: "Trego",
      eventsIntro: "Çka po ndodh gjatë qëndrimit tënd.",
      eventsNone: "Asgjë e madhe në kalendarin tonë për datat e tua — kohë e mirë për rrugë të qeta.",
      eventsNoDates: "Shto datat në pyetësor për të parë çka ndodh gjatë qëndrimit.",
    },
    card: {
      title: "Karta jote",
      intro: "E endur nga përgjigjet e tua — asnjë nuk është si tjetra. Ruaje si kartë udhëtimi ose ndaje. Miqtë mund ta skanojnë kodin për të parë udhëtimin.",
      downloadPass: "Shkarko kartën",
      downloadStory: "Për story",
      share: "Ndaje",
      shareText: "Karta ime e Kosovës — Kosova në xhep nga 383",
      preparing: "Po përgatitet...",
      edit: "Ndrysho përgjigjet",
      reset: "Fillo nga e para",
      resetConfirm: "Të fillojmë nga e para? Karta dhe përgjigjet në këtë pajisje do të fshihen.",
      qrNote: "Skanoje kodin me një telefon tjetër për ta hapur këtë udhëtim dhe për të udhëtuar bashkë.",
      shareFailed: "Ndarja nuk mbështetet këtu, prandaj karta u shkarkua.",
    },
    map: {
      label: "Hartë e stilizuar e Kosovës me qytetet kryesore",
      country: "KOSOVË",
      stampTop: "MIRË SE VJEN",
      stampBottom: "Në Kosovë",
      disclaimer: "Kufi i stilizuar · © OpenStreetMap contributors · Jo për navigim",
      disclaimerCompact: "Hartë e stilizuar - jo për navigim",
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
      openCard: "Hap kartën e plotë të kufirit",
      closeCard: "Mbyll",
      miniNote: "Pritjet zyrtare, çdo 10 minuta. Brenda: raporto tënden, ndihmë afër, ruaje offline.",
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
    packs: {
      title: "Hap një qytet",
      intro: "Çdo qytet është një paketë me 10 karta: vende që ia vlejnë ditës, muri dhe historia jote, dhe karta e vulave që mbushet ndërsa udhëton.",
      sealed: "E mbyllur",
      sealedLabel: (city) => `Hap paketën: ${city}`,
      openedLabel: (city, done, total) => `${city}: e hapur, ${done} nga ${total} të vulosura`,
      stampsShort: (done, total) => `${done}/${total} vula`,
      forYou: "Zgjedhur për ty",
      featured: "Nis këtu",
      quizCta: "Përgjigju disa pyetjeve, merr paketat e tua",
      flipLabel: (city) => `Ktheje paketën: ${city}`,
      flipBack: "Ktheje",
      flipFront: "Përpara",
      box: { title: "Kosova e plotë", sub: "7 qytete · 70 karta", close: "Mbyll kutinë" },
      back: {
        inside: "Brenda",
        contents: "10 karta: 7 vende · 2 për t'i mbushur · 1 kartë vulash",
        places: "Vendet",
        total: (h) => `Rreth ${h} orë për t'i parë të gjitha`,
        open: "Hape",
      },
      opener: {
        close: "Mbyll",
        tearHint: "Rrëshqit gishtin mbi majë për ta grisur",
        tearHintMouse: "Kliko dhe tërhiq përgjatë majës për ta grisur",
        tearButton: "Hap paketën",
        tapNext: "prek për kartën tjetër",
        skip: "Shfaqi të gjitha kartat",
        binderTitle: (city) => `${city}: kartat e tua`,
        replay: "Rihape",
        soundOn: "Zëri i ndezur",
        soundOff: "Zëri i fikur",
        turn: "Ktheje",
        cardOf: (i, n) => `${i} / ${n}`,
        faces: {
        stampCard: "Karta e vulave",
        muralCard: "Muri yt",
        storyCard: "Historia jote",
        muralEmpty: "Këtu shkojnë fotot dhe selfiet e udhëtimit",
        storyEmpty: "Si ishte?",
        stampsDone: (n, of) => `${n} nga ${of} të vulosura`,
        photos: (n) => `${n} foto`,
      },
      },
      detail: {
        close: "Mbyll",
        flipToGuide: "Lexo udhëzuesin",
        flipToCard: "Kthehu te karta",
        whatToDo: "Çfarë të bësh",
        timeToSpend: "Sa kohë të qëndrosh",
        bestTime: "Koha më e mirë",
        bestTimes: { morning: "Mëngjes", afternoon: "Pasdite", evening: "Mbrëmje", any: "Kurdo", day: "Gjatë ditës" },
        openMap: "Hape në hartë",
        stampGps: "Jam këtu: vulos me GPS",
        stampHand: "Kam qenë: e shënoj vetë",
        stampedGold: "Vulosur në vend",
        stampedHand: "Shënuar nga ti",
        stampWorking: "Po shoh ku je…",
        stampErrors: {
          denied: "Vendndodhja është e fikur. Lejoje për këtë faqe, ose shëno vendin vetë.",
          too_far: (km) => `Je rreth ${km} km larg. Afrohu, ose shënoje vetë.`,
          low_accuracy: "Telefoni ende s'e di saktë ku je. Dil jashtë dhe provo sërish.",
          no_location: "Ky vend ende s'ka pikë të verifikuar në hartë, ndaj mund ta shënosh vetëm vetë.",
          generic: "Nuk funksionoi. Provo sërish pas pak.",
        },
        stampsTitle: "Karta e vulave",
        stampsIntro: "Çdo vend që viziton ngjyros pjesën e vet të qytetit. Vulosi të gjitha për ta përfunduar pikturën.",
        stampsDone: (n, of) => `${n} nga ${of} të vulosura`,
        complete: (city) => `I ke parë të gjitha në ${city}. Piktura është e jotja.`,
        qrLabel: "Kodi QR i udhëtimit",
        qrHint: "Skanoje për ta hapur këtë udhëtim në një telefon tjetër. Prek kudo për ta mbyllur.",
        muralTitle: "Muri yt",
        muralIntro: "Fotot dhe selfiet e udhëtimit, në një mur. Qëndrojnë në këtë telefon derisa të vendosësh t'i dërgosh.",
        muralAdd: "Shto foto",
        muralRemove: "Hiq foton",
        muralCount: (n, max) => `${n} nga ${max} foto`,
        muralErrors: { type: "Ky skedar nuk është foto.", decode: "Një foto nuk u lexua dot në këtë telefon.", full: "Muri mban 8 foto; të tjerat mbetën jashtë." },
        storyTitle: "Historia jote",
        storyIntro: "Ku shkove, çfarë të befasoi, kë takove. Ruhet në këtë telefon ndërsa shkruan.",
        storyPlaceholder: "Mbrëmja ime e parë në qytet…",
        storySaved: "U ruajt",
        send: {
          title: "Dërgoje te 383",
          intro: "Ndaje udhëtimin me udhëtarët e tjerë. Nëse e zgjedh një redaktor, shfaqet në faqen Kosova në xhep si udhëtim i bërë me udhërrëfyesin e 383ks.com. Asgjë nuk publikohet pa e lexuar një redaktor më parë.",
          signIn: "Hyr për ta dërguar",
          consent: "Pajtohem që 383ks.com t'i shfaqë këto foto dhe fjalë në faqen Kosova në xhep, vetëm për të treguar udhëtime të bëra me udhërrëfyesin e saj, kurrë për reklama apo diçka tjetër. Jam unë në foto ose kam lejen e të gjithëve që janë. Mund të kërkoj t'i hiqen në çdo kohë.",
          send: "Dërgoje te 383",
          sending: "Po dërgohet…",
          sent: "U dërgua. Një redaktor e shikon para se të publikohet diçka.",
          nothing: "Shto një foto ose disa fjalë më parë.",
          failed: "Nuk u dërgua. Kontrollo lidhjen dhe provo sërish.",
        },
        faces: {
        stampCard: "Karta e vulave",
        muralCard: "Muri yt",
        storyCard: "Historia jote",
        muralEmpty: "Këtu shkojnë fotot dhe selfiet e udhëtimit",
        storyEmpty: "Si ishte?",
        stampsDone: (n, of) => `${n} nga ${of} të vulosura`,
        photos: (n) => `${n} foto`,
      },
      },
    },
  },
} as const satisfies Record<XhepLang, XhepDict>;

export function xhepDict(lang: XhepLang): XhepDict {
  return XHEP_DICT[lang];
}
