"use client";

// The Ligat sandbox. Four short acts, Dardani narrating, practice coins only:
// join a league, pick a winner, watch the table move, collect a prize. It never
// touches /api or Supabase — the points and prize maths come from the same
// helpers the real league page uses (lib/tregu-leagues.ts), so what a newcomer
// learns here is exactly how their own league will score.
//
// Opens by itself once: on a first visit to a league page, or the first time
// the Ligat section scrolls into view on /tregu. After that only from a
// "Si luhet?" button (openLeagueTutorial()).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { EASE, DUR } from "@/lib/tokens";
import TourCursor, { type CursorScript } from "@/components/tour-cursor";
import DardaniImage from "@/components/dardani/dardani-image";
import DardaniLoop from "@/components/dardani/dardani-loop";
import { PUBLIC_LEAGUE_FEE, pickPoints, potSplit, privateBonusPct, publicLeaguePrizes } from "@/lib/tregu-leagues";

const STORAGE_KEY = "383:tour:tregu-league";
const OPEN_EVENT = "383-tour-open";
const TOUR_ID = "tregu-league";
const START_BALANCE = 500;
/** Players already in the practice league before the reader joins. */
const RIVALS = [
  { name: "Arta", points: 128 },
  { name: "Blerim", points: 104 },
  { name: "Dona", points: 97 },
  { name: "Enis", points: 61 },
];
const START_POINTS = 40;
const MEMBERS = RIVALS.length + 1 + 7; // five on the table, seven more below the fold
const LEAGUE_DAYS = 7;

const MATCH = {
  home: "Prishtina",
  away: "Drita",
  when: "Sot · 19:00",
  options: [
    { key: "home", label: "Prishtina", probability: 0.62 },
    { key: "draw", label: "Barazim", probability: 0.24 },
    { key: "away", label: "Drita", probability: 0.14 },
  ],
} as const;
type OptionKey = (typeof MATCH.options)[number]["key"];

/** Open the sandbox from a "Si luhet?" button. */
export function openLeagueTutorial() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: TOUR_ID }));
}

type ActKey = "join" | "pick" | "table" | "prize";
const ACTS: { key: ActKey; title: string; body: string; cue: string; cueDone: string }[] = [
  {
    key: "join",
    title: "Hyr në një ligë",
    body: "Liga është një garë parashikimesh me miqtë ose me gjithë Kosovën. Ligat e 383 kushtojnë 10 monedha. Ligën tënde e krijon vetë: publike për këdo, ose private me kod.",
    cue: "Shtyp Hyr në ligë.",
    cueDone: "Je brenda! Të gjithë nisin nga 0 pikë.",
  },
  {
    key: "pick",
    title: "Zgjidh kush fiton",
    body: "Parashikimi është falas. Nëse ke të drejtë merr 100 pikë minus gjasat: favoriti jep pak, surpriza jep shumë. Nëse gabon, merr 0. Në ligat e reja: 🔥 3 të sakta rresht vlejnë ×1.5, 5 rresht ×2, dhe ⭐ Karta e artë dyfishon një parashikim në ditë.",
    cue: "Prek një rezultat.",
    cueDone: "E zgjodhe! E ndryshon kurdo deri në fillim të ndeshjes.",
  },
  {
    key: "table",
    title: "Shiko renditjen",
    body: "Kur mbaron ndeshja, pikët shtohen vetë dhe renditja lëviz. Në provë, parashikimi yt del i saktë.",
    cue: "Shtyp Mbaro ndeshjen.",
    cueDone: "U ngjite në renditje!",
  },
  {
    key: "prize",
    title: "Tre të parët fitojnë",
    body: "Kur mbaron liga, tre të parët ndajnë potin 50% · 30% · 20%. Në ligat e 383 shton edhe 383 shpërblimet e veta.",
    cue: "Merr shpërblimin tënd.",
    cueDone: "Kaq është! Tani provo një ligë të vërtetë.",
  },
];

const fmt = (n: number) => n.toLocaleString("sq-AL", { maximumFractionDigits: 0 });

function remember(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* private mode — it simply offers itself again next visit */
  }
}

