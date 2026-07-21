"use client";

import { useId, useMemo, useRef, useState } from "react";
import { dramatizeSeries, smoothPath } from "@/lib/tregu-tape";
import { getCategoryColor } from "@/lib/category-colors";
import { useReducedMotion, useDrawReveal, useLiveTail, useLiveClock } from "./chart-hooks";

// Interactive single-market price chart — dependency-free SVG.
// Feeds on the per-trade tape (market_trades) plus AI snapshots. Shares the
// visual language of the multi-outcome GroupChart: the plot auto-fits its
// vertical range so real moves fill the frame (never a flat band pinned to the
// floor), a warm gleam sweeps the price line once a minute, and the live
// endpoint pulses. The SVG carries only geometry — every label, dot and the
// tooltip live in HTML overlays so nothing distorts when the SVG stretches.
//
// The price line is drawn per-category: the market's own theme colour (blue
// for Politikë, green for Ekonomi, gold for Botë, red for Siguri…) carries the
// stroke, area and endpoint, resolved from category-colors. The AI estimate
// keeps its distinct burnt-orange dashed line; news markers keep brand orange.
//
// The rightmost ~16% is a live band: a per-second eased tail flows there toward
// the next real refresh (2 min live sports · 5 min general), so the chart
// visibly breathes every second on any time range. A countdown pill shows the
// real clock and time to the next repricing.

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
// Fraction of the plot width reserved for the live flow band at the right edge.
const LIVE_FRAC = 0.16;

