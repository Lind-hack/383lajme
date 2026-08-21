#!/usr/bin/env node
/**
 * Read NaftaSot through a real browser, then push the prices to 383.
 *
 * A plain fetch from a datacenter IP gets Cloudflare's "Just a moment..."
 * interstitial — measured 403 from both a GitHub runner and Vercel's render
 * path, against 200 from a residential connection. That interstitial is a
 * JavaScript challenge, not a hard block, so the way through is to be a client
 * that can run it. Chromium does; curl cannot.
 *
 * Everything after the fetch is deliberately identical to
 * scripts/push-fuel-prices.mjs, which remains the manual fallback for a
 * residential machine if Cloudflare ever escalates beyond what a browser
 * clears.
 *
 *   CRON_SECRET=... node scripts/fetch-fuel-via-browser.mjs [--site URL] [--dry]
 */

// playwright-core is the dependency this repo already carries; the workflow
// installs the matching Chromium binary separately.
import { chromium } from "playwright-core";

const SITE = argValue("--site") ?? "https://www.383ks.com";
const DRY = process.argv.includes("--dry");
const SECRET = process.env.CRON_SECRET ?? process.env.TREGU_AUTOMATION_SECRET ?? "";

const BOOTSTRAP = "https://api.naftasot.com/api/public/bootstrap?sort_by=cheapest";
const BRANDS = ["Shell Kosova", "IP Petrol", "Petrol Company"];

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** The newest published price for one fuel across a brand's stations. Per fuel,
 *  not per station: each price carries its own updated_at and they diverge by
 *  days, so one station's newest date does not describe all three. */
function freshestFuel(stations, fuelName) {
  let best = null;
  for (const station of stations) {
    const fuel = (station.fuel_types ?? []).find(
      (item) => (item.fuel_type_name ?? "").toLocaleLowerCase("sq") === fuelName,
    );
    const price = parseNumber(fuel?.price);
    if (price === null) continue;
    const stamp = Date.parse(fuel?.updated_at ?? station.last_price_update ?? "");
    const bestStamp = best ? Date.parse(best.updatedAt ?? "") : -Infinity;
    if (!best || (Number.isFinite(stamp) && stamp > bestStamp)) {
      best = {
        price,
        updatedAt: fuel?.updated_at ?? station.last_price_update ?? null,
        station: station.name ?? null,
      };
    }
  }
  return best ?? { price: null, updatedAt: null, station: null };
}

function buildSnapshot(stations) {
  const brands = BRANDS.map((brand) => {
    const matches = stations.filter((s) => s.brand_name === brand);
    const diesel = freshestFuel(matches, "dizel");
    const petrol = freshestFuel(matches, "benzinë");
    const gas = freshestFuel(matches, "gaz");
    const stamps = [diesel.updatedAt, petrol.updatedAt, gas.updatedAt].filter(Boolean).sort();
    return {
      brand,
      station: diesel.station ?? petrol.station ?? gas.station,
      diesel: diesel.price,
      petrol: petrol.price,
      gas: gas.price,
      updatedAt: stamps[0] ?? null,
      freshestAt: stamps[stamps.length - 1] ?? null,
    };
  });
  return { brands, sourceUrl: "https://naftasot.com/", fallback: false };
}

/**
 * Fetch the bootstrap JSON from inside a browser context.
 *
 * The site is visited first so Cloudflare can issue and settle its challenge
 * against the origin; the API call is then made from that page, carrying the
 * clearance cookie and a genuine browser TLS fingerprint. Requesting the API
 * URL directly as a navigation returns the JSON wrapped in the browser's
 * viewer, which is harder to read back reliably.
 */
async function readStations() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      locale: "sq-AL",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto("https://naftasot.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    // The interstitial reloads itself once solved; give it room to do so.
    await page.waitForTimeout(6000);
    const title = await page.title();
    console.log(`origin title after challenge: ${JSON.stringify(title)}`);

    const result = await page.evaluate(async (url) => {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const text = await res.text();
      return { status: res.status, text: text.slice(0, 2_000_000) };
    }, BOOTSTRAP);

    console.log(`api status through the browser: ${result.status}`);
    if (result.status !== 200) {
      throw new Error(`API returned ${result.status}: ${result.text.slice(0, 160)}`);
    }

    const payload = JSON.parse(result.text);
    const stations = Array.isArray(payload.stations) ? payload.stations : [];
    if (stations.length === 0) throw new Error("no stations in payload");
    return stations;
  } finally {
    await browser.close();
  }
}

const stations = await readStations();
console.log(`stations: ${stations.length}`);

const snapshot = buildSnapshot(stations);
for (const b of snapshot.brands) {
  console.log(
    `  ${b.brand.padEnd(16)} ${b.diesel ?? "—"} / ${b.petrol ?? "—"} / ${b.gas ?? "—"}   ` +
      `${(b.updatedAt ?? "").slice(0, 10)} → ${(b.freshestAt ?? "").slice(0, 10)}`,
  );
}

// A snapshot with no diesel anywhere means the feed shape changed; publishing
// it would blank the card more convincingly than the stale prices it replaces.
if (!snapshot.brands.some((b) => b.diesel !== null)) {
  console.error("No diesel price on any brand — the feed shape has changed. Nothing pushed.");
  process.exit(1);
}

if (DRY) {
  console.log("\n--dry: nothing posted.");
  process.exit(0);
}

if (!SECRET) {
  console.error("CRON_SECRET is not set, so there is nothing to authenticate with.");
  process.exit(1);
}

const post = await fetch(`${SITE}/api/automation/fuel`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
  body: JSON.stringify({ snapshot, fetchedAt: new Date().toISOString() }),
});

const body = await post.text();
console.log(`\nPOST ${SITE}/api/automation/fuel → ${post.status}`);
console.log(body.slice(0, 300));
process.exit(post.ok ? 0 : 1);
