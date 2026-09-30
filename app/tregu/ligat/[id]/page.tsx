"use client";

import Link from "next/link";
import { use as usePromise, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, Bell, BellRing, Check, CircleCheck, Copy, Image as ImageIcon, Lock, Share2, Swords, Target, Trophy, Zap } from "lucide-react";
import Navbar from "@/components/navbar";
import DuelChallenge from "@/components/tregu/duel-challenge";
import LeagueEmblem from "@/components/tregu/league-emblem";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import LeaguePodium from "@/components/tregu/league-podium";
import PrizePool from "@/components/tregu/prize-pool";
import { SponsorBand } from "@/components/tregu/public-league-card";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { enableLeaguePush, pushSupported } from "@/lib/tregu-push-client";
import {
  leagueColor,
  leagueDays,
  leagueError,
  leaguePhase,
  leaguePrizes,
  leagueShareUrl,
  privateBonusPct,
  scopeOf,
  type BoardRow,
  type Duel,
  type LeagueStanding,
  type LeagueSummary,
  type PickOption,
} from "@/lib/tregu-leagues";
import "@/components/tregu/leagues.css";
import DardaniLoop from "@/components/dardani/dardani-loop";
import LeagueTutorial, { openLeagueTutorial } from "@/components/tregu/league-tutorial";

type Counts = { member_key: string; is_me: boolean; resolved: number; correct: number; pending: number };

const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const pts = (value: number) => `${fmtNum(Math.round(value))} pikë`;
/** Options shown before "Më shumë": enough for home/draw/away and a top six. */
const VISIBLE_OPTIONS = 6;
/** Markets shown at once in a tab; a busy round would otherwise be a wall. */
const PAGE = 6;

type PickTab = "todo" | "picked" | "done";
const PICK_TABS: { key: PickTab; label: string }[] = [
  { key: "todo", label: "Pa zgjedhur" },
  { key: "picked", label: "Të zgjedhura" },
  { key: "done", label: "Rezultatet" },
];

/** The rules as three steps, with a worked example and this league's prizes. */
function HowToPlay({ league, prizes, scopeLabel }: { league: LeagueSummary & { rules?: string | null }; prizes: number[]; scopeLabel: string | null }) {
  const bonus = league.kind === "private" ? privateBonusPct(leagueDays(league)) : null;
  return (
    <section className="lgx-panel lgx-how" aria-labelledby="rules-title">
      <div className="lgx-panel-head">
        <h2 id="rules-title">Si luhet</h2>
        <span>Të gjithë nisin me 0 pikë</span>
        <button type="button" className="lgt-launch" onClick={openLeagueTutorial}><span aria-hidden>?</span>Provoje me Dardanin</button>
      </div>
      <ol className="how">
        <li>
          <span className="how-n" aria-hidden><Target size={16} /></span>
          <div>
            <strong>Zgjidh kush fiton</strong>
            <p>Për çdo ndeshje{scopeLabel ? ` të ${scopeLabel}` : ""} prek një rezultat para se të nisë. E ndryshon sa herë të duash deri atëherë. Është falas.</p>
          </div>
        </li>
        <li>
          <span className="how-n" aria-hidden><Trophy size={16} /></span>
          <div>
            <strong>Surpriza jep më shumë pikë</strong>
            <p>Pikët janë 100 minus gjasa në çastin që zgjodhe. Nëse gabon, merr 0.</p>
            <div className="how-example" aria-label="Shembull">
              <span><em>Favoriti · 70%</em><b>+30</b></span>
              <span><em>Barazim · 25%</em><b>+75</b></span>
              <span data-hot><em>Surpriza · 5%</em><b>+95</b></span>
            </div>
          </div>
        </li>
        <li>
          <span className="how-n" aria-hidden><CircleCheck size={16} /></span>
          <div>
            <strong>Tre të parët marrin potin</strong>
            <p>
              {league.kind === "private"
                ? `Kur mbaron liga, hyrjet e të gjithëve plus ${bonus}% nga 383 ndahen 50% · 30% · 20%. Nëse askush s'ka pikë, hyrjet kthehen.`
                : "Kur mbaron liga, 383 paguan shpërblimet e veta plus hyrjet, 50% · 30% · 20%, për tre të parët me pikë."}
            </p>
            {prizes.length > 0 && (
              <div className="how-prizes" aria-label="Shpërblimet tani">
                {prizes.map((prize, index) => <span key={index} data-place={index + 1}><em>{index + 1}.</em><b>{fmtNum(prize)}</b> 383C</span>)}
              </div>
            )}
          </div>
        </li>
      </ol>
      {league.rules ? <p className="how-extra">{league.rules}</p> : null}
    </section>
  );
}

