export const ANONYMOUS_NAME = "Anonim";

export function publicProfileName(profile, fallback = "Tregtar") {
  if (profile?.is_anonymous === true) return ANONYMOUS_NAME;
  const name = String(profile?.display_name ?? "").trim();
  return name || fallback;
}

export function cleanDisplayName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 48);
}

export function normalizeBookmarkIds(value, limit = 200) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))].slice(0, limit);
}

export function buildBalanceHistory(transactions, currentCoins, nowMs = Date.now(), days = 30) {
  const ledger = [...(transactions ?? [])]
    .map((tx) => ({ t: new Date(tx.created_at).getTime(), amount: Number(tx.amount) }))
    .filter((entry) => Number.isFinite(entry.t) && Number.isFinite(entry.amount))
    .sort((a, b) => a.t - b.t);
  const windowStart = nowMs - days * 86_400_000;
  const current = Number(currentCoins) || 0;
  let running = current - ledger.reduce((sum, entry) => sum + entry.amount, 0);
  const history = [];
  for (const entry of ledger) {
    running += entry.amount;
    if (entry.t >= windowStart) history.push({ t: entry.t, coins: running });
  }
  const inWindowDelta = ledger
    .filter((entry) => entry.t >= windowStart)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const startBalance = current - inWindowDelta;
  if (history.length === 0 || history[0].t > windowStart) {
    history.unshift({ t: windowStart, coins: startBalance });
  }
  history.push({ t: nowMs, coins: current });
  return history;
}
