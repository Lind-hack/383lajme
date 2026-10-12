import assert from "node:assert/strict";
import test from "node:test";

import {
  dateKeyInKosovo,
  shiftDateKey,
  previousDateKey,
  formatAlbanianDate,
  formatCount,
  THOUSANDS_SEPARATOR,
  advanceStreak,
  activeStreak,
  parseStreak,
  youtubeId,
} from "./reagimi-data.ts";

// ── dates ────────────────────────────────────────────────────────────────────

test("dateKeyInKosovo returns a YYYY-MM-DD key", () => {
  assert.match(dateKeyInKosovo(new Date("2026-08-16T12:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});

test("dateKeyInKosovo rolls at Kosovo midnight, not UTC midnight", () => {
  // 22:30 UTC on 16 Aug is already 00:30 on 17 Aug in Kosovo (CEST, UTC+2).
  // The shipped DailyPoll uses toISOString() and would still say the 16th here.
  assert.equal(dateKeyInKosovo(new Date("2026-08-16T22:30:00Z")), "2026-08-17");
  assert.equal(dateKeyInKosovo(new Date("2026-08-16T21:59:00Z")), "2026-08-16");
});

test("dateKeyInKosovo handles winter offset (CET, UTC+1)", () => {
  assert.equal(dateKeyInKosovo(new Date("2026-01-15T23:30:00Z")), "2026-01-16");
  assert.equal(dateKeyInKosovo(new Date("2026-01-15T22:30:00Z")), "2026-01-15");
});

test("shiftDateKey crosses months, years and leap days without DST drift", () => {
  assert.equal(shiftDateKey("2026-08-16", 1), "2026-08-17");
  assert.equal(shiftDateKey("2026-08-31", 1), "2026-09-01");
  assert.equal(shiftDateKey("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDateKey("2028-02-28", 1), "2028-02-29"); // 2028 is a leap year
  assert.equal(shiftDateKey("2027-02-28", 1), "2027-03-01");
  // Across the European DST switch (last Sunday of March 2026 = the 29th).
  assert.equal(shiftDateKey("2026-03-28", 1), "2026-03-29");
  assert.equal(shiftDateKey("2026-03-29", 1), "2026-03-30");
});

test("previousDateKey is the inverse of a one-day shift", () => {
  assert.equal(previousDateKey("2026-08-16"), "2026-08-15");
  assert.equal(previousDateKey("2026-01-01"), "2025-12-31");
});

test("formatAlbanianDate renders Albanian weekday and month names", () => {
  // 2026-08-16 is a Sunday.
  assert.equal(formatAlbanianDate("2026-08-16"), "E diel, 16 gusht");
  assert.equal(formatAlbanianDate("2026-08-17"), "E hënë, 17 gusht");
  assert.equal(formatAlbanianDate("2026-01-01"), "E enjte, 1 janar");
  assert.equal(formatAlbanianDate("2026-12-25"), "E premte, 25 dhjetor");
});

test("formatAlbanianDate returns empty string for malformed input rather than NaN", () => {
  assert.equal(formatAlbanianDate(""), "");
  assert.equal(formatAlbanianDate("not-a-date"), "");
});

test("formatCount groups thousands with a NO-BREAK space, not a plain one", () => {
  assert.equal(THOUSANDS_SEPARATOR, " ");
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(42), "42");
  assert.equal(formatCount(999), "999", "no separator below four digits");
  assert.equal(formatCount(1249), "1 249");
  assert.equal(formatCount(1000000), "1 000 000");
  assert.equal(formatCount(-5), "0", "negative counts clamp rather than render a minus");
  assert.equal(formatCount(12.7), "12", "fractional counts truncate");
  // Guard the actual regression: a plain space would let the number wrap mid-value.
  assert.ok(!formatCount(1249).includes(" "), "must not contain a plain space");
});

test("advanceStreak starts at one with no history", () => {
  assert.deepEqual(advanceStreak(null, "2026-08-16"), { lastDate: "2026-08-16", count: 1 });
});

test("advanceStreak increments on consecutive days", () => {
  const d1 = advanceStreak(null, "2026-08-14");
  const d2 = advanceStreak(d1, "2026-08-15");
  const d3 = advanceStreak(d2, "2026-08-16");
  assert.equal(d3.count, 3);
  assert.equal(d3.lastDate, "2026-08-16");
});

test("advanceStreak does not double count the same day", () => {
  const first = advanceStreak(null, "2026-08-16");
  assert.deepEqual(advanceStreak(first, "2026-08-16"), first);
});

test("advanceStreak resets after a missed day", () => {
  const stale = { lastDate: "2026-08-10", count: 9 };
  assert.deepEqual(advanceStreak(stale, "2026-08-16"), { lastDate: "2026-08-16", count: 1 });
});

test("activeStreak only counts today or yesterday", () => {
  assert.equal(activeStreak({ lastDate: "2026-08-16", count: 4 }, "2026-08-16"), 4);
  assert.equal(activeStreak({ lastDate: "2026-08-15", count: 4 }, "2026-08-16"), 4);
  assert.equal(activeStreak({ lastDate: "2026-08-14", count: 4 }, "2026-08-16"), 0);
  assert.equal(activeStreak(null, "2026-08-16"), 0);
});

test("parseStreak survives absent, malformed and legacy-shaped localStorage", () => {
  assert.equal(parseStreak(null), null);
  assert.equal(parseStreak(""), null);
  assert.equal(parseStreak("{{{"), null);
  assert.equal(parseStreak("null"), null);
  assert.equal(parseStreak('"a string"'), null);
  assert.equal(parseStreak("[]"), null);
  assert.equal(parseStreak('{"count":3}'), null); // legacy shape, no lastDate
  assert.equal(parseStreak('{"lastDate":"nope","count":3}'), null);
  assert.equal(parseStreak('{"lastDate":"2026-08-16","count":0}'), null);
  assert.equal(parseStreak('{"lastDate":"2026-08-16","count":"3"}'), null);
  assert.deepEqual(parseStreak('{"lastDate":"2026-08-16","count":3}'), {
    lastDate: "2026-08-16",
    count: 3,
  });
});

// ── video ────────────────────────────────────────────────────────────────────

test("youtubeId parses every URL shape the data layer produces", () => {
  assert.equal(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/watch?t=3&v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"), "dQw4w9WgXcQ");
});

test("youtubeId returns null for absent or unparseable input", () => {
  assert.equal(youtubeId(null), null);
  assert.equal(youtubeId(undefined), null);
  assert.equal(youtubeId(""), null);
  assert.equal(youtubeId("https://example.com/video"), null);
  assert.equal(youtubeId("https://youtu.be/tooshort"), null);
});

