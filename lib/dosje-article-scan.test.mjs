import { test } from "node:test";
import assert from "node:assert/strict";
import { newestArticles } from "./dosje-article-scan.mjs";

const archive = Array.from({ length: 7 }, (_, i) => ({ slug: `a${i}`, publishedAt: `2026-10-${String(28 - i).padStart(2, "0")}T10:00:00Z` }));
const reader = ({ before, limit }, list = archive) => {
  const older = list.filter((a) => !before || Date.parse(a.publishedAt) < Date.parse(before));
  return Promise.resolve(older.slice(0, limit));
};

test("reads past one page, so a new dossier reaches stories older than the newest page", async () => {
  // 3 Nov: the Netanyahu dossier got no article, its election stories of 28 Oct
  // being past the newest 150.
  const got = await newestArticles(reader, { pageSize: 3, pages: 2 });
  assert.deepEqual(got.map((a) => a.slug), ["a0", "a1", "a2", "a3", "a4"]); // pages overlap by the last article
});

test("stops at the end of the archive", async () => {
  const got = await newestArticles(reader, { pageSize: 3, pages: 9 });
  assert.equal(got.length, 7);
});

test("a page that fails keeps what was already read", async () => {
  let calls = 0;
  const flaky = (q) => (++calls === 2 ? Promise.reject(new Error("down")) : reader(q));
  const got = await newestArticles(flaky, { pageSize: 3, pages: 3 });
  assert.deepEqual(got.map((a) => a.slug), ["a0", "a1", "a2"]);
});

test("articles published in one batch are not lost at a page edge", async () => {
  // readPage takes strictly older articles, and a news run shares its timestamp.
  const at = (slug, hour) => ({ slug, publishedAt: `2026-10-20T${hour}:00:00.000Z` });
  const list = [at("a", "14"), at("b", "13"), at("c", "12"), at("d", "12"), at("e", "11"), at("f", "10")];
  const got = await newestArticles((q) => reader(q, list), { pageSize: 3, pages: 3 });
  assert.deepEqual(got.map((a) => a.slug), ["a", "b", "c", "d", "e", "f"]);
});
