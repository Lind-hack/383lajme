"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import CoinFace from "@/components/tregu/coin-face";
import { playCoinDropSound } from "@/components/tregu/trade-success-sound";
import { fmtNum } from "@/lib/format";

export type LeaguePayment = {
  /** Coins that left the wallet. */
  amount: number;
  /** The league's pot after this payment. */
  pot: number;
  league: string;
  /** "join" when entering someone's league, "create" for your own. */
  kind: "join" | "create";
};

/**
 * The moment of paying into a league: coins arc out of the top of the frame
 * and drop into a briefcase that snaps shut, then the fee and the new pot
 * settle underneath. A payment, so it is felt as one — sound included — but it
 * is over in under two seconds and never blocks: tap anywhere to skip.
 */
export default function LeaguePay({ payment, onDone }: { payment: LeaguePayment | null; onDone: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const coins = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        id: i,
        from: Math.round((i - 3) * 38 + (Math.random() - 0.5) * 18),
        delay: i * 85,
        spin: Math.round((Math.random() - 0.5) * 540),
      })),
    [payment]
  );

  useEffect(() => {
    if (!payment) return;
    void playCoinDropSound(7);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => doneRef.current(), reduce ? 1400 : 2300);
    return () => window.clearTimeout(timer);
  }, [payment]);

  if (!payment) return null;

  return (
    <div className="lpay" role="status" aria-live="polite" onClick={() => doneRef.current()}>
      <div className="lpay-stage" aria-hidden>
        {coins.map((coin) => (
          <span
            key={coin.id}
            className="lpay-coin"
            style={{ "--from": `${coin.from}px`, "--delay": `${coin.delay}ms`, "--spin": `${coin.spin}deg` } as CSSProperties}
          >
            <CoinFace size={30} idle={false} />
          </span>
        ))}
        <svg className="lpay-case" viewBox="0 0 120 92">
          <defs>
            <linearGradient id="lpay-leather" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3A2A1A" />
              <stop offset="1" stopColor="#1C140C" />
            </linearGradient>
            <linearGradient id="lpay-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFF0B8" />
              <stop offset=".5" stopColor="#F2C14E" />
              <stop offset="1" stopColor="#B8801A" />
            </linearGradient>
          </defs>
          <path d="M44 14c0-5 3-8 8-8h16c5 0 8 3 8 8v6h-8v-5H52v5h-8v-6Z" fill="url(#lpay-gold)" />
          <g className="lpay-lid">
            <rect x="6" y="20" width="108" height="26" rx="8" fill="url(#lpay-leather)" />
            <rect x="6" y="20" width="108" height="6" rx="3" fill="#fff" opacity=".07" />
          </g>
          <rect x="6" y="40" width="108" height="46" rx="8" fill="url(#lpay-leather)" />
          <rect x="6" y="40" width="108" height="3" fill="#000" opacity=".35" />
          <rect x="52" y="36" width="16" height="14" rx="3" fill="url(#lpay-gold)" />
          <rect x="18" y="80" width="6" height="6" rx="1" fill="url(#lpay-gold)" />
          <rect x="96" y="80" width="6" height="6" rx="1" fill="url(#lpay-gold)" />
        </svg>
      </div>
      <p className="lpay-amount">
        −{fmtNum(payment.amount)} <small>383C</small>
      </p>
      <p className="lpay-pot">
        {payment.kind === "create" ? "Poti i ligës tënde" : `Poti i ${payment.league}`}: <b>{fmtNum(payment.pot)} 383C</b>
      </p>
    </div>
  );
}
