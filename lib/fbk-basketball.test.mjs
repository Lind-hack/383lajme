import { test } from "node:test";
import assert from "node:assert/strict";
import { fbkKickoff, findFbkLeagueUrl, parseFbkFixtures, fetchFbkFixtures, buildFbkMarkets, parseFbkStandings, fbkOpeningModel, normalizeFbkFixture } from "./fbk-basketball.mjs";
import { buildSportMarketPlan } from "./tregu-sport-market.mjs";

const url = "https://www.basketbolli.com/Results?leagueId=150";
const fixture = (date = "19/09/2026 19:00", score = "") => `<section><h2>JAVA I<span>.</span></h2><div class="match-row"><div class="team team-home"><h4 class="team-name">Rahoveci 029</h4><h4 class="team-score">${score}</h4></div><div class="team team-away"><h4 class="team-name">Trep&#xE7;a</h4><h4 class="team-score">${score}</h4></div></div><div class="match-date">${date}</div></section>`;

test("FBK follows the current men's competition rather than a stale season or women's league", () => {
  assert.equal(findFbkLeagueUrl('<a href="/Results?leagueId=151">SUPERLIGA FEMRAT</a><a href="/Results?leagueId=150">PROCREDIT SUPERLIGA</a>'), url);
  assert.throws(() => findFbkLeagueUrl('<a href="https://unrelated.example/Results?leagueId=150">PROCREDIT SUPERLIGA</a>'));
});

test("FBK tip-off conversion handles summer, winter and rejects invalid/ambiguous wall times", () => {
  assert.equal(fbkKickoff("19/09/2026 19:00"), "2026-09-19T17:00:00.000Z");
  assert.equal(fbkKickoff("19/12/2026 19:00"), "2026-12-19T18:00:00.000Z");
  for (const value of ["31/02/2026 19:00", "29/03/2026 02:30", "25/10/2026 02:30", "19/20.09.2026", "19/09/2026 24:99"]) assert.equal(fbkKickoff(value), null);
});

test("FBK preserves pairing, unknown scores and identity across rescheduling", () => {
  const [first] = parseFbkFixtures(fixture(), url);
  assert.equal(first.home_team, "Rahoveci 029");
  assert.equal(first.away_team, "Trepça");
  assert.equal(first.home_score, null);
  assert.equal(first.away_score, null);
  assert.equal(first.live_stats_url, null);
  const [rescheduled] = parseFbkFixtures(fixture("20/09/2026 20:00"), url);
  assert.equal(first.event_id, rescheduled.event_id);
  assert.notEqual(first.kickoff, rescheduled.kickoff);
  assert.equal(parseFbkFixtures(fixture() + fixture(), url).length, 1);
  assert.equal(parseFbkFixtures(fixture("TBC"), url).length, 0);
});

test("FBK distinguishes published scores from missing scores without claiming a final", () => {
  const [event] = parseFbkFixtures(fixture(undefined, "0"), url);
  assert.equal(event.home_score, 0);
  assert.equal(event.away_score, 0);
  assert.equal(event.status, undefined);
});

test("FBK discovery fetches the current season and surfaces outages", async () => {
  const requests = [];
  const events = await fetchFbkFixtures({ fetchImpl: async address => {
    requests.push(address);
    return { ok: true, text: async () => requests.length === 1 ? '<a href="/Results?leagueId=150">PROCREDIT SUPERLIGA</a>' : fixture() };
  } });
  assert.deepEqual(requests, ["https://www.basketbolli.com", url]);
  assert.equal(events.length, 1);
  await assert.rejects(fetchFbkFixtures({ fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
});

test("FBK publication includes upcoming two-outcome books with honest opening odds", () => {
  const events = parseFbkFixtures(fixture(), url);
  const [market] = buildFbkMarkets(events, { now: new Date("2026-09-17T00:00:00Z") });
  assert.equal(market.live_event.yes_team, "Rahoveci 029");
  assert.equal(market.live_event.provider, "fbk");
  assert.deepEqual(market.outcomes, ["home", "away"]);
  assert.equal(market.b, 6500);
  assert.match(market.pre_match_analysis.opening_model.method, /Neutral prior/);
  assert.equal(buildFbkMarkets(events, { now: new Date("2026-09-20T00:00:00Z") }).length, 0);
  assert.equal(buildFbkMarkets(events, { now: new Date("2026-08-01T00:00:00Z") }).length, 0);
  const start = Date.parse(events[0].kickoff);
  assert.equal(buildFbkMarkets(events, { now: new Date(start - 72 * 3600000 - 1) }).length, 0);
  assert.equal(buildFbkMarkets(events, { now: new Date(start - 72 * 3600000) }).length, 1);
  assert.equal(buildFbkMarkets(events, { now: new Date(start) }).length, 0);
  assert.equal(buildFbkMarkets([{ ...events[0], home_score: 80, away_score: 70 }], { now: new Date("2026-09-17T00:00:00Z") }).length, 0);
});

test("FBK standings require complete, internally consistent records", () => {
  const row = values => `<div class="full-width-row-wrapper"><h5>Trep&#xE7;a</h5>${values.map(v => `<p class="uppercase-paragraph table-paragraph">${v}</p>`).join("")}</div>`;
  assert.deepEqual(parseFbkStandings(row([10, 8, 2, 900, 800, 100, 18])), [{ team: "Trepça", played: 10, wins: 8, losses: 2, scored: 900, conceded: 800 }]);
  assert.deepEqual(parseFbkStandings(row([10, 9, 2, 900, 800, 100, 18])), []);
  assert.deepEqual(parseFbkStandings(row([10, 8, 2])), []);
});

test("FBK opening model responds symmetrically to observed team strength", () => {
  const event = { home_team: "A", away_team: "B", source_url: url };
  const standings = [{ team: "A", played: 10, wins: 8, losses: 2 }, { team: "B", played: 10, wins: 3, losses: 7 }];
  const model = fbkOpeningModel(event, standings);
  assert.ok(model.probabilities.home > .5);
  assert.equal(model.probabilities.home + model.probabilities.away, 1);
  const reverse = fbkOpeningModel({ ...event, home_team: "B", away_team: "A" }, standings);
  assert.ok(Math.abs(reverse.probabilities.home - model.probabilities.away) < 1e-12);
  assert.deepEqual(fbkOpeningModel(event, []).probabilities, { home: .5, away: .5 });
  assert.match(model.method, /not bookmaker odds/);
});

test("FBK scheduled and unavailable observations never price or settle a provisional score", () => {
  const [fixtureEvent] = parseFbkFixtures(fixture(), url);
  const [market] = buildFbkMarkets([fixtureEvent], { now: new Date("2026-09-17T00:00:00Z") });
  for (const now of [new Date("2026-09-08T00:00:00Z"), new Date("2026-09-20T00:00:00Z")]) {
    const event = normalizeFbkFixture({ ...fixtureEvent, home_score: 90, away_score: 80 }, now);
    const [signal] = buildSportMarketPlan({ markets: [market], events: [event], now });
    assert.equal(signal.kind, "no_score");
    assert.equal(signal.close_market, false);
    assert.equal(signal.snapshot, undefined);
    assert.equal(event.competitors[0].score, null);
    assert.equal(event.supplemental.fbk.observed_scores.home, 90);
    assert.equal(buildSportMarketPlan({ markets: [market], events: [{ ...event, provider: "espn" }], now }).length, 0);
  }
});
