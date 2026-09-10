import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchUpcomingEspnFootballFixtures, buildUpcomingFootballTemplate } from "./espn-upcoming-football.mjs";
import { buildSportMarketPlan } from "./tregu-sport-market.mjs";
import { discoverBasketball } from "./basketball-live.mjs";

for (const league of ["uefa.europa", "uefa.europa.conf"]) {
  test(`${league}: 72-hour discovery, normalized opening, live update and final lock`, async () => {
    const now = new Date("2026-09-08T12:00:00Z");
    const date = new Date(now.getTime() + 72 * 3600000).toISOString();
    const competition = { status: { type: { state: "pre" } }, competitors: [
      { homeAway: "home", team: { displayName: "Home Club", id: "1" } },
      { homeAway: "away", team: { displayName: "Away Club", id: "2" } },
    ] };
    const events = [{ id: "exact", date, season: { slug: "league-phase" }, competitions: [competition] },
      { id: "too-early", date: new Date(Date.parse(date) + 1).toISOString(), competitions: [competition] }];
    const fixtures = await fetchUpcomingEspnFootballFixtures({ now, fetchImpl: async url => ({ ok: true, json: async () => ({ events: url.includes(`/${league}/`) ? events : [] }) }) });
    assert.equal(fixtures.length, 1);
    const market = buildUpcomingFootballTemplate(fixtures[0]);
    assert.equal(market.status, "open");
    assert.equal(market.market_type, "three_outcome");
    assert.ok(Math.abs(Object.values(market.reference_probabilities).reduce((a, b) => a + b, 0) - 1) < 1e-6);
    const live = { provider: "espn", event_id: "exact", league, sport: "soccer", status: "STATUS_SECOND_HALF", detail: "70'", has_official_score: true,
      competitors: [{ team: "Home Club", homeAway: "home", score: 2 }, { team: "Away Club", homeAway: "away", score: 0 }], metrics: {}, source_url: "https://site.api.espn.com/" };
    const [signal] = buildSportMarketPlan({ markets: [market], events: [live], now });
    assert.ok(signal.snapshot.reference_probabilities.home > signal.snapshot.reference_probabilities.away);
    assert.equal(signal.close_market, false);
    assert.equal(buildSportMarketPlan({ markets: [{ ...market, live_score_state: { key: signal.state_key } }], events: [live], now }).length, 0);
    const [final] = buildSportMarketPlan({ markets: [market], events: [{ ...live, status: "STATUS_FULL_TIME", detail: "FT" }], now });
    assert.equal(final.verified_outcome, "home");
    assert.equal(final.close_market, true);
    assert.equal(Date.parse(final.settlement_due_at) - now.getTime(), 7 * 60000);
  });
}

test("NBA creates at 72 hours and prices overtime without a draw", async () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const start = now.getTime() + 72 * 3600000;
  const competition = { status: { type: { state: "pre" } }, competitors: [
    { homeAway: "home", team: { displayName: "Home Team" } }, { homeAway: "away", team: { displayName: "Away Team" } },
  ] };
  const markets = await discoverBasketball({ now, fetchImpl: async url => ({ ok: true, json: async () => ({ events: url.includes("/nba/") ? [0, 1].map(delta => ({ id: String(delta), date: new Date(start + delta).toISOString(), competitions: [competition] })) : [] }) }) });
  assert.equal(markets.length, 1);
  const event = { provider: "espn", event_id: "0", league: "nba", sport: "basketball", status: "STATUS_IN_PROGRESS", period: 5, clock_seconds: 20, has_official_score: true,
    competitors: [{ team: "Home Team", homeAway: "home", score: 112 }, { team: "Away Team", homeAway: "away", score: 109 }], metrics: {}, source_url: "https://site.api.espn.com/" };
  const [signal] = buildSportMarketPlan({ markets, events: [event], now });
  assert.ok(signal.snapshot.reference_probabilities.home > .8);
  assert.deepEqual(Object.keys(signal.snapshot.reference_probabilities), ["home", "away"]);
  const [final] = buildSportMarketPlan({ markets, events: [{ ...event, status: "STATUS_FINAL" }], now });
  assert.equal(final.verified_outcome, "home");
});
