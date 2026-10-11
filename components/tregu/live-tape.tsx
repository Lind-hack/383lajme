"use client";

// The floor's live tape: the latest real trades, the hub's pulse.
//
// Desktop runs them as a continuous marquee (paused under the pointer or
// keyboard focus). A phone has room for one trade, so it shows one at a time
// and rolls to the next every few seconds. Reduced motion gets a still,
// swipeable row on desktop and no roll on the phone.

import Link from "next/link";
import { useEffect, useState } from "react";
import TimeAgo from "@/components/time-ago";
import { fmtNum } from "@/lib/format";

export type TapeTrade = {
  name: string;
  action: string;
  side: string;
  sideLabel?: string | null;
  coins: number;
  createdAt: string;
  question: string;
  slug: string;
};

const ROLL_MS = 3600;
/** Marquee speed: seconds per trade, so a longer tape does not run faster. */
const SECONDS_PER_TRADE = 5.5;

/** A steady colour per name, so the same trader reads the same everywhere on the tape. */
function hue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/** PO/JO keep their colours; a sport outcome (team, draw, driver) is neutral ink. */
function sideTone(side: string) {
  return side === "PO" ? "po" : side === "JO" ? "jo" : "pick";
}

function Trade({ trade, format, tabIndex }: { trade: TapeTrade; format: (iso: string) => string; tabIndex?: number }) {
  const name = trade.name || "Tregtar";
  return (
    <Link href={`/tregu/${trade.slug}`} className="tregu-tape-item" tabIndex={tabIndex}>
      <span className="tregu-tape-avatar" style={{ ["--h" as string]: hue(name) }} aria-hidden>
        {name.trim().charAt(0).toLocaleUpperCase() || "T"}
      </span>
      <span className="tregu-tape-line">
        <strong className="tregu-tape-name">{name}</strong>
        <span className="tregu-tape-verb">{trade.action === "sell" ? "shiti" : "bleu"}</span>
        <span className="tregu-tape-side" data-side={sideTone(trade.side)}>
          {trade.sideLabel || trade.side}
        </span>
      </span>
      <span className="tregu-tape-coins">{fmtNum(trade.coins)} 383C</span>
      <span className="tregu-tape-q">{trade.question}</span>
      <TimeAgo iso={trade.createdAt} format={format} className="tregu-tape-time" />
    </Link>
  );
}

export default function LiveTape({ trades, format }: { trades: TapeTrade[]; format: (iso: string) => string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // The phone roll. A fresh poll can shorten the list, so the index wraps.
  useEffect(() => {
    if (reduced || paused || trades.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % trades.length), ROLL_MS);
    return () => window.clearInterval(timer);
  }, [reduced, paused, trades.length]);

  if (trades.length === 0) return null;
  const current = trades[index % trades.length];
  const marquee = !reduced && trades.length > 1;

  return (
    <section className="tregu-tape" data-tour="floor-tape" aria-label="Tregtimet e fundit">
      <span className="tregu-tape-badge">
        <span className="tregu-tape-dot" aria-hidden />
        Live
      </span>

      {/* Desktop: the whole tape. Doubled for a seamless loop; the copy is hidden from assistive tech. */}
      <div className="tregu-tape-rail" data-marquee={marquee || undefined}>
        <div className="tregu-tape-track" style={{ ["--tape-duration" as string]: `${trades.length * SECONDS_PER_TRADE}s` }}>
          <div className="tregu-tape-group">
            {trades.map((trade, i) => (
              <Trade key={`a${i}`} trade={trade} format={format} />
            ))}
          </div>
          {marquee && (
            <div className="tregu-tape-group" aria-hidden>
              {trades.map((trade, i) => (
                <Trade key={`b${i}`} trade={trade} format={format} tabIndex={-1} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Phone: one trade, rolling. Touching it holds the current one still. */}
      <div
        className="tregu-tape-stage"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div key={`${index}-${current.createdAt}`} className="tregu-tape-slide" data-animate={!reduced || undefined}>
          <Trade trade={current} format={format} />
        </div>
      </div>
    </section>
  );
}
