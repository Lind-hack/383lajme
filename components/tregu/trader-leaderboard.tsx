"use client";

import { useEffect, useRef, useState } from "react";
import LeaguePodium from "@/components/tregu/league-podium";
import { fmtNum } from "@/lib/format";
import "./leagues.css";

type Row = { rank: number; display_name: string; profit: number; is_me: boolean };
type Board = { monthly: Row[]; weekly: Row[]; available: boolean; closes: { monthly: number; weekly: number }; prizesWon: number | null };
type Period = "monthly" | "weekly";

/** "3d 04h" / "4h 12m" / "12m" — coarse far out, precise as it matters. */
export function untilLabel(target: number, now: number): string {
  const ms = target - now;
  if (!Number.isFinite(ms) || ms <= 0) return "po mbyllet";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${Math.max(1, m)}m`;
}

/**
 * Best traders of the month and of the week, by realized profit: the same
 * podium a league shows, then where you stand, then what you have won so far.
 * The month leads because it carries the bigger prizes; the week is the way
 * back in for anyone who cannot win the month.
 */
export default function TraderLeaderboard({ loggedIn = false }: { loggedIn?: boolean }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [period, setPeriod] = useState<Period>("monthly");
  const [now, setNow] = useState(() => Date.now());
  const [prizes, setPrizes] = useState({ monthly: [500, 300, 150], weekly: [125, 75, 40] });

  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/tregu/leaderboard", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d) return;
          setBoard({
            monthly: d.monthly ?? [],
            weekly: d.weekly ?? [],
            available: Boolean(d.available),
            closes: d.closes ?? { monthly: 0, weekly: 0 },
            prizesWon: typeof d.prizes_won === "number" ? d.prizes_won : null,
          });
          if (d.prizes) setPrizes(d.prizes);
        })
        .catch(() => {
          if (!cancelled) setBoard({ monthly: [], weekly: [], available: false, closes: { monthly: 0, weekly: 0 }, prizesWon: null });
        });
    };
    load();
    // A settled trade changes the standings; the balance event is the cheapest
    // signal that one landed.
    window.addEventListener("tregu:balance", load);
    // Ticks the countdown, and reloads the board the moment a period turns over.
    const tick = window.setInterval(() => {
      setNow((previous) => {
        const next = Date.now();
        const closes = boardRef.current?.closes;
        if (closes && (previous < closes.weekly && next >= closes.weekly ||
                       previous < closes.monthly && next >= closes.monthly)) load();
        return next;
      });
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.removeEventListener("tregu:balance", load);
    };
  }, []);

  if (!board) {
    return <div className="lbp lg-paper" style={{ height: 300, opacity: 0.5 }} aria-hidden />;
  }

  const rows = board[period];
  const places = prizes[period];
  const seats = [0, 1, 2].map((index) => {
    const row = rows.find((item) => item.rank === index + 1);
    return row
      ? { name: row.display_name, value: `+${fmtNum(row.profit)}`, prize: places[index], isMe: row.is_me }
      : { name: null, prize: places[index] };
  });
  const me = rows.find((row) => row.is_me);

  return (
    <section className="lbp lg-paper" aria-labelledby="lbp-title">
      <div className="lbp-head">
        <div>
          <h3 id="lbp-title">Tregtarët më të mirë</h3>
          <p>Fitimi nga tregtitë e mbyllura. Tre të parët marrin shpërblimin kur mbyllet periudha.</p>
        </div>
        <div className="lbp-seg" role="group" aria-label="Periudha">
          <button type="button" aria-pressed={period === "monthly"} onClick={() => setPeriod("monthly")}>Muaji</button>
          <button type="button" aria-pressed={period === "weekly"} onClick={() => setPeriod("weekly")}>Java</button>
        </div>
      </div>

      <LeaguePodium seats={seats} label={period === "monthly" ? "Podiumi i muajit" : "Podiumi i javës"} />

      {loggedIn && (
        <div className="lbp-you">
          <div className="lbp-stat" data-accent={me && me.rank <= 3 ? "" : undefined}>
            <small>Renditja jote</small>
            <strong>{me ? `#${me.rank}` : "—"}</strong>
          </div>
          <div className="lbp-stat">
            <small>Fitimi {period === "monthly" ? "këtë muaj" : "këtë javë"}</small>
            <strong>{me ? `+${fmtNum(me.profit)}` : "0"}<em>383C</em></strong>
          </div>
          <div className="lbp-stat" data-accent="">
            <small>Ke fituar në shpërblime</small>
            <strong>{fmtNum(board.prizesWon ?? 0)}<em>383C</em></strong>
          </div>
        </div>
      )}

      {!board.available && <p className="lbp-foot">Renditja fillon sapo të mbyllen tregtitë e para.</p>}
      <p className="lbp-foot">
        <span>{me ? "" : loggedIn ? "Mbyll një tregti me fitim për të hyrë në renditje." : "Hyr për të parë vendin tënd."}</span>
        <span>Shpërblimet ndahen për <time>{untilLabel(board.closes[period], now)}</time></span>
      </p>
    </section>
  );
}
