"use client";

import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowRight, List, Timer } from "lucide-react";
import PickReveal from "@/components/tregu/pick-reveal";
import { playTradeSuccessSound, primeSellSound } from "@/components/tregu/trade-success-sound";
import { untilLabel } from "@/components/tregu/trader-leaderboard";
import { fmtNum } from "@/lib/format";
import { basePoints, effectivePoints } from "@/lib/tregu-points.mjs";
import { deckOrder, projectRank, projectionLabel, type RivalPick, type Split } from "@/lib/tregu-pick-play.mjs";
import type { BoardRow, LeagueStanding, PickOption } from "@/lib/tregu-leagues";
import "./leagues.css";

/** How far a two-way card must be dragged to count as a pick. */
const SWIPE_PX = 90;

/**
 * Today's open matches as a deck, one card at a time, soonest lock first.
 * Each side says what it pays (streak included) and where it would put you.
 * Picking (tap, or swipe on a two-way match) plays the chime, reveals how the
 * league split and what your rival picked, then the next card comes in. The
 * end card adds it all up. The list stays one tap away.
 */
export default function PickDeck({
  board,
  now,
  standings,
  streak,
  onPick,
  splitOf,
  rivalOf,
  onList,
}: {
  board: BoardRow[];
  now: number;
  standings: LeagueStanding[];
  streak: number;
  onPick: (row: BoardRow, option: PickOption) => Promise<boolean>;
  splitOf: (marketId: string) => Split | null;
  rivalOf: (marketId: string) => RivalPick | null;
  onList: () => void;
}) {
  // The deck is fixed when it opens, so picking never reshuffles it.
  const [queue] = useState(() => deckOrder(board, now).map((row) => row.market_id));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [busy, setBusy] = useState(false);
  const [earnedIfRight, setEarnedIfRight] = useState(0);
  const [picked, setPicked] = useState(0);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const lastSide = useRef<"left" | "right">("right");

  const byId = useMemo(() => new Map(board.map((row) => [row.market_id, row])), [board]);
  const row = queue[index] ? byId.get(queue[index]) : undefined;
  const options = row?.options ?? [];
  const twoWay = options.length === 2;
  const payFor = (option: PickOption) => effectivePoints({
    points: basePoints(option.prob), correct: true, streakBefore: streak, boosted: false, rulesVersion: row?.rules_version ?? 1,
  });

  const choose = async (option: PickOption, side: "left" | "right") => {
    if (!row || busy || revealed) return;
    primeSellSound();
    setBusy(true);
    const ok = await onPick(row, option);
    setBusy(false);
    setDx(0);
    if (!ok) return;
    void playTradeSuccessSound("default");
    setEarnedIfRight((total) => total + payFor(option));
    setPicked((count) => count + 1);
    setLeaving(null);
    setRevealed(true);
    // Remember which way the card leaves when the reader moves on.
    lastSide.current = side;
  };

  const next = () => {
    setLeaving(lastSide.current);
    window.setTimeout(() => {
      setLeaving(null);
      setRevealed(false);
      setIndex((value) => value + 1);
    }, 240);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!twoWay || revealed || busy) return;
    drag.current = { x: event.clientX, id: event.pointerId };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    setDx(event.clientX - drag.current.x);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (Math.abs(dx) >= SWIPE_PX && twoWay) {
      void choose(dx < 0 ? options[0] : options[1], dx < 0 ? "left" : "right");
    } else {
      setDx(0);
    }
  };

  // The end of the deck: what today's picks are worth if they all land.
  if (!row || index >= queue.length) {
    const projection = projectionLabel(projectRank(standings, earnedIfRight));
    return (
      <div className="deck deck-done">
        <p className="deck-kicker">{picked ? "Gati për sot" : "Asgjë e re për sot"}</p>
        {picked > 0 ? (
          <>
            <strong className="deck-total">+{fmtNum(earnedIfRight)} <small>pikë</small></strong>
            <p>nëse dalin të {picked === 1 ? "saktë" : `${picked} parashikimet`}{projection ? ` · ${projection}` : ""}</p>
          </>
        ) : (
          <p>Ke zgjedhur për çdo ndeshje të hapur. Rezultatet vijnë sapo të mbarojnë.</p>
        )}
        <button type="button" className="lg-ghost" onClick={onList}><List size={15} aria-hidden /> Shiko të gjitha</button>
      </div>
    );
  }

  const lock = Date.parse(row.lock_at);
  const urgent = lock - now < 2 * 3_600_000;
  const tilt = Math.max(-12, Math.min(12, dx / 12));

  return (
    <div className="deck">
      <div className="deck-top">
        <span className="deck-count" aria-live="polite">{index + 1} / {queue.length}</span>
        <span className="deck-progress" aria-hidden><i style={{ width: `${(index / queue.length) * 100}%` }} /></span>
        <button type="button" className="deck-list" onClick={onList}><List size={14} aria-hidden /> Lista</button>
      </div>

      <div
        key={row.market_id}
        className="deck-card"
        data-leaving={leaving ?? undefined}
        data-dragging={dx !== 0 || undefined}
        style={dx ? ({ transform: `translateX(${dx}px) rotate(${tilt}deg)` } as CSSProperties) : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <p className="deck-when" data-urgent={urgent || undefined}>
          <Timer size={13} aria-hidden /> Mbyllet për {untilLabel(lock, now)}
        </p>
        <h3 className="deck-q">{row.question}</h3>

        {twoWay && !revealed && (
          <p className="deck-hint" aria-hidden>
            <span data-active={dx <= -SWIPE_PX / 2 || undefined}>← {options[0]?.label}</span>
            <span data-active={dx >= SWIPE_PX / 2 || undefined}>{options[1]?.label} →</span>
          </p>
        )}

        <div className="deck-opts" data-count={options.length}>
          {options.map((option, optionIndex) => {
            const pays = payFor(option);
            const move = projectionLabel(projectRank(standings, pays));
            const chosen = row.my_outcome === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className="deck-opt"
                aria-pressed={chosen}
                disabled={busy || revealed}
                onClick={() => void choose(option, optionIndex === 0 ? "left" : "right")}
                style={option.color ? ({ "--opt-color": option.color } as CSSProperties) : undefined}
              >
                {option.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={option.logo} alt="" loading="lazy" />
                ) : (
                  <i aria-hidden />
                )}
                <b>{option.label}</b>
                <small>{Math.round(Number(option.prob ?? 0) * 100)}% gjasa</small>
                <em>+{pays} pikë</em>
                {move && <span className="deck-move">{move}</span>}
              </button>
            );
          })}
        </div>

        {revealed && (
          <>
            <PickReveal row={row} split={splitOf(row.market_id)} rival={rivalOf(row.market_id)} />
            <button type="button" className="lg-btn deck-next" onClick={next} autoFocus>
              {index + 1 < queue.length ? "Tjetra" : "Përfundo"} <ArrowRight size={15} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
