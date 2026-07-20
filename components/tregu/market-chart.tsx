"use client";

import { useId, useMemo, useRef, useState } from "react";
import { dramatizeSeries } from "@/lib/tregu-tape";

// Interactive single-market price chart — dependency-free SVG.
// Feeds on the per-trade tape (market_trades) plus AI snapshots. Shares the
// visual language of the multi-outcome GroupChart: the plot auto-fits its
// vertical range so real moves fill the frame (never a flat band pinned to the
// floor), a warm gleam sweeps the price line once a minute, and the live
// endpoint pulses. The SVG carries only geometry — every label, dot and the
// tooltip live in HTML overlays so nothing distorts when the SVG stretches.
//
// Chart-grade strokes (validated ≥3:1 on cream #F9F6F1): market #00854A,
// AI #B45309, event diamonds #F59E0B. Brand greens/reds stay on buttons.

export interface TradePoint {
  created_at: string;
  coins: number;
  price_yes: number;
}

export interface SnapshotPoint {
  created_at: string;
  ai_prob: number | null;
  market_prob: number;
  evidence?: { title: string; slug: string }[] | null;
}

const RANGES = [
  { key: "1D", ms: 86_400_000 },
  { key: "1J", ms: 7 * 86_400_000 },
  { key: "1M", ms: 30 * 86_400_000 },
  { key: "Gjithë", ms: Infinity },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const W = 640;
const AXIS_H = 24;
const PLOT_TOP = 12;
const VOL_H = 34;
// Width of the gleam that travels along the line once a minute — kept in sync
// with the `tg-line-shine` keyframe in globals.css (travel = W + SHINE_W).
const SHINE_W = 180;

const MARKET = "#00854A";
// AI estimate now rides a glossy burnt-orange; the news marker takes the
// brand orange — both on-brand, distinct shapes (dashed line vs diamond).
const AI = "#EA580C";
const AI_GLEAM = "#FFD8B0";
const EVENT = "#FF4422";

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

export default function MarketChart({
  trades,
  snapshots,
  currentProb,
  seedKey = "tregu",
  height = 460,
}: {
  trades: TradePoint[];
  snapshots: SnapshotPoint[];
  currentProb: number;
  seedKey?: string;
  height?: number;
}) {
  const [range, setRange] = useState<RangeKey>("Gjithë");
  const [hover, setHover] = useState<{ frac: number; t: number; p: number; ai: number | null } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Defs are document-scoped; a hardcoded id would collide with another chart
  // on the page. React ids carry punctuation url(#…) can't resolve — strip it.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const areaId = `tg-area-${uid}`;
  const shineMaskId = `tg-mshine-mask-${uid}`;
  const shineBandId = `tg-mshine-band-${uid}`;
  const shineGlowId = `tg-mshine-glow-${uid}`;

  const H = height;
  const PLOT_BOTTOM = H - AXIS_H;

  const { pts, aiPts, events, volBuckets, tMin, tMax, lo, hi } = useMemo(() => {
    const now = Date.now();
    const all = [
      ...snapshots.map((s) => ({ t: +new Date(s.created_at), p: s.market_prob })),
      ...trades.map((tr) => ({ t: +new Date(tr.created_at), p: tr.price_yes })),
    ]
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.p))
      .sort((a, b) => a.t - b.t);
    all.push({ t: now, p: currentProb });

    const span = RANGES.find((r) => r.key === range)!.ms;
    const cutoff = span === Infinity ? -Infinity : now - span;
    let pts = all.filter((p) => p.t >= cutoff);
    // Anchor the left edge with the last pre-window point so the line enters
    // the frame at its true level instead of appearing mid-air.
    const anchor = [...all].reverse().find((p) => p.t < cutoff);
    if (anchor) pts = [{ t: Math.max(anchor.t, cutoff === -Infinity ? anchor.t : cutoff), p: anchor.p }, ...pts];
    // Dramatize: jagged in-between texture; every real point stays exact.
    pts = dramatizeSeries(pts, seedKey);

    const tMin = pts.length > 0 ? pts[0].t : now - 86_400_000;
    const tMaxRaw = pts.length > 0 ? pts[pts.length - 1].t : now;
    const tMax = tMaxRaw > tMin ? tMaxRaw : tMin + 1;

    const aiAll = snapshots
      .filter((s) => s.ai_prob !== null)
      .map((s) => ({ t: +new Date(s.created_at), p: s.ai_prob as number }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
    const aiPts = aiAll.filter((p) => p.t >= tMin && p.t <= tMax);
    const aiAnchor = [...aiAll].reverse().find((p) => p.t < tMin);
    if (aiAnchor) aiPts.unshift({ t: tMin, p: aiAnchor.p });

    const events = snapshots
      .filter((s) => s.evidence && s.evidence.length > 0)
      .map((s) => ({ t: +new Date(s.created_at), p: s.market_prob }))
      .filter((e) => e.t >= tMin && e.t <= tMax);

    // Fit the plot to the data (market + AI): a market living at 30–50% should
    // fill the frame and read as real swings, not a flat line pinned to the
    // floor of a 0–100% axis. Small padding, with a 12pt floor so a dead-flat
    // market still gets a sane band instead of a zero-height sliver.
    let plo = 1;
    let phi = 0;
    for (const p of pts) {
      if (p.p < plo) plo = p.p;
      if (p.p > phi) phi = p.p;
    }
    for (const p of aiPts) {
      if (p.p < plo) plo = p.p;
      if (p.p > phi) phi = p.p;
    }
    let lo = Math.max(0, plo - 0.03);
    let hi = Math.min(1, phi + 0.03);
    if (hi - lo < 0.12) {
      const mid = (hi + lo) / 2;
      lo = Math.max(0, mid - 0.06);
      hi = Math.min(1, lo + 0.12);
    }

    const N_BUCKETS = 36;
    const volBuckets = new Array<number>(N_BUCKETS).fill(0);
    for (const tr of trades) {
      const t = +new Date(tr.created_at);
      if (t < tMin || t > tMax) continue;
      const i = Math.min(N_BUCKETS - 1, Math.floor(((t - tMin) / (tMax - tMin)) * N_BUCKETS));
      volBuckets[i] += Math.abs(tr.coins);
    }

    return { pts, aiPts, events, volBuckets, tMin, tMax, lo, hi };
  }, [trades, snapshots, currentProb, range, seedKey]);

  const xFor = (t: number) => ((t - tMin) / (tMax - tMin)) * W;
  const yFor = (p: number) => PLOT_TOP + (PLOT_BOTTOM - PLOT_TOP) * (1 - (p - lo) / (hi - lo));

  if (pts.length < 2) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>
        Ende pa mjaftueshëm të dhëna historike
      </div>
    );
  }

  const linePath = pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${xFor(pt.t).toFixed(1)} ${yFor(pt.p).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${W} ${PLOT_BOTTOM} L ${xFor(pts[0].t).toFixed(1)} ${PLOT_BOTTOM} Z`;

  // AI estimate as a step line — the estimate holds until re-scored.
  let aiPath = "";
  aiPts.forEach((pt, i) => {
    const x = xFor(pt.t).toFixed(1);
    const y = yFor(pt.p).toFixed(1);
    aiPath += i === 0 ? `M ${x} ${y}` : ` H ${x} V ${y}`;
  });
  if (aiPts.length > 0) aiPath += ` H ${W}`;

  const maxVol = Math.max(...volBuckets, 1);
  const bucketW = W / volBuckets.length;

  const last = pts[pts.length - 1];
  const ticks = ticksFor(lo, hi);

  const onMove = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = tMin + frac * (tMax - tMin);
    let nearest = pts[0];
    for (const p of pts) if (Math.abs(p.t - t) < Math.abs(nearest.t - t)) nearest = p;
    const aiAt = [...aiPts].reverse().find((a) => a.t <= nearest.t);
    setHover({ frac: (nearest.t - tMin) / (tMax - tMin), t: nearest.t, p: nearest.p, ai: aiAt?.p ?? null });
  };

  const spanMs = tMax - tMin;
  const axisTicks = [0.08, 0.36, 0.64, 0.92].map((f) => {
    const t = tMin + f * spanMs;
    const d = new Date(t);
    const label =
      spanMs <= 2 * 86_400_000
        ? d.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("sq-AL", { day: "numeric", month: "short" });
    return { f, label };
  });

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
          ref={boxRef}
          style={{ touchAction: "pan-y" }}
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MARKET} stopOpacity="0.20" />
                <stop offset="100%" stopColor={MARKET} stopOpacity="0" />
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

            <path className="tregu-area-fade" d={areaPath} fill={`url(#${areaId})`} />

            {/* AI estimate: dashed step line in burnt orange, wrapped in the
                same travelling gleam so it reads glossy and shiny on refresh. */}
            {aiPath && (
              <>
                <path d={aiPath} fill="none" stroke={AI} strokeWidth="2" strokeDasharray="5 4" opacity="0.95" vectorEffect="non-scaling-stroke" />
                {!hover && (
                  <g mask={`url(#${shineMaskId})`}>
                    <path d={aiPath} fill="none" stroke={AI} strokeWidth="6" strokeDasharray="5 4" strokeLinecap="round" opacity="0.5" filter={`url(#${shineGlowId})`} />
                    <path d={aiPath} fill="none" stroke={AI_GLEAM} strokeWidth="2.4" strokeDasharray="5 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </g>
                )}
              </>
            )}

            {/* Price line: draws itself left-to-right on open (pathLength=1
                normalizes the dash under preserveAspectRatio=none), then the
                travelling gleam sweeps it (suppressed on hover so it never
                lights up while the crosshair is reading the past). */}
            <path className="tregu-line-draw" d={linePath} pathLength={1} fill="none" stroke={MARKET} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {!hover && (
              <g mask={`url(#${shineMaskId})`}>
                <path d={linePath} fill="none" stroke={MARKET} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" filter={`url(#${shineGlowId})`} />
                <path d={linePath} fill="none" stroke="#FFC9A8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {events.map((e, i) => {
              const x = xFor(e.t);
              const y = yFor(e.p);
              return <path key={i} d={`M ${x} ${y - 5.5} L ${x + 5.5} ${y} L ${x} ${y + 5.5} L ${x - 5.5} ${y} Z`} fill={EVENT} stroke="rgba(17,17,17,0.45)" strokeWidth="1" vectorEffect="non-scaling-stroke" />;
            })}

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

          {/* Live endpoint dot — pulses while live, slides to the crosshair
              point on hover. HTML so it stays a true circle over the stretched
              SVG. */}
          <span
            className={hover ? "tregu-gchart-dot" : "tregu-gchart-dot tregu-gchart-dot--live"}
            style={hover ? { top: yFor(hover.p), left: `${hover.frac * 100}%`, right: "auto", background: MARKET } : { top: yFor(last.p), background: MARKET }}
            aria-hidden
          />

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
                {new Date(hover.t).toLocaleDateString("sq-AL", { day: "numeric", month: "short" })}{" "}
                {new Date(hover.t).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="tregu-chart-tip-row">
                <span className="tregu-chart-tip-dot" style={{ background: MARKET }} />
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
          <span style={{ width: 12, height: 2.5, background: MARKET, display: "inline-block", borderRadius: 2 }} /> Çmimi i tregut
        </span>
        {aiPts.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 0, borderTop: `2.5px dashed ${AI}`, display: "inline-block" }} /> Vlerësimi AI
          </span>
        )}
        {events.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, background: EVENT, display: "inline-block", transform: "rotate(45deg)", border: "1px solid rgba(17,17,17,0.45)" }} /> Lajm i ri
          </span>
        )}
      </div>
    </div>
  );
}
