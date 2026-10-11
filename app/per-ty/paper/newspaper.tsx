"use client";

// The reader's paper as pages you turn.
//
// Every page stays mounted; only one shows. Turning lifts the page you are on
// around its left edge, the way a sheet of newsprint turns, with its shadow
// falling on the page beneath (forward), or brings the previous page back down
// over it (back). The same motion runs from every way in:
//
//   • the folded corner at the bottom of the sheet, or the arrows in the pager;
//   • ← and → on a keyboard;
//   • a swipe on a phone or tablet — the page follows the finger, and lets go
//     back if the swipe was short and slow.
//
// With reduced motion the pages simply cross-fade. The page number lives in the
// address (#faqja-3), so coming back from an article lands on the same page,
// and a screen reader hears "Faqja 3 nga 6: Sport" after every turn.
//
// This component only turns pages; app/per-ty/paper/pages.tsx draws them.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { hashForPage, pageFromHash } from "@/lib/paper-pages.mjs";

export type NewspaperPage = { key: string; title: string; node: ReactNode };

type Turn = { from: number; to: number; dir: 1 | -1 };

/** A swipe this far across the sheet (of its width) turns the page on release. */
const COMMIT_AT = 0.33;
/** …or a flick this fast, in px per ms. */
const FLICK = 0.45;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function isEditable(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  return Boolean(node?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog']"));
}

export default function Newspaper({
  pages,
  look,
  label,
  tools,
  hint = false,
  onPageShown,
  className = "",
}: {
  pages: NewspaperPage[];
  look: string;
  /** "Gazeta e Lindit" — names the whole paper for assistive tech. */
  label: string;
  /** Buttons for the bar above the paper: share, arrange, how it works. */
  tools?: ReactNode;
  /** The first time: the corner lifts by itself to show that pages turn. */
  hint?: boolean;
  /** Called with the page's index once it has settled on screen. */
  onPageShown?: (index: number) => void;
  className?: string;
}) {
  const count = pages.length;
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [fade, setFade] = useState(0);
  const [turned, setTurned] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const frame = useRef<number | null>(null);
  const indexRef = useRef(0);
  const turnRef = useRef<Turn | null>(null);
  const focusAfter = useRef(false);
  const swallowClick = useRef(false);
  const [announce, setAnnounce] = useState("");

  // The page in the address, once on the client.
  useEffect(() => {
    const start = pageFromHash(window.location.hash, count);
    indexRef.current = start;
    setIndex(start);
    // Only on mount: later changes come from turning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fewer pages than before (a follow removed): stay inside the paper.
  useEffect(() => {
    if (index > count - 1) {
      indexRef.current = Math.max(0, count - 1);
      setIndex(indexRef.current);
    }
  }, [count, index]);

  useEffect(() => {
    if (turn) return;
    const page = pages[index];
    if (!page) return;
    try {
      window.history.replaceState(window.history.state, "", hashForPage(index));
    } catch {
      // A sandboxed frame may refuse; the paper still works.
    }
    setAnnounce(`Faqja ${index + 1} nga ${count}: ${page.title}`);
    onPageShown?.(index);
    if (focusAfter.current) {
      focusAfter.current = false;
      wrapRefs.current[index]?.focus({ preventScroll: true });
    }
    // pages change identity every render; the index and count are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, turn, count]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  /** Put the turning page at progress p (0 = not lifted, 1 = turned over). */
  const paint = useCallback((t: Turn, p: number) => {
    const leaf = wrapRefs.current[t.dir === 1 ? t.from : t.to];
    const angle = t.dir === 1 ? -180 * p : -180 * (1 - p);
    if (leaf) leaf.style.transform = `rotateY(${angle}deg)`;
    const shade = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI) * 0.95;
    stageRef.current?.style.setProperty("--np-shade", String(shade));
  }, []);

  const finish = useCallback((t: Turn, done: boolean) => {
    const leaf = wrapRefs.current[t.dir === 1 ? t.from : t.to];
    if (leaf) leaf.style.transform = "";
    stageRef.current?.style.setProperty("--np-shade", "0");
    turnRef.current = null;
    setTurn(null);
    if (done) {
      indexRef.current = t.to;
      setIndex(t.to);
      setTurned(true);
    }
  }, []);

  const run = useCallback(
    (t: Turn, fromP: number, toP: number, ms: number, curve = ease) => {
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

  /** Look at the turning page from the middle of the screen, wherever the page is scrolled to. */
  const aim = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect().top;
    // toTop() is about to bring a scrolled-past paper back to 96 px from the top.
    const top = rect < 0 ? 96 : rect;
    const eye = Math.max(0, Math.min(stage.offsetHeight, window.innerHeight / 2 - top));
    stage.style.setProperty("--np-eye", `${Math.round(eye)}px`);
  }, []);

  /** Bring the top of the paper into view if the reader had scrolled past it. */
  const toTop = useCallback(() => {
    const top = stageRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) {
      window.scrollTo({ top: window.scrollY + top - 96, behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, []);

  const go = useCallback(
    (to: number, opts: { focus?: boolean } = {}) => {
      const from = indexRef.current;
      if (turnRef.current || to === from || to < 0 || to >= count) return;
      focusAfter.current = Boolean(opts.focus);
      toTop();
      if (reducedMotion()) {
        indexRef.current = to;
        setIndex(to);
        setFade((n) => n + 1);
        setTurned(true);
        return;
      }
      const t: Turn = { from, to, dir: to > from ? 1 : -1 };
      aim();
      turnRef.current = t;
      setTurn(t);
      // Let React place the leaf before it moves.
      requestAnimationFrame(() => {
        paint(t, 0);
        run(t, 0, 1, Math.abs(to - from) > 1 ? 900 : 760);
      });
    },
    [count, paint, run, toTop, aim]
  );

  // "Në këtë numër" and "Si funksionon?" turn to a page by its address.
  useEffect(() => {
    const onHash = () => go(pageFromHash(window.location.hash, count), { focus: true });
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [go, count]);

  const next = useCallback((focus = false) => go(indexRef.current + 1, { focus }), [go]);
  const prev = useCallback((focus = false) => go(indexRef.current - 1, { focus }), [go]);

  // ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isEditable(e.target)) return;
      // A sheet (Rregullo, Ndaje) is open over the paper: its keys are its own.
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next(true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Swipe: touch and pen only; a mouse selects text and uses the corner.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let id: number | null = null;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let dragging: Turn | null = null;
    let p = 0;

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || turnRef.current || reducedMotion()) return;
      if ((e.target as HTMLElement)?.closest?.("button, input, textarea, select, [data-no-flip]")) return;
      id = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
      t0 = performance.now();
      dragging = null;
      p = 0;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!dragging) {
        if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy) * 1.3) {
          if (Math.abs(dy) > 14) id = null; // a scroll, not a swipe
          return;
        }
        const from = indexRef.current;
        const to = dx < 0 ? from + 1 : from - 1;
        if (to < 0 || to >= count) {
          id = null;
          return;
        }
        dragging = { from, to, dir: to > from ? 1 : -1 };
        aim();
        turnRef.current = dragging;
        setTurn(dragging);
        swallowClick.current = true;
        try {
          stage.setPointerCapture(e.pointerId);
        } catch {
          // fine without capture
        }
      }
      const width = stage.clientWidth || 1;
      p = Math.min(1, Math.max(0, (dragging.dir === 1 ? -dx : dx) / (width * 0.85)));
      paint(dragging, p);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      if (!dragging) return;
      const t = dragging;
      dragging = null;
      const v = (e.clientX - x0) / Math.max(1, performance.now() - t0);
      const flick = t.dir === 1 ? v < -FLICK : v > FLICK;
      const commit = p > COMMIT_AT || flick;
      if (commit) toTop();
      run(t, p, commit ? 1 : 0, Math.max(180, 520 * (commit ? 1 - p : p)), easeOut);
      // The click a swipe ends with (if any) arrives right away; never swallow a later, real tap.
      window.setTimeout(() => {
        swallowClick.current = false;
      }, 350);
    };
    const click = (e: MouseEvent) => {
      if (swallowClick.current) {
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("click", click, true);
    return () => {
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
      stage.removeEventListener("click", click, true);
    };
  }, [count, paint, run, toTop, aim]);

  const current = pages[index];
  const leafIndex = turn ? (turn.dir === 1 ? turn.from : turn.to) : -1;
  const baseIndex = turn ? (turn.dir === 1 ? turn.to : turn.from) : index;

  return (
    <div className={`np ${className}`} data-look={look}>
      <div className="np-desk">
        {tools && <div className="np-tools">{tools}</div>}

        <nav className="np-pager" aria-label="Faqet e gazetës">
          <button
            type="button"
            className="np-pager-btn"
            onClick={() => prev(true)}
            disabled={index === 0 || Boolean(turn)}
            aria-label="Faqja e mëparshme"
          >
            <ArrowLeft size={18} strokeWidth={2.4} aria-hidden="true" />
            <span aria-hidden="true">Faqja e mëparshme</span>
          </button>
          <div className="np-pager-mid">
            <p className="np-pager-where" aria-hidden="true">
              <b>Faqja {index + 1}</b> nga {count}
              {current ? ` · ${current.title}` : ""}
            </p>
            <div className="np-dots">
              {pages.map((page, i) => (
                <button
                  key={page.key}
                  type="button"
                  className="np-dot"
                  aria-label={`Faqja ${i + 1}: ${page.title}`}
                  aria-current={i === index ? "page" : undefined}
                  onClick={() => go(i, { focus: true })}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className="np-pager-btn"
            onClick={() => next(true)}
            disabled={index === count - 1 || Boolean(turn)}
            aria-label="Faqja tjetër"
          >
            <span aria-hidden="true">Faqja tjetër</span>
            <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </nav>

        <div
          ref={stageRef}
          className="np-stage"
          data-turning={turn ? "" : undefined}
          data-hint={hint && !turned && index === 0 ? "" : undefined}
          role="region"
          aria-label={label}
          aria-roledescription="gazetë"
        >
          {turn && <div className="np-under-shade" aria-hidden="true" />}
          {pages.map((page, i) => {
            const isLeaf = i === leafIndex;
            const isBase = i === baseIndex;
            return (
              <div
                key={page.key}
                ref={(el) => {
                  wrapRefs.current[i] = el;
                }}
                hidden={!isLeaf && !isBase}
                aria-hidden={isLeaf || undefined}
                tabIndex={-1}
                aria-label={`Faqja ${i + 1}: ${page.title}`}
                className={`np-page${isLeaf ? " np-leaf" : isBase ? " np-current" : ""}`}
                style={{ animation: isBase && fade ? `np-fade-${fade % 2} 180ms ease-out` : undefined }}
              >
                {page.node}
                {isLeaf && <div className="np-leaf-back" aria-hidden="true" />}
                {isLeaf && <div className="np-leaf-shade" aria-hidden="true" />}
              </div>
            );
          })}

          {!turn && index > 0 && (
            <button type="button" className="np-corner np-corner--prev" onClick={() => prev()} aria-label="Kthehu një faqe prapa">
              <span className="np-corner-label" aria-hidden="true">
                ← Prapa
              </span>
            </button>
          )}
          {!turn && index < count - 1 && (
            <button type="button" className="np-corner np-corner--next" onClick={() => next()} aria-label="Kthe faqen">
              <span className="np-corner-label" aria-hidden="true">
                Kthe faqen →
              </span>
            </button>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    </div>
  );
}
