"use client";

// The interactive Tregu tutorial. A full-screen sandbox that runs a mock
// market end to end in three acts: pick a side, buy with practice Coin, sell it
// back. It never touches /api/tregu/* — the pricing comes from the same pure
// LMSR helpers the real bet slip uses, so the numbers a newcomer learns here
// are the numbers they'll see.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, DUR } from "@/lib/tokens";
import TourCursor, { type CursorScript } from "@/components/tour-cursor";
import TutorialChart from "@/components/tregu/tutorial-chart";
import { previewBet, previewSell, lmsrPriceYes, type BinarySide } from "@/lib/tregu-client";

const STORAGE_KEY = "383:tour:tregu-trade";
const OPEN_EVENT = "383-tour-open";
const TOUR_ID = "tregu-trade";
const QUICK_AMOUNTS = [10, 25, 50, 100];
const START_BALANCE = 500;
const SEED = { q_yes: 60, q_no: 0, b: 150 };

/** Re-open the tutorial from the "Si funksionon" button. */
export function openTradeTutorial() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: TOUR_ID }));
}

/* ── mock history ─────────────────────────────────────────────────────────── */

/** Deterministic walk that ends on the seed price, so the line and the tiles agree. */
const BASE_SERIES: number[] = (() => {
  const end = lmsrPriceYes(SEED.q_yes, SEED.q_no, SEED.b);
  const n = 52;
  const out: number[] = [];
  let seed = 383;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296 - 0.5;
  };
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Slow drift up with a dip a third of the way in — enough shape that the
    // line reads as a story rather than a straight rule.
    const trend = 0.41 + t * (end - 0.41) - Math.max(0, 0.09 - Math.abs(t - 0.34) * 0.55);
    out.push(Math.min(0.97, Math.max(0.03, trend + rnd() * 0.028)));
  }
  out[n - 1] = end;
  return out;
})();

/* ── sandbox state ────────────────────────────────────────────────────────── */

interface Sandbox {
  qYes: number;
  qNo: number;
  balance: number;
  side: BinarySide;
  amount: number;
  /** Shares held on `heldSide`. */
  shares: number;
  heldSide: BinarySide;
  staked: number;
  /** Buys + sells, exactly what the market header counts. */
  trades: number;
  /** Prices written by the practice trades — appended to the chart. */
  tail: number[];
}

const INITIAL: Sandbox = {
  qYes: SEED.q_yes,
  qNo: SEED.q_no,
  balance: START_BALANCE,
  side: "PO",
  amount: 25,
  shares: 0,
  heldSide: "PO",
  staked: 0,
  trades: 0,
  tail: [],
};

type Action =
  | { type: "reset" }
  | { type: "side"; side: BinarySide }
  | { type: "amount"; amount: number }
  | { type: "buy" }
  | { type: "sell" };

function reducer(state: Sandbox, action: Action): Sandbox {
  switch (action.type) {
    case "reset":
      return { ...INITIAL };

    case "side":
      return state.shares > 0 ? state : { ...state, side: action.side };

    case "amount":
      return { ...state, amount: action.amount };

    case "buy": {
      const coins = Math.min(state.amount, state.balance);
      if (!(coins > 0) || state.shares > 0) return state;
      const book = { q_yes: state.qYes, q_no: state.qNo, b: SEED.b };
      const { shares } = previewBet(book, state.side, coins);
      if (!Number.isFinite(shares) || shares <= 0) return state;
      const qYes = state.side === "PO" ? state.qYes + shares : state.qYes;
      const qNo = state.side === "JO" ? state.qNo + shares : state.qNo;
      return {
        ...state,
        qYes,
        qNo,
        balance: state.balance - coins,
        shares,
        heldSide: state.side,
        staked: coins,
        trades: state.trades + 1,
        tail: [...state.tail, lmsrPriceYes(qYes, qNo, SEED.b)],
      };
    }

    case "sell": {
      if (!(state.shares > 0)) return state;
      const book = { q_yes: state.qYes, q_no: state.qNo, b: SEED.b };
      const { coins } = previewSell(book, state.heldSide, state.shares);
      const qYes = state.heldSide === "PO" ? state.qYes - state.shares : state.qYes;
      const qNo = state.heldSide === "JO" ? state.qNo - state.shares : state.qNo;
      return {
        ...state,
        qYes,
        qNo,
        balance: state.balance + coins,
        shares: 0,
        staked: 0,
        trades: state.trades + 1,
        tail: [...state.tail, lmsrPriceYes(qYes, qNo, SEED.b)],
      };
    }
  }
}

