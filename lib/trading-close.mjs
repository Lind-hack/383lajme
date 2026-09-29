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
