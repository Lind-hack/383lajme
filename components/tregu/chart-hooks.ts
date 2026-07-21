"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

/** Persisted vertical-fit band, tagged with the view it was frozen for. */
export type FitBand = { key: string; lo: number; hi: number } | null;

/**
 * Freezes the plot's vertical fit range for the lifetime of a view.
 *
 * The charts recompute a target [lo, hi] every frame from the visible window.
 * Applying it live makes the whole curve — frozen history included — breathe
 * vertically as the window scrolls and the live value reprices, which reads as
 * "the drawn lines keep moving". Easing that moving target only chases it; it
 * never settles. Instead we compute the band ONCE per view and hold it EXACTLY:
 *
 *  - **Seed & hold:** on first render, on a timeframe switch, or when the
 *    underlying data refreshes (all captured by `key`), snap the band to the
 *    target and keep it. While `key` is unchanged the band never moves, so every
 *    already-drawn point keeps its exact y — history is truly static.
 *  - **Grow-only, eased:** the one case the band may change mid-view is when the
 *    live value pushes a new high/low past the frozen band. Then the edge eases
 *    outward to bring it in — the single legitimate "a new percentage came into
 *    view" transition — and only ever grows, never shrinks, so calmer stretches
 *    can't re-tighten and jitter the curve.
 *
 * Not a hook — takes a caller-owned ref so it can run after an early return.
 * Reduced motion snaps straight to the (re)seeded target.
 */
