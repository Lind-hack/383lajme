"use client";

// Step-by-step spotlight tour. Dims the page, lights one element at a time,
// pushes in on it and explains it — optionally with a ghost cursor acting out
// the interaction. Opens itself the first time the anchor scrolls into view;
// afterwards it only opens on demand via `openTour()`.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, DUR } from "@/lib/tokens";
import TourCursor, { type CursorScript } from "@/components/tour-cursor";

export interface TourStep {
  /** CSS selector for the element this step lights up. */
  target: string;
  title: string;
  body: string;
  /** Breathing room around the lit element, px. Default 10. */
  padding?: number;
  /** Corner radius of the cut-out, px. Default 18. */
  radius?: number;
  /** Push in on the target while this step is open, e.g. 1.06. */
  zoom?: number;
  /** Ghost pointer choreography for this step. */
  cursor?: CursorScript;
}

interface SpotlightTourProps {
  /** Once this element scrolls into view, a first-time visitor gets the tour. */
  anchor: string;
  steps: TourStep[];
  /** One tour per surface — also the localStorage key and the openTour() id. */
  tourId: string;
  eyebrow?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const STORAGE_PREFIX = "383:tour:";
const OPEN_EVENT = "383-tour-open";
const TIP_WIDTH = 340;
const TIP_GAP = 18;
const EDGE = 16;
const ZOOM_MS = 700;
/**
 * Below this the tooltip becomes a docked bottom sheet. A phone-width card is
 * taller than the viewport, so the desktop "place the tip beside the hole"
 * search has nowhere to go and the spotlight has nothing left to dim — the
 * whole effect reads as absent. The sheet reserves the bottom band for the
 * copy and the hole is clipped into what is left, which puts real dim back on
 * screen above and below the lit slice.
 */
const SHEET_BP = 720;
/** Clear of the fixed masthead + ticker before anything is lit. */
const BAND_TOP = 88;
/** Never light a sliver — below this the step is not readable. */
const BAND_MIN = 96;

/** Re-open a tour that has already been dismissed (e.g. a "Si funksionon?" button). */
export function openTour(tourId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tourId }));
}

function measure(el: Element, pad: number): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function seen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function remember(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* private mode — the tour simply runs again next visit */
  }
}

