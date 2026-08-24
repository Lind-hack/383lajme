const DRAW_COLOR = "#777772";
const HOME_FALLBACK_COLOR = "#1E5BB8";
const AWAY_FALLBACK_COLOR = "#C9342F";

function relativeLuminance(red, green, blue) {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

// Club feeds sometimes publish white or very pale kit colours. Preserve the
// supplied hue, but derive its chart ink until a thin line and percentage stay
// visible on the white market surface.
function contrastSafeTeamColor(hex) {
  let red = Number.parseInt(hex.slice(1, 3), 16);
  let green = Number.parseInt(hex.slice(3, 5), 16);
  let blue = Number.parseInt(hex.slice(5, 7), 16);
  while (relativeLuminance(red, green, blue) > 0.34) {
    red = Math.round(red * 0.86);
    green = Math.round(green * 0.86);
    blue = Math.round(blue * 0.86);
  }
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export function toExactSeries(points) {
  const clean = (Array.isArray(points) ? points : [])
    .map((point) => ({
      t: new Date(point?.created_at).getTime(),
      p: Number(point?.probability),
    }))
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p))
    .map((point) => ({ ...point, p: Math.max(0, Math.min(1, point.p)) }))
    .sort((a, b) => a.t - b.t);
  return [...new Map(clean.map((point) => [point.t, point])).values()];
}

/**
 * Convert independent, persisted PO books into one comparable event tape.
 * Each derived row uses only the most recent value recorded at or before that
 * timestamp. No interpolation or request-time point is introduced.
 */
export function normalizeRecordedOutcomeSeries(outcomes) {
  const clean = (Array.isArray(outcomes) ? outcomes : []).map((outcome, index) => ({
    key: String(outcome?.key ?? `outcome-${index + 1}`),
    points: (Array.isArray(outcome?.points) ? outcome.points : [])
      .map((point) => ({ t: Number(point?.t), p: Number(point?.p) }))
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p))
      .map((point) => ({ ...point, p: Math.max(0, Math.min(1, point.p)) }))
      .sort((a, b) => a.t - b.t),
  }));
  const timestamps = [...new Set(clean.flatMap((outcome) => outcome.points.map((point) => point.t)))]
    .sort((a, b) => a - b);
  const latest = new Map();
  const output = new Map(clean.map((outcome) => [outcome.key, []]));

  for (const timestamp of timestamps) {
    for (const outcome of clean) {
      const recorded = outcome.points.findLast((point) => point.t <= timestamp);
      if (recorded) latest.set(outcome.key, recorded.p);
    }
    if (clean.some((outcome) => !latest.has(outcome.key))) continue;
    const total = clean.reduce((sum, outcome) => sum + Number(latest.get(outcome.key)), 0);
    if (!(total > 0)) continue;
    for (const outcome of clean) {
      output.get(outcome.key).push({
        t: timestamp,
        p: Number(latest.get(outcome.key)) / total,
      });
    }
  }

  return Object.fromEntries(output);
}

export function isStructuredSportMarket(market) {
  const outcomes = Array.isArray(market?.sport_outcomes) ? market.sport_outcomes : [];
  return (
    (market?.market_type === "two_outcome" || market?.market_type === "three_outcome") &&
    outcomes.length >= 2 &&
    outcomes.length <= 3 &&
    market?.outcome_probabilities &&
    typeof market.outcome_probabilities === "object"
  );
}

export function marketVolume(market) {
  const traded = Number(market?.trade_volume);
  if (Number.isFinite(traded) && traded > 0) return traded;
  if (isStructuredSportMarket(market)) return 0;
  return Math.max(0, Number(market?.q_yes ?? 0)) + Math.max(0, Number(market?.q_no ?? 0));
}

export function outcomeColor(outcome, index = 0) {
  const key = String(outcome?.key ?? "").toLowerCase();
  const label = String(outcome?.label ?? "").toLowerCase();
  if (key === "draw" || /baraz|draw/.test(label)) return DRAW_COLOR;
  const supplied = String(
    outcome?.color ?? outcome?.team_color ?? outcome?.team_colour ?? ""
  ).trim();
  return /^#[0-9a-f]{6}$/i.test(supplied)
    ? contrastSafeTeamColor(supplied)
    : index === 0
      ? HOME_FALLBACK_COLOR
      : AWAY_FALLBACK_COLOR;
}

export function lastRecordedAt(market) {
  const candidates = [market?.last_data_at, market?.updated_at]
    .map((value) => new Date(value ?? "").getTime())
    .filter(Number.isFinite);
  const binary = toExactSeries(market?.history);
  if (binary.length) candidates.push(binary[binary.length - 1].t);
  for (const points of Object.values(market?.outcome_history ?? {})) {
    const exact = toExactSeries(points);
    if (exact.length) candidates.push(exact[exact.length - 1].t);
  }
  return candidates.length ? Math.max(...candidates) : null;
}

export function recordedMovement(market) {
  if (isStructuredSportMarket(market)) {
    return Object.values(market.outcome_history ?? {}).reduce((sum, points) => {
      const exact = toExactSeries(points);
      return exact.length >= 2 ? sum + Math.abs(exact[exact.length - 1].p - exact[0].p) : sum;
    }, 0);
  }
  const exact = toExactSeries(market?.history);
  return exact.length >= 2 ? Math.abs(exact[exact.length - 1].p - exact[0].p) : 0;
}

export function featuredMarketScore(market, now = Date.now()) {
  const latest = lastRecordedAt(market);
  const ageHours = latest == null ? 168 : Math.max(0, (now - latest) / 3_600_000);
  const recency = Math.max(0, 72 - ageHours) / 72;
  const movement = Math.min(1, recordedMovement(market) * 3);
  const trades = Math.log1p(Math.max(0, Number(market?.trade_count ?? 0))) / 6;
  const volume = Math.log1p(marketVolume(market)) / 10;
  return movement * 5 + recency * 3 + trades * 2 + volume;
}
