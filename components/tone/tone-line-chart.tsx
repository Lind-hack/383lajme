"use client";

// Interactive tone-index chart for /toni. Hand-rolled SVG (the codebase has
// no chart dependency) — one thick line for the overall Kosovo Sentiment
// Index, toggleable per-country overlays, hover crosshair, and click-to-pin
// a day to see the headlines that actually moved it that day.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ToneHistoryRow } from "@/lib/tone-data";
import { BAND, TONE_COLOR } from "@/lib/tone-scale";

// One emphasis colour, not a categorical palette. There are fifteen tracked
// countries and a categorical scale tops out around eight distinguishable
// hues — the old five-entry map left the ten newer countries all drawing the
// same grey, which is worse than not drawing them. So the chart shows the
// overall line always and at most one country at a time, in a single colour
// that means "the one you picked".
const FOCUS_COLOR = "#2563EB";
const OVERALL_COLOR = "#FF4422";
const SENTIMENT_META: Record<string, { label: string; color: string }> = {
  positive: { label: "Pozitiv", color: TONE_COLOR.positive },
  neutral: { label: "Neutral", color: TONE_COLOR.neutral },
  negative: { label: "Kritik", color: TONE_COLOR.critical },
};

const PAD = { top: 16, right: 16, bottom: 32, left: 40 };

