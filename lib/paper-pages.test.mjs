import { test } from "node:test";
import assert from "node:assert/strict";
import { FRONT_STORIES, hashForPage, pageFromHash, paperPages } from "./paper-pages.mjs";

const story = (i) => ({ article: { slug: `s${i}` } });
const section = (key, n, start) => ({
  key,
  title: key.split(":")[1],
  kind: "category",
  empty: n === 0,
  items: Array.from({ length: n }, (_, i) => ({ article: { slug: `${key}-${start + i}` } })),
});

test("front and back pages always exist", () => {
  const pages = paperPages({ edition: [], sections: [] });
  assert.deepEqual(pages.map((p) => p.kind), ["front", "back"]);
  assert.equal(paperPages(null).length, 2);
});

test("front holds the lead and the next stories; the rest go to 'Më shumë'", () => {
  const edition = Array.from({ length: 10 }, (_, i) => story(i));
  const pages = paperPages({ edition, sections: [] });
  assert.equal(pages[0].lead, edition[0]);
  assert.equal(pages[0].stories.length, FRONT_STORIES);
  assert.equal(pages[1].kind, "more");
  assert.equal(pages[1].stories.length, 10 - 1 - FRONT_STORIES);
  const short = paperPages({ edition: edition.slice(0, 4), sections: [] });
  assert.ok(!short.some((p) => p.kind === "more"));
});

test("one page per follow with stories; empty follows become notes on the back page", () => {
  const pages = paperPages({
    edition: [story(1)],
    sections: [section("cat:Sport", 3, 0), section("cat:Teknologji", 0, 0), section("city:prizren", 2, 0)],
  });
  assert.deepEqual(pages.map((p) => p.key), ["front", "cat:Sport", "city:prizren", "back"]);
  assert.deepEqual(pages.at(-1).quiet.map((s) => s.key), ["cat:Teknologji"]);
});

test("pages are numbered in order and the front page lists the rest", () => {
  const pages = paperPages({ edition: Array.from({ length: 8 }, (_, i) => story(i)), sections: [section("cat:Sport", 2, 0)] });
  assert.deepEqual(pages.map((p) => p.n), [1, 2, 3, 4]);
  assert.deepEqual(pages[0].contents.map((c) => c.n), [2, 3, 4]);
});

test("no story is on two pages", () => {
  const pages = paperPages({ edition: Array.from({ length: 9 }, (_, i) => story(i)), sections: [section("cat:Sport", 4, 0)] });
  const slugs = pages.flatMap((p) => [
    ...(p.lead ? [p.lead.article.slug] : []),
    ...(p.stories ?? []).map((s) => s.article.slug),
    ...(p.section?.items ?? []).map((s) => s.article.slug),
  ]);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("page hash round trip, clamped", () => {
  assert.equal(pageFromHash(hashForPage(2), 5), 2);
  assert.equal(pageFromHash("#faqja-99", 5), 4);
  assert.equal(pageFromHash("#faqja-0", 5), 0);
  assert.equal(pageFromHash("#tjeter", 5), 0);
  assert.equal(pageFromHash(null, 5), 0);
  assert.equal(pageFromHash("#faqja-2", 0), 0);
});
