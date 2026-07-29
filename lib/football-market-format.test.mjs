import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyFootballFixture,
  footballMarketQuestion,
  footballOutcomes,
} from "./football-market-format.mjs";
import {
  buildUpcomingFootballTemplate,
  fetchUpcomingEspnFootballFixtures,
} from "./espn-upcoming-football.mjs";

const teams = {
  home: { name: "Arsenal", color: "e20520" },
  away: { name: "Real Madrid", color: "ffffff" },
};

test("domestic leagues and tournament league phases are three-way match-result markets", () => {
  for (const fixture of [
    { ...teams, league: "eng.1", season_slug: "2026-27-english-premier-league" },
    { ...teams, league: "esp.1", season_slug: "2026-27-spanish-laliga" },
    { ...teams, league: "ita.1", season_slug: "2026-27-italian-serie-a" },
    { ...teams, league: "ger.1", season_slug: "2026-27-german-bundesliga" },
    { ...teams, league: "uefa.champions", season_slug: "league-phase" },
  ]) {
    const format = classifyFootballFixture(fixture);
    assert.equal(format.outcomeMode, "three_way");
    assert.equal(format.drawAllowed, true);
    assert.deepEqual(footballOutcomes(fixture, format).map(({ key }) => key), ["home", "draw", "away"]);
  }
});

test("knockout first legs allow a draw while second legs decide qualification", () => {
  const first = classifyFootballFixture({
    ...teams,
    league: "uefa.champions",
    season_slug: "quarterfinals",
    leg: { value: 1, displayValue: "1st Leg" },
    series: { title: "Quarterfinals", total_competitions: 2 },
  });
  const secondFixture = {
    ...teams,
    league: "uefa.champions",
    season_slug: "quarterfinals",
    leg: { value: 2, displayValue: "2nd Leg" },
    series: { title: "Quarterfinals", total_competitions: 2 },
  };
  const second = classifyFootballFixture(secondFixture);

  assert.equal(first.outcomeMode, "three_way");
  assert.equal(first.marketIntent, "match_result");
  assert.equal(second.outcomeMode, "two_way");
  assert.equal(second.marketIntent, "to_qualify");
  assert.equal(second.resolutionBasis, "aggregate_then_extra_time_then_penalties");
  assert.deepEqual(footballOutcomes(secondFixture, second).map(({ key }) => key), ["home", "away"]);
  assert.match(footballMarketQuestion(secondFixture, second), /kush kualifikohet/);
});

test("single-leg finals are decisive but ambiguous tournament fixtures fail safe to three outcomes", () => {
  assert.equal(
    classifyFootballFixture({ ...teams, league: "uefa.europa", season_slug: "final" }).outcomeMode,
    "two_way"
  );
  assert.equal(
    classifyFootballFixture({ ...teams, league: "uefa.europa", season_slug: "tournament" }).outcomeMode,
    "three_way"
  );
});

test("generated templates persist their resolution contract and database-compatible outcomes", () => {
  const template = buildUpcomingFootballTemplate({
    ...teams,
    event_id: "733615",
    kickoff: "2026-08-01T19:00:00.000Z",
    league: "uefa.champions",
    league_label: "UEFA Champions League",
    season_slug: "quarterfinals",
    leg: { value: 2, displayValue: "2nd Leg" },
    series: { title: "Quarterfinals", total_competitions: 2 },
    source_url: "https://site.api.espn.com/example",
  });

  assert.equal(template.status, "open");
  assert.equal(template.market_type, "two_outcome");
  assert.deepEqual(template.outcomes, ["home", "away"]);
  assert.equal(template.live_event.football_format.marketIntent, "to_qualify");
  assert.equal(template.live_event.yes_team, "Arsenal");
  assert.match(template.resolution_rules, /aggregate|penalt/i);
});

test("ESPN discovery retains structured stage, leg, series, team color, and aggregate metadata", async () => {
  const event = {
    id: "733615",
    date: "2026-08-01T19:00:00.000Z",
    season: { slug: "quarterfinals" },
    competitions: [{
      leg: { value: 2, displayValue: "2nd Leg" },
      series: { title: "Quarterfinals", totalCompetitions: 2 },
      notes: [{ headline: "2nd Leg" }],
      competitors: [
        { id: "110", homeAway: "home", aggregateScore: 4, team: { id: "110", displayName: "Internazionale", abbreviation: "INT", color: "00239c" } },
        { id: "132", homeAway: "away", aggregateScore: 3, team: { id: "132", displayName: "Bayern Munich", abbreviation: "MUN", color: "dc052d" } },
      ],
    }],
  };
  const fixtures = await fetchUpcomingEspnFootballFixtures({
    now: new Date("2026-07-31T12:00:00.000Z"),
    windowHours: 48,
    fetchImpl: async (url) => ({
      ok: true,
      json: async () => String(url).includes("/uefa.champions/") ? { events: [event] } : { events: [] },
    }),
  });

  assert.equal(fixtures.length, 1);
  assert.equal(fixtures[0].leg.value, 2);
  assert.equal(fixtures[0].series.total_competitions, 2);
  assert.equal(fixtures[0].home.aggregate_score, 4);
  assert.equal(fixtures[0].home.color, "00239c");
  assert.equal(buildUpcomingFootballTemplate(fixtures[0]).market_type, "two_outcome");
});
