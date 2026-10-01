import { test } from "node:test";
import assert from "node:assert/strict";
import { nextVisit, isNewSince, normalizeRead, markRead, SAME_VISIT_MS } from "./perty-visits.mjs";

const T0 = Date.parse("2026-10-01T08:00:00Z");
const iso = (t) => new Date(t).toISOString();

test("a first visit has nothing to measure new from", () => {
  assert.deepEqual(nextVisit(null, T0), { last: iso(T0), since: null });
});

test("a later visit measures new from the previous one", () => {
  const first = nextVisit(null, T0);
  const second = nextVisit(first, T0 + 6 * 3600_000);
  assert.equal(second.since, iso(T0));
});

test("coming back within the same visit keeps the same line", () => {
  const visit = { last: iso(T0), since: iso(T0 - 86400_000) };
  const again = nextVisit(visit, T0 + SAME_VISIT_MS - 1000);
  assert.equal(again.since, iso(T0 - 86400_000));
});

test("junk and a clock that went backwards do not throw or freeze the line", () => {
  assert.deepEqual(nextVisit({ last: "nope", since: 5 }, T0), { last: iso(T0), since: null });
  const future = nextVisit({ last: iso(T0 + 3600_000), since: null }, T0);
  assert.equal(future.since, iso(T0 + 3600_000));
});

test("new means published after the previous visit began", () => {
  const since = iso(T0);
  assert.equal(isNewSince({ publishedAt: iso(T0 + 1000) }, since), true);
  assert.equal(isNewSince({ publishedAt: iso(T0 - 1000) }, since), false);
  assert.equal(isNewSince({ publishedAt: iso(T0 + 1000) }, null), false);
  assert.equal(isNewSince({ publishedAt: "x" }, since), false);
});

test("the read list keeps valid slugs once, newest first, bounded", () => {
  assert.deepEqual(normalizeRead(["a-1", "a-1", 3, "../x", null, "b"]), ["a-1", "b"]);
  assert.deepEqual(markRead(["a", "b"], "b"), ["b", "a"]);
  let list = [];
  for (let i = 0; i < 400; i++) list = markRead(list, `s-${i}`);
  assert.equal(list.length, 300);
  assert.equal(list[0], "s-399");
  assert.deepEqual(markRead(["a"], "bad slug!"), ["a"]);
});
