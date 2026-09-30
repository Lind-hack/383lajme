"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  angularRecordedPath,
  smoothRecordedPath,
  rangeWithMovement,
  RECORDED_RANGE_OPTIONS,
  formatProbabilityTick,
  probabilityDomain,
  recordedRangeDisplaySeries,
  selectRecordedRange,
  type RecordedRangeKey,
} from "@/lib/tregu-probability-domain.mjs";
import { TREGU_CHART_UI_VERSION } from "@/lib/tregu-ui-contract";
import { formatKosovoDateTime, formatKosovoTime } from "@/lib/tregu-local-time.mjs";
import { livelyPoints, seedOf, wiggleAmplitude } from "@/lib/tregu-chart-motion.mjs";

/** A news story that moved this market, pinned to the line at its moment. */
export type ChartNewsMark = { t: number; title: string; href: string; source?: string };

export type ExactMarketSeries = {
  key: string;
  label: string;
  color: string;
  points: { t: number; p: number }[];
  hold?: { t: number; p: number };
  current: number;
};

const W = 640;
const PAD_L = 8;
const PAD_R = 44;
const PAD_Y = 12;
/** How long a new trade takes to climb or drop into its price on screen. */
const MOVE_MS = 1_100;

function percent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function timeLabel(timestamp: number | null, compact = false) {
  if (timestamp == null || !Number.isFinite(timestamp)) return "Pa pikë të regjistruar";
  return compact ? formatKosovoTime(timestamp) : formatKosovoDateTime(timestamp);
}

