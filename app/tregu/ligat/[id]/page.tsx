"use client";

import Link from "next/link";
import { use as usePromise, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Check, Copy, Lock, Share2, Trophy, Users } from "lucide-react";
import Navbar from "@/components/navbar";
import { METALS, Standing, untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  leagueError,
  leaguePhase,
  leaguePrizes,
  leagueShareUrl,
  type LeagueStanding,
  type LeagueSummary,
} from "@/lib/tregu-leagues";
import styles from "../ligat.module.css";

export default function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const supabase = useMemo(() => createClient(), []);
  const [league, setLeague] = useState<LeagueSummary | null | undefined>(undefined);
  const [rows, setRows] = useState<LeagueStanding[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loggedIn, setLoggedIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [fresh, setFresh] = useState(false);

  const load = useCallback(async () => {
    // The overview carries the member-only fields (code, my rank); the preview
    // covers a public league the visitor has not joined.
    const [overview, preview, standings] = await Promise.all([
      supabase.rpc("tregu_leagues_overview"),
      supabase.rpc("tregu_league_preview", { p_league_id: id }),
      supabase.rpc("tregu_league_standings", { p_league_id: id }),
    ]);
    const mine = (overview.data as LeagueSummary[] | null)?.find((row) => row.id === id);
    const open = (preview.data as LeagueSummary[] | null)?.[0];
    setLeague(mine ?? (open ? { ...open, code: null } : null));
    setRows((standings.data ?? []) as LeagueStanding[]);
  }, [id, supabase]);

  useEffect(() => {
    void load();
    supabase.auth.getUser().then(({ data: { user } }) => setLoggedIn(Boolean(user)));
    setFresh(new URLSearchParams(window.location.search).has("e-re"));
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    // Standings move whenever a member closes a trade.
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
        <main className={styles.page}><i className={styles.skeleton} style={{ height: 320 }} /></main>
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
          <Link className={styles.primary} href="/tregu/ligat">Hyr me kod</Link>
        </main>
      </div>
    );
  }

  const phase = leaguePhase(league, now);
  const prizes = leaguePrizes(league);
  const share = league.code ? leagueShareUrl(league.code) : null;

  const join = async () => {
    if (!loggedIn) {
      window.location.href = `/hyr?next=${encodeURIComponent(`/tregu/ligat/${id}`)}`;
      return;
    }
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
    setMessage({ ok: true, text: "U bashkove. Tregtitë që mbyll tani e tutje numërohen." });
    await load();
  };

  const copyCode = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage({ ok: false, text: "Kopjimi nuk u lejua. Kodi: " + league.code });
    }
  };

  const shareInvite = async () => {
    if (!share) return;
    const text = `Bashkohu në ligën time "${league.name}" në 383 Tregu. Kodi: ${league.code}`;
    if (typeof navigator.share === "function") {
      await navigator.share({ title: league.name, text, url: share }).catch(() => undefined);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${share}`)}`, "_blank", "noopener");
    }
  };

  return (
    <div className="tregu-scope">
      <Navbar />
      <main className={styles.page}>
        <header className={styles.leagueHead}>
          <Link href="/tregu/ligat" className={styles.back}><span aria-hidden>&#8592;</span> Të gjitha ligat</Link>
          <div className={styles.cardTop}>
            <span className={styles.kind} data-kind={league.kind}>
              {league.kind === "public" ? <><Trophy size={12} aria-hidden /> Publike · 383 paguan</> : <><Lock size={12} aria-hidden /> Private</>}
            </span>
            <span className={styles.phase} data-phase={phase}>
              {phase === "ended" ? "Përfundoi" : phase === "upcoming" ? `Fillon për ${untilLabel(Date.parse(league.starts_at), now)}` : <><i aria-hidden /> Mbyllet për {untilLabel(Date.parse(league.ends_at), now)}</>}
            </span>
          </div>
          <h1>{league.name}</h1>
          <p className={styles.meta}>
            <Users size={14} aria-hidden /> {league.members}/{league.max_members} anëtarë
            {league.kind === "private" && <> · {league.entry_fee > 0 ? `tarifa ${fmtNum(league.entry_fee)} 383C · poti ${fmtNum(league.pot)} 383C` : "pa tarifë"}</>}
          </p>
        </header>

        {fresh && league.code && (
          <p className={styles.notice} data-ok role="status">Liga u krijua. Dërgoja kodin miqve — ata bashkohen me një klik.</p>
        )}
        {message && <p className={styles.notice} data-ok={message.ok || undefined} role="status">{message.text}</p>}

        {league.code && (
          <section className={`tregu-glass ${styles.invite}`} aria-label="Fto miqtë">
            <div>
              <small>Kodi i ligës</small>
              <strong className={styles.code}>{league.code}</strong>
            </div>
            <div className={styles.inviteActions}>
              <button type="button" className={styles.ghost} onClick={() => void copyCode()}>
                {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "U kopjua" : "Kopjo linkun"}
              </button>
              <button type="button" className={styles.dark} onClick={() => void shareInvite()}>
                <Share2 size={15} aria-hidden /> Fto miqtë
              </button>
            </div>
          </section>
        )}

        {!league.is_member && phase !== "ended" && league.kind === "public" && (
          <section className={`tregu-glass ${styles.invite}`}>
            <div>
              <strong>Bashkohu me një klik</strong>
              <p className={styles.hint}>Numërohen tregtitë që mbyll pasi bashkohesh.</p>
            </div>
            <button type="button" className={styles.primary} onClick={() => void join()} disabled={joining}>
              {joining ? "Duke u bashkuar…" : "Bashkohu"}
            </button>
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {phase === "ended" ? "Renditja përfundimtare" : "Renditja"}
            <small>Fitimi nga tregtitë e mbyllura gjatë ligës</small>
          </h2>
          {prizes.length > 0 && (
            <div className={styles.podium}>
              {prizes.map((prize, index) => {
                const metal = METALS[index];
                return (
                  <div key={index} style={{ "--metal": metal.fill, "--metal-wash": metal.wash, "--metal-ink": metal.ink } as CSSProperties}>
                    <Standing rank={index + 1} />
                    <span>{index === 0 ? "1-rë" : index === 1 ? "2-të" : "3-të"}</span>
                    <strong>{fmtNum(prize)} <small>383C</small></strong>
                  </div>
                );
              })}
            </div>
          )}
          {league.kind === "public" && phase !== "ended" && (
            <p className={styles.hint}>Shpërblimet publike marrin tre të parët me fitim, pasi 383 i konfirmon.</p>
          )}
          {rows.length ? (
            <ol className="tregu-lb-list">
              {rows.map((row) => {
                const metal = METALS[row.rank - 1];
                // Public prizes go only to members who are up; a private pot
                // is paid down the table whatever the sign.
                const prize = league.kind === "private" || row.profit > 0 ? prizes[row.rank - 1] : undefined;
                return (
                  <li
                    key={row.rank}
                    className="tregu-lb-row"
                    data-metal={metal?.name}
                    data-me={row.is_me || undefined}
                    data-plain={metal ? undefined : ""}
                    style={metal ? ({ "--metal": metal.strip, "--metal-ink": metal.ink, "--metal-wash": metal.wash } as CSSProperties) : undefined}
                  >
                    <Standing rank={row.rank} />
                    <span className="tregu-lb-name">
                      {row.display_name}
                      {row.is_me && <b className="tregu-lb-you">Ti</b>}
                      {row.is_creator && league.kind === "private" && <i> · krijuesi</i>}
                    </span>
                    <span className="tregu-lb-profit" data-tone={row.profit < 0 ? "down" : undefined}>
                      {row.profit > 0 ? "+" : ""}{fmtNum(row.profit)}
                    </span>
                    <span className="tregu-lb-prize" data-none={prize ? undefined : ""}>
                      {prize ? `${fmtNum(prize)} 383C` : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className={styles.empty}><p>Ende pa anëtarë. Bëhu i pari.</p></div>
          )}
        </section>
      </main>
    </div>
  );
}