/* ── acts ─────────────────────────────────────────────────────────────────── */

type ActKey = "side" | "buy" | "exit";

/**
 * `cue` is the line that hands the act over to the user; `cueDone` is what we
 * say back once they've done it. Every act has exactly one thing to press.
 */
interface Act {
  key: ActKey;
  title: string;
  body: string;
  cue: string;
  cueDone: string;
}

const ACTS: Act[] = [
  {
    key: "side",
    title: "Zgjidh një anë",
    body: "Përqindja tregon sa e mundur e sheh tregu. Ana më e lirë paguan më shumë.",
    cue: "Prek PO ose JO.",
    cueDone: "Kaq. Ana më pak e pritur paguan më shumë.",
  },
  {
    key: "buy",
    title: "Vër 25 Coin prove",
    body: "Coin-at janë falas dhe të provës. Asgjë reale nuk preket.",
    cue: "Sa Coin? Prek një çip.",
    cueDone: "E bëre. Shiko bilancin lart.",
  },
  {
    key: "exit",
    title: "Dil kur të duash",
    body: "Shit dhe Coin-at kthehen. Nëse vija lëviz për ty, kthen më shumë.",
    cue: "Shtyp Shit.",
    cueDone: "E bëre. Hyre dhe dole.",
  },
];

/**
 * Act 2's cue, handed over one move at a time. The index is `betStep`, so the
 * line always names the single control that is currently wearing the ring.
 */
const BET_CUES = ["Sa Coin? Prek një çip.", "Shtyp Blej."];

const MOCK_QUESTION = "A do të nënshkruhet marrëveshja para fundit të muajit?";

/* ── component ────────────────────────────────────────────────────────────── */

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("sq-AL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * A number that lands instead of swapping. Changing the key remounts it, which
 * replays the spring — the balance and the trade counter are the two figures
 * the sandbox exists to make a newcomer notice moving.
 */
function Tick({ value, motionOn }: { value: string; motionOn: boolean }) {
  if (!motionOn) return <strong>{value}</strong>;
  return (
    <motion.strong
      key={value}
      // Full transform strings, not the x/scale shorthands: these fire the same
      // frame the sandbox recomputes its LMSR preview.
      initial={{ transform: "scale(0.74)", opacity: 0 }}
      animate={{ transform: "scale(1)", opacity: 1 }}
      transition={{
        transform: { type: "spring", duration: 0.5, bounce: 0.3 },
        opacity: { duration: DUR.fast, ease: EASE },
      }}
    >
      {value}
    </motion.strong>
  );
}

/** Twelve coins thrown outward, once, when the practice trade closes. */
const BURST = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  return { x: Math.cos(angle) * 128, y: Math.sin(angle) * 54 };
});

