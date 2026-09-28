"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, Bell, BellRing, Check, Swords, Trophy, X } from "lucide-react";
import LeaguePay, { type LeaguePayment } from "@/components/tregu/league-pay";
import { primeSellSound } from "@/components/tregu/trade-success-sound";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { leagueError, type Duel, type LeagueEvent } from "@/lib/tregu-leagues";
import { enableLeaguePush, pushSupported } from "@/lib/tregu-push-client";

const signed = (value: number) => `${value > 0 ? "+" : ""}${fmtNum(Math.round(value))}`;

function eventLine(event: LeagueEvent) {
  const actor = event.actor ?? "Dikush";
  const league = String(event.data?.league ?? "");
  const gap = Number(event.data?.gap ?? 0);
  switch (event.kind) {
    case "overtaken":
      return { icon: <ArrowDown size={15} aria-hidden />, tone: "down", text: <><b>{actor}</b> të kaloi te {league} · #{String(event.data?.from)} → #{String(event.data?.to)}{gap ? <> · <em>{fmtNum(gap)} 383C për ta rimarrë</em></> : null}</> };
    case "climbed":
      return { icon: <ArrowUp size={15} aria-hidden />, tone: "up", text: <>U ngjite në <b>#{String(event.data?.to)}</b> te {league}</> };
    case "duel_accepted":
      return { icon: <Swords size={15} aria-hidden />, tone: "gold", text: <><b>{actor}</b> pranoi duelin. 24 orë nisën.</> };
    case "duel_declined":
      return { icon: <X size={15} aria-hidden />, tone: "muted", text: <><b>{actor}</b> e refuzoi duelin. Basti t&apos;u kthye.</> };
    case "duel_won":
      return { icon: <Trophy size={15} aria-hidden />, tone: "up", text: <>Fitove duelin me <b>{actor}</b>{Number(event.data?.stake) ? <> · +{fmtNum(Number(event.data?.stake) * 2)} 383C</> : null}</> };
    case "duel_lost":
      return { icon: <Swords size={15} aria-hidden />, tone: "down", text: <><b>{actor}</b> fitoi duelin. Sfidoje përsëri.</> };
    case "duel_draw":
      return { icon: <Swords size={15} aria-hidden />, tone: "muted", text: <>Barazim me <b>{actor}</b>. Bastet u kthyen.</> };
    case "duel_expired":
      return { icon: <X size={15} aria-hidden />, tone: "muted", text: <><b>{actor}</b> nuk u përgjigj. Basti t&apos;u kthye.</> };
    default:
      return null;
  }
}

/**
 * What changed since you were last here: who passed you and by how much,
 * challenges waiting for an answer, and your live duels. It sits at the top of
 * the floor because it is the reason to open Tregu today, and each line ends
 * in the action that answers it.
 */
export default function RivalryBanner({ loggedIn }: { loggedIn: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<LeaguePayment | null>(null);
  const [push, setPush] = useState<"idle" | "on" | "denied" | "unsupported" | "error">("idle");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [{ data: eventRows }, { data: duelRows }] = await Promise.all([
      supabase.rpc("tregu_my_league_events", { p_limit: 12 }),
      supabase.rpc("tregu_my_duels"),
    ]);
    setEvents(((eventRows ?? []) as LeagueEvent[]).filter((event) => !event.seen && event.kind !== "duel_challenge"));
    setDuels((duelRows ?? []) as Duel[]);
  }, [supabase]);

  useEffect(() => {
    if (!loggedIn) return;
    void load();
    if (pushSupported() && Notification.permission === "granted") setPush("on");
    else if (!pushSupported()) setPush("unsupported");
    const refresh = window.setInterval(() => void load(), 60_000);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    window.addEventListener("tregu:balance", load);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
      window.removeEventListener("tregu:balance", load);
    };
  }, [loggedIn, load]);

  if (!loggedIn || hidden) return null;
  const incoming = duels.filter((duel) => duel.status === "pending" && !duel.i_am_challenger);
  const active = duels.filter((duel) => duel.status === "active");
  const overtaken = events.find((event) => event.kind === "overtaken");
  if (!events.length && !incoming.length && !active.length) return null;

  const dismiss = async () => {
    setHidden(true);
    await supabase.rpc("tregu_mark_league_events_seen");
  };

  const respond = async (duel: Duel, accept: boolean) => {
    if (accept) primeSellSound();
    setBusy(duel.id);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("tregu_duel_respond", { p_duel_id: duel.id, p_accept: accept });
    setBusy(null);
    if (rpcError) {
      setError(leagueError(rpcError));
      return;
    }
    const next = Number((data as { balance: number }[] | null)?.[0]?.balance);
    if (Number.isFinite(next)) window.dispatchEvent(new CustomEvent("tregu:balance", { detail: next }));
    if (accept && duel.stake > 0) setPayment({ amount: duel.stake, pot: duel.stake * 2, league: duel.rival, kind: "duel" });
    void load();
  };

  const turnOnPush = async () => setPush(await enableLeaguePush());

  return (
    <section className="rivalry" aria-label="Rivaliteti">
      <LeaguePay payment={payment} onDone={() => setPayment(null)} />
      <header className="rivalry-head">
        <strong>{overtaken ? `${overtaken.actor ?? "Dikush"} të kaloi` : incoming.length ? "Të kanë sfiduar" : active.length ? "Duelet e tua" : "Që kur ishe këtu"}</strong>
        <div className="rivalry-head-actions">
          {push === "idle" && (
            <button type="button" className="rivalry-bell" onClick={() => void turnOnPush()}>
              <Bell size={14} aria-hidden /> Më njofto kur më kalojnë
            </button>
          )}
          {push === "on" && <span className="rivalry-bell" data-on><BellRing size={14} aria-hidden /> Njoftimet ndezur</span>}
          {push === "denied" && <span className="rivalry-bell" data-off>Njoftimet janë bllokuar në shfletues</span>}
          <button type="button" className="rivalry-close" onClick={() => void dismiss()} aria-label="Mbyll"><X size={16} /></button>
        </div>
      </header>

      {incoming.map((duel) => (
        <div key={duel.id} className="rivalry-challenge">
          <span className="rivalry-icon" data-tone="gold"><Swords size={16} aria-hidden /></span>
          <p><b>{duel.rival}</b> të sfidoi te {duel.league_name}{duel.stake ? <> · <em>{duel.stake} 383C secili</em></> : " · për nder"}</p>
          <div className="rivalry-answer">
            <button type="button" className="rivalry-accept" disabled={busy === duel.id} onClick={() => void respond(duel, true)}>
              <Check size={15} aria-hidden /> Prano{duel.stake ? ` · ${duel.stake}` : ""}
            </button>
            <button type="button" className="rivalry-decline" disabled={busy === duel.id} onClick={() => void respond(duel, false)}>Refuzo</button>
          </div>
        </div>
      ))}

      {active.map((duel) => {
        // Your side of the bar: half at a tie, leaning toward whoever leads,
        // never pinned to an edge so the loser can still see a way back.
        const lead = (duel.my_net - duel.rival_net) / (Math.abs(duel.my_net) + Math.abs(duel.rival_net) + 20);
        const share = Math.round(50 + Math.max(-35, Math.min(35, lead * 50)));
        return (
          <div key={duel.id} className="rivalry-duel" style={{ "--share": `${share}%` } as CSSProperties}>
            <div className="rivalry-duel-names">
              <span>Ti <b data-tone={duel.my_net >= duel.rival_net ? "up" : "down"}>{signed(duel.my_net)}</b></span>
              <small>{duel.ends_at ? `${untilLabel(Date.parse(duel.ends_at), now)} mbetur` : ""}{duel.stake ? ` · poti ${duel.stake * 2}` : ""}</small>
              <span><b>{signed(duel.rival_net)}</b> {duel.rival}</span>
            </div>
            <div className="rivalry-duel-bar" aria-label={`Ti ${signed(duel.my_net)}, ${duel.rival} ${signed(duel.rival_net)}`}><i /></div>
          </div>
        );
      })}

      {events.slice(0, 4).map((event) => {
        const line = eventLine(event);
        if (!line) return null;
        return (
          <div key={event.id} className="rivalry-event">
            <span className="rivalry-icon" data-tone={line.tone}>{line.icon}</span>
            <p>{line.text}</p>
          </div>
        );
      })}

      {error && <p className="rivalry-error" role="alert">{error}</p>}
      {(overtaken || active.length > 0) && (
        <Link href="/tregu#tregjet-aktive" className="rivalry-cta" onClick={() => void supabase.rpc("tregu_mark_league_events_seen")}>
          Tregto tani dhe kaloji
        </Link>
      )}
    </section>
  );
}
