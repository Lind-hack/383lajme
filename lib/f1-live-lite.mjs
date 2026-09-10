const F1_DASHBOARD_URL = "https://app.formula1dashboard.com/live-timing/";

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

const GAP_PATTERN = /^(?:LEADER|—|-|[+-]?\d+(?::\d{1,2}){0,2}(?:\.\d+)?|[+-]?\d+(?:\.\d+)?\s*LAPS?)$/i;
const RETIRED_PATTERN = /\b(?:DNF|DNS|RETIRED|RETIREMENT|OUT)\b/i;

function rowState(row) {
  return JSON.stringify({ position: row.position, driver_code: row.driver_code, gap: row.gap, pits: row.pits, tyre: row.tyre ?? null, stint: row.stint ?? null, status: row.status ?? null });
}

function leaderboardState(rows, race) {
  return JSON.stringify({ race: { status: race.status, current_lap: race.current_lap ?? null, total_laps: race.total_laps ?? null }, rows: rows.map((row) => JSON.parse(rowState(row))) });
}

function driverCode(driver) {
  const words = normalize(driver).split(" ");
  const explicit = [...words].reverse().find((word) => /^[A-Z]{3}$/.test(word));
  if (explicit) return explicit;
  // Driver code is deliberately not guessed. A live F1 market must carry one.
  return null;
}

