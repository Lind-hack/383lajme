"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProbabilityBar from "./probability-bar";

interface MarketRow {
  slug: string;
  question: string;
  market_prob: number;
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

export default function SidebarMarketWidget({ articleCategory }: { articleCategory: string }) {
  const [market, setMarket] = useState<MarketRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const marketCategory = ARTICLE_CATEGORY_TO_MARKET[articleCategory];
    const qs = marketCategory ? `?category=${marketCategory}` : "";
    fetch(`/api/tregu/markets${qs}`)
      .then((r) => r.json())
      .then((d) => setMarket((d.markets ?? [])[0] ?? null))
      .finally(() => setLoading(false));
  }, [articleCategory]);

  if (loading || !market) return null;

  return (
    <div className="tregu-scope" style={{ borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <Link
        href={`/tregu/${market.slug}`}
        className="tregu-glass"
        style={{ display: "block", padding: "16px 18px", textDecoration: "none", color: "#111111", borderRadius: "var(--radius-md)" }}
      >
        <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B6B6B", margin: "0 0 10px" }}>
          383 Tregu — parashiko
        </p>
        <p style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.35, margin: "0 0 14px" }}>{market.question}</p>
        <ProbabilityBar prob={market.market_prob} height={6} />
      </Link>
    </div>
  );
}
