"use client";

// Interactive tone-index chart for /toni. Hand-rolled SVG (the codebase has
// no chart dependency) — one thick line for the overall Kosovo Sentiment
// Index, toggleable per-country overlays, hover crosshair, and click-to-pin
// a day to see the headlines that actually moved it that day.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ToneHistoryRow } from "@/lib/tone-data";

const COUNTRY_COLOR: Record<string, string> = {
  Gjermani: "#F59E0B",
  SHBA: "#3B82F6",
  Britani: "#8B5CF6",
  Francë: "#EC4899",
  Itali: "#10B981",
};

const OVERALL_COLOR = "#FF4422";
const SENTIMENT_META: Record<string, { label: string; color: string }> = {
  positive: { label: "Pozitiv", color: "#16A34A" },
  neutral: { label: "Neutral", color: "#9CA3AF" },
  negative: { label: "Kritik", color: "#E41E20" },
};

const PAD = { top: 16, right: 16, bottom: 32, left: 40 };

export default function ToneLineChart({ history }: { history: ToneHistoryRow[] }) {
  const [activeCountries, setActiveCountries] = useState<Set<string>>(new Set());
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

  function xFor(i: number) {
    return n <= 1 ? PAD.left + innerW / 2 : PAD.left + (i / (n - 1)) * innerW;
  }
  function yFor(v: number) {
    return PAD.top + innerH - (v / 100) * innerH;
  }

  const overallPath = useMemo(
    () => rows.map((r, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(r.overallIndex as number).toFixed(1)}`).join(" "),
    [rows] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const countryPaths = useMemo(() => {
    const out: Record<string, string> = {};
    for (const country of countryNames) {
      const pts = rows
        .map((r, i) => ({ i, v: r.countries?.[country]?.index }))
        .filter((p): p is { i: number; v: number } => p.v != null);
      if (pts.length < 2) continue;
      out[country] = pts.map((p, k) => `${k === 0 ? "M" : "L"}${xFor(p.i).toFixed(1)},${yFor(p.v).toFixed(1)}`).join(" ");
    }
    return out;
  }, [rows, countryNames]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCountry(country: string) {
    setActiveCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || n === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = Math.max(0, Math.min(1, (relX - PAD.left) / innerW));
    const idx = Math.round(ratio * (n - 1));
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
  }

  const displayIdx = pinnedIdx ?? hoverIdx;
  const displayRow = displayIdx != null ? rows[displayIdx] : null;
  const gridSteps = [0, 25, 50, 75, 100];

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
          const active = activeCountries.has(country);
          const color = COUNTRY_COLOR[country] ?? "#6B6B6B";
          return (
            <button
              key={country}
              onClick={() => toggleCountry(country)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "100px",
                border: `1.5px solid ${active ? color : "#E8E3DB"}`,
                background: active ? `${color}14` : "transparent",
                fontSize: "12px",
                fontWeight: 700,
                color: active ? color : "#9CA3AF",
                cursor: "pointer",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: active ? color : "#D8D3C8" }} />
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

          {/* Country overlay lines */}
          {[...activeCountries].map((country) =>
            countryPaths[country] ? (
              <path key={country} d={countryPaths[country]} fill="none" stroke={COUNTRY_COLOR[country] ?? "#6B6B6B"} strokeWidth={1.75} opacity={0.85} />
            ) : null
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

      {/* Detail panel — hover shows preview, click pins it so it stays put */}
      {displayRow && (
        <div style={{ marginTop: "18px", padding: "16px", background: "#FAFAF8", border: "1px solid #E8E3DB", borderRadius: "12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#111111" }}>
              {displayRow.date} — Indeksi: {displayRow.overallIndex}
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
