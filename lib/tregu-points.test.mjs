import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { basePoints, effectivePoints, milestone, pointsExample, streakLine, streakMultiplier } from "./tregu-points.mjs";

// The same sequences the 0097 rehearsal checks against the SQL.
function run(sequence, rulesVersion) {
  let streak = 0;
  return sequence.map(({ correct, boosted = false, points = 10 }) => {
    const earned = effectivePoints({ points, correct, streakBefore: streak, boosted, rulesVersion });
    streak = correct ? streak + 1 : 0;
    return earned;
  });
}

test("v1 leagues score exactly as before: points when right, 0 when wrong", () => {
  const six = Array.from({ length: 6 }, () => ({ correct: true }));
  assert.deepEqual(run([...six, { correct: false }], 1), [10, 10, 10, 10, 10, 10, 0]);
  assert.equal(effectivePoints({ points: 30, correct: true, boosted: true, rulesVersion: 1 }), 30);
});

test("v2 Seria: 3rd and 4th ×1.5, 5th and beyond ×2, a wrong pick resets", () => {
  const six = Array.from({ length: 6 }, () => ({ correct: true }));
  assert.deepEqual(run([...six, { correct: false }, { correct: true }], 2), [10, 10, 15, 15, 20, 20, 0, 10]);
});

test("v2 Kartë e artë doubles a correct pick, never a wrong one", () => {
  assert.equal(effectivePoints({ points: 30, correct: true, boosted: true, rulesVersion: 2 }), 60);
  assert.equal(effectivePoints({ points: 30, correct: false, boosted: true, rulesVersion: 2 }), 0);
  // Card on a streak pick: both apply.
  assert.equal(effectivePoints({ points: 40, correct: true, streakBefore: 4, boosted: true, rulesVersion: 2 }), 160);
});

test("multiplier counts the pick itself", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(streakMultiplier), [1, 1, 1.5, 1.5, 2, 2]);
});

test("base points mirror the SQL: 100 minus the probability, 1..99", () => {
  assert.equal(basePoints(0.6), 40);
  assert.equal(basePoints(0.15), 85);
  assert.equal(basePoints(0.999), 1);
  assert.equal(basePoints(0), 99);
  assert.deepEqual(pointsExample(0.7), { favourite: 30, surprise: 70 });
});

test("streak chip names what the next correct pick earns", () => {
  assert.match(streakLine(0), /e treta merr ×1.5/);
  assert.equal(streakLine(1), "🔥 1 në rresht · edhe 2 për ×1.5");
  assert.equal(streakLine(2), "🔥 2 në rresht · e saktë tjetër merr ×1.5");
  assert.equal(streakLine(4), "🔥 4 në rresht · e saktë tjetër merr ×2");
});

test("the road to 10€: reached and next milestones", () => {
  assert.equal(milestone(0).reached, null);
  assert.equal(milestone(0).next.at, 1000);
  assert.equal(milestone(0).toNext, 1000);
  assert.equal(milestone(5200).reached.at, 5000);
  assert.equal(milestone(5200).next.at, 7500);
  assert.equal(milestone(5200).toNext, 2300);
  assert.equal(milestone(12000).next, null);
});

test("SQL multiplier matches the JS one", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0097_tregu_points_v2.sql", import.meta.url), "utf8");
  assert.match(sql, /when p_streak >= 5 then 2\.0 when p_streak >= 3 then 1\.5 else 1\.0/);
});
