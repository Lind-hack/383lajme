"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { fmtNum } from "@/lib/format";

export interface SellReceipt {
  /** What was sold: "PO", a club, a driver. */
  selection: string;
  /** Coins that came back to the wallet. */
  coins: number;
  market?: string;
  /** True when the whole position was closed. */
  closed?: boolean;
}

const VISIBLE_MS = 6500;

/**
 * The confirmation after a sale.
 *
 * A sale used to end in one line of green text inside the trade panel — and on
 * a phone the panel closed in the same tick, so the only proof it worked was a
 * number changing somewhere else. This card states the three things a seller
 * wants to know: it went through, how much came back, and where it went.
 *
 * Flat and opaque rather than glass: DESIGN.md reserves glass for panels that
 * sit over the floor, and a confirmation must read regardless of what is under
 * it. It stays until dismissed or for a few seconds, pausing while hovered or
 * focused so nobody loses it mid-read.
 */
export default function SellSuccess({
  receipt,
  balance,
  onDismiss,
}: {
  receipt: SellReceipt | null;
  balance?: number | null;
  onDismiss: () => void;
}) {
  const timer = useRef<number | undefined>(undefined);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const arm = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => dismissRef.current(), VISIBLE_MS);
  };
  const hold = () => window.clearTimeout(timer.current);

  useEffect(() => {
    if (!receipt) return;
    arm();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [receipt]);

  if (!receipt) return null;

  return (
    <div
      className="tregu-sold"
      role="status"
      aria-live="polite"
      onMouseEnter={hold}
      onMouseLeave={arm}
      onFocus={hold}
      onBlur={arm}
    >
      <span className="tregu-sold-mark" aria-hidden>
        <Check size={20} strokeWidth={3} />
      </span>
      <div className="tregu-sold-body">
        <strong className="tregu-sold-title">
          {receipt.closed ? "Pozicioni u mbyll" : "Shitja u krye"}
        </strong>
        <p className="tregu-sold-line">
          Shite <b>{receipt.selection}</b>
          {receipt.market ? <> · <span className="tregu-sold-market">{receipt.market}</span></> : null}
        </p>
        <p className="tregu-sold-amount">
          +{fmtNum(Math.round(receipt.coins * 10) / 10)} <small>383C në portofol</small>
        </p>
        {typeof balance === "number" && (
          <p className="tregu-sold-balance">Bilanci tani: {fmtNum(Math.round(balance))} 383C</p>
        )}
      </div>
      <button type="button" className="tregu-sold-close" onClick={onDismiss} aria-label="Mbyll njoftimin">
        <X size={16} />
      </button>
    </div>
  );
}
