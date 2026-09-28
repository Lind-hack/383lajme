"use client";

import Link from "next/link";
import { use as usePromise, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Check, Copy, Flame, Image as ImageIcon, Lock, Share2, Trophy, Users, Zap } from "lucide-react";
import Navbar from "@/components/navbar";
import LeagueEmblem from "@/components/tregu/league-emblem";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  leagueColor,
  leagueError,
  leaguePhase,
  leaguePrizes,
  leaguePurse,
  leagueShareUrl,
  scopeOf,
  type LeagueFeedItem,
  type LeagueStanding,
  type LeagueSummary,
} from "@/lib/tregu-leagues";
import styles from "../ligat.module.css";

const signed = (value: number) => `${value > 0 ? "+" : ""}${fmtNum(Math.round(value))}`;
const tone = (value: number) => (value > 0 ? "up" : value < 0 ? "down" : undefined);
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

function ago(at: string, now: number) {
  const minutes = Math.max(1, Math.round((now - Date.parse(at)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} orë` : `${Math.round(hours / 24)} ditë`;
}

export default function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const supabase = useMemo(() => createClient(), []);
  const [league, setLeague] = useState<LeagueSummary | null | undefined>(undefined);
  const [rules, setRules] = useState<string | null>(null);
  const [rows, setRows] = useState<LeagueStanding[]>([]);
  const [feed, setFeed] = useState<LeagueFeedItem[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loggedIn, setLoggedIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [payment, setPayment] = useState<LeaguePayment | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [overview, preview, standings, events] = await Promise.all([
      supabase.rpc("tregu_leagues_overview"),
      supabase.rpc("tregu_league_preview", { p_league_id: id }),
      supabase.rpc("tregu_league_standings", { p_league_id: id }),
      supabase.rpc("tregu_league_feed", { p_league_id: id }),
    ]);
    const mine = (overview.data as LeagueSummary[] | null)?.find((row) => row.id === id);
    const open = (preview.data as (LeagueSummary & { rules?: string | null })[] | null)?.[0];
    setLeague(mine ? { ...open, ...mine } : open ? { ...open, code: null } : null);
    setRules(open?.rules ?? null);
    setRows((standings.data ?? []) as LeagueStanding[]);
    setFeed((events.data ?? []) as LeagueFeedItem[]);
  }, [id, supabase]);

  useEffect(() => {
    void load();
    supabase.auth.getUser().then(({ data: { user } }) => setLoggedIn(Boolean(user)));
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const refresh = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [load, supabase]);

  if (league === undefined) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <main className={styles.page}><i className={styles.skeleton} style={{ height: 360 }} /></main>
      </div>
    );
  }
  if (league === null) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <main className={`${styles.page} ${styles.missing}`}>
          <Lock size={22} aria-hidden />
          <h1>Kjo ligë është private</h1>
          <p>Vetëm anëtarët e shohin renditjen. Nëse ke kodin, hyr me të.</p>
          <Link className={styles.joinButton} href="/tregu/ligat">Hyr me kod</Link>
        </main>
      </div>
    );
  }

  const phase = leaguePhase(league, now);
  const prizes = leaguePrizes(league);
  const color = leagueColor(league);
  const me = rows.find((row) => row.is_me);
  const above = me ? rows.find((row) => row.rank === me.rank - 1) : undefined;
  const todayBest = [...rows].sort((a, b) => Number(b.today_profit ?? 0) - Number(a.today_profit ?? 0))[0];
  const hottest = [...rows].sort((a, b) => Number(b.streak ?? 0) - Number(a.streak ?? 0))[0];
  const totalTrades = rows.reduce((sum, row) => sum + Number(row.trades ?? 0), 0);
  const podium = [rows[1], rows[0], rows[2]];
  const prizeFor = (row: LeagueStanding) => (league.kind === "private" || row.profit > 0 ? prizes[row.rank - 1] : undefined);

  const join = async () => {
    if (!loggedIn) {
      window.location.href = `/hyr?next=${encodeURIComponent(`/tregu/ligat/${id}`)}`;
      return;
    }
    primeSellSound();
    setJoining(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("tregu_league_join", { p_league_id: id });
    setJoining(false);
    if (error) {
      setMessage({ ok: false, text: leagueError(error) });
      return;
    }
    const balance = Number((data as { balance: number }[] | null)?.[0]?.balance);
    if (Number.isFinite(balance)) window.dispatchEvent(new CustomEvent("tregu:balance", { detail: balance }));
    setPayment({ amount: Number(league.entry_fee) || 0, pot: (Number(league.pot) || 0) + (Number(league.entry_fee) || 0), league: league.name, kind: "join" });
    void load();
  };

  const invite = async () => {
    if (!league.code) return;
    const url = leagueShareUrl(league.code);
    const text = `Hyr në ligën "${league.name}" në 383 Tregu. Kodi: ${league.code}`;
    if (typeof navigator.share === "function") await navigator.share({ title: league.name, text, url }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  };

  const copyCode = async () => {
    if (!league.code) return;
    try {
      await navigator.clipboard.writeText(leagueShareUrl(league.code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage({ ok: false, text: `Kopjimi nuk u lejua. Kodi: ${league.code}` });
    }
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
    <div className="tregu-scope">
      <Navbar />
      <main className={styles.page}>
        <Link href="/tregu/ligat" className={styles.back}><span aria-hidden>&#8592;</span> Të gjitha ligat</Link>

        <header
          className={styles.leagueHero}
          style={{ "--lg-color": color, "--cover": league.cover_url ? `url(${league.cover_url})` : "none" } as CSSProperties}
        >
          <LeaguePay payment={payment} onDone={() => { setPayment(null); setMessage({ ok: true, text: "U fute në ligë. Tregtitë që mbyll tani e tutje numërohen." }); }} />
          <div className={styles.leagueHeroTop}>
            <span className={styles.theme}>{league.kind === "private" ? <><Lock size={12} aria-hidden /> Private</> : scopeOf(league).label}</span>
            <span className={styles.clock} data-phase={phase}>
              {phase === "ended" ? "Përfundoi" : phase === "upcoming" ? `Fillon për ${untilLabel(Date.parse(league.starts_at), now)}` : <><i aria-hidden /> {untilLabel(Date.parse(league.ends_at), now)} mbetur</>}
            </span>
          </div>
          <div className={styles.leagueHeroMain}>
            <LeagueEmblem league={league} size={92} />
            <div>
              <h1>{league.name}</h1>
              {league.sponsor && <p className={styles.sponsor}>{league.sponsor}</p>}
              {league.description && <p>{league.description}</p>}
            </div>
            <div className={styles.heroPurse}>
              <small>Në lojë</small>
              <strong>{fmtNum(leaguePurse(league))}</strong>
              <span>383C · {prizes.length ? prizes.map((prize) => fmtNum(prize)).join(" / ") : "për lavdi"}</span>
            </div>
          </div>
          <div className={styles.heroActions}>
            {!league.is_member && phase !== "ended" && league.kind === "public" && (
              <button type="button" className={styles.joinButton} onClick={() => void join()} disabled={joining}>
                <Zap size={16} aria-hidden /> {joining ? "Duke hyrë…" : `Hyr me një prekje · ${fmtNum(league.entry_fee)} 383C`}
              </button>
            )}
            {league.code && (
              <>
                <button type="button" className={styles.joinButton} onClick={() => void invite()}><Share2 size={16} aria-hidden /> Fto miqtë · {league.code}</button>
                <button type="button" className={styles.ghostDark} onClick={() => void copyCode()}>{copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "U kopjua" : "Kopjo linkun"}</button>
              </>
            )}
            <button type="button" className={styles.ghostDark} onClick={() => void shareTable()}><ImageIcon size={15} aria-hidden /> Shpërndaj renditjen</button>
          </div>
        </header>

        {message && <p className={styles.notice} data-ok={message.ok || undefined} role="status">{message.text}</p>}

        <dl className={styles.statRow}>
          <div><dt>Anëtarë</dt><dd><Users size={16} aria-hidden /> {league.members}<small>/{league.max_members}</small></dd></div>
          <div><dt>Poti</dt><dd>{fmtNum(league.pot)} <small>383C</small></dd></div>
          <div><dt>Tregtime</dt><dd>{fmtNum(totalTrades)}</dd></div>
          <div><dt>Fituesi i sotëm</dt><dd>{todayBest && Number(todayBest.today_profit ?? 0) > 0 ? <>{first(todayBest.display_name)} <small>{signed(Number(todayBest.today_profit))}</small></> : "—"}</dd></div>
          <div><dt>Seria më e gjatë</dt><dd>{hottest && Number(hottest.streak ?? 0) > 0 ? <><Flame size={16} aria-hidden /> {first(hottest.display_name)} <small>{hottest.streak} ditë</small></> : "—"}</dd></div>
        </dl>

        {me && phase !== "ended" && (
          <div className={styles.rival} style={{ "--lg-color": color } as CSSProperties}>
            <strong>{me.rank === 1 ? "Je i pari." : `Je #${me.rank}.`}</strong>
            <span>
              {above
                ? `${fmtNum(Math.max(0, above.profit - me.profit) + 1)} 383C të mjaftojnë për të kaluar ${first(above.display_name)}.`
                : rows[1]
                  ? `${first(rows[1].display_name)} është ${fmtNum(Math.max(0, me.profit - rows[1].profit))} 383C pas teje.`
                  : "Fto miqtë — liga nis kur jeni dy."}
            </span>
            <Link href="/tregu">Tregto tani <ArrowRight size={14} aria-hidden /></Link>
          </div>
        )}

        <div className={styles.detailGrid}>
          <section className={styles.section} aria-labelledby="table-title">
            <div className={styles.sectionHead}>
              <h2 id="table-title">{phase === "ended" ? "Renditja përfundimtare" : "Renditja"}</h2>
              <p>Fitimi nga tregtitë e mbyllura{league.scope_kind && league.scope_kind !== "all" ? ` në ${scopeOf(league).label}` : ""}</p>
            </div>

            {rows.length >= 2 && (
              <div className={styles.podium} aria-label="Podiumi">
                {podium.map((row, index) =>
                  row ? (
                    <div key={row.rank} className={styles.step} data-place={row.rank} style={{ order: index }}>
                      <span className={styles.stepAvatar}>{first(row.display_name).slice(0, 1).toUpperCase()}</span>
                      <b>{first(row.display_name)}</b>
                      <span className={styles.stepProfit} data-tone={tone(row.profit)}>{signed(row.profit)}</span>
                      <div className={styles.stepBlock}>
                        <span>{row.rank}</span>
                        {prizeFor(row) ? <small>{fmtNum(prizeFor(row)!)} 383C</small> : null}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${index}`} className={styles.step} data-place={index === 0 ? 2 : 3} style={{ order: index }} data-empty>
                      <span className={styles.stepAvatar}>?</span>
                      <b>Vend i lirë</b>
                      <div className={styles.stepBlock}><span>{index === 0 ? 2 : 3}</span></div>
                    </div>
                  )
                )}
              </div>
            )}

            {rows.length ? (
              <ol className={styles.table}>
                <li className={styles.tableHead} aria-hidden>
                  <span>#</span><span>Tregtari</span><span>Sot</span><span>Tregtime</span><span>Fitimi</span><span>Shpërblimi</span>
                </li>
                {rows.map((row) => (
                  <li key={row.rank} className={styles.tableRow} data-me={row.is_me || undefined} data-place={row.rank <= 3 ? row.rank : undefined}>
                    <span className={styles.rankCell}>{row.rank}</span>
                    <span className={styles.nameCell}>
                      <b>{row.display_name}</b>
                      {row.is_me && <em className={styles.you}>TI</em>}
                      {row.is_creator && league.kind === "private" && <em className={styles.creator}>krijuesi</em>}
                      {Number(row.streak) >= 2 && <i className={styles.streak}><Flame size={12} aria-hidden /> {row.streak}</i>}
                    </span>
                    <span className={styles.todayCell} data-tone={tone(Number(row.today_profit ?? 0))}>{Number(row.today_profit ?? 0) ? signed(Number(row.today_profit)) : "—"}</span>
                    <span className={styles.tradesCell}>{row.trades ?? 0}</span>
                    <span className={styles.profitCell} data-tone={tone(row.profit)}>{signed(row.profit)}</span>
                    <span className={styles.prizeCell}>{prizeFor(row) ? `${fmtNum(prizeFor(row)!)} 383C` : ""}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.empty}><Trophy size={20} aria-hidden /><p>Ende pa anëtarë. Bëhu i pari.</p></div>
            )}
          </section>

          <aside className={styles.feed} aria-labelledby="feed-title">
            <h2 id="feed-title">Çfarë ndodh</h2>
            {feed.length ? (
              <ul>
                {feed.map((item, index) => (
                  <li key={`${item.at}-${index}`} data-kind={item.kind}>
                    <span className={styles.feedDot} data-tone={item.kind === "join" ? "join" : tone(item.amount)} aria-hidden />
                    <div>
                      {item.kind === "join" ? (
                        <p><b>{first(item.display_name)}</b> hyri në ligë</p>
                      ) : (
                        <p>
                          <b>{first(item.display_name)}</b> mbylli <span data-tone={tone(item.amount)}>{signed(item.amount)}</span>
                          {item.slug ? <> në <Link href={`/tregu/${item.slug}`}>{item.question}</Link></> : null}
                        </p>
                      )}
                      <small>{ago(item.at, now)} më parë</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.feedEmpty}>Ende qetësi. Tregtia e parë e mbyllur shfaqet këtu.</p>
            )}
          </aside>
        </div>

        {(rules || league.kind === "private") && (
          <section className={styles.rules}>
            <h2>Rregullat</h2>
            {rules ? <p>{rules}</p> : null}
            <p>
              Numërohet fitimi nga tregtitë që mbyll pasi hyn, deri në mbyllje të ligës
              {league.scope_kind && league.scope_kind !== "all" ? `, vetëm në ${scopeOf(league).label}` : ""}.
              {league.kind === "private"
                ? " Poti i tarifave ndahet 50/30/20 për tre të parët."
                : " 383 paguan shpërblimet e veta plus potin e tarifave, 50/30/20, për tre të parët me fitim."}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
