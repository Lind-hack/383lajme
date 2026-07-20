"use client";

import { useEffect, useRef, useState } from "react";

// Shared client-side motion helpers for the tregu charts.
//
// Real price data is sparse — the VPS cron reprices general/new markets every
// 5 min and live sports (football, F1) every 2 min. To keep the chart feeling
// alive between those refreshes, we simulate a per-second "live" wander at the
// endpoint: a small mean-reverting random walk that always pulls back toward
// the true value, so the tail breathes every second without ever lying about
// where the market actually sits. Real trades still land instantly (the target
// jumps and the walk reconciles to it within a second).

const clamp01 = (p: number) => Math.max(0.01, Math.min(0.99, p));

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
 * Rolling per-second tail for a single-value chart (MarketChart). Returns the
 * last ~`window` simulated points, each 1s apart, wandering gently around
 * `target`. Empty (and paused) when disabled or motion-reduced.
 */
export function useLiveTail(
  target: number,
  enabled: boolean,
  window = 30
): { t: number; p: number }[] {
  const [tail, setTail] = useState<{ t: number; p: number }[]>([]);
  const pRef = useRef(target);
  useEffect(() => {
    if (!enabled) {
      setTail([]);
      return;
    }
    const id = setInterval(() => {
      // Pull 12% toward the real value, then add ≤0.6pp of noise: reconciles to
      // a fresh trade within a second while still shivering between refreshes.
      const drift = (target - pRef.current) * 0.12;
      const noise = (Math.random() - 0.5) * 0.012;
      pRef.current = clamp01(pRef.current + drift + noise);
      setTail((cur) => [...cur, { t: Date.now(), p: pRef.current }].slice(-window));
    }, 1000);
    return () => clearInterval(id);
  }, [target, enabled, window]);
  return tail;
}

/**
 * Per-second simulated vector for a multi-outcome chart (GroupChart). Walks
 * every outcome a touch, renormalizes so the displayed odds always sum to 100%,
 * and drifts back toward the real `targets`. Returns null when disabled so the
 * caller can fall back to the true endpoint.
 */
export function useLiveVector(targets: number[], enabled: boolean): number[] | null {
  const [vals, setVals] = useState<number[] | null>(null);
  const ref = useRef<number[]>(targets);
  const key = targets.join(",");
  useEffect(() => {
    if (!enabled || targets.length === 0) {
      setVals(null);
      return;
    }
    if (ref.current.length !== targets.length) ref.current = [...targets];
    const id = setInterval(() => {
      const next = ref.current.map((v, i) => {
        const drift = ((targets[i] ?? v) - v) * 0.12;
        const noise = (Math.random() - 0.5) * 0.01;
        return clamp01(v + drift + noise);
      });
      const sum = next.reduce((s, v) => s + v, 0) || 1;
      const norm = next.map((v) => v / sum);
      ref.current = norm;
      setVals(norm);
    }, 1000);
    return () => clearInterval(id);
    // key tracks value changes without making `targets` array identity a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return vals;
}
