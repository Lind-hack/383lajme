"use client";

import { useId, useMemo, useRef, useState } from "react";
import { makeSampler, smoothPath } from "@/lib/tregu-tape";
import { getCategoryColor } from "@/lib/category-colors";
import { useReducedMotion, useDrawReveal, useLiveTape, useChartPan, useLiveClock, frozenFitRange, type FitBand } from "./chart-hooks";

// Interactive single-market price chart — dependency-free SVG.
//
// ONE continuous per-second price series is the source of truth: a live tape
// (useLiveTape) covers the recent past at per-second fidelity and a deterministic
// sampler (makeSampler) fills everything older, so history and the live edge meet
// with no seam and no "jump". Every timeframe is a *window* (zoom) over that same
// series — the right edge is always `now`, updating ~30fps; a narrow window (1s)
// lets each per-second move fill the frame, a wide one (1w) shrinks the same moves
// proportionally. Drag/swipe left pans back through the full history (nothing is
// lost off the front page); a "back to live" chip snaps to the edge.
//
// The plot auto-fits its vertical range to the visible window so real moves fill
// the frame. The price line is drawn per-category (the market's own theme colour);
// the AI estimate keeps its burnt-orange dashed line; news markers keep brand
// orange. The SVG carries only geometry — every label, dot and the tooltip live in
// HTML overlays so nothing distorts when the SVG stretches.

export interface TradePoint {
  created_at: string;
  coins: number;
  price_yes: number;
}

export interface SnapshotPoint {
  created_at: string;
  ai_prob: number | null;
  market_prob: number;
  evidence?: { title: string; slug: string; url?: string }[] | null;
}

type NewsEvidence = { title: string; slug: string; url?: string };

// Timeframe = window width (zoom) over ONE continuous per-second series. Every
// frame the right edge is `now`; a narrower window makes each per-second move
// fill more of the frame, a wider one shrinks the same moves proportionally.
// The `ms` is how much wall-clock the window spans at panMs = 0.
const RANGES = [
  { key: "1s", ms: 60_000 }, //           60 s — every tick fills the frame
  { key: "1m", ms: 600_000 }, //          10 min
  { key: "5m", ms: 2_700_000 }, //        45 min
  { key: "15m", ms: 10_800_000 }, //       3 h
  { key: "1h", ms: 43_200_000 }, //       12 h
  { key: "4h", ms: 172_800_000 }, //       2 d
  { key: "1d", ms: 1_209_600_000 }, //    14 d
  { key: "1w", ms: 7_257_600_000 }, //    12 w
  { key: "Gjithë", ms: Infinity }, //     all time
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const W = 640;
const AXIS_H = 24;
const PLOT_TOP = 12;
const VOL_H = 34;
// Width of the gleam that travels along the line once a minute — kept in sync
// with the `tg-line-shine` keyframe in globals.css (travel = W + SHINE_W).
const SHINE_W = 180;

// AI estimate rides a glossy burnt-orange; the news marker takes the brand
// orange — both distinct shapes (dashed line vs diamond) and hues that stay
// legible against every category accent.
const AI = "#EA580C";
const AI_GLEAM = "#FFD8B0";
const EVENT = "#FF4422";

const N_SAMPLES = 220; // screen-space resolution of the windowed line
const N_BUCKETS = 36; // volume histogram buckets across the window

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Dynamic Y ticks over the fitted [lo, hi] band — mirrors GroupChart so both
// charts read the same. Coarser steps for wide ranges, finer for tight ones.
function ticksFor(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span > 0.55 ? 0.2 : span > 0.3 ? 0.1 : 0.05;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
    out.push(Math.round(t * 100) / 100);
  }
  return out;
}

// Plain piecewise-linear read of a sorted anchor list, held flat past both
// ends. Used for the AI estimate line (calm, no jitter) and hover readout.
function valueAt(anchors: { t: number; p: number }[], t: number): number | null {
  if (anchors.length === 0) return null;
  if (t <= anchors[0].t) return anchors[0].p;
  const last = anchors[anchors.length - 1];
  if (t >= last.t) return last.p;
  let i = 0;
  while (i < anchors.length - 1 && anchors[i + 1].t <= t) i++;
  const a = anchors[i];
  const b = anchors[i + 1] ?? a;
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  return a.p + (b.p - a.p) * f;
}

