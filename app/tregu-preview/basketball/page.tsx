"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import StructuredSportMarketCard, { type StructuredSportMarket } from "@/components/tregu/structured-sport-market-card";
import MobileTradeSheet, { type MobileTradeReceipt } from "@/components/tregu/mobile-trade-sheet";

const start = Date.UTC(2026, 8, 8, 12);

type Sample = {
  league: string;
  home: string;
  away: string;
  homeColor?: string;
  awayColor?: string;
  prob?: number;
  drift?: number;
};

/* Two outcomes, not three: basketball cannot draw, and buildBasketballMarketPlan
   in lib/tregu-basketball.mjs emits exactly home/away. Previewing it as a
   three-outcome book would exercise a chip layout this treatment never gets. */
function sample({
  league, home, away,
  homeColor = "#17408B", awayColor = "#C8102E",
  prob = 0.56, drift = 0,
}: Sample): StructuredSportMarket {
  const points = [.46, .47, .45, .49, .50, .48, .52, .54].map(p => p + drift);
  return {
    slug: "design-preview-only",
    question: `${home} — ${away}: kush fiton?`,
    category: "sport",
    market_type: "two_outcome",
    live_event: { league, sport: "basketball" },
    sport_outcomes: [
      { key: "home", label: home, team: home, color: homeColor },
      { key: "away", label: away, team: away, color: awayColor },
    ],
    outcome_probabilities: { home: prob, away: 1 - prob },
    outcome_history: Object.fromEntries(["home", "away"].map(key => [key, points.map((p, i) => ({
      created_at: new Date(start + i * 3600000).toISOString(),
      probability: key === "home" ? p : 1 - p,
    }))])),
  };
}

/* Real clubs and their real colours, invented mid-range probabilities -- the
   same rule the UEFA harness follows and for the same reason: a settled book
   draws as a flat bar and says nothing about the design.

   Cleveland is here deliberately. #860038 is the darkest colour in the set and
   the worst case for a team chip sitting on warm paper over wood. */
const NBA: Sample[] = [
  { league: "nba", home: "Boston Celtics", away: "Los Angeles Lakers", homeColor: "#007A33", awayColor: "#552583", prob: .55 },
  { league: "nba", home: "Denver Nuggets", away: "Cleveland Cavaliers", homeColor: "#0E2240", awayColor: "#860038", prob: .61, drift: .04 },
  { league: "nba", home: "Golden State Warriors", away: "Miami Heat", homeColor: "#1D428A", awayColor: "#98002E", prob: .48, drift: -.03 },
  { league: "nba", home: "Oklahoma City Thunder", away: "New York Knicks", homeColor: "#007AC1", awayColor: "#F58426", prob: .67, drift: .06 },
];

const NBA_RECEIPT: MobileTradeReceipt = {
  competition: "nba",
  market: "Boston Celtics — Los Angeles Lakers: kush fiton?",
  selection: "Boston Celtics",
  coins: 10,
  potentialReturn: 18.2,
  probability: 0.55,
  color: "#E9C99A",
  finish: "parquet",
  soundProfile: "basketball",
};

const FBK_RECEIPT: MobileTradeReceipt = {
  competition: "fbk.kosovo",
  market: "Sigal Prishtina — Peja: kush fiton?",
  selection: "Sigal Prishtina",
  coins: 10,
  potentialReturn: 19.6,
  probability: 0.51,
  color: "#E9C99A",
  finish: "parquet",
  soundProfile: "basketball",
};

const NOOP = () => {};

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
  gap: 20,
};

const NOTE: CSSProperties = { margin: "0 0 20px", color: "#6b625a", lineHeight: 1.6 };
const H2: CSSProperties = { margin: "44px 0 8px", fontSize: 20, letterSpacing: "-.02em" };

