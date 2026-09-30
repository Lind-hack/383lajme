import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_WIGGLE, livelyPoints, niceStep, seedOf, wiggleAmplitude } from "./tregu-chart-motion.mjs";

const H = 3_600_000;
const T0 = Date.UTC(2026, 8, 30, 8);
const history = [
  { t: T0, p: 0.4 },
  { t: T0 + 6 * H, p: 0.4 },
  { t: T0 + 10 * H, p: 0.55 },
  { t: T0 + 24 * H, p: 0.55 },
];

test("with no wiggle the line passes through every recorded point", () => {
  const drawn = livelyPoints(history, { amplitude: 0 });
  for (const point of history) {
    const hit = drawn.find((sample) => sample.t === point.t);
    assert.ok(hit, `missing sample at ${point.t}`);
    assert.equal(hit.p, point.p);
  }
});

test("a move is a climb, not a vertical jump", () => {
  const drawn = livelyPoints(history, { amplitude: 0 });
  const inside = drawn.filter((sample) => sample.p > 0.4 && sample.p < 0.55);
  assert.ok(inside.length >= 3, "the ramp should have intermediate samples");
  const ts = inside.map((sample) => sample.t);
  assert.ok(Math.min(...ts) < T0 + 10 * H && Math.max(...ts) < T0 + 10 * H);
  // Monotone climb.
  for (let i = 1; i < inside.length; i++) assert.ok(inside[i].p >= inside[i - 1].p);
});

test("the wiggle never strays past the cap and is deterministic", () => {
  const options = { amplitude: 0.05, seed: seedOf("m1"), end: T0 + 24 * H, now: T0 + 24 * H };
  const a = livelyPoints(history, options);
  const b = livelyPoints(history, options);
  assert.deepEqual(a, b);
  const still = livelyPoints(history, { ...options, amplitude: 0 });
  const byT = new Map(still.map((sample) => [sample.t, sample.p]));
  for (const sample of a) {
    assert.ok(Math.abs(sample.p - byT.get(sample.t)) <= MAX_WIGGLE + 1e-12);
  }
  assert.ok(a.some((sample) => Math.abs(sample.p - byT.get(sample.t)) > 0.001), "flat stretches should move");
});

test("drawn history does not reshuffle as the live edge advances", () => {
  const seed = seedOf("m2");
  const end1 = T0 + 24 * H;
  const end2 = end1 + 1_000;
  const a = livelyPoints(history, { amplitude: 0.006, seed, start: T0, end: end1, now: end1 });
  const b = livelyPoints(history, { amplitude: 0.006, seed, start: T0, end: end2, now: end2 });
  const later = new Map(b.map((sample) => [sample.t, sample.p]));
  const settled = a.filter((sample) => sample.t < T0 + 20 * H && later.has(sample.t));
  assert.ok(settled.length > 20);
  for (const sample of settled) assert.equal(later.get(sample.t), sample.p);
});

test("the live tip moves from one second to the next", () => {
  const seed = seedOf("m3");
  const tips = [0, 1, 2, 3].map((s) => {
    const end = T0 + 24 * H + s * 1_000;
    return livelyPoints(history, { amplitude: 0.006, seed, start: T0, end, now: end }).at(-1).p;
  });
  assert.ok(new Set(tips.map((p) => p.toFixed(6))).size > 1);
});

test("the newest move animates in from the old price", () => {
  const trade = [{ t: T0, p: 0.4 }, { t: T0 + H, p: 0.6 }];
  const atStart = livelyPoints(trade, { amplitude: 0, animate: { from: 0.4, progress: 0 } });
  const done = livelyPoints(trade, { amplitude: 0, animate: { from: 0.4, progress: 1 } });
  assert.equal(atStart.at(-1).p, 0.4);
  assert.equal(done.at(-1).p, 0.6);
});

test("helpers", () => {
  assert.equal(niceStep(7), 10);
  assert.equal(niceStep(40_000), 60_000);
  assert.ok(wiggleAmplitude(1) <= MAX_WIGGLE);
  assert.ok(wiggleAmplitude(0.08) > 0.002);
  assert.deepEqual(livelyPoints([]), []);
  assert.equal(livelyPoints([{ t: T0, p: 0.3 }], { amplitude: 0 }).length, 1);
});
