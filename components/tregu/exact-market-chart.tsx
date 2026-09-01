"use client";

import {
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
  RECORDED_RANGE_OPTIONS,
  formatProbabilityTick,
  probabilityDomain,
  recordedRangeDisplaySeries,
  selectRecordedRange,
  type RecordedRangeKey,
} from "@/lib/tregu-probability-domain.mjs";
import { TREGU_CHART_UI_VERSION } from "@/lib/tregu-ui-contract";
import { formatKosovoDateTime, formatKosovoTime } from "@/lib/tregu-local-time.mjs";

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
  curve = "angular",
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
  curve?: "angular" | "smooth";
}) {
  const uid = useId().replace(/:/g, "");
  const [range, setRange] = useState<RecordedRangeKey>(defaultRange);
  const drawsLive = showRanges && (range === "1s" || range === "1m" || range === "5m");
  const selected = useMemo(
    () => selectRecordedRange(series, showRanges ? range : "Gjithë"),
    [range, series, showRanges]
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
    const plotH = height - PAD_Y * 2;
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
  }, [compact, height, selected.series]);

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
          viewBox={`0 0 ${W} ${height}`}
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

          {model.cleaned.map((item) => {
            const displayPoints = item.displayPoints;
            if (displayPoints.length === 0) return null;
            const pathFor = (points: typeof displayPoints) => points.length >= 2
              ? curve === "smooth"
                ? smoothRecordedPath(points, model.x, model.y)
                : angularRecordedPath(points, model.x, model.y)
              : "";
            const path = displayPoints.length >= 2
              ? curve === "smooth"
                ? smoothRecordedPath(displayPoints, model.x, model.y)
                : angularRecordedPath(displayPoints, model.x, model.y)
              : "";
            const last = displayPoints[displayPoints.length - 1];
            const first = displayPoints[0];
            // A short range can contain exactly one real persisted point. Hold
            // that known value across the visible window instead of showing a
            // lone dot and incorrectly claiming the chart is empty.
            const heldPath = `M${PAD_L} ${model.y(last.p).toFixed(1)} L${(PAD_L + model.plotW).toFixed(1)} ${model.y(last.p).toFixed(1)}`;
            const displayPath = displayPoints.length >= 2 ? pathFor(displayPoints) : heldPath;
            const gradientId = `exact-fill-${uid}-${item.key.replace(/[^a-z0-9_-]/gi, "")}`;
            const fillPath = displayPoints.length >= 2
              ? `${path} L${model.x(last.t).toFixed(1)} ${height - PAD_Y} L${model.x(first.t).toFixed(1)} ${height - PAD_Y} Z`
              : "";
            return (
              <g key={`${item.key}-${showRanges ? range : "all"}`}>
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
                    strokeWidth={model.cleaned.length > 1 ? 2.5 : 3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className={`tregu-exact-chart-line${displayPoints.length === 1 ? " tregu-exact-chart-line--held" : ""}${drawsLive ? " tregu-exact-chart-line--live" : ""}`}
                  />
                )}
                <circle
                  key={`${item.key}-latest-${last.t}`}
                  cx={model.x(last.t)}
                  cy={model.y(last.p)}
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

          {inspection && (
            <g className="tregu-exact-chart-inspector-marks" aria-hidden>
              <line x1={inspection.x} x2={inspection.x} y1={PAD_Y} y2={height - PAD_Y} />
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
            <span key={item.key}>
              <i style={{ background: item.color }} />
              <em>{item.label}</em>
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
