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
  return Math.max(0.012, Math.min(0.035, (hi - lo) * 0.35));
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
      const p = base + (jag(m * 1.31 + seed) * amp + jag(m * 0.37 + seed * 2.7) * amp * 0.7) * w;
      out.push({ t, p: clamp01(p) });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
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
      const p = base + (jag(x * 1.31 + seed) * amp + jag(x * 0.37 + seed * 2.7) * amp * 0.7) * w;
      out.push(clamp01(p));
    }
  }
  out.push(spark[spark.length - 1]);
  return out;
}
