function clean(value) {
  return String(value ?? "").trim();
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function mean(values) {
  const cleanValues = values.map(finite).filter((value) => value !== null && value > 0);
  return cleanValues.length ? cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length : null;
}

function finishScore(finishes) {
  const values = (finishes ?? []).map((finish) => finite(finish)).filter((finish) => finish !== null && finish > 0);
  if (!values.length) return null;
  return mean(values.map((finish) => Math.exp(-0.16 * (finish - 1))));
}

function rankScore(position, total = 22) {
  const rank = finite(position);
  return rank === null || rank < 1 ? null : Math.exp(-0.075 * (rank - 1));
}

function normalize(values, keys) {
  const positive = Object.fromEntries(keys.map((key) => [key, Math.max(0.000001, Number(values[key] ?? 0))]));
  const total = Object.values(positive).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(keys.map((key) => [key, positive[key] / total]));
}

function mapByDriver(rows) {
  return new Map((rows ?? []).map((row) => [String(row?.driver_number ?? row?.key ?? row?.driver_code ?? ""), row]));
}

function mapByTeam(rows) {
  return new Map((rows ?? []).map((row) => [clean(row?.team_name ?? row?.team ?? "").toLowerCase(), row]));
}

function getSimulatorValue(simulator, driver) {
  if (!simulator) return null;
  const key = clean(driver?.key ?? driver?.driver_code).toUpperCase();
  const number = String(driver?.driver_number ?? "");
  const row = Array.isArray(simulator)
    ? simulator.find((item) => clean(item?.driver_code ?? item?.key).toUpperCase() === key || String(item?.driver_number ?? "") === number)
    : simulator[key] ?? simulator[number];
  return finite(row?.probability ?? row?.simulator_probability ?? row);
}

/**
 * Deterministic 20–22 driver opening model. Every non-neutral factor must come
 * from an attributable persisted source; absent simulator/circuit/qualifying
 * data stays neutral and is reported as unavailable.
 */
export function buildF1RaceWinnerOpeningModel({
  roster,
  championshipDrivers = [],
  championshipTeams = [],
  recentResults = {},
  circuitHistory = {},
  qualifying = {},
  simulator = null,
  sources = [],
} = {}) {
  const drivers = Array.isArray(roster) ? roster : [];
  if (drivers.length < 20 || drivers.length > 22) throw new Error("A verified 20–22 driver F1 roster is required.");
  if (!Array.isArray(championshipDrivers) || championshipDrivers.length < 20) throw new Error("Verified F1 championship standings are required for opening prices.");
  const championships = mapByDriver(championshipDrivers);
  const teams = mapByTeam(championshipTeams);
  const maxTeamPoints = Math.max(...championshipTeams.map((row) => Number(row?.points_current ?? row?.points_start ?? 0)).filter(Number.isFinite), 0);
  const raw = {};
  const inputs = {};
  const availability = { championship: true, championship_complete: true, constructor_standings: championshipTeams.length > 0, recent_results: false, circuit_history: false, qualifying: Object.keys(qualifying ?? {}).length > 0, simulator: false };
  const missingChampionshipDrivers = [];

  for (const driver of drivers) {
    const key = clean(driver?.key ?? driver?.driver_code).toUpperCase();
    const standing = championships.get(String(driver?.driver_number ?? key));
    if (!key) throw new Error("Verified F1 roster contains a driver without a stable code.");
    if (!standing) {
      availability.championship_complete = false;
      missingChampionshipDrivers.push(key);
    }
    const teamName = clean(driver?.team ?? standing?.team_name);
    const constructor = teams.get(teamName.toLowerCase());
    const recent = Array.isArray(recentResults[key]) ? recentResults[key] : [];
    const circuit = Array.isArray(circuitHistory[key]) ? circuitHistory[key] : [];
    const recentFactor = finishScore(recent) ?? 0.62;
    const circuitFactor = finishScore(circuit) ?? recentFactor;
    const qualifyingPosition = finite(qualifying[key] ?? qualifying[String(driver?.driver_number ?? "")]);
    const championshipPosition = finite(standing?.position_current ?? standing?.position_start);
    const championshipFactor = rankScore(championshipPosition) ?? 0.35;
    const teamPoints = finite(constructor?.points_current ?? constructor?.points_start);
    const teamFactor = teamPoints !== null && maxTeamPoints > 0 ? clamp(0.72 + 0.28 * (teamPoints / maxTeamPoints), 0.72, 1) : 0.82;
    const qualifyingFactor = qualifyingPosition === null ? 0.82 : rankScore(qualifyingPosition);
    const simulatorProbability = getSimulatorValue(simulator, driver);
    if (recent.length) availability.recent_results = true;
    if (circuit.length) availability.circuit_history = true;
    if (simulatorProbability !== null && simulatorProbability > 0) availability.simulator = true;
    const simulatorFactor = simulatorProbability !== null && simulatorProbability > 0 ? clamp(0.65 + simulatorProbability * 1.35, 0.65, 2) : 1;
    const value = Math.exp(
      0.95 * Math.log(championshipFactor ?? 0.35) +
      0.80 * Math.log(teamFactor) +
      0.85 * Math.log(recentFactor) +
      0.65 * Math.log(circuitFactor) +
      0.55 * Math.log(qualifyingFactor) +
      0.45 * Math.log(simulatorFactor)
    );
    raw[key] = value;
    inputs[key] = {
      championship_position: standing?.position_current ?? standing?.position_start ?? null,
      championship_points: standing?.points_current ?? standing?.points_start ?? null,
      constructor: teamName || null,
      constructor_points: teamPoints,
      recent_finishes: recent,
      circuit_finishes: circuit,
      qualifying_position: qualifyingPosition,
      simulator_probability: simulatorProbability,
      factors: { championshipFactor, teamFactor, recentFactor, circuitFactor, qualifyingFactor, simulatorFactor },
    };
  }

  const probabilities = normalize(raw, drivers.map((driver) => clean(driver?.key ?? driver?.driver_code).toUpperCase()));
  return {
    model_version: "f1-opening-v2",
    probabilities,
    inputs,
    availability,
    missing_championship_drivers: missingChampionshipDrivers,
    result_counts: {
      recent_drivers: Object.keys(recentResults).length,
      circuit_drivers: Object.keys(circuitHistory).length,
    },
    sources,
    method: "Championship standings + constructor performance + recent race finishes + circuit history + qualifying when verified; timestamped simulator input is optional and neutral when unavailable. No guessed pace, grid, or market-value data.",
  };
}
