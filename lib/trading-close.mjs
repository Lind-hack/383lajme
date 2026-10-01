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

function startOf(market) {
  return Date.parse(String(market?.live_event?.kickoff ?? market?.live_event?.race_start ?? ""));
}

/**
 * What a card says about its trading close. A match or race says it closes at
 * the start, so the countdown is never read as a news deadline:
 *   "Mbyllet kur nis ndeshja · për 3 orë" / compact "Mbyllet në fillim · 3h"
 *   "Mbyllet për 3 ditë"                  / compact "Mbyllet 3d"
 *
 * @param {{ closesAt?: string | null, startsAt?: string | null, race?: boolean }} market
 *   closesAt is the *trading* close (tradingClosesAt); startsAt the match/race start.
 * @param {{ compact?: boolean, now?: number }} [options]
 * @returns {string | null} null without a close, "Mbyllur" once past it
 */
export function tradingCloseLabel(market, { compact = false, now = Date.now() } = {}) {
  const close = Date.parse(String(market?.closesAt ?? ""));
  if (!Number.isFinite(close)) return null;
  const ms = close - now;
  if (ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor(ms / 3_600_000);
  // Under a day the minutes count: a kickoff 1h 47m away must not read "1h".
  const minutes = Math.floor(ms / 60_000) % 60;
  const left = compact
    ? days >= 1 ? `${days}d` : hours >= 1 ? (minutes ? `${hours}h ${minutes}m` : `${hours}h`) : `${Math.max(1, minutes)}m`
    : days >= 1 ? `${days} ditë` : hours >= 1 ? (minutes ? `${hours} orë ${minutes} min` : `${hours} orë`) : `${Math.max(1, minutes)} min`;
  const start = Date.parse(String(market?.startsAt ?? ""));
  const atStart = Number.isFinite(start) && Math.abs(start - close) < 60_000;
  if (!atStart) return compact ? `Mbyllet ${left}` : `Mbyllet për ${left}`;
  if (compact) return `Mbyllet në fillim · ${left}`;
  return `Mbyllet kur nis ${market?.race ? "gara" : "ndeshja"} · për ${left}`;
}

/**
 * tradingCloseLabel for a market row straight from the API (closes_at + live_event).
 * @param {{ closes_at?: string | null, live_event?: { kickoff?: string, race_start?: string, league?: string } | null }} market
 * @param {{ compact?: boolean, now?: number }} [options]
 */
export function marketCloseLabel(market, options) {
  const start = startOf(market);
  return tradingCloseLabel({
    closesAt: tradingClosesAt(market),
    startsAt: Number.isFinite(start) ? new Date(start).toISOString() : null,
    race: Boolean(market?.live_event?.race_start) || market?.live_event?.league === "f1",
  }, options);
}

/**
 * Whether the trading close is the match/race start rather than a deadline.
 * @param {{ closes_at?: string | null, live_event?: { kickoff?: string, race_start?: string } | null }} market
 */
export function closesAtStart(market) {
  const start = startOf(market);
  const close = Date.parse(String(tradingClosesAt(market) ?? ""));
  return Number.isFinite(start) && Math.abs(start - close) < 60_000;
}
