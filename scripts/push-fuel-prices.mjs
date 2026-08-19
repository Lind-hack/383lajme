#!/usr/bin/env node
/**
 * Read NaftaSot and post the prices to 383.
 *
 * Run this from a machine Cloudflare allows. Measured on 2026-08-19, the API
 * answers 200 from a residential connection and 403 "Just a moment..." from
 * both Vercel's render path and a GitHub Actions runner, and returns 500 to any
 * request carrying an Origin header — so the site cannot fetch it from the
 * server, from CI, or from the reader's browser. Something outside all three
 * has to do the reading.
 *
 *   CRON_SECRET=... node scripts/push-fuel-prices.mjs
 *
 * Options:
 *   --site https://www.383ks.com   where to post (default production)
 *   --dry                          fetch and print, post nothing
 *
 * Daily is enough: NaftaSot's own prices move at most once a day, and the
 * diesel, petrol and gas timestamps drift days apart from each other anyway.
 */

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

/**
 * The newest published price for one fuel across a brand's stations.
 *
 * Per fuel, not per station: each price carries its own updated_at and they
 * diverge by days, so one station's newest date does not describe all three.
 */
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
    const stamps = [diesel.updatedAt, petrol.updatedAt, gas.updatedAt]
      .filter(Boolean)
      .sort();
    return {
      brand,
      station: diesel.station ?? petrol.station ?? gas.station,
      diesel: diesel.price,
      petrol: petrol.price,
      gas: gas.price,
      // Oldest, because that is the age of the row as a whole.
      updatedAt: stamps[0] ?? null,
      freshestAt: stamps[stamps.length - 1] ?? null,
    };
  });

  return { brands, sourceUrl: "https://naftasot.com/", fallback: false };
}

const response = await fetch(BOOTSTRAP, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/json",
  },
});

if (!response.ok) {
  const body = await response.text().catch(() => "");
  console.error(`NaftaSot returned ${response.status}. ${body.slice(0, 160)}`);
  if (body.includes("Just a moment")) {
    console.error(
      "That is Cloudflare's challenge — this machine's IP is not allowed. Run it from a residential connection.",
    );
  }
  process.exit(1);
}

const payload = await response.json();
const stations = Array.isArray(payload.stations) ? payload.stations : [];
if (stations.length === 0) {
  console.error("NaftaSot returned no stations; refusing to push an empty snapshot.");
  process.exit(1);
}

const snapshot = buildSnapshot(stations);
for (const b of snapshot.brands) {
  console.log(
    `${b.brand.padEnd(16)} ${b.diesel ?? "—"} / ${b.petrol ?? "—"} / ${b.gas ?? "—"}   ` +
      `${(b.updatedAt ?? "").slice(0, 10)} → ${(b.freshestAt ?? "").slice(0, 10)}`,
  );
}

// A snapshot with no diesel anywhere means the shape changed; publishing it
// would blank the card more convincingly than the stale prices it replaces.
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
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SECRET}`,
  },
  body: JSON.stringify({ snapshot, fetchedAt: new Date().toISOString() }),
});

const result = await post.text();
console.log(`\nPOST ${SITE}/api/automation/fuel → ${post.status}`);
console.log(result.slice(0, 300));
process.exit(post.ok ? 0 : 1);
