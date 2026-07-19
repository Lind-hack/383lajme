const F1_LIVE_LITE_URL = "https://app.formula1dashboard.com/live-timing/";
const DRIVER_CODES = { antonelli: "ANT", verstappen: "VER", norris: "NOR", russell: "RUS", leclerc: "LEC", hamilton: "HAM", piastri: "PIA", lindblad: "LIN", hadjar: "HAD", bortoleto: "BOR" };

const BELGIAN_GP_PREFIX = "f1-belgjika-spa-fiton-";

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function officialRowKey({ position, driver, gap, pits }) {
  return JSON.stringify({ position, driver, gap, pits });
}

function leaderboardKey(rows) {
  return JSON.stringify(rows.map((row) => JSON.parse(officialRowKey(row))));
}

const GAP_PATTERN = /^(?:LEADER|[+-]?\d+(?::\d{1,2}){0,2}(?:\.\d+)?|[+-]?\d+(?:\.\d+)?\s*LAPS?)$/i;
const INLINE_ROW_PATTERN = /^(\d{1,2})\s+(.+?)\s+(LEADER|[+-]?\d+(?::\d{1,2}){0,2}(?:\.\d+)?|[+-]?\d+(?:\.\d+)?\s*LAPS?)\s+(\d{1,2})$/i;

