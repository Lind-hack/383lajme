"use client";

import Link from "next/link";
import ProbabilityBar from "./probability-bar";

export interface MiniMarket {
  slug: string;
  question: string;
  category: string;
  prob: number; // 0..1 YES probability
  volume?: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  politike: "Politikë",
  ekonomi: "Ekonomi",
  sport: "Sport",
  bote: "Botë",
  "te-tjera": "Të tjera",
};

export default function MarketMiniCard({ market, compact = false }: { market: MiniMarket; compact?: boolean }) {
  return (
    <Link
      href={`/tregu/${market.slug}`}
      className="tregu-glass"
      style={{
        display: "block",
        padding: compact ? "14px" : "18px",
        textDecoration: "none",
        color: "#111111",
        transition: "transform var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span className="tregu-pill">{CATEGORY_LABEL[market.category] ?? market.category}</span>
        {typeof market.volume === "number" && (
          <span style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600 }}>
            {market.volume.toLocaleString("sq-AL")} 383C
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: compact ? 14 : 15,
          fontWeight: 700,
          lineHeight: 1.35,
          margin: "0 0 14px",
          color: "#111111",
        }}
      >
        {market.question}
      </p>
      <ProbabilityBar prob={market.prob} />
    </Link>
  );
}
