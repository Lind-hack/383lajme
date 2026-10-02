import { test } from "node:test";
import assert from "node:assert/strict";
import { validEndpoint, isMorningWindow, isRecentSend, kosovoNow, MORNING_NOTE } from "./perty-morning.mjs";

test("only real browser push services are accepted", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/xyz",
    "https://web.push.apple.com/QK1abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ]) {
    assert.ok(validEndpoint(ok), ok);
  }
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://evil.example.com/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.com/x",
    "javascript:alert(1)",
    "not a url",
    "https://fcm.googleapis.com/" + "x".repeat(1000),
    null,
    42,
  ]) {
    assert.equal(validEndpoint(bad), null, String(bad));
  }
});

test("the morning is the 07:00 hour in Kosovo, summer or winter", () => {
  // Summer (UTC+2): 05:00 UTC is 07:00 in Prishtina.
  assert.equal(isMorningWindow(new Date("2026-07-01T05:00:00Z")), true);
  assert.equal(isMorningWindow(new Date("2026-07-01T05:59:00Z")), true);
  assert.equal(isMorningWindow(new Date("2026-07-01T06:00:00Z")), false);
  assert.equal(isMorningWindow(new Date("2026-07-01T04:59:00Z")), false);
  // Winter (UTC+1): 06:00 UTC is 07:00.
  assert.equal(isMorningWindow(new Date("2026-12-01T06:30:00Z")), true);
  assert.equal(isMorningWindow(new Date("2026-12-01T05:30:00Z")), false);
  assert.equal(kosovoNow(new Date("2026-12-01T06:30:00Z")).date, "2026-12-01");
});

test("a push is the morning one only shortly after it was sent", () => {
  const now = new Date("2026-10-03T05:10:00Z");
  assert.equal(isRecentSend("2026-10-03T05:01:00Z", now), true);
  assert.equal(isRecentSend("2026-10-03T04:30:00Z", now), false);
  assert.equal(isRecentSend("2026-10-03T05:20:00Z", now), false); // the future
  assert.equal(isRecentSend(null, now), false);
  assert.equal(isRecentSend("junk", now), false);
});

test("the note says nothing personal and opens Për ty", () => {
  assert.equal(MORNING_NOTE.url, "/per-ty");
  assert.ok(MORNING_NOTE.title.length > 0 && MORNING_NOTE.body.length > 0);
});
