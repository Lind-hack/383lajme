import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INTERESTS_KEY,
  normalizeInterests,
  readInterests,
  writeInterests,
  toggleCategory,
  hasInterests,
  matchArticles,
} from "./interests.mjs";

/** A localStorage stand-in. `broken` reproduces Safari private mode. */
function fakeStore(initial = null, { broken = false } = {}) {
  let value = initial;
  return {
    getItem() {
      if (broken) throw new Error("storage disabled");
      return value;
    },
    setItem(_key, next) {
      if (broken) throw new Error("QuotaExceededError");
      value = next;
    },
    peek: () => value,
  };
}

test("junk in storage yields a clean default instead of throwing", () => {
  for (const junk of ["not json", "null", "[]", '{"v":1,"categories":"Sport"}']) {
    const got = readInterests(fakeStore(junk));
    assert.deepEqual(got.categories, []);
    assert.equal(got.v, 1);
  }
});

test("a value written by a future version is discarded, not guessed at", () => {
  const stored = JSON.stringify({ v: 99, categories: ["Sport"] });
  assert.deepEqual(readInterests(fakeStore(stored)).categories, []);
});

test("storage that throws on read does not break the page", () => {
  assert.deepEqual(readInterests(fakeStore(null, { broken: true })).categories, []);
});

test("storage that throws on write reports failure rather than pretending", () => {
  assert.equal(writeInterests({ categories: ["Sport"] }, fakeStore(null, { broken: true })), false);
});

test("a retired category label folds onto its live one", () => {
  // "Politikë" was retired into "Kosovë". Someone who chose it before the
  // change must keep a working selection, not silently lose it.
  const got = normalizeInterests({ v: 1, categories: ["Politikë"] });
  assert.deepEqual(got.categories, ["Kosovë"]);
});

test("unknown and duplicate categories are dropped", () => {
  const got = normalizeInterests({
    v: 1,
    categories: ["Sport", "Sport", "Kriptovaluta", 42, null],
  });
  assert.deepEqual(got.categories, ["Sport"]);
});

test("a round trip through storage preserves the selection", () => {
  const store = fakeStore();
  assert.equal(writeInterests({ categories: ["Kosovë", "Ekonomi"] }, store), true);
  const back = readInterests(store);
  assert.deepEqual(back.categories, ["Kosovë", "Ekonomi"]);
  assert.ok(back.updatedAt, "updatedAt should be stamped on write");
  assert.ok(store.peek().includes(INTERESTS_KEY) === false, "value holds data, not the key");
});

test("toggleCategory adds, removes, and ignores unknown labels", () => {
  assert.deepEqual(toggleCategory([], "Sport"), ["Sport"]);
  assert.deepEqual(toggleCategory(["Sport"], "Sport"), []);
  assert.deepEqual(toggleCategory(["Sport"], "Kriptovaluta"), ["Sport"]);
  assert.deepEqual(toggleCategory(null, "Ekonomi"), ["Ekonomi"]);
});

test("hasInterests drives the empty state", () => {
  assert.equal(hasInterests(null), false);
  assert.equal(hasInterests({ v: 1, categories: [] }), false);
  assert.equal(hasInterests({ v: 1, categories: ["Sport"] }), true);
});

test("matchArticles filters by category and respects the limit", () => {
  const pool = [
    { slug: "a", category: "Sport" },
    { slug: "b", category: "Ekonomi" },
    { slug: "c", category: "Sport" },
    { slug: "d", category: "Sport" },
  ];
  const got = matchArticles(pool, { v: 1, categories: ["Sport"] }, 2);
  assert.deepEqual(got.map((a) => a.slug), ["a", "c"]);
});

test("no interests selected matches nothing, rather than everything", () => {
  // The distinction matters: an empty selection is "not chosen yet", which the
  // UI answers with a prompt. Returning the whole pool would look like a
  // working personalised feed that ignores the reader entirely.
  const pool = [{ slug: "a", category: "Sport" }];
  assert.deepEqual(matchArticles(pool, { v: 1, categories: [] }), []);
});

test("matching a category with nothing in the pool returns empty, not a crash", () => {
  const pool = [{ slug: "a", category: "Sport" }];
  assert.deepEqual(matchArticles(pool, { v: 1, categories: ["Ekonomi"] }), []);
  assert.deepEqual(matchArticles(undefined, { v: 1, categories: ["Sport"] }), []);
});

// ── People, cities and learned affinity ────────────────────────────────────

import { recordRead, decayedWeight, AFFINITY_HALF_LIFE_MS } from "./interests.mjs";

test("people and cities are kept only when the lists know them", () => {
  const got = normalizeInterests({
    v: 1,
    people: ["albin-kurti", "albin-kurti", "nobody", "derived:Filan Fisteku", "derived:Fisteku", 7],
    cities: ["prizren", "atlantis", null, "prizren"],
  });
  assert.deepEqual(got.people, ["albin-kurti", "derived:Filan Fisteku"]);
  assert.deepEqual(got.cities, ["prizren"]);
});

test("picking only a person or a city counts as having interests", () => {
  assert.equal(hasInterests({ v: 1, people: ["dua-lipa"] }), true);
  assert.equal(hasInterests({ v: 1, cities: ["peje"] }), true);
});

test("learned affinity alone does not skip onboarding", () => {
  const affinity = recordRead({}, ["cat:Sport"]);
  assert.equal(hasInterests({ v: 1, affinity }), false);
});

test("a read adds weight, and old reads fade by half each half-life", () => {
  const t0 = Date.parse("2026-09-01T00:00:00Z");
  const a = recordRead({}, ["cat:Sport", "person:albin-kurti"], t0);
  assert.equal(a["cat:Sport"].w, 1);
  const later = t0 + AFFINITY_HALF_LIFE_MS;
  assert.ok(Math.abs(decayedWeight(a["cat:Sport"], later) - 0.5) < 1e-9);
});

test("affinity rejects junk keys and caps each weight", () => {
  let a = {};
  for (let i = 0; i < 20; i++) a = recordRead(a, ["cat:Sport", "junk", 42]);
  assert.deepEqual(Object.keys(a), ["cat:Sport"]);
  assert.equal(a["cat:Sport"].w, 5);
  assert.deepEqual(normalizeInterests({ v: 1, affinity: "nope" }).affinity, {});
});
