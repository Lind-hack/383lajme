"use client";

import { useEffect, useState } from "react";
import { playSwordClash } from "@/components/tregu/trade-success-sound";
import "./leagues.css";

/** The moment the blades meet, in ms from the start (sound is lined up to it). */
const HIT_MS = 380;
const TOTAL_MS = 900;

function Sword({ side }: { side: "left" | "right" }) {
  return (
    <svg className="clash-sword" data-side={side} viewBox="0 0 40 160" aria-hidden>
      <defs>
        <linearGradient id={`blade-${side}`} x1="0" x2="1">
          <stop offset="0" stopColor="#F3F1EC" />
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#B9B4AA" />
        </linearGradient>
      </defs>
      {/* blade */}
      <path d="M20 4 L26 18 L26 108 L14 108 L14 18 Z" fill={`url(#blade-${side})`} stroke="#6E655A" strokeWidth="1.2" />
      <path d="M20 10 L20 104" stroke="#D8D3CA" strokeWidth="1" />
      {/* guard */}
      <rect x="3" y="106" width="34" height="8" rx="4" fill="#C2360F" />
      {/* grip and pommel */}
      <rect x="15" y="114" width="10" height="30" rx="3" fill="#5A3A22" />
      <circle cx="20" cy="150" r="6" fill="#E2A93F" />
    </svg>
  );
}

/**
 * Two swords swing in from either side and strike in the middle with a flash,
 * a short shake and the clash sound, then clear (~0.9 s). Fires each time
 * `run` changes to a new number, which callers only do from the reader's own
 * tap, so the sound is always user-initiated.
 * Reduced motion: no swing, flash or shake — the crossed swords simply appear.
 */
export default function SwordClash({ run, onDone }: { run: number; onDone?: () => void }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!run) return;
    setActive(run);
    playSwordClash(HIT_MS);
    const timer = window.setTimeout(() => {
      setActive(0);
      onDone?.();
    }, TOTAL_MS);
    return () => window.clearTimeout(timer);
    // onDone is a callback from the parent; re-running on its identity would replay the clash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  if (!active) return null;
  return (
    <div className="clash" key={active} role="presentation" aria-hidden>
      <div className="clash-stage">
        <Sword side="left" />
        <Sword side="right" />
        <span className="clash-flash" />
      </div>
    </div>
  );
}
