import { fmtNum } from "@/lib/format";
import { leagueDays, potSplit, privateBonusPct, type LeagueSummary } from "@/lib/tregu-leagues";
import "./leagues.css";

type PoolLeague = Pick<LeagueSummary, "kind" | "prizes" | "pot" | "members" | "starts_at" | "ends_at">;

/** Where a league's prizes come from, and what each place takes. */
export function prizePool(league: PoolLeague) {
  const fees = Number(league.pot) || 0;
  if (league.kind === "public") {
    const fixed = [0, 1, 2].map((index) => Number(league.prizes?.[index] ?? 0));
    const share = potSplit(fees, 3);
    const places = fixed.map((prize, index) => prize + (share[index] ?? 0));
    const from383 = fixed.reduce((sum, value) => sum + value, 0);
    return { total: from383 + fees, fees, from383, bonusPct: null as number | null, places };
  }
  const bonusPct = privateBonusPct(leagueDays(league));
  const from383 = Math.floor((fees * bonusPct) / 100);
  const total = fees + from383;
  // Shown as if three members score; with fewer, the split renormalises.
  const places = potSplit(total, 3);
  return { total, fees, from383, bonusPct, places: [0, 1, 2].map((index) => places[index] ?? 0) };
}

const MEDAL = ["1", "2", "3"];

/**
 * The prize pool, stated plainly: the total, then 1st/2nd/3rd, then where the
 * money comes from. `card` is the compact edition inside a league tile.
 */
export default function PrizePool({ league, variant = "hero" }: { league: PoolLeague; variant?: "hero" | "card" }) {
  const pool = prizePool(league);
  return (
    <div className="pool" data-variant={variant}>
      <div className="pool-total">
        <small>Fondi i çmimeve</small>
        <strong>{fmtNum(pool.total)}<em>383C</em></strong>
      </div>
      <ol className="pool-places" aria-label="Çfarë merr secili vend">
        {pool.places.map((prize, index) => (
          <li key={index} data-place={index + 1}>
            <span aria-hidden>{MEDAL[index]}</span>
            <b>{fmtNum(prize)}</b>
            <small>{index === 0 ? "i pari" : index === 1 ? "i dyti" : "i treti"}</small>
          </li>
        ))}
      </ol>
      <p className="pool-source">
        {league.kind === "public"
          ? <>383 jep <b>{fmtNum(pool.from383)}</b>{pool.fees ? <> + hyrjet <b>{fmtNum(pool.fees)}</b></> : <> · hyrjet shtohen sa hyn dikush</>}</>
          : pool.fees
            ? <>Hyrjet <b>{fmtNum(pool.fees)}</b> + 383 shton <b>{fmtNum(pool.from383)}</b> ({pool.bonusPct}%)</>
            : <>Rritet me çdo hyrje · 383 shton {pool.bonusPct}%</>}
      </p>
    </div>
  );
}
