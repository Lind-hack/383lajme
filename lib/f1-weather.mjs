const cache = new Map();
const agent = '383Tregu/1.0 (https://383lajme.vercel.app)';
const json = async (url, fetchImpl) => {
  const response = await fetchImpl(url, { headers: { 'User-Agent': agent }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Weather source HTTP ${response.status}`);
  return response.json();
};

export function raceForecast(payload, start, now = new Date()) {
  const issued = payload?.properties?.meta?.updated_at;
  if (!Number.isFinite(Date.parse(issued)) || Date.parse(issued) > now.getTime() + 300000 || now.getTime() - Date.parse(issued) > 12 * 3600000) return null;
  const at = Date.parse(start);
  const hours = (payload?.properties?.timeseries ?? []).filter(row => {
    const time = Date.parse(row.time);
    return time >= at - 3600000 && time <= at + 3 * 3600000;
  }).map(row => ({ time: row.time,
    precipitation_mm: row.data?.next_1_hours?.details?.precipitation_amount ?? null,
    temperature_c: row.data?.instant?.details?.air_temperature ?? null,
    wind_ms: row.data?.instant?.details?.wind_speed ?? null,
  }));
  if (!hours.length) return null;
  return { issued_at: issued, hours, kind: 'forecast', provider: 'MET Norway', attribution_url: 'https://www.met.no/',
    rain_expected: hours.some(row => Number(row.precipitation_mm) > 0),
    precipitation_complete: hours.every(row => row.precipitation_mm !== null) };
}

/** Exact scheduled race date supplies circuit coordinates; no city-name guessing. */
export async function fetchF1Forecast(race, { now = new Date(), fetchImpl = fetch } = {}) {
  const start = race?.date_start ?? race?.race_start;
  const key = String(start);
  const prior = cache.get(key);
  if (prior && now.getTime() - prior.at < 30 * 60000) return prior.value;
  let raceName = race?.race_name ?? race?.raceName ?? null;
  try {
    const scheduleUrl = `https://api.jolpi.ca/ergast/f1/${new Date(start).getUTCFullYear()}.json`;
    const schedule = await json(scheduleUrl, fetchImpl);
    const matches = (schedule?.MRData?.RaceTable?.Races ?? []).filter(row => row.date === String(start).slice(0, 10));
    if (matches.length !== 1) throw new Error('Exact circuit coordinates unavailable');
    raceName = matches[0].raceName ?? raceName;
    const location = matches[0].Circuit?.Location;
    const lat = Number(location?.lat), lon = Number(location?.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('Invalid circuit coordinates');
    const sourceUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
    const forecast = raceForecast(await json(sourceUrl, fetchImpl), start, now);
    const value = forecast ? { ...forecast, race_name: matches[0].raceName, source_url: sourceUrl, coordinate_source: scheduleUrl, latitude: lat, longitude: lon } : { race_name: matches[0].raceName, unavailable: 'No fresh hourly forecast covers this race' };
    cache.set(key, { at: now.getTime(), value });
    return value;
  } catch (error) { return { race_name: raceName, unavailable: error.message }; }
}
