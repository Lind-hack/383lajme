import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting, kosovoHour, dwellNudge, FLICK_NUDGE, STAY_NUDGE, AWAY_MS } from "./perty-personal.mjs";

// 2026-10-13 is summer time in Kosovo: UTC+2.
const at = (utcHour) => new Date(Date.UTC(2026, 9, 13, utcHour, 30));

test("the hour is Kosovo's", () => {
  assert.equal(kosovoHour(at(5)), 7);
  assert.equal(kosovoHour(at(22)), 0);
});

test("good morning, day and evening, by name or without", () => {
  assert.equal(greeting(at(5), "Lind"), "Mirëmëngjes, Lind");
  assert.equal(greeting(at(10), "Lind"), "Mirëdita, Lind");
  assert.equal(greeting(at(18), " "), "Mirëmbrëma");
  assert.equal(greeting(at(1), undefined), "Mirëmbrëma");
});

test("staying teaches a little more, flicking a little less, the rest nothing", () => {
  assert.equal(dwellNudge(400), FLICK_NUDGE);
  assert.equal(dwellNudge(3000), 0);
  assert.equal(dwellNudge(9000), STAY_NUDGE);
  assert.equal(dwellNudge(AWAY_MS + 1), 0);
  assert.equal(dwellNudge(Number.NaN), 0);
  assert.ok(STAY_NUDGE < 1.2 && Math.abs(FLICK_NUDGE) < STAY_NUDGE);
});
