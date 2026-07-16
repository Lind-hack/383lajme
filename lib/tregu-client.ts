// Pure LMSR math + shared types — safe to import from Client Components.
// Keep this file free of "./db" (better-sqlite3) and "./groq" (server-only) imports.

export type MarketCategory = "politike" | "ekonomi" | "sport" | "bote" | "te-tjera";
export type MarketStatus = "draft" | "open" | "stale" | "closed" | "resolved";
export type BinarySide = "PO" | "JO";
export type ThreeOutcomeSide = "ENGLAND" | "DRAW" | "ARGENTINA";
export type Side = BinarySide | ThreeOutcomeSide;

export interface MarketTrade {
  id: string;
  market_id: string;
  action: "buy" | "sell";
  side: Side;
  coins: number;
  shares: number;
  price_yes: number;
  created_at: string;
  profiles?: { display_name?: string | null } | null;
}

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
  market_type?: "binary" | "three_outcome";
  q_england?: number;
  q_draw?: number;
  q_argentina?: number;
  outcomes?: Side[];
  pre_match_analysis?: { claims?: unknown[]; sources?: { title: string; url: string; source: string }[] } | null;
  closes_at: string;
  resolved_at: string | null;
  last_news_at?: string | null;
  last_reference_at?: string | null;
  last_checked_at?: string | null;
  last_scan_result?: { status?: string; checked_at?: string; evidence_count?: number; provider?: string; fallback_index?: number; error_class?: string } | null;
  live_event?: { provider: "espn"; event_id: string; league: string; yes_team: string } | null;
  live_score_state?: { key?: string; status?: string; detail?: string } | null;
  created_at: string;
  updated_at: string;
}

export interface MarketSnapshot {
  id: string;
  market_id: string;
  ai_prob: number | null;
  reference_probability?: number | null;
  oracle_kind?: "trade" | "news_oracle" | "news_reference" | "live_score" | null;
  oracle_reasoning?: string | null;
  market_prob_before?: number | null;
  oracle_cap?: number | null;
  evidence_sources?: string[];
  evidence_slugs?: string[];
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

/** Normalized prices for a three-outcome LMSR book. Kept separate from PO/JO for compatibility. */
export function lmsrThreeOutcomePrices(market: Pick<Market, "q_england" | "q_draw" | "q_argentina" | "b">): Record<Lowercase<ThreeOutcomeSide>, number> {
  const quantities = [Number(market.q_england ?? 0), Number(market.q_draw ?? 0), Number(market.q_argentina ?? 0)];
  const pivot = Math.max(...quantities);
  const weights = quantities.map((q) => Math.exp((q - pivot) / market.b));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return { england: weights[0] / total, draw: weights[1] / total, argentina: weights[2] / total };
}


/** Legacy 418ecb9 graph detail sell preview support. */
export function lmsrCost(qYes: number, qNo: number, b: number): number {
  return b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b));
}

export function previewSell(
  market: Pick<Market, "q_yes" | "q_no" | "b">,
  side: Side,
  shares: number
): { coins: number; newPriceYes: number; avgPrice: number } {
  const { q_yes, q_no, b } = market;
  const newQYes = side === "PO" ? q_yes - shares : q_yes;
  const newQNo = side === "JO" ? q_no - shares : q_no;
  const coins = Math.max(0, lmsrCost(q_yes, q_no, b) - lmsrCost(newQYes, newQNo, b));
  return { coins, newPriceYes: lmsrPriceYes(newQYes, newQNo, b), avgPrice: shares > 0 ? coins / shares : 0 };
}
