import { test } from "node:test";
import assert from "node:assert/strict";
import { njoftimeBudget, selectHomeTail } from "./home-news-sections.mjs";

const batch = (count) => Array.from({ length: count }, (_, i) => ({ id: String(i) }));

test("a 21-story fallback batch still has a story and seven archive entries", () => {
  const articles = batch(21);
  const claimed = new Set(articles.slice(0, 11).map((a) => a.id));
  const rail = articles.slice(11, 11 + njoftimeBudget(10));
  rail.forEach((a) => claimed.add(a.id));
  const tail = selectHomeTail(articles, articles.slice(0, 12), claimed);
  assert.deepEqual(tail.recent, articles.slice(0, 4));
  assert.equal(tail.story.id, "13");
  assert.equal(tail.archive.length, 7);
  assert.equal(new Set([...rail, tail.story, ...tail.archive].map((a) => a.id)).size, 10);
});

test("tiny batches keep the latest list even when every story appears above", () => {
  const articles = batch(4);
  const claimed = new Set(articles.map((a) => a.id));
  assert.equal(njoftimeBudget(0), 0);
  assert.equal(njoftimeBudget(4), 0);
  const tail = selectHomeTail(articles, articles, claimed);
  assert.deepEqual(tail.recent, articles);
  assert.equal(tail.story, undefined);
  assert.deepEqual(tail.archive, []);
});

test("new stories outside the ranked pool retain chronological order", () => {
  const articles = batch(60);
  const claimed = new Set(articles.slice(0, 11).map((a) => a.id));
  assert.equal(njoftimeBudget(49), 16);
  const latest = [{ id: "newest" }, articles[30], articles[0], articles[40], articles[50]];
  const before = [...claimed];
  const tail = selectHomeTail(articles, latest, claimed);
  assert.deepEqual(tail.recent, latest.slice(0, 4));
  assert.equal(tail.archive.length, 12);
  assert.ok(tail.archive.every((a) => !tail.recent.some((r) => r.id === a.id)));
  assert.deepEqual([...claimed], before);
});