function makeRow(positionValue, driverValue, gapValue, pitsValue, extras = {}) {
  const position = Number(positionValue);
  const driver = String(driverValue ?? "").replace(/\s+/g, " ").trim();
  const gap = String(gapValue ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  const pits = /^(?:—|-)?$/.test(String(pitsValue).trim()) ? 0 : Number(pitsValue);
  if (!Number.isInteger(position) || position < 1 || position > 30 || !driver || !GAP_PATTERN.test(gap) || !Number.isInteger(pits) || pits < 0 || pits > 20) return null;
  const status = String(extras.status ?? "").trim().toUpperCase() || null;
  return { position, driver, driver_code: String(extras.driver_code ?? driverCode(driver) ?? "").toUpperCase() || null, gap, pits, tyre: extras.tyre ?? null, stint: Number.isInteger(Number(extras.stint)) ? Number(extras.stint) : null, status };
}

function parseInlineRows(lines) {
  return lines.flatMap((line) => {
    // The renderer emits the first four canonical cells in accessibility text;
    // optional tyre, stint, and status cells may follow.
    const match = line.match(/^(\d{1,2})\s+(.+?)\s+(LEADER|—|-|[+-]?\d+(?::\d{1,2}){0,2}(?:\.\d+)?|[+-]?\d+(?:\.\d+)?\s*LAPS?)\s+(\d{1,2}|—|-)(?:\s+([A-Z]+))?(?:\s+(\d+))?(?:\s+(.+))?$/i);
    const row = match && makeRow(match[1], match[2], match[3], match[4], { tyre: match[5], stint: match[6], status: match[7] });
    return row ? [row] : [];
  });
}

function parseColumnarRows(lines) {
  const header = lines.findIndex((line) => /\bPOS\b/i.test(line) && /\bDRIVER\b/i.test(line) && /\bGAP\b/i.test(line) && /\bPIT/i.test(line));
  if (header < 0) return [];
  const rows = [];
  for (let index = header + 1; index + 3 < lines.length;) {
    const row = /^\d{1,2}$/.test(lines[index]) && GAP_PATTERN.test(lines[index + 2])
      ? makeRow(lines[index], lines[index + 1], lines[index + 2], lines[index + 3])
      : null;
    if (row) { rows.push(row); index += 4; } else index += 1;
  }
  return rows;
}

function raceState(renderedText) {
  const text = String(renderedText ?? "").replace(/\s+/g, " ").toUpperCase();
  const laps = text.match(/\bLAP\s*(\d+)\s*(?:\/|OF)\s*(\d+)\b/);
  return {
    status: /\b(?:FINISHED|FINAL CLASSIFICATION)\b/.test(text) ? "FINISHED" : /\bINACTIVE\b/.test(text) ? "INACTIVE" : /\b(?:RACE|LIVE|LAP)\b/.test(text) ? "LIVE" : "UNAVAILABLE",
    current_lap: laps ? Number(laps[1]) : null,
    total_laps: laps ? Number(laps[2]) : null,
  };
}

/** Parses only a rendered Formula 1 Dashboard leaderboard; a static shell fails closed. */
export function parseF1LiveLiteLeaderboard(renderedText) {
  if (renderedText && typeof renderedText === "object" && Array.isArray(renderedText.tableRows)) {
    if (!String(renderedText.sessionName ?? '').trim()) throw new Error("Dashboard race identity unavailable");
    const rows = renderedText.tableRows.flatMap(cells => {
      const code = String(cells[1] ?? "").match(/\b[A-Z]{3}(?=\s|\d|$)/)?.[0];
      const position = /^\d+$/.test(String(cells[0]).trim()) ? Number(cells[0]) : null;
      const gap = String(cells[2] ?? "").trim();
      const retired = /^(DNF|DNS|DSQ)$/i.test(gap);
      if (!code || (!position && !retired)) return [];
      const pits = /^\d+$/.test(String(cells[8]).trim()) ? Number(cells[8]) : null;
      const tyre = String(cells[9] ?? "").match(/SOFT|MEDIUM|HARD|INTERMEDIATE|WET/)?.[0] ?? null;
      const tyreAge = String(cells[9] ?? "").match(/(\d+)\s*$/)?.[1];
      return [{ driver: code, driver_code: code, position, gap: position === 1 ? "LEADER" : gap,
        pits, tyre, tyre_age: tyreAge ? Number(tyreAge) : null, status: retired ? gap.toUpperCase() : null }];
    });
    if (rows.length < 20 || new Set(rows.map(row => row.driver_code)).size !== rows.length) throw new Error("Incomplete dashboard driver identities");
    const race = raceState(renderedText.text);
    return { source_url: F1_DASHBOARD_URL, rows, race, session_name: renderedText.sessionName,
      state_key: leaderboardState(rows, race) };
  }
  const lines = String(renderedText ?? "").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const byPosition = new Map();
  for (const row of [...parseInlineRows(lines), ...parseColumnarRows(lines)]) if (!byPosition.has(row.position)) byPosition.set(row.position, row);
  if (byPosition.size < 2) {
    // The dashboard renders GAP, INT, LAST and BEST as one cell, so the
    // columnar reader — which wants GAP alone on its line — never matches and
    // every row arrived here with its gap hardcoded to "—". Position alone then
    // drove the live price, discarding how far apart the cars actually were.
    // The gap is the first token of that combined cell.
    // ponytail: gap only. PIT and TYRE share a cell too, but pits are evidence
    // rather than a price input and tyre is display; widen this if either
    // starts mattering to the number.
    for (let i = 0; i + 1 < lines.length; i++) {
      if (/^\d{1,2}$/.test(lines[i]) && /^[A-Z]{3}$/.test(lines[i + 1]) && !byPosition.has(Number(lines[i]))) {
        const cell = String(lines[i + 2] ?? "").trim().split(" ")[0];
        const gap = GAP_PATTERN.test(cell) ? cell : "—";
        const row = makeRow(lines[i], lines[i + 1], gap, "—");
        if (row) byPosition.set(row.position, row);
      }
    }
  }
  const rows = [...byPosition.values()].sort((a, b) => a.position - b.position);
  if (rows.length < 2) throw new Error("Formula 1 Dashboard render did not expose a complete usable leaderboard.");
  const race = raceState(renderedText);
  if (race.status === "UNAVAILABLE") throw new Error("Formula 1 Dashboard render did not expose a race state.");
  return { source_url: F1_DASHBOARD_URL, rows, race, state_key: leaderboardState(rows, race) };
}

function gapSeconds(gap) {
  const normalized = String(gap ?? "").trim().toUpperCase();
  if (normalized === "LEADER") return 0;
  if (/LAPS?$/.test(normalized)) return 120;
  const parts = normalized.replace(/^\+/, "").split(":").map(Number);
  return parts.some((part) => !Number.isFinite(part)) ? 0 : parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

function referenceProbability(row) {
  const status = String(row.status ?? "");
  if (RETIRED_PATTERN.test(status) || /DISQUAL|BLACK FLAG/i.test(status)) return 0.001;
  const positional = [0, 0.65, 0.39, 0.22, 0.14, 0.09][row.position] ?? Math.max(0.01, 0.07 - (row.position - 6) * 0.01);
  const gapPenalty = row.position === 1 ? 0 : Math.min(0.08, gapSeconds(row.gap) * 0.004);
  const pitPenalty = Math.min(0.04, row.pits * 0.01);
  const sanctionPenalty = /STOP.?GO|DRIVE.?THROUGH/i.test(status) ? 0.16 : /TIME PENALTY|PENALTY/i.test(status) ? 0.08 : 0;
  return Number(Math.max(0.001, Math.min(0.999, positional - gapPenalty - pitPenalty - sanctionPenalty)).toFixed(4));
}

export function buildF1PreRacePlan({ markets, briefing }) {
  const allowed = new Set(["PRE_QUALIFYING", "QUALIFYING_COMPLETE"]);
  if (!allowed.has(String(briefing?.phase)) || !String(briefing?.event_id ?? "")) return [];
  const drivers = new Map((briefing.drivers ?? []).map((driver) => [normalize(driver.driver_code), driver]));
  return (markets ?? []).flatMap((market) => {
    const config = f1Config(market);
    const driver = config && config.event_id === briefing.event_id ? drivers.get(config.driver_code) : null;
    if (market?.status !== "open" || !driver || !Number.isFinite(Number(driver.championship_rank)) || !Number.isFinite(Number(driver.practice_pace_rank)) || !Number.isFinite(Number(driver.circuit_score))) return [];
    const rank = Math.max(1, Number(driver.championship_rank));
    const pace = Math.max(1, Number(driver.practice_pace_rank));
    let probability = 0.34 - (rank - 1) * 0.018 - (pace - 1) * 0.022 + Math.max(-0.08, Math.min(0.08, Number(driver.circuit_score) - 0.5));
    const grid = Number(driver.grid_position);
    if (briefing.phase === "QUALIFYING_COMPLETE") {
      if (!Number.isInteger(grid) || grid < 1 || grid > 22) return [];
      probability -= Math.min(0.28, Math.max(0, grid - 1) * 0.025);
    }
    probability = Number(Math.max(0.001, Math.min(0.70, probability)).toFixed(4));
    return [{ market, config, phase: briefing.phase, reference_probability: probability, oracle_cap: 0.05, grid_position: Number.isInteger(grid) ? grid : null,
      reasoning: `Pre-race F1 plan: championship rank ${rank}, verified practice pace rank ${pace}, circuit score ${driver.circuit_score}${briefing.phase === "QUALIFYING_COMPLETE" ? `, official grid P${grid}` : ""}.` }];
  });
}

function f1Config(market) {
  const config = market?.live_event;
  if (market?.market_classification !== "live_f1" || !["formula1_dashboard","openf1"].includes(config?.provider)) return null;
  const eventId = String(config.event_id ?? config.race_id ?? "").trim();
  const code = normalize(config.driver_code);
  if (!eventId || !/^[A-Za-z0-9_-]+$/.test(eventId) || !/^[A-Z]{3}$/.test(code)) return null;
  return { event_id: eventId, driver_code: code };
}

/** Builds attributable 5pp F1 updates from an explicitly configured race/driver mapping. */
export function buildF1MarketPlan({ markets, leaderboard }) {
  return (markets ?? []).flatMap((market) => {
    const config = f1Config(market);
    if (market?.status !== "open" || !config || leaderboard?.race?.status !== "LIVE") return [];
    const row = leaderboard.rows.find((candidate) => candidate.driver_code === config.driver_code);
    if (!row) return [];
    const state_key = rowState(row);
    if (market?.live_score_state?.key === state_key) return [];
    const reference_probability = referenceProbability(row);
    return [{ market, config, row, state_key, reference_probability, oracle_cap: 0.05,
      evidence: [{ title: `Formula 1 Dashboard: P${row.position} ${row.driver} (${row.driver_code ?? "unmapped"}), ${row.gap}, ${row.pits} pit stop${row.pits === 1 ? "" : "s"}`, url: leaderboard.source_url, slug: `formula1-dashboard:${config.event_id}` }],
      reasoning: `Formula 1 Dashboard rendered leaderboard for ${config.event_id}: P${row.position}, gap ${row.gap}, ${row.pits} pit stop${row.pits === 1 ? "" : "s"}${row.status ? `, ${row.status}` : ""}. Reference is bounded to 5pp per run and uses observed position, gap, pit, tyre/stint/status only.`,
    }];
  });
}

export function buildF1SettlementPlan({ markets, leaderboard }) {
  if (leaderboard?.race?.status !== "FINISHED") return [];
  const candidates = (markets ?? []).map((market) => ({ market, config: f1Config(market) })).filter((item) => item.market?.status === "open" && item.config);
  const eventIds = [...new Set(candidates.map((item) => item.config.event_id))];
  if (eventIds.length !== 1) return [];
  const winner = leaderboard.rows.find((row) => row.position === 1)?.driver_code;
  if (!winner) return [];
  return candidates.map(({ market, config }) => ({ market, outcome: config.driver_code === winner ? "PO" : "JO", winner, event_id: config.event_id }));
}

/** Dynamic renderer only: never accept a static HTTP shell as live timing data. */
export async function renderOfficialF1LiveLite({ cdpUrl = process.env.F1_LIVE_LITE_CDP_URL } = {}) {
  let chromium;
  try { ({ chromium } = await import("playwright-core")); } catch { throw new Error("playwright-core is required for Formula 1 Dashboard rendering."); }
  let executablePath = process.env.F1_LIVE_LITE_CHROMIUM_PATH;
  let launchArgs = ["--no-sandbox", "--disable-dev-shm-usage"];
  if (!cdpUrl && !executablePath && process.env.VERCEL) {
    // playwright-core deliberately ships no browser. Use the serverless Chromium
    // bundle in Vercel, while retaining a CDP override for the durable VPS.
    const bundledChromium = (await import("@sparticuz/chromium")).default;
    executablePath = await bundledChromium.executablePath();
    launchArgs = bundledChromium.args;
  }
  const browser = cdpUrl
    ? await chromium.connectOverCDP(cdpUrl)
    : await chromium.launch({ executablePath: executablePath ?? "/usr/bin/chromium", headless: true, args: launchArgs });
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(F1_DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForFunction(() => [...document.querySelectorAll('table tr')].filter(row => row.querySelectorAll('td').length >= 10).length >= 20, undefined, { timeout: 15_000 });
    return await page.evaluate(() => ({ text: document.body.innerText,
      sessionName: [...document.querySelectorAll('h1')].map(node => node.textContent?.trim()).find(text => text && text !== 'Live Timing') ?? null,
      tableRows: [...document.querySelectorAll('table tr')].map(row => [...row.querySelectorAll('td')]
        .filter(cell => getComputedStyle(cell).display !== 'none')
        .map(cell => `${[...cell.querySelectorAll('img')].map(img => img.alt).join(' ')} ${cell.innerText}`.trim())).filter(cells => cells.length >= 10),
    }));
  } finally { await page.close(); await browser.close(); }
}

export async function fetchF1LiveLiteLeaderboard({ render = renderOfficialF1LiveLite } = {}) {
  return parseF1LiveLiteLeaderboard(await render());
}


/** One 20-22 outcome F1 winner market. Pit count is evidence, not a direct penalty:
 * an early stop may be an undercut, so only live position/gap/status drive the bounded reference. */
export function buildF1RaceWinnerPlan({ markets, leaderboard }) {
  if (leaderboard?.race?.status !== "LIVE") return [];
  return (markets ?? []).flatMap((market) => {
    const cfg = market?.live_event;
    const outcomes = Array.isArray(market?.sport_outcomes) ? market.sport_outcomes : [];
    if (market?.status !== "open" || market?.market_classification !== "live_f1" || market?.market_type !== "f1_race_winner" || !["formula1_dashboard","openf1"].includes(cfg?.provider) || !cfg?.event_id || outcomes.length < 20 || outcomes.length > 22) return [];
    const configured = new Set(outcomes.map((o) => String(o?.key ?? "").toUpperCase()));
    const rows = leaderboard.rows.filter((r) => configured.has(String(r.driver_code ?? "").toUpperCase()));
    if (rows.length !== outcomes.length) return [];
    if (leaderboard.session_key && cfg.openf1_session_key && Number(leaderboard.session_key) !== Number(cfg.openf1_session_key)) return [];
    if (leaderboard.session_name && normalize(leaderboard.session_name) !== normalize(cfg.race_name)) return [];
    const lap = Number(leaderboard.race.current_lap);
    const totalLaps = Number(leaderboard.race.total_laps ?? cfg.total_laps);
    const knownDistance = totalLaps > 0 && lap > 0 && lap <= totalLaps;
    const remaining = knownDistance ? Math.max(0.1, totalLaps - lap) : null;
    const progress = knownDistance ? lap / totalLaps : 0.35;
    const wet = Number(leaderboard.weather?.rainfall) > 0;
    const neutralized = Boolean(leaderboard.race.safety_car);
    const leaderPace = rows.find(r => r.position === 1)?.recent_pace;
    const strategyCost = row => row?.strategy_estimates?.available
      ? Math.min(...row.strategy_estimates.scenarios.map(item => item.estimated_extra_seconds)) : null;
    const leaderStrategy = strategyCost(rows.find(r => r.position === 1));
    const raw = {}; let total = 0;
    for (const row of rows) {
      const code = String(row.driver_code).toUpperCase();
      const sanction = String(row.status ?? "");
      const disqualified = /DISQUAL|BLACK FLAG|RETIRED|DNF|DNS|DSQ/i.test(sanction);
      const sanctionFactor = /STOP.?GO|DRIVE.?THROUGH/i.test(sanction) ? 0.12 : /TIME PENALTY|PENALTY/i.test(sanction) ? 0.45 : 1;
      const horizon = remaining === null ? 5 : Math.min(remaining, 6);
      const paceDelta = Number.isFinite(row.recent_pace) && Number.isFinite(leaderPace) ? Math.max(-2, Math.min(2, row.recent_pace - leaderPace)) : 0;
      const age = Number.isFinite(row.tyre_age) ? row.tyre_age : 0;
      const compoundLife = ({ SOFT: 20, MEDIUM: 32, HARD: 45, INTERMEDIATE: 30, WET: 30 })[String(row.tyre).toUpperCase()] ?? 35;
      const tyreRisk = Math.max(0, age - compoundLife) * (paceDelta ? 0.01 : 0.035);
      const wrongWetTyre = wet && /^(SOFT|MEDIUM|HARD)$/.test(String(row.tyre)) ? 0.55 : 0;
      const gap = gapSeconds(row.gap);
      const ownStrategy = strategyCost(row);
      const strategyDelta = !wet && !neutralized && Number.isFinite(leaderStrategy) && Number.isFinite(ownStrategy)
        ? Math.max(-3, Math.min(3, (ownStrategy - leaderStrategy) * 0.1)) : 0;
      const projectedGap = Math.max(0, gap + paceDelta * horizon + strategyDelta);
      const uncertainty = (wet ? 1.6 : 1) * (neutralized ? 3 : 1);
      const rankWeight = (0.15 + progress * 0.3 + (remaining === null ? 0 : 2 / (remaining + 1))) / uncertainty;
      const gapWeight = remaining === null ? 0.035 : 1 / Math.max(0.25, remaining * 1.2 * uncertainty);
      const opening = Number(market.pre_match_analysis?.opening_model?.probabilities?.[code]);
      const priorWeight = opening > 0 ? Math.pow(opening, (1 - progress) * 0.3) : 1;
      const value = disqualified ? 0 : Math.exp(Math.max(-700, -rankWeight * (row.position - 1) - gapWeight * projectedGap - tyreRisk - wrongWetTyre)) * sanctionFactor * priorWeight;
      raw[code] = value; total += value;
    }
    if (!Number.isFinite(total) || total <= 0) return [];
    const probabilities = Object.fromEntries(Object.entries(raw).map(([code, value]) => [code, Number((value / total).toFixed(8))]));
    const state_key = leaderboard.state_key;
    if (market?.live_score_state?.key === state_key) return [];
    return [{ market, probabilities, state_key, rows, oracle_cap: 0.05,
      state: { key: state_key, source_url: leaderboard.source_url, race: leaderboard.race, rows, missing_inputs: leaderboard.missing_inputs ?? [], provider_errors: leaderboard.provider_errors ?? [] },
      evidence: [{ title: `F1 source timing: lap ${leaderboard.race.current_lap ?? "?"}`, url: leaderboard.source_url, slug: `formula1-dashboard:${cfg.event_id}` }],
      reasoning: "Source-attributed F1 timing. Estimated race-winner model using supplied position, gap, laps remaining, recent clean-lap pace, tyre age/compound, measured rain, safety-car state and sanctions. Missing telemetry stays neutral; this is not a weather radar or a calibrated guarantee." }];
  });
}

export function openF1ToWinnerLeaderboard(live) {
  if (!live?.rows?.length) return null;
  const penaltyFor = (row) => (live.race_control ?? []).filter((event) => Number(event?.driver_number) === Number(row.driver_number)).map((event) => String(event?.message ?? event?.flag ?? "")).filter((message) => /PENALTY|DISQUAL|BLACK FLAG|STOP.?GO|DRIVE.?THROUGH/i.test(message)).at(-1) ?? null;
  const rows = live.rows.map(row => ({ position: row.position, driver: row.driver, driver_code: row.driver_code, gap: row.position === 1 ? "LEADER" : row.gap_to_leader == null ? "—" : typeof row.gap_to_leader === "string" && /LAP/i.test(row.gap_to_leader) ? row.gap_to_leader : `+${Number(row.gap_to_leader).toFixed(3)}`, pits: row.pits ?? null, pit_stops: row.pit_stops ?? null, strategy_estimates: row.strategy_estimates ?? null, interval: row.interval ?? null, tyre: row.tyre ?? null, stint: row.stint ?? null, tyre_age: row.tyre_age ?? null, recent_pace: row.recent_pace ?? null, status: row.status ?? penaltyFor(row) }));
  return { missing_inputs: live.missing_inputs ?? [], provider_errors: live.provider_errors ?? [], source_url: live.source_url, session_key: live.session?.session_key, weather: live.weather ?? null, rows, race: { status: "LIVE", current_lap: live.lap ?? null, total_laps: live.total_laps ?? null, safety_car: /SAFETY CAR DEPLOYED|VSC DEPLOYED/.test((live.race_control ?? []).filter(e => /SAFETY CAR|VSC/.test(e.message ?? "")).at(-1)?.message ?? "") }, state_key: JSON.stringify({ source: "openf1", session: live.session?.session_key, lap: live.lap, rows: live.rows, weather: live.weather, race_control: live.race_control }) };
}