// AI estimate rides a glossy burnt-orange; the news marker takes the brand
// orange — both distinct shapes (dashed line vs diamond) and hues that stay
// legible against every category accent.
const AI = "#EA580C";
const AI_GLEAM = "#FFD8B0";
const EVENT = "#FF4422";

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
  const [range, setRange] = useState<RangeKey>("Gjithë");
  const [hover, setHover] = useState<{ frac: number; t: number; p: number; ai: number | null; live: boolean } | null>(null);
  // News marker popup: `pinned` set by click/tap (mobile-friendly), `hovered`
  // by mouse enter (desktop). Either one open shows the article that moved it.
  const [pinnedNews, setPinnedNews] = useState<number | null>(null);
  const [hoveredNews, setHoveredNews] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Hover-intent bridge: leaving a marker schedules a close, but entering the
  // popup cancels it, so the popup stays open while the cursor is over it.
  const closeRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
      .map((s) => ({ t: +new Date(s.created_at), p: s.market_prob, evidence: s.evidence as NewsEvidence[] }))
      .filter((e) => e.t >= tMin && e.t <= tMax);

    // Fit the plot to the MARKET line only: a market living at 30–50% should
    // fill the frame and read as real swings, not a flat line pinned to the
    // floor. The AI estimate is deliberately excluded — when it craters toward
    // 0% it must not drag `lo` to the floor and squash the real movement into a
    // thin band. Small padding, 12pt floor so a dead-flat market gets a band.
    let plo = 1;
    let phi = 0;
    for (const p of pts) {
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

  // Per-second eased live tail. Rendered in the right-edge live band so the
  // per-second flow is visible on any time range; drifts back to currentProb.
  const liveTail = useLiveTail(currentProb, !reduced);
  const liveActive = !reduced && liveTail.length > 1;
  const REAL_W = W * (1 - (liveActive ? LIVE_FRAC : 0));

  // Real data maps into the left [0, REAL_W]; the live tail owns [REAL_W, W].
  const xForReal = (t: number) => {
    const denom = tMax - tMin || 1;
    const f = Math.max(0, Math.min(1, (t - tMin) / denom));
    return f * REAL_W;
  };
  const yFor = (p: number) => PLOT_TOP + (PLOT_BOTTOM - PLOT_TOP) * (1 - (p - lo) / (hi - lo));

  if (pts.length < 2) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>
        Ende pa mjaftueshëm të dhëna historike
      </div>
    );
  }

  // Screen-space points. Real series first, then the live tail spread across
  // the band by index (skip index 0 — the real end already sits at REAL_W).
  const realXY = pts.map((p) => ({ x: xForReal(p.t), y: yFor(p.p) }));
  const tailXY = liveActive
    ? liveTail.slice(1).map((pt, idx) => ({
        x: REAL_W + ((idx + 1) / (liveTail.length - 1)) * (W - REAL_W),
        y: yFor(pt.p),
      }))
    : [];
  const lineXY = [...realXY, ...tailXY];

  // Smooth Catmull-Rom curve — rounded oval peaks/dips, never sharp corners.
  const linePath = smoothPath(lineXY);
  const first = lineXY[0];
  const lastXY = lineXY[lineXY.length - 1];
  const areaPath = `${linePath} L ${lastXY.x.toFixed(1)} ${PLOT_BOTTOM} L ${first.x.toFixed(1)} ${PLOT_BOTTOM} Z`;

  // AI estimate: smooth gradual line, held flat across the live band to the
  // right edge (never craters just because the sampling ended).
  const aiXY = aiPts.map((p) => ({ x: xForReal(p.t), y: yFor(p.p) }));
  if (aiXY.length > 0) aiXY.push({ x: W, y: aiXY[aiXY.length - 1].y });
  const aiPath = aiXY.length > 1 ? smoothPath(aiXY) : "";

  const maxVol = Math.max(...volBuckets, 1);
  const bucketW = REAL_W / volBuckets.length;

  const lastP = liveActive ? liveTail[liveTail.length - 1].p : pts[pts.length - 1].p;
  const ticks = ticksFor(lo, hi);
  const activeNews = pinnedNews ?? hoveredNews;
  const lastAi = aiPts.length > 0 ? aiPts[aiPts.length - 1].p : null;

  // Unified hover points (real + live) for nearest-by-x snapping. Real points
  // carry their true timestamp; live points read as "Tani" (now).
  const hoverPts: { x: number; p: number; t: number; live: boolean }[] = [
    ...pts.map((p, i) => ({ x: realXY[i].x, p: p.p, t: p.t, live: false })),
    ...(liveActive ? tailXY.map((xy, idx) => ({ x: xy.x, p: liveTail[idx + 1].p, t: clockNow, live: true })) : []),
  ];

  const onMove = (clientX: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const xpx = Math.max(0, Math.min(W, ((clientX - rect.left) / rect.width) * W));
    let nearest = hoverPts[0];
    for (const hp of hoverPts) if (Math.abs(hp.x - xpx) < Math.abs(nearest.x - xpx)) nearest = hp;
    const ai = nearest.live ? lastAi : [...aiPts].reverse().find((a) => a.t <= nearest.t)?.p ?? null;
    setHover({ frac: nearest.x / W, t: nearest.t, p: nearest.p, ai, live: nearest.live });
  };

  const realFrac = 1 - (liveActive ? LIVE_FRAC : 0);
  const spanMs = tMax - tMin;
  const axisTicks = [0.08, 0.42, 0.78].map((f) => {
    const t = tMin + f * spanMs;
    const d = new Date(t);
    const label =
      spanMs <= 2 * 86_400_000
        ? d.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("sq-AL", { day: "numeric", month: "short" });
    return { f: f * realFrac, label };
  });

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
          ref={boxRef}
          style={{ touchAction: "pan-y" }}
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onClick={() => setPinnedNews(null)}
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

            {/* Live band separator — a faint line marking where real history
                ends and the per-second flow begins. */}
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
                  {!hover && (
                    <g mask={`url(#${shineMaskId})`}>
                      <path d={aiPath} fill="none" stroke={AI} strokeWidth="6" strokeDasharray="5 4" strokeLinecap="round" opacity="0.5" filter={`url(#${shineGlowId})`} />
                      <path d={aiPath} fill="none" stroke={AI_GLEAM} strokeWidth="2.4" strokeDasharray="5 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </g>
                  )}
                </>
              )}

              {/* Price line + travelling gleam (gleam suppressed on hover so it
                  never lights up while the crosshair is reading the past). */}
              <path d={linePath} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {!hover && (
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

          {/* Live endpoint dot — pulses while live, slides to the crosshair
              point on hover. Held back until the reveal wipe reaches the edge.
              HTML so it stays a true circle over the stretched SVG. */}
          {(drawn || hover) && (
            <span
              className={hover ? "tregu-gchart-dot" : "tregu-gchart-dot tregu-gchart-dot--live"}
              style={hover ? { top: yFor(hover.p), left: `${hover.frac * 100}%`, right: "auto", background: accent } : { top: yFor(lastP), background: accent }}
              aria-hidden
            />
          )}

          {/* News markers — orange diamonds on the price line where a "lajm i
              ri" moved the market. Hover (desktop) or tap (mobile) opens the
              article. Held back until the reveal wipe has passed them. */}
          {drawn &&
            events.map((e, i) => (
              <button
                key={i}
                type="button"
                className="tregu-newsmark"
                data-open={activeNews === i}
                style={{ left: `${(xForReal(e.t) / W) * 100}%`, top: yFor(e.p), background: EVENT }}
                aria-label={`Lajmi që lëvizi tregun: ${e.evidence[0]?.title ?? ""}`}
                onPointerEnter={(ev) => {
                  if (ev.pointerType === "mouse") {
                    cancelClose();
                    setHoveredNews(i);
                  }
                }}
                onPointerLeave={(ev) => {
                  if (ev.pointerType === "mouse") scheduleClose();
                }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setPinnedNews((cur) => (cur === i ? null : i));
                }}
              />
            ))}

          {/* News popup — the article(s) behind the active marker. Hovering the
              popup itself cancels the pending close, so it stays put. */}
          {drawn && activeNews !== null && events[activeNews] && (
            <div
              className="tregu-newspop"
              style={{
                left: `${Math.max(4, Math.min(96, (xForReal(events[activeNews].t) / W) * 100))}%`,
                top: Math.max(4, yFor(events[activeNews].p) - 16),
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
              {events[activeNews].evidence.slice(0, 2).map((ev, j) => (
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
          {liveActive && (
            <span className="tregu-axis-label tregu-axis-label--live" style={{ left: `${(1 - LIVE_FRAC / 2) * 100}%`, bottom: 2, transform: "translateX(-50%)" }}>
              tani
            </span>
          )}

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
