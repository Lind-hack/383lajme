import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOUNCE_S,
  FULL_WEIGHT,
  OPEN_WEIGHT,
  countWords,
  expectedSeconds,
  visitWeight,
  weightToAdd,
} from "./reading-engagement.mjs";
import { nudgeAffinity, readingStats, recordRead, AFFINITY_HALF_LIFE_MS } from "./interests.mjs";

test("a bounce counts as opening the story, never more", () => {
  assert.equal(visitWeight({ engagedS: 0, depth: 0, words: 600 }), OPEN_WEIGHT);
  assert.equal(visitWeight({ engagedS: BOUNCE_S - 1, depth: 1, words: 600 }), OPEN_WEIGHT);
});

test("eleven seconds and eleven minutes no longer weigh the same", () => {
  const skim = visitWeight({ engagedS: 11, depth: 0.2, words: 800 });
  const read = visitWeight({ engagedS: 660, depth: 1, words: 800 });
  assert.ok(read > skim * 2, `${read} vs ${skim}`);
  assert.equal(read, FULL_WEIGHT);
});

test("more time or more depth never gives less weight", () => {
  let last = 0;
  for (let s = 0; s <= 600; s += 15) {
    const w = visitWeight({ engagedS: s, depth: 0.5, words: 700 });
    assert.ok(w >= last);
    last = w;
  }
  last = 0;
  for (let d = 0; d <= 1; d += 0.1) {
    const w = visitWeight({ engagedS: 60, depth: d, words: 700 });
    assert.ok(w >= last);
    last = w;
  }
});

test("the same minutes are a full read of a short story and a skim of a long one", () => {
  const short = visitWeight({ engagedS: 60, depth: 1, words: 150 });
  const long = visitWeight({ engagedS: 60, depth: 1, words: 2000 });
  assert.equal(short, FULL_WEIGHT);
  assert.ok(long < short);
});

test("junk in, a weight in range out", () => {
  for (const v of [null, undefined, {}, { engagedS: "x" }, { engagedS: -5, depth: 9 }, { engagedS: 1e12, depth: NaN, words: -1 }]) {
    const w = visitWeight(/** @type {any} */ (v));
    assert.ok(w >= OPEN_WEIGHT && w <= FULL_WEIGHT, String(w));
  }
  assert.ok(expectedSeconds(NaN) > 0);
});

test("repeated flushes add only what the visit gained", () => {
  let credited = 0;
  let total = 0;
  for (const weight of [0.25, 0.9, 0.9, 1.4]) {
    const add = weightToAdd(credited, weight);
    credited += add;
    total += add;
  }
  assert.equal(total, 1.4);
  assert.equal(weightToAdd(2, 1), 0);
});

test("countWords", () => {
  assert.equal(countWords("  një  dy\ntre "), 3);
  assert.equal(countWords(""), 0);
  assert.equal(countWords(null), 0);
});

test("affinity keeps engaged seconds and reads, decayed, for the why line", () => {
  const t0 = Date.parse("2026-10-01T08:00:00Z");
  let a = recordRead({}, ["cat:Sport", "city:prizren"], t0, 1.8, { seconds: 300, read: true });
  a = recordRead(a, ["cat:Sport"], t0 + 1000, 1, { seconds: 120, read: true });
  const now = readingStats(a, "cat:Sport", t0 + 1000);
  assert.equal(Math.round(now.reads), 2);
  assert.equal(Math.round(now.minutes), 7);
  const later = readingStats(a, "cat:Sport", t0 + 1000 + AFFINITY_HALF_LIFE_MS);
  assert.ok(Math.abs(later.minutes - now.minutes / 2) < 0.01);
  assert.deepEqual(readingStats(a, "cat:Botë", t0), { minutes: 0, reads: 0, weight: 0 });
});

test("an older stored map without tallies still reads and records", () => {
  const old = { "cat:Sport": { w: 2, t: "2026-10-01T08:00:00.000Z" } };
  const next = recordRead(old, ["cat:Sport"], Date.parse("2026-10-01T09:00:00Z"), 1, { seconds: 60, read: true });
  assert.ok(next["cat:Sport"].w > 2.9);
  assert.equal(next["cat:Sport"].n, 1);
  assert.equal(readingStats({ junk: 1, "cat:Sport": { w: "x" } }, "cat:Sport").weight, 0);
});

test("less never goes below nothing; more adds", () => {
  const t = Date.parse("2026-10-01T08:00:00Z");
  const a = { "cat:Sport": { w: 1, t: new Date(t).toISOString() } };
  assert.equal(nudgeAffinity(a, "cat:Sport", -5, t)["cat:Sport"], undefined);
  assert.ok(nudgeAffinity(a, "cat:Sport", 1, t)["cat:Sport"].w === 2);
  assert.ok(nudgeAffinity({}, "person:albin-kurti", 1, t)["person:albin-kurti"].w === 1);
  assert.deepEqual(nudgeAffinity(a, "bad key", 1, t), a);
});
