"use client";

// Your duels, pinned at the top of the floor: a challenge waiting for an
// answer, a duel in play with the live score, or one that just finished.
// A duel lasts 24 hours, so anything that matters is here the moment the
// reader lands on Tregu, not buried in a league page.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Swords, X } from "lucide-react";
import SwordClash from "@/components/tregu/sword-clash";
import { createClient } from "@/lib/supabase/client";
import { leagueError, type Duel } from "@/lib/tregu-leagues";
import { fmtNum } from "@/lib/format";

function timeLeft(iso: string | null, now: number) {
  if (!iso) return null;
  const ms = Date.parse(iso) - now;
  if (!Number.isFinite(ms) || ms <= 0) return "po mbaron";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours} orë ${minutes} min mbetur` : `${Math.max(1, minutes)} min mbetur`;
}

const first = (name: string) => name.split(/\s+/)[0] || name;

/* Finished duels are shown once: closed with ×, or after 4 s on screen, they
   never pin again in this browser. Per browser, so another device shows a
   result one more time. Storage may be missing (private mode): then a result
   simply shows for its 24 hours, as before. */
const SEEN_KEY = "tregu:duels-seen";
function readSeen(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
function markSeen(id: string) {
  try {
    const next = [id, ...readSeen().filter((seen) => seen !== id)].slice(0, 50);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

/** Marks a finished duel seen once it has been at least 60% visible for 4 s. */
function SettledCard({ id, kind, children }: { id: string; kind: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) timer = window.setTimeout(() => markSeen(id), 4000);
      else if (timer) window.clearTimeout(timer);
    }, { threshold: 0.6 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [id]);
  return <article ref={ref} className="tregu-duel-card" data-kind={kind}>{children}</article>;
}

/**
 * The reader's duels, loaded as soon as the page knows they are signed in, in
 * parallel with everything else, so the pin can appear with the floor.
 */
export function useMyDuels(enabled: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("tregu_my_duels");
    const seen = new Set(readSeen());
    setDuels(((data ?? []) as Duel[]).filter((duel) =>
      duel.status === "pending" ||
      duel.status === "active" ||
      // A result stays until it has been seen once, and at most a day.
      (duel.status === "settled" && !seen.has(duel.id) && duel.ends_at != null && Date.now() - Date.parse(duel.ends_at) < 24 * 3_600_000)
    ));
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const refresh = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(refresh);
  }, [enabled, load]);

  return { duels, loaded, reload: load };
}

export default function DuelPin({ duels, onChanged }: { duels: Duel[]; /** Re-read after an answer. */ onChanged?: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [clash, setClash] = useState(0);
  const [closed, setClosed] = useState<string[]>([]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const respond = async (duel: Duel, accept: boolean) => {
    setBusy(duel.id);
    setMessage(null);
    const { data, error } = await supabase.rpc("tregu_duel_respond", { p_duel_id: duel.id, p_accept: accept });
    setBusy(null);
    if (error) {
      setMessage({ ok: false, text: leagueError(error) });
      return;
    }
    const balance = Number((data as { balance: number }[] | null)?.[0]?.balance);
    if (Number.isFinite(balance)) window.dispatchEvent(new CustomEvent("tregu:balance", { detail: balance }));
    if (accept) setClash((n) => n + 1);
    setMessage({ ok: true, text: accept ? `Dueli me ${first(duel.rival)} nisi. 24 orë, kush mbledh më shumë pikë.` : "Sfida u refuzua." });
    onChanged?.();
  };

  const visible = duels.filter((duel) => !closed.includes(duel.id));
  if (visible.length === 0) return <SwordClash run={clash} />;

  return (
    <section className="tregu-duel-pin" aria-label="Duelet e tua">
      <header>
        <span className="tregu-duel-pin-mark" aria-hidden><Swords size={15} strokeWidth={2.4} /></span>
        <strong>Duelet e tua</strong>
        <span>{visible.length}</span>
      </header>
      <div className="tregu-duel-pin-list">
        {visible.map((duel) => {
          const rival = first(duel.rival);
          const total = Math.max(1, Number(duel.my_net) + Number(duel.rival_net));
          const share = Math.round((Number(duel.my_net) / total) * 100);
          const pot = Number(duel.stake) * 2;
          if (duel.status === "pending" && !duel.i_am_challenger) {
            return (
              <article key={duel.id} className="tregu-duel-card" data-kind="incoming">
                <p className="tregu-duel-kicker">Sfidë e re · {duel.league_name}</p>
                <p className="tregu-duel-line"><b>{rival}</b> të sfidoi për 24 orë{duel.stake ? <> · <b>{fmtNum(duel.stake)} 383C</b> secili, fituesi merr {fmtNum(pot)}</> : " · për nder"}.</p>
                <div className="tregu-duel-actions">
                  <button type="button" className="tregu-duel-accept" disabled={busy === duel.id} onClick={() => void respond(duel, true)}>
                    {busy === duel.id ? "…" : `Prano${duel.stake ? ` · ${fmtNum(duel.stake)}` : ""}`}
                  </button>
                  <button type="button" className="tregu-duel-decline" disabled={busy === duel.id} onClick={() => void respond(duel, false)}>Refuzo</button>
                </div>
              </article>
            );
          }
          if (duel.status === "pending") {
            return (
              <article key={duel.id} className="tregu-duel-card" data-kind="waiting">
                <p className="tregu-duel-kicker">Në pritje · {duel.league_name}</p>
                <p className="tregu-duel-line">E sfidove <b>{rival}</b>{duel.stake ? <> · {fmtNum(duel.stake)} 383C secili</> : ""}. Pret përgjigjen.</p>
              </article>
            );
          }
          if (duel.status === "settled") {
            return (
              <SettledCard key={duel.id} id={duel.id} kind={duel.won ? "won" : duel.won === false ? "lost" : "draw"}>
                <button
                  type="button"
                  className="tregu-duel-close"
                  aria-label="Mbyll rezultatin e duelit"
                  onClick={() => { markSeen(duel.id); setClosed((ids) => [...ids, duel.id]); }}
                >
                  <X size={14} aria-hidden />
                </button>
                <p className="tregu-duel-kicker">Dueli mbaroi · {duel.league_name}</p>
                <p className="tregu-duel-line">
                  {duel.won ? <>🏆 E munde <b>{rival}</b>{duel.stake ? <> · <b>+{fmtNum(pot)} 383C</b></> : ""}</> : duel.won === false ? <><b>{rival}</b> fitoi këtë herë. Sfidoje përsëri.</> : <>Barazim me <b>{rival}</b>. Bastet u kthyen.</>}
                </p>
                <p className="tregu-duel-score">Ti <b>{fmtNum(duel.my_net)}</b> · {rival} <b>{fmtNum(duel.rival_net)}</b></p>
              </SettledCard>
            );
          }
          const leading = Number(duel.my_net) >= Number(duel.rival_net);
          return (
            <Link key={duel.id} href={`/tregu/ligat/${duel.league_id}`} className="tregu-duel-card" data-kind="active" style={{ "--share": `${share}%` } as CSSProperties}>
              <p className="tregu-duel-kicker"><span className="tregu-duel-live" aria-hidden /> Duel live · {duel.league_name} · {timeLeft(duel.ends_at, now)}</p>
              <div className="tregu-duel-board">
                <span data-me><small>Ti</small><b>{fmtNum(duel.my_net)}</b></span>
                <em>{leading ? "Je përpara" : "Je prapa"}</em>
                <span><small>{rival}</small><b>{fmtNum(duel.rival_net)}</b></span>
              </div>
              <span className="tregu-duel-bar" aria-hidden><i /></span>
              {pot > 0 && <p className="tregu-duel-pot">Fituesi merr {fmtNum(pot)} 383C</p>}
            </Link>
          );
        })}
      </div>
      {message && <p className="tregu-duel-msg" data-ok={message.ok || undefined} role="status">{message.text}</p>}
      <SwordClash run={clash} />
    </section>
  );
}
