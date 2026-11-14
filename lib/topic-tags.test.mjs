import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_TAGS,
  MAX_TRIES,
  buildTagPrompt,
  cleanTags,
  normalizeIndex,
  pickUntagged,
  tagMap,
  withTags,
  TAG_SYSTEM,
} from "./topic-tags.mjs";
import { TOPICS_VERSION } from "./search-topics.mjs";

const a = (slug, title = `Titulli ${slug}`, excerpt = "") => ({ slug, title, excerpt });

test("the prompt lists every topic with its parent and numbers the stories", () => {
  assert.match(TAG_SYSTEM, /bitcoin — Bitcoin \(under kripto\)/);
  assert.match(TAG_SYSTEM, /liga-kampioneve — Liga e Kampionëve \(under futboll\)/);
  const prompt = buildTagPrompt([a("x", "Bitcoin bie", "Tregu ra sot."), a("y", "Kosova fiton")]);
  assert.match(prompt, /^1\. Bitcoin bie\n {3}Tregu ra sot\./m);
  assert.match(prompt, /^2\. Kosova fiton/m);
});

test("a long excerpt is cut before it reaches the model", () => {
  const prompt = buildTagPrompt([a("x", "T", "fjalë ".repeat(400))]);
  assert.ok(prompt.length < 700, `prompt ${prompt.length}`);
});

test("only known topics are kept, once each, at most MAX_TAGS", () => {
  const batch = [a("x"), a("y"), a("z")];
  const tags = cleanTags({ tags: { 1: ["bitcoin", "bitcoin", "made-up", "kripto"], 2: [], 3: ["sport", "futboll", "tenis", "f1", "boks"] } }, batch);
  assert.deepEqual(tags.get("x"), ["bitcoin", "kripto"]);
  assert.deepEqual(tags.get("y"), []);
  assert.equal(tags.get("z").length, MAX_TAGS);
});

test("a story the model skipped is left out, not recorded as having no topic", () => {
  const tags = cleanTags({ tags: { 1: ["sport"] } }, [a("x"), a("y")]);
  assert.ok(tags.has("x"));
  assert.ok(!tags.has("y"));
});

test("an unreadable answer tags nothing", () => {
  for (const raw of [null, "x", 3, [], { tags: "sport" }, { tags: null }]) {
    assert.equal(cleanTags(raw, [a("x")]).size, 0);
  }
});

test("a broken or foreign index reads as empty, never throws", () => {
  for (const raw of [null, undefined, "x", [], { items: "y" }, { items: { s: "bad", t: { t: "sport" } } }]) {
    assert.deepEqual(normalizeIndex(raw).items, {});
  }
  const ok = normalizeIndex({ items: { s: { t: ["sport", "ghost"], v: 1 } } });
  assert.deepEqual(ok.items.s.t, ["sport"]);
});

test("untagged stories are picked newest first; tagged ones on the current tree are not", () => {
  const index = withTags(normalizeIndex(null), new Map([["old", ["sport"]]]), [], 0);
  const picked = pickUntagged([a("new"), a("old"), a("older")], index, 5);
  assert.deepEqual(picked.map((x) => x.slug), ["new", "older"]);
  assert.deepEqual(pickUntagged([a("new"), a("older")], index, 1).map((x) => x.slug), ["new"]);
});

test("a story tagged on an older tree is tagged again", () => {
  const index = normalizeIndex({ items: { s: { t: ["sport"], v: TOPICS_VERSION - 1 } } });
  assert.deepEqual(pickUntagged([a("s")], index, 5).map((x) => x.slug), ["s"]);
});

test("a story the model keeps skipping stops being retried after MAX_TRIES", () => {
  let index = normalizeIndex(null);
  for (let i = 0; i < MAX_TRIES; i++) index = withTags(index, new Map(), ["s"], i);
  assert.deepEqual(pickUntagged([a("s")], index, 5), []);
  assert.equal(tagMap(index).has("s"), false);
});

test("the map for the search holds only tagged stories, with known topics", () => {
  const index = withTags(normalizeIndex(null), new Map([["x", ["bitcoin"]], ["y", []]]), ["z"], 0);
  const map = tagMap(index);
  assert.deepEqual(map.get("x"), ["bitcoin"]);
  assert.deepEqual(map.get("y"), []);
  assert.equal(map.has("z"), false);
});
