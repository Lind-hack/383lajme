"use client";

// Design preview of the Tregu floor: flagship feature card + mini cards
// rendered from local sample data, no DB needed. Every card links to
// /tregu/demo, which shows the full trading interface the same way.
// Gated behind isDemoEnabled in lib/tregu-demo.ts.
import Link from "next/link";
import Navbar from "@/components/navbar";
import MarketFeatureCard from "@/components/tregu/market-feature-card";
import MarketMiniCard from "@/components/tregu/market-mini-card";
import MarketEventCard from "@/components/tregu/market-event-card";
import { groupMarkets } from "@/lib/tregu-groups";
import { demoEventMinis, demoMinis, isDemoEnabled } from "@/lib/tregu-demo";

export default function TreguPreviewPage() {
  if (!isDemoEnabled) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <div style={{ padding: "140px 24px", textAlign: "center", color: "#6B6B6B" }}>
          Kjo faqe është vetëm për zhvillim.
        </div>
      </div>
    );
  }

  const minis = demoMinis();
  const [flagship, ...rest] = minis;
  // Multi-outcome sample: Anglia – Argjentina folds into one event card.
  const { groups } = groupMarkets(demoEventMinis());

  return (
    <div className="tregu-scope">
      <Navbar />
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "104px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Tregu — pamje dizajni</h1>
          <span style={{ fontSize: 12, color: "#6B6B6B" }}>
            Të dhëna shembull · kliko një kartë për ndërfaqen e tregtimit —{" "}
            <Link href="/tregu/demo" style={{ color: "#00A651" }}>
              /tregu/demo
            </Link>
          </span>
        </div>

        <div className="tregu-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          <MarketFeatureCard market={flagship} />
          {groups.map((g) => (
            <MarketEventCard key={g.key} group={g} />
          ))}
          {rest.map((m, i) => (
            <MarketMiniCard key={i} market={m} />
          ))}
        </div>
      </main>
    </div>
  );
}
