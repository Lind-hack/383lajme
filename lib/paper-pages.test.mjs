import { test } from "node:test";
import assert from "node:assert/strict";
import { FRONT_STORIES, MORE_PER_PAGE, SECTION_STORIES, hashForPage, pageFromHash, paperPages, spreadStart } from "./paper-pages.mjs";

const story = (i) => ({ article: { slug: `s${i}` } });
const section = (key, n, start) => ({
  key,
  title: key.split(":")[1],
  kind: "category",
  empty: n === 0,
  items: Array.from({ length: n }, (_, i) => ({ article: { slug: `${key}-${start + i}` } })),
});

test("front, contents and back pages always exist", () => {
  const pages = paperPages({ edition: [], sections: [] });
  assert.deepEqual(pages.map((p) => p.kind), ["front", "index", "back", "about"]);
  assert.equal(paperPages(null).length, 4);
});

test("front holds the lead and the next stories; the rest go to 'Më shumë', a page at a time", () => {
  const edition = Array.from({ length: 10 }, (_, i) => story(i));
  const pages = paperPages({ edition, sections: [] });
  assert.equal(pages[0].lead, edition[0]);
  assert.equal(pages[0].stories.length, FRONT_STORIES);
  const more = pages.filter((p) => p.kind === "more");
  assert.equal(more.reduce((n, p) => n + p.stories.length, 0), 10 - 1 - FRONT_STORIES);
  assert.ok(more.every((p) => p.stories.length <= MORE_PER_PAGE));
  assert.equal(new Set(more.map((p) => p.key)).size, more.length);
  const short = paperPages({ edition: edition.slice(0, 4), sections: [] });
  assert.ok(!short.some((p) => p.kind === "more"));
});

test("one page per follow with stories, never more than fit; empty follows become notes", () => {
  const pages = paperPages({
    edition: [story(1)],
    sections: [section("cat:Sport", 7, 0), section("cat:Teknologji", 0, 0), section("city:prizren", 2, 0)],
  });
  assert.deepEqual(pages.filter((p) => p.kind === "section").map((p) => p.key), ["cat:Sport", "city:prizren"]);
  const sport = pages.find((p) => p.key === "cat:Sport");
  assert.equal(sport.items.length, SECTION_STORIES);
  assert.equal(sport.hidden, 7 - SECTION_STORIES);
  assert.deepEqual(pages.find((p) => p.kind === "back").quiet.map((s) => s.key), ["cat:Teknologji"]);
});

test("always an even number of pages, so spreads are never half empty", () => {
  for (let e = 0; e < 12; e++) {
    for (let s = 0; s < 5; s++) {
      const sections = Array.from({ length: s }, (_, i) => section(`cat:T${i}`, 2, 0));
      const pages = paperPages({ edition: Array.from({ length: e }, (_, i) => story(i)), sections });
      assert.equal(pages.length % 2, 0, `edition ${e}, sections ${s}`);
      assert.equal(pages.filter((p) => p.kind === "back").length, 1);
    }
  }
});

test("pages are numbered in order and the contents page lists the rest", () => {
  const pages = paperPages({ edition: Array.from({ length: 8 }, (_, i) => story(i)), sections: [section("cat:Sport", 2, 0)] });
  assert.deepEqual(pages.map((p) => p.n), pages.map((_, i) => i + 1));
  const listed = pages[1].contents.map((c) => c.key);
  assert.ok(listed.includes("front") && listed.includes("cat:Sport") && listed.includes("back"));
  assert.ok(!listed.includes("index"));
});

test("no story is on two pages", () => {
  const pages = paperPages({ edition: Array.from({ length: 9 }, (_, i) => story(i)), sections: [section("cat:Sport", 4, 0)] });
  const slugs = pages.flatMap((p) => [
    ...(p.lead ? [p.lead.article.slug] : []),
    ...(p.stories ?? []).map((s) => s.article.slug),
    ...(p.items ?? []).map((s) => s.article.slug),
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

test("spreads start on odd page numbers", () => {
  assert.equal(spreadStart(0, 2), 0);
  assert.equal(spreadStart(1, 2), 0);
  assert.equal(spreadStart(5, 2), 4);
  assert.equal(spreadStart(5, 1), 5);
  assert.equal(spreadStart(NaN, 2), 0);
});
