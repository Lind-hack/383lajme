"use client";

// The daily bonus: earned by trading, kept by coming back.
//
// Three states, all decided by the database (tregu_daily_bonus_status):
//   locked  - no buy yet today (Kosovo time); the button says how to open it
//   ready   - traded today, not claimed; the button glows
//   claimed - done for today; it shows the streak and "nesër"
// The amount (10..25, 25 = jackpot) is rolled server-side. A jackpot gets its
// own full-screen moment; every other claim uses the floor's coin flight.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Flame as FlameIcon } from "lucide-react";
import DardaniImage from "@/components/dardani/dardani-image";
import { jackpotChance } from "@/lib/tregu-daily-bonus.mjs";

export type DailyBonusStatus = {
  signed_in: boolean;
  claimed_today?: boolean;
  traded_today?: boolean;
  streak?: number;
  next_streak?: number;
};

export type DailyBonusClaim = { bonus: number; streak: number; jackpot: boolean };

export function bonusState(status: DailyBonusStatus | null): "locked" | "ready" | "claimed" | "unknown" {
  if (!status?.signed_in) return "unknown";
  if (status.claimed_today) return "claimed";
  return status.traded_today ? "ready" : "locked";
}

/** Status + claim, refreshed when the tab comes back (a trade elsewhere unlocks it). */
export function useDailyBonus(enabled: boolean) {
  const [status, setStatus] = useState<DailyBonusStatus | null>(null);
  const [claiming, setClaiming] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tregu/daily-bonus", { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as DailyBonusStatus);
    } catch {
      /* offline: the button keeps its last state */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, refresh]);

  const claim = useCallback(async (): Promise<{ ok: true; claim: DailyBonusClaim } | { ok: false; error: string }> => {
    setClaiming(true);
    try {
      const res = await fetch("/api/tregu/daily-bonus", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        void refresh();
        return { ok: false, error: String(data?.error ?? "Gabim") };
      }
      const claim = { bonus: Number(data.bonus), streak: Number(data.streak ?? 1), jackpot: Boolean(data.jackpot) };
      setStatus((current) => ({ ...(current ?? { signed_in: true }), claimed_today: true, streak: claim.streak, next_streak: claim.streak }));
      return { ok: true, claim };
    } catch {
      return { ok: false, error: "S'u lidh. Provo përsëri." };
    } finally {
      setClaiming(false);
    }
  }, [refresh]);

  return { status, claiming, claim, refresh };
}

function Flame({ size = 13 }: { size?: number }) {
  return <FlameIcon size={size} strokeWidth={2.4} className="tregu-bonus-flame" aria-hidden />;
}

function Lock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * The button. `variant` only changes size: "chip" sits in the floor header,
 * "bar" in the mobile account bar.
 */
export function DailyBonusButton({
  status,
  claiming,
  onClaim,
  onLocked,
  variant = "chip",
}: {
  status: DailyBonusStatus | null;
  claiming: boolean;
  onClaim: () => void;
  onLocked: () => void;
  variant?: "chip" | "bar";
}) {
  const state = bonusState(status);
  // The flame is the streak alive right now; the odds use the day a claim lands on.
  const alive = status?.streak ?? 0;
  const landing = status?.next_streak ?? 1;
  const label =
    claiming ? "…"
    : state === "claimed" ? "Nesër sërish"
    : state === "locked" ? "Bonusi ditor"
    : "Merr bonusin";
  const title =
    state === "locked" ? "Bëj një tregtim sot për ta hapur bonusin ditor."
    : state === "ready" ? `Sot: 10–25 383C · ${Math.round(jackpotChance(landing) * 100)}% shans për xhekpot`
    : state === "claimed" ? `Seri ${alive} ditë. Kthehu nesër që ta mbash.`
    : "Bonusi ditor";
  return (
    <button
      type="button"
      className="tregu-bonus-btn"
      data-variant={variant}
      data-state={state}
      disabled={claiming || state === "claimed"}
      aria-label={title}
      title={title}
      onClick={state === "locked" ? onLocked : onClaim}
    >
      {state === "locked" && <Lock />}
      <span>{label}</span>
      {state !== "unknown" && alive > 0 && (
        <span className="tregu-bonus-streak" aria-hidden>
          <Flame />
          {alive}
        </span>
      )}
    </button>
  );
}

/**
 * The bonus, explained in the page rather than in a popup: a bold card under
 * the floor head that is hard to miss. Dardani, the reward, a three-step track
 * (signed in → trade today → collect), the streak and today's jackpot chance.
 * Pressing the locked header button only makes it pulse.
 */
