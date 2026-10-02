import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Crown } from "lucide-react";
import LeagueEmblem from "@/components/tregu/league-emblem";
import { fmtNum } from "@/lib/format";
import { cardStatus, podiumLine } from "@/lib/tregu-leagues-hub.mjs";
import { leagueColor, leaguePurse, scopeOf, type HubLeague } from "@/lib/tregu-leagues";

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
  return starts > now ? `nis për ${text}` : `${text} mbetur`;
}

/**
 * One league as a wide card: who leads, where the reader stands and what to
 * do today. The whole card opens the league; `action` (join, pick) sits on
 * top of that link.
 */
export default function LeagueRaceCard({ league, now, action }: { league: HubLeague; now: number; action?: ReactNode }) {
  const status = cardStatus(league, now);
  const me = podiumLine(league);
  const top3 = league.top3 ?? [];
  const href = `/tregu/ligat/${league.id}`;
  const theme = league.kind === "public" ? scopeOf(league).label : null;

  return (
    <article
      className="lgr lg-paper"
      data-public={league.kind === "public" || undefined}
      data-tone={status.tone}
      style={{ "--lg-color": leagueColor(league) } as CSSProperties}
    >
      <Link href={href} className="lgr-hit" aria-label={`Hap ${league.name}`} />

      <header className="lgr-top">
        <LeagueEmblem league={league} size={44} />
        <div className="lgr-title">
          <b>{league.name}</b>
          <small>
            <span className="lgr-kind" data-kind={kindLabel(league)}>{kindLabel(league)}</span>
            {theme && theme !== "Të gjitha tregjet" ? ` · ${theme}` : ""} · {fmtNum(league.members)} lojtarë · {timeLeft(league, now)}
          </small>
        </div>
      </header>

      {top3.length > 0 ? (
        <ol className="lgr-podium" aria-label="Tre të parët">
          {top3.map((row) => (
            <li key={row.rank} data-me={row.me || undefined}>
              <span aria-hidden>{MEDALS[row.rank - 1]}</span>
              <b>{row.me ? "Ti" : row.name}</b>
              <em>{fmtNum(row.points)}</em>
            </li>
          ))}
        </ol>
      ) : (
        <p className="lgr-empty">Ende pa pikë. Kush shënon i pari merr kreun.</p>
      )}

      {league.day_king && (
        <p className="lgr-king">
          <Crown size={14} aria-hidden /> <b>{league.day_king}</b> fitues i ditës · +{fmtNum(Number(league.day_king_points) || 0)}
        </p>
      )}

      {me && (
        <p className="lgr-me">
          {me.rank ? (
            <>
              <strong>Ti #{me.rank}</strong>
              {me.change !== 0 && (
                <span className="lgr-move" data-up={me.change > 0 || undefined} aria-label={me.change > 0 ? `${me.change} vende lart sot` : `${-me.change} vende poshtë sot`}>
                  {me.change > 0 ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                  {Math.abs(me.change)}
                </span>
              )}
              <span> · {fmtNum(me.points)} pikë · {me.note}</span>
            </>
          ) : (
            <span>{me.note}</span>
          )}
        </p>
      )}

      <footer className="lgr-foot">
        <span className="lgr-status" data-tone={status.tone}>
          {status.tone === "due" && <i aria-hidden />}
          {status.label}
        </span>
        {action ?? (
          <Link href={href} className={status.tone === "due" ? "lg-btn lgr-act" : "lg-ghost lgr-act"}>
            {status.tone === "due" ? "Parashiko" : "Renditja"} <ArrowRight size={15} aria-hidden />
          </Link>
        )}
      </footer>

      <p className="lgr-purse">
        Në lojë <b>{fmtNum(leaguePurse(league))} 383C</b>
        {Number(league.entry_fee) > 0 ? ` · hyrja ${fmtNum(league.entry_fee)}` : " · falas"}
      </p>
    </article>
  );
}
