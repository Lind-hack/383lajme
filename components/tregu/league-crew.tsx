"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Flame, Image as ImageIcon, Share2, Swords } from "lucide-react";
import DuelChallenge from "@/components/tregu/duel-challenge";
import LeagueEmblem from "@/components/tregu/league-emblem";
import LeagueRace from "@/components/tregu/league-race";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { leagueColor, leagueShareUrl, type LeagueStanding, type LeagueSummary, type RacePoint } from "@/lib/tregu-leagues";

const signed = (value: number) => `${value > 0 ? "+" : ""}${fmtNum(Math.round(value))}`;
const tone = (value: number) => (value > 0 ? "up" : value < 0 ? "down" : undefined);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Your private league, on the floor, right under the stadium card. Built to
 * be read in two seconds and answered in one tap: the race shows who is
 * pulling away, the table shows who moved today, the rival panel says the
 * exact number that gets you past the friend above you, and every friend has
 * a Sfido button.
 */
export default function LeagueCrew({ leagues, balance }: { leagues: LeagueSummary[]; balance: number | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [activeId, setActiveId] = useState(leagues[0]?.id);
  const [rows, setRows] = useState<LeagueStanding[]>([]);
  const [race, setRace] = useState<RacePoint[]>([]);
  const [challenge, setChallenge] = useState<LeagueStanding | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const league = leagues.find((item) => item.id === activeId) ?? leagues[0];

  const load = useCallback(async () => {
    if (!league) return;
    const [{ data: standings }, { data: racePoints }] = await Promise.all([
      supabase.rpc("tregu_league_standings", { p_league_id: league.id }),
      supabase.rpc("tregu_league_race", { p_league_id: league.id }),
    ]);
    setRows((standings ?? []) as LeagueStanding[]);
    setRace((racePoints ?? []) as RacePoint[]);
  }, [league, supabase]);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(), 60_000);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const onBalance = () => void load();
    window.addEventListener("tregu:balance", onBalance);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
      window.removeEventListener("tregu:balance", onBalance);
    };
  }, [load]);

  if (!league) return null;

  const me = rows.find((row) => row.is_me);
  const above = me ? rows.find((row) => row.rank === me.rank - 1) : undefined;
  const below = me ? rows.find((row) => row.rank === me.rank + 1) : undefined;
  const todayBest = [...rows].sort((a, b) => Number(b.today_profit ?? 0) - Number(a.today_profit ?? 0))[0];
  const shown = rows.slice(0, 6);
  if (me && me.rank > 6) shown.push(me);

  const invite = async () => {
    if (!league.code) return;
    const url = leagueShareUrl(league.code);
    const text = `Hyr në ligën "${league.name}" në 383 Tregu. Kodi: ${league.code}`;
    if (typeof navigator.share === "function") await navigator.share({ title: league.name, text, url }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  };

  const shareTable = async () => {
    const imageUrl = `/api/tregu/league-card/${league.id}`;
    try {
      const blob = await fetch(imageUrl).then((response) => (response.ok ? response.blob() : Promise.reject()));
      const file = new File([blob], "383-liga.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: league.name });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "383-liga.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch {
      window.open(imageUrl, "_blank", "noopener");
    }
  };

  return (
    <section className="crew" aria-label={`Liga ${league.name}`} style={{ "--lg-color": leagueColor(league) } as CSSProperties}>
      {leagues.length > 1 && (
        <div className="crew-tabs" role="group" aria-label="Ligat e tua private">
          {leagues.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === league.id} onClick={() => setActiveId(item.id)}>
              <LeagueEmblem league={item} size={20} /> {item.name}
            </button>
          ))}
        </div>
      )}

      <header className="crew-head">
        <LeagueEmblem league={league} size={48} />
        <div className="crew-titles">
          <h3>{league.name}</h3>
          <p>
            {league.members} {league.members === 1 ? "anëtar" : "anëtarë"} · poti <b>{fmtNum(league.pot)} 383C</b> · {untilLabel(Date.parse(league.ends_at), now)} mbetur
          </p>
        </div>
        {me && (
          <div className="crew-me">
            <small>Vendi yt</small>
            <strong>#{me.rank}<em>/{rows.length}</em></strong>
          </div>
        )}
      </header>

      {race.length > 0 && rows.length > 1 && (
        <div className="crew-race">
          <LeagueRace points={race} />
        </div>
      )}

      <div className="crew-grid">
        <ol className="crew-table">
          {shown.map((row) => (
            <li key={row.member_key ?? row.rank} className="crew-row" data-me={row.is_me || undefined} data-place={row.rank}>
              <span className="crew-rank">{row.rank}</span>
              <span className="crew-move" data-tone={tone(Number(row.rank_change ?? 0))} aria-label={row.rank_change ? `${row.rank_change > 0 ? "u ngjit" : "ra"} ${Math.abs(row.rank_change)} sot` : undefined}>
                {Number(row.rank_change) > 0 ? <ArrowUp size={13} aria-hidden /> : Number(row.rank_change) < 0 ? <ArrowDown size={13} aria-hidden /> : null}
              </span>
              <span className="crew-name">
                <b>{row.display_name}</b>
                {row.is_me && <span className="crew-you">TI</span>}
                {Number(row.streak) >= 2 && <i title={`${row.streak} ditë radhazi`}><Flame size={12} aria-hidden />{row.streak}</i>}
                {Number(row.duel_wins) > 0 && <i className="crew-duels" title={`${row.duel_wins} duele fituar`}><Swords size={12} aria-hidden />{row.duel_wins}</i>}
              </span>
              <span className="crew-today" data-tone={tone(Number(row.today_profit ?? 0))}>
                {Number(row.today_profit ?? 0) !== 0 ? `sot ${signed(Number(row.today_profit))}` : ""}
              </span>
              <span className="crew-profit" data-tone={tone(row.profit)}>{signed(row.profit)}</span>
              {!row.is_me && row.member_key ? (
                <button type="button" className="crew-duel-btn" onClick={() => setChallenge(row)} aria-label={`Sfido ${row.display_name}`}>
                  <Swords size={14} aria-hidden /> <span>Sfido</span>
                </button>
              ) : <span />}
            </li>
          ))}
          {rows.length === 1 && (
            <li className="crew-row crew-row-empty"><span className="crew-rank">2</span><span /><span className="crew-name"><b>Fto një mik — gara nis kur jeni dy</b></span><span /><span /><span /></li>
          )}
        </ol>

        <div className="crew-side">
          <div className="crew-tile" data-tone="rival">
            <small>{me?.rank === 1 ? "Je i pari" : "Për të kaluar"}</small>
            {me && above ? (
              <>
                <strong><span className="crew-big">{fmtNum(Math.max(0, above.profit - me.profit) + 1)}</span> 383C</strong>
                <span>fitim i mbyllur të kalon {firstName(above.display_name)}.</span>
                {above.member_key && (
                  <button type="button" className="crew-tile-btn" onClick={() => setChallenge(above)}><Swords size={14} aria-hidden /> Sfido {firstName(above.display_name)}</button>
                )}
              </>
            ) : me && below ? (
              <>
                <strong><span className="crew-big">{fmtNum(Math.max(0, me.profit - below.profit))}</span> 383C para</strong>
                <span>{firstName(below.display_name)} është pas teje. Mos e lër të afrohet.</span>
              </>
            ) : (
              <>
                <strong>Ende pa rival</strong>
                <span>Dërgo kodin dhe nis garën.</span>
              </>
            )}
          </div>
          <div className="crew-tile">
            <small>Fituesi i sotëm</small>
            {todayBest && Number(todayBest.today_profit ?? 0) > 0 ? (
              <strong>{firstName(todayBest.display_name)} <em data-tone="up">{signed(Number(todayBest.today_profit))}</em></strong>
            ) : (
              <strong>Askush ende</strong>
            )}
            <span>Mbyllet në mesnatë.</span>
          </div>
          <div className="crew-tile">
            <small>Seria jote</small>
            <strong><Flame size={16} aria-hidden className="crew-flame" /> {me?.streak ?? 0} ditë</strong>
            <span>Një tregti në ditë e mban gjallë.</span>
          </div>
        </div>
      </div>

      <div className="crew-actions">
        {league.code && (
          <button type="button" className="crew-primary" onClick={() => void invite()}>
            <Share2 size={15} aria-hidden /> Fto miqtë · {league.code}
          </button>
        )}
        <button type="button" onClick={() => void shareTable()}>
          <ImageIcon size={15} aria-hidden /> Shpërndaj tabelën
        </button>
        <Link href={`/tregu/ligat/${league.id}`}>
          Renditja e plotë <ArrowRight size={14} aria-hidden />
        </Link>
      </div>

      {challenge?.member_key && (
        <DuelChallenge
          leagueId={league.id}
          memberKey={challenge.member_key}
          rival={firstName(challenge.display_name)}
          balance={balance}
          onClose={() => setChallenge(null)}
          onDone={() => void load()}
        />
      )}
    </section>
  );
}
