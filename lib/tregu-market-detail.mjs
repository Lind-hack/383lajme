export function getMarketPrices(marketProbability) {
  const po = Math.min(1, Math.max(0, Number(marketProbability)));
  return { po, jo: 1 - po };
}

const ESPN_STATUS_LABELS = {
  STATUS_SCHEDULED: "Scheduled",
  STATUS_FIRST_HALF: "First Half",
  STATUS_HALFTIME: "Halftime",
  STATUS_SECOND_HALF: "Second Half",
  STATUS_FULL_TIME: "Full Time",
};

/**
 * Converts only ESPN's recognized lifecycle states into card copy while retaining
 * each official numeric score. Supplemental providers never determine the state
 * or score line.
 */
export function formatOfficialLiveScore(state = {}) {
  const officialStatus = ESPN_STATUS_LABELS[String(state.status ?? "").toUpperCase()];
  const detail = String(state.detail ?? "").trim();
  const status = officialStatus
    ? (detail && !detail.toLowerCase().startsWith(officialStatus.toLowerCase()) ? `${officialStatus} · ${detail}` : (detail || officialStatus))
    : (detail || String(state.status ?? "ESPN").trim() || "ESPN");
  const score = (state.competitors ?? [])
    .filter((team) => String(team?.team ?? "").trim() && Number.isFinite(Number(team?.score)))
    .map((team) => `${String(team.team).trim()} ${Number(team.score)}`)
    .join(" — ");

  return { status, score, sourceLabel: "ESPN zyrtar" };
}

/** Maps supplied values into card-safe display data without inventing a missing xG. */
export function officialMetricsForDisplay(metrics = {}, metricSources = {}) {
  return Object.entries(metrics).map(([team, values]) => ({
    team,
    possession: values.possession,
    shots: values.shots,
    shotsOnTarget: values.shots_on_target,
    corners: values.corners,
    xg: values.xg,
    sources: metricSources[team] ?? {},
  }));
}

export function buildMarketChart({ snapshots = [], currentMarketProbability }) {
  const market = [];
  const reference = [];
  const markers = [];

  for (const snapshot of snapshots) {
    const time = snapshot.created_at;
    const probability = Number(snapshot.market_prob);
    if (time && Number.isFinite(probability)) market.push({ t: time, probability });
    if (time && Number.isFinite(Number(snapshot.reference_probability))) {
      reference.push({ t: time, probability: Number(snapshot.reference_probability) });
    }
    if (time && (snapshot.oracle_kind === "trade" || snapshot.oracle_kind === "news_oracle")) {
      markers.push({ t: time, probability, kind: snapshot.oracle_kind, volume: Number(snapshot.volume) || 0 });
    }
  }

  if (Number.isFinite(Number(currentMarketProbability))) {
    market.push({ t: "now", probability: Number(currentMarketProbability) });
  }

  return { market, reference, markers };
}

export function shouldStartPollingFallback(status) {
  return status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED";
}
