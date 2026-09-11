import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchUpcomingEspnFootballFixtures, buildUpcomingFootballTemplate } from "./espn-upcoming-football.mjs";
import { buildSportMarketPlan } from "./tregu-sport-market.mjs";
import { discoverBasketball } from "./basketball-live.mjs";
import { buildFbkMarkets } from "./fbk-basketball.mjs";
import { normalizeLinkedLiveStats } from "./fbk-livestats.mjs";
import { readFileSync } from "node:fs";

const recorded = JSON.parse(readFileSync(new URL("./fixtures/fbk-livestats-2221511.json", import.meta.url)));

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

// Kosovo Superliga has no fixture inside any 72-hour window until the season
// restarts, so this drives the real code path with the recorded FIBA LiveStats
// capture in ./fixtures instead. Replay, not live production evidence.
test("fbk.kosovo: 72-hour discovery, real LiveStats telemetry, final lock", async () => {
  const kickoff = "2022-12-11T16:00:00Z";
  const preGame = new Date("2022-12-08T16:00:00Z");
  const fixture = {
    event_id: "fbk-superliga-replay", league: "fbk.kosovo", provider: "fbk",
    home_team: "Sigal Prishtina", away_team: "Trepça", kickoff,
    home_score: null, away_score: null,
    source_url: "https://www.basketbolli.com/Results?leagueId=150",
    live_stats_url: "https://fibalivestats.dcd.shared.geniussports.com/u/FBK/2221511/",
  };

  // Discovery: inside the three-day horizon, and an unplayed fixture only.
  const [market] = buildFbkMarkets([fixture], { now: preGame });
  assert.equal(market.status, "open");
  assert.equal(market.market_type, "two_outcome");
  assert.deepEqual(market.outcomes, ["home", "away"]);
  assert.ok(Math.abs(market.reference_probabilities.home + market.reference_probabilities.away - 1) < 1e-6);
  assert.equal(market.live_event.provider, "fbk");
  // Trading stays open through the game, then locks on a verified final.
  assert.equal(Date.parse(market.closes_at) - Date.parse(kickoff), 6 * 3600000);
  assert.equal(buildFbkMarkets([fixture], { now: new Date("2022-12-01T00:00:00Z") }).length, 0);
  assert.equal(buildFbkMarkets([{ ...fixture, home_score: 73, away_score: 54 }], { now: preGame }).length, 0);

  // Telemetry: the recorded payload must yield real measured stats, not placeholders.
  const observation = { matchId: "2221511", competitionName: "ProCredit Superliga", data: recorded.data, matches: recorded.matches };
  const played = { ...fixture, home_score: 73, away_score: 54 };
  const event = normalizeLinkedLiveStats(played, observation);
  assert.equal(event.status, "STATUS_FINAL");
  assert.equal(event.has_official_score, true);
  const home = event.metrics[fixture.home_team];
  assert.equal(home.points, 73);
  for (const key of ["assists", "rebounds", "turnovers", "three_pointers_made", "free_throws_attempted"]) {
    assert.ok(Number.isFinite(home[key]), `${key} must be measured, not missing`);
  }
  assert.ok(home.field_goals_made <= home.field_goals_attempted);
  assert.ok(home.three_pointers_made <= home.three_pointers_attempted);

  // Settlement handoff: the plan must satisfy settle_due_sport_markets' preconditions.
  const [final] = buildSportMarketPlan({ markets: [market], events: [{ ...event, event_id: market.live_event.event_id }], now: new Date("2022-12-11T18:00:00Z") });
  assert.equal(final.verified_outcome, "home");
  assert.equal(final.close_market, true);
  assert.ok(Number.isFinite(Date.parse(final.settlement_due_at)));
});

// settle_due_sport_markets pays out only where status='closed', outcome is not
// null and settlement_due_at has passed. A final signal that misses any of the
// three locks trading forever and never hands out the reward, which is exactly
// how the two stranded F1 races ended up closed with a null outcome.
test("every league's final signal satisfies the settlement payout preconditions", async () => {
  const now = new Date("2026-09-08T12:00:00Z");
  const date = new Date(now.getTime() + 72 * 3600000).toISOString();
  const competition = { status: { type: { state: "pre" } }, competitors: [
    { homeAway: "home", team: { displayName: "Home Club", id: "1" } },
    { homeAway: "away", team: { displayName: "Away Club", id: "2" } },
  ] };
  for (const league of ["uefa.europa", "uefa.europa.conf"]) {
    const events = [{ id: "exact", date, season: { slug: "league-phase" }, competitions: [competition] }];
    const fixtures = await fetchUpcomingEspnFootballFixtures({ now, fetchImpl: async url => ({ ok: true, json: async () => ({ events: url.includes(`/${league}/`) ? events : [] }) }) });
    const market = buildUpcomingFootballTemplate(fixtures[0]);
    const live = { provider: "espn", event_id: "exact", league, sport: "soccer", status: "STATUS_FULL_TIME", detail: "FT", has_official_score: true,
      competitors: [{ team: "Home Club", homeAway: "home", score: 2 }, { team: "Away Club", homeAway: "away", score: 0 }], metrics: {}, source_url: "https://site.api.espn.com/" };
    const [final] = buildSportMarketPlan({ markets: [market], events: [live], now });
    assert.equal(final.close_market, true, `${league} must lock trading`);
    assert.ok(final.verified_outcome, `${league} must carry a verified outcome or it can never pay out`);
    assert.ok(Number.isFinite(Date.parse(final.settlement_due_at)), `${league} must carry a settlement due time`);
  }
});
