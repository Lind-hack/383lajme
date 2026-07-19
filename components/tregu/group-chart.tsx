"use client";

import { useMemo, useRef, useState } from "react";

// Multi-outcome event chart — the Polymarket-style view for grouped events.
// Time-aware: every outcome's line is drawn from real timestamped points
// (5-minute cron snapshots + live price), values are normalized per timestamp
// so displayed odds always sum to 100%, and hovering snaps to the nearest
// recorded point with a date/time tooltip reading every line.
// SVG carries only geometry (preserveAspectRatio="none" stretches text), so
// all labels are HTML positioned over the plot.

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

function seriesOf(s: EventSeries): { t: number; p: number }[] {
  if (s.series && s.series.length >= 2) return s.series;
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
  height = 280,
}: {
  series: EventSeries[];
  height?: number;
}) {
  const [range, setRange] = useState<RangeKey>("Gjithë");
  const [hoverI, setHoverI] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

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

  const xFor = (t: number) => ((t - tMin) / (tMax - tMin)) * W;
  const yFor = (p: number) => PLOT_TOP + (PLOT_BOTTOM - PLOT_TOP) * (1 - (p - lo) / (hi - lo));
  // HTML overlays position in % of the rendered box, not SVG units.
  const xPct = (t: number) => ((t - tMin) / (tMax - tMin)) * 100;
  const yPx = yFor;

  if (grid.length < 2) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>
        Ende pa mjaftueshëm të dhëna historike
      </div>
    );
  }

  const onMove = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = tMin + frac * (tMax - tMin);
    // Snap to the nearest recorded point — each 5-min cron snapshot is a stop.
    let best = 0;
    for (let i = 1; i < grid.length; i++) {
      if (Math.abs(grid[i].t - t) < Math.abs(grid[best].t - t)) best = i;
    }
    setHoverI(best);
  };

  const hover = hoverI === null ? null : grid[hoverI];
  const last = grid[grid.length - 1];
  const ticks = ticksFor(lo, hi);

  const spanMs = tMax - tMin;
  const axisTicks = [0.08, 0.36, 0.64, 0.92].map((f) => {
    const d = new Date(tMin + f * spanMs);
    const label =
      spanMs <= 2 * 86_400_000
        ? d.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("sq-AL", { day: "numeric", month: "short" });
    return { f, label };
  });

  // Chips are pushed apart 26px, so only so many fit the plot height. Wide
  // fields (an F1 grid) keep chips for the leaders; trailing lines stay
  // legible through the rows/legend under the chart.
  const maxChips = Math.max(3, Math.floor((PLOT_BOTTOM - PLOT_TOP) / 26));

  // Endpoint chips: live normalized odds at each line's end, pushed apart so
  // labels never overlap.
  const chips = series
    .map((s, i) => ({ s, v: last.values[i], y: yPx(last.values[i]) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, maxChips)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < chips.length; i++) {
    if (chips[i].y - chips[i - 1].y < 26) chips[i].y = chips[i - 1].y + 26;
  }

  // Labels that ride the crosshair: name + odds at the hovered minute, pushed
  // apart vertically so they never overlap.
  const hoverLabels =
    hover === null
      ? []
      : series
          .map((s, i) => ({ s, v: hover.values[i], y: yPx(hover.values[i]) }))
          .sort((a, b) => b.v - a.v)
          .slice(0, maxChips)
          .sort((a, b) => a.y - b.y);
  for (let i = 1; i < hoverLabels.length; i++) {
    if (hoverLabels[i].y - hoverLabels[i - 1].y < 26) hoverLabels[i].y = hoverLabels[i - 1].y + 26;
  }
  const hoverX = hover === null ? 0 : xPct(hover.t);
  // Near the right edge the labels flip to the left of the crosshair.
  const hoverFlip = hoverX > 64;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
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
            {/* On hover the minutes after the crosshair go gray — only the
                played part of the game keeps its colour (Polymarket-style).
                Gray futures render first so coloured pasts sit on top. */}
            {hoverI !== null &&
              hoverI < grid.length - 1 &&
              series.map((s, si) => {
                const d = grid
                  .slice(hoverI)
                  .map((g, i) => `${i === 0 ? "M" : "L"}${xFor(g.t).toFixed(1)} ${yFor(g.values[si]).toFixed(1)}`)
                  .join(" ");
                return (
                  <path
                    key={`f-${s.label}`}
                    d={d}
                    fill="none"
                    stroke="var(--tg-chart-future, rgba(17,17,17,0.16))"
                    strokeWidth="2"
                    strokeLinejoin="miter"
                    strokeMiterlimit={3}
                    strokeLinecap="butt"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            {series.map((s, si) => {
              const upto = hoverI === null ? grid.length : hoverI + 1;
              const d = grid
                .slice(0, upto)
                .map((g, i) => `${i === 0 ? "M" : "L"}${xFor(g.t).toFixed(1)} ${yFor(g.values[si]).toFixed(1)}`)
                .join(" ");
              return (
                <path
                  key={s.label}
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinejoin="miter"
                  strokeMiterlimit={3}
                  strokeLinecap="butt"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {hover && (
              <line
                x1={xFor(hover.t)}
                x2={xFor(hover.t)}
                y1={PLOT_TOP}
                y2={PLOT_BOTTOM}
                stroke="var(--tg-chart-cross, rgba(17,17,17,0.35))"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* Live endpoint dots — pulsing while live, sliding to the crosshair
              point on hover. */}
          {series.map((s, i) => (
            <span
              key={s.label}
              className={hover ? "tregu-gchart-dot" : "tregu-gchart-dot tregu-gchart-dot--live"}
              style={
                hover
                  ? { top: yPx(hover.values[i]), left: `${hoverX}%`, right: "auto", background: s.color }
                  : { top: yPx(last.values[i]), background: s.color }
              }
              aria-hidden
            />
          ))}

          {/* Time axis — HTML so it never stretches with the SVG. */}
          {axisTicks.map((tick) => (
            <span
              key={tick.f}
              className="tregu-axis-label"
              style={{ left: `${tick.f * 100}%`, bottom: 2, transform: "translateX(-50%)" }}
            >
              {tick.label}
            </span>
          ))}

          {/* Timestamp pill riding the top of the crosshair. */}
          {hover && (
            <div className="tregu-gchart-time" style={{ left: `${Math.max(8, Math.min(92, hoverX))}%` }}>
              {new Date(hover.t).toLocaleDateString("sq-AL", { day: "numeric", month: "short" })}{" "}
              {new Date(hover.t).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}

          {/* Name + odds at the hovered minute, next to each line's point. */}
          {hover &&
            hoverLabels.map(({ s, v, y }) => (
              <span
                key={s.label}
                className="tregu-gchart-chip"
                style={{
                  top: y,
                  left: `${hoverX}%`,
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
            <span key={t} className="tregu-gchart-tick" style={{ top: yPx(t) }}>
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
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)} ${y(p).toFixed(2)}`).join(" ");
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