export default function MarketChart({
  trades,
  snapshots,
  currentProb,
  seedKey = "tregu",
  height = 460,
  category,
  cadenceMs = 300_000,
}: {
  trades: TradePoint[];
  snapshots: SnapshotPoint[];
  currentProb: number;
  seedKey?: string;
  height?: number;
  category?: string;
  cadenceMs?: number;
}) {
  const [range, setRange] = useState<RangeKey>("1d");
  const [hover, setHover] = useState<{ frac: number; t: number; p: number; ai: number | null; live: boolean } | null>(null);
  // News marker popup: `pinned` set by click/tap (mobile-friendly), `hovered`
  // by mouse enter (desktop). Either one open shows the article that moved it.
  const [pinnedNews, setPinnedNews] = useState<number | null>(null);
  const [hoveredNews, setHoveredNews] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Hover-intent bridge: leaving a marker schedules a close, but entering the
  // popup cancels it, so the popup stays open while the cursor is over it.
  const closeRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fitRef = useRef<FitBand>(null);
  // Growing-trace anchor: the pinned left-edge time for short windows (1s/1m).
  // While the trace fills, leftT stays at t0 so every drawn second holds a fixed
  // x — pixel-static history — and only the tip advances. Reseeds per view.
  const growRef = useRef<{ key: string; t0: number } | null>(null);
  const reduced = useReducedMotion();
  const drawn = useDrawReveal(1350, reduced);
  const { now: clockNow, nextInMs } = useLiveClock(cadenceMs);

  // Per-category accent — drives the whole price line, area, dot and legend.
  const accent = getCategoryColor(category ?? "");

  // Defs are document-scoped; a hardcoded id would collide with another chart
  // on the page. React ids carry punctuation url(#…) can't resolve — strip it.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const areaId = `tg-area-${uid}`;
  const shineMaskId = `tg-mshine-mask-${uid}`;
  const shineBandId = `tg-mshine-band-${uid}`;
  const shineGlowId = `tg-mshine-glow-${uid}`;
  const revealId = `tg-reveal-${uid}`;

  const H = height;
  const PLOT_BOTTOM = H - AXIS_H;
  const yFor = (p: number) => (lo === hi ? PLOT_TOP : PLOT_TOP + (PLOT_BOTTOM - PLOT_TOP) * (1 - (p - lo) / (hi - lo)));

  // Build the continuous-series inputs once per data change (NOT per frame):
  // the deterministic sampler over all real anchors, the AI/news anchor lists,
  // pre-parsed trade times for the volume histogram, and the full-history floor.
  const data = useMemo(() => {
    const now0 = Date.now();
    const real = [
      ...snapshots.map((s) => ({ t: +new Date(s.created_at), p: s.market_prob })),
      ...trades.map((tr) => ({ t: +new Date(tr.created_at), p: tr.price_yes })),
    ]
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.p))
      .sort((a, b) => a.t - b.t);
    const realCount = real.length;

    // Anchor the sampler's right edge at the live value so the gap between the
    // last real repricing and now fills with textured drift (not a flat hold),
    // and joins the live tape continuously.
    const anchors = [...real, { t: now0, p: currentProb }];
    const sampler = makeSampler(anchors, seedKey);
    const tMinAll = real.length > 0 ? real[0].t : now0 - 86_400_000;

    // FREEZE history once. The sampler is a high-frequency deterministic hash;
    // evaluating it live at scrolling `t` every frame reshuffles the whole past
    // ("disco"). Instead we evaluate it ONCE here into an immutable curve. This
    // array is rebuilt only when [trades, snapshots, currentProb, seedKey]
    // change (~every 5-min refresh), so between refreshes history is drawn once
    // and never rewritten — only the live edge moves. Render interpolates THIS
    // curve, never the hash. (Polymarket/Kalshi: committed history, live tail.)
    const HIST_MAX = 5000;
    const histStep = Math.max(60_000, Math.ceil((now0 - tMinAll) / HIST_MAX));
    const history: { t: number; p: number }[] = [];
    for (let t = tMinAll; t < now0; t += histStep) history.push({ t, p: sampler(t) });
    history.push({ t: now0, p: sampler(now0) });

    const aiAnchors = snapshots
      .filter((s) => s.ai_prob !== null)
      .map((s) => ({ t: +new Date(s.created_at), p: s.ai_prob as number }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);

    const events = snapshots
      .filter((s) => s.evidence && s.evidence.length > 0)
      .map((s) => ({ t: +new Date(s.created_at), p: s.market_prob, evidence: s.evidence as NewsEvidence[] }))
      .filter((e) => Number.isFinite(e.t))
      .sort((a, b) => a.t - b.t);

    const tradeTimes = trades
      .map((tr) => ({ t: +new Date(tr.created_at), c: Math.abs(tr.coins) }))
      .filter((x) => Number.isFinite(x.t));

    // dataKey reseeds the live tape only on structural change — NOT on every
    // currentProb tick (that flows through the tape's target ref instead).
    const dataKey = `${seedKey}|${realCount}|${Math.round(tMinAll / 60_000)}`;
    return { sampler, history, aiAnchors, events, tradeTimes, tMinAll, realCount, dataKey };
  }, [trades, snapshots, currentProb, seedKey]);

  // The live per-second tape (recent history + gliding right edge). `tapeNow`
  // ticks every frame and drives the window; the tape is read during render.
  // `live` is the eased sub-second tip value (glides smoothly at the edge).
  const { now: tapeNow, tape, live } = useLiveTape(data.sampler, data.dataKey, currentProb, !reduced);

  // Window geometry. `windowMs` is the visible span; `maxPanMs` how far back the
  // window can be dragged. Both recompute each frame as `now` advances.
  const rangeMs = RANGES.find((r) => r.key === range)!.ms;
  const isAll = !Number.isFinite(rangeMs);
  const fullSpan = Math.max(tapeNow - data.tMinAll, 60_000);
  const windowMs = isAll ? fullSpan : Math.min(rangeMs, fullSpan);
  const maxPanMs = isAll ? 0 : Math.max(0, fullSpan - windowMs);
  const pan = useChartPan(boxRef, maxPanMs, windowMs, !reduced);

  // Interpolate the FROZEN history curve (immutable between refreshes). Never
  // calls the hash at moving `t`, so the past never reshuffles — it only scrolls.
  const histAt = (t: number): number => {
    const h = data.history;
    const n = h.length;
    if (n === 0) return currentProb;
    if (t <= h[0].t) return h[0].p;
    if (t >= h[n - 1].t) return h[n - 1].p;
    let loI = 0;
    let hiI = n - 1;
    while (loI < hiI - 1) {
      const mid = (loI + hiI) >> 1;
      if (h[mid].t <= t) loI = mid;
      else hiI = mid;
    }
    const a = h[loI];
    const b = h[hiI];
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    return a.p + (b.p - a.p) * f;
  };

  // Continuous price read: frozen history for older `t`, the append-only live
  // tape for recent seconds, and the gliding `live` value at the very tip. Every
  // point behind the tip is immutable; only the edge animates.
  const priceAt = (t: number): number => {
    const n = tape.length;
    if (n === 0) return histAt(t);
    if (t <= tape[0].t) return histAt(t);
    if (t >= tape[n - 1].t) return live;
    let loI = 0;
    let hiI = n - 1;
    while (loI < hiI - 1) {
      const mid = (loI + hiI) >> 1;
      if (tape[mid].t <= t) loI = mid;
      else hiI = mid;
    }
    const a = tape[loI];
    const b = tape[hiI];
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    return a.p + (b.p - a.p) * f;
  };

  if (data.realCount < 2) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>
        Ende pa mjaftueshëm të dhëna historike
      </div>
    );
  }

  // Absolute window edges (right = live minus pan). Clamp keeps the left edge at
  // the true start of history for "Gjithë" and when panned to the far past.
  //
  // Quantize the right edge to whole seconds: within a second every committed
  // sample maps to a fixed time -> fixed x/y, so drawn history is pixel-frozen and
  // only advances one grid step (sub-pixel on all but the 1s window) when a new
  // second commits. The one segment from the last committed second to this edge is
  // the live line being drawn; its tip uses the gliding `live` value.
  const edge = Math.ceil(tapeNow / 1000) * 1000;
  // Growing-trace on short windows (1s/1m): the line draws left -> right into
  // empty space, every drawn second frozen in place (leftT pinned at t0), only
  // the tip moving. When the window fills after `windowMs`, leftT begins to
  // scroll (max() flips over), matching the accepted "then it scrolls" fallback.
  // Wider windows keep the right-anchored model — already static and they show
  // the whole history immediately instead of sitting empty for hours.
  const isGrow = !isAll && windowMs <= 600_000;
  let leftT: number;
  let rightT: number;
  let spanMs: number;
  let tipT: number;
  if (isGrow) {
    const key = `${range}|${data.dataKey}`;
    if (!growRef.current || growRef.current.key !== key) growRef.current = { key, t0: edge - 1000 };
    const t0 = growRef.current.t0;
    leftT = Math.max(t0, edge - windowMs);
    rightT = leftT + windowMs;
    spanMs = windowMs;
    tipT = edge;
  } else {
    rightT = edge - (isAll ? 0 : pan.panMs);
    leftT = isAll ? data.tMinAll : rightT - windowMs;
    spanMs = Math.max(1, rightT - leftT);
    tipT = rightT;
  }

  // Committed price at the tip (last whole-second value, NOT the 30fps easing
  // `live`). The vertical fit uses this so the axis steps at most once per second
  // — the real-time change — instead of breathing at frame rate under the tip.
  const tipCommitted = tape.length ? tape[tape.length - 1].p : currentProb;
  const priceForFit = (t: number, drawn: number): number =>
    tape.length && t >= tape[tape.length - 1].t ? tipCommitted : drawn;

  // Sample the window across the plot; draw uses the gliding tip, the fit uses
  // the committed value so history never re-scales frame to frame.
  const samp: { t: number; p: number; x: number }[] = [];
  let plo = 1;
  let phi = 0;
  for (let i = 0; i <= N_SAMPLES; i++) {
    const t = leftT + (i / N_SAMPLES) * spanMs;
    if (t > tipT + 1) break; // growing trace: draw nothing right of the live tip
    const p = priceAt(t);
    const pf = priceForFit(t, p);
    if (pf < plo) plo = pf;
    if (pf > phi) phi = pf;
    samp.push({ t, p, x: (i / N_SAMPLES) * W });
  }
  // End the trace exactly at the tip so the drawing edge is crisp (the last grid
  // sample usually lands just short of `tipT`).
  if (isGrow && samp.length && samp[samp.length - 1].t < tipT - 1) {
    const p = priceAt(tipT);
    const pf = priceForFit(tipT, p);
    if (pf < plo) plo = pf;
    if (pf > phi) phi = pf;
    samp.push({ t: tipT, p, x: ((tipT - leftT) / spanMs) * W });
  }
  // Growing trace only draws a sliver of the window, so its fit would start tiny
  // and expand as the trace fills — dragging the drawn history up and down. Seed
  // the band from the full recent committed window instead: representative from
  // the first frame, then frozen, so drawn seconds hold their vertical position
  // and only the tip moves.
  if (isGrow) {
    const from = edge - windowMs;
    for (let i = 0; i <= N_SAMPLES; i++) {
      const t = from + (i / N_SAMPLES) * windowMs;
      if (t > edge) break;
      const pf = priceForFit(t, priceAt(t));
      if (pf < plo) plo = pf;
      if (pf > phi) phi = pf;
    }
  }

  // Fit the plot to the visible window so real moves fill the frame; 12pt floor
  // so a dead-flat stretch still gets a readable band instead of a pinned line.
  let tLo = Math.max(0, plo - 0.03);
  let tHi = Math.min(1, phi + 0.03);
  if (tHi - tLo < 0.12) {
    const mid = (tHi + tLo) / 2;
    tLo = Math.max(0, mid - 0.06);
    tHi = Math.min(1, tLo + 0.12);
  }
  // Freeze the band for this view so drawn history never re-scales frame to frame;
  // it only grows (eased) when the live value pushes a genuine new high/low into
  // view. Keyed by range+dataKey so it reseeds on a timeframe switch or a data
  // refresh, and holds rock-still otherwise.
  const [lo, hi] = frozenFitRange(fitRef, `${range}|${data.dataKey}`, tLo, tHi, reduced);

  const lineXY = samp.map((s) => ({ x: s.x, y: yFor(s.p) }));
  const linePath = smoothPath(lineXY);
  const firstXY = lineXY[0];
  const lastXY = lineXY[lineXY.length - 1];
  const areaPath = `${linePath} L ${lastXY.x.toFixed(1)} ${PLOT_BOTTOM} L ${firstXY.x.toFixed(1)} ${PLOT_BOTTOM} Z`;

  // AI estimate: calm linear line across the window, only where AI data exists
  // (t ≥ first AI anchor), held flat to the right edge afterwards.
  const firstAiT = data.aiAnchors[0]?.t;
  const aiXY =
    firstAiT != null
      ? samp.filter((s) => s.t >= firstAiT).map((s) => ({ x: s.x, y: yFor(valueAt(data.aiAnchors, s.t) ?? 0) }))
      : [];
  const aiPath = aiXY.length > 1 ? smoothPath(aiXY) : "";

  // Volume histogram over the visible window.
  const volBuckets = new Array<number>(N_BUCKETS).fill(0);
  for (const tr of data.tradeTimes) {
    if (tr.t < leftT || tr.t > rightT) continue;
    const i = Math.min(N_BUCKETS - 1, Math.floor(((tr.t - leftT) / spanMs) * N_BUCKETS));
    volBuckets[i] += tr.c;
  }
  const maxVol = Math.max(...volBuckets, 1);
  const bucketW = W / N_BUCKETS;

  // News markers within the window.
  const xForT = (t: number) => ((t - leftT) / spanMs) * W;
  const shownEvents = data.events
    .map((e, gi) => ({ ...e, gi }))
    .filter((e) => e.t >= leftT && e.t <= rightT);

  const isLiveEdge = isAll || pan.panMs < 1500;
  const lastP = samp[samp.length - 1].p;
  const ticks = ticksFor(lo, hi);
  const activeNews = pinnedNews ?? hoveredNews;

  const onMove = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const xpx = Math.max(0, Math.min(W, ((clientX - rect.left) / rect.width) * W));
    let nearest = samp[0];
    for (const s of samp) if (Math.abs(s.x - xpx) < Math.abs(nearest.x - xpx)) nearest = s;
    const ai = valueAt(data.aiAnchors, nearest.t);
    const live = rightT - nearest.t < 2000 && isLiveEdge;
    setHover({ frac: nearest.x / W, t: nearest.t, p: nearest.p, ai, live });
  };

  // Time axis labels — resolution-aware so a 1s window reads seconds and a
  // multi-week window reads dates.
  const fmtAxis = (t: number) => {
    const d = new Date(t);
    if (spanMs <= 180_000) return d.toLocaleTimeString("sq-AL", { minute: "2-digit", second: "2-digit" });
    if (spanMs <= 2 * 86_400_000) return d.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("sq-AL", { day: "numeric", month: "short" });
  };
  const axisTicks = [0.08, 0.5, 0.92].map((f) => ({ f, label: fmtAxis(leftT + f * spanMs) }));

  // News hover-intent helpers.
  const cancelClose = () => {
    if (closeRef.current) {
      clearTimeout(closeRef.current);
      closeRef.current = undefined;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeRef.current = setTimeout(() => setHoveredNews(null), 160);
  };

  const canPan = maxPanMs > 0 && !reduced;

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
          ref={boxRef}
          style={{ touchAction: "pan-y", cursor: pan.dragging ? "grabbing" : canPan ? "grab" : "default" }}
          onPointerDown={pan.onPointerDown}
          onPointerMove={(e) => {
            const consumed = pan.onPointerMove(e);
            if (consumed) {
              if (hover) setHover(null);
            } else if (e.pointerType === "mouse" && !pan.dragging) {
              onMove(e.clientX);
            }
          }}
          onPointerUp={pan.onPointerUp}
          onPointerCancel={pan.onPointerUp}
          onPointerLeave={() => {
            if (!pan.dragging) setHover(null);
          }}
          onClick={() => {
            if (!pan.dragging) setPinnedNews(null);
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.20" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
              {/* Soft-edged band; masking a duplicate of the line with it makes
                  a gleam ride the stroke — the SVG analogue of .glossy-orange. */}
              <linearGradient id={shineBandId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                <stop offset="38%" stopColor="#fff" stopOpacity="0.3" />
                <stop offset="55%" stopColor="#fff" stopOpacity="1" />
                <stop offset="72%" stopColor="#fff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              {/* Bleeds the glow pass outward so the gleam reads as light
                  spilling off the line, not as the stroke thinning. */}
              <filter id={shineGlowId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" />
              </filter>
              <mask id={shineMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                <rect className="tregu-gchart-shine" x={-SHINE_W} y="0" width={SHINE_W} height={H} fill={`url(#${shineBandId})`} />
              </mask>
              {/* Left-to-right reveal: a rect that grows from x=0 clips the plot,
                  so on open the chart starts empty and draws in to the live edge.
                  Reduced-motion CSS pins it fully open. */}
              <clipPath id={revealId}>
                <rect className="tregu-chart-reveal" x="0" y="0" width={W} height={H} />
              </clipPath>
            </defs>

            {ticks.map((g) => (
              <line
                key={g}
                x1="0"
                x2={W}
                y1={yFor(g)}
                y2={yFor(g)}
                stroke="var(--tg-chart-grid, rgba(17,17,17,0.08))"
                strokeWidth="1"
                strokeDasharray="2 6"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {volBuckets.map((v, i) =>
              v > 0 ? (
                <rect
                  key={i}
                  x={i * bucketW + 0.5}
                  y={PLOT_BOTTOM - (v / maxVol) * VOL_H}
                  width={Math.max(1, bucketW - 1)}
                  height={(v / maxVol) * VOL_H}
                  fill="rgba(17,17,17,0.10)"
                />
              ) : null
            )}

            {/* Everything price-related sits inside the reveal clip so the
                area + line + AI wipe in together from the left on open. */}
            <g clipPath={`url(#${revealId})`}>
              <path className="tregu-area-fade" d={areaPath} fill={`url(#${areaId})`} />

              {/* AI estimate: dashed gradual line in burnt orange, wrapped in the
                  same travelling gleam so it reads glossy and shiny on refresh. */}
              {aiPath && (
                <>
                  <path d={aiPath} fill="none" stroke={AI} strokeWidth="2" strokeDasharray="5 4" opacity="0.95" vectorEffect="non-scaling-stroke" />
                  {!hover && !pan.dragging && (
                    <g mask={`url(#${shineMaskId})`}>
                      <path d={aiPath} fill="none" stroke={AI} strokeWidth="6" strokeDasharray="5 4" strokeLinecap="round" opacity="0.5" filter={`url(#${shineGlowId})`} />
                      <path d={aiPath} fill="none" stroke={AI_GLEAM} strokeWidth="2.4" strokeDasharray="5 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </g>
                  )}
                </>
              )}

              {/* Price line + travelling gleam (gleam suppressed on hover/drag so
                  it never lights up while the crosshair is reading the past). */}
              <path d={linePath} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {!hover && !pan.dragging && (
                <g mask={`url(#${shineMaskId})`}>
                  <path d={linePath} fill="none" stroke={accent} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" filter={`url(#${shineGlowId})`} />
                  <path d={linePath} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" vectorEffect="non-scaling-stroke" />
                </g>
              )}
            </g>

            {hover && (
              <line
                x1={hover.frac * W}
                y1={PLOT_TOP}
                x2={hover.frac * W}
                y2={PLOT_BOTTOM}
                stroke="var(--tg-chart-cross, rgba(17,17,17,0.35))"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Endpoint dot — pulses while at the live edge, slides to the
              crosshair point on hover, or sits static when panned into history.
              HTML so it stays a true circle over the stretched SVG. */}
          {(drawn || hover) && (
            <span
              className={hover ? "tregu-gchart-dot" : isLiveEdge ? "tregu-gchart-dot tregu-gchart-dot--live" : "tregu-gchart-dot"}
              style={hover ? { top: yFor(hover.p), left: `${hover.frac * 100}%`, right: "auto", background: accent } : { top: yFor(lastP), background: accent }}
              aria-hidden
            />
          )}

          {/* Back-to-live chip — appears when panned into the past. */}
          {!isAll && pan.panMs > 2000 && (
            <button type="button" className="tregu-tolive" onClick={pan.resetPan} aria-label="Kthehu te tani">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M13 5l7 7-7 7M20 12H4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Live
            </button>
          )}

          {/* News markers — orange diamonds on the price line where a "lajm i
              ri" moved the market. Hover (desktop) or tap (mobile) opens the
              article. Held back until the reveal wipe has passed them. */}
          {drawn &&
            shownEvents.map((e) => (
              <button
                key={e.gi}
                type="button"
                className="tregu-newsmark"
                data-open={activeNews === e.gi}
                style={{ left: `${(xForT(e.t) / W) * 100}%`, top: yFor(e.p), background: EVENT }}
                aria-label={`Lajmi që lëvizi tregun: ${e.evidence[0]?.title ?? ""}`}
                onPointerEnter={(ev) => {
                  if (ev.pointerType === "mouse") {
                    cancelClose();
                    setHoveredNews(e.gi);
                  }
                }}
                onPointerLeave={(ev) => {
                  if (ev.pointerType === "mouse") scheduleClose();
                }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setPinnedNews((cur) => (cur === e.gi ? null : e.gi));
                }}
              />
            ))}

          {/* News popup — the article(s) behind the active marker. Hovering the
              popup itself cancels the pending close, so it stays put. */}
          {drawn && activeNews !== null && data.events[activeNews] && data.events[activeNews].t >= leftT && data.events[activeNews].t <= rightT && (
            <div
              className="tregu-newspop"
              style={{
                left: `${Math.max(4, Math.min(96, (xForT(data.events[activeNews].t) / W) * 100))}%`,
                top: Math.max(4, yFor(data.events[activeNews].p) - 16),
              }}
              onPointerEnter={cancelClose}
              onPointerLeave={(ev) => {
                if (ev.pointerType === "mouse" && pinnedNews === null) scheduleClose();
              }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="tregu-newspop-kicker">
                <span className="tregu-newspop-diamond" style={{ background: EVENT }} />
                Lajmi që lëvizi tregun
              </div>
              {data.events[activeNews].evidence.slice(0, 2).map((ev, j) => (
                <a
                  key={j}
                  className="tregu-newspop-item"
                  href={ev.url || `/lajme/${ev.slug}`}
                  target={ev.url ? "_blank" : undefined}
                  rel={ev.url ? "noopener noreferrer" : undefined}
                >
                  <span className="tregu-newspop-title">{ev.title}</span>
                  <span className="tregu-newspop-src">
                    Lexo lajmin
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M7 17L17 7M17 7H9M17 7v8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </a>
              ))}
            </div>
          )}

          {/* Time axis — HTML so it never stretches with the SVG. */}
          {axisTicks.map((tick) => (
            <span key={tick.f} className="tregu-axis-label" style={{ left: `${tick.f * 100}%`, bottom: 2, transform: "translateX(-50%)" }}>
              {tick.label}
            </span>
          ))}

          {hover && (
            <div
              className="tregu-chart-tip"
              style={{
                left: `${Math.max(9, Math.min(91, hover.frac * 100))}%`,
                top: Math.max(0, yFor(hover.p) - 74),
              }}
            >
              <div className="tregu-chart-tip-date">
                {hover.live
                  ? `Tani · ${new Date(hover.t).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : spanMs <= 180_000
                    ? new Date(hover.t).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : `${new Date(hover.t).toLocaleDateString("sq-AL", { day: "numeric", month: "short" })} ${new Date(hover.t).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}`}
              </div>
              <div className="tregu-chart-tip-row">
                <span className="tregu-chart-tip-dot" style={{ background: accent }} />
                Tregu <strong>{Math.round(hover.p * 100)}%</strong>
              </div>
              {hover.ai !== null && (
                <div className="tregu-chart-tip-row">
                  <span className="tregu-chart-tip-dot" style={{ background: AI }} />
                  AI <strong>{Math.round(hover.ai * 100)}%</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right gutter: % axis, fitted to the data band. */}
        <div className="tregu-gchart-gutter" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="tregu-gchart-tick" style={{ top: yFor(t) }}>
              {Math.round(t * 100)}%
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 2.5, background: accent, display: "inline-block", borderRadius: 2 }} /> Çmimi i tregut
        </span>
        {data.aiAnchors.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 0, borderTop: `2.5px dashed ${AI}`, display: "inline-block" }} /> Vlerësimi AI
          </span>
        )}
        {data.events.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, background: EVENT, display: "inline-block", transform: "rotate(45deg)", border: "1px solid rgba(17,17,17,0.45)" }} /> Lajm i ri
          </span>
        )}
      </div>
    </div>
  );
}
