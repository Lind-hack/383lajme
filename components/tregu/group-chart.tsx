"use client";

import { useRef, useState } from "react";

// Multi-outcome price charts — the Polymarket-style view for grouped events.
// GroupChart overlays every outcome's tape in its own colour with endpoint
// dot + "Label NN%" chips, plus a hover crosshair that reads every line at
// the pointer; OutcomeMiniChart is the single-outcome graph used for the
// per-outcome breakdown row. SVG carries only geometry
// (preserveAspectRatio="none" stretches text), so all labels are HTML
// positioned over the plot.

export interface GroupSeries {
  label: string;
  color: string;
  /** 0..1 price tape. Missing/short tapes render as a flat line at `prob`. */
  points?: number[];
  prob: number;
}

const PAD = 10; // px breathing room above/below the extreme lines

function tapeOf(s: GroupSeries): number[] {
  return s.points && s.points.length >= 2 ? s.points : [s.prob, s.prob];
}

function domain(series: GroupSeries[]): { lo: number; hi: number } {
  let lo = 1;
  let hi = 0;
  for (const s of series) for (const p of tapeOf(s)) {
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  lo = Math.max(0, lo - 0.06);
  hi = Math.min(1, hi + 0.06);
  if (hi - lo < 0.28) {
    const mid = (hi + lo) / 2;
    lo = Math.max(0, mid - 0.14);
    hi = Math.min(1, lo + 0.28);
  }
  return { lo, hi };
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

// Linear read of a tape at fractional position 0..1.
function valueAt(pts: number[], frac: number): number {
  const pos = frac * (pts.length - 1);
  const i = Math.floor(pos);
  const j = Math.min(pts.length - 1, i + 1);
  return pts[i] + (pts[j] - pts[i]) * (pos - i);
}

export default function GroupChart({
  series,
  height = 200,
}: {
  series: GroupSeries[];
  height?: number;
}) {
  const { lo, hi } = domain(series);
  const yPx = (p: number) => PAD + (height - 2 * PAD) * (1 - (p - lo) / (hi - lo));
  const yPct = (p: number) => ((yPx(p) / height) * 100).toFixed(2);
  const plotRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null); // frac 0..1

  const onMove = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setHover(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  const hoverRows =
    hover === null
      ? []
      : series
          .map((s) => ({ label: s.label, color: s.color, v: valueAt(tapeOf(s), hover) }))
          .sort((a, b) => b.v - a.v);

  const ticks = ticksFor(lo, hi);

  // Endpoint chips: keep 20px apart, favourite label wins its spot first.
  const chips = series
    .map((s) => ({ s, y: yPx(s.prob) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < chips.length; i++) {
    if (chips[i].y - chips[i - 1].y < 20) chips[i].y = chips[i - 1].y + 20;
  }

  return (
    <div className="tregu-gchart" style={{ height }}>
      <div
        className="tregu-gchart-plot"
        ref={plotRef}
        style={{ touchAction: "pan-y" }}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {ticks.map((t) => (
            <line
              key={t}
              x1="0"
              x2="100"
              y1={yPct(t)}
              y2={yPct(t)}
              stroke="rgba(17,17,17,0.07)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {series.map((s) => {
            const pts = tapeOf(s);
            const step = 100 / (pts.length - 1);
            const d = pts
              .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)} ${yPct(p)}`)
              .join(" ");
            return (
              <path
                key={s.label}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {/* Endpoint dots sit on the plot's right edge at each line's live price. */}
        {series.map((s) => (
          <span
            key={s.label}
            className="tregu-gchart-dot"
            style={{ top: yPx(s.prob), background: s.color }}
            aria-hidden
          />
        ))}

        {/* Hover crosshair: vertical line + a dot on every outcome's line. */}
        {hover !== null && (
          <>
            <span className="tregu-gchart-cross" style={{ left: `${hover * 100}%` }} aria-hidden />
            {hoverRows.map((r) => (
              <span
                key={r.label}
                className="tregu-gchart-dot"
                style={{ top: yPx(r.v), left: `${hover * 100}%`, right: "auto", background: r.color }}
                aria-hidden
              />
            ))}
            <div
              className="tregu-chart-tip"
              style={{
                left: `${Math.max(12, Math.min(88, hover * 100))}%`,
                top: 4,
              }}
            >
              {hoverRows.map((r) => (
                <div key={r.label} className="tregu-chart-tip-row">
                  <span className="tregu-chart-tip-dot" style={{ background: r.color }} />
                  {r.label} <strong>{Math.round(r.v * 100)}%</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right gutter: % axis + outcome chips at their line heights. */}
      <div className="tregu-gchart-gutter" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="tregu-gchart-tick" style={{ top: yPx(t) }}>
            {Math.round(t * 100)}%
          </span>
        ))}
      </div>
      {chips.map(({ s, y }) => (
        <span key={s.label} className="tregu-gchart-chip" style={{ top: y }}>
          <span className="tregu-gchart-chip-dot" style={{ background: s.color }} />
          {s.label} {Math.round(s.prob * 100)}%
        </span>
      ))}
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
