#!/usr/bin/env node
// X's trends for the clip scout, read off x.com/explore the way a person sees them, as
// OpenCLI (and Agent-Reach, which runs it) does: twscrape cannot, X answers its trends
// request with a server error. Headless Chromium, the spare account's cookies.txt, and the
// HyperFrames copy of puppeteer-core already on the VPS. The trends are for the account's
// Explore location (Kosovo).
//
//   node x_trends.mjs <cookies.txt> [limit]   ->   {"trends": [{"topic", "category", "tab"}]}
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const HF = process.env.L383_SCOUT_PUPPETEER || "/opt/data/video-edition/hf/package.json";
const CHROME = process.env.L383_SCOUT_CHROME || "/usr/bin/chromium";
const TABS = ["trending", "news"];

function cookies(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).flatMap((line) => {
    const raw = line.startsWith("#HttpOnly_") ? line.slice(10) : line;
    const p = raw.split("\t");
    if (raw.startsWith("#") || p.length < 7) return [];
    return [{ name: p[5], value: p[6].trim(), domain: p[0], path: p[2] || "/", secure: p[3] === "TRUE", httpOnly: line.startsWith("#HttpOnly_") }];
  });
}

const [jar, limitArg] = process.argv.slice(2);
const limit = Number(limitArg) || 20;
const puppeteer = createRequire(HF)("puppeteer-core");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--lang=en-US"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 2000 });
  await browser.setCookie(...cookies(jar).filter((c) => /(^|\.)(x|twitter)\.com$/.test(c.domain.replace(/^\./, ""))));
  const trends = [];
  for (const tab of TABS) {
    await page.goto(`https://x.com/explore/tabs/${tab}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (/\/(login|i\/flow)/.test(page.url())) throw new Error("X cookie expired: re-export x.com_cookies.txt");
    try {
      await page.waitForSelector('[data-testid="trend"]', { timeout: 20000 });
    } catch {
      continue;  // a tab X shows no trends on
    }
    // Each trend cell: divs[0] rank and category ("1 · Trending in Kosovo"), divs[1] the topic.
    const found = await page.evaluate(() => [...document.querySelectorAll('[data-testid="trend"]')].flatMap((cell) => {
      const divs = cell.querySelector(":scope > div")?.children || [];
      if ((cell.textContent || "").includes("Promoted") || divs.length < 2) return [];
      const topic = divs[1].textContent.trim();
      return topic ? [{ topic, category: divs[0].textContent.replace(/^\d+\s*/, "").replace(/^·\s*/, "").trim() }] : [];
    }));
    for (const t of found) if (!trends.some((x) => x.topic === t.topic)) trends.push({ ...t, tab });
  }
  console.log(JSON.stringify({ trends: trends.slice(0, limit * TABS.length) }));
} catch (err) {
  console.log(JSON.stringify({ error: String(err?.message || err).slice(0, 200) }));
} finally {
  await browser.close();
}