export default function BasketballCardPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  // ?receipt=fbk swaps the mounted confirmation, matching the UEFA harness.
  const search = typeof window !== "undefined" ? window.location.search : "";
  const receipt = search.includes("receipt=fbk") ? FBK_RECEIPT : NBA_RECEIPT;

  return <div className="tregu-scope" style={{ minHeight: "100vh", background: "#f8f5ef" }}>
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 64px" }}>
      <Link href="/tregu" style={{ fontSize: 14, color: "#6b625a" }}>← Kthehu te Tregu</Link>
      <h1 style={{ margin: "24px 0 8px", fontSize: "clamp(26px,4vw,36px)", letterSpacing: "-.04em" }}>Basketboll</h1>
      <p style={NOTE}>Pamje dizajni · Ndeshje dhe përqindje shembull. Këto nuk janë tregje aktive.</p>

      <div inert className="tregu-grid" style={GRID}>
        {NBA.map(s => <StructuredSportMarketCard key={s.away} market={sample(s)} />)}
      </div>

      {/* Not inert: `inert` blocks hit-testing, so the hover glare cannot be
          checked in the grid above. The slug goes nowhere. */}
      <h2 style={H2}>Hover</h2>
      <p style={NOTE}>E njëjta kartë, e klikueshme — për shkëlqimin kur kalon miu.</p>
      <div style={GRID}>
        <StructuredSportMarketCard market={sample(NBA[0])} />
      </div>

      <h2 style={H2}>FIBA</h2>
      <p style={NOTE}>I njëjti parket, vija e anës në ngjyrën e FIBA-s.</p>
      <div inert className="tregu-grid" style={GRID}>
        <StructuredSportMarketCard market={sample({ league: "fiba.world", home: "Serbia", away: "Gjermania", homeColor: "#C6363C", awayColor: "#1A1A1A", prob: .52 })} />
        <StructuredSportMarketCard market={sample({ league: "fiba.world", home: "Kanada", away: "Australia", homeColor: "#D80621", awayColor: "#00843D", prob: .58, drift: .03 })} />
      </div>

      <h2 style={H2}>Superliga e Kosovës</h2>
      <p style={NOTE}>I njëjti trajtim, vija në blunë e FBK-së.</p>
      <div inert className="tregu-grid" style={GRID}>
        <StructuredSportMarketCard market={sample({ league: "fbk.kosovo", home: "Sigal Prishtina", away: "Peja", homeColor: "#0A5AA6", awayColor: "#1E7A3C", prob: .51 })} />
        <StructuredSportMarketCard market={sample({ league: "fbk.kosovo", home: "Trepça", away: "Bashkimi", homeColor: "#B4181A", awayColor: "#2B4E9B", prob: .63, drift: .05 })} />
      </div>

      <h2 style={H2}>Konfirmimi i blerjes</h2>
      <p style={NOTE}>
        Fatura pas blerjes — i njëjti parket me dritat ulur, që teksti i bardhë të mbetet i lexueshëm.
        Topi bie një herë dhe ulet në vijën e artë. Shto <code>?receipt=fbk</code> për variantin e Superligës.
      </p>
      <MobileTradeSheet
        open={false}
        mode="buy"
        marketOpen
        loggedIn
        loginHref="/hyr"
        question={receipt.market}
        balance={500}
        options={[{ key: "home", label: receipt.selection, probability: receipt.probability, color: "#E9C99A" }]}
        selectedKey="home"
        amount={10}
        amountInput="10"
        sellShares={0}
        liquidity={1000}
        sellCoinInput=""
        onSellCoinsChange={NOOP}
        maxSellShares={0}
        buyReturn={receipt.potentialReturn}
        sellReturn={null}
        canBuy
        canSell={false}
        sellEnabled={false}
        placing={false}
        message={null}
        receipt={receipt}
        soundProfile="basketball"
        onOpen={NOOP}
        onClose={NOOP}
        onModeChange={NOOP}
        onSelect={NOOP}
        onAmountChange={NOOP}
        onSellSharesChange={NOOP}
        onSubmit={NOOP}
        onDismissReceipt={NOOP}
      />
    </main>
  </div>;
}
