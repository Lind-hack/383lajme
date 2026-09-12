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
  probs?: [number, number, number];
  drift?: number;
};

function sample({
  league, home, away,
  homeColor = "#8b2337", awayColor = "#2475ae",
  probs = [.54, .25, .21], drift = 0,
}: Sample): StructuredSportMarket {
  const points = [.46, .47, .45, .49, .50, .48, .52, .54].map(p => p + drift);
  const [pHome, pDraw, pAway] = probs;
  return {
    slug: "design-preview-only", question: `${home} — ${away}: rezultati pas 90 minutave?`,
    category: "sport", market_type: "three_outcome", live_event: { league, sport: "soccer" },
    sport_outcomes: [
      { key: "home", label: home, team: home, color: homeColor },
      { key: "draw", label: "Barazim", color: "#777772" },
      { key: "away", label: away, team: away, color: awayColor },
    ],
    outcome_probabilities: { home: pHome, draw: pDraw, away: pAway },
    outcome_history: Object.fromEntries(["home", "draw", "away"].map(key => [key, points.map((p, i) => ({
      created_at: new Date(start + i * 3600000).toISOString(),
      probability: key === "home" ? p : key === "draw" ? .25 : .75 - p,
    }))])),
  };
}

// Real Champions League ties with their real club colours, but invented
// mid-range probabilities: every uefa.champions market in production is
// resolved, and a resolved book sits at .999/.001, which draws as a flat bar
// and tells us nothing about the design. Internazionale is here on purpose —
// #00239c is the darkest club colour in the set, and the worst case for
// legibility once the card goes navy.
const CHAMPIONS: Sample[] = [
  { league: "uefa.champions", home: "Real Madrid", away: "Internazionale", homeColor: "#ffffff", awayColor: "#00239c", probs: [.47, .27, .26] },
  { league: "uefa.champions", home: "Liverpool", away: "Atlético Madrid", homeColor: "#c8102e", awayColor: "#cb3524", probs: [.52, .26, .22], drift: .03 },
  { league: "uefa.champions", home: "Barcelona", away: "Feyenoord", homeColor: "#a50044", awayColor: "#e30613", probs: [.63, .21, .16], drift: -.04 },
  { league: "uefa.champions", home: "Bayern Munich", away: "Bodø/Glimt", homeColor: "#dc052d", awayColor: "#ffd100", probs: [.71, .18, .11], drift: .06 },
];

const UCL_RECEIPT: MobileTradeReceipt = {
  competition: "uefa.champions",
  market: "Real Madrid — Internazionale: rezultati pas 90 minutave?",
  selection: "Real Madrid",
  coins: 10,
  potentialReturn: 21.3,
  probability: 0.47,
  color: "#dfe6f5",
  finish: "standard",
  soundProfile: "champions",
};

const UEL_RECEIPT: MobileTradeReceipt = {
  competition: "uefa.europa",
  market: "Roma — Porto: rezultati pas 90 minutave?",
  selection: "Roma",
  coins: 10,
  potentialReturn: 22.7,
  probability: 0.44,
  color: "#f2c9a6",
  finish: "standard",
  soundProfile: "europa",
};

const NOOP = () => {};

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
  gap: 20,
};

export default function UefaCardPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  // ?receipt=uel swaps the mounted confirmation so both competitions can be
  // checked without a second sheet on the page.
  const showEuropaReceipt = typeof window !== "undefined" && window.location.search.includes("receipt=uel");
  return <div className="tregu-scope" style={{ minHeight: "100vh", background: "#f8f5ef" }}>
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 64px" }}>
      <Link href="/tregu" style={{ fontSize: 14, color: "#6b625a" }}>← Kthehu te Tregu</Link>
      <h1 style={{ margin: "24px 0 8px", fontSize: "clamp(26px,4vw,36px)", letterSpacing: "-.04em" }}>Champions League</h1>
      <p style={{ margin: "0 0 28px", color: "#6b625a", lineHeight: 1.6 }}>Pamje dizajni · Ndeshje dhe përqindje shembull. Këto nuk janë tregje aktive.</p>
      <div inert className="tregu-grid" style={GRID}>
        {CHAMPIONS.map(s => <StructuredSportMarketCard key={s.away} market={sample(s)} />)}
      </div>

      {/* Not inert: `inert` blocks hit-testing, so the hover glare cannot be
          checked in the grid above. The slug goes nowhere, so the link is
          harmless. */}
      <h2 style={{ margin: "44px 0 8px", fontSize: 20, letterSpacing: "-.02em" }}>Hover</h2>
      <p style={{ margin: "0 0 20px", color: "#6b625a", lineHeight: 1.6 }}>E njëjta kartë, e klikueshme — për shkëlqimin kur kalon miu.</p>
      <div style={GRID}>
        <StructuredSportMarketCard market={sample(CHAMPIONS[0])} />
      </div>

      <h2 style={{ margin: "44px 0 8px", fontSize: 20, letterSpacing: "-.02em" }}>Konfirmimi i blerjes</h2>
      <p style={{ margin: "0 0 20px", color: "#6b625a", lineHeight: 1.6 }}>Fatura pas blerjes — e njëjta natë si karta.</p>
      <MobileTradeSheet
        open={false}
        mode="buy"
        marketOpen
        loggedIn
        loginHref="/hyr"
        question={UCL_RECEIPT.market}
        balance={500}
        options={[{ key: "home", label: "Real Madrid", probability: 0.47, color: "#dfe6f5" }]}
        selectedKey="home"
        amount={10}
        amountInput="10"
        sellShares={0}
        liquidity={1000}
        sellCoinInput=""
        onSellCoinsChange={NOOP}
        maxSellShares={0}
        buyReturn={21.3}
        sellReturn={null}
        canBuy
        canSell={false}
        sellEnabled={false}
        placing={false}
        message={null}
        receipt={showEuropaReceipt ? UEL_RECEIPT : UCL_RECEIPT}
        soundProfile="champions"
        onOpen={NOOP}
        onClose={NOOP}
        onModeChange={NOOP}
        onSelect={NOOP}
        onAmountChange={NOOP}
        onSellSharesChange={NOOP}
        onSubmit={NOOP}
        onDismissReceipt={NOOP}
      />

      <h2 style={{ margin: "44px 0 8px", fontSize: 20, letterSpacing: "-.02em" }}>Europa League</h2>
      <p style={{ margin: "0 0 20px", color: "#6b625a", lineHeight: 1.6 }}>Rrezet bien nga lart, thyhen te fundi i kartës dhe dalin nga e djathta — paralele, me të njëjtën distancë mes tyre.</p>
      <div inert className="tregu-grid" style={GRID}>
        <StructuredSportMarketCard market={sample({ league: "uefa.europa", home: "Roma", away: "Porto", homeColor: "#8e1f2f", awayColor: "#0d5eaf", probs: [.44, .28, .28] })} />
        <StructuredSportMarketCard market={sample({ league: "uefa.europa", home: "Ajax", away: "Olympique Lyonnais", homeColor: "#d2122e", awayColor: "#1b3f8f", probs: [.51, .26, .23], drift: .04 })} />
      </div>

      <h2 style={{ margin: "44px 0 8px", fontSize: 20, letterSpacing: "-.02em" }}>Conference</h2>
      <p style={{ margin: "0 0 20px", color: "#6b625a", lineHeight: 1.6 }}>Ende pa trajtim — për krahasim.</p>
      <div inert style={GRID}>
        <StructuredSportMarketCard market={sample({ league: "uefa.europa.conf", home: "Fiorentina", away: "Rapid Wien" })} />
      </div>
    </main>
  </div>;
}
