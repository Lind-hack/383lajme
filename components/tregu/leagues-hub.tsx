"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BellRing, Plus, Sparkles, Target, Trophy, X } from "lucide-react";
import LeagueRaceCard from "@/components/tregu/league-race-card";
import LeagueSearch, { LEAGUE_CREATE_EVENT } from "@/components/tregu/league-search";
import PointsExplainer from "@/components/tregu/points-explainer";
import LeaguesCard, { LEAGUE_CODE_EVENT } from "@/components/tregu/leagues-card";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import PublicLeaguesSection, { LEAGUES_CHANGED } from "@/components/tregu/public-leagues-section";
import { openLeagueTutorial } from "@/components/tregu/league-tutorial";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { useFocusTrap } from "@/components/tregu/use-focus-trap";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { enableLeaguePush, pushSupported } from "@/lib/tregu-push-client";
import { sortMine } from "@/lib/tregu-leagues-hub.mjs";
import { leagueError, type HubLeague, type SearchLeague } from "@/lib/tregu-leagues";
import "./leagues.css";

type Joinable = Pick<HubLeague, "id" | "name" | "entry_fee" | "pot">;

/** How you win, in three beats: shown until the reader has played once. */
const STEPS = [
  { icon: Target, title: "Parashiko", text: "Zgjidh kush fiton ndeshjet" },
  { icon: Sparkles, title: "Mblidh pikë", text: "Surpriza të jep më shumë pikë" },
  { icon: Trophy, title: "Fito 383C", text: "Tre të parët ndajnë potin" },
];

/**
 * Ligat on the Tregu floor: your leagues as slim strips, then two buttons —
 * "Hyr në një ligë" (383's leagues, the busiest public ones, search and an
 * invite code, all in one sheet) and "Krijo". A newcomer sees how winning
 * works in three steps first. If the hub call is missing (migration 0095 not
 * live) the two old sections render instead, unchanged.
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
  const [sheet, setSheet] = useState(false);
  const [code, setCode] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useFocusTrap(panel, sheet);

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

  const closeSheet = useCallback(() => {
    setSheet(false);
    if (opener.current instanceof HTMLElement) opener.current.focus();
  }, []);

  useEffect(() => {
    if (!sheet) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeSheet(); };
    window.addEventListener("keydown", onKey);
    // Creating from the sheet's search moves to the create form on the page.
    window.addEventListener(LEAGUE_CREATE_EVENT, closeSheet);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(LEAGUE_CREATE_EVENT, closeSheet);
    };
  }, [sheet, closeSheet]);

  const openSheet = () => {
    opener.current = document.activeElement;
    setSheet(true);
  };

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
    setSheet(false);
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

  const mine = sortMine((rows ?? []).filter((row) => row?.section === "mine"), now);
  const shelf = (rows ?? []).filter((row) => row?.section !== "mine");
  const due = mine.filter((row) => Math.max(0, (Number(row?.open_count) || 0) - (Number(row?.picked_count) || 0)) > 0).length;
  const played = mine.some((row) => Number(row?.my_rank) > 0 || Number(row?.picked_count) > 0);

  const joinButton = (league: HubLeague) => {
    const full = league.members >= league.max_members;
    return (
      <button type="button" className="lg-btn lgr-act" disabled={full || busy === league.id} onClick={() => void join(league)}>
        {full ? "Plot" : busy === league.id ? "…" : Number(league.entry_fee) > 0 ? `Hyr · ${fmtNum(league.entry_fee)}` : "Hyr falas"}
      </button>
    );
  };

  const submitCode = () => {
    window.dispatchEvent(new CustomEvent(LEAGUE_CODE_EVENT, { detail: code }));
    setCode("");
    closeSheet();
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
          {played && <p>Tre të parët në çdo ligë ndajnë potin.</p>}
        </div>
        <span className="lgh-help">
          <button type="button" className="lgt-launch" onClick={openLeagueTutorial}><span aria-hidden>?</span>Si luhet?</button>
        </span>
      </header>
      {/* Pick cards and standings still open "Si llogariten pikët" from here. */}
      <PointsExplainer />

      {rows !== null && !played && (
        <ol className="lgh-steps" aria-label="Si fiton">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} style={{ animationDelay: `${index * 140}ms` }}>
              <span className="lgh-step-icon" aria-hidden><Icon size={20} strokeWidth={2.4} /></span>
              <b>{title}</b>
              <small>{text}</small>
            </li>
          ))}
        </ol>
      )}

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
      {error && !sheet && <p className="lgc-error" role="alert">{error}</p>}

      {rows === null ? (
        <div className="lgr-rail" aria-hidden>
          <div className="lgr-skeleton" />
        </div>
      ) : mine.length > 0 && (
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

      <div className="lgh-actions">
        <button type="button" className="lgh-join" onClick={openSheet} aria-haspopup="dialog">
          <span>Hyr në një ligë</span>
          <ArrowRight size={18} strokeWidth={2.6} aria-hidden />
        </button>
        <button type="button" className="lgh-create" onClick={() => window.dispatchEvent(new CustomEvent(LEAGUE_CREATE_EVENT))}>
          <Plus size={16} strokeWidth={2.6} aria-hidden /> Krijo
        </button>
      </div>

      {/* Create, invite links and code previews still live here. */}
      <LeaguesCard loggedIn={loggedIn} embedded quiet />

      {sheet && createPortal(
        <div className="lgj-backdrop" onClick={closeSheet}>
          <div
            ref={panel}
            className="lgj lg-paper"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lgj-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="rrm-x" onClick={closeSheet} aria-label="Mbyll"><X size={15} /></button>
            <h2 id="lgj-title">Hyr në një ligë</h2>
            {error && <p className="lgc-error" role="alert">{error}</p>}

            {shelf.length > 0 && (
              <div className="lgh-block">
                <h3 className="lgh-label">Zgjidh një dhe hyr</h3>
                <div className="lgr-rail" role="list">
                  {shelf.map((league) => (
                    <div role="listitem" key={league.id}>
                      <LeagueRaceCard league={league} now={now} action={joinButton(league)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <LeagueSearch busy={busy} onJoin={(league: SearchLeague) => void join(league)} />

            <form className="lgc-code lgj-code" onSubmit={(event) => { event.preventDefault(); submitCode(); }}>
              <label htmlFor="lgj-code-input">Ke kod nga një mik?</label>
              <div>
                <input
                  id="lgj-code-input"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="K7MQ2P"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                <button type="submit" className="lg-btn" disabled={code.length !== 6}>Gjej</button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </section>
  );
}
