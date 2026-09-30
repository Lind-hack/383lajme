import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStreak } from "./perty-streak.mjs";

const at = (iso) => new Date(iso);

test("the first visit starts a streak of one", () => {
  assert.deepEqual(nextStreak(null, at("2026-09-30T10:00:00Z")), { day: "2026-09-30", count: 1 });
});

test("a second visit the same day does not count twice", () => {
  assert.deepEqual(nextStreak({ day: "2026-09-30", count: 3 }, at("2026-09-30T20:00:00Z")), { day: "2026-09-30", count: 3 });
});

test("the next day adds one, across a month end", () => {
  assert.deepEqual(nextStreak({ day: "2026-09-30", count: 3 }, at("2026-10-01T09:00:00Z")), { day: "2026-10-01", count: 4 });
});

test("a missed day starts again", () => {
  assert.deepEqual(nextStreak({ day: "2026-09-27", count: 9 }, at("2026-09-30T09:00:00Z")), { day: "2026-09-30", count: 1 });
});

test("the day is Kosovo's: 23:30 UTC is already tomorrow there", () => {
  assert.deepEqual(nextStreak({ day: "2026-09-30", count: 2 }, at("2026-09-30T23:30:00Z")), { day: "2026-10-01", count: 3 });
});

test("junk in storage is ignored", () => {
  assert.deepEqual(nextStreak({ day: "yesterday", count: "lots" }, at("2026-09-30T10:00:00Z")), { day: "2026-09-30", count: 1 });
});
