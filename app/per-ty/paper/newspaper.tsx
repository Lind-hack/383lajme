"use client";

// The reader's paper as a paper you hold open and turn.
//
// On a wide screen it opens as spreads — two pages side by side, Faqja 1–2,
// 3–4… — and turning lifts the right-hand page over the spine onto the left,
// its back being the next left page, the way a newspaper turns. On a phone it
// is one page at a time, lifted away to the left. Every page fits the screen
// (app/per-ty/paper/newspaper.css), so a page is read whole and then turned.
//
// Every way of turning runs the same motion and feels the same:
//
//   • drag the page (mouse, finger or pen) — it follows, and falls back if the
//     drag was short and slow;
//   • click or tap the edge of the page, or the arrows in the bar;
//   • scroll — a wheel or trackpad turns one page per gesture;
//   • ← → (and Page Up / Page Down) on a keyboard.
//
// A turn asked for while another runs is queued, never dropped, so quick taps
// read as quick turns. With reduced motion pages simply cross-fade. The page
// is in the address (#faqja-3), so coming back from an article lands on it.
//
// This component only turns pages; app/per-ty/paper/pages.tsx draws them.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { hashForPage, pageFromHash, spreadStart } from "@/lib/paper-pages.mjs";

export type NewspaperPage = {
  key: string;
  title: string;
  node: ReactNode;
  /** Drawn ahead of time (hidden) so its photos are loaded before it turns into view. Off for pages whose boxes fetch. */
  prefetch?: boolean;
};

type Turn = { from: number; to: number; dir: 1 | -1 };

