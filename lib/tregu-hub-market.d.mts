export type ExactPoint = { t: number; p: number };
export type HistoryPoint = { created_at: string; probability: number };
export type SportOutcome = {
  key: string;
  label: string;
  team?: string;
  color?: string;
  team_color?: string;
  team_colour?: string;
  logo?: string;
};
export type HubMarketLike = {
  market_type?: string;
  sport_outcomes?: SportOutcome[] | null;
  outcome_probabilities?: Record<string, number> | null;
  outcome_history?: Record<string, HistoryPoint[]> | null;
  history?: HistoryPoint[] | null;
  trade_volume?: number;
  q_yes?: number;
  q_no?: number;
  last_data_at?: string;
  updated_at?: string;
  trade_count?: number;
};
export function toExactSeries(points?: HistoryPoint[] | null): ExactPoint[];
export function normalizeRecordedOutcomeSeries(outcomes: Array<{
  key: string;
  points: ExactPoint[];
}>): Record<string, ExactPoint[]>;
export function isStructuredSportMarket(market: HubMarketLike): boolean;
export function marketVolume(market: HubMarketLike): number;
export function outcomeColor(outcome: SportOutcome, index?: number): string;
export function lastRecordedAt(market: HubMarketLike): number | null;
export function recordedMovement(market: HubMarketLike): number;
export function featuredMarketScore(market: HubMarketLike, now?: number): number;
