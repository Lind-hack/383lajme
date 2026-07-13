// Demo data for the Tregu design preview. Lets the trading interface and
// card designs render before any real market exists in the DB. Reached via
// /tregu/demo and /tregu-preview — both gated behind isDemoEnabled below.
import type { MiniMarket } from "@/components/tregu/market-mini-card";
import type { MarketTrade, Side } from "@/lib/tregu-client";

export const DEMO_SLUG = "demo";

// Demo preview is publicly reachable while the market floor has no real
// markets. Flip to `process.env.NODE_ENV === "development"` to hide it in
// production once real markets go live.
export const isDemoEnabled = true;

const HOUR = 3_600_000;
const DAY = 86_400_000;

// Deterministic pseudo-noise so the tapes look organic but render the same
// on every load (no Math.random — keeps screenshots comparable).
function noise(i: number): number {
  return Math.sin(i * 12.9898) * 0.5;
}

// A price tape that drifts from `from` to `to` with believable wobble.
function tape(from: number, to: number, n = 22): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const drift = from + (to - from) * (t * t * (3 - 2 * t)); // smoothstep
    return Math.max(0.03, Math.min(0.97, drift + noise(i) * 0.03));
  });
}

const now = () => Date.now();

// ── Hub floor sample: 1 flagship + 5 minis, mixed categories ──
// Slugs are distinct (React keys off slug) but all start with "demo",
// so every card routes into the demo trading interface.
export function demoMinis(): MiniMarket[] {
  return [
    {
      slug: DEMO_SLUG,
      question: "A do të mbahen zgjedhjet lokale në veri të Kosovës para fundit të vitit?",
      category: "politike",
      prob: 0.62,
      volume: 911,
      closesAt: new Date(now() + 12 * DAY).toISOString(),
      spark: tape(0.51, 0.62),
      delta7d: 0.09,
    },
    {
      slug: "demo-2",
      question: "A do të ulë BQE-ja normat e interesit në mbledhjen e korrikut?",
      category: "ekonomi",
      prob: 0.71,
      volume: 3410,
      closesAt: new Date(now() + 9 * DAY).toISOString(),
      spark: tape(0.64, 0.71),
      delta7d: 0.03,
    },
    {
      slug: "demo-3",
      question: "A do të kualifikohet Kosova në Kupën e Botës 2026?",
      category: "sport",
      prob: 0.18,
      volume: 2350,
      closesAt: new Date(now() + 45 * DAY).toISOString(),
      spark: tape(0.24, 0.18),
      delta7d: -0.04,
    },
    {
      slug: "demo-4",
      question: "A do të bjerë inflacioni vjetor nën 2% deri në shtator?",
      category: "ekonomi",
      prob: 0.44,
      volume: 1280,
      closesAt: new Date(now() + 30 * DAY).toISOString(),
      spark: tape(0.37, 0.44),
      delta7d: 0.06,
    },
    {
      slug: "demo-5",
      question: "A do të nënshkruhet marrëveshja e re energjetike me Shqipërinë këtë verë?",
      category: "bote",
      prob: 0.55,
      volume: 890,
      closesAt: new Date(now() + 21 * DAY).toISOString(),
      spark: tape(0.58, 0.55),
      delta7d: -0.02,
    },
    {
      // Fresh market — exercises the "Treg i ri" empty-tape card state.
      slug: "demo-6",
      question: "A do të hapet terminali i ri i aeroportit para 1 nëntorit?",
      category: "te-tjera",
      prob: 0.5,
      volume: 0,
      closesAt: new Date(now() + 60 * DAY).toISOString(),
    },
  ];
}

// ── Detail page sample: flagship market with a week of history ──
export function demoDetail() {
  // b=100; q_yes−q_no = 49 puts the LMSR PO price at ~62%.
  const q_yes = 480;
  const q_no = 431;

  const market = {
    id: "demo",
    slug: DEMO_SLUG,
    question: "A do të mbahen zgjedhjet lokale në veri të Kosovës para fundit të vitit?",
    description:
      "Tregu ndjek nëse KQZ-ja shpall dhe mban zgjedhje lokale në katër komunat veriore para 31 dhjetorit 2026.",
    category: "politike",
    status: "open",
    outcome: null as Side | null,
    market_prob: 0.62,
    q_yes,
    q_no,
    b: 100,
    closes_at: new Date(now() + 12 * DAY).toISOString(),
    source_article_slugs: [] as string[],
    resolution_rules:
      "Tregu zgjidhet PO nëse KQZ-ja mban zgjedhjet lokale në të katër komunat veriore para datës së mbylljes, e konfirmuar nga shpallja zyrtare. Shtyrje ose mbajtje e pjesshme zgjidhet JO.",
    resolution_source: "KQZ + raportimi i 383",
  };

  const prices = tape(0.51, 0.62, 16);
  const names = ["Arbër K.", "Dua M.", "Fitim R.", "Elira B.", "Driton S.", "Anonim", "Blerta H.", "Leart P."];
  const trades: MarketTrade[] = prices.map((p, i) => ({
    id: `demo-t${i}`,
    market_id: "demo",
    action: i % 5 === 3 ? "sell" : "buy",
    side: (p >= (prices[i - 1] ?? p) ? "PO" : "JO") as Side,
    coins: [10, 25, 15, 50, 20, 100, 25, 40][i % 8],
    shares: 18 + noise(i) * 6,
    price_yes: p,
    created_at: new Date(now() - (prices.length - i) * 10 * HOUR).toISOString(),
    profiles: { display_name: names[i % names.length] },
  }));

  const snapshots = Array.from({ length: 8 }, (_, i) => ({
    ai_prob: 0.55 + i * 0.008,
    market_prob: tape(0.51, 0.62, 8)[i],
    created_at: new Date(now() - (8 - i) * DAY).toISOString(),
    evidence:
      i === 7
        ? [
            { title: "KQZ njofton gatishmërinë teknike për zgjedhjet në veri", slug: "kqz-gatishmeria-veri" },
            { title: "BE kërkon datë të re për zgjedhjet lokale", slug: "be-date-zgjedhje-veri" },
            { title: "Kryetarët e komunave veriore japin sinjale pjesëmarrjeje", slug: "kryetaret-veri-pjesemarrje" },
          ]
        : null,
  }));

  return {
    market,
    snapshots,
    trades,
    activity: [...trades].reverse().slice(0, 6),
    related: demoMinis().slice(1, 4),
    weeklyDelta: 0.09,
    tradeCount: 47,
    // A held PO position — lights up "Pozicioni yt" and the Shit tab.
    positions: [{ side: "PO" as Side, shares: 14.2, coins_staked: 8, market_id: "demo" }],
  };
}
