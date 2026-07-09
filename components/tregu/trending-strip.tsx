"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SectionLabel from "@/components/section-label";
import MarketMiniCard, { type MiniMarket } from "./market-mini-card";

interface MarketRow {
  slug: string;
  question: string;
  category: string;
  market_prob: number;
  closes_at: string;
  q_yes: number;
  q_no: number;
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
    volume: (m.q_yes ?? 0) + (m.q_no ?? 0),
    closesAt: m.closes_at,
  }));

  return (
    <div className="tregu-scope" style={{ background: "none", minHeight: 0, marginBottom: "var(--space-section)" }}>
      <SectionLabel
        label="Tregu — Parashiko"
        right={
          <Link href="/tregu" style={{ fontSize: 13, fontWeight: 700, color: "#FF4422", textDecoration: "none", whiteSpace: "nowrap" }}>
            Shiko të gjitha →
          </Link>
        }
      />
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
