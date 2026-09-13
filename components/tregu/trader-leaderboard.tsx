"use client";

import { useEffect, useState } from "react";
import { Medal, Trophy } from "lucide-react";
import { fmtNum } from "@/lib/format";

type Row = { rank: number; display_name: string; profit: number; is_me: boolean };
type Board = { monthly: Row[]; weekly: Row[]; available: boolean };

/**
 * The three metals, and the one place they are defined.
 *
 * Each tier's colour does double duty: it fills the trophy and it paints the
 * strip down the left edge of that row, so a glance at the strip reads the
 * standing without reading the number. Ranks past third get no metal and no
 * strip — that absence is what makes the top three look won rather than merely
 * listed.
 */
const METALS = [
  { name: "gold", ink: "#8A6A12", fill: "#E3B341", strip: "#E3B341", wash: "rgba(227, 179, 65, 0.13)" },
  { name: "silver", ink: "#5F6470", fill: "#B4BAC4", strip: "#B4BAC4", wash: "rgba(180, 186, 196, 0.14)" },
  { name: "bronze", ink: "#7A4A1E", fill: "#C58A4B", strip: "#C58A4B", wash: "rgba(197, 138, 75, 0.13)" },
] as const;

function Standing({ rank }: { rank: number }) {
  const metal = METALS[rank - 1];
  if (!metal) return <span className="tregu-lb-rank">{rank}</span>;
  // First place gets the cup, second and third get medals: three identical
  // trophies in three tints reads as a palette swatch, not a podium.
  const Glyph = rank === 1 ? Trophy : Medal;
  return (
    <span className="tregu-lb-medal" data-metal={metal.name} aria-hidden>
      <Glyph size={rank === 1 ? 19 : 17} strokeWidth={2} />
    </span>
  );
}

function Standings({
  title,
  note,
  rows,
  prizes,
  available,
}: {
  title: string;
  note: string;
  rows: Row[];
  prizes: readonly number[];
  available: boolean;
}) {
  // The podium always has three seats. An unclaimed seat still shows its prize,
  // because the prize is the reason to look at the board at all — an empty
  // board that says nothing is just a gap where an offer should be.
  const seats = [0, 1, 2].map((i) => ({ prize: prizes[i], row: rows.find((r) => r.rank === i + 1) ?? null }));
  const rest = rows.filter((r) => r.rank > 3);

  return (
    <section className="tregu-lb-board">
      <header className="tregu-lb-head">
        <h4>{title}</h4>
        <span>{note}</span>
      </header>

      <ol className="tregu-lb-list">
        {seats.map(({ prize, row }, i) => {
          const metal = METALS[i];
          return (
            <li
              key={i}
              className="tregu-lb-row"
              data-metal={metal.name}
              data-me={row?.is_me || undefined}
              data-empty={row ? undefined : ""}
              style={{ "--metal": metal.strip, "--metal-ink": metal.ink, "--metal-wash": metal.wash } as React.CSSProperties}
            >
              <Standing rank={i + 1} />
              <span className="tregu-lb-name">
                {row ? row.display_name : <i>Vendi i lirë</i>}
                {row?.is_me && <b className="tregu-lb-you">Ti</b>}
              </span>
              {row && <span className="tregu-lb-profit">+{fmtNum(row.profit)}</span>}
              <span className="tregu-lb-prize">{fmtNum(prize)} 383C</span>
            </li>
          );
        })}

        {rest.map((row) => (
          <li key={row.rank} className="tregu-lb-row" data-me={row.is_me || undefined} data-plain="">
            <span className="tregu-lb-rank">{row.rank}</span>
            <span className="tregu-lb-name">
              {row.display_name}
              {row.is_me && <b className="tregu-lb-you">Ti</b>}
            </span>
            <span className="tregu-lb-profit">+{fmtNum(row.profit)}</span>
            <span className="tregu-lb-prize" data-none="" />
          </li>
        ))}
      </ol>

      {!available && <p className="tregu-lb-empty">Renditja fillon sapo të mbyllen tregtitë e para.</p>}
    </section>
  );
}

/**
 * Best traders of the month and of the week, by realized profit.
 *
 * Monthly leads because it carries the bigger pool; the week is the way back in
 * for anyone who cannot win the month. Both boards mark the reader's own row,
 * and the function behind them appends that row even when it sits outside the
 * top five — so the card answers "where am I" for everyone, not only for the
 * five people who need no answer.
 */
export default function TraderLeaderboard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [prizes, setPrizes] = useState({ monthly: [500, 300, 150], weekly: [125, 75, 40] });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/tregu/leaderboard", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d) return;
          setBoard({ monthly: d.monthly ?? [], weekly: d.weekly ?? [], available: Boolean(d.available) });
          if (d.prizes) setPrizes(d.prizes);
        })
        .catch(() => {
          if (!cancelled) setBoard({ monthly: [], weekly: [], available: false });
        });
    };
    load();
    // A settled trade changes the standings; the balance event is the cheapest
    // signal that one landed.
    window.addEventListener("tregu:balance", load);
    return () => {
      cancelled = true;
      window.removeEventListener("tregu:balance", load);
    };
  }, []);

  if (!board) {
    return <div className="tregu-glass tregu-lb tregu-skeleton" style={{ height: 232, opacity: 0.5 }} aria-hidden />;
  }

  return (
    <section className="tregu-glass tregu-lb tregu-edge" aria-label="Tregtarët më të mirë">
      <div className="tregu-lb-title">
        <span className="tregu-lb-title-mark" aria-hidden><Trophy size={14} strokeWidth={2.4} /></span>
        <h3>Tregtarët më të mirë</h3>
        <p>Fitimi nga tregtitë e mbyllura. Shpërblimet shtohen automatikisht në fund të periudhës.</p>
      </div>

      <div className="tregu-lb-boards">
        <Standings
          title="Muaji"
          note="30 ditët e fundit"
          rows={board.monthly}
          prizes={prizes.monthly}
          available={board.available}
        />
        <Standings
          title="Java"
          note="7 ditët e fundit"
          rows={board.weekly}
          prizes={prizes.weekly}
          available={board.available}
        />
      </div>
    </section>
  );
}
