"use client";

// Loading states, timed to what the reader actually perceives.
//
//   < 1.2s   nothing. A spinner that flashes for 400ms reads as a glitch, and
//            the work usually finishes before anyone would have read it.
//   1.2-10s  spinner plus a line of text that changes. Visible effort is what
//            makes the wait feel like work being done rather than a hang.
//   > 10s    a determinate bar. Past ten seconds the reader wants to know how
//            much longer, and a spinner cannot say.
//   > 25s    stop pretending. Hand over an explicit failure with a retry.
//
// The server-safe case — a shape we already know, drawn with no JS and no
// timing at all — lives in ./skeleton so it stays out of the client bundle.

import { useEffect, useState } from "react";
import InlineError, { RetryButton } from "./inline-error";

const SPINNER_AT = 1200;
const PROGRESS_AT = 10000;
const GIVE_UP_AT = 25000;

const DEFAULT_PHRASES = [
  "Po marrim të dhënat…",
  "Po i rendisim lajmet…",
  "Edhe pak…",
];

export function DelayedSpinner({
  phrases = DEFAULT_PHRASES,
  onRetry,
  label = "Po ngarkohet",
}: {
  phrases?: string[];
  onRetry?: () => void;
  label?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 250);
    return () => window.clearInterval(id);
  }, []);

  if (elapsed < SPINNER_AT) return null;

  if (elapsed >= GIVE_UP_AT) {
    return (
      <InlineError
        tone="panel"
        title="Kjo pjesë nuk u ngarkua dot."
        detail="Lidhja po zgjat shumë më tepër se zakonisht. Pjesa tjetër e faqes funksionon normalisht."
        action={onRetry ? <RetryButton onClick={onRetry} /> : undefined}
      />
    );
  }

  const slow = elapsed >= PROGRESS_AT;
  // The phrase advances every 2.5s so the reader can tell the page is still
  // working. It is not a progress claim and never pretends to be one.
  const phrase = phrases[Math.floor(elapsed / 2500) % phrases.length];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        minHeight: "160px",
        padding: "24px",
      }}
    >
      {slow ? (
        <div className="ui-progress" aria-hidden="true">
          <i />
        </div>
      ) : (
        <span className="ui-spinner" aria-hidden="true" />
      )}

      <p
        style={{
          margin: 0,
          fontSize: "15px",
          color: "#5A5A5A",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {slow ? "Po zgjat më shumë se zakonisht." : phrase}
      </p>
    </div>
  );
}
