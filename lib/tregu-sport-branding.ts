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
  "uefa.nations": { key: "uefa.nations", label: "Nations League", shortLabel: "UNL", logo: "/logos/uefanationsleague.webp", accent: "#2d4a7c", tint: "#f4f6fa" },
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
    logo: "/logos/nba.svg",
    accent: "#17408B",
    tint: "#EEF4FF",
  },
  "fiba.world": {
    key: "fiba.world",
    label: "FIBA",
    shortLabel: "FIBA",
    logo: "/logos/fiba.svg",
    // FIBA's own orange sits on top of the hardwood ground rather than against
    // it, so the mark takes the deeper end of its range to stay legible.
    accent: "#A8380F",
    tint: "#FFF1EA",
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
  if (normalized.includes("fiba")) return SPORT_BRANDS["fiba.world"];
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
  // v2: properly cut out (clean alpha, gaps between handles and ribbons clear).
  // v1 was a rectangular photo with the beams painted across it, feathered at
  // the edges — no mask could make it read as a trophy on its own.
  "uefa.europa": { src: "/images/tregu/uel-trophy-v2.webp", width: 488, height: 1100 },
  "uefa.europa.conf": { src: "/images/tregu/uecl-trophy-v2.webp", width: 305, height: 1100 },
};

/* Basketball: the arena at night. A dark, lit-from-above card with a real
   photograph of the game, one per competition, so NBA and the Kosovo
   Superliga read as different nights rather than one floor recoloured.

   It is registered per competition, never per sport. DESIGN.md:168 requires a
   treatment to key off a competition, and "basketball" is a category; these
   three are the competitions the basketball engine actually produces markets
   for (see BASKETBALL_LEAGUES in lib/tregu-basketball.mjs).

   Photos are Pexels (free for commercial use, no attribution required), chosen
   with no identifiable player and no sponsor branding:
     NBA  - "Dramatic basketball hoop with stunning light effects",
            Eslam Mohammed Abdelmaksoud, pexels.com/photo/31169230
     Hall - "Training on the court", Matteo Basile, pexels.com/photo/12882043 */
const ARENA_NBA: CompetitionArt = { src: "/images/tregu/basketball-arena-nba.webp", width: 1400, height: 933 };
const ARENA_HALL: CompetitionArt = { src: "/images/tregu/basketball-arena-hall.webp", width: 1400, height: 933 };

export const COMPETITION_COURT_ART: Record<string, CompetitionArt> = {
  nba: ARENA_NBA,
  "fiba.world": ARENA_HALL,
  "fbk.kosovo": ARENA_HALL,
};

export function courtArtFor(league?: string | null): CompetitionArt | null {
  if (!league) return null;
  return COMPETITION_COURT_ART[league.toLowerCase()] ?? null;
}

export function trophyArtFor(league?: string | null): CompetitionArt | null {
  if (!league) return null;
  return COMPETITION_TROPHY_ART[league.toLowerCase()] ?? null;
}

export function nightArtFor(league?: string | null): string | null {
  if (!league) return null;
  return COMPETITION_NIGHT_ART[league.toLowerCase()] ?? null;
}
