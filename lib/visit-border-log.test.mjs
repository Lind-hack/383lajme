import assert from "node:assert/strict";
import test from "node:test";
import { borderLogRows, normalizeMpbUpdatedAt, shouldSkipBorderLog } from "./visit-border-log.ts";

const wait = (crossingId, updatedAt) => ({
  crossingId,
  entry: { min: 5, max: 10 },
  exit: { min: 15, max: 20 },
  updatedAt,
});

test("MPB stamps are Kosovo local time, normalized to UTC", () => {
  // October is CEST (UTC+2), January is CET (UTC+1).
  assert.equal(normalizeMpbUpdatedAt("02/10/2026 23:39:43"), "2026-10-02T21:39:43.000Z");
  assert.equal(normalizeMpbUpdatedAt("28/01/2025 01:25:26"), "2025-01-28T00:25:26.000Z");
  assert.equal(normalizeMpbUpdatedAt(" 5/7/2026 08:00 "), "2026-07-05T06:00:00.000Z");
});

test("unreadable MPB stamps return null", () => {
  for (const raw of ["", null, undefined, "Updated soon", "32/01/2026 10:00:00", "10/13/2026 10:00:00", "01/01/2026 24:00:00"]) {
    assert.equal(normalizeMpbUpdatedAt(raw), null, String(raw));
  }
});

test("wall times that never existed return null instead of rolling over", () => {
  assert.equal(normalizeMpbUpdatedAt("31/02/2026 10:00:00"), null);
  assert.equal(normalizeMpbUpdatedAt("29/02/2026 10:00:00"), null);
  // 29 March 2026: Kosovo clocks jump 02:00 → 03:00, so 02:30 never happened.
  assert.equal(normalizeMpbUpdatedAt("29/03/2026 02:30:00"), null);
  assert.equal(normalizeMpbUpdatedAt("29/03/2026 03:30:00"), "2026-03-29T01:30:00.000Z");
  // Leap day exists in 2028.
  assert.equal(normalizeMpbUpdatedAt("29/02/2028 10:00:00"), "2028-02-29T09:00:00.000Z");
});

test("rows carry one entry and one exit per crossing, keyed by the MPB stamp", () => {
  const rows = borderLogRows([wait("merdare", "02/10/2026 23:39:43")], "2026-10-02T22:00:00.000Z");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => [row.direction, row.min_minutes, row.max_minutes]), [["entry", 5, 10], ["exit", 15, 20]]);
  assert.ok(rows.every((row) => row.source_key === "2026-10-02T21:39:43.000Z" && row.mpb_updated_at === row.source_key));
});

test("an unreadable stamp falls back to a snapshot hash per 10-minute slot", () => {
  const a = borderLogRows([wait("kulle", "garbled")], "2026-10-02T22:01:00.000Z");
  const sameSlot = borderLogRows([wait("kulle", "garbled")], "2026-10-02T22:09:00.000Z");
  const nextSlot = borderLogRows([wait("kulle", "garbled")], "2026-10-02T22:11:00.000Z");
  assert.match(a[0].source_key, /^snapshot:[0-9a-f]{24}$/);
  assert.equal(a[0].mpb_updated_at, null);
  assert.equal(a[0].source_key, sameSlot[0].source_key);
  assert.notEqual(a[0].source_key, nextSlot[0].source_key);
});

test("the logger skips MPB when the newest sample is under 9 minutes old", () => {
  const now = new Date("2026-10-02T22:10:00.000Z");
  assert.equal(shouldSkipBorderLog("2026-10-02T22:05:00.000Z", now), true);
  assert.equal(shouldSkipBorderLog("2026-10-02T22:01:00.000Z", now), false);
  assert.equal(shouldSkipBorderLog(null, now), false);
  assert.equal(shouldSkipBorderLog("not a date", now), false);
});
