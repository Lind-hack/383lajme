import { DEFAULT_SPORT_LIQUIDITY } from "./tregu-liquidity.mjs";

const EPSILON = 1e-9;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function normalize(values, keys = Object.keys(values)) {
  const clean = Object.fromEntries(keys.map((key) => [key, Math.max(EPSILON, Number(values[key] ?? 0))]));
  const total = Object.values(clean).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(keys.map((key) => [key, clean[key] / total]));
}

function softmax(values) {
  const max = Math.max(...Object.values(values));
  const weights = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Math.exp(value - max)]));
  return normalize(weights);
}

/** Convert decimal/american bookmaker odds into a normalized implied probability. */
export function americanOddsToProbability(value) {
  if (typeof value === "string" && value.trim().includes(".")) {
    const decimal = finite(value);
    if (decimal !== null && decimal > 1) return 1 / decimal;
  }
  const odds = finite(String(value ?? "").replace(/[+\s]/g, ""));
  if (odds === null || odds === 0) return null;
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

function oddsValue(node) {
  if (node === null || node === undefined) return null;
  if (typeof node === "object") return americanOddsToProbability(node.close?.odds ?? node.open?.odds ?? node.odds ?? node.moneyLine);
  return americanOddsToProbability(node);
}

/** Read ESPN’s moneyline shape without treating the bookmaker as official truth. */
export function extractFootballBookmakerProbabilities(bookmakerOdds) {
  const moneyline = bookmakerOdds?.moneyline ?? bookmakerOdds;
  if (!moneyline || typeof moneyline !== "object") return null;
  const raw = {
    home: oddsValue(moneyline.home),
    draw: oddsValue(moneyline.draw ?? bookmakerOdds?.drawOdds),
    away: oddsValue(moneyline.away),
  };
  if (Object.values(raw).some((value) => value === null || value <= 0)) return null;
  return normalize(raw, ["home", "draw", "away"]);
}

/** Recent ESPN W/D/L form, weighted toward the newest supplied result. */
export function formScore(form) {
  const results = [...String(form ?? "").toUpperCase()].filter((value) => ["W", "D", "L"].includes(value));
  if (!results.length) return null;
  let weightedPoints = 0;
  let totalWeight = 0;
  results.forEach((result, index) => {
    const weight = index + 1;
    weightedPoints += weight * (result === "W" ? 3 : result === "D" ? 1 : 0);
    totalWeight += weight * 3;
  });
  return weightedPoints / totalWeight;
}

export function recordScore(records) {
  const rows = Array.isArray(records) ? records : [];
  const summary = rows.find((row) => /total|overall|all splits/i.test(String(row?.name ?? row?.type ?? "")))?.summary ?? rows[0]?.summary;
  const match = String(summary ?? "").match(/(\d+)\s*[-:]\s*(\d+)\s*[-:]\s*(\d+)/);
  if (!match) return null;
  const wins = Number(match[1]);
  const draws = Number(match[2]);
  const losses = Number(match[3]);
  const games = wins + draws + losses;
  return games ? (wins * 3 + draws) / (games * 3) : null;
}

function teamStrength(team) {
  const form = formScore(team?.form);
  const record = recordScore(team?.records);
  const explicit = finite(team?.strength_score ?? team?.team_strength ?? team?.market_value_score);
  const values = [form, record, explicit].filter((value) => value !== null && value >= 0 && value <= 1);
  if (!values.length) return 0.5;
  if (explicit !== null && explicit >= 0 && explicit <= 1) return 0.45 * (form ?? explicit) + 0.25 * (record ?? explicit) + 0.30 * explicit;
  return (form ?? 0.5) * 0.65 + (record ?? form ?? 0.5) * 0.35;
}

/**
 * Deterministic pre-match 1X2 model.
 * ESPN/DraftKings implied prices provide the market-strength prior when present;
 * verified form/records and home advantage make bounded, auditable adjustments.
 */
export function buildFootballOpeningModel(fixture, { outcomeKeys = ["home", "draw", "away"] } = {}) {
  const keys = outcomeKeys.includes("draw") ? ["home", "draw", "away"] : ["home", "away"];
  const home = fixture?.home ?? {};
  const away = fixture?.away ?? {};
  const bookmaker = extractFootballBookmakerProbabilities(fixture?.bookmaker_odds);
  const base = bookmaker
    ? Object.fromEntries(keys.map((key) => [key, bookmaker[key]]))
    : (keys.includes("draw") ? { home: 0.42, draw: 0.27, away: 0.31 } : { home: 0.56, away: 0.44 });
  const normalizedBase = normalize(base, keys);
  const homeStrength = teamStrength(home);
  const awayStrength = teamStrength(away);
  const strengthDiff = homeStrength - awayStrength;
  const homeAdvantage = keys.includes("draw") ? 0.055 : 0.07;
  const adjustedDiff = strengthDiff + homeAdvantage;
  const logits = {
    home: Math.log(normalizedBase.home) + 0.55 * adjustedDiff,
    away: Math.log(normalizedBase.away) - 0.55 * adjustedDiff,
  };
  if (keys.includes("draw")) logits.draw = Math.log(normalizedBase.draw) - 0.24 * Math.abs(adjustedDiff);
  const model = softmax(logits);
  const probabilities = normalize(Object.fromEntries(keys.map((key) => [key, 0.72 * normalizedBase[key] + 0.28 * model[key]])), keys);
  const sources = [{ kind: "espn_fixture", url: fixture?.source_url ?? null, fetched_at: fixture?.fetched_at ?? null }];
  if (fixture?.bookmaker_odds?.provider) sources.push({ kind: "bookmaker_1x2", provider: fixture.bookmaker_odds.provider, url: fixture.bookmaker_odds.source_url ?? fixture.source_url ?? null, fetched_at: fixture.fetched_at ?? null });
  return {
    model_version: "football-opening-v2",
    probabilities,
    inputs: {
      home_form: home.form ?? null,
      away_form: away.form ?? null,
      home_form_score: formScore(home.form),
      away_form_score: formScore(away.form),
      home_record_score: recordScore(home.records),
      away_record_score: recordScore(away.records),
      home_strength: Number(homeStrength.toFixed(6)),
      away_strength: Number(awayStrength.toFixed(6)),
      home_advantage: homeAdvantage,
      bookmaker_probabilities: bookmaker ? Object.fromEntries(keys.map((key) => [key, bookmaker[key]])) : null,
      bookmaker_provider: fixture?.bookmaker_odds?.provider ?? null,
      market_value_status: "not_used_without_verified_source",
    },
    sources,
    method: bookmaker
      ? "72% normalized ESPN bookmaker 1X2 prior + 28% verified form/record/home-advantage adjustment; no subjective name or unverified valuation input."
      : "Verified form/record/home-advantage prior; bookmaker 1X2 unavailable, so no market-value claim is made.",
  };
}

export function outcomeQuantitiesFromProbabilities(probabilities, b = DEFAULT_SPORT_LIQUIDITY) {
  const keys = Object.keys(probabilities);
  if (!Number.isFinite(Number(b)) || Number(b) <= 0) throw new Error("Football LMSR liquidity must be positive.");
  const normalized = normalize(probabilities, keys);
  return Object.fromEntries(keys.map((key) => [key, Number(b) * Math.log(normalized[key])]));
}

export function normalizeProbabilityVector(values) {
  return normalize(values);
}

export { clamp };
