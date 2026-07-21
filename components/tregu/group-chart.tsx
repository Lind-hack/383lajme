"use client";

import { useId, useMemo, useRef, useState } from "react";
import { makeSampler, smoothPath } from "@/lib/tregu-tape";
import { useReducedMotion, useDrawReveal, useLiveTapeVector, useChartPan, useLiveClock, frozenFitRange, type FitBand } from "./chart-hooks";

// Multi-outcome event chart — the Polymarket-style view for grouped events.
//
// Like MarketChart, every outcome is ONE continuous per-second series: a live
// tape (useLiveTapeVector) covers the recent past at per-second fidelity and a
// deterministic per-outcome sampler (makeSampler) fills everything older, so
// history and the live edge meet with no seam and no "jump". Each timeframe is a
// *window* (zoom) over those series; the right edge is always `now`, updating
// ~30fps. Values are renormalized per sampled column so displayed odds always
// sum to ~100%. Drag/swipe left pans back through the full history; a "back to
// live" chip snaps to the edge.
//
// SVG carries only geometry (preserveAspectRatio="none" stretches text), so all
// labels are HTML positioned over the plot.

export interface EventSeries {
  label: string;
  color: string;
  /** Timestamped raw book prices, ascending. Missing → flat at `prob`. */
  series?: { t: number; p: number }[];
  prob: number;
}