function seen(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

/** Never open on top of another overlay: the trade sandbox or a spotlight tour. */
function otherOverlayUp() {
  return "tourOpen" in document.body.dataset;
}

export default function LeagueTutorial({ autoStart = "none" }: { autoStart?: "mount" | "section" | "none" }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [joined, setJoined] = useState(false);
  const [pick, setPick] = useState<OptionKey | null>(null);
  const [settled, setSettled] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrowQuery = window.matchMedia("(max-width: 720px)");
    const sync = () => {
      setReduced(motionQuery.matches);
      setNarrow(narrowQuery.matches);
    };
    sync();
    motionQuery.addEventListener("change", sync);
    narrowQuery.addEventListener("change", sync);
    return () => {
      motionQuery.removeEventListener("change", sync);
      narrowQuery.removeEventListener("change", sync);
    };
  }, []);

  const start = useCallback(() => {
    setJoined(false);
    setPick(null);
    setSettled(false);
    setClaimed(false);
    setAct(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    remember(STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (autoStart !== "mount" || seen(STORAGE_KEY)) return;
    const timer = window.setTimeout(() => {
      if (!otherOverlayUp()) start();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [autoStart, start]);

  useEffect(() => {
    if (autoStart !== "section" || seen(STORAGE_KEY) || typeof IntersectionObserver === "undefined") return;
    const targets = [...document.querySelectorAll<HTMLElement>("#ligat, #ligat-383")];
    if (!targets.length) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          window.clearTimeout(timer);
          return;
        }
        // A reader who pauses on the section, not one scrolling past it.
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (seen(STORAGE_KEY) || otherOverlayUp()) return;
          observer.disconnect();
          start();
        }, 1_200);
      },
      { threshold: 0.45 }
    );
    targets.forEach((target) => observer.observe(target));
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [autoStart, start]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id === TOUR_ID) start();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [start]);

  // The overlay owns the screen while it is up (same contract as TradeTutorial).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.tourOpen = "";
    return () => {
      document.body.style.overflow = previous;
      delete document.body.dataset.tourOpen;
    };
  }, [open]);

  const current = ACTS[act];
  const chosen = MATCH.options.find((option) => option.key === pick) ?? null;
  const earned = chosen ? pickPoints(chosen.probability) : 0;
  const pot = MEMBERS * PUBLIC_LEAGUE_FEE;
  const prizes = useMemo(() => {
    const fixed = publicLeaguePrizes(LEAGUE_DAYS);
    const share = potSplit(pot, 3);
    return [0, 1, 2].map((index) => (fixed[index] ?? 0) + (share[index] ?? 0));
  }, [pot]);

  const table = useMemo(() => {
    const you = { name: "Ti", points: START_POINTS + (settled ? earned : 0), you: true };
    return [...RIVALS.map((rival) => ({ ...rival, you: false })), you].sort((a, b) => b.points - a.points);
  }, [earned, settled]);
  const place = table.findIndex((row) => row.you) + 1;
  const prize = place >= 1 && place <= 3 ? prizes[place - 1] : 0;
  const balance = START_BALANCE - (joined ? PUBLIC_LEAGUE_FEE : 0) + (claimed ? prize : 0);

  const cueDone =
    current.key === "join" ? joined : current.key === "pick" ? pick !== null : current.key === "table" ? settled : claimed;
  const blocked = !cueDone && current.key !== "prize";
  const isLast = act >= ACTS.length - 1;

  const next = useCallback(() => {
    if (blocked) return;
    setAct((index) => Math.min(index + 1, ACTS.length - 1));
  }, [blocked]);

  const finish = useCallback(() => {
    close();
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>("#ligat-383, #ligat, .lgx-picks")
        ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }, 120);
  }, [close, reduced]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowRight" && !blocked) {
        setAct((index) => Math.min(index + 1, ACTS.length - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, blocked, close]);

  // Keep whatever the act is waiting on inside the visible part of the card.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const body = bodyRef.current;
      const target = body?.querySelector<HTMLElement>("[data-await]");
      if (!body || !target) return;
      const box = target.getBoundingClientRect();
      const view = body.getBoundingClientRect();
      if (box.top >= view.top + 4 && box.bottom <= view.bottom - 4) return;
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [open, act, joined, pick, settled, claimed, reduced]);

  const script = useMemo<CursorScript | null>(() => {
    if (current.key === "join" && !joined) return { loop: true, beats: [{ at: '[data-lgt="join"]', hold: 1800 }] };
    if (current.key === "pick" && !pick) return { loop: true, beats: [{ at: '[data-lgt="pick-away"]', hold: 2000 }] };
    if (current.key === "table" && !settled) return { loop: true, beats: [{ at: '[data-lgt="settle"]', hold: 1800 }] };
    if (current.key === "prize" && !claimed && prize > 0) return { loop: true, beats: [{ at: '[data-lgt="claim"]', hold: 1800 }] };
    return null;
  }, [current.key, joined, pick, settled, claimed, prize]);

  if (!mounted) return null;

  const motionOn = !reduced;
  const swap = motionOn
    ? {
        initial: { opacity: 0, transform: "translateY(8px)" },
        animate: { opacity: 1, transform: "translateY(0px)" },
        exit: { opacity: 0, transform: "translateY(-6px)", transition: { duration: 0.12, ease: EASE } },
        transition: { duration: DUR.base, ease: EASE },
      }
    : { initial: false as const, animate: {}, exit: undefined, transition: { duration: 0 } };
  const pop = motionOn ? { type: "spring" as const, duration: 0.5, bounce: 0.28 } : { duration: 0 };
  const cueText = cueDone ? current.cueDone : current.cue;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="tutorial-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="league-tutorial-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionOn ? DUR.slow : 0, ease: EASE }}
        >
          <div className="tutorial-scrim" onClick={close} aria-hidden />

          <motion.div
            className="tutorial-card tregu-scope lgtut"
            initial={motionOn ? { opacity: 0, transform: "translateY(26px) scale(0.985)" } : false}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={motionOn ? { opacity: 0, transform: "translateY(16px) scale(0.99)", transition: { duration: DUR.base, ease: EASE } } : undefined}
            transition={{
              transform: motionOn ? { type: "spring", duration: 0.52, bounce: 0.18 } : { duration: 0 },
              opacity: { duration: motionOn ? DUR.base : 0, ease: EASE },
            }}
          >
            <header className="tutorial-head">
              <span className="tour-eyebrow">
                <span aria-hidden />
                Si luhen Ligat
              </span>
              <div className="tutorial-wallet">
                <span>
                  Monedhat e provës <strong>{fmt(balance)}</strong>
                </span>
              </div>
              <button type="button" className="tutorial-close" onClick={close} aria-label="Mbyll">
                ✕
              </button>
            </header>

            <div className="tour-rails" data-spring aria-hidden>
              {ACTS.map((_, index) => (
                <span key={index}>
                  <motion.i initial={false} animate={{ transform: index <= act ? "scaleX(1)" : "scaleX(0)" }} transition={pop} />
                </span>
              ))}
            </div>

            <div className="tutorial-body" ref={bodyRef}>
              <div className="tutorial-copy">
                <div className="tutorial-dardani" aria-hidden="true">
                  {current.key === "join" ? (
                    <DardaniLoop name="greeting" decorative />
                  ) : current.key === "pick" ? (
                    <DardaniImage name="thinking-bubble" decorative />
                  ) : current.key === "table" ? (
                    <DardaniImage name={settled ? "celebrating" : "tregu-predict"} decorative />
                  ) : (
                    <DardaniImage name="tregu-win" decorative />
                  )}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={current.key} {...swap}>
                    <h3 id="league-tutorial-title">{current.title}</h3>
                    <p>{current.body}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="tutorial-stage">
                <div className="lgt-league">
                  <span className="lgt-emblem" aria-hidden>🏆</span>
                  <div>
                    <strong>Liga e Javës · Superliga</strong>
                    <small>{MEMBERS - (joined ? 0 : 1)} lojtarë · {LEAGUE_DAYS} ditë · poti {fmt((MEMBERS - (joined ? 0 : 1)) * PUBLIC_LEAGUE_FEE)} + {fmt(publicLeaguePrizes(LEAGUE_DAYS).reduce((a, b) => a + b, 0))} nga 383</small>
                  </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {current.key === "join" && (
                    <motion.div key="join" className="lgt-panel" {...swap}>
                      <div className="lgt-kinds">
                        <div data-on="">
                          <strong>Liga e 383</strong>
                          <span>Për këdo · {PUBLIC_LEAGUE_FEE} monedha</span>
                          <em>383 shton shpërblime</em>
                        </div>
                        <div>
                          <strong>Liga private</strong>
                          <span>Me miqtë · ti cakton hyrjen</span>
                          <em>+{privateBonusPct(7)}% deri +{privateBonusPct(30)}% nga 383</em>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="tutorial-confirm"
                        data-lgt="join"
                        data-await={!joined ? "" : undefined}
                        disabled={joined}
                        onClick={() => setJoined(true)}
                      >
                        {joined ? "✓ Je në ligë" : `Hyr në ligë · ${PUBLIC_LEAGUE_FEE} monedha`}
                      </button>
                    </motion.div>
                  )}

                  {current.key === "pick" && (
                    <motion.div key="pick" className="lgt-panel" {...swap}>
                      <div className="lgt-match">
                        <span>{MATCH.home}</span>
                        <em>{MATCH.when}</em>
                        <span>{MATCH.away}</span>
                      </div>
                      <div className="lgt-options" data-await={pick === null ? "" : undefined}>
                        {MATCH.options.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            data-lgt={`pick-${option.key}`}
                            data-on={pick === option.key ? "" : undefined}
                            onClick={() => setPick(option.key)}
                          >
                            <span>{option.label}</span>
                            <small>{Math.round(option.probability * 100)}% gjasa</small>
                            <strong>+{pickPoints(option.probability)}</strong>
                          </button>
                        ))}
                      </div>
                      <p className="tutorial-line">
                        {chosen ? (
                          <>
                            Nëse fiton <strong>{chosen.label}</strong>, merr <strong>+{earned} pikë</strong>.
                            {chosen.probability < 0.2 ? " Surprizë: pikë shumë!" : chosen.probability > 0.5 ? " Favorit: më i sigurt, por pak pikë." : ""}
                          </>
                        ) : (
                          "Sa më e vogël gjasa, aq më shumë pikë."
                        )}
                      </p>
                    </motion.div>
                  )}

                  {current.key === "table" && (
                    <motion.div key="table" className="lgt-panel" {...swap}>
                      <LayoutGroup>
                        <ol className="lgt-table" aria-label="Renditja">
                          {table.map((row, index) => (
                            <motion.li
                              key={row.name}
                              layout={motionOn}
                              transition={motionOn ? { type: "spring", duration: 0.7, bounce: 0.2 } : { duration: 0 }}
                              data-you={row.you ? "" : undefined}
                              data-podium={index < 3 ? "" : undefined}
                            >
                              <b>{index + 1}</b>
                              <span>{row.name}</span>
                              {row.you && settled ? <em>+{earned}</em> : null}
                              <strong>{row.points}</strong>
                            </motion.li>
                          ))}
                        </ol>
                      </LayoutGroup>
                      <button
                        type="button"
                        className="tutorial-confirm"
                        data-lgt="settle"
                        data-await={!settled ? "" : undefined}
                        disabled={settled}
                        onClick={() => setSettled(true)}
                      >
                        {settled ? `✓ ${chosen?.label ?? "Zgjedhja jote"} ishte e saktë` : "Mbaro ndeshjen"}
                      </button>
                    </motion.div>
                  )}

                  {current.key === "prize" && (
                    <motion.div key="prize" className="lgt-panel" {...swap}>
                      <div className="lgt-podium" aria-label="Shpërblimet">
                        {[1, 0, 2].map((index) => (
                          <div key={index} data-place={index + 1} data-you={place === index + 1 ? "" : undefined}>
                            <span>{table[index]?.you ? "Ti" : table[index]?.name}</span>
                            <b>{index + 1}.</b>
                            <strong>{fmt(prizes[index])}</strong>
                            <small>{[50, 30, 20][index]}% e potit + 383</small>
                          </div>
                        ))}
                      </div>
                      {prize > 0 ? (
                        <button
                          type="button"
                          className="tutorial-confirm"
                          data-lgt="claim"
                          data-await={!claimed ? "" : undefined}
                          disabled={claimed}
                          onClick={() => setClaimed(true)}
                        >
                          {claimed ? `✓ +${fmt(prize)} monedha në bilanc` : `Merr ${fmt(prize)} monedha`}
                        </button>
                      ) : (
                        <p className="tutorial-line">Këtë herë s'u fut në tre të parët. Pikët e ardhshme mund ta ndryshojnë.</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="tutorial-foot">
              <div className="tutorial-cue" data-done={cueDone ? "" : undefined}>
                <span className="tutorial-cue-mark" aria-hidden>
                  {cueDone ? <em>✓</em> : <em className="tutorial-cue-dot" />}
                </span>
                <motion.span
                  key={`${current.key}-${cueDone ? "done" : "todo"}`}
                  role="status"
                  initial={motionOn ? { opacity: 0, transform: "translateY(5px)" } : false}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  transition={{ duration: motionOn ? DUR.base : 0, ease: EASE }}
                >
                  {cueText}
                </motion.span>
              </div>
              <div className="tour-actions">
                <button type="button" className="tour-skip" onClick={close}>
                  Kalo
                </button>
                <div className="tour-actions-right">
                  <button
                    type="button"
                    className="tour-next"
                    data-await={!blocked && cueDone ? "" : undefined}
                    disabled={blocked}
                    onClick={isLast ? finish : next}
                  >
                    {isLast ? "Shiko ligat" : "Vazhdo"}
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
