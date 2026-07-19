"use client";

import { useMemo, useRef, useState } from "react";
import { dramatizeSeries } from "@/lib/tregu-tape";

// Interactive market price chart — dependency-free SVG.
// Feeds on the per-trade tape (market_trades) plus AI snapshots; the SVG
// carries only geometry while all text (axis labels, tooltip) lives in HTML
// overlays so nothing distorts when the SVG stretches to the container.
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
const H = 280;
const AXIS_H = 24;
const PLOT_TOP = 12;
const PLOT_BOTTOM = H - AXIS_H;
const VOL_H = 34;

const MARKET = "#00854A";
const AI = "#B45309";
const EVENT = "#F59E0B";

export default function MarketChart({
  trades,
  snapshots,
  currentProb,
  seedKey = "tregu",
}: {
  trades: TradePoint[];
  snapshots: SnapshotPoint[];
  currentProb: number;
  seedKey?: string;
}) {
  const [range, setRange] = useState<RangeKey>("Gjithë");
  const [hover, setHover] = useState<{ frac: number; t: number; p: number; ai: number | null } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const { pts, aiPts, events, volBuckets, tMin, tMax } = useMemo(() => {
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
    // Anchor the left edge with the last pre-window point so the line
    // enters the frame at its true level instead of appearing mid-air.
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

    const N_BUCKETS = 36;
    const volBuckets = new Array<number>(N_BUCKETS).fill(0);
    for (const tr of trades) {
      const t = +new Date(tr.created_at);
      if (t < tMin || t > tMax) continue;
      const i = Math.min(N_BUCKETS - 1, Math.floor(((t - tMin) / (tMax - tMin)) * N_BUCKETS));
      volBuckets[i] += Math.abs(tr.coins);
    }

    return { pts, aiPts, events, volBuckets, tMin, tMax };
  }, [trades, snapshots, currentProb, range, seedKey]);

  const xFor = (t: number) => ((t - tMin) / (tMax - tMin)) * W;
  const yFor = (p: number) => PLOT_TOP + (1 - p) * (PLOT_BOTTOM - PLOT_TOP);

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

      <div
        ref={boxRef}
        style={{ position: "relative", touchAction: "pan-y" }}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
          <defs>
            <linearGradient id="tg-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MARKET} stopOpacity="0.18" />
              <stop offset="100%" stopColor={MARKET} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="0" y1={yFor(g)} x2={W} y2={yFor(g)} stroke="rgba(17,17,17,0.07)" strokeDasharray={g === 0.5 ? "4 4" : undefined} />
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

          <path d={areaPath} fill="url(#tg-area)" />
          {aiPath && <path d={aiPath} fill="none" stroke={AI} strokeWidth="2" strokeDasharray="5 4" opacity="0.9" />}
          <path d={linePath} fill="none" stroke={MARKET} strokeWidth="2.5" strokeLinejoin="round" />

          {events.map((e, i) => {
            const x = xFor(e.t);
            const y = yFor(e.p);
            return <path key={i} d={`M ${x} ${y - 5.5} L ${x + 5.5} ${y} L ${x} ${y + 5.5} L ${x - 5.5} ${y} Z`} fill={EVENT} stroke="rgba(17,17,17,0.45)" strokeWidth="1" />;
          })}

          {hover ? (
            <>
              <line x1={hover.frac * W} y1={PLOT_TOP} x2={hover.frac * W} y2={PLOT_BOTTOM} stroke="rgba(17,17,17,0.28)" strokeDasharray="3 3" />
              <circle cx={hover.frac * W} cy={yFor(hover.p)} r="4.5" fill={MARKET} stroke="#FFFFFF" strokeWidth="2" />
            </>
          ) : (
            <circle cx={xFor(last.t)} cy={yFor(last.p)} r="4.5" fill={MARKET} stroke="#FFFFFF" strokeWidth="2" />
          )}
        </svg>

        {/* Y grid labels — HTML so they never stretch with the SVG. */}
        {[0.25, 0.5, 0.75].map((g) => (
          <span key={g} className="tregu-axis-label" style={{ right: 4, top: yFor(g) - 15 }}>
            {Math.round(g * 100)}%
          </span>
        ))}
        {/* Time axis. */}
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
