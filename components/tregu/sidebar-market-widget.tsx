"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The market tied to what the reader is reading.
 *
 * It used to be a label, a question and a bare progress bar: it stated a
 * probability without ever showing that the number moves, which is the only
 * interesting thing about a market. Now it leads with the price, the distance
 * it has travelled since the book opened, and the shape of that journey.
 *
 * The line is drawn from `spark`, the downsampled series the markets endpoint
 * already computes from real trades and five-minute snapshots. Nothing here is
 * synthesised: a market with too little history to plot renders the number and
 * no line rather than an invented curve.
 */

interface MarketRow {
  slug: string;
  question: string;
  market_prob: number;
  spark?: number[];
  closes_at?: string | null;
}

const ARTICLE_CATEGORY_TO_MARKET: Record<string, string> = {
  "Politikë": "politike",
  "Siguri": "politike",
  "Shoqëri": "politike",
  "Ekonomi": "ekonomi",
  "Sport": "sport",
  "Botë": "bote",
  "Diaspora": "bote",
};

const W = 232;
const H = 46;

/** Polyline through the series, normalised to its own range so flat books still read as flat. */
function sparkPath(points: number[]): string | null {
  const clean = points.filter((n) => Number.isFinite(n));
  if (clean.length < 3) return null;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const pad = 5;
  return clean
    .map((p, i) => {
      const x = (i / (clean.length - 1)) * W;
      const y = H - pad - ((p - min) / span) * (H - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function daysLeft(closesAt?: string | null): number | null {
  if (!closesAt) return null;
  const ms = Date.parse(closesAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}

export default function SidebarMarketWidget({ articleCategory }: { articleCategory: string }) {
  const [market, setMarket] = useState<MarketRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const marketCategory = ARTICLE_CATEGORY_TO_MARKET[articleCategory];
    const qs = marketCategory ? `?category=${marketCategory}` : "";
    fetch(`/api/tregu/markets${qs}`)
      .then((r) => r.json())
      .then((d) => setMarket((d.markets ?? [])[0] ?? null))
      .catch(() => setMarket(null))
      .finally(() => setLoading(false));
  }, [articleCategory]);

  if (loading || !market) return null;

  const prob = Math.max(0, Math.min(1, Number(market.market_prob) || 0));
  const pct = Math.round(prob * 100);
  const series = Array.isArray(market.spark) ? market.spark.filter((n) => Number.isFinite(n)) : [];
  const path = sparkPath(series);
  const openedAt = series.length ? series[0] : null;
  const move = openedAt === null ? null : Math.round((prob - openedAt) * 100);
  const up = (move ?? 0) >= 0;
  const days = daysLeft(market.closes_at);

  const accent = up ? "#0E9F6E" : "#E4322B";

  return (
    <div className="tregu-scope">
      <Link
        href={`/tregu/${market.slug}`}
        style={{
          display: "block",
          padding: "16px 18px 14px",
          textDecoration: "none",
          color: "#111111",
          background: "#FFFFFF",
          border: "1px solid #E8E3DB",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FF4422" }} />
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#111111",
            }}
          >
            383 Tregu
          </span>
          {days !== null && (
            <span style={{ marginLeft: "auto", fontSize: "10.5px", fontWeight: 700, color: "#9A9A9A" }}>
              {days} ditë
            </span>
          )}
        </div>

        <p style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.35, margin: "0 0 12px", color: "#111111" }}>
          {market.question}
        </p>

        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: path ? "2px" : "10px" }}>
          <span style={{ fontSize: "34px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: "#111111" }}>
            {pct}%
          </span>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#6B6B6B" }}>PO</span>
          {move !== null && move !== 0 && (
            <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 800, color: accent }}>
              {up ? "▲" : "▼"} {Math.abs(move)} pikë
            </span>
          )}
        </div>

        {path ? (
          <>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              height={H}
              preserveAspectRatio="none"
              aria-hidden="true"
              style={{ display: "block", overflow: "visible" }}
            >
              <path d={path} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ marginTop: "6px", fontSize: "10.5px", fontWeight: 600, color: "#9A9A9A" }}>
              që nga hapja e librit
            </div>
          </>
        ) : (
          <div
            style={{
              height: "6px",
              borderRadius: "100px",
              background: "#F0EBE3",
              overflow: "hidden",
            }}
          >
            <div style={{ width: `${pct}%`, height: "100%", background: "#FF4422" }} />
          </div>
        )}

        <div
          style={{
            marginTop: "12px",
            height: "34px",
            borderRadius: "8px",
            background: "#111111",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          Trego çfarë mendon →
        </div>
      </Link>
    </div>
  );
}
