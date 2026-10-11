import { test } from "node:test";
import assert from "node:assert/strict";
import { SKIP_PENALTY, normalizeShown, noteShown, settleSkips } from "./perty-skips.mjs";
import { whyLine } from "./perty-why.mjs";

test("only follows are logged, each story once", () => {
  let log = noteShown(null, "2026-10-10", [
    { slug: "a", key: "cat:Sport" },
    { slug: "b", key: "top" },
    { slug: "a", key: "cat:Sport" },
  ]);
  log = noteShown(log, "2026-10-10", [{ slug: "c", key: "city:prizren" }]);
  assert.deepEqual(log.items.map((i) => i.slug), ["a", "c"]);
});

test("a new day starts a new log", () => {
  const log = noteShown({ date: "2026-10-09", items: [{ slug: "a", key: "cat:Sport" }] }, "2026-10-10", [{ slug: "b", key: "cat:Botë" }]);
  assert.deepEqual(log, { date: "2026-10-10", items: [{ slug: "b", key: "cat:Botë" }] });
});

test("yesterday's unopened stories cost their follow; opened ones do not", () => {
  const log = { date: "2026-10-09", items: [{ slug: "a", key: "cat:Sport" }, { slug: "b", key: "cat:Sport" }, { slug: "c", key: "city:prizren" }] };
  const { penalties, log: next } = settleSkips(log, ["c"], "2026-10-10");
  assert.deepEqual(penalties, { "cat:Sport": 2 * SKIP_PENALTY });
  assert.equal(next, null);
});

test("today's log is never judged", () => {
  const log = { date: "2026-10-10", items: [{ slug: "a", key: "cat:Sport" }] };
  assert.deepEqual(settleSkips(log, [], "2026-10-10").penalties, {});
});

test("stored log is untrusted", () => {
  for (const junk of [null, 1, "x", {}, { date: "yesterday" }]) assert.equal(normalizeShown(junk), null);
  assert.deepEqual(normalizeShown({ date: "2026-10-10", items: [{ slug: "A B", key: "cat:Sport" }, { slug: "ok", key: "nope" }, 5] }).items, []);
});

const interests = { v: 1, categories: ["Sport"], people: ["albin-kurti"], cities: ["prizren"], home: "prizren" };

test("why: plain words for every kind of story", () => {
  assert.equal(whyLine({ article: {}, kind: "person", primaryKey: "person:albin-kurti" }, interests).short, "Sepse ndjek Albin Kurti");
  assert.equal(whyLine({ article: {}, kind: "city", primaryKey: "city:prizren" }, interests).short, "Nga qyteti yt, Prizren");
  assert.equal(whyLine({ article: {}, kind: "category", primaryKey: "cat:Sport" }, interests).short, "Sepse zgjodhe Sport");
  const top = whyLine({ article: {}, kind: "top", primaryKey: "top" }, interests);
  assert.equal(top.key, null);
  assert.equal(top.picked, false);
});

test("why: a learned story quotes what the reader read, when there is enough", () => {
  const now = Date.parse("2026-10-11T08:00:00Z");
  const affinity = { "cat:Botë": { w: 4, t: new Date(now).toISOString(), s: 720, n: 4 } };
  const w = whyLine({ article: { title: "Diçka", category: "Botë" }, kind: "learned", primaryKey: "learned" }, { ...interests, affinity }, now);
  assert.equal(w.short, "Sepse lexove 4 lajme, 12 minuta për Botë");
  assert.equal(w.key, "cat:Botë");
  assert.equal(w.picked, false);
});
