const OPEN_F1 = "https://api.openf1.org/v1";
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const HIGH_SPEED = new Set(["Monza", "Baku", "Spa-Francorchamps", "Las Vegas", "Jeddah"]);
const TECHNICAL = new Set(["Monaco", "Marina Bay", "Hungaroring", "Zandvoort", "Madring"]);
const CHAMPIONSHIP_LIQUIDITY = 6500;

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, number(value)));
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let openF1Queue = Promise.resolve();
let lastOpenF1RequestAt = 0;

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seedText) {
  let seed = hashSeed(seedText) || 1;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function api(path, fetchImpl) {
  const run = async () => {
    const wait = Math.max(0, 390 - (Date.now() - lastOpenF1RequestAt));
    if (wait) await sleep(wait);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetchImpl(`${OPEN_F1}/${path}`, { cache: "no-store" });
      lastOpenF1RequestAt = Date.now();
      if (response.ok) return response.json();
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw new Error(`OpenF1 ${path}: ${response.status}`);
      await sleep(800 * (attempt + 1));
    }
    throw new Error(`OpenF1 ${path}: retry limit reached`);
  };
  const pending = openF1Queue.then(run, run);
  openF1Queue = pending.then(() => undefined, () => undefined);
  return pending;
}

function isRace(session) {
  return String(session?.session_name ?? "").toLowerCase() === "race" && !session?.is_cancelled;
}

function isSprint(session) {
  return /sprint/i.test(String(session?.session_name ?? "")) && !/shootout|qualifying/i.test(String(session?.session_name ?? ""));
}

function cleanDriverRows(drivers) {
  const seen = new Set();
  return (drivers ?? []).filter((driver) => {
    const key = number(driver?.driver_number, -1);
    if (key < 0 || seen.has(key) || !driver?.name_acronym || !driver?.full_name) return false;
    seen.add(key);
    return true;
  });
}

function summarizeLaps(laps, driverByNumber) {
  const byDriver = new Map();
  let sessionMaxLap = 0;
  for (const lap of laps ?? []) {
    const driverNumber = number(lap?.driver_number, -1);
    if (!driverByNumber.has(driverNumber)) continue;
    const row = byDriver.get(driverNumber) ?? { durations: [], speeds: [], maxLap: 0 };
    const duration = number(lap?.lap_duration, NaN);
    const speed = Math.max(number(lap?.st_speed, NaN), number(lap?.i2_speed, NaN), number(lap?.i1_speed, NaN));
    const lapNumber = number(lap?.lap_number);
    if (!lap?.is_pit_out_lap && duration > 45 && duration < 240) row.durations.push(duration);
    if (Number.isFinite(speed) && speed > 120) row.speeds.push(speed);
    row.maxLap = Math.max(row.maxLap, lapNumber);
    sessionMaxLap = Math.max(sessionMaxLap, lapNumber);
    byDriver.set(driverNumber, row);
  }
  const driverMedianPace = new Map();
  const driverMedianSpeed = new Map();
  for (const [driverNumber, row] of byDriver) {
    driverMedianPace.set(driverNumber, median(row.durations));
    driverMedianSpeed.set(driverNumber, median(row.speeds));
  }
  const bestPace = Math.min(...[...driverMedianPace.values()].filter((value) => Number.isFinite(value)));
  const bestSpeed = Math.max(...[...driverMedianSpeed.values()].filter((value) => Number.isFinite(value)));
  const drivers = new Map();
  for (const [driverNumber, driver] of driverByNumber) {
    const row = byDriver.get(driverNumber);
    const pace = driverMedianPace.get(driverNumber);
    const speed = driverMedianSpeed.get(driverNumber);
    drivers.set(driverNumber, {
      paceIndex: Number.isFinite(pace) && Number.isFinite(bestPace) ? clamp(bestPace / pace) : 0.5,
      speedIndex: Number.isFinite(speed) && Number.isFinite(bestSpeed) ? clamp(speed / bestSpeed) : 0.5,
      reliability: row && sessionMaxLap > 0 ? clamp(row.maxLap / sessionMaxLap) : 0.5,
      team: String(driver?.team_name ?? ""),
    });
  }
  return drivers;
}

