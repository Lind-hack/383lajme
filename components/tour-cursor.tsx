"use client";

// Ghost pointer for the tutorials. Plays a declarative script of beats —
// move here, click that, drag across — so a tour can *show* an interaction
// instead of describing it. Renders nothing under reduced motion.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Where a beat points. A bare selector means that element's centre; the object
 * form lands on a fraction across it, which is how the chart beats sweep from
 * the left edge of the line to the right without knowing the chart's geometry.
 */
export type CursorAnchor =
  | string
  | { x: number; y: number }
  | { sel: string; fx?: number; fy?: number };

export type CursorBeat =
  /** Glide to the anchor, then wait `hold` ms. `run` fires as the glide starts,
   *  so a camera move can travel with the pointer rather than after it. */
  | { at: CursorAnchor; hold?: number; run?: () => void }
  /** Glide to the anchor, then play the click ripple. `run` fires on impact. */
  | { click: CursorAnchor; hold?: number; run?: () => void }
  /** Press on `from`, slide to `to`, release. */
  | { drag: { from: CursorAnchor; to: CursorAnchor; ms?: number } };

export interface CursorScript {
  beats: CursorBeat[];
  /** Restart from the top once the last beat finishes. */
  loop?: boolean;
}

interface Props {
  script?: CursorScript | null;
  /** The cursor only runs while its owner is on screen. */
  active: boolean;
  reduced: boolean;
}

interface Point {
  x: number;
  y: number;
}

const MOVE_MS = 620;
const CLICK_MS = 420;
const HOLD_MS = 520;

function resolve(anchor: CursorAnchor): Point | null {
  if (typeof anchor === "object" && "x" in anchor) return anchor;
  const selector = typeof anchor === "string" ? anchor : anchor.sel;
  const fx = typeof anchor === "string" ? 0.5 : anchor.fx ?? 0.5;
  const fy = typeof anchor === "string" ? 0.5 : anchor.fy ?? 0.5;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width * fx, y: r.top + r.height * fy };
}

export default function TourCursor({ script, active, reduced }: Props) {
  const [point, setPoint] = useState<Point | null>(null);
  const [clicking, setClicking] = useState(false);
  const [pressed, setPressed] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];

    if (!active || reduced || !script || script.beats.length === 0) {
      setPoint(null);
      setClicking(false);
      setPressed(false);
      return;
    }

    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.current.push(window.setTimeout(resolve, ms));
      });

    const play = async () => {
      do {
        for (const beat of script.beats) {
          if (cancelled) return;

          if ("drag" in beat) {
            const from = resolve(beat.drag.from);
            const to = resolve(beat.drag.to);
            if (!from || !to) continue;
            setPoint(from);
            await wait(MOVE_MS);
            if (cancelled) return;
            setPressed(true);
            await wait(180);
            if (cancelled) return;
            setPoint(to);
            await wait(beat.drag.ms ?? 900);
            if (cancelled) return;
            setPressed(false);
            await wait(220);
            continue;
          }

          if ("click" in beat) {
            const target = resolve(beat.click);
            if (!target) continue;
            setPoint(target);
            await wait(MOVE_MS);
            if (cancelled) return;
            setClicking(true);
            beat.run?.();
            await wait(CLICK_MS);
            if (cancelled) return;
            setClicking(false);
            await wait(beat.hold ?? HOLD_MS);
            continue;
          }

          const target = resolve(beat.at);
          if (!target) continue;
          setPoint(target);
          beat.run?.();
          await wait(MOVE_MS + (beat.hold ?? HOLD_MS));
        }
      } while (!cancelled && script.loop);
    };

    void play();

    return () => {
      cancelled = true;
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
  }, [script, active, reduced]);

  if (reduced || !point) return null;

  return (
    <motion.div
      className="tour-cursor"
      aria-hidden
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: pressed ? 0.86 : 1, x: point.x, y: point.y }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{
        x: { type: "spring", stiffness: 120, damping: 20, mass: 0.9 },
        y: { type: "spring", stiffness: 120, damping: 20, mass: 0.9 },
        opacity: { duration: 0.25 },
        scale: { duration: 0.18 },
      }}
    >
      <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
        <path
          d="M3 2.2 21.4 15.1l-7.6 1.1 4.2 8.8-3.6 1.7-4.2-8.8-4.6 4.9z"
          fill="#111111"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <AnimatePresence>
        {clicking && (
          <motion.span
            className="tour-cursor-ripple"
            initial={{ opacity: 0.75, scale: 0.3 }}
            animate={{ opacity: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