function PickCard({
  row,
  now,
  canPick,
  busy,
  onPick,
}: {
  row: BoardRow;
  now: number;
  canPick: boolean;
  busy: boolean;
  onPick: (row: BoardRow, option: PickOption) => void;
}) {
  const [all, setAll] = useState(false);
  const options = row.options ?? [];
  const open = row.result === "open";
  const settled = row.result === "won" || row.result === "lost" || row.result === "void";
  // Open markets: favourites first so the likely answers are the first taps.
  const ordered = row.market_type === "f1_race_winner"
    ? [...options].sort((a, b) => Number(b.prob ?? 0) - Number(a.prob ?? 0))
    : options;
  const mine = ordered.find((option) => option.key === row.my_outcome);
  const shown = all || ordered.length <= VISIBLE_OPTIONS + 1
    ? ordered
    : [...ordered.slice(0, VISIBLE_OPTIONS), ...(mine && !ordered.slice(0, VISIBLE_OPTIONS).includes(mine) ? [mine] : [])];

  return (
    <article className="pick" data-result={row.result}>
      <div className="pick-head">
        <p className="pick-q"><Link href={`/tregu/${row.slug}`}>{row.question}</Link></p>
        <span className="pick-when" data-state={open ? "open" : "locked"}>
          {settled ? "Mbaroi" : open ? `Mbyllet për ${untilLabel(Date.parse(row.lock_at), now)}` : "Po luhet"}
        </span>
      </div>
      <div className="pick-opts" role="group" aria-label={row.question}>
        {shown.map((option) => {
          const chosen = row.my_outcome === option.key;
          const reward = chosen && row.my_points ? row.my_points : Math.max(1, Math.min(99, Math.round(100 * (1 - Math.min(0.99, Math.max(0.01, Number(option.prob ?? 0.5)))))));
          return (
            <button
              key={option.key}
              type="button"
              className="pick-opt"
              aria-pressed={chosen}
              data-winner={row.result_outcome === option.key || undefined}
              disabled={!open || !canPick || busy}
              onClick={() => onPick(row, option)}
              style={option.color ? ({ "--opt-color": option.color } as CSSProperties) : undefined}
              aria-label={`${option.label}: ${reward} pikë nëse del`}
            >
              {option.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.logo} alt="" loading="lazy" />
              ) : (
                <i aria-hidden />
              )}
              {option.label}
              {!settled && <em>+{reward}</em>}
              {chosen && <Check size={14} strokeWidth={3} aria-hidden />}
            </button>
          );
        })}
        {!all && shown.length < ordered.length && (
          <button type="button" className="pick-more" onClick={() => setAll(true)}>Më shumë ({ordered.length - shown.length})</button>
        )}
      </div>
      {row.result === "won" && <p className="pick-foot" data-result="won"><CircleCheck size={15} aria-hidden /> E qëllove · +{row.my_points} pikë</p>}
      {row.result === "lost" && <p className="pick-foot">Doli {options.find((option) => option.key === row.result_outcome)?.label ?? "tjetër"} · 0 pikë</p>}
      {row.result === "void" && <p className="pick-foot">Tregu u anulua · nuk numërohet</p>}
      {!settled && row.my_outcome && !open && <p className="pick-foot">Parashikimi yt: {mine?.label} · +{row.my_points} nëse del</p>}
    </article>
  );
}

