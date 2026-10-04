import { test } from "node:test";
import assert from "node:assert/strict";
import { HOSPITALS, rankPlace, pickBest, crowKm, photoMatchesName } from "./visit-emergency.mjs";

test("a sports-medicine, dental or private clinic is never the emergency hospital", () => {
  assert.equal(rankPlace("hospital", { name: "Qendra e Mjekesise Sportive" }), null);
  assert.equal(rankPlace("hospital", { name: "Dream Hospital - Dr. Bajrami" }), null);
  assert.equal(rankPlace("hospital", { name: "Klinika Dentare Smile" }), null);
  assert.equal(rankPlace("hospital", { name: "Spitali Rajonal i Pejës", emergency: "yes" }), 0);
  assert.equal(rankPlace("hospital", { name: "Spitali i Ferizajt" }), 1);
});

test("a police station outranks the headquarters", () => {
  assert.ok(rankPlace("police", { name: "Drejtoria e Përgjithshme e Policisë" }) > rankPlace("police", { name: "Stacioni Policor Qendra" }));
});

test("the closest of the suitable places wins, unless it is much slower to reach", () => {
  const hq = { name: "HQ", rank: 4, minutes: 2 };
  const station = { name: "Station", rank: 0, minutes: 6 };
  assert.equal(pickBest([hq, station]).name, "Station");
  const far = { name: "Far station", rank: 0, minutes: 40 };
  const near = { name: "Near post", rank: 1, minutes: 3 };
  assert.equal(pickBest([far, near]).name, "Near post");
  assert.equal(pickBest([{ rank: null, minutes: 1 }]), null);
});

test("every listed hospital sits inside Kosovo near its town", () => {
  for (const h of HOSPITALS) {
    assert.ok(h.lat > 41.8 && h.lat < 43.3 && h.lon > 20 && h.lon < 21.8, h.name);
    assert.match(h.osm, /^https:\/\/www\.openstreetmap\.org\/(way|node|relation)\/\d+$/);
  }
  assert.ok(Math.abs(crowKm({ lat: 42.6629, lon: 21.1655 }, { lat: 42.2139, lon: 20.7397 }) - 61) < 3);
});

test("a photo must name the place, not just stand near it", () => {
  assert.equal(photoMatchesName("File:Isa Grezda hospital Gjakova.jpg", "Spitali Rajonal “Isa Grezda”"), true);
  assert.equal(photoMatchesName("File:Street in Prishtina 2019.jpg", "Stacioni Policor Qendra"), false);
});

test("every border crossing point sits on the Kosovo side of its checkpoint, not in a neighbour", async () => {
  const { BORDER_CROSSINGS } = await import("./visit-v2-data.ts");
  assert.equal(BORDER_CROSSINGS.length, 4);
  // Checked against OpenStreetMap border-control nodes on 2026-10-04.
  const CHECKPOINTS = { kulle: [42.80039, 20.22122], merdare: [42.93684, 21.2465], "hani-i-elezit": [42.13858, 21.30479], "vermice-morine": [42.15614, 20.54893] };
  for (const c of BORDER_CROSSINGS) {
    const [lat, lon] = CHECKPOINTS[c.id];
    assert.ok(crowKm({ lat: c.latitude, lon: c.longitude }, { lat, lon }) < 1, `${c.id} is more than 1 km from its checkpoint`);
  }
});
