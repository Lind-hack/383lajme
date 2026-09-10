// Read-only provider smoke check. Never connects to the trading database.
import { discoverBasketball } from '../lib/basketball-live.mjs';
import { fetchFbkFixtures, buildFbkMarkets } from '../lib/fbk-basketball.mjs';
import { fetchUpcomingEspnFootballFixtures } from '../lib/espn-upcoming-football.mjs';
import { fetchUpcomingOpenF1Race } from '../lib/f1-upcoming-race.mjs';

const now = new Date();
const checks = {
  basketball: async () => {
    const rows = await discoverBasketball({ now });
    return { eligible: rows.length, leagues: rows.map(row => row.live_event.league) };
  },
  kosovo: async () => {
    const rows = await fetchFbkFixtures();
    return { fixtures: rows.length, eligible: buildFbkMarkets(rows, { now }).length };
  },
  football: async () => {
    const rows = await fetchUpcomingEspnFootballFixtures({ now, windowHours: 72 });
    return { eligible: rows.length, leagues: rows.reduce((counts, row) => {
      const league = row.league?.id ?? row.league;
      counts[league] = (counts[league] ?? 0) + 1;
      return counts;
    }, {}) };
  },
  f1: async () => {
    const race = await fetchUpcomingOpenF1Race({ now, leadDays: 3 });
    return { eligible: race ? 1 : 0, event_id: race?.event_id ?? null };
  },
};
await Promise.all(Object.entries(checks).map(async ([provider, check]) => {
  try { console.log(JSON.stringify({ provider, checked_at: now.toISOString(), ok: true, ...await check() })); }
  catch (error) { process.exitCode = 1; console.log(JSON.stringify({ provider, ok: false, error: error.message })); }
}));
