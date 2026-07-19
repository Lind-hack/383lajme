const F1_LIVE_LITE_URL = "https://www.formula1.com/en/timing/f1-live-lite";
const BELGIAN_GP_PREFIX = "f1-belgjika-spa-fiton-";

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stateKey(rows) {
  return JSON.stringify(rows.map(({ position, driver, gap, pits }) => ({ position, driver, gap, pits })));
}

/**
 * Parses text extracted from the rendered, official F1 Live Lite leaderboard.
 * It deliberately requires every row to contain position, driver, gap and pits:
 * a static marketing shell therefore cannot become an oracle observation.
 */
export function parseF1LiveLiteLeaderboard(renderedText) {
  const rows = String(renderedText ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .flatMap((line) => {
      const match = line.match(/^(\d{1,2})\s+(.+?)\s+((?:\+|-)?(?:\d+:)?\d{1,2}:\d{2}(?:\.\d+)?|(?:\+|-)?\d+(?:\.\d+)?|LAP\s+\d+)\s+(\d{1,2})$/i);
      if (!match) return [];
      const position = Number(match[1]);
      const driver = match[2].trim();
      const pits = Number(match[4]);
      if (!Number.isInteger(position) || position < 1 || !driver || !Number.isInteger(pits) || pits < 0) return [];
      return [{ position, driver, gap: match[3].toUpperCase() === "LEADER" ? "LEADER" : match[3], pits }];
    })
    .sort((a, b) => a.position - b.position);
  if (rows.length < 2 || new Set(rows.map((row) => row.position)).size !== rows.length) {
    throw new Error("Official F1 Live Lite render did not expose a complete usable leaderboard.");
  }
  return { source_url: F1_LIVE_LITE_URL, rows, state_key: stateKey(rows) };
}

function referenceProbability(position) {
  if (position === 1) return 0.62;
  if (position === 2) return 0.36;
  if (position === 3) return 0.18;
  if (position === 4) return 0.11;
  if (position === 5) return 0.07;
  return 0.03;
}

function driverForMarket(market, rows) {
  const suffix = String(market?.slug ?? "").slice(BELGIAN_GP_PREFIX.length);
  const wanted = normalize(suffix);
  if (!wanted) return null;
  return rows.find((row) => {
    const driver = normalize(row.driver);
    return driver === wanted || driver.includes(wanted) || wanted.includes(driver);
  }) ?? null;
}

/** Builds only materially changed F1 observations for the ten configured Belgian GP binary markets. */
export function buildF1MarketPlan({ markets, leaderboard }) {
  return (markets ?? []).flatMap((market) => {
    if (market?.status !== "open" || !String(market?.slug ?? "").startsWith(BELGIAN_GP_PREFIX)) return [];
    if (market?.live_score_state?.key === leaderboard.state_key) return [];
    const row = driverForMarket(market, leaderboard.rows);
    if (!row) return [];
    const reference_probability = referenceProbability(row.position);
    return [{
      market,
      row,
      state_key: leaderboard.state_key,
      reference_probability,
      oracle_cap: 0.05,
      evidence: [{
        title: `Official F1 Live Lite: P${row.position} ${row.driver}, ${row.gap}, ${row.pits} pit stop${row.pits === 1 ? "" : "s"}`,
        url: leaderboard.source_url,
        slug: "formula1:f1-live-lite",
      }],
      reasoning: `Official F1 Live Lite rendered leaderboard: P${row.position}, gap ${row.gap}, ${row.pits} pit stop${row.pits === 1 ? "" : "s"}. Bounded virtual-market reference only.`,
    }];
  });
}

/**
 * Renders the official dynamic page through a configured CDP browser. No HTTP-only
 * fallback exists, because the static response is not a leaderboard observation.
 */
export async function renderOfficialF1LiveLite({ cdpUrl = process.env.F1_LIVE_LITE_CDP_URL } = {}) {
  if (!cdpUrl) throw new Error("F1_LIVE_LITE_CDP_URL is required to render the official F1 Live Lite page.");
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new Error("playwright-core is required for dynamic F1 Live Lite rendering.");
  }
  const browser = await chromium.connectOverCDP(cdpUrl);
  try {
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = await context.newPage();
    await page.goto(F1_LIVE_LITE_URL, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForFunction(() => /\bPOS\b[\s\S]*\bPITS\b/i.test(document.body.innerText), undefined, { timeout: 20_000 });
    return await page.locator("body").innerText();
  } finally {
    await browser.close();
  }
}

export async function fetchF1LiveLiteLeaderboard({ render = renderOfficialF1LiveLite } = {}) {
  return parseF1LiveLiteLeaderboard(await render());
}
