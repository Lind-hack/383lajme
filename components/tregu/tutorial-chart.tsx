"use client";

// The tutorial's own probability chart. Self-contained on purpose: the real
// market page renders one of three different chart components depending on the
// market type, so no single set of tutorial copy could describe all of them.
// Here the tutorial owns the data, which also means the "zoom" can be a real
// camera move — the viewBox tweens — rather than a CSS scale of a bitmap.

import { useEffect, useMemo, useRef, useState } from "react";

export type RangeKey = "1o" | "1d" | "1j" | "all";

const RANGES: { key: RangeKey; label: string; take: number }[] = [
  { key: "1o", label: "1o", take: 10 },
  { key: "1d", label: "1d", take: 24 },
  { key: "1j", label: "1j", take: 44 },
  { key: "all", label: "Gjithë", take: Number.POSITIVE_INFINITY },
];

const W = 1000;
const H = 320;
const PAD_X = 12;
const PAD_Y = 26;
/** How much of the plot the camera frames when it pushes in. */
const ZOOM = 0.36;
const TWEEN_MS = 900;
/** Half the widest readout pill, so it never hangs off the plot. */
const LABEL_INSET = 30;

interface Props {
  /** Probabilities 0–1, oldest first. */
  points: number[];
  range: RangeKey;
  onRange: (range: RangeKey) => void;
  /** 0–1 across the visible slice; the camera pushes in here. null = full view. */
  focus: number | null;
  /** 0–1 across the visible slice; draws the readout marker. */
  marker: number | null;
  reduced: boolean;
}

type Box = [number, number, number, number];

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function TutorialChart({ points, range, onRange, focus, marker, reduced }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState<Box>([0, 0, W, H]);
  const boxRef = useRef<Box>([0, 0, W, H]);

  const slice = useMemo(() => {
    const take = RANGES.find((r) => r.key === range)?.take ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(take) || points.length <= take) return points;
    return points.slice(points.length - take);
  }, [points, range]);

  // Probability axis breathes with the slice — a flat 0–100% band would make
  // every move look like nothing happened.
  const [lo, hi] = useMemo(() => {
    if (slice.length === 0) return [0, 1];
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    const pad = Math.max(0.05, (max - min) * 0.35);
    return [Math.max(0, min - pad), Math.min(1, max + pad)];
  }, [slice]);

  const coords = useMemo(() => {
    const span = Math.max(1e-6, hi - lo);
    const n = Math.max(1, slice.length - 1);
    return slice.map((p, i) => ({
      x: PAD_X + ((W - PAD_X * 2) * i) / n,
      y: PAD_Y + (H - PAD_Y * 2) * (1 - (p - lo) / span),
      p,
    }));
  }, [slice, lo, hi]);

  const line = useMemo(
    () => coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" "),
    [coords]
  );
  const area = useMemo(() => {
    if (coords.length === 0) return "";
    return `${line} L${coords[coords.length - 1].x.toFixed(2)} ${H} L${coords[0].x.toFixed(2)} ${H} Z`;
  }, [line, coords]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const sync = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const target = useMemo<Box>(() => {
    if (focus === null || coords.length === 0) return [0, 0, W, H];
    const at = coords[Math.round(Math.min(1, Math.max(0, focus)) * (coords.length - 1))];
    const w = W * ZOOM;
    const h = H * ZOOM;
    return [
      Math.min(Math.max(0, at.x - w / 2), W - w),
      Math.min(Math.max(0, at.y - h / 2), H - h),
      w,
      h,
    ];
  }, [focus, coords]);

  // Tween the camera. Instant under reduced motion.
  useEffect(() => {
    if (reduced) {
      boxRef.current = target;
      setBox(target);
      return;
    }
    const from = boxRef.current;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / TWEEN_MS);
      const k = ease(t);
      const next: Box = [
        from[0] + (target[0] - from[0]) * k,
        from[1] + (target[1] - from[1]) * k,
        from[2] + (target[2] - from[2]) * k,
        from[3] + (target[3] - from[3]) * k,
      ];
      boxRef.current = next;
      setBox(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);

  // The readout rides in HTML rather than SVG so the camera never scales the
  // type. Map the SVG point through the live viewBox.
  const readout = useMemo(() => {
    if (marker === null || coords.length === 0 || size.w === 0) return null;
    const at = coords[Math.round(Math.min(1, Math.max(0, marker)) * (coords.length - 1))];
    const left = ((at.x - box[0]) / box[2]) * size.w;
    return {
      left,
      // The crosshair stays on the point; the pill slides back inside so it is
      // not half-clipped by .tut-chart's overflow at either end of the line.
      labelLeft: Math.min(Math.max(left, LABEL_INSET), Math.max(LABEL_INSET, size.w - LABEL_INSET)),
      top: ((at.y - box[1]) / box[3]) * size.h,
      pct: at.p * 100,
    };
  }, [marker, coords, box, size]);

  const last = coords[coords.length - 1];
  const first = coords[0];
  const delta = last && first ? (last.p - first.p) * 100 : 0;

  return (
    <div className="tut-chart">
      <div className="tut-chart-head">
        <div className="tut-chart-now">
          <span>Gjasa për PO</span>
          <strong>{last ? (last.p * 100).toFixed(1) : "—"}%</strong>
          <em data-dir={delta >= 0 ? "up" : "down"}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pikë
          </em>
        </div>
        <div className="tut-chart-ranges" role="group" aria-label="Periudha">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              data-tut-range={r.key}
              data-on={range === r.key ? "" : undefined}
              onClick={() => onRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tut-chart-plot" ref={wrapRef} data-tut="chart-plot">
        <svg
          viewBox={box.join(" ")}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Grafiku i gjasave, tani ${last ? (last.p * 100).toFixed(1) : "—"} për qind`}
        >
          <defs>
            <linearGradient id="tut-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4422" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#ff4422" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={g}
              x1={0}
              x2={W}
              y1={PAD_Y + (H - PAD_Y * 2) * g}
              y2={PAD_Y + (H - PAD_Y * 2) * g}
              stroke="rgba(17,17,17,0.07)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill="url(#tut-chart-fill)" />
          <path
            d={line}
            fill="none"
            stroke="#ff4422"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {last && (
            <circle cx={last.x} cy={last.y} r={4} fill="#ff4422" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {readout && (
          <>
            <span className="tut-chart-crosshair" style={{ left: readout.left }} />
            <span
              className="tut-chart-readout"
              style={{ left: readout.labelLeft, top: readout.top }}
              aria-hidden
            >
              {readout.pct.toFixed(1)}%
            </span>
          </>
        )}
      </div>
    </div>
  );
}
