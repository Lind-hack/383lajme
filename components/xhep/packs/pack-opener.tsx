"use client";

// Opening a city's pack, like a trading-card pack:
//
//   sealed  — the pack floats; foil shine follows the finger or cursor.
//             Swipe (or click and drag) across the crimped top to tear it.
//             The strip peels from where the finger started, along a jagged
//             tear line; past 65% it rips off. A button does the same for
//             keyboards and screen readers.
//   torn    — the strip flies away, the pack jolts, the cards rise out.
//   reveal  — one card at a time; a tap or a swipe sends it aside. The stamp
//             card comes last, with a burst.
//   binder  — every card of the city; tap one to open it.
//
// An already-opened pack starts at the binder, with "Open again" to replay.
// With reduced motion the pack simply opens and cards appear without flight.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RotateCcw, X } from "lucide-react";
import { PACK_ART, packCards } from "@/lib/xhep/packs.mjs";
import type { XhepLang } from "@/lib/xhep/i18n";
import { CardFace, cityName, type PackCard } from "./cards";
import type { XhepProfile } from "./use-profile";
import styles from "./packs.module.css";

type Phase = "sealed" | "torn" | "reveal" | "binder";

/** Where the sealed strip ends, in % of the pack's height. */
const TEAR_AT = 5.4;
/** Teeth along the tear line. */
const TEETH = 22;
/** How far the finger must travel, as a share of the pack's width, to rip it. */
const RIP_AT = 0.65;

/** The jagged tear line, as polygon points: strip above it, pack body below. */
function tearPoints() {
  const pts: string[] = [];
  for (let i = 0; i <= TEETH; i++) {
    const x = (i / TEETH) * 100;
    const y = TEAR_AT + (i % 2 === 0 ? 0.9 : -0.9);
    pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return pts;
}
const LINE = tearPoints();
const STRIP_CLIP = `polygon(0% 0%, 100% 0%, ${[...LINE].reverse().join(", ")})`;
const BODY_CLIP = `polygon(${LINE.join(", ")}, 100% 100%, 0% 100%)`;

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not every browser lets a page vibrate; the tear still works.
  }
}

export type OpenerText = {
  close: string;
  tearHint: string;
  tearHintMouse: string;
  tearButton: string;
  tapNext: string;
  skip: string;
  binderTitle: (city: string) => string;
  replay: string;
  cardOf: (i: number, n: number) => string;
  faces: Parameters<typeof CardFace>[0]["t"];
};

