import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  pickPoints, potSplit, privateBonusPct, privatePurse, leaguePrizes, leaguePurse, leaguePhase,
  leagueFamilyLabel, leagueColor, isImageEmblem, leagueError, publicLeaguePrizes, LEAGUE_CODE_PATTERN,
} from "./tregu-leagues.ts";

// 19 files import this module and nothing ran it: these pin what the cards
// promise to what the SQL settlement pays.

test("pickPoints: 100 minus the probability, clamped to 1..99", () => {
  assert.equal(pickPoints(0.3), 70);
  assert.equal(pickPoints(0.995), 1);
  assert.equal(pickPoints(0.004), 99);
  assert.equal(pickPoints(0), 50); // 0 reads as unknown, like null
  assert.equal(pickPoints(null), 50);
  assert.equal(pickPoints(Number.NaN), 50);
});

test("potSplit pays the whole pot 50/30/20, renormalised when fewer than three score", () => {
  assert.deepEqual(potSplit(1000, 10), [500, 300, 200]);
  assert.deepEqual(potSplit(1001, 10), [501, 300, 200]);
  assert.deepEqual(potSplit(100, 2), [63, 37]);
  assert.deepEqual(potSplit(100, 1), [100]);
  assert.deepEqual(potSplit(0, 5), []);
  assert.deepEqual(potSplit(100, 0), []);
  for (const pot of [7, 99, 1234]) for (const n of [1, 2, 3]) assert.equal(potSplit(pot, n).reduce((a, b) => a + b, 0), pot);
});

test("the settlement SQL splits with the same 50/30/20", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0095_tregu_leagues_open.sql", import.meta.url), "utf8");
  assert.match(sql, /array\[50, 30, 20\]::numeric\[\]/);
});

test("private bonus follows tregu_private_bonus_pct (0090)", () => {
  assert.equal(privateBonusPct(7), 15);
  assert.equal(privateBonusPct(7.5), 15);
  assert.equal(privateBonusPct(14), 25);
  assert.equal(privateBonusPct(30), 40);
  const sql = readFileSync(new URL("../supabase/migrations/0090_tregu_kickoff_lock_sponsors_player_mail.sql", import.meta.url), "utf8");
  assert.match(sql, /<= 7\.5 \* 86400 then 15/);
  assert.match(sql, /<= 15 \* 86400 then 25/);
  assert.match(sql, /else 40/);
  assert.equal(privatePurse(1000, 7), 1150);
});

const day = (offset) => new Date(Date.UTC(2026, 9, 3) + offset * 86_400_000).toISOString();

test("leaguePrizes: public pays 383's prizes plus the fee pot, private its purse", () => {
  const pub = { kind: "public", prizes: [125, 75, 40], pot: 100, members: 9, starts_at: day(0), ends_at: day(7) };
  assert.deepEqual(leaguePrizes(pub), [175, 105, 60]);
  assert.equal(leaguePurse(pub), 340);
  const priv = { kind: "private", prizes: null, pot: 1000, members: 2, starts_at: day(0), ends_at: day(7) };
  assert.deepEqual(leaguePrizes(priv), potSplit(1150, 2));
  assert.deepEqual(publicLeaguePrizes(7), [125, 75, 40]);
  assert.deepEqual(publicLeaguePrizes(30), [500, 300, 150]);
});

test("leaguePhase", () => {
  const now = Date.parse(day(1));
  assert.equal(leaguePhase({ starts_at: day(2), ends_at: day(5) }, now), "upcoming");
  assert.equal(leaguePhase({ starts_at: day(0), ends_at: day(5) }, now), "live");
  assert.equal(leaguePhase({ starts_at: day(0), ends_at: day(1) }, now), "ended");
  assert.equal(leaguePhase({ starts_at: day(0), ends_at: day(5), settled: true }, now), "ended");
});

test("labels, colours, emblems and errors", () => {
  assert.equal(leagueFamilyLabel("competition", "nba"), "e basketbollit");
  assert.equal(leagueFamilyLabel("competition", "eng.1"), "e futbollit");
  assert.equal(leagueFamilyLabel("category", "kosove"), "e kategorisë Kosovë");
  assert.equal(leagueFamilyLabel(null, null), "me të gjitha tregjet");
  assert.equal(leagueColor({ color: "#123ABC", kind: "public" }), "#123ABC");
  assert.equal(leagueColor({ color: "nope", kind: "private" }), "#F2C14E");
  assert.equal(leagueColor({ color: null, kind: "public", scope_kind: "f1", scope_value: null }), "#E10600");
  assert.ok(isImageEmblem("/logos/f1.svg"));
  assert.ok(!isImageEmblem("🏆"));
  assert.equal(leagueError({ message: "Liga është plot." }), "Liga është plot.");
  assert.equal(leagueError(new Error("fetch failed")), "Diçka nuk shkoi. Provo përsëri.");
  assert.ok(LEAGUE_CODE_PATTERN.test("ABC234"));
  assert.ok(!LEAGUE_CODE_PATTERN.test("ABCI10"));
});
