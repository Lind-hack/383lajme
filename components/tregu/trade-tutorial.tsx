"use client";

// The interactive Tregu tutorial. A full-screen sandbox that runs a mock
// market end to end: read the graph, place a practice bet with 383 Coin, watch
// the trade counter move, then take the trade back off. It never touches
// /api/tregu/* — the pricing comes from the same pure LMSR helpers the real bet
// slip uses, so the numbers a newcomer learns here are the numbers they'll see.

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, DUR } from "@/lib/tokens";
import TourCursor, { type CursorScript } from "@/components/tour-cursor";
import TutorialChart, { type RangeKey } from "@/components/tregu/tutorial-chart";
import { previewBet, previewSell, lmsrPriceYes, type BinarySide } from "@/lib/tregu-client";

const STORAGE_KEY = "383:tour:tregu-trade";
const OPEN_EVENT = "383-tour-open";
const TOUR_ID = "tregu-trade";
const QUICK_AMOUNTS = [10, 25, 50, 100];
const START_BALANCE = 500;
const SEED = { q_yes: 60, q_no: 0, b: 150 };
/** Matches TutorialChart's ZOOM — used to keep the ghost cursor on the readout. */
const CHART_ZOOM = 0.36;
const CHART_FOCUS = 0.74;

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
    // "it climbs when the news firms up" line has something to point at.
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

type ActKey = "question" | "chart" | "bet" | "position" | "exit" | "done";

const ACTS: { key: ActKey; title: string; body: string }[] = [
  {
    key: "question",
    title: "Çdo treg është një pyetje",
    body: "Një pyetje, dy përgjigje. Çmimi i secilës anë është gjasa që tregu i jep asaj përgjigjeje tani — 60% do të thotë se tregu e sheh PO si dy herë më të mundshme se JO.",
  },
  {
    key: "chart",
    title: "Lexo grafikun",
    body: "Vija është historiku i asaj gjase. Kur ngjitet, lajmet po e forcojnë PO; kur bie, po e dobësojnë. Butonat lart djathtas ngushtojnë periudhën — 1o për orën e fundit, Gjithë për gjithë historikun.",
  },
  {
    key: "bet",
    title: "Vendos bastin e provës",
    body: "Zgjidh anën, shkruaj sa 383 Coin do të vësh dhe shiko sa aksione blen. Këto janë monedha prove — asgjë reale nuk preket. Vendose një bast për të vazhduar.",
  },
  {
    key: "position",
    title: "Pozicioni yt",
    body: "Ja çfarë ndodhi: bilanci ra, ke aksione në dorë dhe numëruesi i tregtimeve u rrit me një. Vija e grafikut lëvizi po ashtu — çdo bast e shtyn çmimin pak.",
  },
  {
    key: "exit",
    title: "Hiqe tregtimin",
    body: "Nuk je i mbyllur brenda deri në fund. Shit aksionet me çmimin e tanishëm dhe monedhat kthehen në bilanc. Nëse çmimi ka lëvizur në favorin tënd, kthen më shumë se sa vure.",
  },
  {
    key: "done",
    title: "Gati për tregun e vërtetë",
    body: "E njëjta gjë, vetëm me 383 Coin që fitohen falas çdo ditë. Mbylle këtë dhe kupona e bastit të djathtë të pret.",
  },
];

const MOCK_QUESTION = "A do të nënshkruhet marrëveshja para fundit të muajit?";

