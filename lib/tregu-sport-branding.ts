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
