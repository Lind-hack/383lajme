"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Text that sets itself down rather than switching on.
 *
 * Words are split at render and staggered, so the line builds left to right
 * the way a hand moves. Word granularity is deliberate: a character-level
 * typewriter on a 70-word paragraph is roughly a thousand animated nodes and
 * it stutters on the phones most of this audience reads on. Words read the
 * same at a fraction of the cost.
 *
 * Every word is real text in the DOM from the first frame — this only changes
 * how it arrives, never whether it is there. Selection, find-in-page and
 * screen readers see an ordinary paragraph, and the whole effect is opt-in
 * via a class, so if the observer never fires the reader simply gets the text.
 */

interface Props {
  text: string;
  /** Milliseconds between words. */
  step?: number;
  /** Delay before the first word, for staggering blocks against each other. */
  offset?: number;
  active: boolean;
  style?: React.CSSProperties;
  as?: "p" | "div" | "span";
  showNib?: boolean;
}

export default function DosjeWritten({
  text,
  step = 26,
  offset = 0,
  active,
  style,
  as = "p",
  showNib = false,
}: Props) {
  const Tag = as;
  const words = text.split(/(\s+)/);
  const total = offset + words.length * step;

  return (
    <Tag style={style}>
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          w
        ) : (
          <span
            key={`${i}-${w}`}
            className="dosje-word"
            style={{ ["--d" as string]: `${offset + i * step}ms` }}
          >
            {w}
          </span>
        )
      )}
      {showNib && active && (
        <span className="dosje-nib" aria-hidden="true" style={{ ["--nib" as string]: `${total + 220}ms` }} />
      )}
    </Tag>
  );
}

/**
 * Fires once when the element has been on screen long enough to be worth
 * animating. Once armed it never re-arms: text that rewrites itself every
 * time it scrolls past is a distraction, not a flourish.
 */
export function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  // Arming happens on the client, never in the server output. Rendered HTML
  // therefore contains plain visible text; if the script never arrives the
  // reader loses the animation and nothing else.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setArmed(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setShown(true);
      return;
    }

    // Visibility is measured, never assumed. An earlier version fell back to a
    // blind timer, which revealed every entry on the page a couple of seconds
    // after load — so each section animated while it was still far below the
    // fold and had finished by the time the reader arrived. Only the first
    // section ever appeared to write itself. Nothing here reveals an element
    // that is not actually on screen.
    // One-way, and deliberately so. The question is not "is this on screen"
    // but "has this been reached", because the reveal happens once and must
    // never be undone. An earlier version also required the element to still
    // be below the top of the viewport, which meant anything scrolled past
    // between two checks — a flick, an anchor jump, the End key — stayed armed
    // and therefore stayed blank permanently. Once the top edge has come up
    // past 90% of the viewport the entry is revealed, whether it is in front
    // of the reader or already behind them.
    const reached = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return r.top < vh * 0.9;
    };

    if (reached()) {
      setShown(true);
      return;
    }

    // Throttled on a timestamp rather than a frame. requestAnimationFrame is
    // the usual choice, but it does not run at all while a tab is unrendered,
    // and this callback decides whether words are visible — it must not be
    // tied to whether the compositor happens to be awake. A rect read every
    // 100ms is cheap enough to be invisible in a scroll profile.
    let last = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - last < 100) return;
      last = now;
      if (reached()) setShown(true);
    };

    // The observer is the cheap path; the listener is what makes it reliable
    // when the observer stays quiet, and it is throttled to one check per
    // frame so scrolling stays smooth on a phone.
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) setShown(true);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
      );
      io.observe(el);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // A tab opened in the background dispatches no scroll events at all, so an
    // entry can already be well past the fold by the time anyone looks at it.
    // Re-checking when the page becomes visible, and on restore from the
    // back/forward cache, is what stops those entries sitting blank.
    const onWake = () => {
      last = 0;
      onScroll();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("pageshow", onWake);

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("pageshow", onWake);
    };
  }, [shown]);

  return { ref, shown, armed };
}