export default function PackOpener({
  cityId,
  lang,
  profile,
  alreadyOpen,
  onOpened,
  onClose,
  onOpenCard,
  t,
}: {
  cityId: string;
  lang: XhepLang;
  profile: XhepProfile | null;
  alreadyOpen: boolean;
  onOpened: () => void;
  onClose: () => void;
  onOpenCard: (card: PackCard) => void;
  t: OpenerText;
}) {
  const reduce = useReducedMotion();
  const art = PACK_ART[cityId as keyof typeof PACK_ART];
  const cards = useMemo(() => packCards(cityId) as PackCard[], [cityId]);
  const [phase, setPhase] = useState<Phase>(alreadyOpen ? "binder" : "sealed");
  const [shown, setShown] = useState(0);
  const [tear, setTear] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [touch, setTouch] = useState(false);
  const drag = useRef<{ x: number; width: number; id: number } | null>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // A swipe ends with a click too; this keeps one swipe to one card.
  const swiped = useRef(false);

  useEffect(() => {
    dialog.current?.showModal();
    setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  const rip = useCallback(() => {
    buzz(28);
    setTear(1);
    setPhase("torn");
    onOpened();
    window.setTimeout(() => setPhase("reveal"), reduce ? 0 : 650);
  }, [onOpened, reduce]);

  // Foil shine and tilt follow the pointer while the pack is sealed.
  function tilt(e: React.PointerEvent) {
    const el = packRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
    el.style.setProperty("--rx", `${(((e.clientY - r.top) / r.height - 0.5) * -10).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(((e.clientX - r.left) / r.width - 0.5) * 12).toFixed(2)}deg`);
  }

  function startTear(e: React.PointerEvent) {
    if (phase !== "sealed") return;
    const r = packRef.current?.getBoundingClientRect();
    if (!r) return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Capture is a nicety (the finger may leave the strip); the tear works without it.
    }
    drag.current = { x: e.clientX, width: r.width, id: e.pointerId };
    buzz(8);
  }
  function moveTear(e: React.PointerEvent) {
    tilt(e);
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    setDir(dx >= 0 ? 1 : -1);
    setTear(Math.min(1, Math.abs(dx) / (d.width * 0.8)));
    const r = packRef.current?.getBoundingClientRect();
    if (r) packRef.current?.style.setProperty("--seam", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
  }
  function endTear(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (tear >= RIP_AT) rip();
    else setTear(0);
  }

  const next = useCallback(() => {
    if (phase !== "reveal") return;
    if (shown + 1 >= cards.length) setPhase("binder");
    else setShown((n) => n + 1);
  }, [phase, shown, cards.length]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, next]);

  const replay = () => {
    setShown(0);
    setTear(0);
    setPhase("sealed");
  };

  const city = cityName(cityId);
  const style = { "--accent": art.accent, "--crimp": art.crimp, "--ink": art.ink } as React.CSSProperties;

  return (
    <dialog
      ref={dialog}
      className={styles.opener}
      style={style}
      aria-label={city}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={styles.openerGlow} aria-hidden="true" />
      <header className={styles.openerHead}>
        {/* Focus starts here, not on the close button: a ring on "X" the moment
            the pack appears reads as an error on a phone. */}
        <h2 className={styles.openerTitle} tabIndex={-1} autoFocus>
          {phase === "binder" ? t.binderTitle(city) : city}
        </h2>
        <span className={styles.openerActions}>
          {phase === "binder" && (
            <button type="button" className={styles.openerBtn} onClick={replay}>
              <RotateCcw aria-hidden="true" size={16} />
              {t.replay}
            </button>
          )}
          <button type="button" className={styles.openerIcon} onClick={onClose} aria-label={t.close}>
            <X aria-hidden="true" size={20} />
          </button>
        </span>
      </header>

      {(phase === "sealed" || phase === "torn") && (
        <div className={styles.stage}>
          <div
            ref={packRef}
            className={styles.pack}
            data-phase={phase}
            data-tearing={tear > 0 && phase === "sealed" ? "" : undefined}
            style={{ "--tear": tear, "--dir": dir, "--pack-mask": `url(${art.src})` } as React.CSSProperties}
            onPointerMove={tilt}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.packBody} src={art.src} alt="" draggable={false} style={{ clipPath: BODY_CLIP }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.packStrip}
              src={art.src}
              alt=""
              draggable={false}
              style={{ clipPath: STRIP_CLIP, transformOrigin: dir === 1 ? "100% 8%" : "0% 8%" }}
            />
            <span className={styles.packFoil} aria-hidden="true" />
            <span className={styles.packSeam} aria-hidden="true" style={{ top: `${TEAR_AT}%` }} />
            {phase === "sealed" && (
              <span
                className={styles.tearZone}
                style={{ height: `${TEAR_AT * 2.4}%` }}
                onPointerDown={startTear}
                onPointerMove={moveTear}
                onPointerUp={endTear}
                onPointerCancel={endTear}
                aria-hidden="true"
              >
                <span className={styles.tearHand} />
              </span>
            )}
          </div>
          {phase === "sealed" && (
            <div className={styles.tearHelp}>
              <p>{touch ? t.tearHint : t.tearHintMouse}</p>
              <button type="button" className={styles.openerBtn} onClick={rip}>
                {t.tearButton}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "reveal" && (
        <div className={styles.stage}>
          <div
            className={styles.stack}
            onClick={() => {
              if (swiped.current) swiped.current = false;
              else next();
            }}
            role="button"
            tabIndex={0}
            aria-label={t.tapNext}
          >
            <AnimatePresence initial={!reduce} mode="popLayout">
              {cards.slice(shown, shown + 3).reverse().map((card) => {
                const depth = cards.indexOf(card) - shown;
                const top = depth === 0;
                return (
                  <motion.div
                    key={card.id}
                    className={styles.stackCard}
                    data-top={top || undefined}
                    data-last={card.kind === "stamps" && top ? "" : undefined}
                    initial={reduce ? false : shown === 0 && top ? { y: "70%", scale: 0.8, opacity: 0 } : { y: depth * 10, scale: 1 - depth * 0.04, opacity: 1 }}
                    animate={{ y: depth * 10, x: 0, rotate: depth * (depth % 2 ? 2.5 : -2.5), scale: 1 - depth * 0.04, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { x: "-120%", rotate: -16, opacity: 0, transition: { duration: 0.36, ease: [0.4, 0, 0.2, 1] } }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    drag={top && !reduce ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.6}
                    onDragStart={() => {
                      swiped.current = true;
                    }}
                    onDragEnd={(_, info) => {
                      if (Math.abs(info.offset.x) > 70 || Math.abs(info.velocity.x) > 500) next();
                      // The click that follows this drag is ignored, then clicks count again.
                      window.setTimeout(() => (swiped.current = false), 0);
                    }}
                    style={{ zIndex: 10 - depth }}
                  >
                    <CardFace card={card} cityId={cityId} lang={lang} profile={profile} index={cards.indexOf(card) + 1} total={cards.length} t={t.faces} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          <p className={styles.revealCount} aria-live="polite">
            {t.cardOf(shown + 1, cards.length)} · {t.tapNext}
          </p>
          <button type="button" className={styles.skip} onClick={() => setPhase("binder")}>
            {t.skip}
          </button>
        </div>
      )}

      {phase === "binder" && (
        <ul className={styles.binder}>
          {cards.map((card, i) => (
            <li key={card.id}>
              <button type="button" className={styles.binderCard} onClick={() => onOpenCard(card)} style={{ "--i": i } as React.CSSProperties}>
                <CardFace card={card} cityId={cityId} lang={lang} profile={profile} index={i + 1} total={cards.length} t={t.faces} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
