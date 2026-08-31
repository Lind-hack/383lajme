import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildChampionshipMarketTemplate, buildChampionshipModel, championshipDecision } from "./f1-championship.mjs";

const drivers = [
  { driver_number: 1, name_acronym: "AAA", full_name: "Arbër A", team_name: "Orange", team_colour: "FF4422" },
  { driver_number: 2, name_acronym: "BBB", full_name: "Blerim B", team_name: "Ink", team_colour: "111111" },
  { driver_number: 3, name_acronym: "CCC", full_name: "Dren C", team_name: "Orange", team_colour: "FF4422" },
];

const standings = [
  { driver_number: 1, points_current: 240, points_start: 215, position_current: 1, position_start: 2 },
  { driver_number: 2, points_current: 190, points_start: 225, position_current: 2, position_start: 1 },
  { driver_number: 3, points_current: 130, points_start: 120, position_current: 3, position_start: 3 },
];

const laps = drivers.flatMap((driver, driverIndex) => Array.from({ length: 20 }, (_, index) => ({
  driver_number: driver.driver_number,
  lap_number: index + 1,
  lap_duration: 80 + driverIndex * 1.5 + (index % 3) * 0.1,
  st_speed: 330 - driverIndex * 6,
  is_pit_out_lap: false,
})));

function context(overrides = {}) {
  return {
    year: 2026,
    latestRaceSessionKey: 100,
    latestRace: { session_key: 100, meeting_key: 90, circuit_short_name: "Zandvoort", date_end: "2026-08-30T15:00:00Z" },
    latestRaceResult: [
      { driver_number: 1, position: 1 },
      { driver_number: 2, position: 11 },
      { driver_number: 3, position: 5 },
    ],
    drivers,
    standings,
    teamStandings: [
      { team_name: "Orange", points_current: 370 },
      { team_name: "Ink", points_current: 190 },
    ],
    recentRaces: [{ standings, laps }],
    trackBaselines: [{ meeting_key: 200, laps }],
    remainingEvents: [
      { sprint: false, meeting: { meeting_key: 200, circuit_short_name: "Monza", circuit_type: "Permanent" } },
      { sprint: false, meeting: { meeting_key: 201, circuit_short_name: "Madring", circuit_type: "Temporary - Street" } },
    ],
    stateKey: "fixture",
    ...overrides,
  };
}

test("title decision requires a lead larger than every remaining maximum", () => {
  assert.equal(championshipDecision(standings, context().remainingEvents).decided, false);
  const decided = championshipDecision(
    [{ ...standings[0], points_current: 300 }, standings[1]],
    [{ sprint: false }]
  );
  assert.equal(decided.decided, true);
  assert.equal(decided.winnerDriverNumber, 1);
});

test("the deterministic model combines points, form, car pace, reliability and track simulations", () => {
  const first = buildChampionshipModel(context(), { simulations: 1200 });
  const second = buildChampionshipModel(context(), { simulations: 1200 });
  assert.deepEqual(first.probabilities, second.probabilities);
  assert.ok(first.probabilities.AAA > first.probabilities.BBB);
  assert.ok(Math.abs(Object.values(first.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 1e-9);
  assert.equal(first.model.tracks.length, 2);
  assert.equal(first.model.racesRemaining, 2);
  assert.ok(first.model.drivers.every((driver) => ["recentForm", "driverPace", "speedIndex", "constructorIndex", "reliability"].every((key) => Number.isFinite(driver[key]))));
  const leader = first.outcomes.find((outcome) => outcome.key === "AAA");
  const formerLeader = first.outcomes.find((outcome) => outcome.key === "BBB");
  assert.equal(leader.latest_race_points, 25);
  assert.equal(leader.weekend_points, 25);
  assert.equal(leader.gap_to_leader, 0);
  assert.equal(leader.gap_change, 10);
  assert.equal(formerLeader.latest_race_points, 0);
  assert.equal(formerLeader.gap_change, -50);
  assert.deepEqual(first.model.latestRace.pointsScale, [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
});

test("a mathematically decided title produces a single winner", () => {
  const model = buildChampionshipModel(context({
    standings: [
      { ...standings[0], points_current: 300 },
      { ...standings[1], points_current: 200 },
      standings[2],
    ],
    remainingEvents: [{ sprint: false, meeting: { meeting_key: 200, circuit_short_name: "Monza" } }],
  }), { simulations: 200 });
  assert.ok(model.probabilities.AAA > 0.999);
  assert.equal(model.model.decided, true);
});

test("the persistent championship template uses the proven F1 winner book", () => {
  const championship = buildChampionshipModel(context(), { simulations: 200 });
  championship.outcomes = Array.from({ length: 20 }, (_, index) => ({ key: `AA${String.fromCharCode(65 + index)}`, label: `Driver ${index + 1}` }));
  championship.probabilities = Object.fromEntries(championship.outcomes.map((outcome) => [outcome.key, 1 / championship.outcomes.length]));
  championship.context = { year: 2026, closesAt: "2026-12-06T15:00:00Z" };
  const template = buildChampionshipMarketTemplate(championship, { now: new Date("2026-08-31T12:00:00Z") });
  assert.equal(template.status, "open");
  assert.equal(template.market_type, "f1_race_winner");
  assert.equal(template.live_event.event_kind, "championship");
  assert.equal(template.live_event.source_provider, "OpenF1");
  assert.equal(template.sport_outcomes.length, 20);
  assert.ok(Object.values(template.outcome_quantities).every(Number.isFinite));
});

test("automation and settlement keep the title market active until mathematically decided", () => {
  const server = readFileSync(new URL("./tregu-automation-server.ts", import.meta.url), "utf8");
  const detailPage = readFileSync(new URL("../app/tregu/[slug]/page.tsx", import.meta.url), "utf8");
  const detailApi = readFileSync(new URL("../app/api/tregu/markets/[slug]/route.ts", import.meta.url), "utf8");
  const hubApi = readFileSync(new URL("../app/api/tregu/markets/route.ts", import.meta.url), "utf8");
  const hubCard = readFileSync(new URL("../components/tregu/market-mini-card.tsx", import.meta.url), "utf8");
  assert.match(server, /runF1ChampionshipAutomation/);
  assert.match(server, /championship\.model\.decided/);
  assert.match(server, /status: "closed"/);
  assert.match(server, /event_kind: "championship", source_provider: "OpenF1"/);
  assert.match(server, /live_score_state->>key/);
  assert.match(server, /rpc\("settle_due_sport_markets"\)/);
  assert.match(server, /runF1ChampionshipAutomation\(now\)/);
  assert.match(server, /15 \* 60_000/);
  assert.match(server, /Math\.floor\(now\.getUTCHours\(\) \/ 6\)/);
  assert.match(server, /sport_outcomes: template\.sport_outcomes/);
  assert.match(detailPage, /max-width: 859px/);
  assert.match(detailPage, /setMobileTradeOpen\(true\)/);
  assert.match(detailApi, /lmsrSportOutcomePrices/);
  assert.match(detailApi, /gap_to_leader/);
  assert.match(hubApi, /hasF1OutcomeBook/);
  assert.match(hubApi, /sportOutcomes\.length >= 20/);
  assert.match(hubCard, /data-championship/);
  assert.match(hubCard, /Hap tregun e titullit/);
});
