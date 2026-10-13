import { test } from "node:test";
import assert from "node:assert/strict";
import { validSlugs, briefKey, buildBriefPrompt, cleanBrief, firstSentence, recapRows, MAX_SLUGS } from "./perty-brief.mjs";

test("slugs from the caller are validated, deduped and capped", () => {
  assert.deepEqual(validSlugs(["a", "a", "../etc", 4, null, "b-2"]), ["a", "b-2"]);
  assert.equal(validSlugs(Array.from({ length: 20 }, (_, i) => `s-${i}`)).length, MAX_SLUGS);
  assert.deepEqual(validSlugs("nope"), []);
});

test("the cache key does not depend on order", () => {
  assert.equal(briefKey(["b", "a"]), briefKey(["a", "b"]));
});

test("the prompt carries each article under its slug, body bounded", () => {
  const prompt = buildBriefPrompt([{ slug: "x", title: "T", excerpt: "E", body: "w ".repeat(2000) }]);
  assert.match(prompt, /slug: x/);
  assert.ok(prompt.length < 900);
});

test("only lines citing a given article survive, one per article", () => {
  const raw = {
    lines: [
      { slug: "a", text: "Qeveria miratoi buxhetin për vitin e ardhshëm." },
      { slug: "invented", text: "Një fakt që nuk vjen nga asnjë lajm i dhënë." },
      { slug: "a", text: "Një rresht i dytë për të njëjtin lajm, që hiqet." },
      { slug: "b", text: "shkurt" },
      { slug: "c", text: "Prizreni hap festivalin e filmit dokumentar këtë javë." },
    ],
  };
  assert.deepEqual(
    cleanBrief(raw, ["a", "b", "c"]).map((l) => l.slug),
    ["a", "c"]
  );
});

test("long lines are cut at a word, junk output gives nothing", () => {
  const [line] = cleanBrief({ lines: [{ slug: "a", text: "fjalë ".repeat(80) }] }, ["a"]);
  assert.ok(line.text.length <= 180);
  assert.ok(line.text.endsWith("…"));
  assert.deepEqual(cleanBrief(null, ["a"]), []);
  assert.deepEqual(cleanBrief({ lines: "x" }, ["a"]), []);
});

test("the recap covers every story: Dardani's line where he wrote one, the story's own words where not", () => {
  const stories = [
    { slug: "a", title: "A", excerpt: "Qeveria miratoi buxhetin. Opozita kundër." },
    { slug: "b", title: "Titulli B", excerpt: "" },
    { slug: "c", title: "C", excerpt: "Pa pikë në fund" },
  ];
  const rows = recapRows(stories, [{ slug: "c", text: "Dardani për C." }, { slug: "x", text: "jo" }]);
  assert.deepEqual(rows, [
    { slug: "a", text: "Qeveria miratoi buxhetin.", byDardani: false },
    { slug: "b", text: "Titulli B", byDardani: false },
    { slug: "c", text: "Dardani për C.", byDardani: true },
  ]);
  assert.deepEqual(recapRows(null, null), []);
  assert.ok(firstSentence("fjalë ".repeat(80)).length <= 180);
});
