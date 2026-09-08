import { notFound } from "next/navigation";
import Link from "next/link";
import StructuredSportMarketCard, { type StructuredSportMarket } from "@/components/tregu/structured-sport-market-card";

const start = Date.UTC(2026, 8, 8, 12);
function sample(league: string, home: string, away: string): StructuredSportMarket {
  const points = [.46, .47, .45, .49, .50, .48, .52, .54];
  return {
    slug: "design-preview-only", question: `${home} — ${away}: rezultati pas 90 minutave?`,
    category: "sport", market_type: "three_outcome", live_event: { league, sport: "soccer" },
    sport_outcomes: [
      { key: "home", label: home, team: home, color: "#8b2337" },
      { key: "draw", label: "Barazim", color: "#777772" },
      { key: "away", label: away, team: away, color: "#2475ae" },
    ],
    outcome_probabilities: { home: .54, draw: .25, away: .21 },
    outcome_history: Object.fromEntries(["home", "draw", "away"].map(key => [key, points.map((p, i) => ({
      created_at: new Date(start + i * 3600000).toISOString(),
      probability: key === "home" ? p : key === "draw" ? .25 : .75 - p,
    }))])),
  };
}

export default function UefaCardPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <div className="tregu-scope" style={{ minHeight: "100vh", background: "#f8f5ef" }}>
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 64px" }}>
      <Link href="/tregu" style={{ fontSize: 14, color: "#6b625a" }}>← Kthehu te Tregu</Link>
      <h1 style={{ margin: "24px 0 8px", fontSize: "clamp(26px,4vw,36px)", letterSpacing: "-.04em" }}>Europa & Conference League</h1>
      <p style={{ margin: "0 0 28px", color: "#6b625a", lineHeight: 1.6 }}>Pamje dizajni · Ndeshje dhe përqindje shembull. Këto nuk janë tregje aktive.</p>
      <div inert style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 20 }}>
        <StructuredSportMarketCard market={sample("uefa.europa", "Roma", "Porto")} />
        <StructuredSportMarketCard market={sample("uefa.europa.conf", "Fiorentina", "Rapid Wien")} />
      </div>
    </main>
  </div>;
}
