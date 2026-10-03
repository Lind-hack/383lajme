"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useFocusTrap } from "@/components/tregu/use-focus-trap";
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

const SEEN_KEY = "tregu:results-seen";

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
    /* storage unavailable: the sheet may show again next time */
  }
}

/**
 * "Rezultatet e tua": what won since the reader last looked — league picks
 * with the points they earned (streak and card included) and trades that
 * paid out. Opens once when there is at least one win; closing it moves the
 * mark forward. Only losses since last time: nothing opens, the mark moves.
 */
export default function ResultsReveal({ loggedIn }: { loggedIn: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [results, setResults] = useState<Result[] | null>(null);
  const [open, setOpen] = useState(false);
  const checkedAt = useRef<string>("");
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useFocusTrap(panel, open);

  useEffect(() => {
    if (!loggedIn) return;
    let live = true;
    const since = readSince();
    checkedAt.current = new Date().toISOString();
    void supabase.rpc("tregu_my_recent_results", { p_since: since }).then(({ data, error }) => {
      if (!live || error) return;
      const rows = (data ?? []) as Result[];
      if (rows.some((row) => row.won)) {
        setResults(rows);
        opener.current = document.activeElement;
        setOpen(true);
      } else {
        writeSince(checkedAt.current);
      }
    });
    return () => { live = false; };
  }, [loggedIn, supabase]);

  const close = () => {
    writeSince(checkedAt.current);
    setOpen(false);
    if (opener.current instanceof HTMLElement) opener.current.focus();
  };

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close only writes storage and state; it needs no re-subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !results) return null;
  const wins = results.filter((row) => row.won);
  const losses = results.filter((row) => !row.won);
  const points = wins.filter((row) => row.kind === "pick").reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const coins = wins.filter((row) => row.kind === "trade").reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <div className="rrv-backdrop" onClick={close}>
      <div
        ref={panel}
        className="rrv"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rrv-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="rrv-x" onClick={close} aria-label="Mbyll"><X size={16} /></button>
        <p className="rrv-kicker">Që herën e fundit</p>
        <h2 id="rrv-title">Rezultatet e tua</h2>
        <p className="rrv-total">
          {points > 0 && <span><b>+{fmtNum(points)}</b> pikë</span>}
          {coins > 0 && <span><b>+{fmtNum(Math.round(coins))}</b> 383C</span>}
        </p>
        <ul className="rrv-list">
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
        <div className="rrv-actions">
          {wins.find((row) => row.league_id) && (
            <Link href={`/tregu/ligat/${wins.find((row) => row.league_id)?.league_id}`} className="lg-btn" onClick={() => writeSince(checkedAt.current)}>
              Shiko renditjen
            </Link>
          )}
          <button type="button" className="lg-ghost" onClick={close}>Vazhdo</button>
        </div>
      </div>
    </div>
  );
}
