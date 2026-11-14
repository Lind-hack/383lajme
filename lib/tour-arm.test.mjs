import { test } from "node:test";
import assert from "node:assert/strict";
import { tourOwed, tourShouldFire, TOUR_ARM_LINE } from "./tour-arm.mjs";

const vh = 800;

test("does not fire while the card is still below the arm line", () => {
  assert.equal(tourShouldFire(vh * TOUR_ARM_LINE + 1, vh), false);
  assert.equal(tourShouldFire(2400, vh), false);
});

test("fires as soon as the card's top crosses the arm line", () => {
  assert.equal(tourShouldFire(vh * TOUR_ARM_LINE, vh), true);
  assert.equal(tourShouldFire(300, vh), true);
});

test("a flick that carries the card past the top of the screen in one frame still fires", () => {
  // The old IntersectionObserver band never saw the card intersect at all.
  assert.equal(tourShouldFire(-1500, vh), true);
});

test("a viewport with no height (a hidden tab, a print pass) never fires", () => {
  assert.equal(tourShouldFire(100, 0), false);
});


test("a tour the reader has seen is never owed again", () => {
  assert.equal(tourOwed({ seenThis: true, onboarded: false, standalone: false }), false);
  assert.equal(tourOwed({ seenThis: true, onboarded: false, standalone: true }), false);
});

test("an ordinary tour stands down once the reader has had any tour", () => {
  assert.equal(tourOwed({ seenThis: false, onboarded: true, standalone: false }), false);
  assert.equal(tourOwed({ seenThis: false, onboarded: false, standalone: false }), true);
});

test("a standalone tour (the Tregu page explaining itself) is owed on its own first visit, whatever came before", () => {
  assert.equal(tourOwed({ seenThis: false, onboarded: true, standalone: true }), true);
});
