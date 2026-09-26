interface PickableMarket {
  slug: string;
  category: string;
  status?: string;
  closes_at?: string;
  market_type?: string;
  live_event?: { league?: string } | null;
}

export declare const SPECIAL_LEAGUES: ReadonlySet<string>;
export declare function marketLeague(row: PickableMarket): string | null;
export declare function isSpecialMarket(row: PickableMarket): boolean;

export declare function kosovoDateKey(now?: Date): string;
export declare function pickDailyMarkets<T extends PickableMarket>(
  rows: readonly T[],
  options: { dateKey: string; count?: number; now?: number; perCategory?: number }
): T[];
