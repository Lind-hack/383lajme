"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, Trophy, X } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { streakMultiplier } from "@/lib/tregu-points.mjs";
import type { HubLeague } from "@/lib/tregu-leagues";
import "./leagues.css";

type Result = {
  kind: "pick" | "trade";
  league_id: string | null;
  league_name: string | null;
  question: string | null;
  slug: string | null;
  picked: string | null;
  won: boolean;
  amount: number;
  boosted: boolean;
  streak: number;
  at: string;
};

type Climb = { id: string; name: string; from: number; to: number };

const SEEN_KEY = "tregu:results-seen";
/** Long enough to watch the count land and read the rank, short enough to never be in the way. */
const STAY_MS = 4200;

function readSince(): string {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (raw && Number.isFinite(Date.parse(raw))) return raw;
  } catch {
    /* storage unavailable */
  }
  return new Date(Date.now() - 48 * 3_600_000).toISOString();
}
function writeSince(iso: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, iso);
  } catch {
    /* storage unavailable: the moment may show again next time */
  }
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Counts from 0 to `to` with an ease-out; lands at once under reduced motion. */
function useCountUp(to: number, run: boolean, ms = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (reducedMotion() || to <= 0) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to, run, ms]);
  return value;
}

/** The league where the reader climbed most, preferring one they just won points in. */
function bestClimb(rows: HubLeague[], wonIn: Set<string>): Climb | null {
  const climbs = rows
    .filter((row) => row?.section === "mine" && row?.is_member && Number(row?.my_rank) > 0 && Number(row?.my_rank_change) > 0)
    .map((row) => ({ id: row.id, name: row.name, to: Number(row.my_rank), from: Number(row.my_rank) + Number(row.my_rank_change), won: wonIn.has(row.id) }))
    .sort((a, b) => Number(b.won) - Number(a.won) || (b.from - b.to) - (a.from - a.to));
  return climbs[0] ? { id: climbs[0].id, name: climbs[0].name, from: climbs[0].from, to: climbs[0].to } : null;
}

/**
 * What the reader won since they last looked, as one short moment instead of
 * a ledger: the total counts up, the best climb in the standings slides, and
 * it fades on its own. The pick-by-pick list waits behind "Detajet".
 * Opens only when something won; only losses since last time moves the mark.
 */