/** A drag this far through the turn commits it on release… */
const COMMIT_AT = 0.28;
/** …or a flick this fast, in px per ms. */
const FLICK = 0.45;
/** Wide and not taller than wide: two pages side by side. */
const SPREAD_QUERY = "(min-width: 960px) and (min-aspect-ratio: 1/1)";

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function reducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function isEditable(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  return Boolean(node?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog']"));
}

/** Can this box still scroll in the wheel's direction? */
function canScroll(el: Element | null, dy: number) {
  if (!el) return false;
  const box = el as HTMLElement;
  if (box.scrollHeight <= box.clientHeight + 1) return false;
  return dy > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0;
}

export default function Newspaper({
  pages,
  look,
  label,
  lead,
  tools,
  hint = false,
  onPageShown,
  onTurn,
  className = "",
}: {
  pages: NewspaperPage[];
  look: string;
  /** "Gazeta e Lindit" — names the whole paper for assistive tech. */
  label: string;
  /** The left end of the bar: who shared it, on a shared copy. */
  lead?: ReactNode;
  /** Buttons at the right end of the bar: share, arrange, how it works. */
  tools?: ReactNode;
  /** First visit: the corner lifts by itself and a line says how to turn. */
  hint?: boolean;
  /** The indexes on screen, once they have settled. */
  onPageShown?: (indexes: number[]) => void;
  /** The reader turned a page (any way at all). */
  onTurn?: () => void;
  className?: string;
}) {
  const count = pages.length;
  const [view, setView] = useState<1 | 2>(1);
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [fade, setFade] = useState(0);
  const [turned, setTurned] = useState(false);
  const [announce, setAnnounce] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const indexRef = useRef(0);
  const viewRef = useRef<1 | 2>(1);
  const turnRef = useRef<Turn | null>(null);
  const queued = useRef<number | null>(null);
  const swallowClick = useRef(false);
  // The parent's callbacks change identity every render; the handlers read
  // them through refs so a re-render never re-attaches them mid-gesture.
  const onTurnRef = useRef(onTurn);
  onTurnRef.current = onTurn;
  const onShownRef = useRef(onPageShown);
  onShownRef.current = onPageShown;

  // One page or two, from the screen; the address picks the page.
  useEffect(() => {
    const mq = window.matchMedia(SPREAD_QUERY);
    const apply = () => {
      const v: 1 | 2 = mq.matches ? 2 : 1;
      viewRef.current = v;
      setView(v);
      indexRef.current = spreadStart(indexRef.current, v);
      setIndex(indexRef.current);
    };
    indexRef.current = pageFromHash(window.location.hash, count);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
    // Only on mount: later changes come from turning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fewer pages than before (a follow removed): stay inside the paper.
  useEffect(() => {
    if (index > count - 1) {
      indexRef.current = spreadStart(Math.max(0, count - 1), viewRef.current);
      setIndex(indexRef.current);
    }
  }, [count, index]);

  useEffect(() => {
    if (turn) return;
    const shown = view === 2 ? [index, index + 1].filter((i) => i < count) : [index];
    if (!pages[index]) return;
    try {
      window.history.replaceState(window.history.state, "", hashForPage(index));
    } catch {
      // A sandboxed frame may refuse; the paper still works.
    }
    setAnnounce(
      shown.length > 1
        ? `Faqet ${index + 1} dhe ${index + 2} nga ${count}: ${shown.map((i) => pages[i].title).join(", ")}`
        : `Faqja ${index + 1} nga ${count}: ${pages[index].title}`
    );
    onShownRef.current?.(shown);
    // pages change identity every render; the index, view and count are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, turn, count, view]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  /** The lifted page at progress p: 0 lying where it started, 1 turned over. */
  const paint = useCallback((t: Turn, p: number) => {
    const k = Math.min(1, Math.max(0, p));
    const angle = t.dir === 1 ? -180 * k : -180 * (1 - k);
    if (leafRef.current) leafRef.current.style.transform = `rotateY(${angle}deg)`;
    // How far the page stands off the paper: 0 flat, 1 upright.
    const lift = Math.sin((Math.abs(angle) / 180) * Math.PI);
    bookRef.current?.style.setProperty("--np-lift", lift.toFixed(3));
    bookRef.current?.style.setProperty("--np-over", Math.abs(angle) > 90 ? "1" : "0");
  }, []);

  const goRef = useRef<(to: number, fast?: boolean) => void>(() => {});

  const finish = useCallback((t: Turn, done: boolean) => {
    bookRef.current?.style.setProperty("--np-lift", "0");
    turnRef.current = null;
    setTurn(null);
    if (done) {
      indexRef.current = t.to;
      setIndex(t.to);
      setTurned(true);
    }
    const next = queued.current;
    queued.current = null;
    if (next !== null && next !== indexRef.current) {
      // Let React draw the settled spread first.
      requestAnimationFrame(() => goRef.current(next, true));
    }
  }, []);

  const run = useCallback(
    (t: Turn, fromP: number, toP: number, ms: number, curve = easeInOut) => {
      if (frame.current) cancelAnimationFrame(frame.current);
      const start = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / ms);
        paint(t, fromP + (toP - fromP) * curve(k));
        if (k < 1) frame.current = requestAnimationFrame(step);
        else {
          frame.current = null;
          finish(t, toP === 1);
        }
      };
      frame.current = requestAnimationFrame(step);
    },
    [paint, finish]
  );

  /** Bring the paper back into view if the reader had scrolled away from it. */
  const toPaper = useCallback(() => {
    const top = stageRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 80, behavior: reducedMotion() ? "auto" : "smooth" });
  }, []);

  const go = useCallback(
    (target: number, fast = false) => {
      const v = viewRef.current;
      const to = spreadStart(Math.min(Math.max(target, 0), count - 1), v);
      if (turnRef.current) {
        queued.current = to;
        return;
      }
      const from = indexRef.current;
      if (to === from) return;
      onTurnRef.current?.();
      toPaper();
      if (reducedMotion()) {
        indexRef.current = to;
        setIndex(to);
        setFade((n) => n + 1);
        setTurned(true);
        return;
      }
      const t: Turn = { from, to, dir: to > from ? 1 : -1 };
      turnRef.current = t;
      setTurn(t);
      // Let React put the lifted page in place before it moves.
      requestAnimationFrame(() => {
        paint(t, 0);
        run(t, 0, 1, fast ? 420 : Math.abs(to - from) > v ? 760 : 640);
      });
    },
    [count, paint, run, toPaper]
  );
  goRef.current = go;

  const next = useCallback(() => go((turnRef.current ? (queued.current ?? turnRef.current.to) : indexRef.current) + viewRef.current), [go]);
  const prev = useCallback(() => go((turnRef.current ? (queued.current ?? turnRef.current.to) : indexRef.current) - viewRef.current), [go]);

  // "Në këtë numër" turns to a page by its address.
  useEffect(() => {
    const onHash = () => go(pageFromHash(window.location.hash, count));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [go, count]);

  // ← → and Page Up / Page Down
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isEditable(e.target)) return;
      // A sheet (Rregullo, Ndaje) is open over the paper: its keys are its own.
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Wheel and trackpad: one page per gesture. At the first and last page the
  // wheel scrolls the site as usual, and a page with more in it scrolls first.
  useEffect(() => {
    const book = bookRef.current;
    if (!book) return;
    let acc = 0;
    let last = 0;
    let spent = false;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      const now = performance.now();
      const gap = now - last;
      last = now;
      if (gap > 260) {
        acc = 0;
        spent = false;
      }
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const d = (horizontal ? e.deltaX : e.deltaY) * scale;
      if (!d) return;
      if (!horizontal) {
        if (canScroll((e.target as HTMLElement)?.closest?.(".np-body") ?? null, d)) return;
        // Only while the paper is the thing on screen.
        const r = stageRef.current?.getBoundingClientRect();
        if (!r || r.top < -60 || r.bottom > window.innerHeight + 60) return;
      }
      const dir = d > 0 ? 1 : -1;
      const base = turnRef.current ? (queued.current ?? turnRef.current.to) : indexRef.current;
      const target = base + dir * viewRef.current;
      if (target < 0 || target >= count) return;
      e.preventDefault();
      // The rest of a gesture that already turned a page (trackpad momentum).
      if (spent) return;
      acc += d;
      if (Math.abs(acc) >= (horizontal ? 36 : 50)) {
        acc = 0;
        spent = true;
        go(target);
      }
    };
    book.addEventListener("wheel", onWheel, { passive: false });
    return () => book.removeEventListener("wheel", onWheel);
  }, [count, go]);

  // Drag: the page follows the pointer and turns or falls back on release.
  useEffect(() => {
    const book = bookRef.current;
    if (!book) return;
    let id: number | null = null;
    let x0 = 0;
    let y0 = 0;
    let lastX = 0;
    let lastT = 0;
    let v = 0;
    let dragging: Turn | null = null;
    let p = 0;

    const down = (e: PointerEvent) => {
      if (turnRef.current || reducedMotion() || (e.pointerType === "mouse" && e.button !== 0)) return;
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, label, [data-no-flip]")) return;
      id = e.pointerId;
      x0 = lastX = e.clientX;
      y0 = e.clientY;
      lastT = performance.now();
      v = 0;
      dragging = null;
      p = 0;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      const now = performance.now();
      v = (e.clientX - lastX) / Math.max(1, now - lastT);
      lastX = e.clientX;
      lastT = now;
      if (!dragging) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) {
          if (Math.abs(dy) > 12) id = null; // a scroll, not a turn
          return;
        }
        const vw = viewRef.current;
        const from = indexRef.current;
        const to = dx < 0 ? from + vw : from - vw;
        if (to < 0 || to >= count) {
          id = null;
          return;
        }
        dragging = { from, to: spreadStart(to, vw), dir: dx < 0 ? 1 : -1 };
        turnRef.current = dragging;
        setTurn(dragging);
        onTurnRef.current?.();
        swallowClick.current = true;
        try {
          book.setPointerCapture(e.pointerId);
        } catch {
          // fine without capture
        }
      }
      // Two pages open: from the edge to the spine is half a turn. One page: the width is the whole turn.
      const leafW = (book.clientWidth || 1) / viewRef.current;
      const span = viewRef.current === 2 ? leafW * 2 : leafW * 0.9;
      p = Math.min(1, Math.max(0, (dragging.dir === 1 ? -dx : dx) / span));
      paint(dragging, p);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      if (!dragging) return;
      const t = dragging;
      dragging = null;
      const flick = t.dir === 1 ? v < -FLICK : v > FLICK;
      const back = t.dir === 1 ? v > FLICK : v < -FLICK;
      const commit = !back && (p > COMMIT_AT || flick);
      if (commit) toPaper();
      run(t, p, commit ? 1 : 0, Math.max(160, 480 * (commit ? 1 - p : p)), easeOut);
      // The click a drag ends with arrives right away; never swallow a later, real one.
      window.setTimeout(() => {
        swallowClick.current = false;
      }, 300);
    };
    const click = (e: MouseEvent) => {
      if (swallowClick.current) {
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const noDrag = (e: DragEvent) => e.preventDefault();

    book.addEventListener("pointerdown", down);
    book.addEventListener("pointermove", move);
    book.addEventListener("pointerup", up);
    book.addEventListener("pointercancel", up);
    book.addEventListener("click", click, true);
    book.addEventListener("dragstart", noDrag);
    return () => {
      book.removeEventListener("pointerdown", down);
      book.removeEventListener("pointermove", move);
      book.removeEventListener("pointerup", up);
      book.removeEventListener("pointercancel", up);
      book.removeEventListener("click", click, true);
      book.removeEventListener("dragstart", noDrag);
    };
  }, [count, paint, run, toPaper]);

  // What lies where: the pages open now, or, mid-turn, the pages beneath and
  // the two faces of the one being lifted.
  const page = (i: number) => pages[i] ?? null;
  let left: NewspaperPage | null = null;
  let right: NewspaperPage | null = null;
  let front: NewspaperPage | null = null;
  let back: NewspaperPage | null = null;
  if (view === 2) {
    if (!turn) {
      left = page(index);
      right = page(index + 1);
    } else if (turn.dir === 1) {
      left = page(turn.from);
      right = page(turn.to + 1);
      front = page(turn.from + 1);
      back = page(turn.to);
    } else {
      left = page(turn.to);
      right = page(turn.from + 1);
      front = page(turn.to + 1);
      back = page(turn.from);
    }
  } else if (!turn) {
    right = page(index);
  } else {
    right = page(turn.dir === 1 ? turn.to : turn.from);
    front = page(turn.dir === 1 ? turn.from : turn.to);
  }

  // The neighbours, drawn hidden, so their photos are ready when they turn into view.
  const ahead: NewspaperPage[] = [];
  for (let i = index - view; i < index + 3 * view; i++) {
    const p = pages[i];
    if (p && p.prefetch !== false && p !== left && p !== right && p !== front && p !== back) ahead.push(p);
  }

  const atStart = index === 0;
  const atEnd = index + view >= count;
  const where =
    view === 2 && index + 1 < count ? `${index + 1}–${index + 2}` : `${index + 1}`;
  const progress = count > 0 ? Math.min(1, (index + view) / count) : 0;
  const face = (p: NewspaperPage | null) => p?.node ?? <div className="np-sheet np-sheet--blank" />;

  return (
    <div className={`np ${className}`} data-look={look}>
      <div className="np-bar">
        {lead && <div className="np-bar-lead">{lead}</div>}
        <nav className="np-pager" aria-label="Faqet e gazetës">
          <button type="button" className="np-pager-btn" onClick={prev} disabled={atStart && !turn} aria-label="Faqja e mëparshme">
            <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <p className="np-pager-where" aria-hidden="true">
            <b>{where}</b> / {count}
          </p>
          <button type="button" className="np-pager-btn" onClick={next} disabled={atEnd && !turn} aria-label="Faqja tjetër">
            <ChevronRight size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </nav>
        {tools && <div className="np-tools">{tools}</div>}
        <span className="np-progress" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <div ref={stageRef} className="np-stage">
        <div
          ref={bookRef}
          className="np-book"
          data-view={view}
          data-turning={turn ? (turn.dir === 1 ? "next" : "prev") : undefined}
          data-hint={hint && !turned && atStart ? "" : undefined}
          role="region"
          aria-label={label}
          aria-roledescription="gazetë"
        >
          {view === 2 && (
            <div key={`l-${left?.key ?? "none"}`} className="np-slot np-slot--left" style={{ animation: fade && !turn ? `np-fade-${fade % 2} 200ms ease-out` : undefined }}>
              {face(left)}
            </div>
          )}
          <div key={`r-${right?.key ?? "none"}`} className="np-slot np-slot--right" style={{ animation: fade && !turn ? `np-fade-${fade % 2} 200ms ease-out` : undefined }}>
            {face(right)}
            {turn && <div className="np-cast" aria-hidden="true" />}
          </div>
          {view === 2 && <div className="np-spine" aria-hidden="true" />}

          {turn && (
            <div ref={leafRef} className="np-leaf" aria-hidden="true" style={{ transform: turn.dir === 1 ? "rotateY(0deg)" : "rotateY(-180deg)" }}>
              <div className="np-face np-face--front">
                {face(front)}
                <div className="np-face-shade" />
              </div>
              <div className="np-face np-face--back">
                {view === 2 ? face(back) : <div className="np-sheet np-sheet--blank" />}
                <div className="np-face-shade" />
              </div>
            </div>
          )}

          {!turn && !atStart && (
            <button type="button" className="np-edge np-edge--prev" onClick={prev} aria-label="Kthehu një faqe prapa">
              <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
          {!turn && !atEnd && (
            <button type="button" className="np-edge np-edge--next" onClick={next} aria-label="Kthe faqen">
              <span className="np-fold" aria-hidden="true" />
              <ChevronRight size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}

          {hint && !turned && atStart && !turn && !atEnd && (
            <p className="np-hint" aria-hidden="true">
              {view === 2 ? "Tërhiq faqen, kliko anën e saj ose rrotullo — si gazetë e vërtetë" : "Rrëshqit majtas për faqen tjetër"}
            </p>
          )}

          {ahead.length > 0 && (
            <div className="np-ahead" aria-hidden="true" inert>
              {ahead.map((p) => (
                <div key={p.key} className="np-ahead-page">
                  {p.node}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
