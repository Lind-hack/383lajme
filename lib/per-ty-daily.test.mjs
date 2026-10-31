import { test } from "node:test";
import assert from "node:assert/strict";
import { editionDay, followSignature, normalizeDaily, pickDaily, newForYou } from "./per-ty-daily.mjs";

const NOW = Date.parse("2026-10-31T10:00:00Z"); // 11:00 in Kosovo
const hoursAgo = (h) => new Date(NOW - h * 3600_000).toISOString();
const item = (slug, extra = {}) => ({
  article: { slug, title: slug, publishedAt: hoursAgo(2), ...extra.article },
  reason: extra.reason ?? `Sepse ndjek ${slug}`,
  kind: extra.kind ?? "category",
  primaryKey: "cat:Sport",
  keys: [],
});
const take7 = (candidates) => candidates.slice(0, 7);

test("the paper's day turns at 05:00 Kosovo time, not at midnight", () => {
  // 00:30 on 1 Nov in Kosovo is still 31 Oct's paper.
  assert.equal(editionDay(Date.parse("2026-10-31T23:30:00Z")), "2026-10-31");
  // 05:30 on 1 Nov is the new one.
  assert.equal(editionDay(Date.parse("2026-11-01T04:30:00Z")), "2026-11-01");
});

test("followSignature ignores order and learned affinity", () => {
  const a = followSignature({ people: ["b", "a"], cities: ["x"], categories: ["Sport"], home: "x", affinity: { k: 1 } });
  const b = followSignature({ people: ["a", "b"], cities: ["x"], categories: ["Sport"], home: "x" });
  assert.equal(a, b);
  assert.notEqual(a, followSignature({ people: ["a"], cities: ["x"], categories: ["Sport"], home: "x" }));
});

test("a new day builds a new edition and leaves out what was already read", () => {
  const ranked = ["a", "b", "c", "d"].map((s) => item(s));
  const got = pickDaily(null, { day: "2026-10-31", signature: "s", ranked, read: new Set(["b"]), now: NOW, build: take7 });
  assert.equal(got.rebuilt, true);
  assert.deepEqual(got.edition.map((i) => i.article.slug), ["a", "c", "d"]);
  assert.deepEqual(got.record, { v: 1, day: "2026-10-31", sig: "s", at: new Date(NOW).toISOString(), slugs: ["a", "c", "d"] });
});

test("the same day keeps the stored seven in their order, read ones included", () => {
  const stored = { v: 1, day: "2026-10-31", sig: "s", at: hoursAgo(3), slugs: ["c", "a"] };
  const ranked = ["a", "b", "c"].map((s) => item(s));
  const got = pickDaily(stored, { day: "2026-10-31", signature: "s", ranked, read: new Set(["a", "c"]), now: NOW, build: take7 });
  assert.equal(got.rebuilt, false);
  assert.deepEqual(got.edition.map((i) => i.article.slug), ["c", "a"]);
  assert.equal(got.record, stored);
});

test("a stored story that left the pool is dropped, not replaced", () => {
  const stored = { v: 1, day: "2026-10-31", sig: "s", at: hoursAgo(3), slugs: ["gone", "a"] };
  const got = pickDaily(stored, { day: "2026-10-31", signature: "s", ranked: [item("a")], read: new Set(), now: NOW, build: take7 });
  assert.deepEqual(got.edition.map((i) => i.article.slug), ["a"]);
});

test("changing follows rebuilds today's edition", () => {
  const stored = { v: 1, day: "2026-10-31", sig: "old", at: hoursAgo(3), slugs: ["a"] };
  const got = pickDaily(stored, { day: "2026-10-31", signature: "new", ranked: [item("b")], read: new Set(), now: NOW, build: take7 });
  assert.equal(got.rebuilt, true);
  assert.deepEqual(got.edition.map((i) => i.article.slug), ["b"]);
});

test("stories that arrive after the edition was built come in as fresh, newest first, at most three", () => {
  const stored = { v: 1, day: "2026-10-31", sig: "s", at: hoursAgo(3), slugs: ["a"] };
  const ranked = [
    item("a"),
    item("late1", { article: { publishedAt: hoursAgo(2) } }),
    item("late2", { article: { publishedAt: hoursAgo(1) } }),
    item("late3", { article: { publishedAt: hoursAgo(0.5) } }),
    item("late4", { article: { publishedAt: hoursAgo(0.2) } }),
    item("early", { article: { publishedAt: hoursAgo(5) } }),
    item("top", { kind: "top", article: { publishedAt: hoursAgo(1) } }),
    item("learned", { kind: "learned", article: { publishedAt: hoursAgo(1) } }),
    item("readlate", { article: { publishedAt: hoursAgo(1) } }),
  ];
  const got = pickDaily(stored, { day: "2026-10-31", signature: "s", ranked, read: new Set(["readlate"]), now: NOW, build: take7 });
  assert.deepEqual(got.fresh.map((i) => i.article.slug), ["late4", "late3", "late2"]);
});

test("a freshly built edition has nothing fresh yet", () => {
  const got = pickDaily(null, { day: "2026-10-31", signature: "s", ranked: [item("a")], read: new Set(), now: NOW, build: take7 });
  assert.deepEqual(got.fresh, []);
});

test("junk in storage is treated as no edition", () => {
  for (const junk of [null, "x", { v: 2 }, { v: 1, day: 5 }, { v: 1, day: "2026-10-31", sig: "s", at: "nope", slugs: "a" }]) {
    assert.equal(normalizeDaily(junk), null);
  }
  const ok = normalizeDaily({ v: 1, day: "2026-10-31", sig: "s", at: hoursAgo(1), slugs: ["a", 3, "a", "B-2"] });
  assert.deepEqual(ok?.slugs, ["a", "B-2"]);
});

test("newForYou counts unread stories published since the last visit", () => {
  const items = [
    item("new", { article: { publishedAt: hoursAgo(1) } }),
    item("newread", { article: { publishedAt: hoursAgo(1) } }),
    item("old", { article: { publishedAt: hoursAgo(10) } }),
  ];
  assert.equal(newForYou(items, hoursAgo(5), new Set(["newread"])), 1);
  // Nothing is new on a first visit.
  assert.equal(newForYou(items, null, new Set()), 0);
});

test("an empty stored edition is rebuilt, so later stories are not hidden behind it", () => {
  const stored = { v: 1, day: "2026-10-31", sig: "s", at: hoursAgo(3), slugs: [] };
  const got = pickDaily(stored, { day: "2026-10-31", signature: "s", ranked: [item("late", { article: { publishedAt: hoursAgo(1) } })], read: new Set(), now: NOW, build: take7 });
  assert.equal(got.rebuilt, true);
  assert.deepEqual(got.edition.map((i) => i.article.slug), ["late"]);
});
