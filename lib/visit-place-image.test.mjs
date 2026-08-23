import assert from "node:assert/strict";
import test from "node:test";
import {
  exactOsmImageReference,
  namesDescribeSamePlace,
  normalizePlaceName,
  selectExactGoogleCandidate,
} from "./visit-place-image.mjs";

test("normalizes Albanian accents and business suffixes", () => {
  assert.equal(normalizePlaceName("Policia e Kosovës SH.P.K."), "policia e");
  assert.equal(namesDescribeSamePlace("Petrol Company", "Petrol Company Kosovo"), true);
});

test("rejects a nearby landmark with a different identity", () => {
  const place = { name: "Petrol Company", latitude: 42.659, longitude: 20.292 };
  const museum = {
    displayName: { text: "Muzeu i Pejës" },
    location: { latitude: 42.66, longitude: 20.293 },
    photos: [{ name: "places/museum/photos/one" }],
  };
  assert.equal(selectExactGoogleCandidate(place, [museum], () => 0.05), null);
});

test("requires both identity and a 150 metre coordinate match", () => {
  const place = { name: "Petrol Company", latitude: 42.659, longitude: 20.292 };
  const exact = {
    displayName: { text: "Petrol Company" },
    location: { latitude: 42.6591, longitude: 20.2921 },
    photos: [{ name: "places/fuel/photos/one" }],
  };
  assert.equal(selectExactGoogleCandidate(place, [exact], () => 0.04), exact);
  assert.equal(selectExactGoogleCandidate(place, [exact], () => 0.16), null);
});

test("accepts only file-level Commons references from the exact OSM object", () => {
  assert.equal(exactOsmImageReference({ wikimedia_commons: "File:Exact place.jpg" }), "File:Exact place.jpg");
  assert.equal(exactOsmImageReference({ wikimedia_commons: "Category:Peja" }), null);
  assert.equal(exactOsmImageReference({ image: "https://example.com/nearby.jpg" }), null);
});
