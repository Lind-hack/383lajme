import { test } from "node:test";
import assert from "node:assert/strict";
import { articleQuestions, starterQuestions } from "./pyet-questions.mjs";

const ARTICLE = {
  slug: "kurti-buxheti",
  title: "Albin Kurti prezanton buxhetin e ri për 2026",
  category: "Politikë",
};

test("every article offers the 'why did this happen' opening the reader asked for", () => {
  const chips = articleQuestions(ARTICLE);
  assert.ok(chips.some((c) => /Pse ndodhi/.test(c.label)));
  assert.ok(chips.every((c) => c.question.length > c.label.length - 8));
});

test("the section decides the fourth angle", () => {
  assert.ok(articleQuestions(ARTICLE).some((c) => /palët/.test(c.label)));
  assert.ok(
    articleQuestions({ ...ARTICLE, category: "Ekonomi" }).some((c) => /qytetarët/.test(c.label)),
  );
  // An unknown section still gets an angle chip rather than dropping to two.
  const unknown = articleQuestions({ ...ARTICLE, category: "Diçka" });
  assert.equal(unknown.length, 3);
  assert.ok(unknown.some((c) => c.label === "Çfarë do të thotë kjo?"));
});

test("a subject named in the headline earns a 'who is' chip", () => {
  const chips = articleQuestions(ARTICLE, [{ name: "Albin Kurti" }]);
  assert.ok(chips.some((c) => c.label === "Kush është Albin Kurti?"));
});

test("short subject names are not matched out of ordinary words", () => {
  // "BE" folds to two characters and would otherwise match inside any word.
  const chips = articleQuestions(ARTICLE, [{ name: "BE" }]);
  assert.ok(!chips.some((c) => /Kush është BE/.test(c.label)));
});

test("never more than four chips", () => {
  const chips = articleQuestions(ARTICLE, [{ name: "Albin Kurti" }, { name: "Vjosa Osmani" }]);
  assert.equal(chips.length, 4);
});

test("overlay starters come from real published headlines", () => {
  const starters = starterQuestions(
    [{ title: "Kuvendi miraton ligjin e ri për energjinë pas debatit të gjatë" }, { title: "Po" }],
    3,
  );
  assert.equal(starters.length, 1, "a too-short headline is not offered");
  assert.ok(starters[0].label.length <= 53);
  assert.ok(starters[0].question.startsWith("Pse ndodhi kjo:"));
});
