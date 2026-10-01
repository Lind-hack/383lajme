/**
 * When a market stops taking trades. A match or race stops at its start
 * (migration 0090 enforces it in the database); its closes_at is later
 * because settlement waits for the result. Everything else closes at
 * closes_at.
 *
 * @param {{ closes_at?: string | null, live_event?: { kickoff?: string, race_start?: string } | null }} market
 * @returns {string | null}
 */
export function tradingClosesAt(market) {
  const start = Date.parse(String(market?.live_event?.kickoff ?? market?.live_event?.race_start ?? ""));
  const closes = market?.closes_at ?? null;
  if (Number.isFinite(start) && (!closes || start < Date.parse(closes))) return new Date(start).toISOString();
  return closes;
}

/**
 * Where a market stands for a player, from its trading close and status:
 *   "open"   - takes trades
 *   "live"   - a match or race has started: trading is closed, positions wait
 *              for the result (the database refuses trades from kickoff, 0090)
 *   "closed" - past its deadline or settled
 *
 * @param {{ status?: string | null, closesAt?: string | null, hasStart?: boolean }} market
 *   closesAt is the *trading* close (tradingClosesAt), hasStart whether that
 *   close is a match/race start rather than a news deadline.
 * @param {number} [now]
 * @returns {"open" | "live" | "closed"}
 */
export function tradingPhase(market, now = Date.now()) {
  if (market?.status && market.status !== "open") return "closed";
  const close = Date.parse(String(market?.closesAt ?? ""));
  if (!Number.isFinite(close) || close > now) return "open";
  return market?.hasStart ? "live" : "closed";
}

/**
 * tradingPhase for a market row straight from the API (closes_at + live_event).
 * @param {{ status?: string | null, closes_at?: string | null, live_event?: { kickoff?: string, race_start?: string } | null }} market
 * @param {number} [now]
 */
export function marketTradingPhase(market, now = Date.now()) {
  const hasStart = Number.isFinite(Date.parse(String(market?.live_event?.kickoff ?? market?.live_event?.race_start ?? "")));
  return tradingPhase({ status: market?.status ?? null, closesAt: tradingClosesAt(market), hasStart }, now);
}
