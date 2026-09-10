/** Select by lap/stint number: OpenF1 stint rows do not carry a `date`. */
export function driverStintTelemetry(driverNumber, stints = [], laps = [], pits = null) {
  const driverLaps = laps.filter(row => row.driver_number === driverNumber)
    .sort((a, b) => Number(a.lap_number) - Number(b.lap_number));
  const latestLap = driverLaps.at(-1) ?? null;
  const lapNumber = latestLap?.lap_number ?? null;
  const driverStints = stints.filter(row => row.driver_number === driverNumber && Number(row.lap_start) <= Number(lapNumber))
    .sort((a, b) => Number(a.stint_number) - Number(b.stint_number));
  const stint = driverStints.at(-1) ?? null;
  const stops = Array.isArray(pits) ? pits.filter(row => row.driver_number === driverNumber && Number(row.lap_number) <= Number(lapNumber)) : null;
  const pitLaps = new Set((stops ?? []).map(row => Number(row.lap_number)));
  const times = driverLaps.filter(row => !row.is_pit_out_lap && !pitLaps.has(Number(row.lap_number)) && Number(row.lap_duration) > 40)
    .slice(-5).map(row => Number(row.lap_duration)).sort((a, b) => a - b);
  return {
    lap: lapNumber, lap_duration: latestLap?.lap_duration ?? null,
    tyre: stint?.compound ?? null, stint: stint?.stint_number ?? null,
    tyre_age: stint && stint.tyre_age_at_start != null && lapNumber != null
      ? Number(stint.tyre_age_at_start) + Math.max(0, Number(lapNumber) - Number(stint.lap_start)) : null,
    pits: stops === null ? null : new Set(stops.map(row => `${row.lap_number}:${row.date}`)).size,
    pit_stops: stops,
    recent_pace: times.length >= 3 ? times[Math.floor(times.length / 2)] : null,
  };
}
