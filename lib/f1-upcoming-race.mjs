import { buildF1RaceWinnerOpeningModel } from "./f1-pre-match.mjs";
import { DEFAULT_SPORT_LIQUIDITY } from "./tregu-liquidity.mjs";

const OPENF1 = "https://api.openf1.org/v1";
const clean = (value) => String(value ?? "").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(path, fetchImpl = fetch) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetchImpl(`${OPENF1}${path}`);
    if (response.ok) return response.json();
    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
      throw new Error(`OpenF1 ${path} request failed: ${response.status}`);
    }
    await sleep(800 * (attempt + 1));
  }
  throw new Error(`OpenF1 ${path} request failed after retries.`);
}

export function raceEventId(race) {
  const date = clean(race?.date_start).slice(0, 10);
  const place = clean(race?.circuit_short_name || race?.country_name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return date && place ? `f1-${date}-${place}` : null;
}

export function selectUpcomingRace(rows, { now = new Date(), leadDays = 3 } = {}) {
  const start = now.getTime();
  const limit = start + leadDays * 86_400_000;
  return (rows ?? [])
    .filter((row) => row?.session_type === "Race" && !row?.is_cancelled && Number.isFinite(Date.parse(row?.date_start)))
    .filter((row) => Date.parse(row.date_start) >= start && Date.parse(row.date_start) <= limit)
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0] ?? null;
}

export async function fetchUpcomingOpenF1Race({ now = new Date(), leadDays = 3, fetchImpl = fetch } = {}) {
  const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];
  const payloads = await Promise.all(years.map(async (year) => {
    try { return await fetchJson(`/sessions?year=${year}&session_name=Race`, fetchImpl); } catch (error) {
      if (/404/.test(String(error))) return [];
      throw error;
    }
  }));
  const race = selectUpcomingRace(payloads.flat(), { now, leadDays });
  return race ? { ...race, event_id: raceEventId(race), source_url: `${OPENF1}/sessions?year=${race.year}&session_name=Race` } : null;
}

export async function fetchOpenF1Roster({ sessionKey, fetchImpl = fetch } = {}) {
  if (!Number.isInteger(Number(sessionKey))) throw new Error("OpenF1 session key is required");
  const rows = await fetchJson(`/drivers?session_key=${sessionKey}`, fetchImpl);
  const seen = new Set();
  const roster = rows.map((driver) => ({
    key: clean(driver.name_acronym).toUpperCase(),
    driver_number: Number(driver.driver_number),
    label: clean(driver.full_name),
    team: clean(driver.team_name),
    team_colour: clean(driver.team_colour),
    headshot_url: clean(driver.headshot_url) || null,
  })).filter((driver) => /^[A-Z]{3}$/.test(driver.key) && Number.isInteger(driver.driver_number) && driver.label && !seen.has(driver.key) && (seen.add(driver.key), true));
  return roster.length >= 20 && roster.length <= 22 ? roster : [];
}

function driverKeyByNumber(roster) {
  return new Map((roster ?? []).map((driver) => [String(driver.driver_number), driver.key]));
}

function appendResults(target, rows, roster) {
  const keys = driverKeyByNumber(roster);
  const list = Array.isArray(rows) ? rows : Array.isArray(rows?.data) ? rows.data : [];
  for (const row of list) {
    const key = keys.get(String(row.driver_number));
    if (!key) continue;
    const invalid = row.dnf === true || row.dns === true || row.dsq === true;
    const position = Number(row.position);
    target[key] ??= [];
    target[key].push(invalid || !Number.isInteger(position) ? 23 : position);
  }
}

function makeThrottledJson(fetchImpl) {
  // Race discovery and roster loading happen immediately before this fetch;
  // start after a cool-down so the OpenF1 3-request/second limit is respected.
  let lastRequestAt = Date.now() + 650;
  return async (path) => {
    const wait = Math.max(0, 1_100 - (Date.now() - lastRequestAt));
    if (wait) await sleep(wait);
    const result = await fetchJson(path, fetchImpl);
    lastRequestAt = Date.now();
    return result;
  };
}

async function safeJson(path, getJson) {
  try { return await getJson(path); } catch { return []; }
}