function average(values, fallback = 0.5) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : fallback;
}

function normalizeMap(values, key) {
  const maximum = Math.max(1, ...values.map((value) => number(value?.[key])));
  return new Map(values.map((value) => [value.driver_number, clamp(number(value?.[key]) / maximum)]));
}

function trackSpeedDemand(meeting) {
  const circuit = String(meeting?.circuit_short_name ?? meeting?.location ?? "");
  if (HIGH_SPEED.has(circuit)) return 0.82;
  if (TECHNICAL.has(circuit)) return 0.28;
  if (/street/i.test(String(meeting?.circuit_type ?? ""))) return 0.58;
  return 0.52;
}

function teamTrackIndex(team, meeting, recentTeam, historicalTrack) {
  const current = recentTeam.get(team) ?? { pace: 0.5, speed: 0.5 };
  const historical = historicalTrack?.get(team) ?? current;
  const speedDemand = trackSpeedDemand(meeting);
  const currentFit = current.speed * speedDemand + current.pace * (1 - speedDemand);
  const historicalFit = historical.speed * speedDemand + historical.pace * (1 - speedDemand);
  return clamp(currentFit * 0.72 + historicalFit * 0.28);
}

function gumbel(random) {
  return -Math.log(-Math.log(Math.max(1e-9, Math.min(1 - 1e-9, random()))));
}

function sumRemainingPoints(events) {
  return events.reduce((sum, event) => sum + (event.sprint ? SPRINT_POINTS[0] : RACE_POINTS[0]), 0);
}

export function championshipDecision(standings, remainingEvents) {
  const ordered = [...(standings ?? [])].sort((a, b) => number(b.points_current) - number(a.points_current));
  if (!ordered.length) return { decided: false, winnerDriverNumber: null, maximumRemaining: 0 };
  const maximumRemaining = sumRemainingPoints(remainingEvents ?? []);
  const lead = number(ordered[0].points_current) - number(ordered[1]?.points_current);
  return {
    decided: ordered.length === 1 || lead > maximumRemaining,
    winnerDriverNumber: ordered.length === 1 || lead > maximumRemaining ? ordered[0].driver_number : null,
    maximumRemaining,
  };
}

