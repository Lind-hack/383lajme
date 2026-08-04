"use client";

// Step-by-step spotlight tour. Dims the page, lights one element at a time,
// pushes in on it and explains it — optionally with a ghost cursor acting out
// the interaction. Opens itself the first time the anchor scrolls into view;
// afterwards it only opens on demand via `openTour()`.
//
// While it is open the tour owns the scroll outright: wheel, touch and the
// scrolling keys are swallowed, and the page moves only through the camera
// tween below. The camera and the spotlight are driven off the *same* eased
// progress, so the lit rect and the page arrive together — the spotlight can
// never lag behind, overshoot, or fight a flick that was still in flight.

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
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
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

interface Box {
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
/** Camera travel time, scaled by distance between these bounds. */
const CAM_MIN_MS = 320;
const CAM_MAX_MS = 720;
/** No `scroll` event for this long before a first-visit tour may take over. */
const IDLE_MS = 160;
/** …and never sooner than this after the anchor came into view. */
const DWELL_MS = 260;
/** Keys that scroll the page. Left/Right drive the steps and stay live. */
const SCROLL_KEYS = new Set([
  " ",
  "Spacebar",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
]);

/** Re-open a tour that has already been dismissed (e.g. a "Si funksionon?" button). */
export function openTour(tourId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tourId }));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
/** Ease-out quint — strong deceleration, no bounce, so the camera *lands*. */
const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

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
  const [view, setView] = useState({ w: 0, h: 0 });
  const [tipHeight, setTipHeight] = useState(200);
  const [reduced, setReduced] = useState(false);
  /**
   * "travel" = the camera is moving and the tooltip is out of the way;
   * "land" = the camera has arrived and this step is being read.
   */
  const [phase, setPhase] = useState<"travel" | "land">("land");
  /**
   * Where the lit element will sit once the camera has landed, zoom included.
   * Computed once per step, so the tooltip placement search and the phone band
   * clipping never run per frame.
   */
  const [anchorBox, setAnchorBox] = useState<Box | null>(null);
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

  // --- Geometry, in motion values ------------------------------------------
  // The lit box is tracked in *document* space and the live scroll offset is
  // subtracted rigidly on the way out. Page movement therefore contributes
  // exactly zero lag: only a genuine step change animates, and it animates on
  // the same clock as the camera. Nothing here re-renders React.
  const mTop = useMotionValue(0);
  const mLeft = useMotionValue(0);
  const mW = useMotionValue(0);
  const mH = useMotionValue(0);
  const mScroll = useMotionValue(0);
  const mVw = useMotionValue(0);
  const mVh = useMotionValue(0);
  /** Phone band, mirrored into motion values so the transforms can clamp. */
  const mSheet = useMotionValue(0);
  const mBand = useMotionValue(0);

  const hLeft = mLeft;
  const hW = mW;
  const hTop = useTransform([mTop, mScroll, mSheet], ([t, s, sh]: number[]) =>
    sh ? Math.max(BAND_TOP, t - s) : t - s
  );
  const hH = useTransform(
    [mTop, mH, mScroll, mSheet, mBand],
    ([t, h, s, sh, band]: number[]) => {
      if (!sh) return h;
      const top = Math.max(BAND_TOP, t - s);
      const bottom = Math.min(t - s + h, band);
      return Math.max(BAND_MIN, bottom - top);
    }
  );

  // The four scrim panels tile the viewport around the hole. They share the
  // hole's own numbers, so no lit seam can open between them mid-flight.
  const cTop = useTransform([hTop, mVh], ([t, vh]: number[]) => clamp(t, 0, vh));
  const cBottom = useTransform([hTop, hH, mVh], ([t, h, vh]: number[]) => clamp(t + h, 0, vh));
  const cLeft = useTransform([hLeft, mVw], ([l, vw]: number[]) => clamp(l, 0, vw));
  const cRight = useTransform([hLeft, hW, mVw], ([l, w, vw]: number[]) => clamp(l + w, 0, vw));
  const bandH = useTransform([cTop, cBottom], ([a, b]: number[]) => Math.max(0, b - a));
  const bottomH = useTransform([cBottom, mVh], ([b, vh]: number[]) => Math.max(0, vh - b));
  const rightW = useTransform([cRight, mVw], ([r, vw]: number[]) => Math.max(0, vw - r));

  const camRef = useRef(0);
  const trackRef = useRef(0);
  /** False until the first step of a run has placed the spotlight. */
  const placed = useRef(false);

  const openRef = useRef(open);
  openRef.current = open;
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const bandRef = useRef(bandBottom);
  bandRef.current = bandBottom;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    mSheet.set(sheet ? 1 : 0);
    mBand.set(bandBottom);
  }, [sheet, bandBottom, mSheet, mBand]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const sync = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      mVw.set(w);
      mVh.set(h);
      setView((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [mVw, mVh]);

  const start = useCallback(() => {
    // Already running. The two entry points can race — a visitor who taps the
    // "?" before the first-visit observer has fired gets both — and restarting
    // clears the placed box without re-running the camera (its deps are
    // unchanged), which leaves a scroll-locked page with nothing drawn on it.
    if (openRef.current) return;
    // Nothing on screen to light — the section is still loading, or this build
    // renders without it. Opening anyway would dim the whole page behind an
    // overlay with no hole and no tooltip, i.e. a black wall the user has to
    // guess their way out of.
    const resolved = steps.filter((s) => document.querySelector(s.target));
    if (resolved.length === 0) return;
    setLive(resolved);
    placed.current = false;
    setAnchorBox(null);
    setIndex(0);
    setOpen(true);
  }, [steps]);

  const finish = useCallback(() => {
    window.cancelAnimationFrame(camRef.current);
    setOpen(false);
    setPhase("land");
    placed.current = false;
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
  // fetch), then open once it is genuinely on screen *and* the user has
  // stopped scrolling. Taking the camera mid-flick is what made the old tour
  // feel like a fight before a single pixel had moved.
  useEffect(() => {
    if (seen(storageKey)) return;

    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    let idle = 0;
    let armedAt = 0;
    let done = false;

    const onScroll = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(fire, IDLE_MS);
    };

    const fire = () => {
      if (done) return;
      const wait = DWELL_MS - (Date.now() - armedAt);
      if (wait > 0) {
        idle = window.setTimeout(fire, wait);
        return;
      }
      done = true;
      window.removeEventListener("scroll", onScroll);
      start();
    };

    const arm = () => {
      armedAt = Date.now();
      window.addEventListener("scroll", onScroll, { passive: true });
      idle = window.setTimeout(fire, IDLE_MS);
    };

    const attach = () => {
      const el = document.querySelector(anchor);
      if (!el) return false;
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          io?.disconnect();
          arm();
        },
        { threshold: 0.5, rootMargin: "-12% 0px -20% 0px" }
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
      done = true;
      io?.disconnect();
      mo?.disconnect();
      window.clearTimeout(idle);
      window.removeEventListener("scroll", onScroll);
    };
  }, [anchor, storageKey, start]);

  // Hard scroll lock. Swallowing input is the lock, not `overflow: hidden` —
  // hiding the page's overflow collapses the scrollbar (the layout underneath
  // shifts by its width) and would block the camera tween as well.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prevOverscroll = root.style.overscrollBehavior;
    root.style.overscrollBehavior = "none";

    // A gesture is let through only when something inside the card can really
    // consume it — a scrollable box that is not already pinned against the end
    // it is being pushed toward. Exempting the whole card unconditionally
    // leaks the gesture to the page the moment the pointer rests on the
    // tooltip, which is exactly where it rests after clicking "Vazhdo".
    const consumes = (node: Node | null, dy: number) => {
      const tip = tipRef.current;
      if (!tip || !node || !tip.contains(node)) return false;
      let el: HTMLElement | null =
        node instanceof HTMLElement ? node : node.parentElement;
      while (el && tip.contains(el)) {
        const room = el.scrollHeight - el.clientHeight;
        if (room > 1) {
          const canDown = dy > 0 && Math.ceil(el.scrollTop) < room;
          const canUp = dy < 0 && el.scrollTop > 0;
          if (canDown || canUp || dy === 0) return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const onWheel = (event: WheelEvent) => {
      if (consumes(event.target as Node | null, event.deltaY)) return;
      event.preventDefault();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (consumes(event.target as Node | null, 0)) return;
      event.preventDefault();
    };
    const onKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) event.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey, { passive: false });
    return () => {
      root.style.overscrollBehavior = prevOverscroll;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The camera. One eased progress drives the page scroll *and* the lit box,
  // so in viewport terms the spotlight travels a short, monotonic path however
  // far down the document the next target is. Both ends of the scroll target
  // are clamped, so the browser can never silently land somewhere else and
  // leave the ring pointing at empty space.
  useEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector(step.target);
    if (!el) {
      // The target left the DOM before anything was lit — a feed refresh landing
      // on the same tick. Release rather than hold a locked, empty screen, and
      // don't mark the tour as seen: it is owed to this visitor still.
      if (!placed.current) setOpen(false);
      return;
    }

    window.cancelAnimationFrame(camRef.current);

    const pad = step.padding ?? 10;
    const r = el.getBoundingClientRect();
    const from = window.scrollY;
    const vh = window.innerHeight;
    const isSheet = sheetRef.current;
    const band = bandRef.current;

    const doc: Box = {
      top: r.top + from - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };

    let to = from;
    if (isSheet) {
      if (!(r.top >= BAND_TOP && r.bottom <= band)) to = from + r.top - BAND_TOP - 8;
    } else if (!(r.top >= 110 && r.bottom <= vh - 110)) {
      to = from + r.top - Math.max(110, (vh - r.height) / 2);
    }
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    to = clamp(to, 0, maxScroll);

    // Where the box ends up once the camera has landed — zoom included, so the
    // tooltip is placed against the size the user will actually see.
    const zoom = reducedRef.current || isSheet ? 1 : step.zoom ?? 1;
    const landedTop = doc.top - to;
    const zw = doc.width * zoom;
    const zh = doc.height * zoom;
    const landed: Box = {
      top: landedTop + doc.height / 2 - zh / 2,
      left: doc.left + doc.width / 2 - zw / 2,
      width: zw,
      height: zh,
    };

    const settle = () => {
      window.scrollTo(0, to);
      mScroll.set(to);
      mTop.set(doc.top);
      mLeft.set(doc.left);
      mW.set(doc.width);
      mH.set(doc.height);
      placed.current = true;
      setPhase("land");
    };

    setAnchorBox(landed);

    // Opening: the spotlight is placed on the card at once, in document space,
    // and only the camera travels. Because the hole subtracts the live scroll,
    // it stays welded to the card for the whole glide — the tour arrives *with*
    // the page rather than catching up to it.
    if (!placed.current) {
      mScroll.set(from);
      mTop.set(doc.top);
      mLeft.set(doc.left);
      mW.set(doc.width);
      mH.set(doc.height);
    }

    const start0 = placed.current
      ? { top: mTop.get(), left: mLeft.get(), width: mW.get(), height: mH.get() }
      : doc;
    const travel = Math.max(
      Math.abs(to - from),
      Math.hypot(doc.top - start0.top, doc.left - start0.left)
    );

    // Reduced motion, or nothing actually moves: place it, don't perform it.
    if (reducedRef.current || travel < 1) {
      settle();
      return () => window.cancelAnimationFrame(camRef.current);
    }

    const ms = clamp(280 + travel * 0.4, CAM_MIN_MS, CAM_MAX_MS);
    const t0 = performance.now();
    setPhase("travel");

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = easeOutQuint(p);
      const scroll = from + (to - from) * e;
      window.scrollTo(0, scroll);
      mScroll.set(scroll);
      mTop.set(start0.top + (doc.top - start0.top) * e);
      mLeft.set(start0.left + (doc.left - start0.left) * e);
      mW.set(start0.width + (doc.width - start0.width) * e);
      mH.set(start0.height + (doc.height - start0.height) * e);
      if (p < 1) {
        camRef.current = window.requestAnimationFrame(tick);
        return;
      }
      settle();
    };
    camRef.current = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(camRef.current);
  }, [open, index, step, mTop, mLeft, mW, mH, mScroll]);

  // Push in on the target for the length of the step, once the camera has
  // landed. Skipped on phone widths: the targets are already full-bleed there,
  // so a push-in only pushes them off both edges.
  useEffect(() => {
    if (!open || phase !== "land" || !step?.zoom || reduced || sheet) return;
    const el = document.querySelector(step.target);
    if (!(el instanceof HTMLElement)) return;
    const prev = {
      transform: el.style.transform,
      transition: el.style.transition,
      origin: el.style.transformOrigin,
      willChange: el.style.willChange,
    };
    el.style.transition = `transform ${ZOOM_MS}ms var(--ease-out)`;
    el.style.transformOrigin = "center center";
    el.style.willChange = "transform";
    el.style.transform = `scale(${step.zoom})`;
    return () => {
      el.style.transform = prev.transform;
      // Let it ease back before handing the inline styles back.
      window.setTimeout(() => {
        el.style.transition = prev.transition;
        el.style.transformOrigin = prev.origin;
        el.style.willChange = prev.willChange;
      }, ZOOM_MS);
    };
  }, [open, phase, index, step, reduced, sheet]);

  // Once landed, keep the lit box glued to the element: the zoom transform is
  // still easing, and content around it can reflow. Writes motion values only,
  // so a settled step costs one measurement per frame and no React work.
  useEffect(() => {
    if (!open || !step || phase !== "land") return;
    const pad = step.padding ?? 10;
    const tick = () => {
      const el = document.querySelector(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        const s = window.scrollY;
        mScroll.set(s);
        mTop.set(r.top + s - pad);
        mLeft.set(r.left - pad);
        mW.set(r.width + pad * 2);
        mH.set(r.height + pad * 2);
      }
      trackRef.current = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(trackRef.current);
  }, [open, phase, index, step, mTop, mLeft, mW, mH, mScroll]);

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
      } else if (event.key === "Tab") {
        // The page underneath is dimmed and inert; keep Tab inside the card.
        const focusable = tipRef.current?.querySelectorAll<HTMLElement>("button");
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !tipRef.current?.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, live.length, finish]);

  // The landed box, clipped into the band above the sheet on phone widths —
  // which is what makes the dim visible again there, since an unclipped
  // full-bleed card leaves four scrim panels a few pixels wide.
  const hole = useMemo(() => {
    if (!anchorBox || view.w === 0) return null;
    if (!sheet) return { ...anchorBox, clipTop: false, clipBottom: false };
    const top = Math.max(BAND_TOP, anchorBox.top);
    const bottom = Math.min(anchorBox.top + anchorBox.height, bandBottom);
    return {
      top,
      left: anchorBox.left,
      width: anchorBox.width,
      height: Math.max(BAND_MIN, bottom - top),
      clipTop: anchorBox.top < BAND_TOP - 0.5,
      clipBottom: anchorBox.top + anchorBox.height > bandBottom + 0.5,
    };
  }, [anchorBox, view, sheet, bandBottom]);

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
  const travelling = motionOn && phase === "travel";
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
  // The tooltip is the only thing that moves on its own clock: it is invisible
  // while the camera travels, so its jump to the new spot is never seen.
  const tipMove = { duration: motionOn ? DUR.slow : 0, ease: EASE };

  return createPortal(
    <AnimatePresence>
      {open && anchorBox && (
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
          <motion.div
            className="tour-scrim"
            aria-hidden
            style={{ top: 0, left: 0, width: mVw, height: cTop }}
            onClick={finish}
          />
          <motion.div
            className="tour-scrim"
            aria-hidden
            style={{ top: cBottom, left: 0, width: mVw, height: bottomH }}
            onClick={finish}
          />
          <motion.div
            className="tour-scrim"
            aria-hidden
            style={{ top: cTop, left: 0, width: cLeft, height: bandH }}
            onClick={finish}
          />
          <motion.div
            className="tour-scrim"
            aria-hidden
            style={{ top: cTop, left: cRight, width: rightW, height: bandH }}
            onClick={finish}
          />

          {anchorBox && (
            <motion.div
              className="tour-hole"
              aria-hidden
              data-clip-bottom={hole?.clipBottom ? "" : undefined}
              data-clip-top={hole?.clipTop ? "" : undefined}
              style={{
                top: hTop,
                left: hLeft,
                width: hW,
                height: hH,
                borderRadius: holeRadius,
              }}
            >
              <span className="tour-corners" style={cornerVars} />
              <span
                className="tour-ring"
                data-static={reduced ? "" : undefined}
                data-travel={travelling ? "" : undefined}
              />
            </motion.div>
          )}

          <TourCursor
            script={phase === "land" ? step.cursor ?? null : null}
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
              animate={{
                top: tip.top,
                left: tip.left,
                opacity: travelling ? 0 : 1,
                scale: travelling ? 0.985 : 1,
                y: travelling ? 6 : 0,
              }}
              transition={{
                top: tipMove,
                left: tipMove,
                opacity: { duration: motionOn ? DUR.base : 0, ease: EASE },
                scale: { duration: motionOn ? DUR.slow : 0, ease: EASE },
                y: { duration: motionOn ? DUR.slow : 0, ease: EASE },
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