export default function SpotlightTour({
  anchor,
  steps,
  tourId,
  eyebrow = "Si funksionon",
}: SpotlightTourProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [tipHeight, setTipHeight] = useState(200);
  const [reduced, setReduced] = useState(false);
  /** Steps whose target actually exists — sections render conditionally. */
  const [live, setLive] = useState<TourStep[]>(steps);

  const tipRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const storageKey = STORAGE_PREFIX + tourId;

  const step = live[Math.min(index, live.length - 1)] ?? steps[0];
  const isLast = index >= live.length - 1;
  /** Phone-width presentation: docked sheet, hole clipped into the band above it. */
  const sheet = view.w > 0 && view.w <= SHEET_BP;
  /** Bottom of the lit band — the sheet owns everything under it. */
  const bandBottom = sheet
    ? Math.max(BAND_TOP + BAND_MIN, view.h - tipHeight - EDGE - TIP_GAP)
    : 0;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const start = useCallback(() => {
    const resolved = steps.filter((s) => document.querySelector(s.target));
    setLive(resolved.length > 0 ? resolved : steps);
    setIndex(0);
    setOpen(true);
  }, [steps]);

  const finish = useCallback(() => {
    setOpen(false);
    setRect(null);
    remember(storageKey);
  }, [storageKey]);

  // Manual replay.
  useEffect(() => {
    const onOpen = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id && id !== tourId) return;
      start();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [tourId, start]);

  // First visit: wait for the anchor to exist (market cards arrive after a
  // fetch), then open once it is genuinely on screen.
  useEffect(() => {
    if (seen(storageKey)) return;

    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;

    const attach = () => {
      const el = document.querySelector(anchor);
      if (!el) return false;
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          io?.disconnect();
          start();
        },
        { threshold: 0.35 }
      );
      io.observe(el);
      return true;
    };

    if (!attach()) {
      mo = new MutationObserver(() => {
        if (attach()) mo?.disconnect();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      io?.disconnect();
      mo?.disconnect();
    };
  }, [anchor, storageKey, start]);

  // Push in on the target for the duration of the step. The rect loop below
  // measures through the transform, so the hole and tooltip follow it.
  // Skipped on phone widths: the targets are already full-bleed there, so a
  // push-in only pushes them off both edges.
  useEffect(() => {
    if (!open || !step?.zoom || reduced || sheet) return;
    const el = document.querySelector(step.target);
    if (!(el instanceof HTMLElement)) return;
    const prev = {
      transform: el.style.transform,
      transition: el.style.transition,
      origin: el.style.transformOrigin,
    };
    el.style.transition = `transform ${ZOOM_MS}ms var(--ease-out)`;
    el.style.transformOrigin = "center center";
    el.style.transform = `scale(${step.zoom})`;
    return () => {
      el.style.transform = prev.transform;
      // Let it ease back before handing the inline styles back.
      window.setTimeout(() => {
        el.style.transition = prev.transition;
        el.style.transformOrigin = prev.origin;
      }, ZOOM_MS);
    };
  }, [open, index, step, reduced, sheet]);

  // Track the lit element every frame. Scroll, reflow and the zoom transform
  // all move it, and only a rAF read catches all three — state is written
  // solely when the numbers actually change, so idle steps cost nothing.
  useEffect(() => {
    if (!open || !step) return;
    let frame = 0;
    let lastRect: Rect | null = null;
    let lastView = { w: 0, h: 0 };

    const tick = () => {
      const el = document.querySelector(step.target) ?? document.querySelector(anchor);
      const next = el ? measure(el, step.padding ?? 10) : null;
      if (!sameRect(next, lastRect)) {
        lastRect = next;
        setRect(next);
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w !== lastView.w || h !== lastView.h) {
        lastView = { w, h };
        setView(lastView);
      }
      frame = window.requestAnimationFrame(tick);
    };

    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [open, index, step, anchor]);

  // Bring the step into a comfortable band before lighting it up. On phone
  // widths the band is everything above the sheet, and a target taller than it
  // is aligned to the top of the band rather than centred — centring a 700px
  // card in a 500px band just hides both of its ends.
  useEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;

    if (sheet) {
      if (r.top >= BAND_TOP && r.bottom <= bandBottom) return;
      const top = window.scrollY + r.top - BAND_TOP - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
      return;
    }

    if (r.top >= 110 && r.bottom <= vh - 110) return;
    const top = window.scrollY + r.top - Math.max(110, (vh - r.height) / 2);
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
  }, [open, index, step, reduced, sheet, bandBottom]);

  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const sync = () => setTipHeight(el.offsetHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    nextRef.current?.focus({ preventScroll: true });
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
      } else if (event.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, live.length - 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, live.length, finish]);

  // The lit rect. On a phone it is the measured rect clipped into the band
  // above the sheet, which is what makes the dim visible again — an unclipped
  // full-bleed card leaves four scrim panels a few pixels wide.
  const hole = useMemo(() => {
    if (!rect || view.w === 0) return null;
    if (!sheet) return { ...rect, clipTop: false, clipBottom: false };
    const top = Math.max(BAND_TOP, rect.top);
    const bottom = Math.min(rect.top + rect.height, bandBottom);
    return {
      top,
      left: rect.left,
      width: rect.width,
      height: Math.max(BAND_MIN, bottom - top),
      clipTop: rect.top < BAND_TOP - 0.5,
      clipBottom: rect.top + rect.height > bandBottom + 0.5,
    };
  }, [rect, view, sheet, bandBottom]);

  // Four flat panels rather than one `box-shadow: 0 0 0 9999px` hole-punch.
  // A spread that large is a single enormous composited layer for a dim that
  // covers at most the viewport; four rects clipped to the viewport paint the
  // same thing predictably. The panels meet at square corners, so `.tour-corners`
  // paints the dim back into the four wedges the rounded ring leaves lit.
  const scrims = useMemo(() => {
    if (!hole || view.w === 0) return null;
    const vw = view.w;
    const vh = view.h;
    const top = Math.min(Math.max(hole.top, 0), vh);
    const bottom = Math.min(Math.max(hole.top + hole.height, 0), vh);
    const left = Math.min(Math.max(hole.left, 0), vw);
    const right = Math.min(Math.max(hole.left + hole.width, 0), vw);
    return [
      { key: "t", top: 0, left: 0, width: vw, height: top },
      { key: "b", top: bottom, left: 0, width: vw, height: Math.max(0, vh - bottom) },
      { key: "l", top, left: 0, width: left, height: Math.max(0, bottom - top) },
      { key: "r", top, left: right, width: Math.max(0, vw - right), height: Math.max(0, bottom - top) },
    ];
  }, [hole, view]);

  const tip = useMemo(() => {
    if (!hole || view.w === 0) return null;
    const vw = view.w;
    const vh = view.h;

    // Phone: docked sheet, full width, always clear of the lit band.
    if (sheet) {
      return {
        top: Math.max(EDGE, vh - tipHeight - EDGE),
        left: EDGE,
        width: vw - EDGE * 2,
      };
    }

    const width = Math.min(TIP_WIDTH, vw - EDGE * 2);
    const clampY = (y: number) => Math.min(Math.max(EDGE, y), Math.max(EDGE, vh - tipHeight - EDGE));

    const below = hole.top + hole.height + TIP_GAP;
    const above = hole.top - TIP_GAP - tipHeight;
    const rightOf = hole.left + hole.width + TIP_GAP;
    const leftOf = hole.left - TIP_GAP - width;

    // Below and above read best; fall to the sides before ever covering the
    // thing we are pointing at. A tall card in a short viewport hits this.
    if (below + tipHeight <= vh - EDGE) {
      const left = Math.min(
        Math.max(EDGE, hole.left + hole.width / 2 - width / 2),
        Math.max(EDGE, vw - width - EDGE)
      );
      return { top: below, left, width };
    }
    if (above >= EDGE) {
      const left = Math.min(
        Math.max(EDGE, hole.left + hole.width / 2 - width / 2),
        Math.max(EDGE, vw - width - EDGE)
      );
      return { top: above, left, width };
    }
    if (rightOf + width <= vw - EDGE) {
      return { top: clampY(hole.top + hole.height / 2 - tipHeight / 2), left: rightOf, width };
    }
    if (leftOf >= EDGE) {
      return { top: clampY(hole.top + hole.height / 2 - tipHeight / 2), left: leftOf, width };
    }
    return {
      top: Math.max(EDGE, vh - tipHeight - EDGE),
      left: Math.min(
        Math.max(EDGE, hole.left + hole.width / 2 - width / 2),
        Math.max(EDGE, vw - width - EDGE)
      ),
      width,
    };
  }, [hole, view, tipHeight, sheet]);

  if (!mounted || !step) return null;

  const motionOn = !reduced;
  // One spring for the hole, the four scrims and the tip. They have to share
  // it: the scrim edges are derived from the hole's own numbers, so any
  // difference in curve opens a lit seam mid-flight. A little bounce lets the
  // spotlight *land* on a card instead of gliding to a stop.
  const spring = motionOn
    ? { type: "spring" as const, duration: 0.55, bounce: 0.16 }
    : { duration: 0 };
  const radius = step.radius ?? 18;
  const holeRadius = hole?.clipBottom
    ? `${radius}px ${radius}px 0 0`
    : hole?.clipTop
      ? `0 0 ${radius}px ${radius}px`
      : `${radius}px`;
  // The corner patches follow the same two-corner rule as the radius: a clipped
  // edge is square on purpose, and a patch there would dim a real right angle.
  const cornerVars = {
    "--tour-corner-t": `${hole?.clipTop ? 0 : radius}px`,
    "--tour-corner-b": `${hole?.clipBottom ? 0 : radius}px`,
  } as CSSProperties;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="tour"
          className="tour-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionOn ? DUR.slow : 0, ease: EASE }}
        >
          {scrims?.map((s) => (
            <motion.div
              key={s.key}
              className="tour-scrim"
              aria-hidden
              initial={false}
              animate={{ top: s.top, left: s.left, width: s.width, height: s.height }}
              transition={spring}
              onClick={finish}
            />
          ))}

          {hole && (
            <motion.div
              className="tour-hole"
              aria-hidden
              data-clip-bottom={hole.clipBottom ? "" : undefined}
              data-clip-top={hole.clipTop ? "" : undefined}
              initial={false}
              animate={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
              }}
              transition={spring}
              style={{ borderRadius: holeRadius }}
            >
              <span className="tour-corners" style={cornerVars} />
              <span className="tour-ring" data-static={reduced ? "" : undefined} />
            </motion.div>
          )}

          <TourCursor
            script={step.cursor ?? null}
            active={open}
            reduced={reduced}
            touch={sheet}
            bounds={sheet ? { top: BAND_TOP + 12, bottom: bandBottom - 12 } : null}
          />

          {tip && (
            <motion.div
              ref={tipRef}
              className="tour-tip"
              data-sheet={sheet ? "" : undefined}
              // Explicit position in `initial` so only opacity and scale play
              // on mount — leaving top/left unset makes it fly in from 0,0.
              initial={
                motionOn
                  ? { top: tip.top, left: tip.left, opacity: 0, scale: 0.97 }
                  : false
              }
              animate={{ top: tip.top, left: tip.left, opacity: 1, scale: 1 }}
              transition={{
                top: spring,
                left: spring,
                opacity: { duration: motionOn ? DUR.base : 0, ease: EASE },
                scale: motionOn
                  ? { type: "spring", duration: 0.5, bounce: 0.28 }
                  : { duration: 0 },
              }}
              style={{ width: tip.width }}
            >
              {sheet && <span className="tour-tip-grip" aria-hidden />}
              <div className="tour-tip-head">
                <span className="tour-eyebrow">
                  <span aria-hidden />
                  {eyebrow}
                </span>
                <span className="tour-count">
                  {index + 1}/{live.length}
                </span>
              </div>

              <div className="tour-rails" aria-hidden>
                {live.map((_, i) => (
                  <span key={i} data-on={i <= index ? "" : undefined} />
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={index}
                  initial={motionOn ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={motionOn ? { opacity: 0, y: -6 } : undefined}
                  transition={{ duration: motionOn ? DUR.base : 0, ease: EASE }}
                >
                  <h3 id="tour-title" className="tour-tip-title">
                    {step.title}
                  </h3>
                  <p className="tour-tip-body">{step.body}</p>
                </motion.div>
              </AnimatePresence>

              <div className="tour-actions">
                <button type="button" className="tour-skip" onClick={finish}>
                  Kalo
                </button>
                <div className="tour-actions-right">
                  {index > 0 && (
                    <button
                      type="button"
                      className="tour-back"
                      onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    >
                      Mbrapa
                    </button>
                  )}
                  <button
                    ref={nextRef}
                    type="button"
                    className="tour-next"
                    onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
                  >
                    {isLast ? "E kuptova" : "Vazhdo"}
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
