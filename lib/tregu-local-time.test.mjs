import test from "node:test";
import assert from "node:assert/strict";
import { formatKosovoTime, formatKosovoDate, formatKosovoDateTime } from "./tregu-local-time.mjs";

test("Kosovo time across the summer/winter switch", () => {
  assert.equal(formatKosovoTime("2026-10-03T18:45:00Z"), "20:45");
  assert.equal(formatKosovoTime("2026-11-03T18:45:00Z"), "19:45");
  assert.equal(formatKosovoTime("2026-10-03T18:45:07Z", { seconds: true }), "20:45:07");
});

test("dates are dd.mm on Kosovo's calendar, not UTC's", () => {
  assert.equal(formatKosovoDate("2026-10-03T22:30:00Z"), "04.10");
  assert.equal(formatKosovoDate("2026-10-03T22:30:00Z", { year: true }), "04.10.2026");
  assert.equal(formatKosovoDateTime("2026-10-03T22:30:00Z"), "04.10, 00:30");
});

test("bad input reads as a dash, never Invalid Date", () => {
  assert.equal(formatKosovoTime("nope"), "—");
  assert.equal(formatKosovoDate(undefined), "—");
  assert.equal(formatKosovoDateTime(null), "—");
});