export default function ResultsReveal({ loggedIn }: { loggedIn: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [results, setResults] = useState<Result[] | null>(null);
  const [climb, setClimb] = useState<Climb | null>(null);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [details, setDetails] = useState(false);
  const [held, setHeld] = useState(false);
  const checkedAt = useRef<string>("");

  useEffect(() => {
    if (!loggedIn) return;
    let live = true;
    const since = readSince();
    checkedAt.current = new Date().toISOString();
    void supabase.rpc("tregu_my_recent_results", { p_since: since }).then(async ({ data, error }) => {
      if (!live || error) return;
      const rows = (data ?? []) as Result[];
      if (!rows.some((row) => row?.won)) {
        writeSince(checkedAt.current);
        return;
      }
      const wonIn = new Set(rows.filter((row) => row?.won && row?.league_id).map((row) => String(row.league_id)));
      // The standings are a bonus: without them the moment still shows the total.
      const hub = await supabase.rpc("tregu_leagues_hub").then((reply) => reply, () => null);
      if (!live) return;
      setClimb(hub && !hub.error ? bestClimb((hub.data ?? []) as HubLeague[], wonIn) : null);
      setResults(rows);
      setOpen(true);
    });
    return () => { live = false; };
  }, [loggedIn, supabase]);

  const close = useCallback(() => {
    writeSince(checkedAt.current);
    if (reducedMotion()) {
      setOpen(false);
      return;
    }
    setLeaving(true);
    window.setTimeout(() => setOpen(false), 280);
  }, []);

  // Fades on its own unless the reader is looking closer (details, hover, focus).
  useEffect(() => {
    if (!open || details || held) return;
    const timer = window.setTimeout(close, STAY_MS);
    return () => window.clearTimeout(timer);
  }, [open, details, held, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const wins = (results ?? []).filter((row) => row?.won);
  const losses = (results ?? []).filter((row) => !row?.won);
  const points = wins.filter((row) => row.kind === "pick").reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const coins = Math.round(wins.filter((row) => row.kind === "trade").reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
  // The headline is coins when a trade paid, points otherwise.
  const lead = coins > 0 ? { value: coins, unit: "383C" } : { value: points, unit: "pikë" };
  const shown = useCountUp(lead.value, open);
  const bestStreak = Math.max(0, ...wins.filter((row) => row.kind === "pick").map((row) => Number(row.streak) || 0));
  const boosted = wins.some((row) => row.boosted);

  if (!open || !results) return null;

  return (
    <div
      className="rrm"
      data-leaving={leaving || undefined}
      data-details={details || undefined}
      role="status"
      aria-live="polite"
      aria-label={`Fitove ${lead.value} ${lead.unit}`}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <button type="button" className="rrm-x" onClick={close} aria-label="Mbyll"><X size={15} /></button>
      <div className="rrm-head">
        <span className="rrm-mark" aria-hidden><Trophy size={20} strokeWidth={2.4} /></span>
        <p className="rrm-title">Fitove</p>
      </div>
      <p className="rrm-big">
        <b>+{fmtNum(shown)}</b> <span>{lead.unit}</span>
      </p>
      {coins > 0 && points > 0 && <p className="rrm-also">dhe <b>+{fmtNum(points)}</b> pikë në ligat</p>}

      {climb && (
        <Link href={`/tregu/ligat/${climb.id}`} className="rrm-climb" onClick={() => writeSince(checkedAt.current)}>
          <span className="rrm-league">{climb.name}</span>
          <span className="rrm-rank" aria-label={`nga vendi ${climb.from} në vendin ${climb.to}`}>
            <span className="rrm-from" aria-hidden>#{climb.from}</span>
            <span className="rrm-to" aria-hidden>#{climb.to}</span>
            <span className="rrm-up" aria-hidden><ChevronUp size={14} strokeWidth={3} />{climb.from - climb.to}</span>
          </span>
        </Link>
      )}

      {(bestStreak >= 3 || boosted) && (
        <p className="rrm-why">
          {bestStreak >= 3 && <span>🔥 {bestStreak} të sakta rresht: pikët ×{streakMultiplier(bestStreak)}</span>}
          {boosted && <span>⭐ Karta e artë i dyfishoi pikët</span>}
        </p>
      )}

      {details ? (
        <ul className="rrv-list rrm-list">
          {wins.map((row, index) => (
            <li key={`${row.kind}-${row.at}-${index}`} data-won>
              <span className="rrv-tick" aria-hidden>✓</span>
              <span className="rrv-what">
                <b>{row.question ?? "Treg"}</b>
                <small>
                  {row.picked ? `${row.picked} · ` : ""}
                  {row.kind === "pick" ? row.league_name : "Tregu"}
                  {row.boosted ? " · ⭐ ×2" : ""}
                  {row.kind === "pick" && row.streak >= 3 ? ` · 🔥 ${row.streak} rresht` : ""}
                </small>
              </span>
              <em>{row.kind === "pick" ? `+${fmtNum(row.amount)}` : `+${fmtNum(Math.round(row.amount))} 383C`}</em>
            </li>
          ))}
          {losses.slice(0, 4).map((row, index) => (
            <li key={`l-${row.at}-${index}`}>
              <span className="rrv-tick" aria-hidden>·</span>
              <span className="rrv-what"><b>{row.question ?? "Treg"}</b><small>{row.picked ? `${row.picked} · ` : ""}{row.league_name ?? "Tregu"}</small></span>
              <em>0</em>
            </li>
          ))}
        </ul>
      ) : (
        <button type="button" className="rrm-more" onClick={() => setDetails(true)}>
          Detajet · {wins.length === 1 ? "1 fitore" : `${wins.length} fitore`}
        </button>
      )}
      {!details && !held && <span className="rrm-timer" aria-hidden style={{ animationDuration: `${STAY_MS}ms` }} />}
    </div>
  );
}