/** Build only from verified OpenF1 standings/results; absent simulator data is reported, never guessed. */
export async function fetchF1OpeningFactors({ race, roster, now = new Date(), penalties = {}, signals = {}, fetchImpl = fetch } = {}) {
  if (!race?.meeting_key || !race?.year) throw new Error("OpenF1 race meeting is required for pre-race factors.");
  const getJson = makeThrottledJson(fetchImpl);
  const allRaces = await getJson(`/sessions?year=${race.year}&session_name=Race`);
  const pastRaces = allRaces.filter((session) => Date.parse(session.date_end) < now.getTime()).sort((a, b) => Date.parse(b.date_end) - Date.parse(a.date_end));
  const previousRace = pastRaces[0];
  if (!previousRace) throw new Error("No completed OpenF1 race is available for championship standings.");
  const championshipDrivers = await getJson(`/championship_drivers?session_key=${previousRace.session_key}`);
  const championshipTeams = await getJson(`/championship_teams?session_key=${previousRace.session_key}`);

  const recentResults = {};
  for (const session of pastRaces.slice(0, 3)) {
    appendResults(recentResults, await getJson(`/session_result?session_key=${session.session_key}`), roster);
    await sleep(350);
  }

  const circuitSessions = await safeJson(`/sessions?session_name=Race&circuit_short_name=${encodeURIComponent(race.circuit_short_name ?? "")}`, getJson);
  const circuitHistory = {};
  for (const session of circuitSessions.filter((item) => Date.parse(item.date_end) < Date.parse(race.date_start)).sort((a, b) => Date.parse(b.date_end) - Date.parse(a.date_end)).slice(0, 3)) {
    appendResults(circuitHistory, await getJson(`/session_result?session_key=${session.session_key}`), roster);
    await sleep(350);
  }

  const keys = driverKeyByNumber(roster);
  const meetingSessions = await safeJson(`/sessions?meeting_key=${race.meeting_key}`, getJson);
  const qualifyingSession = meetingSessions.find((session) => session.session_type === "Qualifying" && Date.parse(session.date_end) < now.getTime());
  const qualifying = {};
  if (qualifyingSession) {
    const results = await getJson(`/session_result?session_key=${qualifyingSession.session_key}`);
    for (const row of results ?? []) {
      const key = keys.get(String(row.driver_number));
      if (key && Number.isInteger(Number(row.position))) qualifying[key] = Number(row.position);
    }
  }

  // The published grid, which is qualifying with every penalty already served.
  // Reading it is how a penalty reaches the price without anyone having to
  // parse a stewards' bulletin: OpenF1 applies the drop, and the opening model
  // treats where a driver actually starts as the dominant term. Absent before
  // the grid is set, which is what the penalties argument covers in the window
  // between the announcement and the sheet.
  const grid = {};
  const gridRows = await safeJson(`/starting_grid?session_key=${race.session_key}`, getJson);
  for (const row of gridRows ?? []) {
    const key = keys.get(String(row.driver_number));
    if (key && Number.isInteger(Number(row.position))) grid[key] = Number(row.position);
  }

  const sourceUrls = [
    `${OPENF1}/championship_drivers?session_key=${previousRace.session_key}`,
    `${OPENF1}/championship_teams?session_key=${previousRace.session_key}`,
    ...pastRaces.slice(0, 3).map((session) => `${OPENF1}/session_result?session_key=${session.session_key}`),
  ];
  if (qualifyingSession) sourceUrls.push(`${OPENF1}/session_result?session_key=${qualifyingSession.session_key}`);
  if (Object.keys(grid).length) sourceUrls.push(`${OPENF1}/starting_grid?session_key=${race.session_key}`);
  if (circuitSessions.length) sourceUrls.push(`${OPENF1}/sessions?session_name=Race&circuit_short_name=${encodeURIComponent(race.circuit_short_name ?? "")}`);
  const openingModel = buildF1RaceWinnerOpeningModel({
    roster,
    championshipDrivers,
    championshipTeams,
    recentResults,
    circuitHistory,
    qualifying,
    grid,
    penalties,
    signals,
    simulator: null,
    sources: sourceUrls.map((url) => ({ provider: "OpenF1", url, fetched_at: now.toISOString() })),
  });
  return { ...openingModel, previous_race_session_key: previousRace.session_key, qualifying_session_key: qualifyingSession?.session_key ?? null };
}

function quantities(probabilities, b = DEFAULT_SPORT_LIQUIDITY) {
  return Object.fromEntries(Object.entries(probabilities).map(([key, value]) => [key, b * Math.log(Number(value))]));
}

export function buildUpcomingF1MarketTemplate({ race, roster, openingModel, now = new Date() }) {
  const drivers = Array.isArray(roster) ? roster : [];
  if (!race?.event_id || drivers.length < 20 || drivers.length > 22) throw new Error("A verified OpenF1 race and 20-22 driver roster are required");
  if (!openingModel?.probabilities || Object.keys(openingModel.probabilities).length !== drivers.length) throw new Error("Verified F1 opening probabilities are required; equal fallback is forbidden.");
  const closesAt = new Date(race.date_start);
  const date = closesAt.toISOString().slice(0, 10);
  const outcomeKeys = drivers.map((driver) => driver.key);
  const probabilities = Object.fromEntries(outcomeKeys.map((key) => [key, Number(openingModel.probabilities[key])]));
  const sportOutcomes = drivers.map((driver) => ({
    key: driver.key,
    driver_number: driver.driver_number,
    label: driver.label,
    team: driver.team,
    team_colour: driver.team_colour,
    headshot_url: driver.headshot_url,
    grid_position: openingModel.inputs?.[driver.key]?.qualifying_position ?? null,
  }));
  return {
    slug: `f1-race-winner-${race.event_id}`,
    question: `Kush fiton ${race.circuit_short_name || race.country_name} ${race.year}?`,
    description: "Tregu fituesi F1 me një rezultat për çdo pilot të konfirmuar nga OpenF1. Gjasat nisin nga standings, formë, histori të pistës dhe kualifikimi vetëm kur këto të dhëna janë të verifikuara.",
    category: "Sport",
    status: "draft",
    market_type: "f1_race_winner",
    market_classification: "live_f1",
    b: DEFAULT_SPORT_LIQUIDITY,
    closes_at: closesAt.toISOString(),
    outcomes: outcomeKeys,
    sport_outcomes: sportOutcomes,
    outcome_quantities: quantities(probabilities),
    reference_probabilities: probabilities,
    live_event: {
      event_id: race.event_id,
      provider: "formula1_dashboard",
      openf1_session_key: race.session_key,
      openf1_meeting_key: race.meeting_key,
      openf1_race_source: race.source_url,
      race_start: race.date_start,
      circuit_short_name: race.circuit_short_name ?? null,
      country_name: race.country_name ?? null,
      created_from: "openf1_3_day_scheduler",
      created_at: now.toISOString(),
      pre_match_model_version: openingModel.model_version,
    },
    pre_match_analysis: {
      source: "OpenF1",
      opening_model: openingModel,
      race,
      created_by: "upcoming_f1_template",
    },
  };
}
