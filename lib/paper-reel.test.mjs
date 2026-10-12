import { test } from "node:test";
import assert from "node:assert/strict";
import { SECTION_STORIES, hashForSlide, reelSlides, slideFromHash } from "./paper-reel.mjs";

const story = (slug) => ({ article: { slug, title: slug } });
const section = (key, slugs) => ({ key, title: key.split(":")[1], kind: "category", empty: slugs.length === 0, items: slugs.map(story) });

test("cover first, end last, even with nothing", () => {
  const slides = reelSlides(null);
  assert.deepEqual(slides.map((s) => s.kind), ["cover", "end"]);
  assert.deepEqual(reelSlides({ edition: [story("a")] }, { boxes: ["brief", "city"] }).map((s) => s.kind), ["cover", "brief", "brief", "story", "end"]);
});

test("each box the reader keeps is its own screen, in a group of its own", () => {
  const slides = reelSlides({ edition: [story("a")] }, { boxes: ["brief", "numbers", "brief", ""] });
  const boxes = slides.filter((s) => s.kind === "brief");
  assert.deepEqual(boxes.map((s) => `${s.box}:${s.pos}/${s.of}`), ["brief:0/2", "numbers:1/2"]);
  assert.equal(new Set(slides.map((s) => s.key)).size, slides.length);
});

test("the edition, then each follow behind its own screen", () => {
  const slides = reelSlides({ edition: [story("a"), story("b")], sections: [section("cat:Sport", ["c", "d"]), section("city:prizren", ["e"])] });
  assert.deepEqual(slides.map((s) => s.kind), ["cover", "story", "story", "section", "story", "story", "section", "story", "end"]);
  assert.deepEqual(slides.map((s) => s.n), slides.map((_, i) => i));
});

test("no story twice, and a follow left with nothing new has no screen", () => {
  const slides = reelSlides({ edition: [story("a"), story("b")], sections: [section("cat:Sport", ["a", "c"]), section("cat:Botë", ["b"])] });
  const keys = slides.filter((s) => s.kind === "story").map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(!slides.some((s) => s.key === "h:cat:Botë"));
});

test("progress: every story knows its place in its group", () => {
  const slides = reelSlides({ edition: [story("a"), story("b"), story("c")], sections: [section("cat:Sport", ["d", "e"])] });
  const stories = slides.filter((s) => s.kind === "story");
  assert.deepEqual(stories.map((s) => `${s.group}:${s.pos}/${s.of}`), ["edition:0/3", "edition:1/3", "edition:2/3", "cat:Sport:0/2", "cat:Sport:1/2"]);
});

test("a long follow shows its first stories and counts the rest", () => {
  const many = Array.from({ length: SECTION_STORIES + 3 }, (_, i) => `x${i}`);
  const slides = reelSlides({ edition: [], sections: [section("cat:Sport", many)] });
  const head = slides.find((s) => s.kind === "section");
  assert.equal(head.count, SECTION_STORIES);
  assert.equal(head.hidden, 3);
});

test("empty follows are named on the end screen", () => {
  const slides = reelSlides({ edition: [story("a")], sections: [section("cat:Teknologji", [])] });
  assert.deepEqual(slides.at(-1).quiet.map((s) => s.key), ["cat:Teknologji"]);
});

test("hash round trip, clamped", () => {
  assert.equal(slideFromHash(hashForSlide(3), 10), 3);
  assert.equal(slideFromHash("#lajmi-99", 10), 9);
  assert.equal(slideFromHash("#faqja-2", 10), 0);
  assert.equal(slideFromHash(null, 10), 0);
});
