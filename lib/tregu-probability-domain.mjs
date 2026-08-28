export const RECORDED_RANGE_OPTIONS = [
  { key: "1s", ms: 1_000, description: "Sekonda e fundit" },
  { key: "1m", ms: 60_000, description: "Minuta e fundit" },
  { key: "5m", ms: 5 * 60_000, description: "5 minutat e fundit" },
  { key: "15m", ms: 15 * 60_000, description: "15 minutat e fundit" },
  { key: "1h", ms: 60 * 60_000, description: "Ora e fundit" },
  { key: "4h", ms: 4 * 60 * 60_000, description: "4 orët e fundit" },
  { key: "1d", ms: 24 * 60 * 60_000, description: "24 orët e fundit" },
  { key: "1w", ms: 7 * 24 * 60 * 60_000, description: "7 ditët e fundit" },
  { key: "Gjithë", ms: Number.POSITIVE_INFINITY, description: "Gjithë historia" },
];

const TICK_STEPS = [0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1];

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clampProbability(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

function ticksFor(lo, hi) {
  for (const step of TICK_STEPS) {
    const first = Math.ceil((lo - 1e-9) / step) * step;
    const ticks = [];
    for (let value = first; value <= hi + 1e-9; value += step) {
      ticks.push(round(value));
    }
    if (ticks.length >= 3 && ticks.length <= 5) return { ticks, step };
  }
  return {
    ticks: [round(lo), round((lo + hi) / 2), round(hi)],
    step: Math.max(0.01, (hi - lo) / 2),
  };
}

/**
 * Fit every visible recorded probability into one explicit, shared scale.
 * The 8pp minimum prevents tiny noise from consuming the entire plot while
 * still making genuine moves legible. No points are discarded or clipped.
 */
export function probabilityDomain(values) {
  const clean = values
    .map(Number)
    .filter(Number.isFinite)
    .map(clampProbability);

  if (clean.length === 0) {
    return {
      lo: 0,
      hi: 1,
      rawLo: 0,
      rawHi: 1,
      ticks: [0, 0.25, 0.5, 0.75, 1],
      tickStep: 0.25,
      zoomed: false,
    };
  }

  const rawLo = Math.min(...clean);
  const rawHi = Math.max(...clean);
  const rawSpan = rawHi - rawLo;
  const pad = Math.max(0.02, rawSpan * 0.15);
  const requestedSpan = Math.min(1, Math.max(0.08, rawSpan + pad * 2));
  const center = (rawLo + rawHi) / 2;
  let lo = center - requestedSpan / 2;
  let hi = center + requestedSpan / 2;

  if (lo < 0) {
    hi -= lo;
    lo = 0;
  }
  if (hi > 1) {
    lo -= hi - 1;
    hi = 1;
  }
  lo = Math.max(0, lo);
  hi = Math.min(1, hi);

  // Values within 2pp of a semantic boundary should visibly meet it. Shift
  // the whole band so the domain span stays honest instead of truncating it.
  if (rawLo <= 0.02 && lo > 0) {
    hi = Math.min(1, hi - lo);
    lo = 0;
  }
  if (rawHi >= 0.98 && hi < 1) {
    lo = Math.max(0, lo + (1 - hi));
    hi = 1;
  }

  lo = round(lo);
  hi = round(hi);
  const { ticks, step } = ticksFor(lo, hi);
  return {
    lo,
    hi,
    rawLo,
    rawHi,
    ticks,
    tickStep: step,
    zoomed: lo > 0 || hi < 1,
  };
}

export function formatProbabilityTick(value, step = 0.01) {
  const percent = clampProbability(value) * 100;
  const decimals = step * 100 < 1 || Math.abs(percent - Math.round(percent)) > 1e-8 ? 1 : 0;
  return `${percent.toFixed(decimals)}%`;
}

export function cleanRecordedPoints(points) {
  const clean = (Array.isArray(points) ? points : [])
    .map((point) => ({ t: Number(point?.t), p: Number(point?.p) }))
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p))
    .map((point) => ({ ...point, p: clampProbability(point.p) }))
    .sort((a, b) => a.t - b.t);
  return [...new Map(clean.map((point) => [point.t, point])).values()];
}

