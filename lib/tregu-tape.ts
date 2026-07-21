// Dramatize — display-only texture for every price chart on the floor.
//
// Real tapes (cron snapshots, trades, hub sparklines) are sparse, so the
// straight segments between points read as flat and square. This module
// upsamples each tape piecewise-linearly and layers two octaves of hash
// noise on the in-between points only: every real anchor point (and the
// live final price) is returned untouched, so Hermes' repricing and the
// hover tooltip at recorded timestamps stay truthful while the line moves
// like an in-play match.
//
// Deterministic: the jitter is a pure hash of (timestamp/index, seed key),
// so a chart never rewrites its own history between renders or polls.

export interface TapePoint {
  t: number;
  p: number;
}

// Uniform hash noise in [-0.5, 0.5] — no smooth structure between samples,
// which is what makes the line saw-toothed instead of undulating.
function jag(x: number): number {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

function seedOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997;
  return h;
}

// Jitter amplitude scales with the tape's own range so a genuinely flat
// book only shivers while a moving one swings hard.
function ampFor(values: number[]): number {
  let lo = 1;
  let hi = 0;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  // Wider band than a shiver: a live book should swing hard so the line reads
  // spiky and dramatic (sharp peaks, big dips) instead of a flat Excel strip.
  return Math.max(0.022, Math.min(0.072, (hi - lo) * 0.55));
}

function clamp01(p: number): number {
  return Math.max(0.01, Math.min(0.99, p));
}

/** Timestamped tape (detail-page charts). Anchors and final point stay exact. */
export function dramatizeSeries(pts: TapePoint[], key: string): TapePoint[] {
  if (pts.length < 2) return pts;
  const seed = seedOf(key);
  const amp = ampFor(pts.map((pt) => pt.p));
  const per = Math.max(2, Math.min(10, Math.floor(280 / pts.length)));
  const out: TapePoint[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    out.push(a);
    for (let k = 1; k < per; k++) {
      const f = k / per;
      const t = a.t + (b.t - a.t) * f;
      const base = a.p + (b.p - a.p) * f;
      // Fades to zero at both anchors so the jitter never contradicts them.
      const w = Math.sin(Math.PI * f);
      const m = t / 60_000;
      // Three octaves: fine saw-tooth, a mid ripple, and a slow high-amplitude
      // swell that carves the big dips and tall spikes the design calls for.
      const p =
        base +
        (jag(m * 1.31 + seed) * amp +
          jag(m * 0.37 + seed * 2.7) * amp * 0.7 +
          jag(m * 0.11 + seed * 5.1) * amp * 1.35) *
          w;
      out.push({ t, p: clamp01(p) });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Continuous deterministic price sampler over sparse real anchors. Same noise
 * model as `dramatizeSeries`, but as a *pure function of time* — evaluate it at
 * any timestamp and it always returns the same value (anchors exact, smooth
 * jagged texture between). This is what lets every timeframe be a window over
 * one continuous series: the live per-second tape covers the recent past, and
 * this sampler fills in everything older, so the two meet with no seam and no
 * "jump" from history to live.
 */
export function makeSampler(anchors: TapePoint[], key: string): (t: number) => number {
  const pts = [...new Map(anchors.map((p) => [p.t, p])).values()].sort((a, b) => a.t - b.t);
  if (pts.length === 0) return () => 0.5;
  const seed = seedOf(key);
  // Append-stable amplitude: each segment's amp derives from the price range of
  // the anchors seen UP TO its right endpoint (prefix range). Appending newer
  // anchors — a fresh cron snapshot, a trade — can therefore never rescale the
  // texture of segments already drawn, which is what keeps the chart's history
  // identical across data refetches and page reloads.
  const amps: number[] = [];
  {
    let lo = pts[0].p;
    let hi = pts[0].p;
    for (const p of pts) {
      if (p.p < lo) lo = p.p;
      if (p.p > hi) hi = p.p;
      amps.push(Math.max(0.022, Math.min(0.072, (hi - lo) * 0.55)));
    }
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  const lastAmp = amps[amps.length - 1];
  const noiseAt = (t: number, amp: number): number => {
    const m = t / 60_000;
    return (
      jag(m * 1.31 + seed) * amp +
      jag(m * 0.37 + seed * 2.7) * amp * 0.7 +
      jag(m * 0.11 + seed * 5.1) * amp * 1.35
    );
  };
  return (t: number): number => {
    if (t <= first.t) return clamp01(first.p);
    if (t >= last.t) {
      // Beyond the last real anchor: hold the last price with texture fading in
      // over ~4 min. A pure function of absolute time — NOT of "now" — so the
      // fill between the last snapshot and the live edge is the same series no
      // matter when it is evaluated. (The old model anchored this stretch to a
      // moving {now, liveProb} point, which redrew it on every poll.)
      const w = Math.min(1, (t - last.t) / 240_000);
      return clamp01(last.p + noiseAt(t, lastAmp) * w);
    }
    // Locate the segment [a, b] containing t (linear scan — anchor counts are
    // small; the hot per-second path uses the live tape, not this).
    let i = 0;
    while (i < pts.length - 1 && pts[i + 1].t <= t) i++;
    const a = pts[i];
    const b = pts[i + 1] ?? a;
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    const base = a.p + (b.p - a.p) * f;
    // Fades to zero at both anchors so the texture never contradicts them.
    const w = Math.sin(Math.PI * f);
    return clamp01(base + noiseAt(t, amps[Math.min(i + 1, amps.length - 1)]) * w);
  };
}

/**
 * Smooth an already-projected polyline into a rounded curve. Takes screen-space
 * points ({x,y}, x strictly ascending) and returns an SVG path where every
 * corner is a Catmull-Rom→cubic-Bézier arc instead of a sharp vertex — so a
 * spiky tape reads as smooth ovaled peaks and dips, never angular rectangles.
 * Tension ~0.16 hugs the points closely while rounding the joints.
 */
export function smoothPath(pts: { x: number; y: number }[], tension = 0.16): string {
  if (pts.length === 0) return "";
  if (pts.length < 3) {
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  }
  const d = [`M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;
    d.push(
      `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    );
  }
  return d.join(" ");
}

/** Plain sparkline (hub cards, carousel, rail, outcome minis). */
export function dramatizeSpark(spark: number[] | undefined, key: string): number[] | undefined {
  if (!spark || spark.length < 2) return spark;
  const seed = seedOf(key);
  const amp = ampFor(spark);
  const per = Math.max(2, Math.min(8, Math.floor(160 / spark.length)));
  const out: number[] = [];
  for (let i = 0; i < spark.length - 1; i++) {
    const a = spark[i];
    const b = spark[i + 1];
    out.push(a);
    for (let k = 1; k < per; k++) {
      const f = k / per;
      const base = a + (b - a) * f;
      const w = Math.sin(Math.PI * f);
      const x = i * per + k;
      const p =
        base +
        (jag(x * 1.31 + seed) * amp +
          jag(x * 0.37 + seed * 2.7) * amp * 0.7 +
          jag(x * 0.11 + seed * 5.1) * amp * 1.35) *
          w;
      out.push(clamp01(p));
    }
  }
  out.push(spark[spark.length - 1]);
  return out;
}
