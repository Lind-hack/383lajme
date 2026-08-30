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
  side: string;
  coins: number;
  shares: number;
  price_yes: number;
  outcome_prices?: Record<string, number> | null;
  created_at: string;
  profiles?: { display_name?: string | null; is_anonymous?: boolean | null } | null;
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
  market_type?: "binary" | "two_outcome" | "three_outcome" | "f1_race_winner";
  q_england?: number;
  q_draw?: number;
  q_argentina?: number;
  outcomes?: Side[];
  sport_outcomes?: { key: string; label: string; team?: string; color?: string }[] | null;
  outcome_quantities?: Record<string, number> | null;
  reference_probabilities?: Record<string, number> | null;
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
  evidence_fingerprint?: string | null;
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

/** Normalized prices for any configured sport-outcome LMSR book. */
export function lmsrSportOutcomePrices(
  market: Pick<Market, "sport_outcomes" | "outcome_quantities" | "b">
): Record<string, number> {
  const outcomes = market.sport_outcomes ?? [];
  if (outcomes.length < 2 || !Number.isFinite(market.b) || market.b <= 0) return {};
  const quantities = outcomes.map((outcome) => Number(market.outcome_quantities?.[outcome.key] ?? 0));
  if (quantities.some((quantity) => !Number.isFinite(quantity))) return {};
  const pivot = Math.max(...quantities);
  const weights = quantities.map((quantity) => Math.exp(Math.max(-700, Math.min(700, (quantity - pivot) / market.b))));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!(total > 0)) return {};
  return Object.fromEntries(outcomes.map((outcome, index) => [outcome.key, weights[index] / total]));
}

/** Client-side buy preview for the generic sport-outcome LMSR. */
export function previewSportOutcomeBet(
  market: Pick<Market, "sport_outcomes" | "outcome_quantities" | "b">,
  outcomeKey: string,
  coins: number
): { shares: number; prices: Record<string, number>; avgPrice: number } | null {
  const outcomes = market.sport_outcomes ?? [];
  const selectedIndex = outcomes.findIndex((outcome) => outcome.key === outcomeKey);
  if (selectedIndex < 0 || !Number.isFinite(coins) || coins <= 0 || market.b <= 0) return null;
  const quantities = outcomes.map((outcome) => Number(market.outcome_quantities?.[outcome.key] ?? 0));
  if (quantities.some((quantity) => !Number.isFinite(quantity))) return null;
  const pivot = Math.max(...quantities);
  const weights = quantities.map((quantity) => Math.exp(Math.max(-700, Math.min(700, (quantity - pivot) / market.b))));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const selectedWeight = weights[selectedIndex];
  const otherWeight = total - selectedWeight;
  const shares = market.b * Math.log((total * Math.exp(coins / market.b) - otherWeight) / selectedWeight);
  const nextQuantities = Object.fromEntries(
    outcomes.map((outcome, index) => [outcome.key, quantities[index] + (index === selectedIndex ? shares : 0)])
  );
  const prices = lmsrSportOutcomePrices({ ...market, outcome_quantities: nextQuantities });
  return { shares, prices, avgPrice: shares > 0 ? coins / shares : 0 };
}

/** Client-side cash-out preview for any configured sport-outcome LMSR book. */
export function previewSportOutcomeSell(
  market: Pick<Market, "sport_outcomes" | "outcome_quantities" | "b">,
  outcomeKey: string,
  shares: number
): { coins: number; prices: Record<string, number>; avgPrice: number } | null {
  const outcomes = market.sport_outcomes ?? [];
  const selectedIndex = outcomes.findIndex((outcome) => outcome.key === outcomeKey);
  if (selectedIndex < 0 || !Number.isFinite(shares) || shares <= 0 || market.b <= 0) return null;
  const quantities = outcomes.map((outcome) => Number(market.outcome_quantities?.[outcome.key] ?? 0));
  if (quantities.some((quantity) => !Number.isFinite(quantity))) return null;

  const cost = (values: number[]) => {
    const pivot = Math.max(...values);
    const weightSum = values.reduce(
      (sum, quantity) => sum + Math.exp(Math.max(-700, Math.min(700, (quantity - pivot) / market.b))),
      0
    );
    return pivot + market.b * Math.log(weightSum);
  };

  const nextQuantities = quantities.map((quantity, index) =>
    index === selectedIndex ? quantity - shares : quantity
  );
  const coins = Math.max(0, cost(quantities) - cost(nextQuantities));
  const prices = lmsrSportOutcomePrices({
    ...market,
    outcome_quantities: Object.fromEntries(
      outcomes.map((outcome, index) => [outcome.key, nextQuantities[index]])
    ),
  });
  return { coins, prices, avgPrice: shares > 0 ? coins / shares : 0 };
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
