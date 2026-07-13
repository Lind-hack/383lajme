// Deterministic number formatting for 383 Coin amounts.
// Intl grouping for "sq-AL" differs between Node and browser ICU builds
// ("12,450" vs "12 450"), which breaks React hydration on any SSR'd client
// component — so group manually with non-breaking spaces instead.
export function fmtNum(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? "-" : "";
  return sign + Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
