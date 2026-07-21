"use client";

import { useId, useMemo, useRef, useState } from "react";
import { dramatizeSeries, smoothPath } from "@/lib/tregu-tape";
import { useReducedMotion, useDrawReveal, useLiveVector, useLiveClock } from "./chart-hooks";

// Multi-outcome event chart — the Polymarket-style view for grouped events.
// Time-aware: every outcome's line is drawn from real timestamped points
// (5-minute cron snapshots + live price), values are normalized per timestamp
// so displayed odds always sum to 100%, and hovering snaps to the nearest
// recorded point with a live date/time tooltip reading every line.
//
// The rightmost ~16% is a live band: a per-second eased vector flows there
// toward the next real refresh (2 min live sports · 5 min general), so every
// line visibly breathes each second on any time range. Lines are smoothed into
// rounded curves (no sharp rectangle corners), and a countdown pill shows the
// real clock and time to the next repricing.
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

const RANGES = [
  { key: "1D", ms: 86_400_000 },
  { key: "1J", ms: 7 * 86_400_000 },
  { key: "1M", ms: 30 * 86_400_000 },
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
// Fraction of the plot width reserved for the live flow band at the right edge.
const LIVE_FRAC = 0.16;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function seriesOf(s: EventSeries): { t: number; p: number }[] {
  if (s.series && s.series.length >= 2) {
    // A writer can record a state and odds snapshot in the same millisecond.
    // Keep only the latest value at that timestamp so paths never form an artificial vertical rectangle.
    return [...new Map(s.series.map((point) => [point.t, point])).values()];
  }
  const now = Date.now();
  return [
    { t: now - 86_400_000, p: s.prob },
    { t: now, p: s.prob },
  ];
}

// Last known value at time t (step/forward-fill — a book holds its price
// between snapshots).
function valueAt(pts: { t: number; p: number }[], t: number): number {
  let v = pts[0].p;
  for (const pt of pts) {
    if (pt.t > t) break;
    v = pt.p;
  }
  return v;
}

// Push-apart with bounds: enforce 26px spacing downward, then walk the stack
// back inside [minY, maxY] — without the clamp a tall stack (an F1 grid's
// chips) marches straight past the plot's bottom edge into the next section.
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
  const [range, setRange] = useState<RangeKey>("1D");
  const [hoverI, setHoverI] = useState<{ x: number; t: number; values: number[]; live: boolean; gi: number | null } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
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

  // Union time grid across every outcome, normalized per grid point so the
  // lines mirror each other: a spike in one outcome dips its rivals.
  const { grid, tMin, tMax, lo, hi } = useMemo(() => {
    const now = Date.now();
    const tapes = series.map(seriesOf);
    const span = RANGES.find((r) => r.key === range)!.ms;
    const cutoff = span === Infinity ? -Infinity : now - span;

    const stamps = new Set<number>();
    for (const tape of tapes) {
      for (const pt of tape) if (pt.t >= cutoff) stamps.add(pt.t);
    }
    stamps.add(now);
    // Anchor the left edge so lines enter the frame at their true level.
    if (cutoff !== -Infinity) stamps.add(cutoff);
    const times = [...stamps].sort((a, b) => a - b);

    const grid = times.map((t) => {
      const raw = tapes.map((tape) => valueAt(tape, t));
      const sum = raw.reduce((s, v) => s + v, 0);
      return { t, values: raw.map((v) => (sum > 0 ? v / sum : 1 / raw.length)) };
    });

    const tMin = grid.length > 0 ? grid[0].t : now - 86_400_000;
    const tMaxRaw = grid.length > 0 ? grid[grid.length - 1].t : now;
    const tMax = tMaxRaw > tMin ? tMaxRaw : tMin + 1;

    let lo = 1;
    let hi = 0;
    for (const g of grid) for (const v of g.values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    // Tight vertical fit — small padding so real moves fill the plot and read
    // as sharp swings instead of a flat band.
    lo = Math.max(0, lo - 0.02);
    hi = Math.min(1, hi + 0.02);
    if (hi - lo < 0.12) {
      const mid = (hi + lo) / 2;
      lo = Math.max(0, mid - 0.06);
      hi = Math.min(1, lo + 0.12);
    }
    return { grid, tMin, tMax, lo, hi };
  }, [series, range]);

  // Per-second eased vector buffer. Real book prices refresh every 2–5 min; the
  // walk drifts each outcome toward its true value and renormalizes so the tail
  // breathes every second (never lying about where the odds sit). Rendered in
  // the right-edge live band, mapped by index so the flow stays visible on any
  // time range.
  const liveVec = useLiveVector(series.map((s) => s.prob), !reduced);
  const liveActive = !reduced && !!liveVec && liveVec.length > 1 && (liveVec[0]?.length ?? 0) === series.length;
  const REAL_W = W * (1 - (liveActive ? LIVE_FRAC : 0));

  const xForReal = (t: number) => {
    const denom = tMax - tMin || 1;
    const f = Math.max(0, Math.min(1, (t - tMin) / denom));
    return f * REAL_W;
  };
  const tailX = (idx: number) => REAL_W + ((idx + 1) / ((liveVec?.length ?? 2) - 1)) * (W - REAL_W);
  const yFor = (p: number) => PLOT_TOP + (PLOT_BOTTOM - PLOT_TOP) * (1 - (p - lo) / (hi - lo));

  // Project real rows for one outcome: dramatize (jagged in-between texture,
  // real anchors exact) then map to screen space in the real zone.
  const projReal = (rows: { t: number; p: number }[], key: string) =>
    dramatizeSeries(rows, key).map((g) => ({ x: xForReal(g.t), y: yFor(g.p) }));
  const tailXYFor = (si: number) =>
    liveActive && liveVec
      ? liveVec.slice(1).map((row, idx) => ({ x: tailX(idx), y: yFor(row[si]) }))
      : [];

  if (grid.length < 2) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>
        Ende pa mjaftueshëm të dhëna historike
      </div>
    );
  }

  // Unified hover stops (real points + live tail) for nearest-by-x snapping.
  const hoverStops: { x: number; t: number; values: number[]; live: boolean; gi: number | null }[] = [
    ...grid.map((g, i) => ({ x: xForReal(g.t), t: g.t, values: g.values, live: false, gi: i })),
    ...(liveActive && liveVec
      ? liveVec.slice(1).map((row, idx) => ({ x: tailX(idx), t: clockNow, values: row, live: true, gi: null as number | null }))
      : []),
  ];

  const onMove = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const xpx = Math.max(0, Math.min(W, ((clientX - rect.left) / rect.width) * W));
    let best = hoverStops[0];
    for (const stop of hoverStops) if (Math.abs(stop.x - xpx) < Math.abs(best.x - xpx)) best = stop;
    setHoverI(best);
  };

  const hover = hoverI;
  const lastValues = liveActive && liveVec ? liveVec[liveVec.length - 1] : grid[grid.length - 1].values;
  const ticks = ticksFor(lo, hi);

  const realFrac = 1 - (liveActive ? LIVE_FRAC : 0);
  const spanMs = tMax - tMin;
  const axisTicks = [0.08, 0.4, 0.72].map((f) => {
    const d = new Date(tMin + f * spanMs);
    const label =
      spanMs <= 2 * 86_400_000
        ? d.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("sq-AL", { day: "numeric", month: "short" });
    return { f: f * realFrac, label };
  });

  // Chips are pushed apart 26px, so only so many fit the plot height.
  const maxChips = Math.max(3, Math.floor((PLOT_BOTTOM - PLOT_TOP) / 26));

  // Endpoint chips: live normalized odds at each line's end, pushed apart.
  const chips = series
    .map((s, i) => ({ s, v: lastValues[i], y: yFor(lastValues[i]) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, maxChips)
    .sort((a, b) => a.y - b.y);
  spreadWithin(chips, PLOT_TOP + 2, PLOT_BOTTOM - 12);

  // Labels that ride the crosshair.
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div className="tregu-live-pill" aria-live="off">
          <span className="tregu-live-dot" aria-hidden />
          <span className="tregu-live-clock">
            {new Date(clockNow).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="tregu-live-sep" aria-hidden>·</span>
          <span className="tregu-live-refresh">Rifreskim {mmss(nextInMs)}</span>
        </div>
        <div className="tregu-sort" role="tablist" aria-label="Periudha e grafikut">
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
          style={{ touchAction: "pan-y" }}
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerLeave={() => setHoverI(null)}
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

            {liveActive && (
              <line
                x1={REAL_W}
                x2={REAL_W}
                y1={PLOT_TOP}
                y2={PLOT_BOTTOM}
                stroke="var(--tg-chart-grid, rgba(17,17,17,0.12))"
                strokeWidth="1"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            )}

            <g clipPath={`url(#${revealId})`}>
              {/* On hover the minutes after the crosshair go gray — only the
                  played part of the game keeps its colour (Polymarket-style).
                  Only applies when hovering a real point; live has no future. */}
              {hover !== null &&
                !hover.live &&
                hover.gi !== null &&
                hover.gi < grid.length - 1 &&
                series.map((s, si) => {
                  const d = smoothPath(projReal(grid.slice(hover.gi as number).map((g) => ({ t: g.t, p: g.values[si] })), `${s.label}-f`));
                  return (
                    <path
                      key={`f-${s.label}`}
                      d={d}
                      fill="none"
                      stroke="var(--tg-chart-future, rgba(17,17,17,0.16))"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              {series.map((s, si) => {
                // Not hovering → colour the full real+live line. Hovering a real
                // point → freeze the coloured past up to it. Hovering live →
                // colour everything (there is no future).
                const coloredXY =
                  hover === null || hover.live
                    ? [...projReal(grid.map((g) => ({ t: g.t, p: g.values[si] })), s.label), ...tailXYFor(si)]
                    : projReal(grid.slice(0, (hover.gi as number) + 1).map((g) => ({ t: g.t, p: g.values[si] })), s.label);
                const d = smoothPath(coloredXY);
                return (
                  <g key={s.label}>
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
                        travelling mask band. Suppressed on hover. */}
                    {hover === null && (
                      <g mask={`url(#${shineMaskId})`}>
                        <path d={d} fill="none" stroke={s.color} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" filter={`url(#${shineGlowId})`} />
                        <path d={d} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" vectorEffect="non-scaling-stroke" />
                      </g>
                    )}
                  </g>
                );
              })}
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

          {/* Live endpoint dots — pulsing while live, sliding to the crosshair
              point on hover. Held back until the left-to-right wipe passes. */}
          {(drawn || hover) &&
            series.map((s, i) => (
              <span
                key={s.label}
                className={hover ? "tregu-gchart-dot" : "tregu-gchart-dot tregu-gchart-dot--live"}
                style={
                  hover
                    ? { top: yFor(hover.values[i]), left: `${hoverXpct}%`, right: "auto", background: s.color }
                    : { top: yFor(lastValues[i]), background: s.color }
                }
                aria-hidden
              />
            ))}

          {/* Time axis — HTML so it never stretches with the SVG. */}
          {axisTicks.map((tick) => (
            <span key={tick.f} className="tregu-axis-label" style={{ left: `${tick.f * 100}%`, bottom: 2, transform: "translateX(-50%)" }}>
              {tick.label}
            </span>
          ))}
          {liveActive && (
            <span className="tregu-axis-label tregu-axis-label--live" style={{ left: `${(1 - LIVE_FRAC / 2) * 100}%`, bottom: 2, transform: "translateX(-50%)" }}>
              tani
            </span>
          )}

          {/* Timestamp pill riding the top of the crosshair — live wall clock. */}
          {hover && (
            <div className="tregu-gchart-time" style={{ left: `${Math.max(8, Math.min(92, hoverXpct))}%` }}>
              {hover.live
                ? `Tani · ${new Date(hover.t).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
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
