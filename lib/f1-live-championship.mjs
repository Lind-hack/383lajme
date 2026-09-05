/**
 * What the race running right now is doing to the title.
 *
 * fetchOpenF1ChampionshipContext splits the season in two: races whose
 * date_end has passed are `completed` and feed the standings, races whose
 * date_start is still ahead are `upcoming` and get simulated. A race in
 * progress is in neither. For the two hours that most decide a championship,
 * the championship market was the only thing on the floor not reacting to it —
 * a driver could take twenty-five points off his rival's lead and the title
 * odds would not move until the classification was published.
 *
 * This projects the race as it currently stands onto the standings: the order
 * on track, scored, added to the points each driver already has. It is a
 * projection and not a prediction — nobody is forecasting the finish here, the
 * Monte Carlo over the remaining races already carries that uncertainty. It
 * simply stops the book pretending the race is not happening.
 *
 * Because the in-progress race is absent from `upcoming`, adding it here
 * cannot double-count it.
 */

/** Points for finishing positions, current regulations. */
export const RACE_POINTS = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };
export const SPRINT_POINTS = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Points each driver would score if the race ended in its current order.
 * Keyed by driver_number, which is what the standings rows are keyed by.
 */
export function projectLiveRacePoints(liveRace) {
  const rows = Array.isArray(liveRace?.rows) ? liveRace.rows : [];
  const sprint = /sprint/i.test(String(liveRace?.session?.session_name ?? liveRace?.session?.session_type ?? ""));
  const table = sprint ? SPRINT_POINTS : RACE_POINTS;
  const projected = {};
  for (const row of rows) {
    const driverNumber = number(row?.driver_number);
    const position = number(row?.position);
    if (driverNumber === null || position === null || position < 1) continue;
    projected[driverNumber] = table[position] ?? 0;
  }
  return projected;
}

/**
 * Standings with the running race folded in, re-ranked on the projected total.
 *
 * Positions are recomputed rather than carried over: the model reads
 * position_current as a rank factor, and a table whose points and positions
 * disagree is worse than either on its own. Ties keep the leader's prior
 * standing, so a driver never overtakes another on a coin toss.
 */
export function applyLiveRaceProjection(standings, projected) {
  const rows = Array.isArray(standings) ? standings : [];
  if (!rows.length || !projected || !Object.keys(projected).length) {
    return { standings: rows, applied: 0, added: {} };
  }

  const added = {};
  const merged = rows.map((row) => {
    const driverNumber = number(row?.driver_number);
    const gain = driverNumber === null ? 0 : Number(projected[driverNumber] ?? 0);
    const base = Number(row?.points_current ?? row?.points_start ?? 0);
    if (gain > 0 && driverNumber !== null) added[driverNumber] = gain;
    return { ...row, points_current: base + gain, points_projected_from_live: gain || 0 };
  });

  const priorPosition = new Map(
    rows.map((row) => [number(row?.driver_number), number(row?.position_current ?? row?.position_start) ?? 99])
  );
  const ranked = [...merged].sort((a, b) => {
    const points = Number(b.points_current ?? 0) - Number(a.points_current ?? 0);
    if (points !== 0) return points;
    return (priorPosition.get(number(a.driver_number)) ?? 99) - (priorPosition.get(number(b.driver_number)) ?? 99);
  });
  const positionByDriver = new Map(ranked.map((row, index) => [number(row.driver_number), index + 1]));

  return {
    standings: merged.map((row) => ({
      ...row,
      position_current: positionByDriver.get(number(row.driver_number)) ?? row.position_current,
    })),
    applied: Object.keys(added).length,
    added,
  };
}

/**
 * Whether this live payload is worth projecting at all.
 *
 * A formation lap has an order but no result in it, and the opening laps of a
 * race are a poor guide to anything. Two racing laps is the point where the
 * order carries information; before that the standings are left alone.
 */
export function liveRaceIsProjectable(liveRace, { minLap = 2 } = {}) {
  if (!liveRace || !Array.isArray(liveRace.rows) || liveRace.rows.length < 10) return false;
  const type = String(liveRace.session?.session_type ?? "");
  if (type && !/race/i.test(type)) return false;
  return (number(liveRace.lap) ?? 0) >= minLap;
}
