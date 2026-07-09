// Pure LMSR math + shared types — safe to import from Client Components.
// Keep this file free of "./db" (better-sqlite3) and "./groq" (server-only) imports.

export type MarketCategory = "politike" | "ekonomi" | "sport" | "bote" | "te-tjera";
export type MarketStatus = "draft" | "open" | "closed" | "resolved";
export type Side = "PO" | "JO";

export interface Market {
  id: string;
  slug: string;
  question: string;
  description: string | null;
  category: MarketCategory;
  status: MarketStatus;
  outcome: Side | null;
  source_article_slugs: string[];
  ai_generated: boolean;
  b: number;
  q_yes: number;
  q_no: number;
  closes_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketSnapshot {
  id: string;
  market_id: string;
  ai_prob: number | null;
  market_prob: number;
  volume: number;
  evidence: { title: string; slug: string; url?: string }[] | null;
  created_at: string;
}

/** LMSR price of YES ("PO"), 0..1. Mirrors the SQL function `lmsr_price_yes`. */
export function lmsrPriceYes(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b);
  const eNo = Math.exp(qNo / b);
  return eYes / (eYes + eNo);
}

/** Preview shares bought + resulting price for a bet, without touching the DB. */
export function previewBet(
  market: Pick<Market, "q_yes" | "q_no" | "b">,
  side: Side,
  coins: number
): { shares: number; newPriceYes: number; avgPrice: number } {
  const { q_yes, q_no, b } = market;
  const eYes = Math.exp(q_yes / b);
  const eNo = Math.exp(q_no / b);
  const sumBefore = eYes + eNo;

  let delta: number;
  let newQYes = q_yes;
  let newQNo = q_no;

  if (side === "PO") {
    delta = b * Math.log((sumBefore * Math.exp(coins / b) - eNo) / eYes);
    newQYes = q_yes + delta;
  } else {
    delta = b * Math.log((sumBefore * Math.exp(coins / b) - eYes) / eNo);
    newQNo = q_no + delta;
  }

  const newPriceYes = lmsrPriceYes(newQYes, newQNo, b);
  return { shares: delta, newPriceYes, avgPrice: delta > 0 ? coins / delta : 0 };
}
