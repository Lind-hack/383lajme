const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};

/** Estimated net stop loss from in/out laps, not pit-lane duration. */
export function estimateStopScenarios(driver, stints, laps, pits, totalLaps) {
  const own = laps.filter(row => row.driver_number === driver).sort((a,b) => a.lap_number-b.lap_number);
  const currentLap = own.at(-1)?.lap_number;
  const current = stints.filter(row => row.driver_number === driver && row.lap_start <= currentLap).sort((a,b) => a.stint_number-b.stint_number).at(-1);
  const stops = pits?.filter(row => row.driver_number === driver && row.lap_number <= currentLap);
  if (!current || !stops || !(totalLaps > currentLap)) return { available: false, missing: 'stint, pit history or remaining distance' };
  const stopLaps = new Set(stops.map(row => row.lap_number));
  const clean = own.filter(row => row.lap_number >= current.lap_start && !row.is_pit_out_lap && !stopLaps.has(row.lap_number) && row.lap_duration > 40).slice(-8);
  if (clean.length < 5) return { available: false, missing: 'five clean current-stint laps' };
  const slopes = [];
  for (let i=0;i<clean.length;i++) for (let j=i+1;j<clean.length;j++) {
    if (clean[j].lap_number > clean[i].lap_number) slopes.push((clean[j].lap_duration-clean[i].lap_duration)/(clean[j].lap_number-clean[i].lap_number));
  }
  const trend = Math.max(0, Math.min(0.5, median(slopes) ?? 0));
  const stopLosses = [];
  for (const stop of pits ?? []) {
    const before = laps.filter(row => row.driver_number === stop.driver_number && row.lap_number < stop.lap_number && row.lap_number >= stop.lap_number-3 && !row.is_pit_out_lap).map(row => row.lap_duration);
    const baseline = median(before);
    const inLap = laps.find(row => row.driver_number === stop.driver_number && row.lap_number === stop.lap_number)?.lap_duration;
    const outLap = laps.find(row => row.driver_number === stop.driver_number && row.lap_number === stop.lap_number+1)?.lap_duration;
    if (baseline > 40 && inLap > 40 && outLap > 40) {
      const loss = inLap + outLap - 2*baseline;
      if (loss > 5 && loss < 80) stopLosses.push(loss);
    }
  }
  const loss = median(stopLosses);
  if (loss === null) return { available: false, missing: 'observed net pit-stop loss', pace_trend_seconds_per_lap: trend };
  const completed = new Set(stops.map(row => `${row.lap_number}:${row.date}`)).size;
  const remaining = totalLaps-currentLap;
  const scenarios = [1,2,3].filter(total => total >= completed).map(total => {
    const extra = total-completed;
    const stintLength = remaining/(extra+1);
    return { total_stops: total, additional_stops: extra,
      estimated_extra_seconds: extra*loss + trend*(extra+1)*stintLength*(stintLength-1)/2 };
  });
  return { available:true, kind:'estimate', completed_stops:completed, remaining_laps:remaining,
    pace_trend_seconds_per_lap:trend, net_stop_loss_seconds:loss, stop_samples:stopLosses.length, scenarios,
    limitations:'Equal future stint lengths and unchanged compound assumed. Pace trend includes fuel, traffic and weather; tyre allocation and neutralisations are not predicted. Not an announced strategy.' };
}
