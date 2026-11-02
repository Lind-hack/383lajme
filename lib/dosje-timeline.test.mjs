import test from "node:test";
import assert from "node:assert/strict";

import { orderTimeline } from "./dosje-timeline.mjs";

/**
 * One timeline, in the order things happened. Verified moments and 383's own
 * articles used to be glued end to end, so a 2021 trial could follow a 2026
 * article and the "before this article" cut and the date span were read off
 * array positions, not dates.
 */

test("moments and articles interleave by date, oldest first", () => {
  const out = orderTimeline([
    { id: "a2026", kind: "article", publishedAt: "2026-10-23T09:00:00Z" },
    { id: "m2015", kind: "milestone", eventDate: "2015-08-03" },
    { id: "a2025", kind: "article", publishedAt: "2025-01-02T09:00:00Z" },
    { id: "m2021", kind: "milestone", eventDate: "2021-09-15" },
  ]);
  assert.deepEqual(out.map((e) => e.id), ["m2015", "m2021", "a2025", "a2026"]);
});

test("an entry without a usable date goes last, not first", () => {
  const out = orderTimeline([
    { id: "x", kind: "article" },
    { id: "m", kind: "milestone", eventDate: "2015-08-03" },
  ]);
  assert.deepEqual(out.map((e) => e.id), ["m", "x"]);
});

test("same day keeps the history before the coverage", () => {
  const out = orderTimeline([
    { id: "a", kind: "article", publishedAt: "2021-09-15T12:00:00Z" },
    { id: "m", kind: "milestone", eventDate: "2021-09-15" },
  ]);
  assert.deepEqual(out.map((e) => e.id), ["m", "a"]);
});