function makeRow(positionValue, driverValue, gapValue, pitsValue) {
  const position = Number(positionValue);
  const driver = String(driverValue ?? "").replace(/\s+/g, " ").trim();
  const gap = String(gapValue ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  const pits = Number(pitsValue);
  if (!Number.isInteger(position) || position < 1 || position > 30 || !driver || !GAP_PATTERN.test(gap) || !Number.isInteger(pits) || pits < 0 || pits > 20) return null;
  return { position, driver, gap, pits };
}

function parseInlineRows(lines) {
  return lines.flatMap((line) => {
    const match = line.match(INLINE_ROW_PATTERN);
    const row = match && makeRow(match[1], match[2], match[3], match[4]);
    return row ? [row] : [];
  });
}

function parseColumnarRows(lines) {
  let headerIndex = lines.findIndex((line) => /\bPOS\b/i.test(line) && /\bDRIVER\b/i.test(line) && /\bGAP\b/i.test(line) && /\bPITS\b/i.test(line));
  if (headerIndex < 0) {
    const posIndex = lines.findIndex((line) => /^POS$/i.test(line));
    const driverIndex = lines.findIndex((line, index) => index > posIndex && /^DRIVER$/i.test(line));
    const gapIndex = lines.findIndex((line, index) => index > driverIndex && /^GAP$/i.test(line));
    const pitsIndex = lines.findIndex((line, index) => index > gapIndex && /^PITS$/i.test(line));
    headerIndex = pitsIndex;
  }
  if (headerIndex < 0) return [];
  const rows = [];
  for (let index = headerIndex + 1; index + 3 < lines.length;) {
    const [position, driver, gap, pits] = lines.slice(index, index + 4);
    const row = /^\d{1,2}$/.test(position) && GAP_PATTERN.test(gap)
      ? makeRow(position, driver, gap, pits)
      : null;
    if (row) {
      rows.push(row);
      index += 4;
    } else {
      index += 1;
    }
  }
  return rows;
}

/**
 * Parses text extracted from the rendered, official F1 Live Lite leaderboard.
 * Both inline accessibility text and columnar browser text are accepted. An
 * HTML shell without a complete leaderboard is deliberately rejected.
 */
export function parseF1LiveLiteLeaderboard(renderedText) {
  const lines = String(renderedText ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const byPosition = new Map();
  for (const row of [...parseInlineRows(lines), ...parseColumnarRows(lines)]) {
    if (!byPosition.has(row.position)) byPosition.set(row.position, row);
  }
  const rows = [...byPosition.values()].sort((a, b) => a.position - b.position);
  if (rows.length < 2) throw new Error("Official F1 Live Lite render did not expose a complete usable leaderboard.");
  return { source_url: F1_LIVE_LITE_URL, rows, state_key: leaderboardKey(rows) };
}

function gapSeconds(gap) {
  const normalized = String(gap ?? "").trim().toUpperCase();
  if (normalized === "LEADER") return 0;
  if (/LAPS?$/.test(normalized)) return 30;
  const parts = normalized.replace(/^\+/, "").split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

function referenceProbability(row) {
  const byPosition = [0, 0.65, 0.39, 0.22, 0.14, 0.09];
  const positional = byPosition[row.position] ?? Math.max(0.01, 0.07 - (row.position - 6) * 0.01);
  // The P1 gap is often rendered as total race time rather than "LEADER".
  const gapPenalty = row.position === 1 ? 0 : Math.min(0.12, gapSeconds(row.gap) * 0.004);
  const pitPenalty = Math.min(0.08, row.pits * 0.01);
  return Number(Math.max(0.001, Math.min(0.999, positional - gapPenalty - pitPenalty)).toFixed(4));
}

function driverForMarket(market, rows) {
  const suffix = String(market?.slug ?? "").slice(BELGIAN_GP_PREFIX.length);
  const wanted = normalize(suffix);
  if (!wanted) return null;
  return rows.find((row) => {
    const driver = normalize(row.driver);
    return driver === wanted || driver.includes(wanted) || wanted.includes(driver) || driver === DRIVER_CODES[wanted];
  }) ?? null;
}

/** Builds attributable, bounded updates only for a changed official driver row. */
export function buildF1MarketPlan({ markets, leaderboard }) {
  return (markets ?? []).flatMap((market) => {
    if (market?.status !== "open" || !String(market?.slug ?? "").startsWith(BELGIAN_GP_PREFIX)) return [];
    const row = driverForMarket(market, leaderboard.rows);
    if (!row) return [];
    const state_key = officialRowKey(row);
    if (market?.live_score_state?.key === state_key) return [];
    const reference_probability = referenceProbability(row);
    return [{
      market,
      row,
      state_key,
      reference_probability,
      oracle_cap: 0.05,
      evidence: [{
        title: `Official F1 Live Lite: P${row.position} ${row.driver}, ${row.gap}, ${row.pits} pit stop${row.pits === 1 ? "" : "s"}`,
        url: leaderboard.source_url,
        slug: "formula1:f1-live-lite",
      }],
      reasoning: `Official F1 Live Lite rendered leaderboard: P${row.position}, gap ${row.gap}, ${row.pits} pit stop${row.pits === 1 ? "" : "s"}; reference uses only this official position, gap, and pit state. Bounded virtual-market reference only.`,
    }];
  });
}

/**
 * Renders the official dynamic page through an explicitly configured CDP browser.
 * There is no HTTP-only fallback: a static marketing shell is not an oracle.
 */
export async function renderOfficialF1LiveLite({ cdpUrl = process.env.F1_LIVE_LITE_CDP_URL } = {}) {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new Error("playwright-core is required for dynamic F1 Live Lite rendering.");
  }
  const browser = cdpUrl
    ? await chromium.connectOverCDP(cdpUrl)
    : await chromium.launch({ executablePath: process.env.F1_LIVE_LITE_CHROMIUM_PATH ?? "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(F1_LIVE_LITE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const consent = page.getByRole("button", { name: /accept all|essential only cookies/i });
    if (await consent.count()) await consent.first().click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await page.waitForFunction(() => /\bPOS\b[\s\S]*\bDRIVER\b[\s\S]*\bGAP\b[\s\S]*\bPIT\b/i.test(document.body.innerText), undefined, { timeout: 35_000 });
    return await page.locator("table tr").evaluateAll((rows) => rows.map((row) => {
      const cells = [...row.querySelectorAll("td")].map((cell) => cell.innerText.trim().replace(/\s+/g, " "));
      if (cells.length < 8 || !/^\d{1,2}$/.test(cells[0])) return "";
      const pit = /^\d+$/.test(cells[7] ?? "") ? cells[7] : "0";
      return `${cells[0]} ${String(cells[1]).split(" ")[0]} ${cells[2]} ${pit}`;
    }).filter(Boolean).join("\n"));
  } finally {
    await page.close();
    await browser.close();
  }
}

export async function fetchF1LiveLiteLeaderboard({ render = renderOfficialF1LiveLite } = {}) {
  return parseF1LiveLiteLeaderboard(await render());
}