export function DailyBonusStrip({
  status,
  claiming,
  onClaim,
  onFindMarket,
  pulse,
}: {
  status: DailyBonusStatus | null;
  claiming: boolean;
  onClaim: () => void;
  onFindMarket: () => void;
  /** Bumped each time the locked button is pressed, to replay the highlight. */
  pulse: number;
}) {
  const state = bonusState(status);
  if (state === "unknown") return null;
  const alive = status?.streak ?? 0;
  const landing = status?.next_streak ?? 1;
  const chance = Math.round(jackpotChance(landing) * 100);
  const traded = state !== "locked";
  const claimed = state === "claimed";

  if (claimed) {
    // Done for today: a quiet line, the card has said its piece.
    return (
      <section className="tregu-bonus-done" aria-label="Bonusi ditor">
        <span aria-hidden>✓</span>
        <strong>Bonusi i sotëm u mor</strong>
        <span>Kthehu nesër dhe tregto që ta mbash serinë</span>
        {alive > 0 && <em><Flame size={12} /> {alive} ditë</em>}
      </section>
    );
  }

  return (
    <section key={pulse} className="tregu-bonus-card" data-state={state} data-pulse={pulse > 0 || undefined} aria-label="Bonusi ditor">
      <div className="tregu-bonus-card-dardani" aria-hidden>
        <DardaniImage name={state === "ready" ? "tregu-win" : "streak"} decorative />
      </div>
      <div className="tregu-bonus-card-main">
        <p className="tregu-bonus-card-kicker">{state === "ready" ? "🎁 Gati për ty" : "🔒 Bonusi ditor"}</p>
        <h2 className="tregu-bonus-card-title">
          {state === "ready" ? "Merr bonusin e sotëm" : <>Fito <span>10–25 383C</span> sot</>}
        </h2>
        <p className="tregu-bonus-card-lead">
          {state === "ready"
            ? `Tregtove sot. Shuma del rastësisht nga 10 deri në 25, dhe 25 është xhekpoti (${chance}% sot).`
            : "Bëj një tregtim sot, në çdo treg dhe me çdo shumë, dhe bonusi hapet. Kthehu çdo ditë që seria të rritet."}
        </p>
        <ol className="tregu-bonus-steps" aria-label="Hapat">
          <li data-done><i>✓</i>U kyçe</li>
          <li data-done={traded || undefined} data-now={!traded || undefined}><i>{traded ? "✓" : "2"}</i>Tregto sot</li>
          <li data-now={traded || undefined}><i>3</i>Merr 10–25</li>
        </ol>
      </div>
      <div className="tregu-bonus-card-side">
        <div className="tregu-bonus-card-stats">
          <span><Flame size={14} /> <b>{alive}</b> {alive === 1 ? "ditë" : "ditë"} seri</span>
          <span>🎰 <b>{chance}%</b> xhekpot</span>
        </div>
        {state === "ready" ? (
          <button type="button" className="tregu-bonus-card-cta" data-primary onClick={onClaim} disabled={claiming}>
            {claiming ? "…" : "Merr bonusin"}
          </button>
        ) : (
          <button type="button" className="tregu-bonus-card-cta" onClick={onFindMarket}>
            Gjej një treg <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </section>
  );
}

const RAIN = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 9) * 0.11,
  duration: 1.6 + ((i * 7) % 10) / 12,
  size: 16 + ((i * 5) % 14),
  spin: (i % 2 ? 1 : -1) * (200 + ((i * 53) % 260)),
}));

/** The 25-coin moment: gold light, falling coins, Dardani losing his composure. */
export function JackpotCelebration({ open, streak, onClose }: { open: boolean; streak: number; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setMounted(true);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, 5200);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="tregu-jackpot"
          role="dialog"
          aria-modal="true"
          aria-label="Xhekpot: 25 383C"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
          onClick={onClose}
        >
          <span className="tregu-jackpot-rays" aria-hidden />
          {!reduced && (
            <span className="tregu-jackpot-rain" aria-hidden>
              {RAIN.map((coin, i) => (
                <i
                  key={i}
                  style={{
                    left: `${coin.left}%`,
                    width: coin.size,
                    height: coin.size,
                    animationDelay: `${coin.delay}s`,
                    animationDuration: `${coin.duration}s`,
                    ["--spin" as string]: `${coin.spin}deg`,
                  }}
                />
              ))}
            </span>
          )}
          <motion.div
            className="tregu-jackpot-card"
            initial={reduced ? false : { transform: "scale(0.6) translateY(40px)", opacity: 0 }}
            animate={{ transform: "scale(1) translateY(0px)", opacity: 1 }}
            transition={reduced ? { duration: 0 } : { type: "spring", duration: 0.7, bounce: 0.45 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tregu-jackpot-dardani" aria-hidden>
              <DardaniImage name="tregu-win" decorative />
            </div>
            <p className="tregu-jackpot-kicker">Xhekpot</p>
            <p className="tregu-jackpot-amount">
              +25<small>383C</small>
            </p>
            <p className="tregu-jackpot-note">
              Shuma më e rrallë e ditës. {streak > 1 ? `Seri ${streak} ditë: sa më gjatë e mban, aq më shpesh bie.` : "Kthehu nesër që ta nisësh serinë."}
            </p>
            <button type="button" className="tregu-jackpot-close" onClick={onClose}>
              Vazhdo
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
