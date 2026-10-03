import assert from "node:assert/strict";
import test from "node:test";
import { CHECKED_AT, EVENTS, PHRASES, PRICES, arrivalItems, entryFromCrossing, eventsFor, pricesAreStale, routeWarnings } from "./help.mjs";

const ids = (list) => list.map((item) => item.id);

test("route rules for the six common routes", () => {
  assert.deepEqual(ids(routeWarnings({ entry: "albania", exit: "serbia" })), ["serbiaExit", "insurance", "drivingRules", "passport"]);
  assert.deepEqual(ids(routeWarnings({ entry: "north-macedonia", exit: "serbia" })), ["serbiaExit", "insurance", "drivingRules", "passport"]);
  assert.deepEqual(ids(routeWarnings({ entry: "serbia", exit: "albania" })), ["insurance", "drivingRules", "passport"]);
  assert.deepEqual(ids(routeWarnings({ entry: "serbia", exit: "serbia" })), ["insurance", "drivingRules", "passport"]);
  assert.deepEqual(ids(routeWarnings({ entry: "fly", exit: "fly" })), ["passport"]);
  assert.deepEqual(ids(routeWarnings({ entry: "fly", exit: "serbia" })), ["serbiaExit", "passport"]);
  assert.deepEqual(ids(routeWarnings({ entry: "nowhere", exit: undefined })), ["passport"]);
});

test("crossings map to the country on the other side", () => {
  assert.equal(entryFromCrossing("merdare", "drive"), "serbia");
  assert.equal(entryFromCrossing("vermice-morine", "drive"), "albania");
  assert.equal(entryFromCrossing("kulle", "fly"), "fly");
});

test("arrival differs for flying and driving", () => {
  assert.deepEqual(ids(arrivalItems("fly")), ["bus", "taxi", "sim", "money"]);
  assert.deepEqual(ids(arrivalItems("drive")), ["insuranceDesk", "documents", "sim", "money"]);
});

test("events overlap the stay, including ranges that wrap the year", () => {
  assert.deepEqual(ids(eventsFor({ startDate: "2026-12-20", days: 20 })), ["skiSeason", "christmasCatholic", "newYear", "christmasOrthodox"]);
  assert.deepEqual(ids(eventsFor({ startDate: "2027-02-15", days: 4 })), ["skiSeason", "independenceDay"]);
  assert.deepEqual(ids(eventsFor({ month: 11 })), ["flagDay"]);
  assert.deepEqual(ids(eventsFor({ month: 7 })), []);
  assert.deepEqual(eventsFor({}), []);
});

test("prices go stale after 120 days", () => {
  assert.equal(pricesAreStale(new Date(CHECKED_AT)), false);
  assert.equal(pricesAreStale(new Date(Date.parse(CHECKED_AT) + 121 * 86_400_000)), true);
});

test("every curated item has a source, and both languages", () => {
  const all = [...routeWarnings({ entry: "albania", exit: "serbia" }), ...arrivalItems("fly"), ...arrivalItems("drive"), ...EVENTS];
  for (const item of all) {
    assert.match(item.source.url, /^https:\/\//, item.id);
    assert.ok(item.title.en && item.title.sq && item.body.en && item.body.sq, item.id);
  }
  for (const price of PRICES) assert.ok(price.label.en && price.label.sq && price.eur > 0 && price.source.url, price.id);
  for (const phrase of PHRASES) assert.ok(phrase.sq && phrase.en, phrase.id);
});
