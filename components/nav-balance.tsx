"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CoinFace from "@/components/tregu/coin-face";
import { fmtNum } from "@/lib/format";

// Last balance the user saw — lets the counter animate old → new across
// page loads (login, bonus claimed on another page, bet payout).
const PREV_KEY = "383-coin-balance";
// Set by /hyr right before redirecting a fresh login/signup. When the chip
// first renders on Tregu within the TTL, coins pour in from screen centre.
const CELEBRATE_KEY = "383-coin-celebrate";
const CELEBRATE_TTL_MS = 90_000;
const FLIGHT_MS = 1100;
const FLIGHT_STAGGER_MS = 70;
const FLIGHT_COUNT = 12;

interface FlightCoin {
  id: number;
  tx: number;
  ty: number;
  drift: number;
  delay: number;
}

function takeCelebrateFlag(): boolean {
  try {
    const raw = sessionStorage.getItem(CELEBRATE_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(CELEBRATE_KEY);
    return Date.now() - Number(raw) < CELEBRATE_TTL_MS;
  } catch {
    return false;
  }
}

export default function NavBalance() {
  const pathname = usePathname();
  // The coin balance lives in the navbar only inside the Tregu section.
  const onTregu = pathname === "/tregu" || Boolean(pathname?.startsWith("/tregu/"));

  const [balance, setBalance] = useState<number | null>(null);
  const [flyCoins, setFlyCoins] = useState<number[]>([]);
  const [flight, setFlight] = useState<FlightCoin[]>([]);
  const [popping, setPopping] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const chipRef = useRef<HTMLAnchorElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const balanceRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const timersRef = useRef<number[]>([]);

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
        numRef.current.textContent = fmtNum(from + (to - from) * eased);
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
        // Slide the "Coins earned!" card in with the amount gained.
        window.dispatchEvent(new CustomEvent("383:coins-earned", { detail: next - prev }));
        // One quick burst — coins stream in one by one, 55ms apart —
        // and the chip coin plays its earn flip.
        const n = Math.min(10, Math.max(4, Math.ceil((next - prev) / 25)));
        setFlyCoins(Array.from({ length: n }, (_, i) => performance.now() + i));
        setPopping(true);
        setSpinning(true);
        window.setTimeout(() => {
          setFlyCoins([]);
          setPopping(false);
        }, n * 55 + 500);
        window.setTimeout(() => setSpinning(false), 950);
      }
    },
    [runCounter]
  );

  // Fresh login/signup: coins pour from screen centre to the chip, tumbling,
  // then the counter climbs 0 → balance as they land.
  const celebrate = useCallback(
    (coins: number) => {
      balanceRef.current = coins;
      localStorage.setItem(PREV_KEY, String(coins));
      setBalance(coins);
      requestAnimationFrame(() => {
        if (numRef.current) numRef.current.textContent = "0";
        const rect = chipRef.current?.getBoundingClientRect();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // Chip hidden (mobile) or reduced motion: count up, skip the flight.
        if (!rect || rect.width === 0 || reduced) {
          runCounter(0, coins);
          return;
        }
        const tx = rect.left + rect.width / 2 - window.innerWidth / 2;
        const ty = rect.top + rect.height / 2 - window.innerHeight / 2;
        setFlight(
          Array.from({ length: FLIGHT_COUNT }, (_, i) => ({
            id: i,
            tx: tx + Math.random() * 36 - 18,
            ty: ty + Math.random() * 16 - 8,
            drift: Math.random() * 160 - 80,
            delay: i * FLIGHT_STAGGER_MS,
          }))
        );
        timersRef.current.push(
          window.setTimeout(() => {
            runCounter(0, coins);
            setPopping(true);
            setSpinning(true);
            window.dispatchEvent(new CustomEvent("383:coins-earned", { detail: coins }));
          }, FLIGHT_MS * 0.72),
          window.setTimeout(() => {
            setFlight([]);
            setPopping(false);
            setSpinning(false);
          }, FLIGHT_MS + FLIGHT_COUNT * FLIGHT_STAGGER_MS + 250)
        );
      });
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
          if (typeof coins !== "number") return;
          // Only consume the celebration flag where the chip is visible —
          // it survives until the user actually reaches Tregu.
          if (onTregu && takeCelebrateFlag()) celebrate(coins);
          else applyBalance(coins);
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

    const timers = timersRef.current;
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("tregu:balance", onBalance);
      cancelAnimationFrame(rafRef.current);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [applyBalance, celebrate, onTregu]);

  if (!onTregu || balance === null) return null;

  return (
    <>
      <Link
        ref={chipRef}
        href="/tregu/portofoli"
        className="nav-coin-chip"
        data-anim={popping ? "true" : undefined}
        title="383 Coin — portofoli im"
      >
        {flyCoins.map((id, i) => (
          <span key={id} className="nav-coin-fly" style={{ animationDelay: `${i * 55}ms` }} aria-hidden>
            <CoinFace size={16} shine={false} idle={false} />
          </span>
        ))}
        <CoinFace size={20} spinning={spinning} hoverTilt />
        <span ref={numRef}>{fmtNum(balance)}</span>
      </Link>
      {flight.length > 0 && (
        <div className="coin-flight-layer" aria-hidden>
          {flight.map((c) => (
            <span
              key={c.id}
              className="coin-flight"
              style={
                {
                  animationDelay: `${c.delay}ms`,
                  "--tx": `${c.tx}px`,
                  "--ty": `${c.ty}px`,
                  "--drift": `${c.drift}px`,
                } as React.CSSProperties
              }
            >
              <span className="coin-tumble">
                <CoinFace size={44} shine={false} idle={false} />
              </span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
