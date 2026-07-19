const FINAL_STATUS = /(?:FINAL|FULL_TIME|POST|CANCELED)/i;
const SUPPORTED_METRICS = new Map([
  ["totalshots", "shots"], ["shots", "shots"], ["shotsontarget", "shots_on_target"],
  ["possessionpct", "possession"], ["possession", "possession"], ["expectedgoals", "xg"], ["xg", "xg"], ["woncorners", "corners"], ["corners", "corners"],
]);

function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
function normalized(values) {
  const entries = Object.entries(values).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return Object.fromEntries(entries.map(([key, value]) => [key, total ? value / total : 1 / entries.length]));
}
function numberFromDisplay(value) {
  const matched = String(value ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return matched ? Number(matched[0]) : null;
}
function minutesFromDetail(detail) {
  const match = String(detail ?? "").match(/(\d{1,3})\s*(?:'|min)/i);
  return match ? clamp(Number(match[1]), 0, 130) : 0;
}
export function isOfficialFinal(event) {
  return FINAL_STATUS.test(String(event?.status ?? "")) || String(event?.detail ?? "").trim().toUpperCase() === "FT";
}

/** Parse ESPN's documented summary response without manufacturing absent metrics. */
export function normalizeEspnSummary(config, body, fetchedAt = new Date()) {
  const competition = body?.header?.competitions?.[0];
  const status = competition?.status?.type;
  const competitors = (competition?.competitors ?? []).map((competitor) => ({
    team: String(competitor?.team?.displayName ?? ""), homeAway: String(competitor?.homeAway ?? ""),
    score: Number(competitor?.score), winner: Boolean(competitor?.winner),
  }));
  const has_official_score = competitors.length === 2 && competitors.every((team) => Number.isFinite(team.score));
  const is_pre_game = /(?:SCHEDULED|PRE_?GAME|NOT_STARTED)/i.test(String(status?.name ?? ""));
  if (!status?.name || competitors.length !== 2 || competitors.some((team) => !team.team) || (!has_official_score && !is_pre_game)) {
    throw new Error(`ESPN event ${config?.event_id ?? ""} had no usable official score.`);
  }
  const metrics = {};
  for (const row of body?.boxscore?.teams ?? []) {
    const team = String(row?.team?.displayName ?? "");
    if (!team) continue;
    const measured = {};
    for (const statistic of row?.statistics ?? []) {
      const key = SUPPORTED_METRICS.get(String(statistic?.name ?? statistic?.displayName ?? "").replace(/[^a-z]/gi, "").toLowerCase());
      const value = numberFromDisplay(statistic?.displayValue ?? statistic?.value);
      if (key && Number.isFinite(value)) measured[key] = value;
    }
    if (Object.keys(measured).length) metrics[team] = measured;
  }
  const starting_lineups = {};
  for (const group of body?.boxscore?.players ?? []) {
    const team = String(group?.team?.displayName ?? "");
    const starters = [];
    for (const statistic of group?.statistics ?? []) for (const athlete of statistic?.athletes ?? []) {
      if (athlete?.starter === true && athlete?.athlete?.displayName) starters.push(String(athlete.athlete.displayName));
    }
    if (team && starters.length) starting_lineups[team] = [...new Set(starters)];
  }
  const source_url = `https://site.api.espn.com/apis/site/v2/sports/${encodeURIComponent(String(config?.sport ?? "soccer"))}/${encodeURIComponent(String(config?.league))}/summary?event=${encodeURIComponent(String(config?.event_id))}`;
  return { provider: "espn", event_id: String(config.event_id), league: String(config.league), sport: String(config.sport ?? "soccer"), date: competition.date, kickoff: competition.date,
    status: String(status.name), detail: String(status.shortDetail ?? status.detail ?? status.name), competitors, has_official_score, metrics, starting_lineups, source_url, fetched_at: new Date(fetchedAt).toISOString() };
}

export function sportOutcomePrices(market) {
  const quantities = market?.outcome_quantities ?? {};
  const outcomes = market?.sport_outcomes ?? [];
  const b = Number(market?.b);
  if (!Number.isFinite(b) || b <= 0 || outcomes.length < 2) throw new Error("Sport LMSR market requires positive liquidity and outcomes.");
  const values = outcomes.map((outcome) => Number(quantities[outcome.key] ?? 0));
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Sport LMSR quantities must be finite.");
  const pivot = Math.max(...values);
  const weights = values.map((value) => Math.exp(clamp((value - pivot) / b, -700, 700)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(outcomes.map((outcome, index) => [outcome.key, weights[index] / total]));
}

export function previewSportMarketBet(market, outcomeKey, coins) {
  const stake = Number(coins); const b = Number(market?.b);
  if (!Number.isFinite(stake) || stake <= 0) throw new Error("Virtual 383C stake must be positive.");
  const outcomes = market?.sport_outcomes ?? [];
  const selected = outcomes.findIndex((outcome) => outcome.key === outcomeKey);
  if (selected < 0) throw new Error("Invalid sport outcome.");
  const quantities = Object.fromEntries(outcomes.map((outcome) => [outcome.key, Number(market.outcome_quantities?.[outcome.key] ?? 0)]));
  const values = outcomes.map((outcome) => quantities[outcome.key]); const pivot = Math.max(...values);
  const weights = values.map((value) => Math.exp(clamp((value - pivot) / b, -700, 700)));
  const total = weights.reduce((sum, value) => sum + value, 0); const other = total - weights[selected];
  const shares = b * Math.log((total * Math.exp(stake / b) - other) / weights[selected]);
  quantities[outcomeKey] += shares;
  return { shares, quantities, prices: sportOutcomePrices({ ...market, outcome_quantities: quantities }) };
}

function stateKey(event) {
  return JSON.stringify({ status: event.status, detail: event.detail, competitors: event.competitors.map(({ team, score }) => ({ team, score })).sort((a, b) => a.team.localeCompare(b.team)), metrics: event.metrics, metric_sources: event.metric_sources, starting_lineups: event.starting_lineups, flashscore: { availability: event.supplemental?.flashscore?.availability, source_url: event.supplemental?.flashscore?.source_url, reason: event.supplemental?.flashscore?.reason } });
}

/** Score, clock, and supplied stat/provenance changes are mail-material; lineups alone are not. */
function materialStateKey(state) {
  const competitors = Array.isArray(state?.competitors) ? state.competitors : [];
  return JSON.stringify({
    status: state?.status,
    detail: state?.detail,
    competitors: competitors.map(({ team, score }) => ({ team, score })).sort((a, b) => String(a.team).localeCompare(String(b.team))),
    metrics: state?.metrics ?? {},
    metric_sources: state?.metric_sources ?? {},
  });
}

function hasPairedBinaryMaterialChange(previousState, event) {
  return materialStateKey(previousState) !== materialStateKey(event);
}
function outcomeForTeam(market, team) {
  return (market.sport_outcomes ?? []).find((outcome) => String(outcome.team ?? "").toLowerCase() === String(team).toLowerCase())?.key;
}
function finalPrices(market, event) {
  const [home, away] = event.competitors;
  const winner = home.score === away.score ? "draw" : outcomeForTeam(market, home.score > away.score ? home.team : away.team);
  if (!winner || !(market.sport_outcomes ?? []).some((outcome) => outcome.key === winner)) throw new Error("Official ESPN final does not map to a configured sport outcome.");
  const losers = market.sport_outcomes.filter((outcome) => outcome.key !== winner);
  return { winner, prices: normalized(Object.fromEntries(market.sport_outcomes.map((outcome) => [outcome.key, outcome.key === winner ? 0.999 : 0.001 / losers.length]))) };
}
function applyPressure(prices, market, event) {
  const [home, away] = event.competitors; const homeKey = outcomeForTeam(market, home.team); const awayKey = outcomeForTeam(market, away.team);
  if (!homeKey || !awayKey || !event.metrics?.[home.team] || !event.metrics?.[away.team]) return prices;
  const a = event.metrics[home.team], b = event.metrics[away.team];
  const pressure = clamp(((a.shots_on_target ?? 0) - (b.shots_on_target ?? 0)) * 0.008 + ((a.xg ?? 0) - (b.xg ?? 0)) * 0.025 + ((a.possession ?? 50) - (b.possession ?? 50)) * 0.0015, -0.04, 0.04);
  return normalized({ ...prices, [homeKey]: prices[homeKey] + pressure, [awayKey]: prices[awayKey] - pressure });
}

/** Deterministic reference model: source data is retained in each audit, with bounded signal weights. */
export function buildSportMarketPlan({ markets, events, verifiedNews = [], now = new Date() }) {
  const byEvent = new Map((events ?? []).filter((event) => event?.provider === "espn").map((event) => [String(event.event_id), event]));
  return (markets ?? []).flatMap((market) => {
    if (market?.status !== "open" || market?.live_event?.provider !== "espn" || !Array.isArray(market?.sport_outcomes) || !market.sport_outcomes.length) return [];
    const event = byEvent.get(String(market.live_event.event_id)); if (!event) return [];
    const key = stateKey(event); if (market.live_score_state?.key === key) return [];
    const news = verifiedNews.filter((item) => String(item?.event_id) === String(event.event_id) && item?.url && item?.source && item?.verification !== "social_only" && !/(^|\b)(x|twitter|instagram|facebook|tiktok|telegram|reddit)(\b|\/)/i.test(String(item.source)));
    if (!event.has_official_score) {
      return [{ market, event, kind: "no_score", state_key: key, close_market: false, kickoff: event.kickoff, pre_match_evidence: news.map((item) => ({ title: String(item.title ?? item.source), source: String(item.source), url: String(item.url) })) }];
    }
    const current = sportOutcomePrices(market);
    if (isOfficialFinal(event)) {
      const final = finalPrices(market, event); const finalizedAt = new Date(now);
      return [{ market, event, kind: "score", state_key: key, close_market: true, verified_outcome: final.winner, settlement_due_at: new Date(finalizedAt.getTime() + 7 * 60_000).toISOString(), snapshot: { oracle_kind: "sport_oracle", oracle_cap: 0.10, reference_probabilities: final.prices, oracle_reasoning: "Official ESPN final state; market locked and settlement is queued for seven minutes.", evidence: [{ title: `ESPN official final: ${event.detail}`, url: event.source_url }] } }];
    }
    let reference = { ...(market.reference_probabilities ?? current) };
    const scoredNews = news.filter((item) => item?.probabilities);
    for (const item of scoredNews) reference = normalized(Object.fromEntries(Object.keys(reference).map((key) => [key, reference[key] * 0.95 + Number(item.probabilities[key] ?? reference[key]) * 0.05])));
    const [home, away] = event.competitors; const homeKey = outcomeForTeam(market, home.team); const awayKey = outcomeForTeam(market, away.team);
    const minute = minutesFromDetail(event.detail); const difference = home.score - away.score;
    if (difference && homeKey && awayKey) {
      const leader = difference > 0 ? homeKey : awayKey; const trailer = difference > 0 ? awayKey : homeKey;
      const leaderProbability = clamp(0.5 + Math.abs(difference) * 0.14 + minute * 0.003, 0.52, 0.94);
      const drawKey = market.sport_outcomes.find((outcome) => outcome.key === "draw")?.key;
      reference = normalized(Object.fromEntries(market.sport_outcomes.map((outcome) => [outcome.key, outcome.key === leader ? leaderProbability : outcome.key === drawKey ? Math.max(0.03, 0.28 - minute * 0.0025) : Math.max(0.02, 1 - leaderProbability - Math.max(0.03, 0.28 - minute * 0.0025))])));
    }
    reference = applyPressure(reference, market, event);
    const cap = difference ? 0.10 : (Object.keys(event.metrics ?? {}).length ? 0.04 : (scoredNews.length ? 0.05 : 0.02));
    return [{ market, event, kind: "score", state_key: key, close_market: false, snapshot: { oracle_kind: "sport_oracle", oracle_cap: cap, reference_probabilities: normalized(reference), oracle_reasoning: `ESPN official ${event.detail || event.status}; score, clock${Object.keys(event.metrics ?? {}).length ? ", supplied live metrics" : ""}${scoredNews.length ? ", verified breaking-news reference" : ""}.`, evidence: [{ title: `ESPN official: ${home.team} ${home.score}–${away.score} ${away.team} (${event.detail || event.status})`, url: event.source_url }, ...scoredNews.map((item) => ({ title: `Verified ${item.source} event reference`, url: item.url }))] } }];
  });
}


const ARGENTINA_SPAIN_PAIR = Object.freeze({
  spainSlug: "argjentina-spanja-fiton-spanja",
  argentinaSlug: "argjentina-spanja-fiton-argjentina",
  event: { provider: "espn", event_id: "760517", league: "fifa.world", sport: "soccer", home_team: "Argentina", away_team: "Spain" },
});

function pairedBinaryReference(event) {
  const argentina = event.competitors.find((team) => String(team.team).toLowerCase() === "argentina");
  const spain = event.competitors.find((team) => String(team.team).toLowerCase() === "spain");
  if (!argentina || !spain || !event.has_official_score) throw new Error("Official ESPN Argentina–Spain score is unavailable.");
  if (isOfficialFinal(event)) return { spain: spain.score > argentina.score ? 0.999 : 0.001, argentina: argentina.score > spain.score ? 0.999 : 0.001 };
  const minute = minutesFromDetail(event.detail);
  const spainStats = event.metrics?.[spain.team] ?? {};
  const argentinaStats = event.metrics?.[argentina.team] ?? {};
  // Supplemental official live pressure is bounded and never substitutes for an ESPN score/final.
  const pressure = clamp(
    ((spainStats.shots_on_target ?? 0) - (argentinaStats.shots_on_target ?? 0)) * 0.012 +
    ((spainStats.shots ?? 0) - (argentinaStats.shots ?? 0)) * 0.005 +
    ((spainStats.possession ?? 50) - (argentinaStats.possession ?? 50)) * 0.002 +
    ((spainStats.xg ?? 0) - (argentinaStats.xg ?? 0)) * 0.025,
    -0.08, 0.08
  );
  // In a drawn match, a dominance edge decays gradually as time runs out without a goal.
  // This creates a truthful clock-driven update even when the supplied stat totals are unchanged.
  const timeAdjustedPressure = pressure * (1 - Math.min(Math.max(minute, 0), 120) / 150);
  const swing = (spain.score - argentina.score) * 0.14 + (spain.score === argentina.score ? 0 : Math.sign(spain.score - argentina.score) * minute * 0.003) + timeAdjustedPressure;
  const spainProbability = clamp(0.5 + swing, 0.06, 0.94);
  return { spain: spainProbability, argentina: 1 - spainProbability };
}

/** Fixed legacy PO/JO pair adapter. It intentionally does not require sport_outcomes. */
export function buildArgentinaSpainPairedBinaryPlan({ markets, events, now = new Date() }) {
  const bySlug = new Map((markets ?? []).map((market) => [market?.slug, market]));
  const spainMarket = bySlug.get(ARGENTINA_SPAIN_PAIR.spainSlug);
  const argentinaMarket = bySlug.get(ARGENTINA_SPAIN_PAIR.argentinaSlug);
  if (!spainMarket || !argentinaMarket || spainMarket.status !== "open" || argentinaMarket.status !== "open") return [];
  const event = (events ?? []).find((item) => item?.provider === "espn" && String(item.event_id) === ARGENTINA_SPAIN_PAIR.event.event_id);
  if (!event) return [];
  const key = stateKey(event);
  if (spainMarket.live_score_state?.key === key && argentinaMarket.live_score_state?.key === key) return [];
  const material_change = hasPairedBinaryMaterialChange(spainMarket.live_score_state, event) || hasPairedBinaryMaterialChange(argentinaMarket.live_score_state, event);
  const state = { key, material_key: materialStateKey(event), status: event.status, detail: event.detail, competitors: event.competitors, metrics: event.metrics, metric_sources: event.metric_sources, starting_lineups: event.starting_lineups, source_url: event.source_url, supplemental: event.supplemental, kickoff: event.kickoff, has_official_score: event.has_official_score };
  if (!event.has_official_score) return [{ kind: "no_score", event, spainMarket, argentinaMarket, state }];
  const reference = pairedBinaryReference(event);
  const final = isOfficialFinal(event);
  const [argentina, spain] = event.competitors;
  return [{
    kind: "score", event, spainMarket, argentinaMarket, state, material_change, reference, close_market: final,
    spain_outcome: final ? (reference.spain > reference.argentina ? "PO" : "JO") : null,
    argentina_outcome: final ? (reference.argentina > reference.spain ? "PO" : "JO") : null,
    settlement_due_at: final ? new Date(new Date(now).getTime() + 7 * 60_000).toISOString() : null,
    oracle_cap: 0.10,
    evidence: [{ title: `ESPN official: ${argentina.team} ${argentina.score}–${spain.score} ${spain.team} (${event.detail || event.status})`, url: event.source_url }, ...(event.supplemental?.flashscore?.source_url ? [{ title: "Flashscore supplemental live metrics", url: event.supplemental.flashscore.source_url }] : [])],
    reasoning: `Official ESPN ${event.detail || event.status}; paired legacy binary reference is complementary and bounded. ESPN owns final lock and settlement.`
  }];
}

export { ARGENTINA_SPAIN_PAIR };
