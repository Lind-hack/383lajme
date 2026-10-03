import assert from "node:assert/strict";
import test from "node:test";
import { PLACES } from "./places.mjs";
import { MAX_ACCURACY_M, checkStamp, distanceM, signStamp, stampPlaceId, stampRadiusM, verifyStamp } from "./stamps.mjs";

const fortress = PLACES.find((p) => p.id === "prizren-kalaja-e-prizrenit");
const rugova = PLACES.find((p) => p.id === "peje-gryka-e-rugoves");
const noCoords = PLACES.find((p) => !p.coords);
const at = (place, dLat = 0) => ({ latitude: place.coords.lat + dLat, longitude: place.coords.lon, accuracy: 30 });

test("standing at a place earns a stamp; a few hundred metres off does not, per place size", () => {
  assert.equal(stampRadiusM(fortress), 300);
  assert.equal(stampRadiusM(rugova), 1500);
  assert.deepEqual(checkStamp({ placeId: fortress.id, ...at(fortress, 0.001) }), { ok: true, placeId: fortress.id }); // ~110 m
  assert.equal(checkStamp({ placeId: fortress.id, ...at(fortress, 0.005) }).code, "too_far"); // ~550 m
  assert.equal(checkStamp({ placeId: rugova.id, ...at(rugova, 0.01) }).ok, true); // ~1.1 km in a canyon
});

test("bad accuracy, unknown places and unverified places are refused", () => {
  assert.equal(checkStamp({ placeId: fortress.id, ...at(fortress), accuracy: MAX_ACCURACY_M + 1 }).code, "low_accuracy");
  assert.equal(checkStamp({ placeId: fortress.id, latitude: "x", longitude: 1, accuracy: 10 }).code, "low_accuracy");
  assert.equal(checkStamp({ placeId: "nowhere", latitude: 42, longitude: 20, accuracy: 10 }).code, "unknown_place");
  assert.equal(checkStamp({ placeId: noCoords.id, latitude: 42, longitude: 20, accuracy: 10 }).code, "no_location");
});

test("a too-far answer gives a rounded distance, never the raw position", () => {
  const res = checkStamp({ placeId: fortress.id, ...at(fortress, 0.0123) });
  assert.equal(res.distanceM % 100, 0);
  assert.equal(Object.keys(res).sort().join(","), "code,distanceM,ok");
});

test("stamps are bound to the card: a copy on another card fails", () => {
  const stamp = signStamp("s3cret", fortress.id, "seedaaaa", Date.UTC(2026, 9, 3));
  assert.equal(verifyStamp("s3cret", stamp, "seedaaaa"), true);
  assert.equal(verifyStamp("s3cret", stamp, "seedbbbb"), false);
  assert.equal(verifyStamp("other", stamp, "seedaaaa"), false);
  assert.equal(verifyStamp("s3cret", stamp.replace(/.$/, "0") === stamp ? stamp.replace(/.$/, "1") : stamp.replace(/.$/, "0"), "seedaaaa"), false);
  assert.equal(stampPlaceId(stamp), fortress.id);
  assert.equal(stampPlaceId("garbage"), null);
});

test("distance is sane", () => {
  assert.ok(Math.abs(distanceM({ lat: 42.2, lon: 20.74 }, { lat: 42.21, lon: 20.74 }) - 1112) < 5);
});