/** Select only recorded points. This never creates a boundary/interpolated row. */
export function selectRecordedRange(series, rangeKey = "Gjithë") {
  const option = RECORDED_RANGE_OPTIONS.find((item) => item.key === rangeKey) ?? RECORDED_RANGE_OPTIONS.at(-1);
  const cleaned = series.map((item) => ({ ...item, points: cleanRecordedPoints(item.points) }));
  const timestamps = cleaned.flatMap((item) => item.points.map((point) => point.t));
  const end = timestamps.length ? Math.max(...timestamps) : null;
  const start = end == null || !Number.isFinite(option.ms) ? null : end - option.ms;
  return {
    option,
    start,
    end,
    series: cleaned.map((item) => {
      const points = start == null ? item.points : item.points.filter((point) => point.t >= start && point.t <= end);
      const hold = start == null ? undefined : [...item.points].reverse().find((point) => point.t < start);
      return { ...item, points, hold };
    }),
  };
}

/**
 * Build plot-only hold anchors from the last known value before a selected
 * window. Probabilities are carried forward, never interpolated or invented.
 * The source `points` arrays remain exact recorded history.
 */
export function recordedRangeDisplaySeries(series, start, end) {
  return series.map((item) => {
    const points = cleanRecordedPoints(item.points);
    const hold = item.hold && Number.isFinite(Number(item.hold.t)) && Number.isFinite(Number(item.hold.p))
      ? { t: Number(item.hold.t), p: clampProbability(item.hold.p) }
      : null;
    const displayPoints = points.map((point) => ({ ...point, held: false }));

    if (hold && Number.isFinite(start)) {
      displayPoints.unshift({ t: Number(start), p: hold.p, held: true });
      if (points.length === 0 && Number.isFinite(end) && Number(end) > Number(start)) {
        displayPoints.push({ t: Number(end), p: hold.p, held: true });
      }
    }

    return { ...item, points, displayPoints };
  });
}

/** Sharp joins expose the direction of every exact recorded move. */
export function angularRecordedPath(points, xFor, yFor) {
  if (!Array.isArray(points) || points.length === 0) return "";
  return points.map((point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${command}${xFor(point.t).toFixed(1)} ${yFor(point.p).toFixed(1)}`;
  }).join(" ");
}

/**
 * Join exact recorded points with a monotone cubic curve. The curve passes
 * through every persisted point and clamps its tangents so it cannot invent
 * an overshoot between two probabilities.
 */
export function smoothRecordedPath(points, xFor, yFor) {
  if (!Array.isArray(points) || points.length === 0) return "";
  const mapped = points.map((point) => ({ x: xFor(point.t), y: yFor(point.p) }));
  if (mapped.length === 1) return `M${mapped[0].x.toFixed(1)} ${mapped[0].y.toFixed(1)}`;

  const slopes = mapped.slice(0, -1).map((point, index) => {
    const next = mapped[index + 1];
    const dx = Math.max(0.000001, next.x - point.x);
    return (next.y - point.y) / dx;
  });
  const tangents = mapped.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === mapped.length - 1) return slopes.at(-1);
    const before = slopes[index - 1];
    const after = slopes[index];
    return before * after <= 0 ? 0 : (before + after) / 2;
  });

  for (let index = 0; index < slopes.length; index += 1) {
    const slope = slopes[index];
    if (Math.abs(slope) < 1e-9) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const a = tangents[index] / slope;
    const b = tangents[index + 1] / slope;
    const magnitude = Math.hypot(a, b);
    if (magnitude > 3) {
      const scale = 3 / magnitude;
      tangents[index] = scale * a * slope;
      tangents[index + 1] = scale * b * slope;
    }
  }

  let path = `M${mapped[0].x.toFixed(1)} ${mapped[0].y.toFixed(1)}`;
  for (let index = 0; index < mapped.length - 1; index += 1) {
    const point = mapped[index];
    const next = mapped[index + 1];
    const dx = Math.max(0.000001, next.x - point.x);
    const control = dx / 3;
    path += ` C${(point.x + control).toFixed(1)} ${(point.y + tangents[index] * control).toFixed(1)}`;
    path += ` ${(next.x - control).toFixed(1)} ${(next.y - tangents[index + 1] * control).toFixed(1)}`;
    path += ` ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return path;
}
