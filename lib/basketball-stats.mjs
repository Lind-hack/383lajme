const COUNTS = new Map([
  ["assists", "assists"], ["totalRebounds", "rebounds"],
  ["offensiveRebounds", "offensive_rebounds"], ["defensiveRebounds", "defensive_rebounds"],
  ["steals", "steals"], ["blocks", "blocks"], ["turnovers", "turnovers"],
]);
const SHOTS = new Map([
  ["fieldGoalsMade-fieldGoalsAttempted", "field_goals"],
  ["threePointFieldGoalsMade-threePointFieldGoalsAttempted", "three_pointers"],
  ["freeThrowsMade-freeThrowsAttempted", "free_throws"],
]);

/** ESPN shooting pairs are made-attempted, not a single numeric observation. */
export function basketballStats(statistics = []) {
  const result = {};
  for (const stat of statistics) {
    const value = String(stat.displayValue ?? stat.value ?? "").trim();
    const count = COUNTS.get(stat.name);
    if (count && /^\d+$/.test(value)) result[count] = Number(value);
    const shots = SHOTS.get(stat.name);
    const pair = shots && value.match(/^(\d+)\s*-\s*(\d+)$/);
    if (pair && Number(pair[1]) <= Number(pair[2])) {
      result[`${shots}_made`] = Number(pair[1]);
      result[`${shots}_attempted`] = Number(pair[2]);
    }
  }
  for (const kind of ["made", "attempted"]) {
    const total = result[`field_goals_${kind}`], threes = result[`three_pointers_${kind}`];
    if (Number.isFinite(total) && Number.isFinite(threes) && total >= threes) result[`two_pointers_${kind}`] = total - threes;
  }
  return result;
}

const DISPLAY = [
  ["points", "Pikët"], ["field_goals_attempted", "Gjuajtjet totale"],
  ["two_pointers_made", "Dy-pikëshe të shënuara"], ["three_pointers_made", "Tre-pikëshe të shënuara"],
  ["two_pointers_attempted", "Tentime për dy pikë"], ["three_pointers_attempted", "Tentime për tre pikë"],
  ["free_throws_made", "Gjuajtje të lira të shënuara"], ["free_throws_attempted", "Tentime të lira"],
  ["assists", "Asistimet"], ["rebounds", "Kërcimet"], ["offensive_rebounds", "Kërcime sulmuese"],
  ["defensive_rebounds", "Kërcime mbrojtëse"], ["steals", "Topa të vjedhur"],
  ["blocks", "Bllokimet"], ["turnovers", "Topa të humbur"],
];

export function buildBasketballMetricRows(home = {}, away = {}) {
  const supplied = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
  return DISPLAY.flatMap(([key, label]) => {
    const hasHome = supplied(home[key]), hasAway = supplied(away[key]);
    if (!hasHome && !hasAway) return [];
    return [{ label, home: hasHome ? home[key] : 0, away: hasAway ? away[key] : 0,
      homeText: hasHome ? undefined : "—", awayText: hasAway ? undefined : "—" }];
  });
}
