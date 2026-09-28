"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Flame, Medal, Trophy, Users } from "lucide-react";
import Navbar from "@/components/navbar";
import LeagueEmblem from "@/components/tregu/league-emblem";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import LeaguesCard from "@/components/tregu/leagues-card";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  leagueColor,
  leagueError,
  leaguePhase,
  leaguePurse,
  scopeOf,
  type LeagueSummary,
} from "@/lib/tregu-leagues";
import styles from "./ligat.module.css";

type Stats = { active: number; best_rank: number | null; podiums: number; winnings: number; streak: number };

function Faces({ names, total }: { names: string[]; total: number }) {
  if (!total) return <span className={styles.facesEmpty}>Bëhu i pari</span>;
  return (
    <span className={styles.faces} aria-label={`${total} tregtarë`}>
      {names.slice(0, 4).map((name, index) => (
        <b key={`${name}-${index}`} style={{ "--i": index } as CSSProperties}>{name.slice(0, 1).toUpperCase()}</b>
      ))}
      <em>{fmtNum(total)} brenda</em>
    </span>
  );
}

/**
 * Ligat. The first screen is the offer: your record if you have one, the
 * one-tap card, and every open public league as a tile you join without
 * leaving the page. Your own leagues follow, each showing where you stand.
 */
export default function LigatPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loggedIn, setLoggedIn] = useState(false);
  const [leagues, setLeagues] = useState<LeagueSummary[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payment, setPayment] = useState<LeaguePayment | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [{ data: overview }, { data: mine }] = await Promise.all([
      supabase.rpc("tregu_leagues_overview"),
      supabase.rpc("tregu_my_league_stats"),
    ]);
    setLeagues((overview ?? []) as LeagueSummary[]);
    const row = (mine as Stats[] | null)?.[0];
    if (row) setStats(row);
  }, [supabase]);

  useEffect(() => {
    void load();
    supabase.auth.getUser().then(({ data: { user } }) => setLoggedIn(Boolean(user)));
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, [load, supabase]);

  const join = async (league: LeagueSummary) => {
    if (!loggedIn) {
      window.location.href = `/hyr?next=${encodeURIComponent("/tregu/ligat")}`;
      return;
    }
    primeSellSound();
    setBusy(league.id);
    setNotice(null);
    const { data, error } = await supabase.rpc("tregu_league_join", { p_league_id: league.id });
    setBusy(null);
    if (error) {
      setNotice({ ok: false, text: leagueError(error) });
      return;
    }
    const balance = Number((data as { balance: number }[] | null)?.[0]?.balance);
    if (Number.isFinite(balance)) window.dispatchEvent(new CustomEvent("tregu:balance", { detail: balance }));
    setPayingId(league.id);
    setPayment({ amount: Number(league.entry_fee) || 0, pot: (Number(league.pot) || 0) + (Number(league.entry_fee) || 0), league: league.name, kind: "join" });
    void load();
  };

  const all = leagues ?? [];
  const publics = all
    .filter((league) => league.kind === "public" && leaguePhase(league, now) !== "ended")
    .sort((a, b) => Number(a.is_member) - Number(b.is_member) || leaguePurse(b) - leaguePurse(a));
  const mine = all.filter((league) => league.is_member).sort((a, b) => Number(a.settled) - Number(b.settled) || Date.parse(a.ends_at) - Date.parse(b.ends_at));
  const totalPurse = publics.reduce((sum, league) => sum + leaguePurse(league), 0);
  const totalPlayers = publics.reduce((sum, league) => sum + league.members, 0);

  return (
    <div className="tregu-scope">
      <Navbar />
      <main className={styles.page}>
        <Link href="/tregu" className={styles.back}><span aria-hidden>&#8592;</span> Tregu</Link>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1>Ligat</h1>
            <p>Garo me miqtë e tu ose me gjithë Kosovën. Fitimi nga tregtitë e mbyllura vendos kampionin — tre të parët marrin potin.</p>
            <div className={styles.heroTotals}>
              <span><strong>{fmtNum(totalPurse)}</strong> 383C në lojë</span>
              <span><strong>{fmtNum(publics.length)}</strong> liga publike</span>
              <span><strong>{fmtNum(totalPlayers)}</strong> hyrje</span>
            </div>
          </div>
          {stats && (
            <dl className={styles.record} aria-label="Rekordi yt">
              <div><dt>Liga aktive</dt><dd>{stats.active}</dd></div>
              <div><dt>Vendi më i mirë</dt><dd>{stats.best_rank ? `#${stats.best_rank}` : "—"}</dd></div>
              <div><dt>Podiume</dt><dd><Medal size={18} aria-hidden /> {stats.podiums}</dd></div>
              <div><dt>Fituar nga ligat</dt><dd>{fmtNum(Number(stats.winnings) || 0)}</dd></div>
              <div><dt>Seria</dt><dd><Flame size={18} aria-hidden /> {stats.streak} ditë</dd></div>
            </dl>
          )}
        </header>

        {notice && <p className={styles.notice} data-ok={notice.ok || undefined} role="status">{notice.text}</p>}

        <LeaguesCard loggedIn={loggedIn} variant="page" />

        <section className={styles.section} aria-labelledby="public-title">
          <div className={styles.sectionHead}>
            <h2 id="public-title">Ligat publike</h2>
            <p>Hyrja 10 383C · 383 shton shpërblimin · një prekje</p>
          </div>
          {leagues === null ? (
            <div className={styles.grid}>{[0, 1, 2].map((key) => <i key={key} className={styles.skeleton} />)}</div>
          ) : publics.length ? (
            <div className={styles.grid}>
              {publics.map((league) => {
                const phase = leaguePhase(league, now);
                return (
                  <article
                    key={league.id}
                    className={styles.tile}
                    style={{ "--lg-color": leagueColor(league), "--cover": league.cover_url ? `url(${league.cover_url})` : "none" } as CSSProperties}
                  >
                    {payingId === league.id && (
                      <LeaguePay payment={payment} onDone={() => { setPayment(null); setPayingId(null); setNotice({ ok: true, text: `U futët në "${league.name}". Tregtitë që mbyll tani numërohen.` }); }} />
                    )}
                    <div className={styles.tileCover}>
                      <span className={styles.theme}>{scopeOf(league).label}</span>
                      <span className={styles.clock}>
                        {phase === "upcoming" ? `Fillon për ${untilLabel(Date.parse(league.starts_at), now)}` : `${untilLabel(Date.parse(league.ends_at), now)} mbetur`}
                      </span>
                    </div>
                    <div className={styles.tileBody}>
                      <div className={styles.tileTitle}>
                        <LeagueEmblem league={league} size={54} />
                        <div>
                          <h3><Link href={`/tregu/ligat/${league.id}`}>{league.name}</Link></h3>
                          {league.sponsor ? <p className={styles.sponsor}>{league.sponsor}</p> : league.description ? <p>{league.description}</p> : null}
                        </div>
                      </div>
                      <div className={styles.tileStats}>
                        <div>
                          <small>Në lojë</small>
                          <strong>{fmtNum(leaguePurse(league))} <em>383C</em></strong>
                        </div>
                        <Faces names={league.faces ?? []} total={league.members} />
                      </div>
                      {league.is_member ? (
                        <Link className={styles.inButton} href={`/tregu/ligat/${league.id}`}>
                          {league.my_rank ? <>Je <b>#{league.my_rank}</b> · shiko renditjen</> : "Je brenda · shiko renditjen"} <ArrowRight size={15} aria-hidden />
                        </Link>
                      ) : (
                        <button type="button" className={styles.joinButton} onClick={() => void join(league)} disabled={busy === league.id}>
                          {busy === league.id ? "Duke hyrë…" : <>Hyr me një prekje · {fmtNum(league.entry_fee)} 383C</>}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}><Trophy size={20} aria-hidden /><p>Asnjë ligë publike e hapur tani. Krijo një me miqtë — zgjat një prekje.</p></div>
          )}
        </section>

        {mine.length > 0 && (
          <section className={styles.section} aria-labelledby="mine-title">
            <div className={styles.sectionHead}>
              <h2 id="mine-title">Ligat e mia</h2>
              <p>{mine.filter((league) => !league.settled).length} aktive</p>
            </div>
            <div className={styles.mineList}>
              {mine.map((league) => {
                const phase = leaguePhase(league, now);
                return (
                  <Link key={league.id} href={`/tregu/ligat/${league.id}`} className={styles.mineRow} style={{ "--lg-color": leagueColor(league) } as CSSProperties} data-ended={phase === "ended" || undefined}>
                    <LeagueEmblem league={league} size={42} />
                    <span className={styles.mineName}>
                      <b>{league.name}</b>
                      <small>{league.kind === "private" ? "Private" : scopeOf(league).label} · {phase === "ended" ? "përfundoi" : `${untilLabel(Date.parse(league.ends_at), now)} mbetur`}</small>
                    </span>
                    <span className={styles.mineRank}>
                      <b>{league.my_rank ? `#${league.my_rank}` : "—"}</b>
                      <small>nga {league.members}</small>
                    </span>
                    <span className={styles.mineProfit} data-tone={Number(league.my_profit) > 0 ? "up" : Number(league.my_profit) < 0 ? "down" : undefined}>
                      {Number(league.my_profit) > 0 ? "+" : ""}{fmtNum(Number(league.my_profit) || 0)}
                    </span>
                    <span className={styles.minePurse}>{fmtNum(leaguePurse(league))} <small>383C</small></span>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className={styles.how} aria-labelledby="how-title">
          <h2 id="how-title">Si funksionon</h2>
          <ol>
            <li><Users size={18} aria-hidden /><b>Hyr ose krijo</b><span>Ligat publike kushtojnë 10 383C. Ligën tënde e krijon me një prekje dhe cakton hyrjen nga 10 deri në 10 000.</span></li>
            <li><Flame size={18} aria-hidden /><b>Tregto çdo ditë</b><span>Numërohet fitimi nga tregtitë që mbyll pasi hyn. Seria rritet çdo ditë që tregton.</span></li>
            <li><Trophy size={18} aria-hidden /><b>Tre të parët fitojnë</b><span>Poti ndahet 50/30/20. Në ligat publike 383 shton shpërblimin e vet mbi pot.</span></li>
          </ol>
        </section>
      </main>
    </div>
  );
}
