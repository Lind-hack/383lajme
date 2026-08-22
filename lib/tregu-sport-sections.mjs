/**
 * Pure logic behind the Tregu sports discovery cards: which football leagues
 * exist, how many open markets each one has, what the F1 calendar shows, and
 * what filtering a league means for the floor list. No React, no fetches —
 * unit-testable the same way as the other tregu *.mjs modules.
 *
 * League keys are ESPN's (live_event->>'league'), written by the admin draft
 * flow and validated on approval: eng.1, esp.1, ita.1, ger.1 plus the UEFA
 * cups. F1 markets carry market_classification='live_f1'.
 */

export const FOOTBALL_LEAGUES = [
  { key: "eng.1", label: "Premier League", country: "Angli" },
  { key: "esp.1", label: "La Liga", country: "Spanjë" },
  { key: "ita.1", label: "Serie A", country: "Itali" },
  { key: "ger.1", label: "Bundesliga", country: "Gjermani" },
];

/** Cups exist in the pipeline but get sections later, per editorial call. */
export const FOOTBALL_TOURNAMENTS_SOON = [
  { key: "uefa.champions", label: "Champions League" },
  { key: "uefa.europa", label: "Europa League" },
  { key: "uefa.europa.conf", label: "Conference League" },
];

export function isFootballMarket(market) {
  return market.market_classification === "live_football";
}

/** ESPN league key of an open football market, or null. */
export function leagueOf(market) {
  if (!isFootballMarket(market)) return null;
  return market.live_event?.league ?? null;
}

export function isF1Market(market) {
  return (
    market.market_classification === "live_f1" ||
    market.market_type === "f1_race_winner"
  );
}

/**
 * Open-market counts per league key. Only markets passing isOpen (the caller's
 * open/archived rule) are counted, so a closed gameweek never advertises 0.
 */
/** @param {Array<any>} markets @param {(m: any) => boolean} [isOpen] @returns {Record<string, number>} */
export function footballLeagueCounts(markets, isOpen = () => true) {
  const counts = {};
  for (const m of markets ?? []) {
    const league = leagueOf(m);
    if (!league || !isOpen(m)) continue;
    counts[league] = (counts[league] ?? 0) + 1;
  }
  return counts;
}

/** Floor-list filter: everything open in one football league, newest deadline first. */
/** @param {Array<any>} markets @param {string} leagueKey @returns {Array<any>} */
export function marketsForFootballLeague(markets, leagueKey) {
  return (markets ?? [])
    .filter((m) => leagueOf(m) === leagueKey)
    .sort((a, b) => String(a.closes_at).localeCompare(String(b.closes_at)));
}

/**
 * F1 calendar: upcoming open race-winner markets in race order. Race identity
 * comes from the market itself; the caller renders names and dates.
 */
/** @param {Array<any>} markets @param {{isOpen?: (m: any) => boolean, limit?: number}} [opts] @returns {Array<{slug: string, name: string, closesAt: string, prob: number}>} */
export function f1Calendar(markets, { isOpen = () => true, limit = 3 } = {}) {
  return (markets ?? [])
    .filter((m) => isF1Market(m) && isOpen(m))
    .filter((m) => Date.parse(m.closes_at ?? "") > Date.now())
    .sort((a, b) => String(a.closes_at).localeCompare(String(b.closes_at)))
    .slice(0, limit)
    .map((m) => ({
      slug: m.slug,
      name: String(m.question ?? "").replace(/^Kush(?: e)? fiton\s*/i, "").replace(/\?+$/, "").trim() || m.question,
      closesAt: m.closes_at,
      prob: m.market_prob,
    }));
}

/** Display label for a league key or "f1". */
export function sportLabel(key) {
  if (!key) return "";
  if (key === "f1") return "Formula 1";
  return FOOTBALL_LEAGUES.find((l) => l.key === key)?.label ?? key;
}
