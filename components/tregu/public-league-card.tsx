import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import LeagueEmblem from "@/components/tregu/league-emblem";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { leagueColor, leaguePhase, leaguePrizes, leaguePurse, scopeOf, type LeagueSummary } from "@/lib/tregu-leagues";
import "./leagues.css";

export type PublicCardLeague = Pick<
  LeagueSummary,
  "id" | "name" | "kind" | "starts_at" | "ends_at" | "entry_fee" | "prizes" | "pot" | "members" | "settled" |
  "emblem" | "color" | "scope_kind" | "scope_value" | "sponsor"
>;

/**
 * A public league on the floor: the paper at full strength, the league's
 * colour around its emblem, and the purse as the headline. `href` is left out
 * in the admin preview, where there is no page to open yet.
 */
export default function PublicLeagueCard({
  league,
  now,
  action,
  href,
}: {
  league: PublicCardLeague;
  now: number;
  action?: ReactNode;
  href?: string;
}) {
  const phase = leaguePhase(league, now);
  const prizes = leaguePrizes(league);
  const scope = scopeOf(league);
  return (
    <article className="lgp lg-paper" data-public style={{ "--lg-color": leagueColor(league) } as CSSProperties}>
      <div className="lgp-top">
        <LeagueEmblem league={league} size={48} />
        <span className="lgp-clock">
          {phase === "live" && <i aria-hidden />}
          {phase === "ended"
            ? "Përfundoi"
            : phase === "upcoming"
              ? `Nis për ${untilLabel(Date.parse(league.starts_at), now)}`
              : `${untilLabel(Date.parse(league.ends_at), now)} mbetur`}
        </span>
      </div>
      <div>
        {href ? <Link href={href} className="lgp-name">{league.name}</Link> : <strong className="lgp-name">{league.name}</strong>}
        <span className="lgp-theme"><i aria-hidden /> {scope.label}{league.sponsor ? ` · ${league.sponsor}` : ""}</span>
      </div>
      <div className="lgp-purse">
        <strong>{fmtNum(leaguePurse(league))}<small>383C</small></strong>
        <span>
          {prizes.length ? prizes.map((prize) => fmtNum(prize)).join(" · ") : "Shpërblimet sipas pikëve"} · {fmtNum(league.members)} brenda
        </span>
      </div>
      {action}
    </article>
  );
}