export function frozenFitRange(
  ref: { current: FitBand },
  key: string,
  targetLo: number,
  targetHi: number,
  reduced: boolean,
): [number, number] {
  const cur = ref.current;
  if (!cur || cur.key !== key || reduced) {
    ref.current = { key, lo: targetLo, hi: targetHi };
    return [targetLo, targetHi];
  }
  const wantLo = Math.min(cur.lo, targetLo);
  const wantHi = Math.max(cur.hi, targetHi);
  if (wantLo < cur.lo - 1e-4 || wantHi > cur.hi + 1e-4) {
    // Grow INSTANTLY — one step, then still. Easing the expansion means the
    // whole drawn history glides for ~half a second, which is exactly the
    // "already-drawn lines are moving" violation. A new extreme is rare; a
    // single-frame step is the minimum motion that can fit it on screen.
    ref.current = { key, lo: wantLo, hi: wantHi };
    return [wantLo, wantHi];
  }
  return [cur.lo, cur.hi];
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

// How much per-second history the live tape seeds on mount, and its hard cap.
// SEED covers the widest "detail" timeframe at full per-second fidelity; older
// than the tape, the deterministic sampler fills in (invisible at that zoom).
const TAPE_SEED_S = 2700; // 45 min of per-second points
const TAPE_CAP_S = 3600; // 60 min ceiling

/**
 * The single source of truth for a live single-value chart. Seeds a persistent
 * per-second tape from the deterministic `sampler` (so it's continuous with the
 * older history the sampler also draws), then appends one eased point per second
 * with the newest value gliding toward `target` every frame. Returns a frame
 * clock (`now`, drives re-render) and the tape by ref (read during render). The
 * tape is append-only and capped — history never rewrites itself, which is what
 * removes the historical→live discontinuity of the old two-zone model.
 *
 * `dataKey` reseeds the tape when the underlying market/data changes; `enabled`
 * is false under reduced motion (the seeded tape still renders, just frozen).
 */
export function useLiveTape(
  sampler: (t: number) => number,
  dataKey: string,
  target: number,
  enabled: boolean
): { now: number; tape: { t: number; p: number }[]; live: number } {
  const [now, setNow] = useState(() => Date.now());
  const tapeRef = useRef<{ t: number; p: number }[]>([]);
  const curRef = useRef(target);
  const goalRef = useRef(target);
  const lastStepRef = useRef(0);
  const targetRef = useRef(target);
  targetRef.current = target;
  const samplerRef = useRef(sampler);
  samplerRef.current = sampler;

  // Seed the tape from the deterministic sampler so its left edge joins the
  // older history seamlessly; the final point is the true current value.
  useEffect(() => {
    const t0 = Date.now();
    const seed: { t: number; p: number }[] = [];
    for (let s = TAPE_SEED_S; s >= 0; s--) {
      const t = t0 - s * 1000;
      seed.push({ t, p: s === 0 ? targetRef.current : samplerRef.current(t) });
    }
    tapeRef.current = seed;
    curRef.current = targetRef.current;
    goalRef.current = targetRef.current;
    lastStepRef.current = t0;
    setNow(t0);
  }, [dataKey]);

  useEffect(() => {
    if (!enabled) {
      setNow(Date.now());
      return;
    }
    const id = setInterval(() => {
      const t = Date.now();
      curRef.current += (goalRef.current - curRef.current) * EASE;
      if (t - lastStepRef.current >= 1000) {
        lastStepRef.current = t;
        const drift = (targetRef.current - goalRef.current) * 0.5;
        const noise = (Math.random() - 0.5) * 0.02;
        goalRef.current = clamp01(goalRef.current + drift + noise);
        const tape = tapeRef.current;
        tape.push({ t, p: curRef.current });
        if (tape.length > TAPE_CAP_S) tape.splice(0, tape.length - TAPE_CAP_S);
      }
      setNow(t);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [enabled]);

  // `live` is the eased leading value (updated every frame). The render uses it
  // only for the sub-second tip beyond the last committed second, so the tip
  // glides smoothly while every committed point behind it stays frozen.
  return { now, tape: tapeRef.current, live: curRef.current };
}

/**
 * Multi-outcome twin of `useLiveTape`. Seeds one per-second tape per outcome
 * from each outcome's deterministic sampler, appends eased+renormalized vectors
 * so displayed odds always sum to ~100%, and drifts back toward the real
 * `targets`. Returns a frame clock and the tapes by ref (parallel to `samplers`).
 */
export function useLiveTapeVector(
  samplers: ((t: number) => number)[],
  dataKey: string,
  targets: number[],
  enabled: boolean
): { now: number; tapes: { t: number; p: number }[][]; lives: number[] } {
  const [now, setNow] = useState(() => Date.now());
  const tapesRef = useRef<{ t: number; p: number }[][]>([]);
  const curRef = useRef<number[]>(targets);
  const goalRef = useRef<number[]>(targets);
  const lastStepRef = useRef(0);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const samplersRef = useRef(samplers);
  samplersRef.current = samplers;

  useEffect(() => {
    const t0 = Date.now();
    const n = samplersRef.current.length;
    const tapes: { t: number; p: number }[][] = Array.from({ length: n }, () => []);
    for (let s = TAPE_SEED_S; s >= 0; s--) {
      const t = t0 - s * 1000;
      // Sample every outcome at t, then normalize so the stack sums to 1.
      const raw =
        s === 0
          ? targetsRef.current.slice()
          : samplersRef.current.map((fn) => fn(t));
      const sum = raw.reduce((a, b) => a + b, 0) || 1;
      raw.forEach((v, i) => tapes[i].push({ t, p: v / sum }));
    }
    tapesRef.current = tapes;
    curRef.current = [...targetsRef.current];
    goalRef.current = [...targetsRef.current];
    lastStepRef.current = t0;
    setNow(t0);
  }, [dataKey]);

  useEffect(() => {
    if (!enabled) {
      setNow(Date.now());
      return;
    }
    const id = setInterval(() => {
      const t = Date.now();
      curRef.current = curRef.current.map(
        (v, i) => v + ((goalRef.current[i] ?? v) - v) * EASE
      );
      if (t - lastStepRef.current >= 1000) {
        lastStepRef.current = t;
        const tg = targetsRef.current;
        const next = goalRef.current.map((v, i) =>
          clamp01(v + ((tg[i] ?? v) - v) * 0.5 + (Math.random() - 0.5) * 0.016)
        );
        const sum = next.reduce((s, v) => s + v, 0) || 1;
        goalRef.current = next.map((v) => v / sum);
        const csum = curRef.current.reduce((a, b) => a + b, 0) || 1;
        const tapes = tapesRef.current;
        curRef.current.forEach((v, i) => {
          tapes[i]?.push({ t, p: v / csum });
          if (tapes[i] && tapes[i].length > TAPE_CAP_S) tapes[i].splice(0, tapes[i].length - TAPE_CAP_S);
        });
      }
      setNow(t);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [enabled]);

  // Column-normalized leading values (sum ~1), used only for the live tip so
  // the right edge glides while every committed column behind it stays frozen.
  const lsum = curRef.current.reduce((a, b) => a + b, 0) || 1;
  const lives = curRef.current.map((v) => v / lsum);
  return { now, tapes: tapesRef.current, lives };
}

/**
 * Drag/swipe-to-pan for a scrolling time window. `panMs` is how far back from
 * the live edge the window's right edge sits (0 = live). Handles mouse drag and
 * touch (horizontal), clamps to [0, maxPanMs], damps past the boundary, and
 * carries flick momentum with an eased decay. `plotRef` supplies the pixel width
 * for px→ms conversion. Returns the current pan and pointer handlers plus a
 * `dragging` flag so the chart can suppress the hover crosshair mid-drag.
 */
export function useChartPan(
  plotRef: React.RefObject<HTMLDivElement | null>,
  maxPanMs: number,
  windowMs: number,
  enabled: boolean
): {
  panMs: number;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => boolean; // true = consumed as pan
  onPointerUp: (e: React.PointerEvent) => void;
  resetPan: () => void;
} {
  const [panMs, setPanMs] = useState(0);
  const [dragging, setDragging] = useState(false);
  const panRef = useRef(0);
  panRef.current = panMs;
  const maxRef = useRef(maxPanMs);
  maxRef.current = maxPanMs;
  const winRef = useRef(windowMs);
  winRef.current = windowMs;
  const drag = useRef<{
    id: number;
    startX: number;
    startPan: number;
    moved: boolean;
    lastX: number;
    lastT: number;
    vel: number; // ms-of-window per ms-of-time
  } | null>(null);
  const raf = useRef(0);

  // Keep pan inside bounds when the timeframe (and thus maxPan) changes.
  useEffect(() => {
    setPanMs((p) => Math.max(0, Math.min(p, maxPanMs)));
  }, [maxPanMs]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const widthPx = () => plotRef.current?.getBoundingClientRect().width || 1;
  const msPerPx = () => winRef.current / widthPx();
  const clampPan = (v: number) => Math.max(0, Math.min(v, maxRef.current));

  const resetPan = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPanMs(0);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || maxRef.current <= 0) return;
      cancelAnimationFrame(raf.current);
      drag.current = {
        id: e.pointerId,
        startX: e.clientX,
        startPan: panRef.current,
        moved: false,
        lastX: e.clientX,
        lastT: performance.now(),
        vel: 0,
      };
    },
    [enabled]
  );

  const onPointerMove = useCallback((e: React.PointerEvent): boolean => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return false;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 4) return false;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(d.id);
      } catch {
        /* capture is best-effort */
      }
    }
    // Drag right → reveal older data → larger panMs.
    let next = d.startPan + dx * msPerPx();
    // Damp past the edges instead of a hard stop.
    if (next < 0) next *= 0.35;
    else if (next > maxRef.current) next = maxRef.current + (next - maxRef.current) * 0.35;
    const tNow = performance.now();
    const dt = Math.max(1, tNow - d.lastT);
    d.vel = ((e.clientX - d.lastX) * msPerPx()) / dt;
    d.lastX = e.clientX;
    d.lastT = tNow;
    setPanMs(next);
    return true;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(d.id);
    } catch {
      /* noop */
    }
    if (!d.moved) {
      setDragging(false);
      return;
    }
    // Snap any over-drag back inside bounds, then coast on flick momentum.
    let v = d.vel; // window-ms per real-ms
    const step = () => {
      const p = panRef.current;
      const clamped = clampPan(p);
      if (clamped !== p) {
        // Outside bounds → spring back.
        const nv = p + (clamped - p) * 0.2;
        setPanMs(Math.abs(nv - clamped) < 60 ? clamped : nv);
        if (Math.abs(nv - clamped) < 60) {
          setDragging(false);
          return;
        }
        raf.current = requestAnimationFrame(step);
        return;
      }
      v *= 0.92; // decay
      const nv = clampPan(p + v * 16);
      setPanMs(nv);
      if (Math.abs(v) < 0.02 || nv === 0 || nv === maxRef.current) {
        setDragging(false);
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    if (Math.abs(v) > 0.05 || clampPan(panRef.current) !== panRef.current) {
      raf.current = requestAnimationFrame(step);
    } else {
      setDragging(false);
    }
  }, []);

  return { panMs, dragging, onPointerDown, onPointerMove, onPointerUp, resetPan };
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
