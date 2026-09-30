import test from "node:test";
import assert from "node:assert/strict";
import { occasionFor } from "./dardani-occasions.mjs";

test("ordinary days have no occasion", () => {
  assert.equal(occasionFor(new Date("2026-10-14T12:00:00Z"), []), null);
});

test("the national days swap in their flags", () => {
  assert.equal(occasionFor(new Date("2026-11-28T12:00:00Z"), [])?.still, "flag-albania");
  assert.equal(occasionFor(new Date("2027-02-17T12:00:00Z"), [])?.still, "flag-kosovo");
});

test("new year covers both 31 Dhjetor and 1 Janar", () => {
  assert.equal(occasionFor(new Date("2026-12-31T10:00:00Z"), [])?.still, "new-year");
  assert.equal(occasionFor(new Date("2027-01-01T10:00:00Z"), [])?.still, "new-year");
  assert.equal(occasionFor(new Date("2027-01-02T10:00:00Z"), []), null);
});

test("the date is Kosovo's, not the reader's", () => {
  // 23:30 UTC on 27 November is already 28 November in Prishtina (UTC+1).
  assert.equal(occasionFor(new Date("2026-11-27T23:30:00Z"), [])?.still, "flag-albania");
  assert.equal(occasionFor(new Date("2026-11-27T22:30:00Z"), []), null);
});

test("match days come from the config list", () => {
  const days = ["2026-10-11"];
  assert.equal(occasionFor(new Date("2026-10-11T18:00:00Z"), days)?.still, "matchday-scarf");
  assert.equal(occasionFor(new Date("2026-10-12T18:00:00Z"), days), null);
});

test("a national day wins over a match on the same date", () => {
  assert.equal(occasionFor(new Date("2026-11-28T18:00:00Z"), ["2026-11-28"])?.still, "flag-albania");
});
