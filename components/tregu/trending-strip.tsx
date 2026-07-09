"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MarketMiniCard, { type MiniMarket } from "./market-mini-card";

interface MarketRow {
  slug: string;
  question: string;
  category: string;
  market_prob: number;
}

export default function TrendingStrip() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);

  useEffect(() => {
    fetch("/api/tregu/markets")
      .then((r) => r.json())
      .then((d) => setMarkets((d.markets ?? []).slice(0, 4)))
      .catch(() => {});
  }, []);

  if (markets.length === 0) return null;

  const minis: MiniMarket[] = markets.map((m) => ({
    slug: m.slug,
    question: m.question,
    category: m.category,
    prob: m.market_prob,
  }));

  return (
    <div
      className="tregu-scope"
      style={{
        borderRadius: "var(--radius-lg)",
        padding: "28px 24px",
        marginBottom: "var(--space-section)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B6B6B", margin: "0 0 4px" }}>
            383 Tregu
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#111111" }}>Çka mendon Kosova do të ndodhë?</h2>
        </div>
        <Link href="/tregu" style={{ fontSize: 13, fontWeight: 700, color: "#00A651", textDecoration: "none", whiteSpace: "nowrap" }}>
          Shiko të gjitha →
        </Link>
      </div>
      <div
        className="tregu-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {minis.map((m) => (
          <MarketMiniCard key={m.slug} market={m} compact />
        ))}
      </div>
    </div>
  );
}