export function buildChampionshipModel(context, { simulations = 5000 } = {}) {
  const drivers = cleanDriverRows(context.drivers);
  const driverByNumber = new Map(drivers.map((driver) => [number(driver.driver_number), driver]));
  const currentStandings = (context.standings ?? []).filter((row) => driverByNumber.has(number(row.driver_number)));
  const standingsByDriver = new Map(currentStandings.map((row) => [number(row.driver_number), row]));
  const pointsNormalized = normalizeMap(currentStandings, "points_current");
  const recentSummaries = (context.recentRaces ?? []).map((race) => summarizeLaps(race.laps, driverByNumber));
  const recentStandingRows = context.recentRaces ?? [];
  const recentTeam = new Map();
  for (const driver of drivers) {
    const driverNumber = number(driver.driver_number);
    const team = String(driver.team_name ?? "");
    const pace = average(recentSummaries.map((summary) => summary.get(driverNumber)?.paceIndex));
    const speed = average(recentSummaries.map((summary) => summary.get(driverNumber)?.speedIndex));
    const row = recentTeam.get(team) ?? { pace: [], speed: [] };
    row.pace.push(pace);
    row.speed.push(speed);
    recentTeam.set(team, row);
  }
  for (const [team, values] of recentTeam) {
    recentTeam.set(team, { pace: average(values.pace), speed: average(values.speed) });
  }

  const historicalByMeeting = new Map();
  for (const baseline of context.trackBaselines ?? []) {
    const summary = summarizeLaps(baseline.laps, driverByNumber);
    const byTeam = new Map();
    for (const driver of drivers) {
      const feature = summary.get(number(driver.driver_number));
      if (!feature) continue;
      const team = String(driver.team_name ?? "");
      const row = byTeam.get(team) ?? { pace: [], speed: [] };
      row.pace.push(feature.paceIndex);
      row.speed.push(feature.speedIndex);
      byTeam.set(team, row);
    }
    for (const [team, values] of byTeam) byTeam.set(team, { pace: average(values.pace), speed: average(values.speed) });
    historicalByMeeting.set(number(baseline.meeting_key), byTeam);
  }

  const teamPoints = new Map((context.teamStandings ?? []).map((row) => [String(row.team_name ?? ""), number(row.points_current)]));
  const maxTeamPoints = Math.max(1, ...teamPoints.values());
  const latestResultByDriver = new Map((context.latestRaceResult ?? []).map((row) => [number(row.driver_number), row]));
  const currentLeaderPoints = Math.max(0, ...currentStandings.map((row) => number(row.points_current)));
  const previousLeaderPoints = Math.max(0, ...currentStandings.map((row) => number(row.points_start)));
  const features = drivers.map((driver) => {
    const driverNumber = number(driver.driver_number);
    const standing = standingsByDriver.get(driverNumber) ?? {};
    const recentPoints = recentStandingRows.map((race) => {
      const row = (race.standings ?? []).find((item) => number(item.driver_number) === driverNumber);
      return row ? Math.max(0, number(row.points_current) - number(row.points_start)) : 0;
    });
    const maxRecentPoints = Math.max(1, ...recentStandingRows.flatMap((race) => (race.standings ?? []).map((row) => Math.max(0, number(row.points_current) - number(row.points_start)))));
    const form = clamp(average(recentPoints, 0) / maxRecentPoints);
    const pace = average(recentSummaries.map((summary) => summary.get(driverNumber)?.paceIndex));
    const speed = average(recentSummaries.map((summary) => summary.get(driverNumber)?.speedIndex));
    const reliability = average(recentSummaries.map((summary) => summary.get(driverNumber)?.reliability), 0.85);
    const team = String(driver.team_name ?? "");
    const latestResult = latestResultByDriver.get(driverNumber) ?? {};
    const latestRacePosition = number(latestResult.position, 0) || null;
    const latestRacePoints = latestRacePosition && !latestResult.dsq && !latestResult.dns
      ? (RACE_POINTS[latestRacePosition - 1] ?? 0)
      : 0;
    const weekendPoints = number(standing.points_current) - number(standing.points_start);
    const gapToLeader = currentLeaderPoints - number(standing.points_current);
    const previousGapToLeader = previousLeaderPoints - number(standing.points_start);
    return {
      driver,
      driverNumber,
      key: String(driver.name_acronym).toUpperCase(),
      points: number(standing.points_current),
      rank: number(standing.position_current, 99),
      pointsIndex: pointsNormalized.get(driverNumber) ?? 0,
      constructorIndex: clamp((teamPoints.get(team) ?? 0) / maxTeamPoints),
      form,
      pace,
      speed,
      reliability,
      team,
      latestRacePosition,
      latestRacePoints,
      weekendPoints,
      gapToLeader,
      gapChange: previousGapToLeader - gapToLeader,
      positionChange: number(standing.position_start, standing.position_current) - number(standing.position_current),
    };
  });

  const remainingEvents = context.remainingEvents ?? [];
  const decision = championshipDecision(currentStandings, remainingEvents);
  const winnerCounts = new Map(features.map((feature) => [feature.driverNumber, 0]));
  const stateKey = context.stateKey ?? JSON.stringify(currentStandings.map((row) => [row.driver_number, row.points_current]));
  const random = seededRandom(`${stateKey}:${simulations}`);
  const trackModels = [];
  const eventModels = remainingEvents.map((event) => {
    const meeting = event.meeting ?? {};
    const historical = historicalByMeeting.get(number(meeting.meeting_key));
    const teamIndices = Object.fromEntries([...new Set(features.map((feature) => feature.team))].map((team) => [team, teamTrackIndex(team, meeting, recentTeam, historical)]));
    trackModels.push({
      meetingKey: meeting.meeting_key,
      circuit: meeting.circuit_short_name ?? meeting.location,
      circuitType: meeting.circuit_type ?? null,
      speedDemand: trackSpeedDemand(meeting),
      sprint: Boolean(event.sprint),
      teamSpeedIndex: teamIndices,
    });
    return { ...event, meeting, teamIndices };
  });

  if (decision.decided) {
    winnerCounts.set(number(decision.winnerDriverNumber), simulations);
  } else {
    for (let simulation = 0; simulation < simulations; simulation += 1) {
      const points = new Map(features.map((feature) => [feature.driverNumber, feature.points]));
      for (const event of eventModels) {
        const scored = features.map((feature) => {
          const trackIndex = event.teamIndices[feature.team] ?? 0.5;
          const strength =
            feature.pointsIndex * 0.26 +
            feature.form * 0.22 +
            feature.pace * 0.15 +
            feature.speed * 0.08 +
            feature.constructorIndex * 0.08 +
            trackIndex * 0.15 +
            feature.reliability * 0.06;
          const dnfRisk = 0.018 + (1 - feature.reliability) * 0.18;
          const retired = random() < dnfRisk;
          return { feature, score: retired ? -20 + random() : strength * 4.6 + gumbel(random) };
        }).sort((a, b) => b.score - a.score);
        const scale = event.sprint ? SPRINT_POINTS : RACE_POINTS;
        scored.forEach((row, index) => {
          points.set(row.feature.driverNumber, (points.get(row.feature.driverNumber) ?? 0) + (scale[index] ?? 0));
        });
      }
      const ordered = [...features].sort((a, b) => {
        const pointDelta = (points.get(b.driverNumber) ?? 0) - (points.get(a.driverNumber) ?? 0);
        return pointDelta || a.rank - b.rank;
      });
      winnerCounts.set(ordered[0].driverNumber, (winnerCounts.get(ordered[0].driverNumber) ?? 0) + 1);
    }
  }

  const rawProbabilities = Object.fromEntries(features.map((feature) => [feature.key, (winnerCounts.get(feature.driverNumber) ?? 0) / simulations]));
  const floor = 0.000001;
  const floored = Object.fromEntries(Object.entries(rawProbabilities).map(([key, value]) => [key, Math.max(floor, value)]));
  const total = Object.values(floored).reduce((sum, value) => sum + value, 0);
  const probabilities = Object.fromEntries(Object.entries(floored).map(([key, value]) => [key, value / total]));
  return {
    probabilities,
    outcomes: features.map((feature) => ({
      key: feature.key,
      label: String(feature.driver.full_name),
      team: feature.team,
      team_colour: feature.driver.team_colour ?? null,
      headshot_url: feature.driver.headshot_url ?? null,
      driver_number: feature.driverNumber,
      championship_position: feature.rank,
      championship_points: feature.points,
      latest_race_position: feature.latestRacePosition,
      latest_race_points: feature.latestRacePoints,
      weekend_points: feature.weekendPoints,
      gap_to_leader: feature.gapToLeader,
      gap_change: feature.gapChange,
      position_change: feature.positionChange,
    })),
    model: {
      version: "championship-monte-carlo-v2",
      simulations,
      racesRemaining: remainingEvents.filter((event) => !event.sprint).length,
      sprintsRemaining: remainingEvents.filter((event) => event.sprint).length,
      maximumRemainingPoints: decision.maximumRemaining,
      decided: decision.decided,
      winnerDriverNumber: decision.winnerDriverNumber,
      latestRace: {
        sessionKey: context.latestRace?.session_key ?? context.latestRaceSessionKey,
        meetingKey: context.latestRace?.meeting_key ?? null,
        circuit: context.latestRace?.circuit_short_name ?? context.latestRace?.location ?? null,
        endedAt: context.latestRace?.date_end ?? null,
        pointsScale: RACE_POINTS,
      },
      drivers: features.map((feature) => ({
        key: feature.key,
        points: feature.points,
        rank: feature.rank,
        recentForm: feature.form,
        driverPace: feature.pace,
        speedIndex: feature.speed,
        constructorIndex: feature.constructorIndex,
        reliability: feature.reliability,
        probability: probabilities[feature.key],
        latestRacePosition: feature.latestRacePosition,
        latestRacePoints: feature.latestRacePoints,
        weekendPoints: feature.weekendPoints,
        gapToLeader: feature.gapToLeader,
        gapChange: feature.gapChange,
        positionChange: feature.positionChange,
      })),
      tracks: trackModels,
    },
    stateKey: `openf1-championship:${context.year}:${hashSeed(stateKey)}`,
    sourceUrl: `${OPEN_F1}/championship_drivers?session_key=${context.latestRaceSessionKey}`,
  };
}