export default function ExactMarketChart({
  series,
  height = 154,
  compact = false,
  ariaLabel = "Historia e regjistruar e gjasave",
  showRanges = false,
  showPulse = false,
  minimal = false,
  concise = false,
  derived = false,
  tone = "serious",
  defaultRange = "1d",
  curve = "step",
  fill = false,
  emphasisKey = null,
  marks = [],
  news = [],
}: {
  series: ExactMarketSeries[];
  height?: number;
  compact?: boolean;
  ariaLabel?: string;
  showRanges?: boolean;
  showPulse?: boolean;
  minimal?: boolean;
  concise?: boolean;
  derived?: boolean;
  tone?: "serious" | "sport" | "neutral";
  defaultRange?: RecordedRangeKey;
  /** Line style between samples. Every recorded move is drawn as a short climb
   *  or drop into the new price (lib/tregu-chart-motion.mjs) whichever is set;
   *  "smooth" additionally rounds the joins. */
  curve?: "angular" | "smooth" | "step";
  /** The outcome the reader holds: drawn on top and heavier, the rest recede. */
  emphasisKey?: string | null;
  /** Points to ring on a line, e.g. the reader's own buy. */
  marks?: { key: string; t: number }[];
  /** Stories that moved the price, drawn as numbered pins on the line. */
  news?: ChartNewsMark[];
  /** Let the plot grow into its container. `height` stays the minimum, and the
   *  drawing follows the plot's real height so a deeper plot is redrawn, not
   *  stretched — points stay round and the area fill keeps its baseline. */
  fill?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  // Open on a window that actually shows a move: a book that last traded three
  // days ago opened on "1d" as flat lines with nothing to read.
  const [range, setRange] = useState<RecordedRangeKey>(() =>
    showRanges ? rangeWithMovement(series, defaultRange, Date.now()) : defaultRange
  );
  const drawsLive = showRanges && (range === "1s" || range === "1m" || range === "5m");
  const [visibleEnd, setVisibleEnd] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [filledHeight, setFilledHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!fill || !el) return;
    const measure = () => setFilledHeight(Math.round(el.clientHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fill]);

  const drawHeight = fill && filledHeight != null && filledHeight > height ? filledHeight : height;

  // The line breathes only when someone can see it: motion allowed, on screen,
  // tab visible. Otherwise a chart ticks once a minute like before.
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const onVisibility = () => setPageVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true), { rootMargin: "120px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const lively = !reduced;
  const breathing = lively && inView && pageVisible;

  useEffect(() => {
    const cadence = drawsLive || breathing ? 1_000 : 60_000;
    const updateVisibleEnd = () => setVisibleEnd(Date.now());
    updateVisibleEnd();
    const timer = window.setInterval(updateVisibleEnd, cadence);
    return () => window.clearInterval(timer);
  }, [drawsLive, breathing]);

  const selected = useMemo(
    () => selectRecordedRange(series, showRanges ? range : "Gjithë", visibleEnd),
    [range, series, showRanges, visibleEnd]
  );

  const model = useMemo(() => {
    const cleaned = recordedRangeDisplaySeries(selected.series, selected.start, selected.end);
    const recordedTimestamps = cleaned.flatMap((item) => item.points.map((point) => point.t));
    const timestamps = [...new Set(cleaned.flatMap((item) => item.displayPoints.map((point) => point.t)))].sort((a, b) => a - b);
    const latestT = recordedTimestamps.length ? Math.max(...recordedTimestamps) : selected.end;
    const earliestT = recordedTimestamps.length ? Math.min(...recordedTimestamps) : selected.start ?? selected.end;
    const values = cleaned.flatMap((item) => [
      ...item.displayPoints.map((point) => point.p),
    ]);
    const domain = probabilityDomain(values.length ? values : cleaned.map((item) => item.current));
    const plotH = drawHeight - PAD_Y * 2;
    const plotW = W - PAD_L - (compact ? PAD_L : PAD_R);
    const firstT = timestamps[0] ?? 0;
    const lastT = timestamps.at(-1) ?? firstT;
    const x = (t: number) => {
      if (timestamps.length <= 1) return PAD_L + plotW / 2;
      return PAD_L + ((t - firstT) / Math.max(1, lastT - firstT)) * plotW;
    };
    const y = (p: number) => PAD_Y + ((domain.hi - p) / Math.max(0.000001, domain.hi - domain.lo)) * plotH;
    return {
      cleaned,
      timestamps,
      recordedTimestamps: [...new Set(recordedTimestamps)].sort((a, b) => a - b),
      latestT,
      earliestT,
      plotW,
      domain,
      hasTimeline: cleaned.some((item) => item.displayPoints.length >= 2),
      hasDisplayData: cleaned.some((item) => item.displayPoints.length >= 1),
      x,
      y,
    };
  }, [compact, drawHeight, selected]);

  // A new recorded move eases in from the price the reader was looking at, so
  // a buy is seen pushing the line up or down rather than teleporting it.
  const lastSeen = useRef(new Map<string, { t: number; p: number }>());
  const [moving, setMoving] = useState<Record<string, { from: number; startedAt: number }>>({});
  const [frameNow, setFrameNow] = useState(0);
  useEffect(() => {
    const started: Record<string, { from: number; startedAt: number }> = {};
    for (const item of model.cleaned) {
      const latest = item.points.at(-1);
      if (!latest) continue;
      const before = lastSeen.current.get(item.key);
      if (lively && before && latest.t > before.t && Math.abs(latest.p - before.p) >= 0.0005) {
        started[item.key] = { from: before.p, startedAt: performance.now() };
      }
      lastSeen.current.set(item.key, { t: latest.t, p: latest.p });
    }
    if (Object.keys(started).length) setMoving((current) => ({ ...current, ...started }));
  }, [model.cleaned, lively]);

  useEffect(() => {
    if (!Object.keys(moving).length) return;
    let raf = 0;
    const frame = () => {
      const now = performance.now();
      setFrameNow(now);
      const pending = Object.values(moving).some((move) => now - move.startedAt < MOVE_MS);
      if (pending) raf = requestAnimationFrame(frame);
      else setMoving({});
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [moving]);

  const drawn = useMemo(() => {
    const amplitude = lively ? wiggleAmplitude(model.domain.hi - model.domain.lo) : 0;
    return new Map(model.cleaned.map((item) => {
      const move = moving[item.key];
      const progress = move ? Math.min(1, Math.max(0, (frameNow - move.startedAt) / MOVE_MS)) : 1;
      return [item.key, livelyPoints(item.displayPoints, {
        seed: seedOf(item.key),
        start: selected.start,
        end: selected.end,
        amplitude,
        now: breathing && visibleEnd != null ? visibleEnd : undefined,
        animate: move && progress < 1 ? { from: move.from, progress } : null,
      })];
    }));
  }, [breathing, frameNow, lively, model, moving, selected.end, selected.start, visibleEnd]);

  const summaries = model.cleaned.map((item) => {
    const displayPoints = item.points.length ? item.points : item.hold ? [item.hold] : [];
    const latest = displayPoints.at(-1)?.p ?? item.current;
    const first = displayPoints[0]?.p ?? latest;
    const low = displayPoints.length ? Math.min(...displayPoints.map((point) => point.p)) : latest;
    const high = displayPoints.length ? Math.max(...displayPoints.map((point) => point.p)) : latest;
    return {
      key: item.key,
      label: item.label,
      color: item.color,
      current: latest,
      low,
      high,
      start: first,
      change: latest - first,
    };
  });
  const summary = summaries.map((item) => `${item.label} ${percent(item.current)}`).join(", ");
  const leader = [...summaries].sort((a, b) => b.current - a.current)[0];
  const biggestMove = [...summaries].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
  const single = summaries.length === 1 ? summaries[0] : null;
  // Polymarket-style headline: one big live number and how far it has come in
  // the window. Only for single-line news markets; sport keeps its own header.
  const hero = single && tone === "serious" && !compact && !minimal
    ? {
        current: single.current,
        points: Math.abs(Math.round(single.change * 1000) / 10).toLocaleString("sq-AL"),
        direction: Math.abs(single.change) < 0.0005 ? "flat" : single.change > 0 ? "up" : "down",
      }
    : null;
  // News pins sit on the drawn line of the first series at their moment.
  const pins = (() => {
    if (minimal || compact || news.length === 0 || model.timestamps.length < 2) return [];
    const firstT = model.timestamps[0];
    const lastT = model.timestamps.at(-1) ?? firstT;
    const line = model.cleaned[0] ? drawn.get(model.cleaned[0].key) ?? [] : [];
    if (!line.length) return [];
    return news
      .filter((item) => Number.isFinite(item.t) && item.t >= firstT && item.t <= lastT)
      .slice(-6)
      .map((item, index) => {
        const near = line.reduce((best, point) => (Math.abs(point.t - item.t) < Math.abs(best.t - item.t) ? point : best), line[0]);
        return { ...item, n: index + 1, x: model.x(item.t), y: model.y(near.p) };
      });
  })();
  const scaleLabel = `${formatProbabilityTick(model.domain.lo, model.domain.tickStep)}-${formatProbabilityTick(model.domain.hi, model.domain.tickStep)}`;
  const updateCount = model.recordedTimestamps.length;
  const [inspectionT, setInspectionT] = useState<number | null>(null);
  const activeTouchPointer = useRef<number | null>(null);
  const inspection = useMemo(() => {
    if (inspectionT == null || model.timestamps.length === 0) return null;
    const timestamp = model.timestamps.reduce((nearest, candidate) =>
      Math.abs(candidate - inspectionT) < Math.abs(nearest - inspectionT) ? candidate : nearest
    );
    const entries = model.cleaned.flatMap((item) => {
      const displayPoints = item.displayPoints;
      if (displayPoints.length === 0) return [];
      const point = displayPoints.reduce((nearest, candidate) =>
        Math.abs(candidate.t - timestamp) < Math.abs(nearest.t - timestamp) ? candidate : nearest
      );
      return [{ ...item, point }];
    });
    return { timestamp, x: model.x(timestamp), entries };
  }, [inspectionT, model]);

  const inspectFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (model.timestamps.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const plotRight = compact ? W - PAD_L : W - PAD_R;
    const svgX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * W;
    const clampedX = Math.max(PAD_L, Math.min(plotRight, svgX));
    const timestamp = model.timestamps.reduce((nearest, candidate) =>
      Math.abs(model.x(candidate) - clampedX) < Math.abs(model.x(nearest) - clampedX)
        ? candidate
        : nearest
    );
    setInspectionT(timestamp);
  };

  const finishTouchInspection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeTouchPointer.current !== event.pointerId) return;
    activeTouchPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const moveInspection = (direction: -1 | 1) => {
    if (model.timestamps.length === 0) return;
    const current = inspection?.timestamp ?? model.timestamps.at(-1) ?? 0;
    const index = Math.max(0, model.timestamps.findIndex((timestamp) => timestamp >= current));
    const next = model.timestamps[Math.max(0, Math.min(model.timestamps.length - 1, index + direction))];
    setInspectionT(next);
  };

  return (
    <div
      ref={rootRef}
      className="tregu-exact-chart"
      data-compact={compact || undefined}
      data-minimal={minimal || undefined}
      data-inspecting={inspection ? true : undefined}
      data-tone={tone}
      data-range={showRanges ? range : undefined}
      data-live-drawing={drawsLive || undefined}
      data-curve={curve}
      data-tregu-chart-version={TREGU_CHART_UI_VERSION}
    >
      {hero && (
        <div className="tregu-exact-chart-hero" aria-live="polite">
          <strong>
            {Math.round(hero.current * 100)}
            <small>%</small>
          </strong>
          <span>gjasa</span>
          <em data-direction={hero.direction}>
            <i aria-hidden>{hero.direction === "up" ? "▲" : hero.direction === "down" ? "▼" : "•"}</i>
            {hero.direction === "flat" ? "Pa ndryshim" : `${hero.points} pikë`}
            <small>{showRanges ? selected.option.description.toLowerCase() : "që nga fillimi"}</small>
          </em>
        </div>
      )}

      {!minimal && (
        <div className="tregu-exact-chart-head">
          <span>
            <span className="tregu-live-dot" aria-hidden />
            {derived ? "Nga pika të regjistruara" : "Të dhëna të regjistruara"}
          </span>
          {!concise && (
            <time dateTime={model.latestT != null ? new Date(model.latestT).toISOString() : undefined}>
              {model.earliestT == null
                ? timeLabel(null)
                : model.earliestT === model.latestT
                  ? timeLabel(model.latestT, compact)
                  : `${timeLabel(model.earliestT, compact)} - ${timeLabel(model.latestT, compact)}`}
            </time>
          )}
        </div>
      )}

      {showRanges && (
        <div className="tregu-exact-chart-ranges tregu-sort tregu-sort--scroll" role="group" aria-label="Periudha e grafikut">
          {RECORDED_RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={range === option.key}
              aria-label={`Shfaq ${option.description.toLowerCase()}`}
              title={option.description}
              onClick={() => {
                setRange(option.key);
                setInspectionT(null);
              }}
            >
              {option.key}
            </button>
          ))}
        </div>
      )}

      {!minimal && !concise && (
        <div className="tregu-exact-chart-scale">
          <span>{selected.option.description}</span>
          <strong>{model.domain.zoomed ? "Pamje e zmadhuar" : "Shkallë e plotë"}</strong>
          <span>Shkallë {scaleLabel}</span>
        </div>
      )}

      <div
        ref={plotRef}
        className="tregu-exact-chart-plot"
        style={{ height }}
        role="group"
        tabIndex={model.timestamps.length ? 0 : -1}
        aria-label="Inspekto grafikun. Përdor shigjetat majtas dhe djathtas për pikat e regjistruara."
        onFocus={() => setInspectionT((current) => current ?? model.timestamps.at(-1) ?? null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            moveInspection(event.key === "ArrowLeft" ? -1 : 1);
          }
          if (event.key === "Escape") setInspectionT(null);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" || activeTouchPointer.current === event.pointerId) {
            inspectFromPointer(event);
          }
        }}
        onPointerDown={(event) => {
          inspectFromPointer(event);
          if (event.pointerType !== "mouse") {
            activeTouchPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerUp={finishTouchInspection}
        onPointerCancel={finishTouchInspection}
        onLostPointerCapture={(event) => {
          if (activeTouchPointer.current === event.pointerId) activeTouchPointer.current = null;
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setInspectionT(null);
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${drawHeight}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${ariaLabel}: ${summary || "pa të dhëna"}. Shkallë ${scaleLabel}. ${selected.option.description}.`}
        >
          <title>{`${ariaLabel}: ${summary || "pa të dhëna"}. Shkallë ${scaleLabel}. ${selected.option.description}.`}</title>
          {model.domain.ticks.map((tick) => (
            <line
              key={tick}
              x1={PAD_L}
              x2={compact ? W - PAD_L : W - PAD_R}
              y1={model.y(tick)}
              y2={model.y(tick)}
              className="tregu-exact-chart-grid"
            />
          ))}

          {[...model.cleaned]
            // The held outcome paints last, so it sits on top where lines cross.
            .sort((a, b) => Number(a.key === emphasisKey) - Number(b.key === emphasisKey))
            .map((item) => {
            const displayPoints = item.displayPoints;
            if (displayPoints.length === 0) return null;
            const lineOf = drawn.get(item.key) ?? displayPoints;
            const pathFor = (points: { t: number; p: number }[]) => points.length >= 2
              ? curve === "smooth"
                ? smoothRecordedPath(points, model.x, model.y)
                : angularRecordedPath(points, model.x, model.y)
              : "";
            const path = pathFor(lineOf);
            const emphasised = emphasisKey != null && item.key === emphasisKey;
            const receded = emphasisKey != null && !emphasised && model.cleaned.some((other) => other.key === emphasisKey);
            const last = displayPoints[displayPoints.length - 1];
            const first = displayPoints[0];
            const tip = lineOf.at(-1) ?? last;
            // A short range can contain exactly one real persisted point. Hold
            // that known value across the visible window instead of showing a
            // lone dot and incorrectly claiming the chart is empty.
            const heldPath = `M${PAD_L} ${model.y(last.p).toFixed(1)} L${(PAD_L + model.plotW).toFixed(1)} ${model.y(last.p).toFixed(1)}`;
            const displayPath = displayPoints.length >= 2 ? path : heldPath;
            const gradientId = `exact-fill-${uid}-${item.key.replace(/[^a-z0-9_-]/gi, "")}`;
            const fillPath = displayPoints.length >= 2
              ? `${path} L${model.x(last.t).toFixed(1)} ${drawHeight - PAD_Y} L${model.x(first.t).toFixed(1)} ${drawHeight - PAD_Y} Z`
              : "";
            return (
              <g key={`${item.key}-${showRanges ? range : "all"}`} opacity={receded ? 0.42 : undefined}>
                {model.cleaned.length === 1 && fillPath && (
                  <>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={item.color} stopOpacity={tone === "sport" ? "0.24" : "0.16"} />
                        <stop offset="100%" stopColor={item.color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={fillPath} fill={`url(#${gradientId})`} />
                  </>
                )}
                {displayPath && (
                  <path
                    d={displayPath}
                    pathLength={1}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={emphasised ? 3.5 : model.cleaned.length > 1 ? 2.5 : 3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className={`tregu-exact-chart-line${displayPoints.length === 1 ? " tregu-exact-chart-line--held" : ""}${drawsLive ? " tregu-exact-chart-line--live" : ""}`}
                  />
                )}
                {breathing && (
                  <circle
                    cx={model.x(tip.t)}
                    cy={model.y(tip.p)}
                    r={model.cleaned.length > 1 ? 9 : 11}
                    fill={item.color}
                    className="tregu-exact-chart-halo"
                    aria-hidden
                  />
                )}
                <circle
                  key={`${item.key}-latest-${item.points.at(-1)?.t ?? 0}`}
                  cx={model.x(tip.t)}
                  cy={model.y(tip.p)}
                  r={model.cleaned.length > 1 ? 4 : 4.5}
                  fill={item.color}
                  stroke="#fff"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  className="tregu-exact-chart-last"
                />
              </g>
            );
          })}

          {marks.map((mark) => {
            const item = model.cleaned.find((candidate) => candidate.key === mark.key);
            const first = model.timestamps[0];
            const last = model.timestamps.at(-1);
            if (!item || first == null || last == null || mark.t < first || mark.t > last) return null;
            // The price the line shows at that moment: the first point at or after it.
            const point = item.displayPoints.find((candidate) => candidate.t >= mark.t) ?? item.displayPoints.at(-1);
            if (!point) return null;
            return (
              <circle
                key={`mark-${mark.key}-${mark.t}`}
                cx={model.x(mark.t)}
                cy={model.y(point.p)}
                r={7}
                fill="#fff"
                stroke={item.color}
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                className="tregu-exact-chart-mark"
              >
                <title>Blerja jote</title>
              </circle>
            );
          })}

          {inspection && (
            <g className="tregu-exact-chart-inspector-marks" aria-hidden>
              <line x1={inspection.x} x2={inspection.x} y1={PAD_Y} y2={drawHeight - PAD_Y} />
              {inspection.entries.map((item) => (
                <circle
                  key={item.key}
                  cx={model.x(item.point.t)}
                  cy={model.y(item.point.p)}
                  r={5}
                  fill={item.color}
                  stroke="#fff"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}
        </svg>

        {pins.length > 0 && (
          <ol className="tregu-exact-chart-news" aria-label="Lajmet që lëvizën tregun">
            {pins.map((pin) => (
              <li
                key={`${pin.t}-${pin.href}`}
                // A pin is its own target: the plot's time inspector must not
                // open underneath the story card.
                onPointerEnter={() => setInspectionT(null)}
                onPointerMove={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                data-align={pin.x > W * 0.66 ? "end" : "start"}
                style={{ left: `${(pin.x / W) * 100}%`, top: `${(pin.y / drawHeight) * 100}%` } as CSSProperties}
              >
                <a href={pin.href} target={pin.href.startsWith("http") ? "_blank" : undefined} rel={pin.href.startsWith("http") ? "noopener noreferrer" : undefined}>
                  <span className="tregu-exact-chart-news-dot">{pin.n}</span>
                  <span className="tregu-exact-chart-news-card">
                    <small>{pin.source ?? "Lajm"} · {timeLabel(pin.t, true)}</small>
                    <strong>{pin.title}</strong>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}

        {!inspection && model.hasTimeline && !minimal && (
          <span className="tregu-chart-inspect-hint" aria-hidden>
            <span>Kalo miun për detaje</span>
            <span>Prek ose rrëshqit për detaje</span>
          </span>
        )}

        {inspection && (
          <div
            className="tregu-exact-chart-inspector"
            data-align={inspection.x > W * 0.7 ? "end" : "start"}
            style={{ "--inspection-x": `${(inspection.x / W) * 100}%` } as CSSProperties}
            role="status"
            aria-live="polite"
          >
            <button
              type="button"
              aria-label="Mbyll detajet e grafikut"
              onPointerDown={(event) => {
                event.stopPropagation();
                setInspectionT(null);
              }}
            >
              ×
            </button>
            <time dateTime={new Date(inspection.timestamp).toISOString()}>{timeLabel(inspection.timestamp)}</time>
            {inspection.entries.map((item) => (
              <span key={item.key}>
                <i style={{ background: item.color }} />
                <em>{item.label}</em>
                <strong>{percent(item.point.p)}</strong>
              </span>
            ))}
          </div>
        )}

        {!compact && (
          <div className="tregu-exact-chart-axis" aria-hidden>
            {model.domain.ticks.map((tick) => (
              <span key={tick} style={{ top: model.y(tick) }}>
                {formatProbabilityTick(tick, model.domain.tickStep)}
              </span>
            ))}
          </div>
        )}

        {!model.hasDisplayData && (
          <div className="tregu-exact-chart-empty" role="status">
            <strong>{minimal ? "Nuk ka të dhëna ende" : "Pa të dhëna të regjistruara në këtë interval"}</strong>
            {!minimal && <span>Linja shfaqet sapo të regjistrohet një vlerë e këtij intervali.</span>}
          </div>
        )}
      </div>

      {!minimal && (
        <div className="tregu-exact-chart-legend" aria-label="Gjasat e fundit të regjistruara">
          {summaries.map((item) => (
            <span key={item.key} data-held={item.key === emphasisKey || undefined}>
              <i style={{ background: item.color }} />
              <em>{item.label}{item.key === emphasisKey ? " · pozicioni yt" : ""}</em>
              <strong>{percent(item.current)}</strong>
            </span>
          ))}
        </div>
      )}

      {showPulse && summaries.length > 0 && (
        <div className="tregu-chart-pulse" aria-label="Pulsi i intervalit">
          {single ? (
            <>
              <span><small>Minimum</small><strong>{percent(single.low)}</strong></span>
              <span><small>Maksimum</small><strong>{percent(single.high)}</strong></span>
              <span><small>Nga fillimi</small><strong data-direction={single.change > 0 ? "up" : single.change < 0 ? "down" : "flat"}>{percent(single.start)} → {percent(single.current)}</strong></span>
            </>
          ) : (
            <>
              <span><small>Në krye</small><strong>{leader?.label ?? "Pa të dhëna"} {leader ? percent(leader.current) : ""}</strong></span>
              <span><small>Ndryshimi më i madh</small><strong data-direction={(biggestMove?.change ?? 0) > 0 ? "up" : (biggestMove?.change ?? 0) < 0 ? "down" : "flat"}>{biggestMove ? `${biggestMove.label} ${percent(biggestMove.start)} → ${percent(biggestMove.current)}` : "Pa të dhëna"}</strong></span>
              <span><small>Përditësime</small><strong>{updateCount}</strong></span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
