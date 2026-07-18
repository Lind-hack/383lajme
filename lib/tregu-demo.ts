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
// High-frequency jitter + occasional larger jolts make the line spike and
// dip like a real order book instead of gliding smoothly.
function tape(from: number, to: number, n = 22): number[] {
  // Seed decorrelates tapes that share indices — without it, sibling
  // outcomes get identical jitter and per-point normalization flattens it.
  const seed = from * 137.31 + to * 61.7;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const drift = from + (to - from) * (t * t * (3 - 2 * t)); // smoothstep
    const jitter = noise(i + seed) * 0.035 + Math.sin((i + seed) * 78.233) * 0.5 * 0.02;
    const jolt = i % 6 === 2 ? Math.sin((i + seed) * 39.425) * 0.5 * 0.08 : 0;
    return Math.max(0.03, Math.min(0.97, drift + jitter + jolt));
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

// ── Multi-outcome event sample: Argjentina – Spanja (finalja e Botërorit) ──
// Question prefix "<title>: <outcome>?" is what lib/tregu-groups.ts groups on.
// Slugs start with "demo" so each outcome routes into the demo trading page.
// A final always has a winner (vazhdime + penallti), so only 2 books.
//
// The chart data is a scripted match simulation: Argjentina comes back from
// 0-2 to win 3-2 in extra time. Goals are hard price steps; everything between
// them is momentum — pressure, shots, shots on target, xG, and possession
// drifting the price the way a real in-play book moves.
//
// Match-minute keyframes for Argjentina's win probability:
//   14'   GOL Spanja 1-0        (crash)
//   31'   Argjentina hits the post, xG spike   (recovery drift)
//   45+1' GOL Spanja 2-0 on the counter        (bottom)
//   53'   GOL Argjentina 1-2                   (jump)
//   53-72 sustained Argjentina pressure: corners, big chances (climb)
//   74'   GOL Argjentina 2-2                   (jump toward coin-flip+)
//   88'   Spanja late chance saved             (dip)
//   91-108 extra time, Argjentina fresher      (climb)
//   109'  GOL Argjentina 3-2                   (near-certainty)
// Goals step the price hard in a single minute; every goal is followed by an
// overreaction and a partial retrace (order books overshoot, then cooler
// money fades the move). Between goals momentum swings 8-12pp, not 2-3pp —
// that's what makes the tape read dramatic instead of square plateaus.
const MATCH_KEYFRAMES: [number, number][] = [
  [0, 0.44], [3, 0.41], [5, 0.46], [8, 0.4], [10, 0.43], [13, 0.36],
  [14, 0.22], [16, 0.18],                      // GOL Spanja + panic overshoot
  [19, 0.27], [22, 0.23], [26, 0.28], [28, 0.24], [30, 0.26],
  [31, 0.37],                                   // post hit — equalizer priced in
  [33, 0.29], [36, 0.33], [39, 0.28], [42, 0.34], [45, 0.32],
  [46, 0.1], [48, 0.07],                        // GOL Spanja 2-0 + capitulation
  [50, 0.12], [52, 0.1],
  [53, 0.27], [55, 0.32],                       // GOL Argjentina + overshoot
  [58, 0.25], [61, 0.35], [63, 0.3], [66, 0.4], [68, 0.32], [71, 0.37], [73, 0.33],
  [74, 0.58], [76, 0.64],                       // GOL Argjentina 2-2 + euphoria
  [79, 0.52], [82, 0.58], [85, 0.5], [87, 0.55],
  [88, 0.41],                                   // Spanja big chance saved
  [90, 0.53], [92, 0.48],
  [95, 0.57], [98, 0.5], [101, 0.61], [104, 0.54], [107, 0.64], [108, 0.6],
  [109, 0.94], [111, 0.9],                      // GOL Argjentina 3-2 + brief doubt
  [114, 0.96], [118, 0.945], [122, 0.982],
];
const MATCH_LAST_MIN = 122;

function matchProbAt(m: number): number {
  const k = MATCH_KEYFRAMES;
  if (m <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (m <= k[i][0]) {
      const [m0, p0] = k[i - 1];
      const [m1, p1] = k[i];
      return p0 + ((p1 - p0) * (m - m0)) / (m1 - m0);
    }
  }
  return k[k.length - 1][1];
}

// Hash noise: uniform in [-0.5, 0.5) with no smooth structure between
// samples — this is what makes the line saw-tooth instead of undulate.
function jag(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

// Timestamped in-play tape at 1-minute resolution, ending now (full time).
// Two jitter octaves are decorrelated per book so the lines don't mirror
// exactly; jitter fades over the last minutes so the price settles cleanly.
export function demoMatchSeries(slug: string): { t: number; p: number }[] | undefined {
  if (slug !== "demo-ev-argjentina" && slug !== "demo-ev-spanja") return undefined;
  const arg = slug === "demo-ev-argjentina";
  const seed = arg ? 3 : 11;
  const end = now();
  const pts: { t: number; p: number }[] = [];
  for (let m = 0; m <= MATCH_LAST_MIN; m += 1) {
    const base = matchProbAt(m);
    let p = arg ? base : 1 - base;
    const settle = m > 116 ? (MATCH_LAST_MIN - m) / 6 : 1;
    p += (jag(m * 1.31 + seed) * 0.03 + jag(m * 0.37 + seed * 2.7) * 0.022) * settle;
    p = Math.max(0.01, Math.min(0.99, p));
    pts.push({ t: end - (MATCH_LAST_MIN - m) * 60_000, p });
  }
  return pts;
}

function matchSpark(slug: string): number[] {
  return (demoMatchSeries(slug) ?? []).filter((_, i) => i % 4 === 0).map((pt) => pt.p);
}

// FotMob-style full-match stat lines, consistent with the 3-2 comeback:
// Spanja controlled the opening 45, Argjentina dominated everything after.
export interface MatchStatRow {
  label: string;
  home: number;
  away: number;
  homeText?: string;
  awayText?: string;
}

export function demoMatchStats() {
  return {
    home: "Argjentina",
    away: "Spanja",
    score: "3 - 2",
    note: "Pas vazhdimeve",
    goals: "Golat: Spanja 14', 45+1' · Argjentina 53', 74', 109'",
    rows: [
      { label: "Golat e pritshëm (xG)", home: 3.24, away: 2.11, homeText: "3.24", awayText: "2.11" },
      { label: "Posedimi i topit", home: 54, away: 46, homeText: "54%", awayText: "46%" },
      { label: "Gjuajtjet totale", home: 19, away: 12 },
      { label: "Gjuajtje në portë", home: 9, away: 6 },
      { label: "Shanse të mëdha", home: 5, away: 3 },
      { label: "Sulme të rrezikshme", home: 58, away: 41 },
      { label: "Goditje nga këndi", home: 8, away: 4 },
      { label: "Pasime të sakta", home: 612, away: 498, homeText: "87% (612/703)", awayText: "84% (498/593)" },
      { label: "Kartonë të verdhë", home: 2, away: 3 },
    ] as MatchStatRow[],
  };
}

export function demoEventMinis(): MiniMarket[] {
  const closes = new Date(now() + 4 * DAY).toISOString();
  return [
    {
      slug: "demo-ev-argjentina",
      question: "Argjentina – Spanja: Fiton Argjentina?",
      category: "sport",
      prob: 0.982,
      volume: 2140,
      closesAt: closes,
      spark: matchSpark("demo-ev-argjentina"),
      delta7d: 0.56,
    },
    {
      slug: "demo-ev-spanja",
      question: "Argjentina – Spanja: Fiton Spanja?",
      category: "sport",
      prob: 0.018,
      volume: 1890,
      closesAt: closes,
      spark: matchSpark("demo-ev-spanja"),
      delta7d: -0.56,
    },
  ];
}

// ── Detail page sample: flagship market with a week of history ──
export function demoDetail(slug?: string) {
  // Demo event outcomes get their own detail fixture built from the mini,
  // so /tregu/demo-ev-* renders the event trading page without a DB.
  const ev = slug ? demoEventMinis().find((m) => m.slug === slug) : undefined;
  if (ev) return demoEventDetail(ev);
  return demoFlagshipDetail();
}

function demoEventDetail(ev: MiniMarket) {
  const b = 100;
  // LMSR quantities that price PO at ev.prob: q_yes − q_no = b·ln(p/(1−p)).
  const base = 400;
  const diff = b * Math.log(ev.prob / (1 - ev.prob));
  const q_yes = Math.round((base + diff / 2) * 10) / 10;
  const q_no = Math.round((base - diff / 2) * 10) / 10;

  const market = {
    id: ev.slug,
    slug: ev.slug,
    question: ev.question,
    description:
      "Finalja e Kupës së Botës 2026: Argjentina – Spanja. Tregu ndjek fituesin e trofeut - vazhdimet dhe penalltitë llogariten, finalja ka gjithmonë një fitues.",
    category: "sport",
    status: "open",
    outcome: null as Side | null,
    market_prob: ev.prob,
    q_yes,
    q_no,
    b,
    closes_at: ev.closesAt!,
    source_article_slugs: [] as string[],
    resolution_rules:
      "Zgjidhet PO nëse kjo skuadër ngre trofeun - përfshirë vazhdimet dhe penalltitë. Finalja ka gjithmonë një fitues, prandaj njëri nga dy tregjet zgjidhet PO.",
    resolution_source: "Rezultati zyrtar i FIFA-s / transmetuesit zyrtar",
  };

  const prices = ev.spark ?? tape(ev.prob, ev.prob, 16);
  const names = ["Arbër K.", "Dua M.", "Fitim R.", "Elira B.", "Driton S.", "Anonim", "Blerta H.", "Leart P."];
  const trades: MarketTrade[] = prices.map((p, i) => ({
    id: `${ev.slug}-t${i}`,
    market_id: ev.slug,
    action: i % 5 === 3 ? "sell" : "buy",
    side: (p >= (prices[i - 1] ?? p) ? "PO" : "JO") as Side,
    coins: [10, 25, 15, 50, 20, 100, 25, 40][i % 8],
    shares: 18 + noise(i) * 6,
    price_yes: p,
    created_at: new Date(now() - (prices.length - i) * 8 * HOUR).toISOString(),
    profiles: { display_name: names[i % names.length] },
  }));

  return {
    market,
    snapshots: [] as {
      ai_prob: number | null;
      market_prob: number;
      created_at: string;
      evidence: { title: string; slug: string }[] | null;
    }[],
    trades,
    activity: [...trades].reverse().slice(0, 6),
    related: demoMinis().slice(1, 4),
    weeklyDelta: ev.delta7d ?? null,
    tradeCount: 31,
    positions: [] as { side: Side; shares: number; coins_staked: number; market_id: string }[],
  };
}

function demoFlagshipDetail() {
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
