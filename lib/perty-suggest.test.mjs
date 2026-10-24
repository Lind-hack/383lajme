import { test } from "node:test";
import assert from "node:assert/strict";
import { INTERESTS_VERSION } from "./interests.mjs";
import { MAX_SUGGESTIONS, TRENDING_MIN, addFollow, followKeys, removeFollow, suggestFollows } from "./perty-suggest.mjs";

const NOW = Date.parse("2026-10-24T09:00:00Z");
const iso = (hoursAgo) => new Date(NOW - hoursAgo * 3600_000).toISOString();
const interests = (over = {}) => ({ v: INTERESTS_VERSION, categories: [], topics: [], people: [], cities: [], home: null, affinity: {}, ...over });
const stories = (key, n, hoursAgo = 2) => Array.from({ length: n }, () => ({ keys: [key], publishedAt: iso(hoursAgo) }));

test("follows are listed most specific first, home town leading", () => {
  const keys = followKeys(interests({ categories: ["Sport"], people: ["memli-krasniqi"], cities: ["peje", "prishtine"], home: "prishtine" }));
  assert.deepEqual(keys, ["city:prishtine", "city:peje", "person:memli-krasniqi", "cat:Sport"]);
});

test("what the reader keeps reading is offered before what is in the news", () => {
  const affinity = { "person:memli-krasniqi": { w: 3, t: iso(1) } };
  const out = suggestFollows(stories("city:prizren", TRENDING_MIN), interests({ categories: ["Kosovë"], affinity }), { now: NOW });
  assert.deepEqual(out.map((s) => [s.key, s.why]), [
    ["person:memli-krasniqi", "learned"],
    ["city:prizren", "trending"],
  ]);
});

test("a name in fewer stories, or only in old ones, is not trending", () => {
  const pool = [...stories("city:prizren", TRENDING_MIN - 1), ...stories("city:peje", TRENDING_MIN, 72)];
  assert.deepEqual(suggestFollows(pool, interests({ categories: ["Kosovë"] }), { now: NOW }), []);
});

test("nothing already followed, turned down, or diaspora is offered, and the list is capped", () => {
  const pool = [
    ...stories("city:prishtine", 9),
    ...stories("city:diaspora", 9),
    ...stories("city:peje", 8),
    ...stories("city:prizren", 7),
    ...stories("city:gjakove", 6),
    ...stories("person:memli-krasniqi", 5),
    ...stories("cat:Sport", 9),
  ];
  const out = suggestFollows(pool, interests({ cities: ["prishtine"] }), { now: NOW, skip: ["city:peje"] });
  const keys = out.map((s) => s.key);
  assert.ok(!keys.includes("city:prishtine") && !keys.includes("city:diaspora") && !keys.includes("city:peje"));
  assert.ok(!keys.includes("cat:Sport"), "topics never trend");
  assert.deepEqual(keys, ["city:prizren", "city:gjakove", "person:memli-krasniqi"]);
  assert.ok(out.length <= MAX_SUGGESTIONS);
});

test("adding and removing a follow; dropping the home town clears home", () => {
  let i = addFollow(interests({ categories: ["Sport"] }), "person:memli-krasniqi");
  assert.deepEqual(i.people, ["memli-krasniqi"]);
  i = addFollow(i, "city:prishtine");
  i = { ...i, home: "prishtine" };
  i = removeFollow(i, "city:prishtine");
  assert.deepEqual(i.cities, []);
  assert.equal(i.home, null);
  assert.deepEqual(removeFollow(i, "cat:Sport").categories, []);
  assert.deepEqual(addFollow(i, "person:nobody-at-all").people, ["memli-krasniqi"], "unknown keys change nothing");
});
