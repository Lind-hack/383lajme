import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildFootballOpeningModel, extractFootballBookmakerProbabilities, formScore, outcomeQuantitiesFromProbabilities } from "./football-pre-match.mjs";
import { buildF1RaceWinnerOpeningModel } from "./f1-pre-match.mjs";
import { buildUpcomingF1MarketTemplate } from "./f1-upcoming-race.mjs";
import { buildSportMarketPlan, normalizeEspnSummary } from "./tregu-sport-market.mjs";

const footballFixture = {
  event_id: "fixture-1",
  league: "eng.1",
  source_url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20260829",
  fetched_at: "2026-08-27T02:00:00.000Z",
  home: { name: "Arsenal", form: "WDDWW", records: [{ name: "All Splits", summary: "4-1-0" }] },
  away: { name: "Wolves", form: "LLDLD", records: [{ name: "All Splits", summary: "1-1-3" }] },
  bookmaker_odds: {
    provider: "DraftKings",
    moneyline: {
      home: { close: { odds: "-170" } },
      draw: { close: { odds: "+330" } },
      away: { close: { odds: "+425" } },
    },
  },
};

test("football opening model uses verified bookmaker lines and form instead of equal priors", () => {
  const bookmaker = extractFootballBookmakerProbabilities(footballFixture.bookmaker_odds);
  assert.ok(bookmaker);
  assert.ok(bookmaker.home > bookmaker.away);
  assert.equal(formScore("WDDWW") > formScore("LLDLD"), true);
  const model = buildFootballOpeningModel(footballFixture);
  assert.equal(model.model_version, "football-opening-v2");
  assert.equal(model.probabilities.home > model.probabilities.away, true);
  assert.equal(new Set(Object.values(model.probabilities)).size > 1, true);
  assert.ok(Math.abs(Object.values(model.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.match(model.method, /bookmaker|form/i);
  assert.equal(model.inputs.market_value_status, "not_used_without_verified_source");
  const quantities = outcomeQuantitiesFromProbabilities(model.probabilities, 400);
  assert.ok(Object.values(quantities).every(Number.isFinite));
});

test("football opening model remains non-uniform without bookmaker data and records the limitation", () => {
  const model = buildFootballOpeningModel({
    ...footballFixture,
    bookmaker_odds: null,
    home: { ...footballFixture.home, form: "WWWWW" },
    away: { ...footballFixture.away, form: "LLLLL" },
  });
  assert.equal(model.probabilities.home > model.probabilities.away, true);
  assert.equal(model.inputs.bookmaker_probabilities, null);
  assert.match(model.method, /unavailable|no market-value/i);
});

test("F1 opening model is a normalized non-uniform 20-driver vector from verified factors", () => {
  const roster = Array.from({ length: 20 }, (_, index) => ({ key: `D${String(index).padStart(2, "0")}`, driver_number: index + 1, label: `Driver ${index}`, team: `Team ${index % 5}` }));
  const championshipDrivers = roster.map((driver, index) => ({ driver_number: driver.driver_number, position_current: index + 1, points_current: 300 - index * 11 }));
  const championshipTeams = Array.from({ length: 5 }, (_, index) => ({ team_name: `Team ${index}`, points_current: 500 - index * 55 }));
  const recentResults = Object.fromEntries(roster.map((driver, index) => [driver.key, [index + 1, Math.min(20, index + 2), Math.min(20, index + 3)]]));
  const circuitHistory = Object.fromEntries(roster.map((driver, index) => [driver.key, [Math.min(20, index + 1), Math.min(20, index + 2)]]));
  const qualifying = Object.fromEntries(roster.map((driver, index) => [driver.key, index + 1]));
  const model = buildF1RaceWinnerOpeningModel({ roster, championshipDrivers, championshipTeams, recentResults, circuitHistory, qualifying, sources: [{ provider: "OpenF1", url: "https://api.openf1.org/v1/championship_drivers" }] });
  assert.equal(model.model_version, "f1-opening-v2");
  assert.equal(model.probabilities.D00 > model.probabilities.D19, true);
  assert.equal(new Set(Object.values(model.probabilities)).size > 10, true);
  assert.ok(Math.abs(Object.values(model.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.equal(model.availability.simulator, false);
  assert.match(model.method, /simulator input is optional/i);
});

test("F1 template persists the model vector and LMSR quantities rather than equal opening odds", () => {
  const roster = Array.from({ length: 20 }, (_, index) => ({ key: `D${String(index).padStart(2, "0")}`, driver_number: index + 1, label: `Driver ${index}`, team: `Team ${index % 5}` }));
  const probabilities = Object.fromEntries(roster.map((driver, index) => [driver.key, index === 0 ? 0.30 : (0.70 / 19)]));
  const template = buildUpcomingF1MarketTemplate({
    race: { event_id: "f1-2026-test", year: 2026, date_start: "2026-08-30T13:00:00.000Z", circuit_short_name: "Test Circuit", country_name: "Testland", session_key: 999, source_url: "https://api.openf1.org/v1/sessions" },
    roster,
    openingModel: { model_version: "f1-opening-v2", probabilities, inputs: {}, sources: [], availability: {} },
    now: new Date("2026-08-27T02:00:00.000Z"),
  });
  assert.equal(template.status, "draft");
  assert.equal(template.sport_outcomes[0].driver_number, 1);
  assert.equal(template.reference_probabilities.D00, 0.30);
  assert.equal(template.outcome_quantities.D00 > template.outcome_quantities.D01, true);
  assert.equal(template.live_event.circuit_short_name, "Test Circuit");
});

test("F1 vector migration defines both atomic service-role RPCs and no ledger mutation", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0049_tregu_f1_race_winner_oracle.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.apply_f1_race_winner_oracle/i);
  assert.match(sql, /create or replace function public\.record_f1_vector_snapshot/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /least\(0\.05/i);
  assert.match(sql, /oracle_kind/i);
  assert.match(sql, /['"]f1_vector['"]/i);
  assert.doesNotMatch(sql, /update public\.(profiles|positions)|insert into public\.transactions/i);
});

test("automation idempotency reconciles only genuinely stale running audits", () => {
  const source = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  assert.match(source, /STALE_RUN_AFTER_MS = 30 \* 60 \* 1000/);
  assert.match(source, /stale_run_reconciled/);
  assert.match(source, /\.eq\("status", "running"\)/);
  assert.match(source, /finished_at: new Date\(\)\.toISOString\(\)/);
});

test("live football model makes a tied late match draw-dominant instead of preserving an 80% favorite", () => {
  const market = {
    id: "live-match",
    status: "open",
    b: 400,
    sport_outcomes: [{ key: "home", team: "Real Madrid" }, { key: "draw", label: "Draw" }, { key: "away", team: "Real Sociedad" }],
    outcome_quantities: { home: 0, draw: 0, away: 0 },
    reference_probabilities: { home: 0.80, draw: 0.10, away: 0.10 },
    pre_match_analysis: { opening_model: { probabilities: { home: 0.68, draw: 0.18, away: 0.14 } } },
    live_event: { provider: "espn", event_id: "401882919", league: "esp.1", sport: "soccer", home_team: "Real Madrid", away_team: "Real Sociedad" },
  };
  const event = normalizeEspnSummary({ provider: "espn", event_id: "401882919", league: "esp.1", sport: "soccer" }, {
    header: { competitions: [{ date: "2026-08-27T00:00:00.000Z", status: { type: { name: "STATUS_HALFTIME", shortDetail: "HT" } }, competitors: [{ homeAway: "home", score: "1", team: { displayName: "Real Madrid" } }, { homeAway: "away", score: "1", team: { displayName: "Real Sociedad" } }] }] },
    boxscore: { teams: [{ team: { displayName: "Real Madrid" }, statistics: [{ name: "shotsOnTarget", displayValue: "7" }] }, { team: { displayName: "Real Sociedad" }, statistics: [{ name: "shotsOnTarget", displayValue: "2" }] }] },
  });
  const [signal] = buildSportMarketPlan({ markets: [market], events: [event] });
  assert.equal(signal.kind, "score");
  assert.equal(signal.snapshot.reference_probabilities.draw > 0.55, true);
  assert.equal(signal.snapshot.reference_probabilities.home < 0.40, true);
  assert.ok(Math.abs(Object.values(signal.snapshot.reference_probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
});

test("halftime and second-half official states both produce refresh signals", () => {
  const market = { id: "half", status: "open", b: 400, sport_outcomes: [{ key: "home", team: "A" }, { key: "draw", label: "Draw" }, { key: "away", team: "B" }], outcome_quantities: { home: 0, draw: 0, away: 0 }, live_event: { provider: "espn", event_id: "x", league: "eng.1", sport: "soccer", home_team: "A", away_team: "B" } };
  const base = { provider: "espn", event_id: "x", league: "eng.1", has_official_score: true, competitors: [{ team: "A", score: 0 }, { team: "B", score: 0 }], metrics: {}, source_url: "https://site.api.espn.com/example" };
  const halftime = { ...base, status: "STATUS_HALFTIME", detail: "HT" };
  const secondHalf = { ...base, status: "STATUS_SECOND_HALF", detail: "55'" };
  const first = buildSportMarketPlan({ markets: [market], events: [halftime] })[0];
  const second = buildSportMarketPlan({ markets: [{ ...market, live_score_state: { key: first.state_key } }], events: [secondHalf] })[0];
  assert.equal(first.kind, "score");
  assert.equal(second.kind, "score");
  assert.notEqual(first.state_key, second.state_key);
});
