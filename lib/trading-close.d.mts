type LiveEvent = { kickoff?: string; race_start?: string; [key: string]: unknown } | null | undefined;
export function tradingClosesAt(market: { closes_at?: string | null; live_event?: LiveEvent }): string | null;
export type TradingPhase = "open" | "live" | "closed";
export function tradingPhase(market: { status?: string | null; closesAt?: string | null; hasStart?: boolean }, now?: number): TradingPhase;
export function marketTradingPhase(market: { status?: string | null; closes_at?: string | null; live_event?: LiveEvent }, now?: number): TradingPhase;
