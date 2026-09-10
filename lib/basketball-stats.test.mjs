import { test } from "node:test";
import assert from "node:assert/strict";
import { basketballStats, buildBasketballMetricRows } from "./basketball-stats.mjs";
import { discoverBasketball } from "./basketball-live.mjs";

test("basketball shooting pairs retain attempts and derive two-point shots", () => {
  const result = basketballStats([
    { name: "fieldGoalsMade-fieldGoalsAttempted", displayValue: "40-85" },
    { name: "threePointFieldGoalsMade-threePointFieldGoalsAttempted", displayValue: "12-32" },
    { name: "freeThrowsMade-freeThrowsAttempted", displayValue: "18-20" },
    { name: "assists", displayValue: "26" },
  ]);
  assert.equal(result.field_goals_attempted, 85);
  assert.equal(result.two_pointers_made, 28);
  assert.equal(result.two_pointers_attempted, 53);
  assert.equal(result.three_pointers_made, 12);
  assert.equal(result.free_throws_attempted, 20);
  assert.equal(result.assists, 26);
  assert.equal(result.rebounds, undefined);
});

test("missing or inconsistent basketball stats remain unavailable", () => {
  assert.deepEqual(basketballStats([{ name: "assists", displayValue: "—" }, { name: "freeThrowsMade-freeThrowsAttempted", displayValue: "9-2" }]), {});
  assert.deepEqual(basketballStats([{ name: "assists", displayValue: "0" }]), { assists: 0 });
});

test("basketball bars distinguish missing values from measured zero", () => {
  const rows = buildBasketballMetricRows({ points: 82, assists: 0, rebounds: null }, { points: 79, assists: 3 });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { label: "Pikët", home: 82, away: 79, homeText: undefined, awayText: undefined });
  assert.equal(rows[1].home, 0);
  assert.equal(rows[1].homeText, undefined);
  assert.equal(buildBasketballMetricRows({ assists: 2 }, {})[0].awayText, "—");
  assert.deepEqual(buildBasketballMetricRows({ assists: null }, { assists: undefined }), []);
});

test("automatic NBA fixtures satisfy required database team mapping", async () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const rows = await discoverBasketball({ now, fetchImpl: async () => ({ ok: true, json: async () => ({ events: [{ id: "123", date: "2026-10-21T00:00:00Z", competitions: [{ status: { type: { state: "pre" } }, competitors: [{ homeAway: "home", team: { displayName: "Home" } }, { homeAway: "away", team: { displayName: "Away" } }] }] }] }) }) });
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.live_event.yes_team, row.live_event.home_team);
    assert.equal(row.sport_outcomes.length, 2);
    assert.deepEqual(Object.keys(row.reference_probabilities), ["home", "away"]);
  }
});
