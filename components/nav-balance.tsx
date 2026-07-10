"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import CoinIcon from "@/components/tregu/coin-icon";

// Last balance the user saw — lets the counter animate old → new across
// page loads (login, bonus claimed on another page, bet payout).
const PREV_KEY = "383-coin-balance";

export default function NavBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [flyCoins, setFlyCoins] = useState<number[]>([]);
  const [popping, setPopping] = useState(false);
  const numRef = useRef<HTMLSpanElement>(null);
  const balanceRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  // Counter tween old → new; writes textContent directly so the ~700ms
  // of per-frame number updates never re-render the tree.
  const runCounter = useCallback((from: number, to: number) => {
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      if (numRef.current) {
        numRef.current.textContent = Math.round(from + (to - from) * eased).toLocaleString("sq-AL");
      }
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const applyBalance = useCallback(
    (next: number) => {
      const from = balanceRef.current ?? Number(localStorage.getItem(PREV_KEY) ?? 0);
      const prev = Number.isFinite(from) ? from : 0;
      balanceRef.current = next;
      localStorage.setItem(PREV_KEY, String(next));
      setBalance(next);
      if (next === prev) return;
      runCounter(prev, next);
      if (next > prev) {
        // One quick burst — coins stream in one by one, 55ms apart.
        const n = Math.min(10, Math.max(4, Math.ceil((next - prev) / 25)));
        setFlyCoins(Array.from({ length: n }, (_, i) => performance.now() + i));
        setPopping(true);
        window.setTimeout(() => {
          setFlyCoins([]);
          setPopping(false);
        }, n * 55 + 500);
      }
    },
    [runCounter]
  );

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const supabase = createClient();
    let cancelled = false;

    const load = () => {
      fetch("/api/tregu/portfolio")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const coins = d.profile?.coins;
          if (typeof coins === "number") applyBalance(coins);
        })
        .catch(() => {});
    };

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user && !cancelled) load();
      })
      .catch(() => {});

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) load();
      if (event === "SIGNED_OUT") {
        balanceRef.current = null;
        setBalance(null);
      }
    });

    // Pages report balance changes (daily bonus, bets) via this event.
    const onBalance = (e: Event) => {
      const next = (e as CustomEvent<number>).detail;
      if (typeof next === "number") applyBalance(next);
    };
    window.addEventListener("tregu:balance", onBalance);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("tregu:balance", onBalance);
      cancelAnimationFrame(rafRef.current);
    };
  }, [applyBalance]);

  if (balance === null) return null;

  return (
    <Link
      href="/tregu/portofoli"
      className="nav-coin-chip"
      data-anim={popping ? "true" : undefined}
      title="383 Coin — portofoli im"
    >
      {flyCoins.map((id, i) => (
        <span key={id} className="nav-coin-fly" style={{ animationDelay: `${i * 55}ms` }} aria-hidden>
          <CoinIcon size={16} />
        </span>
      ))}
      <CoinIcon size={17} />
      <span ref={numRef}>{balance.toLocaleString("sq-AL")}</span>
    </Link>
  );
}
