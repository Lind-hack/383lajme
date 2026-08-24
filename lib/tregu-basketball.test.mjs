import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASKETBALL_LEAGUES,
  basketballLeagueOf,
  buildBasketballMarketPlan,
  espnScoreboardUrl,
  espnTeamLogo,
  isBasketballMarket,
  leagueByKey,
  monogramFor,
} from "./tregu-basketball.mjs";

test("the registry carries NBA, FIBA and the Kosovo Superliga with the right providers", () => {
  assert.deepEqual(
    BASKETBALL_LEAGUES.map((l) => l.key),
    ["nba", "fiba.world", "fbk.kosovo"]
  );
  assert.equal(leagueByKey("nba").provider, "espn");
  assert.equal(leagueByKey("fbk.kosovo").provider, "fbk");
  assert.equal(leagueByKey("fbk.kosovo").scoreboardPath, null);
});

test("espnScoreboardUrl builds the endpoint for ESPN leagues and refuses fbk", () => {
  assert.equal(
    espnScoreboardUrl("nba"),
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=50"
  );
  assert.equal(
    espnScoreboardUrl("fiba.world"),
    "https://site.api.espn.com/apis/site/v2/sports/basketball/fiba.world/scoreboard?limit=50"
  );
  assert.equal(espnScoreboardUrl("fbk.kosovo"), null);
  assert.equal(espnScoreboardUrl("nuk-ekziston"), null);
});

test("espnTeamLogo uses the franchise CDN for NBA and the country CDN for FIBA", () => {
  assert.equal(espnTeamLogo("nba", "lal"), "https://a.espncdn.com/i/teamlogos/nba/500/lal.png");
  assert.equal(espnTeamLogo("fiba.world", "kos"), "https://a.espncdn.com/i/teamlogos/countries/500/kos.png");
  assert.equal(espnTeamLogo("fbk.kosovo", "trepca"), null);
});

test("monogramFor builds clean initials for Kosovo clubs without marks", () => {
  assert.equal(monogramFor("Sigal Prishtina"), "SP");
  assert.equal(monogramFor("Trepça"), "TR");
  assert.equal(monogramFor(""), "??");
});

test("buildBasketballMarketPlan emits exactly two distinct outcomes and LMSR-seeded quantities", () => {
  const plan = buildBasketballMarketPlan({ home: "Lakers", away: "Celtics", homeProb: 0.6, eventId: "401584793", league: "nba" });
  assert.equal(plan.sport_outcomes.length, 2);
  assert.deepEqual(plan.sport_outcomes.map((o) => o.key), ["HOME", "AWAY"]);
  assert.ok(Math.abs(plan.reference_probabilities.HOME - 0.6) < 1e-9);
  assert.ok(Math.abs(plan.reference_probabilities.HOME + plan.reference_probabilities.AWAY - 1) < 1e-9);
  assert.ok(Math.abs(plan.outcome_quantities.HOME - 100 * Math.log(0.6)) < 1e-9);
  assert.ok(Math.abs(plan.outcome_quantities.AWAY - 100 * Math.log(0.4)) < 1e-9);
  assert.equal(plan.live_event.provider, "espn");
  assert.equal(plan.live_event.league, "nba");
  assert.equal(plan.live_event.sport, "basketball");
});

test("buildBasketballMarketPlan clamps extreme probabilities and defaults to even", () => {
  const extreme = buildBasketballMarketPlan({ home: "A", away: "B", homeProb: 0.999 });
  assert.ok(extreme.reference_probabilities.HOME <= 0.97);
  assert.ok(extreme.reference_probabilities.AWAY >= 0.03);
  const even = buildBasketballMarketPlan({ home: "A", away: "B" });
  assert.ok(Math.abs(even.reference_probabilities.HOME - 0.5) < 1e-9);
});

test("classification helpers gate on live_basketball only", () => {
  assert.equal(isBasketballMarket({ market_classification: "live_basketball" }), true);
  assert.equal(isBasketballMarket({ market_classification: "live_football" }), false);
  assert.equal(
    basketballLeagueOf({ market_classification: "live_basketball", live_event: { league: "nba" } }),
    "nba"
  );
  assert.equal(basketballLeagueOf({ market_classification: "live_football", live_event: { league: "eng.1" } }), null);
});