/* ── component ────────────────────────────────────────────────────────────── */

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("sq-AL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function TradeTutorial() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const [range, setRange] = useState<RangeKey>("all");
  const [focus, setFocus] = useState<number | null>(null);
  const [marker, setMarker] = useState<number | null>(null);

  const current = ACTS[act];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const start = useCallback(() => {
    dispatch({ type: "reset" });
    setRange("all");
    setFocus(null);
    setMarker(null);
    setAct(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setFocus(null);
    setMarker(null);
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
  const sidePrice = state.side === "PO" ? price : 1 - price;

  const preview = useMemo(() => {
    const coins = Math.min(state.amount, state.balance);
    if (!(coins > 0)) return null;
    const result = previewBet({ q_yes: state.qYes, q_no: state.qNo, b: SEED.b }, state.side, coins);
    if (!Number.isFinite(result.shares) || result.shares <= 0) return null;
    const after = state.side === "PO" ? result.newPriceYes : 1 - result.newPriceYes;
    return { ...result, coins, after };
  }, [state.amount, state.balance, state.qYes, state.qNo, state.side]);

  const exitValue = useMemo(() => {
    if (!(state.shares > 0)) return null;
    return previewSell({ q_yes: state.qYes, q_no: state.qNo, b: SEED.b }, state.heldSide, state.shares);
  }, [state.shares, state.heldSide, state.qYes, state.qNo]);

  // Acts 3 and 5 are gated: the point is that the user does it, not watches it.
  const blocked =
    (current.key === "bet" && state.shares === 0) ||
    (current.key === "exit" && state.shares > 0);

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

  // Leaving the chart act puts the camera back where it started.
  useEffect(() => {
    if (current.key === "chart") return;
    setFocus(null);
    setMarker(null);
    setRange("all");
  }, [current.key]);

  /* ── ghost-cursor choreography, one script per act ───────────────────────── */

  const plot = '[data-tut="chart-plot"]';
  /** Cursor at screen fraction s over a chart focused at f frames this data fraction. */
  const dataAt = (s: number) => CHART_FOCUS - CHART_ZOOM / 2 + CHART_ZOOM * s;

  const script = useMemo<CursorScript | null>(() => {
    if (current.key === "chart") {
      return {
        loop: true,
        beats: [
          {
            at: { sel: plot, fx: 0.74, fy: 0.45 },
            hold: 620,
            run: () => {
              setRange("all");
              setFocus(CHART_FOCUS);
              setMarker(CHART_FOCUS);
            },
          },
          { at: { sel: plot, fx: 0.12, fy: 0.62 }, hold: 240, run: () => setMarker(dataAt(0.12)) },
          { at: { sel: plot, fx: 0.42, fy: 0.5 }, hold: 200, run: () => setMarker(dataAt(0.42)) },
          { at: { sel: plot, fx: 0.88, fy: 0.34 }, hold: 420, run: () => setMarker(dataAt(0.88)) },
          { at: { sel: plot, fx: 0.5, fy: 0.5 }, hold: 260, run: () => setMarker(dataAt(0.5)) },
          {
            at: ".tut-chart-ranges",
            hold: 220,
            run: () => {
              setFocus(null);
              setMarker(null);
            },
          },
          { click: '[data-tut-range="1o"]', hold: 900, run: () => setRange("1o") },
          { click: '[data-tut-range="all"]', hold: 700, run: () => setRange("all") },
          { at: { sel: plot, fx: 0.95, fy: 0.28 }, hold: 1200, run: () => setMarker(1) },
        ],
      };
    }

    if (current.key === "bet" && state.shares === 0) {
      return {
        loop: true,
        beats: [
          { click: '[data-tut="side-po"]', hold: 520, run: () => dispatch({ type: "side", side: "PO" }) },
          { click: '[data-tut="chip-25"]', hold: 520, run: () => dispatch({ type: "amount", amount: 25 }) },
          { at: '[data-tut="buy"]', hold: 1600 },
        ],
      };
    }

    if (current.key === "exit" && state.shares > 0) {
      return { loop: true, beats: [{ at: '[data-tut="sell"]', hold: 1500 }] };
    }

    return null;
  }, [current.key, state.shares]);

  if (!mounted) return null;

  const motionOn = !reduced;
  const fade = { duration: motionOn ? DUR.slow : 0, ease: EASE };

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
            initial={motionOn ? { opacity: 0, y: 26, scale: 0.985 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={motionOn ? { opacity: 0, y: 16, scale: 0.99 } : undefined}
            transition={{ duration: motionOn ? DUR.reveal : 0, ease: EASE }}
          >
            <header className="tutorial-head">
              <span className="tour-eyebrow">
                <span aria-hidden />
                Si tregtohet
              </span>
              <div className="tutorial-wallet">
                <span>
                  Bilanc prove <strong>{fmt(state.balance)} 383C</strong>
                </span>
                <span>
                  Tregtime <strong data-tut="trade-count">{state.trades}</strong>
                </span>
              </div>
              <button type="button" className="tutorial-close" onClick={close} aria-label="Mbyll">
                ✕
              </button>
            </header>

            <div className="tour-rails" aria-hidden>
              {ACTS.map((_, i) => (
                <span key={i} data-on={i <= act ? "" : undefined} />
              ))}
            </div>

            <div className="tutorial-body">
              <div className="tutorial-stage">
                <div className="tutorial-question">
                  <span className="tregu-pill">Treg prove</span>
                  <h4>{MOCK_QUESTION}</h4>
                </div>

                {current.key === "question" ? (
                  <div className="tutorial-sides" aria-label="Përgjigjet">
                    {(["PO", "JO"] as BinarySide[]).map((s) => {
                      const p = s === "PO" ? price : 1 - price;
                      return (
                        <div key={s} className="tutorial-side-tile" data-side={s}>
                          <span>{s}</span>
                          <strong>{(p * 100).toFixed(1)}%</strong>
                          <em>×{(1 / p).toFixed(2)} nëse del drejt</em>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <TutorialChart
                    points={points}
                    range={range}
                    onRange={setRange}
                    focus={focus}
                    marker={marker}
                    reduced={reduced}
                  />
                )}

                {(current.key === "bet" || current.key === "position" || current.key === "exit") && (
                  <div className="tutorial-slip" data-tut="slip">
                    {state.shares === 0 ? (
                      <>
                        <div className="tutorial-slip-sides">
                          {(["PO", "JO"] as BinarySide[]).map((s) => (
                            <button
                              key={s}
                              type="button"
                              data-tut={s === "PO" ? "side-po" : "side-jo"}
                              data-on={state.side === s ? "" : undefined}
                              data-side={s}
                              onClick={() => dispatch({ type: "side", side: s })}
                            >
                              {s} · {((s === "PO" ? price : 1 - price) * 100).toFixed(1)}%
                            </button>
                          ))}
                        </div>

                        <label className="tutorial-amount">
                          <span>Sa 383 Coin</span>
                          <input
                            type="number"
                            min={1}
                            max={state.balance}
                            value={state.amount}
                            onChange={(e) =>
                              dispatch({ type: "amount", amount: Math.max(0, Number(e.target.value) || 0) })
                            }
                          />
                        </label>

                        <div className="tutorial-chips">
                          {QUICK_AMOUNTS.map((a) => (
                            <button
                              key={a}
                              type="button"
                              data-tut={`chip-${a}`}
                              data-on={state.amount === a ? "" : undefined}
                              onClick={() => dispatch({ type: "amount", amount: a })}
                            >
                              {a}
                            </button>
                          ))}
                        </div>

                        <dl className="tutorial-summary">
                          <div>
                            <dt>Çmimi aktual</dt>
                            <dd>{(sidePrice * 100).toFixed(1)}%</dd>
                          </div>
                          <div>
                            <dt>Aksione</dt>
                            <dd>{preview ? fmt(preview.shares, 2) : "—"}</dd>
                          </div>
                          <div>
                            <dt>Çmimi mesatar</dt>
                            <dd>{preview ? `${(preview.avgPrice * 100).toFixed(1)}%` : "—"}</dd>
                          </div>
                          <div>
                            <dt>Fitimi nëse del drejt</dt>
                            <dd data-good>
                              {preview ? `+${fmt(preview.shares - preview.coins, 2)} 383C` : "—"}
                            </dd>
                          </div>
                        </dl>

                        <button
                          type="button"
                          className="tutorial-confirm"
                          data-tut="buy"
                          disabled={!preview}
                          onClick={() => dispatch({ type: "buy" })}
                        >
                          Blej {state.side} për {fmt(Math.min(state.amount, state.balance))} 383C
                        </button>
                      </>
                    ) : (
                      <>
                        <dl className="tutorial-position" data-tut="position">
                          <div>
                            <dt>Ana jote</dt>
                            <dd data-side={state.heldSide}>{state.heldSide}</dd>
                          </div>
                          <div>
                            <dt>Aksione</dt>
                            <dd>{fmt(state.shares, 2)}</dd>
                          </div>
                          <div>
                            <dt>Vendosur</dt>
                            <dd>{fmt(state.staked)} 383C</dd>
                          </div>
                          <div>
                            <dt>Vlera tani</dt>
                            <dd>{exitValue ? `${fmt(exitValue.coins, 2)} 383C` : "—"}</dd>
                          </div>
                        </dl>

                        <button
                          type="button"
                          className="tutorial-confirm"
                          data-variant="sell"
                          data-tut="sell"
                          onClick={() => dispatch({ type: "sell" })}
                        >
                          Shit aksionet · merr {exitValue ? fmt(exitValue.coins, 2) : "0"} 383C
                        </button>
                      </>
                    )}
                  </div>
                )}

                {current.key === "done" && (
                  <div className="tutorial-recap">
                    <p>
                      Ke vendosur një bast dhe e ke hequr — <strong>{state.trades} tregtime</strong>{" "}
                      në total. Bilanci i provës mbylli në{" "}
                      <strong>{fmt(state.balance)} 383C</strong>.
                    </p>
                  </div>
                )}
              </div>

              <div className="tutorial-copy">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={current.key}
                    initial={motionOn ? { opacity: 0, y: 10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={motionOn ? { opacity: 0, y: -8 } : undefined}
                    transition={{ duration: motionOn ? DUR.base : 0, ease: EASE }}
                  >
                    <span className="tutorial-step">
                      Hapi {act + 1} nga {ACTS.length}
                    </span>
                    <h3 id="tutorial-title">{current.title}</h3>
                    <p>{current.body}</p>
                  </motion.div>
                </AnimatePresence>

                {blocked && (
                  <p className="tutorial-nudge" role="status">
                    {current.key === "bet"
                      ? "Provoje vetë: shtyp «Blej» për të vazhduar."
                      : "Shit aksionet për të vazhduar."}
                  </p>
                )}

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
                      disabled={blocked}
                      onClick={act >= ACTS.length - 1 ? finish : next}
                    >
                      {act >= ACTS.length - 1 ? "Hap kuponin" : "Vazhdo"}
                      <span aria-hidden>→</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <TourCursor script={script} active={open} reduced={reduced} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
