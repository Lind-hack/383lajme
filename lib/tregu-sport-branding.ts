export type SportBrand = {
  key: string;
  label: string;
  shortLabel: string;
  logo?: string;
  accent: string;
  tint: string;
  sourceUrl?: string;
};

export const SPORT_BRANDS: Record<string, SportBrand> = {
  "eng.1": {
    key: "eng.1",
    label: "Premier League",
    shortLabel: "Premier League",
    logo: "/logos/premierleague.svg",
    accent: "#360D3A",
    tint: "#F2EAF5",
    sourceUrl: "https://logo.premierleague.com/",
  },
  "esp.1": {
    key: "esp.1",
    label: "La Liga",
    shortLabel: "LALIGA",
    logo: "/logos/laliga.svg",
    accent: "#FF4B44",
    tint: "#FFF0EE",
    sourceUrl: "https://www.laliga.com/pressroom/logos-and-corporate-dossier/logos",
  },
  "ita.1": {
    key: "ita.1",
    label: "Serie A",
    shortLabel: "Serie A",
    logo: "/logos/seriea.svg",
    accent: "#0873F9",
    tint: "#EDF5FF",
    sourceUrl: "https://www.legaseriea.it/",
  },
  "ger.1": {
    key: "ger.1",
    label: "Bundesliga",
    shortLabel: "Bundesliga",
    logo: "/logos/bundesliga.svg",
    accent: "#D10214",
    tint: "#FFF0F1",
    sourceUrl: "https://www.bundesliga.com/",
  },
  "uefa.champions": { key: "uefa.champions", label: "Champions League", shortLabel: "UCL", logo: "/logos/uefachampionsleague.svg", accent: "#263cc9", tint: "#f3f5ff" },
  "uefa.europa": { key: "uefa.europa", label: "Europa League", shortLabel: "UEL", logo: "/logos/uefaeuropaleague.svg", accent: "#b95408", tint: "#fff7ee" },
  "uefa.europa.conf": { key: "uefa.europa.conf", label: "Conference League", shortLabel: "UECL", logo: "/logos/uefaeuroconferenceleague.svg", accent: "#13843c", tint: "#f1faf2" },
  f1: {
    key: "f1",
    label: "Formula 1",
    shortLabel: "F1™",
    logo: "/logos/f1.svg",
    accent: "#E10600",
    tint: "#FFF0EF",
    sourceUrl: "https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt",
  },
  nba: {
    key: "nba",
    label: "NBA",
    shortLabel: "NBA",
    accent: "#17408B",
    tint: "#EEF4FF",
  },
  fbk: {
    key: "fbk",
    label: "Superliga e Kosovës",
    shortLabel: "FBK",
    accent: "#0A5AA6",
    tint: "#EEF7FF",
  },
};

export function sportBrandFor(key?: string | null): SportBrand | null {
  if (!key) return null;
  const normalized = key.toLowerCase();
  if (SPORT_BRANDS[normalized]) return SPORT_BRANDS[normalized];
  if (normalized.includes("formula") || normalized.includes("f1")) return SPORT_BRANDS.f1;
  if (normalized.includes("nba")) return SPORT_BRANDS.nba;
  if (normalized.includes("fbk") || normalized.includes("kosov")) return SPORT_BRANDS.fbk;
  return null;
}

/* Competitions that get the full night treatment: a navy surface lit by
   drifting blue and violet, with this photograph anchored at its foot. The look
   itself lives in [data-competition] rules in globals.css; adding a competition
   here plus a colour block there is the whole job. Shared by the floor card, the
   market header and the trade receipt so all three stay in step. */
export const COMPETITION_NIGHT_ART: Record<string, string> = {
  "uefa.champions": "/images/tregu/ucl-stadium-night-v1.webp",
};

/* Europa is a different treatment, not a recolour of the Champions one: a deep
   orange ground crossed by falling beams, with the trophy standing in a lane of
   its own on the right. It needs its own art slot for that reason. */
export type CompetitionArt = { src: string; width: number; height: number };

/* Intrinsic sizes travel with the art. The two trophies are cropped from
   different photographs and do not share an aspect ratio, so a hardcoded
   width/height on the <img> would stretch one of them. */
export const COMPETITION_TROPHY_ART: Record<string, CompetitionArt> = {
  "uefa.europa": { src: "/images/tregu/uel-trophy-v1.webp", width: 420, height: 1142 },
  "uefa.europa.conf": { src: "/images/tregu/uecl-trophy-v1.webp", width: 420, height: 906 },
};

export function trophyArtFor(league?: string | null): CompetitionArt | null {
  if (!league) return null;
  return COMPETITION_TROPHY_ART[league.toLowerCase()] ?? null;
}

export function nightArtFor(league?: string | null): string | null {
  if (!league) return null;
  return COMPETITION_NIGHT_ART[league.toLowerCase()] ?? null;
}
