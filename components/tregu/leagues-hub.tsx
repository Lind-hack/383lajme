"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, Trophy } from "lucide-react";
import LeagueRaceCard from "@/components/tregu/league-race-card";
import LeagueSearch from "@/components/tregu/league-search";
import PointsExplainer, { openPointsHelp } from "@/components/tregu/points-explainer";
import LeaguesCard from "@/components/tregu/leagues-card";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import PublicLeaguesSection, { LEAGUES_CHANGED } from "@/components/tregu/public-leagues-section";
import { openLeagueTutorial } from "@/components/tregu/league-tutorial";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { enableLeaguePush, pushSupported } from "@/lib/tregu-push-client";
import { sortMine } from "@/lib/tregu-leagues-hub.mjs";
import { leagueError, type HubLeague, type SearchLeague } from "@/lib/tregu-leagues";
import "./leagues.css";

type Joinable = Pick<HubLeague, "id" | "name" | "entry_fee" | "pot">;

/**
 * Ligat on the Tregu floor (migration 0095): the reader's leagues as wide
 * cards, sorted by what needs doing today; 383's leagues and the five busiest
 * public ones, each one tap to join; search; then create or join by code.
 * If the hub call is missing (the migration isn't live yet) the two old
 * sections render instead, unchanged.
 */
export default function LeaguesHub({ loggedIn }: { loggedIn: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<HubLeague[] | null>(null);
  const [fallback, setFallback] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<LeaguePayment | null>(null);
  const [joined, setJoined] = useState<{ id: string; name: string } | null>(null);
  const [push, setPush] = useState<"ask" | "on" | "denied" | "unsupported" | "error" | null>(null);

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("tregu_leagues_hub");
    if (rpcError) {
      // PGRST202: the function isn't there (migration not applied yet).
      if (rpcError.code === "PGRST202" || /tregu_leagues_hub/.test(rpcError.message ?? "")) setFallback(true);
      return;
    }
    setRows((data ?? []) as HubLeague[]);
  }, [supabase]);

  useEffect(() => {
    void load();
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener(LEAGUES_CHANGED, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener(LEAGUES_CHANGED, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const join = async (league: Joinable) => {
    if (!loggedIn) {
      window.location.href = `/hyr?next=${encodeURIComponent("/tregu#ligat")}`;
      return;
    }
    primeSellSound();
    setBusy(league.id);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("tregu_league_join", { p_league_id: league.id });
    setBusy(null);
    if (rpcError) {
      setError(leagueError(rpcError));
      return;
    }
    const balance = Number((data as { balance: number }[] | null)?.[0]?.balance);
    if (Number.isFinite(balance)) window.dispatchEvent(new CustomEvent("tregu:balance", { detail: balance }));
    const fee = Number(league.entry_fee) || 0;
    if (fee > 0) setPayment({ amount: fee, pot: (Number(league.pot) || 0) + fee, league: league.name, kind: "join" });
    setJoined({ id: league.id, name: league.name });
    // Right after joining is when a reminder is most welcome.
    if (pushSupported() && Notification.permission === "default") setPush("ask");
    window.dispatchEvent(new Event(LEAGUES_CHANGED));
  };

  if (fallback) {
    return (
      <>
        <PublicLeaguesSection loggedIn={loggedIn} />
        <LeaguesCard loggedIn={loggedIn} />
      </>
    );
  }

  const mine = sortMine((rows ?? []).filter((row) => row.section === "mine"), now);
  const shelf = (rows ?? []).filter((row) => row.section !== "mine");
  const due = mine.filter((row) => Math.max(0, (Number(row.open_count) || 0) - (Number(row.picked_count) || 0)) > 0).length;

  const joinButton = (league: HubLeague) => {
    const full = league.members >= league.max_members;
    return (
      <button type="button" className="lg-btn lgr-act" disabled={full || busy === league.id} onClick={() => void join(league)}>
        {full ? "Plot" : busy === league.id ? "…" : Number(league.entry_fee) > 0 ? `Hyr · ${fmtNum(league.entry_fee)}` : "Hyr falas"}
      </button>
    );
  };

  return (
    <section id="ligat" className="lgh lg-paper" aria-labelledby="lgh-title">
      {/* Old links to 383's leagues land here too. */}
      <span id="ligat-383" className="lgh-anchor" aria-hidden />
      <LeaguePay payment={payment} onDone={() => setPayment(null)} />

      <header className="lgc-head">
        <span className="lgc-mark" aria-hidden><Trophy size={22} strokeWidth={2.4} /></span>
        <div className="lgc-titles">
          <h2 id="lgh-title">Ligat</h2>
          <p>Parashiko ndeshjet, mblidh pikë, mund miqtë. Surprizat paguajnë më shumë. Tre të parët ndajnë potin.</p>
        </div>
        <span className="lgh-help">
          <button type="button" className="lgt-launch" onClick={openLeagueTutorial}><span aria-hidden>?</span>Si luhet?</button>
          <button type="button" className="lgt-launch" onClick={() => openPointsHelp()}><span aria-hidden>🔥</span>Pikët</button>
        </span>
      </header>
      <PointsExplainer />

      {joined && (
        <div className="lgs-joined" role="status">
          <span>U fute në {joined.name}.</span>
          <Link href={`/tregu/ligat/${joined.id}`}>Bëj parashikimet <ArrowRight size={14} aria-hidden /></Link>
          {push === "ask" && (
            <button type="button" className="lgh-bell" onClick={() => void enableLeaguePush().then((result) => setPush(result))}>
              <BellRing size={15} aria-hidden /> Më kujto para ndeshjeve
            </button>
          )}
          {push === "on" && <span>Do të të kujtojmë 2 orë para ndeshjes së parë.</span>}
          {push === "denied" && <span>Njoftimet janë bllokuar te shfletuesi.</span>}
        </div>
      )}
      {error && <p className="lgc-error" role="alert">{error}</p>}

      {rows === null ? (
        <div className="lgr-rail" aria-hidden>
          <div className="lgr-skeleton" />
          <div className="lgr-skeleton" />
        </div>
      ) : (
        <>
          {mine.length > 0 && (
            <div className="lgh-block">
              <h3 className="lgh-label">
                Ligat e tua
                {due > 0 && <span className="lgh-due">{due === 1 ? "1 pret parashikimet" : `${due} presin parashikimet`}</span>}
              </h3>
              <div className="lgr-rail" role="list">
                {mine.map((league) => (
                  <div role="listitem" key={league.id}>
                    <LeagueRaceCard league={league} now={now} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {shelf.length > 0 && (
            <div className="lgh-block">
              <h3 className="lgh-label">{mine.length ? "Hyr në një tjetër" : "Zgjidh një ligë dhe hyr"}</h3>
              <div className="lgr-rail" role="list">
                {shelf.map((league) => (
                  <div role="listitem" key={league.id}>
                    <LeagueRaceCard league={league} now={now} action={joinButton(league)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <LeagueSearch busy={busy} onJoin={(league: SearchLeague) => void join(league)} />

      <LeaguesCard loggedIn={loggedIn} embedded />
    </section>
  );
}
