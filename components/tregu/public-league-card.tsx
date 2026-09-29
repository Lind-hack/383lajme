import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import LeagueEmblem from "@/components/tregu/league-emblem";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import PrizePool from "@/components/tregu/prize-pool";
import { leagueColor, leaguePhase, scopeOf, type LeagueSummary } from "@/lib/tregu-leagues";
import "./leagues.css";

export type PublicCardLeague = Pick<
  LeagueSummary,
  "id" | "name" | "kind" | "starts_at" | "ends_at" | "entry_fee" | "prizes" | "pot" | "members" | "settled" |
  "emblem" | "color" | "scope_kind" | "scope_value" | "sponsor" | "sponsor_logo" | "sponsor_url"
>;

/** The sponsor, as a band of its own: the business's logo and name, linked. */
export function SponsorBand({ league, variant = "card" }: { league: Pick<LeagueSummary, "sponsor" | "sponsor_logo" | "sponsor_url">; variant?: "card" | "hero" }) {
  if (!league.sponsor && !league.sponsor_logo) return null;
  const name = String(league.sponsor ?? "").replace(/^sponsorizuar nga\s*/i, "").trim();
  const inner = (
    <>
      <small>Sponsorizuar nga</small>
      {league.sponsor_logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={league.sponsor_logo} alt={name || "Sponsori"} loading="lazy" />
      ) : null}
      {name ? <b>{name}</b> : null}
    </>
  );
  return league.sponsor_url ? (
    <a className="sponsor" data-variant={variant} href={league.sponsor_url} target="_blank" rel="sponsored noopener noreferrer">{inner}</a>
  ) : (
    <div className="sponsor" data-variant={variant}>{inner}</div>
  );
}

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
        <span className="lgp-theme"><i aria-hidden /> {scope.label} · {fmtNum(league.members)} brenda</span>
      </div>
      <PrizePool league={league} variant="card" />
      <SponsorBand league={league} />
      {action}
    </article>
  );
}