export async function fetchOpenF1ChampionshipContext({ now = new Date(), fetchImpl = fetch } = {}) {
  const year = now.getUTCFullYear();
  const [meetings, sessions, previousSessions] = await Promise.all([
    api(`meetings?year=${year}`, fetchImpl),
    api(`sessions?year=${year}`, fetchImpl),
    api(`sessions?year=${year - 1}`, fetchImpl).catch(() => []),
  ]);
  const meetingByKey = new Map(meetings.map((meeting) => [number(meeting.meeting_key), meeting]));
  const raceSessions = sessions.filter(isRace).sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  const completed = raceSessions.filter((session) => Date.parse(session.date_end) <= now.getTime());
  const upcomingRaces = raceSessions.filter((session) => Date.parse(session.date_start) > now.getTime());
  const upcomingSprints = sessions.filter(isSprint).filter((session) => Date.parse(session.date_start) > now.getTime());
  const latestRace = completed.at(-1);
  if (!latestRace) throw new Error(`OpenF1 has no completed ${year} race session.`);
  const [drivers, standings, teamStandings, latestRaceResult] = await Promise.all([
    api(`drivers?session_key=${latestRace.session_key}`, fetchImpl),
    api(`championship_drivers?session_key=${latestRace.session_key}`, fetchImpl),
    api(`championship_teams?session_key=${latestRace.session_key}`, fetchImpl),
    api(`session_result?session_key=${latestRace.session_key}`, fetchImpl),
  ]);
  const recentSessions = completed.slice(-4);
  const historicalRaceSessions = [...previousSessions, ...completed]
    .filter(isRace)
    .filter((session) => Date.parse(session.date_end) <= now.getTime());
  const baselineSessionByMeeting = new Map();
  for (const upcoming of upcomingRaces) {
    const candidate = historicalRaceSessions
      .filter((session) => number(session.circuit_key) === number(upcoming.circuit_key))
      .sort((a, b) => Date.parse(a.date_end) - Date.parse(b.date_end))
      .at(-1);
    if (candidate) baselineSessionByMeeting.set(number(upcoming.meeting_key), candidate);
  }
  const recentRaces = await Promise.all(recentSessions.map(async (session) => {
    const [raceStandings, laps] = await Promise.all([
      api(`championship_drivers?session_key=${session.session_key}`, fetchImpl),
      api(`laps?session_key=${session.session_key}`, fetchImpl).catch(() => []),
    ]);
    return { session, standings: raceStandings, laps };
  }));
  const baselineEntries = await Promise.all([...baselineSessionByMeeting].map(async ([meetingKey, session]) => ({
    meeting_key: meetingKey,
    session,
    laps: await api(`laps?session_key=${session.session_key}`, fetchImpl).catch(() => []),
  })));
  const remainingEvents = [
    ...upcomingRaces.map((session) => ({ session, meeting: meetingByKey.get(number(session.meeting_key)) ?? session, sprint: false })),
    ...upcomingSprints.map((session) => ({ session, meeting: meetingByKey.get(number(session.meeting_key)) ?? session, sprint: true })),
  ].sort((a, b) => Date.parse(a.session.date_start) - Date.parse(b.session.date_start));
  const stateKey = JSON.stringify({
    latest: latestRace.session_key,
    standings: standings.map((row) => [row.driver_number, row.points_current, row.position_current]),
    remaining: remainingEvents.map((event) => [event.session.session_key, event.sprint]),
  });
  return {
    year,
    latestRaceSessionKey: latestRace.session_key,
    latestRace,
    drivers,
    standings,
    teamStandings,
    latestRaceResult,
    recentRaces,
    trackBaselines: baselineEntries,
    remainingEvents,
    closesAt: upcomingRaces.at(-1)?.date_end ?? latestRace.date_end,
    stateKey,
  };
}

