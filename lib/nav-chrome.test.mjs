import { test } from "node:test";
import assert from "node:assert/strict";
import { nextChromeState, wiggleDelay, HEADER_ZONE, SCROLL_SLOP } from "./nav-chrome.mjs";

const start = { hidden: false, anchorY: 0 };

test("stays shown inside the header zone however you scroll", () => {
  assert.equal(nextChromeState(start, HEADER_ZONE).hidden, false);
  assert.equal(nextChromeState({ hidden: true, anchorY: 300 }, HEADER_ZONE - 1).hidden, false);
});

test("hides once the reader scrolls down past the zone by more than the slop", () => {
  const s = nextChromeState({ hidden: false, anchorY: 200 }, 200 + SCROLL_SLOP + 1);
  assert.equal(s.hidden, true);
});

test("a jitter smaller than the slop changes nothing", () => {
  const s = nextChromeState({ hidden: false, anchorY: 200 }, 200 + SCROLL_SLOP - 1);
  assert.equal(s.hidden, false);
  const t = nextChromeState({ hidden: true, anchorY: 500 }, 500 - SCROLL_SLOP + 1);
  assert.equal(t.hidden, true);
});

test("comes back as soon as the reader scrolls up past the slop", () => {
  const s = nextChromeState({ hidden: true, anchorY: 900 }, 900 - SCROLL_SLOP - 1);
  assert.equal(s.hidden, false);
});

test("the anchor follows the scroll in the current direction, so a long scroll then a short reversal still flips", () => {
  let s = { hidden: false, anchorY: 100 };
  for (const y of [150, 400, 800, 1200]) s = nextChromeState(s, y);
  assert.equal(s.hidden, true);
  assert.equal(s.anchorY, 1200);
  s = nextChromeState(s, 1200 - SCROLL_SLOP - 2);
  assert.equal(s.hidden, false);
});

test("an iOS overscroll below zero reads as the top", () => {
  assert.equal(nextChromeState({ hidden: true, anchorY: 400 }, -40).hidden, false);
});

test("wiggle waits 10 to 15 seconds", () => {
  assert.equal(wiggleDelay(0), 10_000);
  assert.equal(wiggleDelay(0.999999) <= 15_000, true);
  assert.equal(wiggleDelay(0.5), 12_500);
});
