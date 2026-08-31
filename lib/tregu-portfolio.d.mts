export type PortfolioMarket = Record<string, unknown>;
export function outcomePrices(market: PortfolioMarket | null): Record<string, number>;
export function enrichPositions(positions: Array<Record<string, unknown>>): Array<Record<string, unknown>>;
export function buildSettledTrades(transactions: Array<Record<string, unknown>>, openMarketIds?: Set<string>): Array<Record<string, unknown>>;
export function buildRealizedBalanceHistory(args: Record<string, unknown>): { history: Array<Record<string, unknown>>; pnl30d: number; currentRealizedBalance: number };
export function buildPortfolioAnalytics(args: Record<string, unknown>): {
  positions: Array<Record<string, unknown>>;
  tradeHistory: Array<Record<string, unknown>>;
  balanceHistory: Array<Record<string, unknown>>;
  stats: Record<string, number | null>;
};
