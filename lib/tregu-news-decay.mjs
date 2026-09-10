/** Linear survival above a floor; splitting an interval produces the same target. */
export function elapsedDeadlineTarget({ probability, previousAt, now, deadline, floor = .05 }) {
  const previous = new Date(previousAt).getTime(), current = new Date(now).getTime(), end = new Date(deadline).getTime();
  if (![probability, floor, previous, current, end].every(Number.isFinite) || floor < 0 || floor >= 1 || probability < 0 || probability > 1) throw new Error("Invalid deadline decay inputs");
  if (current <= previous || probability <= floor) return probability;
  if (end <= previous) return probability;
  return floor + (probability - floor) * Math.max(0, Math.min(1, (end - current) / (end - previous)));
}