export default function ToneLineChart({ history }: { history: ToneHistoryRow[] }) {
  const [focus, setFocus] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // The SVG's coordinate system tracks its real rendered width instead of a
  // fixed 960 viewBox scaled by CSS — otherwise every font-size/stroke-width
  // below is defined for desktop and gets optically shrunk on a phone (a
  // 390px-wide card renders a 960-unit viewBox at ~40% scale, so 10px axis
  // labels become ~4px and effectively unreadable).
  const [W, setW] = useState(900);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) setW(Math.round(width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.max(220, Math.min(340, W * 0.34)));

  const rows = useMemo(() => history.filter((r) => r.overallIndex != null), [history]);
  const countryNames = useMemo(() => Object.keys(rows[rows.length - 1]?.countries ?? {}), [rows]);

  const n = rows.length;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // x is proportional to the DATE, not to the row's position in the array.
  // The scraper has gaps — the three days between 08-09 and 08-12 were drawn
  // as one step, which reads as a single day's swing rather than a silence.
  const times = useMemo(() => rows.map((r) => Date.parse(`${r.date}T00:00:00Z`)), [rows]);
  const tMin = times.length ? Math.min(...times) : 0;
  const tSpan = times.length ? Math.max(...times) - tMin : 0;

  function xFor(i: number) {
    if (n <= 1 || tSpan <= 0) return PAD.left + innerW / 2;
    return PAD.left + ((times[i] - tMin) / tSpan) * innerW;
  }

  // The y domain is the data's, not 0–100. Every value this index has ever
  // produced sits between 39 and 55, so a fixed 0–100 axis drew a flat smear
  // across the middle of the card. BAND is the floor on the extent, never a
  // ceiling: the axis can widen past it, but it never compresses tighter and
  // starts exaggerating a two-point wobble into a crash.
  const domain = useMemo(() => {
    const vals: number[] = [];
    for (const r of rows) {
      if (r.overallIndex != null) vals.push(r.overallIndex);
      if (focus) {
        const v = r.countries?.[focus]?.index;
        if (v != null) vals.push(v);
      }
    }
    if (!vals.length) return { lo: BAND.lo, hi: BAND.hi };
    return {
      lo: Math.floor(Math.min(BAND.lo, ...vals) / 5) * 5,
      hi: Math.ceil(Math.max(BAND.hi, ...vals) / 5) * 5,
    };
  }, [rows, focus]);

  function yFor(v: number) {
    const span = domain.hi - domain.lo || 1;
    return PAD.top + innerH - ((v - domain.lo) / span) * innerH;
  }

  const overallPath = useMemo(
    () => rows.map((r, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(r.overallIndex as number).toFixed(1)}`).join(" "),
    [rows] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const focusPath = useMemo(() => {
    if (!focus) return "";
    const pts = rows
      .map((r, i) => ({ i, v: r.countries?.[focus]?.index }))
      .filter((p): p is { i: number; v: number } => p.v != null);
    if (pts.length < 2) return "";
    return pts.map((p, k) => `${k === 0 ? "M" : "L"}${xFor(p.i).toFixed(1)},${yFor(p.v).toFixed(1)}`).join(" ");
  }, [rows, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where the definition changed. Everything left of this line was measured
  // as "was the news good or bad"; everything right of it as "was the outlet
  // hostile". Drawing one continuous line across that without saying so would
  // present a methodology change as a swing in world opinion.
  const breakIdx = useMemo(() => {
    const i = rows.findIndex((r) => (r.stanceVersion ?? 1) >= 2);
    return i > 0 ? i : null;
  }, [rows]);

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || n === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    // Nearest point by x, not by array position — with a date-proportional
    // axis those are no longer the same thing across a gap.
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xFor(i) - relX);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHoverIdx(best);
  }

  const displayIdx = pinnedIdx ?? hoverIdx;
  const displayRow = displayIdx != null ? rows[displayIdx] : null;
  // Five ticks across whatever domain the data asked for, snapped to whole
  // points so the axis never reads 47.3333.
  const gridSteps = useMemo(() => {
    const step = (domain.hi - domain.lo) / 4;
    return [0, 1, 2, 3, 4].map((k) => Math.round(domain.lo + k * step));
  }, [domain]);

  // Sparse x-axis labels — every ~14th point, plus the last one, so dense
  // history doesn't collide into unreadable text.
  const labelEvery = Math.max(1, Math.ceil(n / 7));

  if (n === 0) {
    return (
      <p style={{ fontSize: "13.5px", color: "#6B6B6B" }}>
        Grafiku fillon të mbushet nga dita e parë e mbledhjes së të dhënave.
      </p>
    );
  }

  return (
    <div>
      {/* Country toggles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "100px",
            border: `1.5px solid ${OVERALL_COLOR}`,
            background: "rgba(255,68,34,0.06)",
            fontSize: "12px",
            fontWeight: 700,
            color: OVERALL_COLOR,
          }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: OVERALL_COLOR }} />
          Indeksi i përgjithshëm
        </span>
        {countryNames.map((country) => {
          const active = focus === country;
          return (
            <button
              key={country}
              type="button"
              aria-pressed={active}
              onClick={() => setFocus((p) => (p === country ? null : country))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "100px",
                border: `1.5px solid ${active ? FOCUS_COLOR : "#E8E3DB"}`,
                background: active ? `${FOCUS_COLOR}14` : "transparent",
                fontSize: "12px",
                fontWeight: 700,
                color: active ? FOCUS_COLOR : "#9CA3AF",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: active ? FOCUS_COLOR : "#D8D3C8" }} />
              {country}
            </button>
          );
        })}
      </div>

      {/* Chart — containerRef drives W via ResizeObserver above, so the SVG's
          viewBox matches its real rendered width 1:1 (no CSS-driven scaling). */}
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          data-testid="tone-line-chart"
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          style={{ display: "block", cursor: "crosshair" }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
          onClick={() => setPinnedIdx((p) => (p === hoverIdx ? null : hoverIdx))}
        >
          {/* Gridlines */}
          {gridSteps.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yFor(v)} y2={yFor(v)} stroke="#F0EDE6" strokeWidth={1} />
              <text x={PAD.left - 8} y={yFor(v) + 4} fontSize="10" fill="#B4B0A6" textAnchor="end">
                {v}
              </text>
            </g>
          ))}

          {/* X-axis date labels */}
          {rows.map((r, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={r.date} x={xFor(i)} y={H - 10} fontSize="10" fill="#B4B0A6" textAnchor="middle">
                {r.date.slice(5)}
              </text>
            ) : null
          )}

          {/* The methodology break, marked rather than smoothed over. */}
          {breakIdx != null && (
            <g>
              <line
                x1={xFor(breakIdx)} x2={xFor(breakIdx)} y1={PAD.top} y2={H - PAD.bottom}
                stroke="#D8D3C8" strokeWidth={1} strokeDasharray="2 4"
              />
              <text x={xFor(breakIdx) + 4} y={PAD.top + 10} fontSize="9.5" fill="#B4B0A6">
                metodë e re
              </text>
            </g>
          )}

          {/* The one country in focus, if any. */}
          {focusPath && (
            <path d={focusPath} fill="none" stroke={FOCUS_COLOR} strokeWidth={1.9} opacity={0.9} strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Overall line — always on top, thickest */}
          <path d={overallPath} fill="none" stroke={OVERALL_COLOR} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" />

          {/* Point markers — without these, a single day of history (or any
              day with no neighbor to draw a segment to) renders as an empty
              chart even though the index has a real value. */}
          {rows.map((r, i) =>
            r.overallIndex != null ? (
              <circle key={r.date} cx={xFor(i)} cy={yFor(r.overallIndex)} r={n <= 14 ? 3.5 : 2} fill={OVERALL_COLOR} opacity={n === 1 ? 1 : 0.9} />
            ) : null
          )}

          {/* Hover / pinned marker */}
          {displayIdx != null && rows[displayIdx]?.overallIndex != null && (
            <g>
              <line x1={xFor(displayIdx)} x2={xFor(displayIdx)} y1={PAD.top} y2={H - PAD.bottom} stroke="#D8D3C8" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={xFor(displayIdx)} cy={yFor(rows[displayIdx].overallIndex as number)} r={4.5} fill={OVERALL_COLOR} stroke="#FFFFFF" strokeWidth={1.5} />
            </g>
          )}
        </svg>
      </div>

      {/* A line chart whose axis does not start at zero has to say so. The
          alternative — a fixed 0–100 axis — drew every day of this index as
          the same flat smear through the middle of the card. */}
      <p style={{ margin: "8px 0 0", fontSize: "10.5px", color: "#B4B0A6" }}>
        Boshti vertikal fillon te {gridSteps[0]}, jo te 0 — indeksi lëviz brenda një brezi të
        ngushtë rreth 50 dhe përndryshe do të dukej krejt i sheshtë.
      </p>

      {/* Detail panel — hover shows preview, click pins it so it stays put */}
      {displayRow && (
        <div style={{ marginTop: "18px", padding: "16px", background: "#FAFAF8", border: "1px solid #E8E3DB", borderRadius: "12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#111111" }}>
              {displayRow.date} — Indeksi: {displayRow.overallIndex}
              {focus && displayRow.countries?.[focus]?.index != null && (
                <span style={{ marginLeft: "8px", color: FOCUS_COLOR }}>
                  · {focus}: {displayRow.countries[focus].index}
                </span>
              )}
              <span style={{ marginLeft: "8px", fontWeight: 500, color: "#9CA3AF", fontSize: "12px" }}>
                ({displayRow.totalArticles} artikuj, {displayRow.sourceCount} burime)
              </span>
            </p>
            {pinnedIdx != null && (
              <button
                onClick={() => setPinnedIdx(null)}
                style={{ fontSize: "11px", fontWeight: 600, color: "#6B6B6B", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                lësho ✕
              </button>
            )}
          </div>
          {displayRow.headlines.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {displayRow.headlines.map((h) => {
                const meta = SENTIMENT_META[h.sentiment];
                return (
                  <a
                    key={h.url}
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", padding: "6px 8px", borderRadius: "8px", background: "#FFFFFF", border: "1px solid #F0EDE6" }}
                  >
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", flexShrink: 0 }}>
                      {h.flag} {h.source}
                    </span>
                    <span style={{ fontSize: "12px", color: "#111111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.title}
                    </span>
                  </a>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>S&apos;ka artikuj të veçantë të ruajtur për këtë ditë.</p>
          )}
          <p style={{ margin: "10px 0 0", fontSize: "10.5px", color: "#B4B0A6" }}>
            Kliko një pikë në grafik për ta fiksuar; kalo me miun për parapamje.
          </p>
        </div>
      )}
    </div>
  );
}
