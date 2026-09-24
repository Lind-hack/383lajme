import { test } from "node:test";
import assert from "node:assert/strict";
import { basketballWinProbability, basketballStatPressure } from "./basketball-live.mjs";

const stats = (overrides = {}) => ({
  field_goals_made: 20, field_goals_attempted: 45, three_pointers_made: 6,
  free_throws_attempted: 10, rebounds: 22, offensive_rebounds: 6, turnovers: 7, ...overrides,
});
const game = ({ period, clock, home, away, homeStats, awayStats }) => ({
  league: "fbk.kosovo", period, clock_seconds: clock,
  competitors: [{ team: "Trepça", homeAway: "home", score: home }, { team: "Peja", homeAway: "away", score: away }],
  metrics: homeStats ? { Trepça: homeStats, Peja: awayStats } : {},
});

test("better shooting and boards nudge a tied game, never flip the scoreboard", () => {
  const plain = basketballWinProbability(game({ period: 2, clock: 300, home: 40, away: 40 }));
  const edge = basketballWinProbability(game({ period: 2, clock: 300, home: 40, away: 40,
    homeStats: stats({ field_goals_made: 24, offensive_rebounds: 10, turnovers: 4 }), awayStats: stats() }));
  assert.ok(edge > plain, "better process should lift a tied game");
  assert.ok(edge - plain <= .04, "the stat edge stays inside its four-point bound");
  const trailing = basketballWinProbability(game({ period: 4, clock: 120, home: 60, away: 72,
    homeStats: stats({ field_goals_made: 30 }), awayStats: stats({ field_goals_made: 12 }) }));
  assert.ok(trailing < .1, "a twelve-point deficit late stays a long shot");
});

test("stat pressure fades to nothing at the horn", () => {
  const homeStats = stats({ field_goals_made: 30, offensive_rebounds: 15 });
  const awayStats = stats({ field_goals_made: 10, turnovers: 20 });
  const end = game({ period: 4, clock: 0, home: 70, away: 69, homeStats, awayStats });
  assert.equal(basketballWinProbability(end), basketballWinProbability({ ...end, metrics: {} }));
});

test("missing or thin stats leave the score-and-clock model exactly as it was", () => {
  const base = game({ period: 3, clock: 400, home: 55, away: 50 });
  assert.equal(basketballWinProbability({ ...base, metrics: { Trepça: stats() } }), basketballWinProbability(base));
  assert.equal(basketballStatPressure(undefined, stats()), 0);
  // Five shots each is noise: shooting is ignored until both sides have ten.
  assert.equal(basketballStatPressure({ field_goals_made: 5, field_goals_attempted: 5 }, { field_goals_made: 0, field_goals_attempted: 5 }), 0);
});

test("stat pressure is symmetric between the two teams", () => {
  const a = stats({ field_goals_made: 25, offensive_rebounds: 9 }), b = stats({ turnovers: 12 });
  assert.equal(basketballStatPressure(a, b), -basketballStatPressure(b, a));
});
