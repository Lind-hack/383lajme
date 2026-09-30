// How a Tregu line moves on screen. Drawing only, never data.
//
// The recorded history is sparse: a quiet market can go hours between trades,
// and a step drawing of it is a flat rule with an occasional vertical cliff. That
// reads as a dead market even when it isn't. This module turns the recorded
// points into the line a reader actually sees:
//
//   - every recorded move is drawn as a short climb or drop into the new price,
//     not a vertical jump, so a buy visibly pushes the line up or down;
//   - between moves the line breathes: a small deterministic wiggle, capped
//     below one percentage point, that always oscillates around the recorded
//     price and fades out near every real move so the move itself stays legible;
//   - the last few percent of the window, the live edge, carries a second
//     wiggle keyed to wall-clock seconds, so the tip moves every second even on
//     a window that spans a week.
//
// Nothing here feeds back into a price, a percentage label, a payout or a
// settlement. Labels, tooltips and the legend keep reading the recorded points.

/** Hard ceiling on the wiggle, in probability. The product promise is "under a point". */
export const MAX_WIGGLE = 0.009;

const NICE_STEPS = [
  5, 10, 25, 50, 100, 250, 500,
  1_000, 2_000, 5_000, 10_000, 15_000, 30_000,
  60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000,
  3_600_000, 7_200_000, 14_400_000, 21_600_000, 43_200_000, 86_400_000,
];

/** The smallest "round" duration at or above `ms`, so sample grids only change at scale boundaries. */
export function niceStep(ms) {
  const want = Math.max(1, Number(ms) || 1);
  return NICE_STEPS.find((step) => step >= want) ?? Math.ceil(want / 86_400_000) * 86_400_000;
}

