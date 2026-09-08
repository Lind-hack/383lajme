/** LMSR cash-out including price impact; the server executes under a market lock. */
export function cashOutCoins(price, liquidity, shares) {
  if (![price, liquidity, shares].every(Number.isFinite) || price <= 0 || price >= 1 || liquidity <= 0 || shares < 0) return 0;
  return -liquidity * Math.log1p(price * Math.expm1(-shares / liquidity));
}

export function sharesForCoins(price, liquidity, coins, heldShares) {
  if (!Number.isFinite(coins) || coins <= 0) return 0;
  const maximum = cashOutCoins(price, liquidity, heldShares);
  if (coins >= maximum) return heldShares;
  return Math.min(heldShares, -liquidity * Math.log1p(Math.expm1(-coins / liquidity) / price));
}