export async function buildCurrentF1ChampionshipMarket(options = {}) {
  const context = await fetchOpenF1ChampionshipContext(options);
  return { ...buildChampionshipModel(context, options), context };
}

export function buildChampionshipMarketTemplate(championship, { now = new Date() } = {}) {
  const year = number(championship?.context?.year, now.getUTCFullYear());
  const outcomes = Array.isArray(championship?.outcomes) ? championship.outcomes : [];
  const probabilities = championship?.probabilities ?? {};
  if (outcomes.length < 20 || outcomes.length > 22) throw new Error("The F1 championship market requires 20-22 verified drivers.");
  const keys = outcomes.map((outcome) => String(outcome.key ?? "").toUpperCase());
  if (keys.some((key) => !/^[A-Z]{3}$/.test(key)) || keys.some((key) => !Number.isFinite(Number(probabilities[key])))) {
    throw new Error("The F1 championship outcome vector is incomplete.");
  }
  const closesAt = new Date(championship?.context?.closesAt ?? `${year}-12-31T23:59:59.000Z`);
  const safeClose = Number.isFinite(closesAt.getTime()) && closesAt > now ? closesAt : new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  return {
    slug: `f1-champion-${year}`,
    question: `Kush shpallet kampion i Formula 1 në ${year}?`,
    description: "Tregu sezonal F1 përditësohet nga renditja, forma e fundit, ritmi, shpejtësia, besueshmëria, makina dhe profili i pistave të mbetura. Simulimi Monte Carlo përdor të dhëna OpenF1 dhe qëndron aktiv derisa titulli të jetë matematikisht i vendosur.",
    category: "Sport",
    status: "open",
    market_type: "f1_race_winner",
    market_classification: "live_f1",
    b: CHAMPIONSHIP_LIQUIDITY,
    closes_at: safeClose.toISOString(),
    outcomes: keys,
    sport_outcomes: outcomes,
    outcome_quantities: Object.fromEntries(keys.map((key) => [key, CHAMPIONSHIP_LIQUIDITY * Math.log(Math.max(0.000001, Number(probabilities[key])))])),
    reference_probabilities: Object.fromEntries(keys.map((key) => [key, Number(probabilities[key])])),
    live_score_state: {
      key: championship.stateKey,
      source_url: championship.sourceUrl,
      source_provider: "OpenF1",
      championship: championship.model,
    },
    live_event: {
      event_id: `f1-championship-${year}`,
      event_kind: "championship",
      provider: "formula1_dashboard",
      source_provider: "OpenF1",
      source_url: championship.sourceUrl,
      season: year,
      created_from: "openf1_championship_scheduler",
      created_at: now.toISOString(),
    },
    pre_match_analysis: {
      source: "OpenF1",
      model: championship.model,
      updated_at: now.toISOString(),
    },
  };
}
