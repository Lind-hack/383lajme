import { driverStintTelemetry } from "./f1-stint-telemetry.mjs";
import { fetchF1RaceDistance } from "./f1-race-distance.mjs";
import { openf1Headers } from "./openf1-auth.mjs";
const BASE = "https://api.openf1.org/v1";
function latest(rows, key) {
  const map = new Map();
  for (const row of rows ?? []) {
    const id = row[key];
    if (id == null) continue;
    const old = map.get(id);
    if (!old || Date.parse(row.date ?? 0) >= Date.parse(old.date ?? 0)) map.set(id, row);
  }
  return map;
}
async function api(path, fetchImpl) {
  const response = await fetchImpl(`${BASE}/${path}`, {
    headers: await openf1Headers({ fetchImpl }), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`OpenF1 ${path}: ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`OpenF1 ${path}: invalid payload`);
  return rows;
}
export async function fetchOpenF1LiveRace({ now = new Date(), fetchImpl = fetch, requestGapMs = 360 } = {}) {
  const session = (await api("sessions?session_key=latest", fetchImpl))[0];
  if (!session || session.session_type !== "Race") return null;
  const start = Date.parse(session.date_start), end = Date.parse(session.date_end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || now.getTime() < start - 300000 || now.getTime() > end + 900000) return null;
  const distance = await fetchF1RaceDistance(session, { fetchImpl });
  const k = session.session_key;
  const feeds = {}, missing_inputs = [], provider_errors = [];
  // Identity and position are mandatory. Optional telemetry never invents data
  // and must not discard otherwise usable timing when one endpoint is down.
  for (const name of ["drivers", "position", "intervals", "stints", "laps", "weather", "race_control", "pit"]) {
    try {
      feeds[name] = await api(`${name}?session_key=${k}`, fetchImpl);
      if (!feeds[name].length) missing_inputs.push(name);
    } catch (error) {
      if (name === "drivers" || name === "position") throw error;
      feeds[name] = null;
      missing_inputs.push(name);
      provider_errors.push({ feed: name, error: error.message });
    }
    if (requestGapMs > 0) await new Promise(resolve => setTimeout(resolve, requestGapMs));
  }
  const positions = latest(feeds.position, "driver_number"), intervals = latest(feeds.intervals, "driver_number");
  const rows = feeds.drivers.map(driver => {
    const number = driver.driver_number;
    return {
      driver_number: number, driver_code: driver.name_acronym, driver: driver.full_name,
      team: driver.team_name, team_colour: driver.team_colour,
      position: positions.get(number)?.position ?? null,
      source_updated_at: positions.get(number)?.date ?? null,
      gap_to_leader: intervals.get(number)?.gap_to_leader ?? null,
      interval: intervals.get(number)?.interval ?? null,
      ...driverStintTelemetry(number, feeds.stints ?? [], feeds.laps ?? [], feeds.pit),
    };
  }).filter(row => row.position && row.driver_code).sort((a, b) => a.position - b.position);
  if (rows.length < 20) return null;
  if (!distance) missing_inputs.push("race_distance");
  const observedLaps = rows.map(row => row.lap).filter(Number.isFinite);
  return {
    ...distance, source_url: `${BASE}/sessions?session_key=${k}`, session, rows,
    lap: observedLaps.length ? Math.max(...observedLaps) : null,
    weather: feeds.weather?.at(-1) ?? null, race_control: feeds.race_control?.slice(-20) ?? [],
    missing_inputs, provider_errors,
  };
}