/** 32-bit string hash (FNV-1a) — a stable seed per series key. */
export function seedOf(text) {
  let hash = 2166136261;
  for (const char of String(text ?? "")) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A value in [-1, 1] for integer knot `k` under `seed`. Pure, so history never reshuffles. */
function knotValue(seed, k) {
  let x = (seed ^ Math.imul(k | 0, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return (x / 4294967295) * 2 - 1;
}

/** Smooth value noise over absolute time: cosine-eased between knots `knotMs` apart. */
function valueNoise(seed, t, knotMs) {
  const u = t / knotMs;
  const k = Math.floor(u);
  const f = u - k;
  const s = (1 - Math.cos(Math.PI * f)) / 2;
  const a = knotValue(seed, k);
  const b = knotValue(seed, k + 1);
  return a + (b - a) * s;
}

/** Two octaves, normalised back into [-1, 1]. */
function wiggle(seed, t, knotMs) {
  return (valueNoise(seed, t, knotMs) + 0.4 * valueNoise(seed ^ 0x5bd1e995, t, knotMs / 2.7)) / 1.4;
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * Wiggle amplitude for a plot whose visible probability band is `span` wide:
 * about 3.5% of the band, so it reads the same on a zoomed and a full scale,
 * never more than MAX_WIGGLE and never so small it disappears.
 */
export function wiggleAmplitude(span) {
  return Math.min(MAX_WIGGLE, Math.max(0.0025, (Number(span) || 1) * 0.035));
}

/**
 * The drawn line for one series.
 *
 * @param {{ t: number, p: number }[]} points  recorded points plus any held anchors, sorted by time
 * @param {{
 *   seed?: number,
 *   start?: number | null,
 *   end?: number | null,
 *   amplitude?: number,
 *   now?: number,
 *   samples?: number,
 *   rampFraction?: number,
 *   animate?: { from: number, progress: number } | null,
 * }} [options]
 *   `amplitude` 0 draws the ramps with no wiggle (reduced motion).
 *   `now` is wall-clock time for the live-edge wiggle; omit it for a still line.
 *   `animate` eases the newest move in from `from`, `progress` 0..1.
 * @returns {{ t: number, p: number }[]}
 */
export function livelyPoints(points, options = {}) {
  const real = (Array.isArray(points) ? points : [])
    .map((point) => ({ t: Number(point?.t), p: clamp01(Number(point?.p)) }))
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p))
    .sort((a, b) => a.t - b.t);
  if (real.length === 0) return [];

  const first = real[0].t;
  const end = Number.isFinite(options.end) ? Math.max(Number(options.end), real.at(-1).t) : real.at(-1).t;
  const start = Number.isFinite(options.start) ? Math.min(Number(options.start), first) : first;
  const window = Math.max(1, end - start);
  const amplitude = Math.min(MAX_WIGGLE, Math.max(0, Number(options.amplitude ?? 0)));
  const seed = Number.isFinite(options.seed) ? Number(options.seed) : 383;
  const samples = Math.max(24, Math.min(400, Number(options.samples) || 140));
  const rampFraction = Number.isFinite(options.rampFraction) ? Number(options.rampFraction) : 0.035;

  // Scales derived from a quantised step, not the raw window, so a window that
  // grows by a second each tick leaves already-drawn history pixel-identical.
  const step = niceStep(window / samples);
  const unit = step * samples;

  // One ramp per recorded change of price, ending exactly on the recorded point.
  const moves = [];
  for (let index = 1; index < real.length; index++) {
    const before = real[index - 1];
    const after = real[index];
    if (Math.abs(after.p - before.p) < 1e-9) continue;
    const ramp = Math.max(0, Math.min(unit * rampFraction, (after.t - before.t) * 0.6));
    moves.push({ from: before.p, to: after.p, t0: after.t - ramp, t1: after.t });
  }
  const newest = moves.at(-1) ?? null;
  const animate = options.animate && newest && Number.isFinite(options.animate.from)
    ? { from: clamp01(Number(options.animate.from)), progress: clamp01(Number(options.animate.progress)) }
    : null;

  const knotMs = Math.max(2_500, step * 7);
  const quiet = Math.max(step * 2, unit * rampFraction * 1.6);
  const liveSpan = window * 0.05;
  const now = Number.isFinite(options.now) ? Number(options.now) : null;

  // Samples arrive in time order, so one cursor into `real` and one into
  // `moves` replace a scan per sample — the floor draws dozens of these a second.
  let pointCursor = 0;
  let moveCursor = 0;

  const base = (t) => {
    // Price before the first point is the first point; after a ramp, its target.
    while (pointCursor + 1 < real.length && real[pointCursor + 1].t <= t) pointCursor++;
    let value = real[pointCursor].p;
    while (moveCursor < moves.length && moves[moveCursor].t1 <= t) moveCursor++;
    const move = moves[moveCursor];
    if (move && t >= move.t0 && t < move.t1) {
      const k = move.t1 > move.t0 ? (t - move.t0) / (move.t1 - move.t0) : 1;
      value = move.from + (move.to - move.from) * easeInOut(k);
    }
    if (animate && newest && t >= newest.t0) {
      value = animate.from + (value - animate.from) * easeInOut(animate.progress);
    }
    return value;
  };

  const noiseAt = (t) => {
    if (amplitude <= 0) return 0;
    // Fade to zero around the recorded moves either side of `t`, so each move
    // reads cleanly. `moveCursor` already points at the first move not yet ended.
    let calm = 1;
    const previous = moves[moveCursor - 1];
    const next = moves[moveCursor];
    if (previous) calm = Math.min(calm, clamp01((t - previous.t1) / quiet));
    if (next) calm = Math.min(calm, clamp01(Math.max(0, next.t0 - t) / quiet));
    let value = wiggle(seed, t, knotMs) * calm;
    // The live edge breathes on wall-clock seconds, whatever the window.
    if (now != null && t > end - liveSpan) {
      const weight = clamp01((t - (end - liveSpan)) / liveSpan);
      const live = wiggle(seed ^ 0x27d4eb2d, now - (end - t), 3_200);
      value = value * (1 - weight) + live * weight * Math.max(calm, 0.35);
    }
    return Math.max(-1, Math.min(1, value)) * amplitude;
  };

  const times = new Set();
  for (let t = Math.ceil(first / step) * step; t < end; t += step) times.add(t);
  for (const point of real) times.add(point.t);
  for (const move of moves) {
    times.add(move.t0);
    // A few extra samples inside each ramp so the ease reads as a curve.
    for (let k = 1; k < 6; k++) times.add(move.t0 + ((move.t1 - move.t0) * k) / 6);
  }
  times.add(first);
  times.add(end);

  return [...times]
    .filter((t) => t >= first && t <= end)
    .sort((a, b) => a - b)
    .map((t) => {
      const p = base(t);
      return { t, p: clamp01(p + noiseAt(t)) };
    });
}
