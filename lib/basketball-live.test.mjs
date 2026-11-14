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

test("NBA discovery asks ESPN one day at a time (ranges answer 400) and lists each game once", async () => {
  const { discoverBasketball } = await import("./basketball-live.mjs");
  const now = new Date("2026-11-01T14:00:00Z");
  const asked = [];
  const event = { id: "401909903", date: "2026-11-01T20:30Z", competitions: [{ status: { type: { state: "pre" } }, competitors: [
    { homeAway: "home", team: { displayName: "Orlando Magic" } }, { homeAway: "away", team: { displayName: "Boston Celtics" } }] }] };
  const fetchImpl = async (url) => {
    asked.push(String(url));
    const dates = new URL(url).searchParams.get("dates");
    if (dates.includes("-")) return new Response('{"code":400}', { status: 400 });
    return Response.json({ events: String(url).includes("/nba/") && dates <= "20261102" ? [event] : [] });
  };
  const markets = await discoverBasketball({ now, fetchImpl });
  assert.ok(asked.every((u) => /dates=\d{8}&/.test(u)));
  assert.deepEqual(markets.map((m) => m.slug), ["basketball-nba-401909903"]);
});

test("NBA discovery opens only the games in the day's team rotation; FIBA is untouched", async () => {
  const { discoverBasketball } = await import("./basketball-live.mjs");
  const { NBA_TEAM_GROUPS, nbaGroupIndexFor } = await import("./nba-rotation.mjs");
  const now = new Date("2026-11-14T10:00:00Z");
  const tip = "2026-11-14T20:00Z";
  const g = nbaGroupIndexFor(tip);
  const today = NBA_TEAM_GROUPS[g], other = NBA_TEAM_GROUPS[(g + 1) % 3], third = NBA_TEAM_GROUPS[(g + 2) % 3];
  const game = (id, home, away) => ({ id, date: tip, competitions: [{ status: { type: { state: "pre" } }, competitors: [
    { homeAway: "home", team: { displayName: `Home ${home}`, abbreviation: home } },
    { homeAway: "away", team: { displayName: `Away ${away}`, abbreviation: away } }] }] });
  const nba = [game("1", today[0], other[0]), game("2", other[1], third[1]), game("3", third[2], today[2])];
  const fiba = [game("9", "ALB", "KOS")];
  const fetchImpl = async (url) => {
    const day = new URL(url).searchParams.get("dates");
    if (day !== "20261114") return Response.json({ events: [] });
    return Response.json({ events: String(url).includes("/nba/") ? nba : fiba });
  };
  const slugs = (await discoverBasketball({ now, fetchImpl })).map((m) => m.slug).sort();
  assert.deepEqual(slugs, ["basketball-fiba-world-9", "basketball-nba-1", "basketball-nba-3"]);
});

test("the NBA night's five are chosen from its whole schedule: games already under way still use their places", async () => {
  const { discoverBasketball } = await import("./basketball-live.mjs");
  const { NBA_TEAM_GROUPS, nbaGroupIndexFor } = await import("./nba-rotation.mjs");
  const night = (h) => `2026-11-15T0${h}:00Z`;
  const now = new Date("2026-11-15T02:30:00Z"); // the 01:00 and 02:00 games have tipped off
  const group = NBA_TEAM_GROUPS[nbaGroupIndexFor(night(1))];
  const other = NBA_TEAM_GROUPS[(nbaGroupIndexFor(night(1)) + 1) % 3];
  const game = (id, home, away, at, state) => ({ id, date: at, competitions: [{ status: { type: { state } }, competitors: [
    { homeAway: "home", team: { displayName: `H${id}`, abbreviation: home } },
    { homeAway: "away", team: { displayName: `A${id}`, abbreviation: away } }] }] });
  const events = [
    game("1", group[0], other[0], night(1), "in"),
    game("2", group[1], other[1], night(2), "in"),
    game("3", group[2], other[2], night(3), "pre"),
    game("4", group[3], other[3], night(3), "pre"),
    game("5", group[4], other[4], night(4), "pre"),
    game("6", group[5], other[5], night(5), "pre"),
    game("7", group[6], other[6], night(5), "pre"),
  ];
  const fetchImpl = async (url) => Response.json({ events: String(url).includes("/nba/") && String(url).includes("dates=20261115") ? events : [] });
  const slugs = (await discoverBasketball({ now, fetchImpl })).map((m) => m.slug).sort();
  assert.deepEqual(slugs, ["basketball-nba-3", "basketball-nba-4", "basketball-nba-5"]);
});