export default function TradeTutorial() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [state, dispatch] = useReducer(reducer, INITIAL);

  /** Which side the user picked — null until they press one of the two tiles. */
  const [tappedSide, setTappedSide] = useState<BinarySide | null>(null);
  /**
   * Act 2 is walked one move at a time — amount, then Blej — rather than
   * handing over both at once. The flag tracks *user* presses only; the ghost
   * cursor never ticks a step off on the reader's behalf.
   */
  const [pickedAmount, setPickedAmount] = useState(false);
  /** The receipt that flies off the wallet when a practice trade settles. */
  const [flash, setFlash] = useState<{ id: number; text: string; tone: "out" | "in" } | null>(null);
  const flashSeq = useRef(0);
  const flashTimer = useRef(0);

  const current = ACTS[act];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Phone widths get the tap disc instead of an arrow pointer.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const start = useCallback(() => {
    dispatch({ type: "reset" });
    setTappedSide(null);
    setPickedAmount(false);
    setFlash(null);
    setAct(0);
    setOpen(true);
  }, []);

  /** One receipt at a time; a second trade retargets the same slot. */
  const showFlash = useCallback((text: string, tone: "out" | "in") => {
    flashSeq.current += 1;
    const id = flashSeq.current;
    setFlash({ id, text, tone });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      setFlash((f) => (f && f.id === id ? null : f));
    }, 1600);
  }, []);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const close = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode — it simply offers itself again next visit */
    }
  }, []);

  /** Closing from the last act hands the user straight to the real slip. */
  const finish = useCallback(() => {
    close();
    window.setTimeout(() => {
      const slip = document.querySelector<HTMLElement>(
        "aside.tregu-detail-side .tregu-panel.tregu-edge"
      );
      if (!slip) return;
      slip.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      // Logged out the slip holds only the "Hyr / Regjistrohu" anchor, so the
      // handoff has to accept a link as well as the real amount input.
      slip.querySelector<HTMLElement>("button, input, a[href]")?.focus({ preventScroll: true });
    }, 120);
  }, [close, reduced]);

  // First market page a visitor opens gets it; after that it is on demand only.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = "1";
    }
    if (stored === "1") return;
    const timer = window.setTimeout(start, 900);
    return () => window.clearTimeout(timer);
  }, [start]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id && id !== TOUR_ID) return;
      start();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [start]);

  // The overlay owns the screen while it is up.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const points = useMemo(() => [...BASE_SERIES, ...state.tail], [state.tail]);
  const price = lmsrPriceYes(state.qYes, state.qNo, SEED.b);

  const preview = useMemo(() => {
    const coins = Math.min(state.amount, state.balance);
    if (!(coins > 0)) return null;
    const result = previewBet({ q_yes: state.qYes, q_no: state.qNo, b: SEED.b }, state.side, coins);
    if (!Number.isFinite(result.shares) || result.shares <= 0) return null;
    return { ...result, coins };
  }, [state.amount, state.balance, state.qYes, state.qNo, state.side]);

  const exitValue = useMemo(() => {
    if (!(state.shares > 0)) return null;
    return previewSell({ q_yes: state.qYes, q_no: state.qNo, b: SEED.b }, state.heldSide, state.shares);
  }, [state.shares, state.heldSide, state.qYes, state.qNo]);

  /** Both trades go through here so the wallet receipt never lies about them. */
  const buy = useCallback(() => {
    if (!preview) return;
    dispatch({ type: "buy" });
    showFlash(`−${fmt(preview.coins)} 383C · +${fmt(preview.shares, 1)} aksione`, "out");
  }, [preview, showFlash]);

  const sell = useCallback(() => {
    if (!exitValue) return;
    dispatch({ type: "sell" });
    showFlash(`+${fmt(exitValue.coins, 2)} 383C mbrapsht`, "in");
  }, [exitValue, showFlash]);

  /** One side control for the whole tutorial: the tiles are the slip. */
  const pickSide = useCallback((side: BinarySide) => {
    dispatch({ type: "side", side });
    setTappedSide(side);
  }, []);

  const pickAmount = useCallback((amount: number) => {
    dispatch({ type: "amount", amount });
    setPickedAmount(true);
  }, []);

  /**
   * Where act 2 has got to: 0 waiting on an amount, 1 on Blej, 2 done. Only one
   * control wears the ring at a time, so there is always exactly one thing to
   * press.
   */
  const betStep = state.shares > 0 ? 2 : !pickedAmount ? 0 : 1;
  const onBet = current.key === "buy";
  /** The sold face of act 3 — the practice trade is closed and counted. */
  const sold = state.trades >= 2 && state.shares === 0;

  // Acts 2 and 3 are gated: the point is that the user does it, not watches it.
  // The buy gate counts trades rather than holdings, so stepping back after the
  // sell doesn't strand the reader on an act they already finished.
  const blocked =
    (current.key === "buy" && state.trades === 0) ||
    (current.key === "exit" && state.shares > 0);

  /** Has the user done this act's task? Drives the cue and the pulse. */
  const cueDone =
    current.key === "side"
      ? tappedSide !== null
      : current.key === "buy"
        ? state.trades > 0
        : sold;

  const next = useCallback(() => {
    if (blocked) return;
    setAct((i) => Math.min(i + 1, ACTS.length - 1));
  }, [blocked]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowRight" && !blocked) {
        setAct((i) => Math.min(i + 1, ACTS.length - 1));
      } else if (event.key === "ArrowLeft") {
        setAct((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, blocked, close]);

  /* ── ghost-cursor choreography, one script per act ───────────────────────── */

  const script = useMemo<CursorScript | null>(() => {
    // One demo per move, not the whole sequence on a loop: the pointer shows
    // the control the cue is naming and then waits there for the reader.
    if (current.key === "side" && tappedSide === null) {
      return {
        loop: true,
        beats: [
          { at: '[data-tut="side-po"]', hold: 900 },
          { at: '[data-tut="side-jo"]', hold: 900 },
        ],
      };
    }

    if (current.key === "buy" && state.shares === 0) {
      if (betStep === 0) {
        return { loop: true, beats: [{ at: '[data-tut="chip-25"]', hold: 1500 }] };
      }
      return { loop: true, beats: [{ at: '[data-tut="buy"]', hold: 1600 }] };
    }

    if (current.key === "exit" && state.shares > 0) {
      return { loop: true, beats: [{ at: '[data-tut="sell"]', hold: 1500 }] };
    }

    return null;
  }, [current.key, state.shares, betStep, tappedSide]);

  if (!mounted) return null;

  const motionOn = !reduced;
  const fade = { duration: motionOn ? DUR.slow : 0, ease: EASE };
  const cueText = cueDone ? current.cueDone : onBet ? BET_CUES[betStep] : current.cue;
  /** Re-keying replays the line's entrance, so every completed move gets one. */
  const cueKey = `${current.key}-${cueDone ? "done" : onBet ? `s${betStep}` : "todo"}`;
  /**
   * Only the small act panel swaps now — the question, the chart and the tiles
   * persist across all three acts — so the swap is a lift and a fade rather
   * than the old blur mask. Exit is quicker than enter; the old panel is spent.
   */
  const stage = motionOn
    ? {
        initial: { opacity: 0, transform: "translateY(8px)" },
        animate: { opacity: 1, transform: "translateY(0px)" },
        exit: {
          opacity: 0,
          transform: "translateY(-6px)",
          transition: { duration: DUR.fast, ease: EASE },
        },
        transition: { duration: DUR.base, ease: EASE },
      }
    : { initial: false as const, animate: {}, exit: undefined, transition: { duration: 0 } };
  /** Small, subtle spring shared by the rails, the cue check and the receipt. */
  const pop = motionOn
    ? { type: "spring" as const, duration: 0.5, bounce: 0.28 }
    : { duration: 0 };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="tutorial-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          <div className="tutorial-scrim" onClick={close} aria-hidden />

          <motion.div
            className="tutorial-card tregu-scope"
            initial={motionOn ? { opacity: 0, transform: "translateY(26px) scale(0.985)" } : false}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={
              motionOn
                ? {
                    opacity: 0,
                    transform: "translateY(16px) scale(0.99)",
                    transition: { duration: DUR.base, ease: EASE },
                  }
                : undefined
            }
            transition={{
              // A modal is a deliberate arrival; it lands with a little weight
              // and leaves fast. Symmetric timing would make it feel sticky.
              transform: motionOn ? { type: "spring", duration: 0.52, bounce: 0.18 } : { duration: 0 },
              opacity: { duration: motionOn ? DUR.base : 0, ease: EASE },
            }}
          >
            <header className="tutorial-head">
              <span className="tour-eyebrow">
                <span aria-hidden />
                Si tregtohet
              </span>
              <div className="tutorial-wallet" data-focus={state.shares > 0 ? "" : undefined}>
                <span>
                  Bilanc prove{" "}
                  <Tick value={`${fmt(state.balance)} 383C`} motionOn={motionOn} />
                </span>
                <span>
                  Tregtime{" "}
                  <span data-tut="trade-count">
                    <Tick value={String(state.trades)} motionOn={motionOn} />
                  </span>
                </span>
                <AnimatePresence>
                  {flash && (
                    <motion.span
                      key={flash.id}
                      className="tutorial-flash"
                      data-tone={flash.tone}
                      role="status"
                      initial={motionOn ? { opacity: 0, transform: "translateY(8px)" } : false}
                      animate={{ opacity: 1, transform: "translateY(0px)" }}
                      exit={
                        motionOn
                          ? {
                              opacity: 0,
                              transform: "translateY(-14px)",
                              transition: { duration: DUR.slow, ease: EASE },
                            }
                          : undefined
                      }
                      transition={{ transform: pop, opacity: { duration: DUR.fast, ease: EASE } }}
                    >
                      {flash.text}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <button type="button" className="tutorial-close" onClick={close} aria-label="Mbyll">
                ✕
              </button>
            </header>

            <div className="tour-rails" data-spring aria-hidden>
              {ACTS.map((_, i) => (
                <span key={i}>
                  <motion.i
                    initial={false}
                    animate={{ transform: i <= act ? "scaleX(1)" : "scaleX(0)" }}
                    transition={pop}
                  />
                </span>
              ))}
            </div>

            <div className="tutorial-body">
              <div className="tutorial-copy">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={current.key}
                    initial={motionOn ? { opacity: 0, transform: "translateY(10px)" } : false}
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={motionOn ? { opacity: 0, transform: "translateY(-8px)" } : undefined}
                    transition={{ duration: motionOn ? DUR.base : 0, ease: EASE }}
                  >
                    <h3 id="tutorial-title">
                      <span className="tutorial-step">
                        {act + 1}/{ACTS.length}
                      </span>
                      {current.title}
                    </h3>
                    <p>{current.body}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="tutorial-stage">
                <div className="tutorial-question">
                  <span className="tregu-pill">Treg prove</span>
                  <h4>{MOCK_QUESTION}</h4>
                </div>

                <TutorialChart points={points} reduced={reduced} showRanges={false} />

                {/* One side control for the whole run. The reducer freezes the
                    side once shares are held, so the tiles simply lock. */}
                <div className="tutorial-sides" aria-label="Përgjigjet">
                  {(["PO", "JO"] as BinarySide[]).map((s) => {
                    const p = s === "PO" ? price : 1 - price;
                    return (
                      <button
                        key={s}
                        type="button"
                        className="tutorial-side-tile"
                        data-side={s}
                        data-tut={s === "PO" ? "side-po" : "side-jo"}
                        data-on={tappedSide === s ? "" : undefined}
                        data-await={current.key === "side" && tappedSide === null ? "" : undefined}
                        disabled={state.shares > 0}
                        onClick={() => pickSide(s)}
                      >
                        <span>{s}</span>
                        <strong>{(p * 100).toFixed(1)}%</strong>
                        <em>×{(1 / p).toFixed(2)} nëse del drejt</em>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {current.key === "side" ? (
                    tappedSide && (
                      <motion.p
                        key={`reveal-${tappedSide}`}
                        className="tutorial-reveal"
                        data-side={tappedSide}
                        {...stage}
                      >
                        100 383C te <strong>{tappedSide}</strong> të kthejnë rreth{" "}
                        <strong>{fmt(100 / (tappedSide === "PO" ? price : 1 - price))} 383C</strong>{" "}
                        nëse del drejt.
                      </motion.p>
                    )
                  ) : current.key === "buy" ? (
                    <motion.div key="slip-buy" className="tutorial-slip" data-tut="slip" {...stage}>
                      <div
                        className="tutorial-chips"
                        data-await={onBet && betStep === 0 ? "" : undefined}
                      >
                        {QUICK_AMOUNTS.map((a) => (
                          <button
                            key={a}
                            type="button"
                            data-tut={`chip-${a}`}
                            data-on={state.amount === a ? "" : undefined}
                            disabled={state.shares > 0}
                            onClick={() => pickAmount(a)}
                          >
                            {a}
                          </button>
                        ))}
                      </div>

                      <p className="tutorial-line">
                        Nëse del drejt merr{" "}
                        <strong>{preview ? fmt(preview.shares, 2) : "—"} 383C</strong>
                      </p>

                      <button
                        type="button"
                        className="tutorial-confirm"
                        data-tut="buy"
                        data-await={onBet && betStep === 1 && preview ? "" : undefined}
                        disabled={!preview || state.shares > 0}
                        onClick={buy}
                      >
                        Blej {state.side} për {fmt(Math.min(state.amount, state.balance))} 383C
                      </button>
                    </motion.div>
                  ) : sold ? (
                    <motion.div key="recap" className="tutorial-recap" {...stage}>
                      <p>
                        Hyre dhe dole: <strong>{state.trades} tregtime</strong>. Bilanci i provës
                        mbylli në <strong>{fmt(state.balance)} 383C</strong>.
                      </p>
                      {motionOn && (
                        <span className="tutorial-burst" aria-hidden>
                          {BURST.map((b, i) => (
                            <motion.i
                              key={i}
                              initial={{ transform: "translate(0px, 0px) scale(0.4)", opacity: 0 }}
                              animate={{
                                transform: `translate(${b.x}px, ${b.y}px) scale(1)`,
                                opacity: [0, 1, 0],
                              }}
                              transition={{
                                transform: { type: "spring", duration: 1.1, bounce: 0.24 },
                                opacity: { duration: 1.1, times: [0, 0.18, 1], ease: EASE },
                                delay: 0.12 + i * 0.022,
                              }}
                            />
                          ))}
                        </span>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="slip-hold" className="tutorial-slip" data-tut="slip" {...stage}>
                      <p className="tutorial-line">
                        Ke <strong>{fmt(state.shares, 2)}</strong> aksione{" "}
                        <strong data-side={state.heldSide}>{state.heldSide}</strong> · vlejnë{" "}
                        <strong>{exitValue ? fmt(exitValue.coins, 2) : "0"} 383C</strong> tani
                      </p>

                      <button
                        type="button"
                        className="tutorial-confirm"
                        data-variant="sell"
                        data-tut="sell"
                        data-await=""
                        onClick={sell}
                      >
                        Shit · merr {exitValue ? fmt(exitValue.coins, 2) : "0"} 383C
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Pinned: what to do now, and what's next. Neither can be pushed
                below the fold, which is the whole reason the card is a column. */}
            <div className="tutorial-foot">
              <div className="tutorial-cue" data-done={cueDone ? "" : undefined}>
                <span className="tutorial-cue-mark" aria-hidden>
                  <AnimatePresence mode="wait" initial={false}>
                    {cueDone ? (
                      <motion.em
                        key="ok"
                        initial={motionOn ? { transform: "scale(0.4)", opacity: 0 } : false}
                        animate={{ transform: "scale(1)", opacity: 1 }}
                        transition={{
                          transform: motionOn
                            ? { type: "spring", duration: 0.44, bounce: 0.42 }
                            : { duration: 0 },
                          opacity: { duration: motionOn ? DUR.fast : 0, ease: EASE },
                        }}
                      >
                        ✓
                      </motion.em>
                    ) : (
                      <motion.em
                        key="todo"
                        className="tutorial-cue-dot"
                        initial={motionOn ? { opacity: 0 } : false}
                        animate={{ opacity: 1 }}
                        exit={motionOn ? { opacity: 0 } : undefined}
                        transition={{ duration: motionOn ? DUR.fast : 0, ease: EASE }}
                      />
                    )}
                  </AnimatePresence>
                </span>
                {/* Remounted on `cueKey`, not held open by an AnimatePresence:
                    act 2 rewrites this line twice in a row, and `mode="wait"`
                    queues each swap behind the previous exit — the ring had
                    already moved on while the line still read one move behind.
                    Same keyed-remount idiom as `Tick`. */}
                <motion.span
                  key={cueKey}
                  role="status"
                  initial={motionOn ? { opacity: 0, transform: "translateY(5px)" } : false}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  transition={{ duration: motionOn ? DUR.base : 0, ease: EASE }}
                >
                  {cueText}
                </motion.span>

                {/* Two real moves, so two real pips. They fill as the reader
                    works — the only progress shown *inside* an act. */}
                {onBet && !cueDone && (
                  <span className="tutorial-cue-steps" aria-hidden>
                    {[0, 1].map((i) => (
                      <motion.i
                        key={i}
                        data-on={i < betStep ? "" : undefined}
                        animate={{ transform: i === betStep ? "scale(1)" : "scale(0.66)" }}
                        transition={
                          motionOn ? { type: "spring", duration: 0.42, bounce: 0.34 } : { duration: 0 }
                        }
                      />
                    ))}
                  </span>
                )}
              </div>

              <div className="tour-actions">
                <button type="button" className="tour-skip" onClick={close}>
                  Kalo
                </button>
                <div className="tour-actions-right">
                  {act > 0 && (
                    <button
                      type="button"
                      className="tour-back"
                      onClick={() => setAct((i) => Math.max(0, i - 1))}
                    >
                      Mbrapa
                    </button>
                  )}
                  <button
                    type="button"
                    className="tour-next"
                    data-await={!blocked && cueDone ? "" : undefined}
                    disabled={blocked}
                    onClick={act >= ACTS.length - 1 ? finish : next}
                  >
                    {act >= ACTS.length - 1 ? "Hap kuponin" : "Vazhdo"}
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          <TourCursor script={script} active={open} reduced={reduced} touch={narrow} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
