"use client";

import { useEffect, useRef, useState } from "react";

// Shared client-side motion helpers for the tregu charts.
//
// Real price data is sparse — the VPS cron reprices general/news markets every
// 5 min and live sports (football, F1) every 2 min. To keep the chart feeling
// alive between those refreshes we draw a per-second "live" tail at the right
// edge: a mean-reverting walk that always pulls back toward the true value, so
// the tail breathes every second without ever lying about where the market
// sits. The walk is *eased* frame-by-frame (rAF-style interval) toward a goal
// that only re-rolls once a second, so the leading edge glides smoothly instead
// of stepping — a flowing line, not a stair. Real trades still land instantly
// (the target jumps and the walk reconciles within a second).

const clamp01 = (p: number) => Math.max(0.01, Math.min(0.99, p));

// ~30fps eased sampling. Frequent enough to read as continuous flow, half the
// render cost of a full 60fps rAF loop on a single chart.
const FRAME_MS = 33;
const EASE = 0.16; // fraction of remaining gap closed each frame

/** True when the viewer asked the OS to reduce motion — kills every sim. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Flips false→true once, `durationMs` after mount — used to gate the endpoint
 * dot and news markers so they only appear after the left-to-right reveal wipe
 * has swept past them (the SVG line is clipped, HTML overlays are not, so they
 * must wait). Instant when motion is reduced.
 */
export function useDrawReveal(durationMs: number, reduced: boolean): boolean {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return;
    }
    setDrawn(false);
    const id = setTimeout(() => setDrawn(true), durationMs);
    return () => clearTimeout(id);
  }, [durationMs, reduced]);
  return drawn;
}

/**
 * Live wall clock + countdown to the next scheduled refresh. `cadenceMs` is the
 * repricing interval for this market (120 000 live sports · 300 000 general).
 * `nextInMs` counts down to the next cadence boundary aligned to the wall clock,
 * so the "Rifreskim në m:ss" pill ticks toward a real 2-/5-minute refresh.
 */
export function useLiveClock(cadenceMs: number): { now: number; nextInMs: number } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const nextInMs = Math.max(0, cadenceMs - (now % cadenceMs));
  return { now, nextInMs };
}

/**
 * Rolling per-second tail for a single-value chart (MarketChart). Returns the
 * last ~`window` points (oldest→newest); the final entry is the live, eased
 * leading edge. Points are mapped into the chart's live band by index, not by
 * timestamp, so the flow stays visible on any time range. Empty (and paused)
 * when disabled or motion-reduced.
 */
export function useLiveTail(
  target: number,
  enabled: boolean,
  window = 22
): { t: number; p: number }[] {
  const [tail, setTail] = useState<{ t: number; p: number }[]>([]);
  const targetRef = useRef(target);
  targetRef.current = target;
  const curRef = useRef(target);
  const goalRef = useRef(target);
  const histRef = useRef<number[]>([]);
  const lastStepRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setTail([]);
      return;
    }
    curRef.current = targetRef.current;
    goalRef.current = targetRef.current;
    histRef.current = Array.from({ length: window }, () => targetRef.current);
    lastStepRef.current = Date.now();

    const id = setInterval(() => {
      const now = Date.now();
      // Ease the visible value toward the current goal every frame → glide.
      curRef.current += (goalRef.current - curRef.current) * EASE;
      // Re-roll the goal once a second: pull halfway to the real value, add a
      // touch of noise so the tail keeps moving between real refreshes.
      if (now - lastStepRef.current >= 1000) {
        lastStepRef.current = now;
        const drift = (targetRef.current - goalRef.current) * 0.5;
        const noise = (Math.random() - 0.5) * 0.02;
        goalRef.current = clamp01(goalRef.current + drift + noise);
        histRef.current = [...histRef.current, curRef.current].slice(-window);
      }
      const buf = [...histRef.current.slice(0, -1), curRef.current];
      // Timestamps are decorative here (the band maps by index); newest = now.
      setTail(buf.map((p, i) => ({ t: now - (buf.length - 1 - i) * 1000, p })));
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [enabled, window]);

  return tail;
}

/**
 * Per-second simulated vector buffer for a multi-outcome chart (GroupChart).
 * Returns the last ~`window` normalized vectors (oldest→newest), each summing
 * to ~100%, eased frame-by-frame and drifting back toward the real `targets`.
 * Null when disabled so the caller can fall back to the true endpoint.
 */
export function useLiveVector(
  targets: number[],
  enabled: boolean,
  window = 22
): number[][] | null {
  const [buf, setBuf] = useState<number[][] | null>(null);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const curRef = useRef<number[]>(targets);
  const goalRef = useRef<number[]>(targets);
  const histRef = useRef<number[][]>([]);
  const lastStepRef = useRef(0);
  const key = targets.join(",");

  useEffect(() => {
    if (!enabled || targets.length === 0) {
      setBuf(null);
      return;
    }
    curRef.current = [...targetsRef.current];
    goalRef.current = [...targetsRef.current];
    histRef.current = Array.from({ length: window }, () => [...targetsRef.current]);
    lastStepRef.current = Date.now();

    const id = setInterval(() => {
      const now = Date.now();
      curRef.current = curRef.current.map(
        (v, i) => v + ((goalRef.current[i] ?? v) - v) * EASE
      );
      if (now - lastStepRef.current >= 1000) {
        lastStepRef.current = now;
        const t = targetsRef.current;
        const next = goalRef.current.map((v, i) =>
          clamp01(v + ((t[i] ?? v) - v) * 0.5 + (Math.random() - 0.5) * 0.016)
        );
        const sum = next.reduce((s, v) => s + v, 0) || 1;
        goalRef.current = next.map((v) => v / sum);
        histRef.current = [...histRef.current, curRef.current.slice()].slice(-window);
      }
      const norm = (row: number[]) => {
        const s = row.reduce((a, b) => a + b, 0) || 1;
        return row.map((v) => v / s);
      };
      const out = [...histRef.current.slice(0, -1).map(norm), norm(curRef.current)];
      setBuf(out);
    }, FRAME_MS);
    return () => clearInterval(id);
    // key tracks value changes without making `targets` array identity a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, window]);

  return buf;
}
