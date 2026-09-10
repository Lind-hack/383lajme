import { test } from "node:test";
import assert from "node:assert/strict";
import { elapsedDeadlineTarget } from "./tregu-news-decay.mjs";
test("deadline targets depend on elapsed time rather than worker frequency", () => {
  const start = Date.parse("2026-09-01T00:00:00Z"), deadline = start + 86400000;
  let probability = .65;
  for (let minute = 2; minute <= 60; minute += 2) probability = elapsedDeadlineTarget({ probability, previousAt: start + (minute - 2) * 60000, now: start + minute * 60000, deadline });
  const hourly = elapsedDeadlineTarget({ probability: .65, previousAt: start, now: start + 3600000, deadline });
  assert.ok(Math.abs(probability - hourly) < 1e-12);
  assert.equal(elapsedDeadlineTarget({ probability: .65, previousAt: start, now: deadline, deadline }), .05);
  assert.equal(elapsedDeadlineTarget({ probability: .02, previousAt: start, now: deadline, deadline }), .02);
});
