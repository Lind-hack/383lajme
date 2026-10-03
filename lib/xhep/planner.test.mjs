import assert from "node:assert/strict";
import test from "node:test";
import { PLACES } from "./places.mjs";
import { DAY_BUDGET_MIN, planTrip } from "./planner.mjs";

const ids = new Set(PLACES.map((p) => p.id));

test("only catalogue places, never over the daily budget unless a single stop is long", () => {
  for (const profile of [
    { cities: ["prizren"], days: 1, interests: ["food"] },
    { cities: ["peje", "prizren"], days: 5, interests: ["nature"] },
    { cities: ["prishtine", "gjakove", "ferizaj"], days: 7, interests: ["history", "coffee"], travellerType: "family" },
    { cities: ["ferizaj"], days: 3, interests: ["skiing"] },
  ]) {
    const plan = planTrip(profile);
    assert.equal(plan.length, profile.days);
    for (const day of plan) {
      assert.ok(day.stops.length >= 1 && day.stops.length <= 4);
      for (const stop of day.stops) assert.ok(ids.has(stop.placeId), stop.placeId);
      assert.ok(day.minutes <= DAY_BUDGET_MIN || day.stops.length === 1, `day ${day.day}: ${day.minutes}`);
    }
  }
});

test("days follow the route and interests lead the picks", () => {
  const plan = planTrip({ cities: ["peje", "prizren"], days: 2, interests: ["nature"] });
  assert.deepEqual(plan.map((d) => d.cityId), ["peje", "prizren"]);
  assert.ok(plan[0].stops.some((s) => s.placeId === "peje-gryka-e-rugoves"));
  const ski = planTrip({ cities: ["ferizaj"], days: 1, interests: ["skiing"] });
  assert.ok(ski[0].stops.some((s) => s.placeId === "ferizaj-brezovice"));
});

test("a city seen twice shows new places first", () => {
  const plan = planTrip({ cities: ["prizren"], days: 2, interests: ["history"] });
  const first = new Set(plan[0].stops.map((s) => s.placeId));
  assert.ok(plan[1].stops.some((s) => !first.has(s.placeId)));
});

test("stops are ordered morning, any, afternoon, evening", () => {
  const order = { morning: 0, any: 1, afternoon: 2, evening: 3 };
  for (const day of planTrip({ cities: ["prizren", "prishtine"], days: 4, interests: ["history", "food"] })) {
    const slots = day.stops.map((s) => order[s.slot]);
    assert.deepEqual(slots, [...slots].sort((a, b) => a - b));
  }
});

test("missing or hostile input still plans a day", () => {
  assert.equal(planTrip(null).length, 1);
  assert.equal(planTrip({ days: 999 }).length, 30);
});

test("every place has both languages and verified coords carry a source", () => {
  for (const p of PLACES) {
    assert.ok(p.description.en && p.description.sq && p.category.en && p.category.sq, p.id);
    if (p.coords) {
      assert.match(p.coords.source, /^https:\/\/www\.openstreetmap\.org\//, p.id);
      assert.ok(p.coords.lat > 41.8 && p.coords.lat < 43.3 && p.coords.lon > 20 && p.coords.lon < 21.8, p.id);
    }
  }
  assert.equal(new Set(PLACES.map((p) => p.id)).size, PLACES.length);
});
