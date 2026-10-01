/**
 * A match or race has started: the market is still on the floor (the chart
 * keeps moving with the game) but it no longer takes trades. The database
 * refuses them from kickoff (migration 0090); this is the same fact, shown.
 */
export default function LiveLockBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="tregu-live-lock" title="Ndeshja ka filluar: tregtimi u mbyll. Pozicionet paguhen pas rezultatit.">
      <i aria-hidden />
      {compact ? "LIVE" : "LIVE · Tregtimi u mbyll"}
    </span>
  );
}
