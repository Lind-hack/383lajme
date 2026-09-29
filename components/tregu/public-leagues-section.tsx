"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import PublicLeagueCard from "@/components/tregu/public-league-card";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { leagueError, leaguePhase, leaguePurse, type LeagueSummary } from "@/lib/tregu-leagues";
import "./leagues.css";

/** Tells the Ligat card below that the reader's leagues changed. */
export const LEAGUES_CHANGED = "tregu:leagues";

/**
 * 383's own leagues, as a section of their own above the Ligat card: the
 * admin's featured ones in their order, else the biggest purses. Joining one
 * pays in place and then points the reader at its pick board.
 */
export default function PublicLeaguesSection({ loggedIn }: { loggedIn: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<LeaguePayment | null>(null);
  const [joined, setJoined] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("tregu_leagues_overview");
    setLeagues(((data ?? []) as LeagueSummary[]).filter((league) => league.kind === "public"));
  }, [supabase]);

  useEffect(() => {
    void load();
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    window.addEventListener(LEAGUES_CHANGED, load);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener(LEAGUES_CHANGED, load);
    };
  }, [load]);

  const join = async (league: LeagueSummary) => {
    if (!loggedIn) {
      window.location.href = `/hyr?next=${encodeURIComponent("/tregu#ligat-383")}`;
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
    if (Number(league.entry_fee) > 0) {
      setPayment({ amount: Number(league.entry_fee), pot: (Number(league.pot) || 0) + Number(league.entry_fee), league: league.name, kind: "join" });
    }
    setJoined({ id: league.id, name: league.name });
    window.dispatchEvent(new Event(LEAGUES_CHANGED));
  };

  const live = leagues.filter((league) => leaguePhase(league, now) !== "ended");
  const featured = live.filter((league) => league.featured).sort((a, b) => Number(a.feature_order ?? 0) - Number(b.feature_order ?? 0));
  const shown = (featured.length ? featured : [...live].sort((a, b) => leaguePurse(b) - leaguePurse(a))).slice(0, 3);
  if (!shown.length) return null;
  const total = shown.reduce((sum, league) => sum + leaguePurse(league), 0);

  return (
    <section id="ligat-383" className="lgs lg-paper" data-public aria-labelledby="lgs-title">
      <LeaguePay payment={payment} onDone={() => setPayment(null)} />
      <header className="lgs-head">
        <span className="lgc-mark" aria-hidden><Sparkles size={21} strokeWidth={2.4} /></span>
        <div className="lgc-titles">
          <h2 id="lgs-title">Ligat e 383</h2>
          <p>Të hapura për këdo. 383 shton shpërblimin mbi potin e hyrjeve: {fmtNum(total)} 383C në lojë tani.</p>
        </div>
      </header>

      {joined && (
        <p className="lgs-joined" role="status">
          U fute në {joined.name}.
          <Link href={`/tregu/ligat/${joined.id}`}>Bëj parashikimet <ArrowRight size={14} aria-hidden /></Link>
        </p>
      )}
      {error && <p className="lgc-error" role="alert">{error}</p>}

      <div className="lgc-publics">
        {shown.map((league) => (
          <PublicLeagueCard
            key={league.id}
            league={league}
            now={now}
            href={`/tregu/ligat/${league.id}`}
            action={
              league.is_member ? (
                <Link href={`/tregu/ligat/${league.id}`} className="lg-ghost">
                  {league.my_rank ? `Je #${league.my_rank} · ${fmtNum(Number(league.my_profit) || 0)} pikë` : "Je brenda"} <ArrowRight size={14} aria-hidden />
                </Link>
              ) : (
                <button type="button" className="lg-btn" onClick={() => void join(league)} disabled={busy === league.id}>
                  {busy === league.id ? "…" : Number(league.entry_fee) > 0 ? `Hyr · ${fmtNum(league.entry_fee)} 383C` : "Hyr falas"}
                </button>
              )
            }
          />
        ))}
      </div>
    </section>
  );
}
