/**
 * Pure logic for the basketball engine: the league registry (NBA, FIBA,
 * Superliga e Kosovës), ESPN endpoint/logo builders, and the two-outcome
 * market plan the generic sport engine (0011) prices. Migration 0047 widened
 * sport_outcomes to 2-or-3 for exactly this. No I/O here — the live automation
 * will feed ESPN scoreboards in; everything below is unit-testable.
 */

export const BASKETBALL_LEAGUES = [
  {
    key: "nba",
    label: "NBA",
    provider: "espn",
    scoreboardPath: "basketball/nba",
    logo: "/logos/nba.svg",
    country: "SHBA",
  },
  {
    key: "fiba.world",
    label: "FIBA",
    provider: "espn",
    // Live only during FIBA windows; the scoreboard returns 400 off-season
    // and the automation must treat that as "no events", never as failure.
    scoreboardPath: "basketball/fiba.world",
    logo: "/logos/fiba.svg",
    country: "Ndërkombëtare",
  },
  {
    key: "fbk.kosovo",
    label: "Superliga e Kosovës",
    provider: "fbk",
    // No public scoreboard exists — scores enter through the admin surface.
    scoreboardPath: null,
    logo: null,
    country: "Kosovë",
  },
];

export function leagueByKey(key) {
  return BASKETBALL_LEAGUES.find((l) => l.key === key) ?? null;
}

/** ESPN scoreboard endpoint for an ESPN-backed basketball league. */
export function espnScoreboardUrl(leagueKey, { limit = 50 } = {}) {
  const league = leagueByKey(leagueKey);
  if (!league || !league.scoreboardPath) return null;
  return `https://site.api.espn.com/apis/site/v2/sports/${league.scoreboardPath}/scoreboard?limit=${limit}`;
}

/** ESPN's public franchise/country logo for a seeded entity. */
export function espnTeamLogo(competition, abbrev) {
  if (competition === "nba") {
    return `https://a.espncdn.com/i/teamlogos/nba/500/${abbrev}.png`;
  }
  if (competition === "fiba.world") {
    return `https://a.espncdn.com/i/teamlogos/countries/500/${abbrev}.png`;
  }
  return null;
}

/** Two-letter monogram for entities without a canonical mark (KBL clubs). */
export function monogramFor(name) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function isBasketballMarket(market) {
  return market.market_classification === "live_basketball";
}

/** League key of a basketball market from its live_event, or null. */
export function basketballLeagueOf(market) {
  if (!isBasketballMarket(market)) return null;
  return market.live_event?.league ?? null;
}

/**
 * The two-outcome market plan for one basketball fixture. Football's 1X2
 * becomes a straight moneyline: HOME and AWAY, no draw geometry. Reference
 * probabilities come from the caller (ESPN win probability when present,
 * 50/50 otherwise) and open as b·ln(p) quantities — the same LMSR seeding
 * the three-outcome engine uses.
 *
 * @param {{home: string, away: string, homeProb?: number, eventId?: string, league: string}} input
 * @returns {{sport_outcomes: Array<{key: string, label: string}>, outcome_quantities: Record<string, number>, reference_probabilities: Record<string, number>}}
 */
export function buildBasketballMarketPlan({ home, away, homeProb = 0.5, eventId, league }) {
  const p = Math.min(0.97, Math.max(0.03, homeProb));
  const outcomes = [
    { key: "HOME", label: String(home ?? "Shtëpia") },
    { key: "AWAY", label: String(away ?? "Mysafiri") },
  ];
  const reference = { HOME: p, AWAY: 1 - p };
  const B = 100; // admin-seeded books open tighter than the floor default
  const quantities = {
    HOME: B * Math.log(p),
    AWAY: B * Math.log(1 - p),
  };
  return {
    sport_outcomes: outcomes,
    outcome_quantities: quantities,
    reference_probabilities: reference,
    ...(eventId ? { live_event: { provider: leagueByKey(league)?.provider ?? "espn", event_id: String(eventId), league, sport: "basketball" } } : {}),
  };
}
