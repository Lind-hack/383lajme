/**
 * A 100-coin buy stays below 1.5 percentage points for fresh books with
 * 2, 3, or 22 outcomes. The database migration rescales existing quantities
 * by the same ratio, so raising liquidity does not reprice open positions.
 */
export const DEFAULT_SPORT_LIQUIDITY = 6_500;

export function rescaleOutcomeQuantities(quantities = {}, fromLiquidity, toLiquidity = DEFAULT_SPORT_LIQUIDITY) {
  const from = Number(fromLiquidity);
  const to = Number(toLiquidity);
  if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(to) || to <= 0) {
    throw new Error("Sport liquidity must be positive.");
  }
  const ratio = to / from;
  return Object.fromEntries(
    Object.entries(quantities).map(([key, value]) => [key, Number(value) * ratio])
  );
}
