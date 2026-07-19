// Stat sheets for event markets — same no-schema philosophy as
// lib/tregu-media.ts: events exist only as question-text conventions, so the
// head-to-head numbers behind each event live here, keyed by event title.
// MatchStats renders them beneath the combined chart: the leading side of
// every row wears the brand orange, the trailing side fades to cream.
import type { MatchStatRow } from "@/lib/tregu-demo";

export interface EventStats {
  heading?: string;
  home: string;
  away: string;
  score: string;
  note?: string;
  goals?: string;
  rows: MatchStatRow[];
}

// 2026 Belgian GP: pole-sitter Antonelli against Norris, his closest rival by
// the odds. Season numbers mirror the market description (Antonelli leads the
// championship on 179 points with the fastest car).
const EVENT_STATS: { match: RegExp; stats: EventStats }[] = [
  {
    match: /f1.*belgjik/i,
    stats: {
      heading: "Statistikat e garës",
      home: "Antonelli",
      away: "Norris",
      score: "P1 - P3",
      note: "nisja në grid",
      goals: "Spa-Francorchamps · 44 xhiro · rivalët kryesorë sipas gjasave",
      rows: [
        { label: "Pikë në kampionat", home: 179, away: 141 },
        { label: "Fitore këtë sezon", home: 5, away: 3 },
        { label: "Podiume këtë sezon", home: 9, away: 7 },
        { label: "Pole këtë sezon", home: 4, away: 2 },
        { label: "Xhiro më të shpejta", home: 3, away: 2 },
        { label: "Shpejtësia maksimale", home: 342, away: 338, homeText: "342 km/h", awayText: "338 km/h" },
        { label: "Gara të përfunduara", home: 12, away: 11, homeText: "12/13", awayText: "11/13" },
      ],
    },
  },
];

/** Stat sheet for an event title, or null when none is registered. */
export function eventStatsFor(title: string): EventStats | null {
  for (const e of EVENT_STATS) {
    if (e.match.test(title)) return e.stats;
  }
  return null;
}
