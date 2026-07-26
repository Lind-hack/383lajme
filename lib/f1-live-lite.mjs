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
    const match = line.match(/^(\d{1,2})\s+(.+?)\s+(LEADER|—|-|[+-]?\d+(?::\d{1,2}){0,2}(?:\.\d+)?|[+-]?\d+(?:\.\d+)?\s*LAPS?)\\s+(?:\\d{1,2}|—|-)(?:\\s+([A-Z]+))?(?:\s+(\d+))?(?:\s+(.+))?$/i);
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
  const lines = String(renderedText ?? "").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const byPosition = new Map();
  for (const row of [...parseInlineRows(lines), ...parseColumnarRows(lines)]) if (!byPosition.has(row.position)) byPosition.set(row.position, row);
  if (byPosition.size < 2) { for (let i=0;i+1<lines.length;i++) { if (/^\d{1,2}$/.test(lines[i]) && /^[A-Z]{3}$/.test(lines[i+1]) && !byPosition.has(Number(lines[i]))) { const row=makeRow(lines[i],lines[i+1],"—","—"); if(row) byPosition.set(row.position,row); } } }
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
  if (RETIRED_PATTERN.test(String(row.status ?? ""))) return 0.001;
  const positional = [0, 0.65, 0.39, 0.22, 0.14, 0.09][row.position] ?? Math.max(0.01, 0.07 - (row.position - 6) * 0.01);
  const gapPenalty = row.position === 1 ? 0 : Math.min(0.08, gapSeconds(row.gap) * 0.004);
  const pitPenalty = Math.min(0.04, row.pits * 0.01);
  return Number(Math.max(0.001, Math.min(0.999, positional - gapPenalty - pitPenalty)).toFixed(4));
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
  if (market?.market_classification !== "live_f1" || config?.provider !== "formula1_dashboard") return null;
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
    await page.goto(F1_DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(2_000);
    await page.waitForFunction(() => /\bPOS\b[\s\S]*\bDRIVER\b[\s\S]*\bGAP\b[\s\S]*\bPIT/i.test(document.body.innerText), undefined, { timeout: 35_000 });
    return await page.locator("body").innerText();
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
    if (market?.status !== "open" || market?.market_classification !== "live_f1" || market?.market_type !== "f1_race_winner" || cfg?.provider !== "formula1_dashboard" || !cfg?.event_id || outcomes.length < 20 || outcomes.length > 22) return [];
    const configured = new Set(outcomes.map((o) => String(o?.key ?? "").toUpperCase()));
    const rows = leaderboard.rows.filter((r) => configured.has(String(r.driver_code ?? "").toUpperCase()));
    if (rows.length !== outcomes.length) return [];
    const raw = {}; let total = 0;
    for (const row of rows) {
      const code = String(row.driver_code).toUpperCase();
      const retired = RETIRED_PATTERN.test(String(row.status ?? ""));
      // Exponential rank/gap score is deterministic, normalized below, and deliberately
      // does not subtract for pit count. Pit strategy needs an official observable gap/position.
      const value = retired ? 0 : Math.exp(-0.68 * (row.position - 1) - 0.035 * gapSeconds(row.gap));
      raw[code] = value; total += value;
    }
    if (!Number.isFinite(total) || total <= 0) return [];
    const probabilities = Object.fromEntries(Object.entries(raw).map(([code, value]) => [code, Number((value / total).toFixed(8))]));
    const state_key = leaderboard.state_key;
    if (market?.live_score_state?.key === state_key) return [];
    return [{ market, probabilities, state_key, rows, oracle_cap: 0.05,
      state: { key: state_key, source_url: leaderboard.source_url, race: leaderboard.race, rows },
      evidence: [{ title: `Formula 1 Dashboard live timing: lap ${leaderboard.race.current_lap ?? "?"}`, url: leaderboard.source_url, slug: `formula1-dashboard:${cfg.event_id}` }],
      reasoning: "Verified Formula 1 Dashboard timing. Position and gap drive the normalized race-winner reference; pit counts are retained for display but do not directly penalize an undercut." }];
  });
}
