// Export Kosovo's police stations, fuel stations and emergency-capable
// hospitals from OpenStreetMap into lib/visit-places-kosovo.json, which
// "help near you" (app/api/visit/nearby) searches locally. A live Overpass
// call per visitor proved unreliable (busy mirrors left 5 of 7 cities with
// no police or fuel in a production check on 2026-10-04); places like these
// change rarely, so a monthly refresh is enough.
//
//   node scripts/xhep-export-places.mjs            # fetch from Overpass
//   node scripts/xhep-export-places.mjs dump.json  # from a saved response
import fs from "node:fs";

const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const QUERY = '[out:json][timeout:180];area["ISO3166-1"="XK"][admin_level=2]->.k;(nwr(area.k)[amenity~"^(police|fuel|hospital|clinic)$"];);out center tags;';

async function fetchDump() {
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "383ks.com places export (+https://383ks.com/visit)" },
        body: new URLSearchParams({ data: QUERY }),
        signal: AbortSignal.timeout(240_000),
      });
      const text = await res.text();
      if (res.ok && text.startsWith("{")) return JSON.parse(text);
      console.warn(`${url}: ${res.status}`);
    } catch (error) {
      console.warn(`${url}: ${error.message}`);
    }
  }
  throw new Error("every Overpass mirror failed");
}

const dump = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], "utf8")) : await fetchDump();
const keep = [];
for (const e of dump.elements ?? []) {
  const t = e.tags ?? {};
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (lat == null || lon == null) continue;
  const name = t["name:sq"] || t.name || "";
  // Clinics only when they are a family-medicine centre or name an emergency service.
  if (t.amenity === "clinic" && !/qkmf|urgjenc|emergjenc/i.test(name)) continue;
  const kind = t.amenity === "clinic" ? "hospital" : t.amenity;
  const row = { k: kind, n: name, lat: +lat.toFixed(5), lon: +lon.toFixed(5) };
  for (const tag of ["name:en", "emergency", "opening_hours", "brand", "wikimedia_commons", "image", "police"]) if (t[tag]) row[tag] = t[tag];
  row.osm = `${e.type}/${e.id}`;
  keep.push(row);
}
keep.sort((a, b) => a.k.localeCompare(b.k) || a.lat - b.lat);
const out = { source: "© OpenStreetMap contributors (ODbL)", exportedAt: new Date().toISOString().slice(0, 10), places: keep };
fs.writeFileSync(new URL("../lib/visit-places-kosovo.json", import.meta.url), JSON.stringify(out));
const counts = keep.reduce((c, p) => ((c[p.k] = (c[p.k] ?? 0) + 1), c), {});
console.log("wrote", keep.length, "places", counts);