// Timeframe = window width (zoom) over ONE continuous per-second series — the
// same set MarketChart uses so both charts read identically.
const RANGES = [
  { key: "1s", ms: 60_000 },
  { key: "1m", ms: 600_000 },
  { key: "5m", ms: 2_700_000 },
  { key: "15m", ms: 10_800_000 },
  { key: "1h", ms: 43_200_000 },
  { key: "4h", ms: 172_800_000 },
  { key: "1d", ms: 1_209_600_000 },
  { key: "1w", ms: 7_257_600_000 },
  { key: "Gjithë", ms: Infinity },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const W = 640;
const AXIS_H = 22;
const PLOT_TOP = 10;
// Width of the gleam that travels along the lines once a minute. The CSS
// keyframe translates it by W + SHINE_W, so the two must stay in sync
// (`--tg-shine-travel` in globals.css).
const SHINE_W = 180;

const N_SAMPLES = 220; // screen-space resolution of the windowed lines

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Real anchors for one outcome (dedup same-ms writes so a state+odds snapshot
// in the same millisecond never forms an artificial vertical rectangle).
function anchorsOf(s: EventSeries, now: number): { t: number; p: number }[] {
  const base =
    s.series && s.series.length >= 1
      ? [...new Map(s.series.map((point) => [point.t, point])).values()].sort((a, b) => a.t - b.t)
      : [{ t: now - 86_400_000, p: s.prob }];
  return [...base, { t: now, p: s.prob }];
}

// Interpolate a FROZEN history curve (immutable between refreshes). Never calls
// the hash sampler at moving `t`, so the past scrolls but never reshuffles.
function histAt(hist: { t: number; p: number }[], t: number): number {
  const n = hist.length;
  if (n === 0) return 0;
  if (t <= hist[0].t) return hist[0].p;
  if (t >= hist[n - 1].t) return hist[n - 1].p;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (hist[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = hist[lo];
  const b = hist[hi];
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  return a.p + (b.p - a.p) * f;
}

// Continuous per-outcome price read: frozen history for older `t`, the
// append-only live tape for recent seconds, and the gliding `live` value at the
// very tip. Every point behind the tip is immutable; only the edge animates.
function priceOf(
  tape: { t: number; p: number }[],
  hist: { t: number; p: number }[],
  live: number,
  t: number
): number {
  const n = tape.length;
  if (n === 0) return histAt(hist, t);
  if (t <= tape[0].t) return histAt(hist, t);
  if (t >= tape[n - 1].t) return live;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (tape[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = tape[lo];
  const b = tape[hi];
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  return a.p + (b.p - a.p) * f;
}

// Push-apart with bounds: enforce 26px spacing downward, then walk the stack
// back inside [minY, maxY] — without the clamp a tall stack marches straight
// past the plot's bottom edge into the next section.
function spreadWithin(items: { y: number }[], minY: number, maxY: number) {
  for (let i = 1; i < items.length; i++) {
    if (items[i].y - items[i - 1].y < 26) items[i].y = items[i - 1].y + 26;
  }
  if (items.length === 0) return;
  if (items[items.length - 1].y > maxY) {
    items[items.length - 1].y = maxY;
    for (let i = items.length - 2; i >= 0; i--) {
      if (items[i + 1].y - items[i].y < 26) items[i].y = items[i + 1].y - 26;
    }
  }
  if (items[0].y < minY) {
    items[0].y = minY;
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < 26) items[i].y = items[i - 1].y + 26;
    }
  }
}

function ticksFor(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span > 0.55 ? 0.2 : span > 0.3 ? 0.1 : 0.05;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
    out.push(Math.round(t * 100) / 100);
  }
  return out;
}

export default function GroupChart({
  series,
  height = 420,
  cadenceMs = 120_000,
}: {
  series: EventSeries[];
  height?: number;
  cadenceMs?: number;
}) {
  const [range, setRange] = useState<RangeKey>("1d");
  const [hoverI, setHoverI] = useState<{ x: number; t: number; values: number[]; live: boolean; col: number } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitBand>(null);
  // Sweep (oscilloscope) frame anchor for the live timeframes — see MarketChart.
  // `T0` pins the frame; the realtime line sweeps left -> right and every drawn
  // second freezes at its x, overwritten only a full frame later. Nothing behind
  // the head ever shifts sideways. Reseeds per view (range + data refresh).
  const sweepRef = useRef<{ key: string; T0: number } | null>(null);
  // Defs are document-scoped; two charts on one page would collide on a
  // hardcoded id. React's ids carry punctuation url(#…) can't resolve — strip it.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const shineMaskId = `tg-shine-mask-${uid}`;
  const shineBandId = `tg-shine-band-${uid}`;
  const shineGlowId = `tg-shine-glow-${uid}`;
  const revealId = `tg-reveal-${uid}`;

  const reduced = useReducedMotion();
  const drawn = useDrawReveal(1350, reduced);
  const { now: clockNow, nextInMs } = useLiveClock(cadenceMs);

  const H = height;
  const PLOT_BOTTOM = H - AXIS_H;
  const yFor = (p: number) => (lo === hi ? PLOT_TOP : PLOT_TOP + (PLOT_BOTTOM - PLOT_TOP) * (1 - (p - lo) / (hi - lo)));

  // One deterministic sampler per outcome + the full-history floor. Rebuilt only
  // on structural data change (NOT every live tick — that flows through targets).
  const data = useMemo(() => {
    const now0 = Date.now();
    const anchors = series.map((s, i) => anchorsOf(s, now0));
    const samplers = anchors.map((a, i) => makeSampler(a, `${series[i]?.label ?? "o"}-${i}`));
    let tMinAll = now0;
    let realCount = 0;
    for (const a of anchors) {
      if (a.length > 0 && a[0].t < tMinAll) tMinAll = a[0].t;
      realCount += a.length;
    }
    // FREEZE each outcome's history once (see MarketChart for the full rationale):
    // the hash sampler is evaluated here into immutable curves, so between 5-min
    // refreshes the past is drawn once and never rewritten — only the live edge
    // moves. Render interpolates these curves, never the hash at scrolling `t`.
    const HIST_MAX = 5000;
    const histStep = Math.max(60_000, Math.ceil((now0 - tMinAll) / HIST_MAX));
    const histories = samplers.map((fn) => {
      const h: { t: number; p: number }[] = [];
      for (let t = tMinAll; t < now0; t += histStep) h.push({ t, p: fn(t) });
      h.push({ t: now0, p: fn(now0) });
      return h;
    });
    const dataKey = `${series.map((s) => s.label).join("|")}|${realCount}|${Math.round(tMinAll / 60_000)}`;
    return { samplers, histories, tMinAll, realCount, dataKey };
  }, [series]);

  const targets = series.map((s) => s.prob);
  const { now: tapeNow, tapes, lives } = useLiveTapeVector(data.samplers, data.dataKey, targets, !reduced);

  // Window geometry — identical model to MarketChart.
  const rangeMs = RANGES.find((r) => r.key === range)!.ms;
  const isAll = !Number.isFinite(rangeMs);
  const fullSpan = Math.max(tapeNow - data.tMinAll, 60_000);
  const windowMs = isAll ? fullSpan : Math.min(rangeMs, fullSpan);
  const maxPanMs = isAll ? 0 : Math.max(0, fullSpan - windowMs);
  const pan = useChartPan(plotRef, maxPanMs, windowMs, !reduced);

  if (series.length === 0 || data.realCount < 2 * series.length) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>
        Ende pa mjaftueshëm të dhëna historike
      </div>
    );
  }

  // Sweep (oscilloscope) on the live timeframes (1s/1m/5m) — identical model to
  // MarketChart. The frame is FIXED: `T0` pins the left edge, the stack sweeps
  // left -> right, every drawn second freezes at its x, and the head wraps at the
  // right edge to overwrite the oldest column in place. Nothing behind the head
  // shifts sideways — only the tip moves. Wider windows keep the right-anchored
  // model (per-second step sub-pixel there, and full history shown at once).
  const edge = Math.ceil(tapeNow / 1000) * 1000;
  const isSweep = !isAll && windowMs <= 2_700_000;
  let leftT: number;
  let rightT: number;
  let spanMs: number;
  let tipT: number;
  let sweep: { T0: number; cycle: number; headF: number } | null = null;
  if (isSweep) {
    const key = `${range}|${data.dataKey}`;
    if (!sweepRef.current || sweepRef.current.key !== key) sweepRef.current = { key, T0: edge - windowMs };
    const T0 = sweepRef.current.T0;
    const cycle = Math.floor((edge - T0) / windowMs);
    const headF = ((edge - T0) % windowMs) / windowMs;
    sweep = { T0, cycle, headF };
    leftT = edge - windowMs;
    rightT = edge;
    spanMs = windowMs;
    tipT = edge;
  } else {
    rightT = edge - (isAll ? 0 : pan.panMs);
    leftT = isAll ? data.tMinAll : rightT - windowMs;
    spanMs = Math.max(1, rightT - leftT);
    tipT = rightT;
  }
  const n = series.length;

  // Committed per-outcome tip values (last whole second, NOT the 30fps easing
  // `lives`). The vertical fit uses these so the axis steps at most once per
  // second instead of breathing at frame rate under the easing tip.
  const committedTip = (s: number) => {
    const tp = tapes[s];
    return tp && tp.length ? tp[tp.length - 1].p : targets[s] ?? 0;
  };

  // Sample into contiguous column-runs — one for the right-anchored frame; two
  // for the sweep (fresh trace behind the head, older frozen trace ahead of it,
  // split by a small blank at the head). At each column read every outcome's
  // continuous price and renormalize so the stack sums to 1. The drawn stack uses
  // the gliding tip; the vertical fit uses the committed tip so history never
  // re-scales per frame.
  const runsCols: { t: number; x: number; vals: number[] }[][] = [];
  let plo = 1;
  let phi = 0;
  const buildCol = (arr: { t: number; x: number; vals: number[] }[], t: number, x: number, committed = false) => {
    const raw = new Array<number>(n);
    const rawFit = new Array<number>(n);
    let sum = 0;
    let sumFit = 0;
    for (let s = 0; s < n; s++) {
      const hist = data.histories[s] ?? [];
      const tp = tapes[s] ?? [];
      const vf = priceOf(tp, hist, committedTip(s), t);
      // Sweep columns behind the pen must NOT track the 30fps easing tip — the
      // committed variant equals the tape for historical t and freezes the head
      // column at the last whole second. The gliding live value lives only in
      // the separate straight tip segment.
      const v = committed ? vf : priceOf(tp, hist, lives[s] ?? targets[s], t);
      raw[s] = v;
      rawFit[s] = vf;
      sum += v;
      sumFit += vf;
    }
    const valsFit = sumFit > 0 ? rawFit.map((v) => v / sumFit) : rawFit.map(() => 1 / n);
    for (const v of valsFit) {
      if (v < plo) plo = v;
      if (v > phi) phi = v;
    }
    const vals = sum > 0 ? raw.map((v) => v / sum) : raw.map(() => 1 / n);
    arr.push({ t, x, vals });
  };
  // Sweep's fresh run kept out here so the live tip segments can attach to it.
  let sweepCurCols: { t: number; x: number; vals: number[] }[] | null = null;
  if (isSweep && sweep) {
    const { T0, cycle, headF } = sweep;
    const gapF = Math.min(0.5, 7 / W);
    // FIXED global grid: every column sits at f = i/N of the FRAME, forever.
    // The pen only decides which cycle a column reads from — its x never moves.
    // Grids derived from headF (the old approach) shifted every column each
    // second, which read as the whole drawn stack jiggling.
    const cur: { t: number; x: number; vals: number[] }[] = [];
    const prev: { t: number; x: number; vals: number[] }[] = [];
    for (let i = 0; i <= N_SAMPLES; i++) {
      const f = i / N_SAMPLES;
      if (f <= headF) {
        buildCol(cur, T0 + cycle * windowMs + f * windowMs, f * W, true);
      } else if (f >= headF + gapF) {
        buildCol(prev, T0 + (cycle - 1) * windowMs + f * windowMs, f * W);
      }
      // columns inside the pen gap stay blank this pass
    }
    sweepCurCols = cur;
    if (cur.length > 1) runsCols.push(cur);
    if (prev.length > 1) runsCols.push(prev);
  } else {
    const run: { t: number; x: number; vals: number[] }[] = [];
    for (let i = 0; i <= N_SAMPLES; i++) {
      const t = leftT + (i / N_SAMPLES) * spanMs;
      if (t > tipT + 1) break;
      buildCol(run, t, (i / N_SAMPLES) * W);
    }
    runsCols.push(run);
  }
  const cols = runsCols.flat();

  // Tight vertical fit — small padding so real moves fill the plot.
  let tLo = Math.max(0, plo - 0.02);
  let tHi = Math.min(1, phi + 0.02);
  if (tHi - tLo < 0.12) {
    const mid = (tHi + tLo) / 2;
    tLo = Math.max(0, mid - 0.06);
    tHi = Math.min(1, tLo + 0.12);
  }
  // Freeze the band for this view so the drawn stack never re-scales frame to
  // frame; it only grows (eased) when a live value pushes a genuine new high/low
  // into view. Keyed by range+dataKey so it reseeds on a timeframe switch or a
  // data refresh, and holds rock-still otherwise.
  const [lo, hi] = frozenFitRange(fitRef, `${range}|${data.dataKey}`, tLo, tHi, reduced);

  const isLiveEdge = isAll || pan.panMs < 1500;
  const hover = hoverI;
  // The live head carries current odds: on the sweep it's the last column of the
  // fresh (first) run; otherwise the right-edge column. Chips + dots read this.
  // On the sweep the head carries the gliding live odds (renormalized) — the
  // dot IS the tip, the only element allowed to move. Otherwise the right-edge
  // column.
  const liveNorm = (() => {
    const raw = series.map((_, s) => lives[s] ?? targets[s] ?? 0);
    const sum = raw.reduce((a, b) => a + b, 0);
    return sum > 0 ? raw.map((v) => v / sum) : raw.map(() => 1 / n);
  })();
  const lastValues = isSweep ? liveNorm : cols[cols.length - 1].vals;
  const tipFrac = isSweep && sweep ? sweep.headF : 1;
  const ticks = ticksFor(lo, hi);

  // Build one smoothed path for a slice of columns for outcome si.
  const pathFor = (si: number, from: number, to: number) =>
    smoothPath(cols.slice(from, to).map((c) => ({ x: c.x, y: yFor(c.vals[si]) })));
  // Path over an explicit column-run (used to draw each sweep segment separately
  // so they never join across the head blank or the frame wrap).
  const pathForCols = (arr: { x: number; vals: number[] }[], si: number) =>
    smoothPath(arr.map((c) => ({ x: c.x, y: yFor(c.vals[si]) })));
  // The ONLY moving pieces: straight pen segments from each series' last
  // committed column to its gliding live tip. Kept out of the smoothed
  // committed paths so the tip's 30fps easing can't bend the neighbouring
  // curve control points.
  const tipSegs =
    isSweep && sweep && sweepCurCols && sweepCurCols.length
      ? series.map((s, si) => {
          const a = sweepCurCols![sweepCurCols!.length - 1];
          return {
            color: s.color,
            d: `M ${a.x.toFixed(1)} ${yFor(a.vals[si]).toFixed(1)} L ${(sweep!.headF * W).toFixed(1)} ${yFor(liveNorm[si]).toFixed(1)}`,
          };
        })
      : null;

  const onMove = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const xpx = Math.max(0, Math.min(W, ((clientX - rect.left) / rect.width) * W));
    let bi = 0;
    for (let i = 0; i < cols.length; i++) if (Math.abs(cols[i].x - xpx) < Math.abs(cols[bi].x - xpx)) bi = i;
    const c = cols[bi];
    const live = isSweep && sweep ? Math.abs(c.x - sweep.headF * W) < 8 : rightT - c.t < 2000 && isLiveEdge;
    setHoverI({ x: c.x, t: c.t, values: c.vals, live, col: bi });
  };

  const fmtAxis = (t: number) => {
    const d = new Date(t);
    if (spanMs <= 180_000) return d.toLocaleTimeString("sq-AL", { minute: "2-digit", second: "2-digit" });
    if (spanMs <= 2 * 86_400_000) return d.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("sq-AL", { day: "numeric", month: "short" });
  };
  // Sweep axis is a FIXED elapsed-position grid (0 -> windowMs across the frame)
  // so labels never move as the head sweeps; the right-anchored frame keeps wall
  // clock labels.
  const fmtDur = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const axisTicks = [0.08, 0.5, 0.92].map((f) => ({
    f,
    label: isSweep ? fmtDur(f * windowMs) : fmtAxis(leftT + f * spanMs),
  }));

  // Chips are pushed apart 26px, so only so many fit the plot height.
  const maxChips = Math.max(3, Math.floor((PLOT_BOTTOM - PLOT_TOP) / 26));

  const chips = series
    .map((s, i) => ({ s, v: lastValues[i], y: yFor(lastValues[i]) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, maxChips)
    .sort((a, b) => a.y - b.y);
  spreadWithin(chips, PLOT_TOP + 2, PLOT_BOTTOM - 12);

  const hoverLabels =
    hover === null
      ? []
      : series
          .map((s, i) => ({ s, v: hover.values[i], y: yFor(hover.values[i]) }))
          .sort((a, b) => b.v - a.v)
          .slice(0, maxChips)
          .sort((a, b) => a.y - b.y);
  spreadWithin(hoverLabels, PLOT_TOP + 2, PLOT_BOTTOM - 12);
  const hoverXpct = hover === null ? 0 : (hover.x / W) * 100;
  const hoverFlip = hoverXpct > 64;
  // Future-graying (played vs upcoming split at the crosshair) only makes sense
  // on the single right-anchored run; the sweep draws each frozen run whole.
  const showFuture = !isSweep && hover !== null && !hover.live && hover.col < cols.length - 1;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div className="tregu-live-pill" aria-live="off">
          <span className="tregu-live-dot" aria-hidden />
          <span className="tregu-live-clock">
            {new Date(clockNow).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="tregu-live-sep" aria-hidden>·</span>
          <span className="tregu-live-refresh">Rifreskim {mmss(nextInMs)}</span>
        </div>
        <div className="tregu-sort tregu-sort--scroll" role="tablist" aria-label="Periudha e grafikut">
          {RANGES.map((r) => (
            <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)} type="button">
              {r.key}
            </button>
          ))}
        </div>
      </div>

      <div className="tregu-gchart" style={{ height: H }}>
        <div
          className="tregu-gchart-plot"
          ref={plotRef}
          style={{ touchAction: "pan-y", cursor: pan.dragging ? "grabbing" : maxPanMs > 0 && !reduced ? "grab" : "default" }}
          onPointerDown={pan.onPointerDown}
          onPointerMove={(e) => {
            const consumed = pan.onPointerMove(e);
            if (consumed) {
              if (hover) setHoverI(null);
            } else if (e.pointerType === "mouse" && !pan.dragging) {
              onMove(e.clientX);
            }
          }}
          onPointerUp={pan.onPointerUp}
          onPointerCancel={pan.onPointerUp}
          onPointerLeave={() => {
            if (!pan.dragging) setHoverI(null);
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              {/* Soft-edged band; masking a duplicate of each line with it makes
                  a gleam ride the stroke — the SVG analogue of the shine. */}
              <linearGradient id={shineBandId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                <stop offset="38%" stopColor="#fff" stopOpacity="0.3" />
                <stop offset="55%" stopColor="#fff" stopOpacity="1" />
                <stop offset="72%" stopColor="#fff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <filter id={shineGlowId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" />
              </filter>
              <mask id={shineMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                <rect className="tregu-gchart-shine" x={-SHINE_W} y="0" width={SHINE_W} height={H} fill={`url(#${shineBandId})`} />
              </mask>
              <clipPath id={revealId}>
                <rect className="tregu-chart-reveal" x="0" y="0" width={W} height={H} />
              </clipPath>
            </defs>
            {ticks.map((t) => (
              <line
                key={t}
                x1="0"
                x2={W}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke="var(--tg-chart-grid, rgba(17,17,17,0.08))"
                strokeWidth="1"
                strokeDasharray="2 6"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <g clipPath={`url(#${revealId})`}>
              {/* On hover the columns after the crosshair go gray — only the
                  played part keeps its colour (Polymarket-style). Live edge has
                  no future, so it colours everything. */}
              {showFuture &&
                series.map((s, si) => (
                  <path
                    key={`f-${s.label}`}
                    d={pathFor(si, hover!.col, cols.length)}
                    fill="none"
                    stroke="var(--tg-chart-future, rgba(17,17,17,0.16))"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              {runsCols.map((run, ri) =>
                series.map((s, si) => {
                  // One path per (run, outcome). Non-sweep honors the played/future
                  // split; the sweep draws each frozen run whole.
                  const d = !isSweep && showFuture ? pathFor(si, 0, hover!.col + 1) : pathForCols(run, si);
                  return (
                    <g key={`${ri}-${s.label}`}>
                      <path
                        d={d}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* The gleam: same geometry, revealed only through the
                          travelling mask band. Suppressed on hover/drag. */}
                      {hover === null && !pan.dragging && (
                        <g mask={`url(#${shineMaskId})`}>
                          <path d={d} fill="none" stroke={s.color} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" filter={`url(#${shineGlowId})`} />
                          <path d={d} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" vectorEffect="non-scaling-stroke" />
                        </g>
                      )}
                    </g>
                  );
                })
              )}
              {tipSegs &&
                tipSegs.map((seg, si) => (
                  <path
                    key={`tip-${si}`}
                    d={seg.d}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
            </g>
            {hover && (
              <line
                x1={hover.x}
                x2={hover.x}
                y1={PLOT_TOP}
                y2={PLOT_BOTTOM}
                stroke="var(--tg-chart-cross, rgba(17,17,17,0.35))"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Live endpoint dots — pulsing while at the live edge, sliding to the
              crosshair point on hover. Held back until the wipe passes. */}
          {(drawn || hover) &&
            series.map((s, i) => (
              <span
                key={s.label}
                className={hover ? "tregu-gchart-dot" : isLiveEdge ? "tregu-gchart-dot tregu-gchart-dot--live" : "tregu-gchart-dot"}
                style={
                  hover
                    ? { top: yFor(hover.values[i]), left: `${hoverXpct}%`, right: "auto", background: s.color }
                    : isSweep
                      ? { top: yFor(lastValues[i]), left: `${tipFrac * 100}%`, right: "auto", background: s.color }
                      : { top: yFor(lastValues[i]), background: s.color }
                }
                aria-hidden
              />
            ))}

          {/* Back-to-live chip — appears when panned into the past. */}
          {!isAll && pan.panMs > 2000 && (
            <button type="button" className="tregu-tolive" onClick={pan.resetPan} aria-label="Kthehu te tani">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M13 5l7 7-7 7M20 12H4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Live
            </button>
          )}

          {/* Time axis — HTML so it never stretches with the SVG. */}
          {axisTicks.map((tick) => (
            <span key={tick.f} className="tregu-axis-label" style={{ left: `${tick.f * 100}%`, bottom: 2, transform: "translateX(-50%)" }}>
              {tick.label}
            </span>
          ))}

          {/* Timestamp pill riding the top of the crosshair — live wall clock. */}
          {hover && (
            <div className="tregu-gchart-time" style={{ left: `${Math.max(8, Math.min(92, hoverXpct))}%` }}>
              {hover.live
                ? `Tani · ${new Date(hover.t).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : spanMs <= 180_000
                  ? new Date(hover.t).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : `${new Date(hover.t).toLocaleDateString("sq-AL", { day: "numeric", month: "short" })} ${new Date(hover.t).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}`}
            </div>
          )}

          {/* Name + odds at the hovered point, next to each line. */}
          {hover &&
            hoverLabels.map(({ s, v, y }) => (
              <span
                key={s.label}
                className="tregu-gchart-chip"
                style={{
                  top: y,
                  left: `${hoverXpct}%`,
                  right: "auto",
                  transform: hoverFlip ? "translate(calc(-100% - 12px), -50%)" : "translate(12px, -50%)",
                  zIndex: 2,
                }}
              >
                <span className="tregu-gchart-chip-dot" style={{ background: s.color }} />
                <span className="tregu-gchart-chip-name">{s.label}</span>
                <strong style={{ color: s.color }}>{(v * 100).toFixed(1)}%</strong>
              </span>
            ))}
        </div>

        {/* Right gutter: % axis. */}
        <div className="tregu-gchart-gutter" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="tregu-gchart-tick" style={{ top: yFor(t) }}>
              {Math.round(t * 100)}%
            </span>
          ))}
        </div>
        {/* Endpoint chips hide on hover — the crosshair labels take over. */}
        {!hover &&
          chips.map(({ s, v, y }) => (
            <span key={s.label} className="tregu-gchart-chip" style={{ top: y }}>
              <span className="tregu-gchart-chip-dot" style={{ background: s.color }} />
              <span className="tregu-gchart-chip-name">{s.label}</span>
              <strong style={{ color: s.color }}>{(v * 100).toFixed(1)}%</strong>
            </span>
          ))}
      </div>
    </div>
  );
}

// One outcome, one graph — the "separate graphs" breakdown. Same tape drawn
// solo with a gradient floor in the outcome's colour.
export function OutcomeMiniChart({
  label,
  color,
  points,
  prob,
  height = 84,
}: {
  label: string;
  color: string;
  points?: number[];
  prob: number;
  height?: number;
}) {
  const pts = points && points.length >= 2 ? points : [prob, prob];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(max - min, 0.08);
  const W = 100;
  const H = 100;
  const y = (p: number) => 12 + (H - 24) * (1 - (p - min) / span);
  const step = W / (pts.length - 1);
  // Smooth rounded curve rather than sharp vertices.
  const path = smoothPath(pts.map((p, i) => ({ x: i * step, y: y(p) })));
  const gid = `tg-omini-${label.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="tregu-omini">
      <div className="tregu-omini-head">
        <span className="tregu-omini-label">
          <span className="tregu-gchart-chip-dot" style={{ background: color }} />
          {label}
        </span>
        <span className="tregu-omini-pct" style={{ color }}>
          {Math.round(prob * 100)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }} aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L${W} ${H} L0 ${H} Z`} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
