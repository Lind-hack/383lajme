import test from "node:test";
import assert from "node:assert/strict";

import {
  RACE_POINTS,
  applyLiveRaceProjection,
  liveRaceIsProjectable,
  projectLiveRacePoints,
} from "./f1-live-championship.mjs";

const liveRace = (order, extra = {}) => ({
  session: { session_key: 99, session_type: "Race", ...(extra.session ?? {}) },
  lap: extra.lap ?? 20,
  rows: order.map((driverNumber, index) => ({ driver_number: driverNumber, position: index + 1, driver_code: "D" + driverNumber })),
});

test("the running order scores as if the race ended now", () => {
  const projected = projectLiveRacePoints(liveRace([44, 1, 16, 4, 63]));
  assert.equal(projected[44], RACE_POINTS[1]);
  assert.equal(projected[1], RACE_POINTS[2]);
  assert.equal(projected[63], RACE_POINTS[5]);
});

test("outside the points is zero, not undefined", () => {
  const order = Array.from({ length: 20 }, (_, index) => index + 1);
  const projected = projectLiveRacePoints(liveRace(order));
  assert.equal(projected[11], 0);
  assert.equal(projected[20], 0);
});

test("a sprint scores on the sprint table", () => {
  const projected = projectLiveRacePoints(liveRace([44, 1], { session: { session_name: "Sprint" } }));
  assert.equal(projected[44], 8);
  assert.equal(projected[1], 7);
});

test("projected points are added to the table and it is re-ranked", () => {
  // Antonelli leads by 12 and is out of the points; Norris is winning the race.
  const standings = [
    { driver_number: 12, points_current: 250, position_current: 1 },
    { driver_number: 4, points_current: 238, position_current: 2 },
  ];
  const out = applyLiveRaceProjection(standings, projectLiveRacePoints(liveRace([4, 1, 16, 55, 63, 10, 22, 14, 31, 5, 12])));

  const antonelli = out.standings.find((row) => row.driver_number === 12);
  const norris = out.standings.find((row) => row.driver_number === 4);
  assert.equal(norris.points_current, 238 + 25);
  assert.equal(antonelli.points_current, 250);
  // The lead has changed hands, and the positions say so too.
  assert.equal(norris.position_current, 1);
  assert.equal(antonelli.position_current, 2);
  // Only rows present in the standings can gain: this fixture has two drivers
  // and one of them is in the points.
  assert.equal(out.applied, 1);
});

test("a tie leaves the prior order alone rather than shuffling on a coin toss", () => {
  const standings = [
    { driver_number: 1, points_current: 100, position_current: 1 },
    { driver_number: 2, points_current: 100, position_current: 2 },
  ];
  const out = applyLiveRaceProjection(standings, {});
  assert.equal(out.standings.find((row) => row.driver_number === 1).position_current, 1);
  assert.equal(out.standings.find((row) => row.driver_number === 2).position_current, 2);
  assert.equal(out.applied, 0);
});

test("nothing to project leaves the standings untouched", () => {
  const standings = [{ driver_number: 1, points_current: 100, position_current: 1 }];
  assert.equal(applyLiveRaceProjection(standings, {}).standings, standings);
  assert.equal(applyLiveRaceProjection(standings, null).standings, standings);
});

test("a formation lap is not a result", () => {
  assert.equal(liveRaceIsProjectable(liveRace(Array.from({ length: 20 }, (_, i) => i + 1), { lap: 0 })), false);
  assert.equal(liveRaceIsProjectable(liveRace(Array.from({ length: 20 }, (_, i) => i + 1), { lap: 1 })), false);
  assert.equal(liveRaceIsProjectable(liveRace(Array.from({ length: 20 }, (_, i) => i + 1), { lap: 2 })), true);
});

test("a thin payload, a non-race session, or nothing at all is refused", () => {
  assert.equal(liveRaceIsProjectable(null), false);
  assert.equal(liveRaceIsProjectable({ rows: [], lap: 30 }), false);
  assert.equal(liveRaceIsProjectable(liveRace([1, 2, 3], { lap: 30 })), false);
  assert.equal(
    liveRaceIsProjectable(liveRace(Array.from({ length: 20 }, (_, i) => i + 1), { lap: 30, session: { session_type: "Qualifying" } })),
    false
  );
});
