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
  },
} as const satisfies Record<XhepLang, XhepDict>;

export function xhepDict(lang: XhepLang): XhepDict {
  return XHEP_DICT[lang];
}