export default function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const supabase = useMemo(() => createClient(), []);
  const [league, setLeague] = useState<(LeagueSummary & { rules?: string | null }) | null | undefined>(undefined);
  const [rows, setRows] = useState<LeagueStanding[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [counts, setCounts] = useState<Counts[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loggedIn, setLoggedIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [payment, setPayment] = useState<LeaguePayment | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [challenge, setChallenge] = useState<LeagueStanding | null>(null);
  const [push, setPush] = useState<"idle" | "on" | "denied" | "unsupported" | "error">("idle");
  const [tab, setTab] = useState<PickTab>("todo");
  const [shown, setShown] = useState(PAGE);

  const load = useCallback(async () => {
    const [overview, preview, standings, picks, tallies, myDuels] = await Promise.all([
      supabase.rpc("tregu_leagues_overview"),
      supabase.rpc("tregu_league_preview", { p_league_id: id }),
      supabase.rpc("tregu_league_standings", { p_league_id: id }),
      supabase.rpc("tregu_league_board", { p_league_id: id }),
      supabase.rpc("tregu_league_pick_counts", { p_league_id: id }),
      supabase.rpc("tregu_my_duels"),
    ]);
    const mine = (overview.data as LeagueSummary[] | null)?.find((row) => row.id === id);
    const open = (preview.data as (LeagueSummary & { rules?: string | null })[] | null)?.[0];
    setLeague(mine ? { ...open, ...mine, rules: open?.rules ?? null } : open ? { ...open, code: null } : null);
    setRows((standings.data ?? []) as LeagueStanding[]);
    setBoard((picks.data ?? []) as BoardRow[]);
    setCounts((tallies.data ?? []) as Counts[]);
    setDuels(((myDuels.data ?? []) as Duel[]).filter((duel) => duel.league_id === id));
  }, [id, supabase]);

  useEffect(() => {
    void load();
    supabase.auth.getUser().then(({ data: { user } }) => setLoggedIn(Boolean(user)));
    if (!pushSupported()) setPush("unsupported");
    else if (Notification.permission === "granted") setPush("on");
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
        <main className="lgx"><i className="lgx-skeleton" aria-hidden /></main>
      </div>
    );
  }
  if (league === null) {
    return (
      <div className="tregu-scope">
        <Navbar />
        <main className="lgx">
          <div className="lgx-missing lg-paper">
            <Lock size={24} aria-hidden />
            <h1>Kjo ligë është private</h1>
            <p>Vetëm anëtarët e shohin. Nëse ke kodin, hyr me të në Tregu.</p>
            <Link className="lg-btn" href="/tregu#ligat">Hyr me kod</Link>
          </div>
        </main>
      </div>
    );
  }

  const phase = leaguePhase(league, now);
  const prizes = leaguePrizes(league);
  const color = leagueColor(league);
  const scope = scopeOf(league);
  const me = rows.find((row) => row.is_me);
  const above = me ? rows.find((row) => row.rank === me.rank - 1) : undefined;
  const below = me ? rows.find((row) => row.rank === me.rank + 1) : undefined;
  const prizeFor = (rank: number, points: number) => (points > 0 ? prizes[rank - 1] : undefined);
  const podium = [0, 1, 2].map((index) => {
    const row = rows[index];
    return row && row.profit > 0
      ? { name: row.display_name, value: pts(row.profit), prize: prizes[index], isMe: row.is_me }
      : { name: null, prize: prizes[index] };
  });
  const canPick = Boolean(league.is_member) && phase === "live";
  const openRows = board.filter((row) => row.result === "open" || row.result === "locked");
  const doneRows = board.filter((row) => row.result === "won" || row.result === "lost" || row.result === "void");
  const groups: Record<PickTab, BoardRow[]> = {
    todo: openRows.filter((row) => row.result === "open" && !row.my_outcome),
    picked: openRows.filter((row) => row.my_outcome),
    done: doneRows,
  };
  const myCount = counts.find((count) => count.is_me);
  const countFor = (row: LeagueStanding) => counts.find((count) => count.member_key === row.member_key);
  const incoming = duels.filter((duel) => duel.status === "pending" && !duel.i_am_challenger);
  const activeDuels = duels.filter((duel) => duel.status === "active");

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
    if (Number(league.entry_fee) > 0) {
      setPayment({ amount: Number(league.entry_fee), pot: (Number(league.pot) || 0) + Number(league.entry_fee), league: league.name, kind: "join" });
    } else {
      setMessage({ ok: true, text: "U fute në ligë. Zgjidh parashikimet më poshtë." });
    }
    void load();
  };

  const pick = async (row: BoardRow, option: PickOption) => {
    setPicking(row.market_id);
    setMessage(null);
    const previous = board;
    setBoard((current) => current.map((item) => (item.market_id === row.market_id ? { ...item, my_outcome: option.key } : item)));
    const { data, error } = await supabase.rpc("tregu_league_pick", { p_league_id: id, p_market_id: row.market_id, p_outcome: option.key });
    setPicking(null);
    if (error) {
      setBoard(previous);
      setMessage({ ok: false, text: leagueError(error) });
      return;
    }
    const saved = (data as { outcome: string; points: number }[] | null)?.[0];
    if (saved) setBoard((current) => current.map((item) => (item.market_id === row.market_id ? { ...item, my_outcome: saved.outcome, my_points: saved.points } : item)));
  };

  const respond = async (duel: Duel, accept: boolean) => {
    if (accept) primeSellSound();
    const { data, error } = await supabase.rpc("tregu_duel_respond", { p_duel_id: duel.id, p_accept: accept });
    if (error) {
      setMessage({ ok: false, text: leagueError(error) });
      return;
    }
    const next = Number((data as { balance: number }[] | null)?.[0]?.balance);
    if (Number.isFinite(next)) window.dispatchEvent(new CustomEvent("tregu:balance", { detail: next }));
    if (accept && duel.stake > 0) setPayment({ amount: duel.stake, pot: duel.stake * 2, league: duel.rival, kind: "duel" });
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
      <main className="lgx">
        <Link href="/tregu#ligat" className="lgx-back"><ArrowLeft size={16} aria-hidden /> Tregu</Link>

        <header className="lgx-hero lg-paper" data-public={league.kind === "public" || undefined} style={{ "--lg-color": color } as CSSProperties}>
          <LeaguePay payment={payment} onDone={() => { setPayment(null); setMessage({ ok: true, text: "U fute në ligë. Zgjidh parashikimet më poshtë." }); }} />
          <div className="lgx-hero-top">
            <span className="lgx-theme">{league.kind === "private" ? <><Lock size={12} aria-hidden /> Ligë private</> : scope.label}</span>
            <span className="lgp-clock">
              {phase === "live" && <i aria-hidden />}
              {phase === "ended" ? "Përfundoi" : phase === "upcoming" ? `Fillon për ${untilLabel(Date.parse(league.starts_at), now)}` : `${untilLabel(Date.parse(league.ends_at), now)} mbetur`}
            </span>
          </div>
          <div className="lgx-hero-main">
            <LeagueEmblem league={league} size={84} />
            <div>
              <h1>{league.name}</h1>
              {league.description && <p>{league.description}</p>}
              <p className="lgx-members">{fmtNum(league.members)} {league.members === 1 ? "anëtar" : "anëtarë"}</p>
            </div>
          </div>
          <div className="lgx-hero-money">
            <PrizePool league={league} />
            <SponsorBand league={league} variant="hero" />
          </div>
          <div className="lgx-actions">
            {!league.is_member && phase !== "ended" && league.kind === "public" && (
              <button type="button" className="lg-btn" onClick={() => void join()} disabled={joining}>
                <Zap size={16} aria-hidden /> {joining ? "Duke hyrë…" : Number(league.entry_fee) > 0 ? `Hyr · ${fmtNum(league.entry_fee)} 383C` : "Hyr falas"}
              </button>
            )}
            {league.code && phase !== "ended" && (
              <>
                <button type="button" className="lg-btn" onClick={() => void invite()}><Share2 size={16} aria-hidden /> Fto miqtë · {league.code}</button>
                <button type="button" className="lg-ghost" onClick={() => void copyCode()}>{copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "U kopjua" : "Kopjo linkun"}</button>
              </>
            )}
            <button type="button" className="lg-ghost" onClick={() => void shareTable()}><ImageIcon size={15} aria-hidden /> Shpërndaj renditjen</button>
          </div>
        </header>

        {message && <p className="lgx-notice" data-ok={message.ok || undefined} role="status">{message.text}</p>}

        <div className="lgx-grid">
          <div>
            <section className="lgx-panel" aria-labelledby="podium-title">
              <div className="lgx-panel-head">
                <h2 id="podium-title">{phase === "ended" ? "Fituesit" : "Podiumi"}</h2>
                <span>{prizes.length ? `${prizes.map((prize) => fmtNum(prize)).join(" / ")} 383C` : "Shpërblimet sipas pikëve"}</span>
              </div>
              <LeaguePodium seats={podium} label="Podiumi i ligës" />
              {me && (
                <p className="lgx-you">
                  <strong>{me.profit > 0 ? `Je #${me.rank}` : "Ende pa pikë"}</strong>
                  <span>
                    {pts(me.profit)}
                    {myCount ? ` · ${myCount.correct}/${myCount.resolved} të sakta` : ""}
                    {above && me.profit > 0 ? ` · ${fmtNum(above.profit - me.profit + 1)} pikë për të kaluar ${first(above.display_name)}` : ""}
                    {!above && below && me.profit > 0 ? ` · ${fmtNum(me.profit - below.profit)} pikë përpara ${first(below.display_name)}` : ""}
                  </span>
                </p>
              )}

              {league.is_member && (incoming.length > 0 || activeDuels.length > 0 || push !== "unsupported") && (
                <div className="lgx-duels">
                  {incoming.map((duel) => (
                    <div key={duel.id} className="lgx-duel">
                      <Swords size={18} aria-hidden />
                      <p><b>{duel.rival}</b> të sfidoi për 24 orë{duel.stake ? ` · ${duel.stake} 383C secili` : " · për nder"}</p>
                      <button type="button" className="lg-btn" onClick={() => void respond(duel, true)}>Prano{duel.stake ? ` · ${duel.stake}` : ""}</button>
                      <button type="button" className="lg-ghost" onClick={() => void respond(duel, false)}>Refuzo</button>
                    </div>
                  ))}
                  {activeDuels.map((duel) => {
                    const lead = (duel.my_net - duel.rival_net) / (duel.my_net + duel.rival_net + 40);
                    const share = Math.round(50 + Math.max(-38, Math.min(38, lead * 60)));
                    return (
                      <div key={duel.id} className="lgx-duel" style={{ "--share": share / 100 } as CSSProperties}>
                        <Swords size={18} aria-hidden />
                        <p>Duel me <b>{duel.rival}</b>: ti <b>{fmtNum(duel.my_net)}</b> · {first(duel.rival)} <b>{fmtNum(duel.rival_net)}</b> pikë{duel.ends_at ? ` · ${untilLabel(Date.parse(duel.ends_at), now)} mbetur` : ""}</p>
                        <span className="lgx-duel-bar" aria-hidden><i /></span>
                      </div>
                    );
                  })}
                  {push === "idle" && (
                    <span className="lg-push-ask">
                      <DardaniLoop name="bell" decorative className="lg-push-dardani" />
                      <button type="button" className="lg-ghost" onClick={() => void enableLeaguePush().then(setPush)}>
                        <Bell size={15} aria-hidden /> Më njofto kur më kalojnë
                      </button>
                    </span>
                  )}
                  {push === "on" && <span className="lgx-bell"><BellRing size={15} aria-hidden /> Njoftimet janë ndezur</span>}
                  {push === "denied" && <span className="lgx-bell">Njoftimet janë bllokuar në shfletues</span>}
                </div>
              )}

              {rows.length ? (
                <ol className="lgt" aria-label="Renditja">
                  <li className="lgt-head" aria-hidden><span>#</span><span>Lojtari</span><span>Të sakta</span><span>Pikë</span><span /></li>
                  {rows.map((row) => {
                    const count = countFor(row);
                    const prize = prizeFor(row.rank, row.profit);
                    return (
                      <li key={row.member_key ?? row.rank} data-me={row.is_me || undefined}>
                        <span className="lgt-rank">{row.rank}</span>
                        <span className="lgt-name">
                          {row.display_name}
                          {row.is_me && <em>TI</em>}
                          {prize ? <small>{fmtNum(prize)} 383C</small> : null}
                        </span>
                        <span className="lgt-hits">{count ? `${count.correct}/${count.resolved}` : "—"}</span>
                        <span className="lgt-points">{fmtNum(row.profit)}<small>p</small></span>
                        <span>
                          {league.is_member && !row.is_me && row.member_key && phase === "live" ? (
                            <button type="button" className="lgt-duel" onClick={() => setChallenge(row)} aria-label={`Sfido ${row.display_name}`}><Swords size={13} aria-hidden /> Sfido</button>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="pick-empty">Ende pa anëtarë. Bëhu i pari.</p>
              )}
            </section>

            <HowToPlay league={league} prizes={prizes} scopeLabel={league.scope_kind && league.scope_kind !== "all" ? scope.label : null} />
          </div>

          <section className="lgx-panel lgx-picks" aria-labelledby="picks-title">
            <div className="lgx-panel-head">
              <h2 id="picks-title">Parashikimet</h2>
              <span>{myCount?.pending ? `${myCount.pending} në pritje` : openRows.length ? `${openRows.length} të hapura` : ""}</span>
            </div>
            {!league.is_member && phase !== "ended" && (
              <p className="pick-empty">{league.kind === "public" ? "Hyr në ligë për të parashikuar." : "Vetëm anëtarët parashikojnë."}</p>
            )}
            {league.is_member && phase === "upcoming" && (
              <p className="pick-empty">Liga nis për {untilLabel(Date.parse(league.starts_at), now)}. Parashikimet hapen atëherë.</p>
            )}
            {(league.is_member || board.length > 0) && (
              <div className="pick-tabs" role="tablist" aria-label="Parashikimet">
                {PICK_TABS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.key}
                    onClick={() => { setTab(item.key); setShown(PAGE); }}
                  >
                    {item.label}<b>{groups[item.key].length}</b>
                  </button>
                ))}
              </div>
            )}
            <div className="picks">
              {groups[tab].slice(0, shown).map((row) => (
                <PickCard key={row.market_id} row={row} now={now} canPick={canPick && tab !== "done"} busy={picking === row.market_id} onPick={(item, option) => void pick(item, option)} />
              ))}
              {!groups[tab].length && (
                <p className="pick-empty">
                  {tab === "todo" ? (openRows.length ? "Ke zgjedhur për çdo ndeshje të hapur. Tani prit rezultatet." : "Asnjë ndeshje e hapur tani. Tregjet e reja shfaqen këtu sapo hapen.")
                    : tab === "picked" ? "Ende pa parashikime. Zgjidh te “Pa zgjedhur”."
                    : "Rezultatet shfaqen këtu sapo të mbarojnë ndeshjet që zgjodhe."}
                </p>
              )}
            </div>
            {groups[tab].length > shown && (
              <button type="button" className="pick-more-all" onClick={() => setShown((value) => value + PAGE)}>
                Shfaq edhe {Math.min(PAGE, groups[tab].length - shown)} nga {groups[tab].length - shown}
              </button>
            )}
          </section>
        </div>

        {challenge?.member_key && (
          <div className="lgx-duel-layer">
            <DuelChallenge
              leagueId={league.id}
              memberKey={challenge.member_key}
              rival={first(challenge.display_name)}
              balance={null}
              onClose={() => setChallenge(null)}
              onDone={() => void load()}
            />
          </div>
        )}
        <LeagueTutorial autoStart="mount" />
      </main>
    </div>
  );
}
