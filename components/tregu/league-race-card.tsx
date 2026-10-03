import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import LeagueEmblem from "@/components/tregu/league-emblem";
import { fmtNum } from "@/lib/format";
import { podiumLine, stripStatus } from "@/lib/tregu-leagues-hub.mjs";
import { leagueColor, leaguePurse, type HubLeague } from "@/lib/tregu-leagues";

const MEDALS = ["🥇", "🥈", "🥉"];

function kindLabel(league: HubLeague): string {
  if (league.kind === "public") return "Zyrtare";
  return league.listed ? "Publike" : "Private";
}

function timeLeft(league: HubLeague, now: number): string {
  const starts = Date.parse(league.starts_at);
  const ends = Date.parse(league.ends_at);
  const target = starts > now ? starts : ends;
  const hours = Math.max(0, (target - now) / 3_600_000);
  const text = hours >= 48 ? `${Math.floor(hours / 24)} ditë` : hours >= 1 ? `${Math.floor(hours)} orë` : `${Math.max(1, Math.round(hours * 60))} min`;
  return starts > now ? `nis për ${text}` : text;
}

/**
 * One league as a slim strip: emblem, name and meta, who leads, where the
 * reader stands, what to do today, one action. The whole strip opens the
 * league; `action` (join) sits above that link. A strip with picks to make
 * gets an orange edge.
 */
export default function LeagueRaceCard({ league, now, action }: { league: HubLeague; now: number; action?: ReactNode }) {
  const status = stripStatus(league, now);
  const me = podiumLine(league);
  const top3 = league.top3 ?? [];
  const href = `/tregu/ligat/${league.id}`;

  return (
    <article
      className="lgr"
      data-public={league.kind === "public" || undefined}
      data-tone={status.tone}
      style={{ "--lg-color": leagueColor(league) } as CSSProperties}
    >
      <Link href={href} className="lgr-hit" aria-label={`Hap ${league.name}`} />

      <LeagueEmblem league={league} size={38} />

      <div className="lgr-main">
        <b>{league.name}</b>
        {/* Today's status leads the small line; the meta trails and truncates. */}
        <small title={status.label}>
          <span className="lgr-status" data-tone={status.tone}>
            {status.tone === "due" && <i aria-hidden />}
            {status.short}
          </span>
          {" · "}<span className="lgr-kind" data-kind={kindLabel(league)}>{kindLabel(league)}</span>
          {" · "}{fmtNum(league.members)} · {timeLeft(league, now)} · {fmtNum(leaguePurse(league))} 383C
        </small>
      </div>

      {/* Second row: your place, then who leads. */}
      <div className="lgr-line">
        {me ? (
          <p className="lgr-me" title={me.note}>
            {me.rank ? (
              <>
                <strong>#{me.rank}</strong>
                {me.change !== 0 && (
                  <span className="lgr-move" data-up={me.change > 0 || undefined} aria-label={me.change > 0 ? `${me.change} vende lart sot` : `${-me.change} vende poshtë sot`}>
                    {me.change > 0 ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
                    {Math.abs(me.change)}
                  </span>
                )}
                <small>{fmtNum(me.points)} pikë</small>
              </>
            ) : (
              <small>{me.note}</small>
            )}
          </p>
        ) : null}

        <p className="lgr-race">
          {top3.length > 0 ? (
            top3.map((row) => (
              <span key={row.rank} className="lgr-seat" data-me={row.me || undefined} data-rank={row.rank}>
                <i aria-hidden>{MEDALS[row.rank - 1]}</i>
                {row.me ? "Ti" : row.name} <em>{fmtNum(row.points)}</em>
              </span>
            ))
          ) : (
            <span className="lgr-seat">Ende pa pikë</span>
          )}
          {league.day_king && <span className="lgr-king" title="Fitues i ditës">👑 {league.day_king}</span>}
        </p>
      </div>

      <div className="lgr-act-wrap">
        {action ?? (
          <Link href={href} className={status.tone === "due" ? "lg-btn lgr-act" : "lg-ghost lgr-act"}>
            {status.tone === "due" ? "Parashiko" : "Hap"} <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>
    </article>
  );
}
