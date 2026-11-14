import { test } from "node:test";
import assert from "node:assert/strict";
import { NBA_GAMES_PER_NIGHT, NBA_TEAM_GROUPS, nbaGroupIndexFor, nbaGameInRotation, selectNbaGames, splitTeamName } from "./nba-rotation.mjs";

const ALL_30 = [
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GS",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NO", "NY",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SA", "TOR", "UTAH", "WSH",
];

test("three groups of ten cover every NBA team exactly once (ESPN abbreviations)", () => {
  assert.equal(NBA_TEAM_GROUPS.length, 3);
  for (const group of NBA_TEAM_GROUPS) assert.equal(group.length, 10);
  assert.deepEqual([...NBA_TEAM_GROUPS.flat()].sort(), [...ALL_30].sort());
});

test("the group turns over each Kosovo day, A then B then C, and repeats", () => {
  const day = (d) => nbaGroupIndexFor(`2026-11-${String(d).padStart(2, "0")}T20:00:00Z`);
  const a = day(14);
  assert.equal(day(15), (a + 1) % 3);
  assert.equal(day(16), (a + 2) % 3);
  assert.equal(day(17), a);
});

test("a night runs noon to noon in Prishtina: a 22:00 and a 02:00 tip-off are the same night", () => {
  // 21:00 UTC is 22:00 in Prishtina; 01:00 UTC the next day is 02:00.
  assert.equal(nbaGroupIndexFor("2026-11-15T21:00:00Z"), nbaGroupIndexFor("2026-11-16T01:00:00Z"));
  // Noon is where one night hands over to the next.
  assert.notEqual(nbaGroupIndexFor("2026-11-16T10:30:00Z"), nbaGroupIndexFor("2026-11-16T11:30:00Z"));
});

test("a game is in when either team belongs to that day's group, out when neither does", () => {
  const kickoff = "2026-11-14T20:00:00Z";
  const today = NBA_TEAM_GROUPS[nbaGroupIndexFor(kickoff)];
  const other = NBA_TEAM_GROUPS[(nbaGroupIndexFor(kickoff) + 1) % 3];
  const third = NBA_TEAM_GROUPS[(nbaGroupIndexFor(kickoff) + 2) % 3];
  assert.equal(nbaGameInRotation({ home: today[0], away: other[0], kickoff }), true);
  assert.equal(nbaGameInRotation({ home: other[0], away: today[1], kickoff }), true);
  assert.equal(nbaGameInRotation({ home: other[0], away: third[0], kickoff }), false);
});

test("a team ESPN renames is never dropped for good: an unknown abbreviation counts as in", () => {
  const kickoff = "2026-11-14T20:00:00Z";
  const other = NBA_TEAM_GROUPS[(nbaGroupIndexFor(kickoff) + 1) % 3];
  assert.equal(nbaGameInRotation({ home: "XYZ", away: other[0], kickoff }), true);
  assert.equal(nbaGameInRotation({ home: undefined, away: other[0], kickoff }), true);
});

test("a game with no usable kickoff is kept rather than silently lost", () => {
  assert.equal(nbaGameInRotation({ home: "BOS", away: "LAL", kickoff: "not a date" }), true);
});

test("team names split into the city and the name fans call the team", () => {
  assert.deepEqual(splitTeamName("New Orleans Pelicans"), { city: "New Orleans", name: "Pelicans" });
  assert.deepEqual(splitTeamName("Portland Trail Blazers"), { city: "Portland", name: "Trail Blazers" });
  assert.deepEqual(splitTeamName("Philadelphia 76ers"), { city: "Philadelphia", name: "76ers" });
  assert.deepEqual(splitTeamName("Lakers"), { city: "", name: "Lakers" });
  assert.deepEqual(splitTeamName(""), { city: "", name: "" });
});


test("a night carries at most three NBA games (six teams), the day's group first", () => {
  assert.equal(NBA_GAMES_PER_NIGHT, 3);
  const kickoff = (h) => `2026-11-15T0${h}:00:00Z`; // all the same Kosovo night
  const g = nbaGroupIndexFor(kickoff(1));
  const today = NBA_TEAM_GROUPS[g], other = NBA_TEAM_GROUPS[(g + 1) % 3], third = NBA_TEAM_GROUPS[(g + 2) % 3];
  const games = [
    { id: "out", home: other[0], away: third[0], kickoff: kickoff(1) },
    { id: "one-a", home: today[0], away: other[1], kickoff: kickoff(1) },
    { id: "one-b", home: other[2], away: today[1], kickoff: kickoff(2) },
    { id: "both", home: today[2], away: today[3], kickoff: kickoff(3) },
    { id: "one-c", home: today[4], away: third[1], kickoff: kickoff(2) },
    { id: "one-d", home: third[2], away: today[5], kickoff: kickoff(1) },
    { id: "one-e", home: today[6], away: other[3], kickoff: kickoff(3) },
    { id: "one-f", home: today[7], away: third[3], kickoff: kickoff(4) },
  ];
  const picked = selectNbaGames(games).map((game) => game.id);
  assert.equal(picked.length, 3);
  assert.ok(!picked.includes("out"));
  assert.equal(picked[0], "both");
  // Earliest tip-offs win the remaining places.
  assert.deepEqual(picked.slice(1).sort(), ["one-a", "one-d"].sort());
});

test("each Kosovo night is capped on its own", () => {
  const nights = ["2026-11-15T01:00:00Z", "2026-11-16T01:00:00Z"];
  const games = nights.flatMap((kickoff) => {
    const group = NBA_TEAM_GROUPS[nbaGroupIndexFor(kickoff)];
    return [0, 2, 4, 6, 8].map((i) => ({ id: `${kickoff}-${i}`, home: group[i], away: group[i + 1], kickoff }));
  });
  assert.equal(selectNbaGames(games).length, 6);
});
