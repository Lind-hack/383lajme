// What a live race looks like across refreshes, not just in one frame.
//
// A single timing snapshot cannot tell an undercut from a slow stop, or a
// leader who has not pitted yet from one who is safely clear: both need the
// frame before. The previous frame's memory rides in the market's
// live_score_state, so each refresh reads it, folds the new leaderboard in, and
// writes it back. Everything here is pure; nothing is fetched.

// Pit-lane loss when a driver still owes a stop. Street circuits and long pit
// lanes run 19-24s; a race can override it with live_event.pit_loss_seconds.
export const DEFAULT_PIT_LOSS_SECONDS = 21;
// Two cars this close before a stop are racing each other through the stops.
const BATTLE_WINDOW_SECONDS = 3.5;
// A rival who has not answered a stop in this many laps is on another strategy.
const BATTLE_EXPIRY_LAPS = 12;
// How long a settled undercut or overcut stays on the card.
const RESULT_SHOW_LAPS = 5;
const PACE_ALPHA = 0.35;
const GAP_HISTORY = 8;

export function gapToSeconds(gap) {
  const text = String(gap ?? "").trim().toUpperCase();
  if (!text || text === "LEADER") return 0;
  const laps = text.match(/^\+?(\d+)\s*LAPS?$/);
  if (laps) return 90 * Number(laps[1]);
  const parts = text.replace(/^\+/, "").split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

export function lapTimeToSeconds(value) {
  const match = String(value ?? "").trim().match(/^(?:(\d+):)?(\d{1,2}(?:\.\d+)?)$/);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 60 + Number(match[2]);
  return seconds > 30 && seconds < 400 ? seconds : null;
}

function roundTenth(value) { return Math.round(value * 10) / 10; }

function stopsLabel(count) {
  if (!Number.isInteger(count)) return null;
  return count === 0 ? "pa ndalesë" : count === 1 ? "1 ndalesë" : `${count} ndalesa`;
}

/**
 * Folds one leaderboard into the running memory.
 *
 * rows: the parsed leaderboard ({ driver_code, position, gap, laps, pits,
 * in_pit, last_lap, status }). race: { current_lap, total_laps, safety_car }.
 * Returns the memory to persist and the per-driver view the model and the card
 * read: adjusted gap, virtual position, laps left, and one reason line each.
 */
export function advanceRaceMemory(previous, { rows, race, wet = false, pitLossSeconds = DEFAULT_PIT_LOSS_SECONDS }) {
  const prev = previous?.v === 1 ? previous : { v: 1, drivers: {}, battles: [] };
  const neutralised = Boolean(race?.safety_car);
  const leaderLaps = Math.max(0, ...rows.map((row) => (Number.isInteger(row.laps) ? row.laps : 0)));
  const lap = Number.isInteger(race?.current_lap) ? race.current_lap : leaderLaps > 0 ? leaderLaps + 1 : null;
  const total = Number(race?.total_laps) > 0 ? Number(race.total_laps) : null;
  const lapsLeft = total && lap ? Math.max(0, total - Math.max(leaderLaps, lap - 1)) : null;

  const clean = rows.map((row) => lapTimeToSeconds(row.last_lap)).filter(Number.isFinite);
  const fastest = clean.length ? Math.min(...clean) : null;

  const drivers = {};
  const newStops = [];
  for (const row of rows) {
    const code = String(row.driver_code ?? "").toUpperCase();
    if (!code) continue;
    const before = prev.drivers?.[code] ?? { pits: 0, pit_laps: [], pace: null, laps: null, gaps: [] };
    // The dashboard shows "IN PIT" instead of the count while a car is in the
    // lane, so the count is carried and the stop is booked on entry.
    let pits = Number.isInteger(row.pits) ? row.pits : before.pits ?? 0;
    if (row.in_pit && pits <= (before.pits ?? 0) && !before.in_pit) pits = (before.pits ?? 0) + 1;
    pits = Math.max(pits, before.pits ?? 0);
    const pitLaps = [...(before.pit_laps ?? [])];
    // The gap before the stop, kept while the car is in the lane: the screen
    // lags the loss, so a car mid-stop is priced from here, not from the
    // stale gap it still shows.
    const preStopGap = row.in_pit ? before.pre_stop_gap ?? before.gap ?? null : null;
    if (pits > (before.pits ?? 0)) {
      for (let stop = (before.pits ?? 0) + 1; stop <= pits; stop++) pitLaps.push(lap);
      newStops.push({ code, stop: pits });
    }

    const lapTime = lapTimeToSeconds(row.last_lap);
    const newLap = Number.isInteger(row.laps) && row.laps !== before.laps;
    const cleanLap = newLap && lapTime && fastest && lapTime < fastest * 1.07 && !row.in_pit && !neutralised && !(pits > (before.pits ?? 0));
    const pace = cleanLap ? (before.pace == null ? lapTime : before.pace + PACE_ALPHA * (lapTime - before.pace)) : before.pace ?? null;

    const gap = gapToSeconds(row.position === 1 ? "LEADER" : row.gap);
    const gaps = [...(before.gaps ?? []), [lap, gap]].slice(-GAP_HISTORY);
    drivers[code] = { pits, pit_laps: pitLaps, pre_stop_gap: preStopGap, pace: pace == null ? null : Number(pace.toFixed(3)), laps: Number.isInteger(row.laps) ? row.laps : before.laps ?? null, in_pit: Boolean(row.in_pit), gap, gaps };
  }

  // Opens a battle for every new stop against the cars it was racing: within
  // the window beforehand and not yet stopped this many times.
  const battles = (prev.battles ?? []).map((battle) => ({ ...battle }));
  for (const { code, stop } of newStops) {
    const mineBefore = prev.drivers?.[code]?.gap;
    if (!Number.isFinite(mineBefore)) continue;
    for (const [rival, state] of Object.entries(prev.drivers ?? {})) {
      if (rival === code || !Number.isFinite(state?.gap)) continue;
      if ((drivers[rival]?.pits ?? state.pits ?? 0) >= stop) continue;
      if (Math.abs(state.gap - mineBefore) > BATTLE_WINDOW_SECONDS) continue;
      if (battles.some((b) => b.first === code && b.second === rival && b.stop === stop)) continue;
      battles.push({ first: code, second: rival, stop, lap, first_ahead_before: mineBefore < state.gap, status: "open" });
    }
  }

  for (const battle of battles) {
    if (battle.status !== "open") continue;
    const first = drivers[battle.first];
    const second = drivers[battle.second];
    if (!first || !second) { battle.status = "gone"; continue; }
    if (lap && battle.lap && lap - battle.lap > BATTLE_EXPIRY_LAPS && second.pits < battle.stop) { battle.status = "split"; continue; }
    if (second.pits < battle.stop || first.in_pit || second.in_pit) continue;
    if (!Number.isFinite(first.gap) || !Number.isFinite(second.gap)) continue;
    const firstAheadNow = first.gap < second.gap;
    battle.resolved_lap = lap;
    battle.margin = roundTenth(Math.abs(second.gap - first.gap));
    if (firstAheadNow && !battle.first_ahead_before) battle.status = "undercut";
    else if (!firstAheadNow && battle.first_ahead_before) battle.status = "overcut";
    else battle.status = "held";
  }
  const liveBattles = battles.filter((battle) =>
    battle.status === "open" ||
    ((battle.status === "undercut" || battle.status === "overcut") && lap && battle.resolved_lap && lap - battle.resolved_lap <= RESULT_SHOW_LAPS));

  // A dry race needs two compounds, so a car that has not stopped still owes
  // the pit lane. Counting it now is what stops the timing screen's order
  // from pricing a leader who is about to lose twenty seconds as if he were not.
  const loss = pitLossSeconds * (neutralised ? 0.5 : 1);
  const view = {};
  for (const row of rows) {
    const code = String(row.driver_code ?? "").toUpperCase();
    const memory = drivers[code];
    if (!memory) continue;
    const owes = !wet && memory.pits === 0 && !memory.in_pit && (lapsLeft == null || lapsLeft > 0) ? 1 : 0;
    const gap = Number.isFinite(memory.gap) ? memory.gap : null;
    const inLane = memory.in_pit && Number.isFinite(memory.pre_stop_gap) ? memory.pre_stop_gap + loss : null;
    const adjusted = gap == null ? null : Math.max(gap + owes * loss, inLane ?? -Infinity);
    view[code] = { code, position: row.position, gap, owes_stop: owes === 1, adjusted_gap: adjusted, pits: memory.pits, in_pit: memory.in_pit, pace: memory.pace, status: row.status ?? null };
  }
  const ordered = Object.values(view).filter((driver) => driver.adjusted_gap != null).sort((a, b) => a.adjusted_gap - b.adjusted_gap);
  const base = ordered[0]?.adjusted_gap ?? 0;
  ordered.forEach((driver, index) => { driver.virtual_position = index + 1; driver.adjusted_gap = Number((driver.adjusted_gap - base).toFixed(3)); });

  const byPosition = Object.values(view).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  for (const driver of Object.values(view)) driver.reason = reasonLine(driver, byPosition, liveBattles);

  return {
    memory: { v: 1, drivers, battles: liveBattles },
    view,
    lap,
    laps_left: lapsLeft,
    total_laps: total,
  };
}

function reasonLine(driver, byPosition, battles) {
  const code = driver.code;
  if (/DNF|DNS|DSQ|RETIRED|OUT/i.test(String(driver.status ?? ""))) return "Jashtë gare";
  if (/PENALTY|STOP.?GO|DRIVE.?THROUGH/i.test(String(driver.status ?? ""))) return "Penalizim nga gjyqtarët";
  if (driver.in_pit) return "Në boks tani";

  const settled = battles.filter((b) => b.status === "undercut" || b.status === "overcut");
  const won = settled.find((b) => (b.status === "undercut" ? b.first : b.second) === code);
  if (won) {
    const rival = won.status === "undercut" ? won.second : won.first;
    return `${won.status === "undercut" ? "Undercut" : "Overcut"} ndaj ${rival} (+${won.margin.toFixed(1)}s)`;
  }
  const lost = settled.find((b) => (b.status === "undercut" ? b.second : b.first) === code);
  if (lost) return `Humbi vendin nga ${lost.status} i ${lost.status === "undercut" ? lost.first : lost.second}`;
  const attempting = battles.find((b) => b.status === "open" && b.first === code && !b.first_ahead_before);
  if (attempting) return `Tenton undercut ndaj ${attempting.second}`;
  const underThreat = battles.find((b) => b.status === "open" && b.second === code && b.first_ahead_before === false);
  if (underThreat) return `Rrezik undercut nga ${underThreat.first}`;
  // The car ahead stopped first; staying out on the older tyre is the overcut.
  const overcutting = battles.find((b) => b.status === "open" && b.second === code && b.first_ahead_before === true);
  if (overcutting) return `Tenton overcut ndaj ${overcutting.first}`;

  const stops = stopsLabel(driver.pits);
  const owed = driver.owes_stop ? " · i duhet ndalesa" : "";
  if (driver.position === 1) {
    const second = byPosition.find((other) => other.position === 2);
    const lead = second?.gap;
    return `${Number.isFinite(lead) && lead < 80 ? `Kryeson me ${lead.toFixed(1)}s` : "Kryeson"} · ${stops}${owed}`;
  }
  return `${Number.isFinite(driver.gap) ? `+${driver.gap.toFixed(1)}s nga kreu` : "Pa kohë"} · ${stops}${owed}`;
}
