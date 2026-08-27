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

    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    // Anything already on screen is revealed straight away, measured rather
    // than observed. An observer is the wrong instrument for "is this visible
    // right now": it reports changes, and for an element that is already
    // intersecting it may not report at all until something moves — and in a
    // background or occluded tab it can stay silent indefinitely. Measuring
    // makes the common case deterministic.
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh * 0.92 && rect.bottom > 0) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
    );
    io.observe(el);

    // Last line of defence. If neither path has fired by now something is
    // wrong with the observer, not with the reader's right to the text.
    const failsafe = window.setTimeout(() => setShown(true), 2500);

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [shown]);

  return { ref, shown, armed };
}
