"use client";

import { useEffect, useRef, useState } from "react";
import CoinFace from "@/components/tregu/coin-face";

// "Coins earned!" card — slides in from the right whenever the balance
// grows (daily bonus, bet payout, signup). Listens for the 383:coins-earned
// window event dispatched by NavBalance; the coin does its earn flip on
// entry and the amount reads as "+N".

const VISIBLE_MS = 2600;
const EXIT_MS = 340;

interface Toast {
  id: number;
  amount: number;
}

export default function CoinToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };

    const onEarned = (e: Event) => {
      const amount = (e as CustomEvent<number>).detail;
      if (typeof amount !== "number" || amount <= 0) return;
      clear();
      setLeaving(false);
      setToast({ id: performance.now(), amount });
      timers.current.push(
        window.setTimeout(() => setLeaving(true), VISIBLE_MS),
        window.setTimeout(() => setToast(null), VISIBLE_MS + EXIT_MS)
      );
    };

    window.addEventListener("383:coins-earned", onEarned);
    return () => {
      window.removeEventListener("383:coins-earned", onEarned);
      clear();
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      key={toast.id}
      className="coin-toast"
      data-leaving={leaving ? "true" : undefined}
      role="status"
      aria-live="polite"
    >
      <CoinFace size={46} numeral={`+${toast.amount}`} spinning />
      <div className="coin-toast-text">
        <span className="coin-toast-title">Monedha të fituara!</span>
        <span className="coin-toast-sub">Bilanci u përditësua</span>
      </div>
    </div>
  );
}
