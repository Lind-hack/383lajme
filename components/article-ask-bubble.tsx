"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { Chip } from "./ask-panel";

/**
 * The questions this article raises, offered where the reader already is.
 *
 * The ask panel sits at the end of the body, which is the right place to
 * answer from and the wrong place to be discovered from: a reader two
 * paragraphs in with a question has no idea it exists. This is the pointer to
 * it — a circle under the navbar that opens into the same questions.
 *
 * It is deliberately quiet about it. It waits until the reader is actually
 * reading rather than greeting them on arrival, opens once, and collapses to a
 * circle they can ignore for the rest of the page. Dismissing it is remembered
 * for the session, because a suggestion that returns after being closed is not
 * a suggestion.
 */
export default function ArticleAskBubble({
  chips,
  onPick,
}: {
  chips: Chip[];
  onPick: (question: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const openedOnce = useRef(false);

  // Session-scoped, per page. sessionStorage rather than localStorage: closing
  // it means "not now", not "never again on any article".
  const key = typeof window === "undefined" ? "" : `pyet-bubble:${window.location.pathname}`;

  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem(key) !== "closed") setDismissed(false);
    } catch {
      setDismissed(false);
    }
  }, [key]);

  // Appear once the reader is into the piece. Scrolling past the first screen
  // is the signal that they are reading rather than passing through; the timer
  // is the fallback for a short article that never scrolls.
  useEffect(() => {
    if (dismissed || openedOnce.current) return;

    const reveal = () => {
      if (openedOnce.current) return;
      openedOnce.current = true;
      setOpen(true);
    };
    const onScroll = () => {
      if (window.scrollY > 600) reveal();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const timer = window.setTimeout(reveal, 12000);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [dismissed]);

  function close() {
    setOpen(false);
    setDismissed(true);
    try {
      sessionStorage.setItem(key, "closed");
    } catch {
      // A blocked storage should not keep the bubble on screen.
    }
  }

  if (!mounted || dismissed || chips.length === 0) return null;

  return (
    <div className="pyet-bubble" data-open={open || undefined}>
      {open ? (
        <div className="pyet-bubble-card" role="dialog" aria-label="Pyetje për këtë artikull">
          <div className="pyet-bubble-head">
            <Sparkles size={14} strokeWidth={2.4} aria-hidden="true" />
            <strong>Pyet 383 për këtë lajm</strong>
            <button type="button" onClick={close} aria-label="Mbyll">
              <X size={14} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </div>
          <ul>
            {chips.slice(0, 3).map((chip, i) => (
              <li key={chip.question} style={{ "--i": i } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(chip.question);
                    setOpen(false);
                  }}
                >
                  {chip.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          className="pyet-bubble-dot"
          onClick={() => setOpen(true)}
          aria-label="Shfaq pyetjet për këtë artikull"
        >
          <Sparkles size={17} strokeWidth={2.3} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
