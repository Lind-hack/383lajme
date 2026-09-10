import { test } from "node:test";
import assert from "node:assert/strict";
import { driverStintTelemetry } from "./f1-stint-telemetry.mjs";
import { openF1ToWinnerLeaderboard } from "./f1-live-lite.mjs";

test("stints select chronologically without dates and exclude future stints", () => {
  const stints = [{ driver_number: 1, stint_number: 3, lap_start: 40, compound: "SOFT", tyre_age_at_start: 0 }, { driver_number: 1, stint_number: 2, lap_start: 20, compound: "HARD", tyre_age_at_start: 2 }, { driver_number: 1, stint_number: 1, lap_start: 1, compound: "MEDIUM", tyre_age_at_start: 0 }];
  const laps = [25, 23, 24, 22].map(lap_number => ({ driver_number: 1, lap_number, lap_duration: 90 }));
  const row = driverStintTelemetry(1, stints, laps, [{ driver_number: 1, lap_number: 19, date: "2026-09-06T13:30:00Z" }]);
  assert.equal(row.stint, 2);
  assert.equal(row.tyre, "HARD");
  assert.equal(row.tyre_age, 7);
  assert.equal(row.pits, 1);
  assert.equal(row.lap, 25);
  assert.equal(row.recent_pace, 90);
  const [adapted] = openF1ToWinnerLeaderboard({ rows: [{ ...row, position: 1, driver_code: "VER" }] }).rows;
  assert.equal(adapted.pits, 1);
});

test("unknown pit and tyre data remain unknown; pit laps do not pollute recent pace", () => {
  assert.equal(driverStintTelemetry(1).pits, null);
  assert.equal(driverStintTelemetry(1).tyre_age, null);
  const laps = [1, 2, 3, 4, 5].map(lap_number => ({ driver_number: 1, lap_number, lap_duration: lap_number < 4 ? 90 : 130, is_pit_out_lap: lap_number === 5 }));
  const stop = { driver_number: 1, lap_number: 4, date: "2026-09-06T13:10:00Z" };
  const row = driverStintTelemetry(1, [], laps, [stop, stop]);
  assert.equal(row.pits, 1);
  assert.equal(row.recent_pace, 90);
});
