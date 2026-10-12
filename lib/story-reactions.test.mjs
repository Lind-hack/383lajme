import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SLUGS, normalizeMine, parseSlugs, shares, talliesFrom, topLine, isVoter } from "./story-reactions.mjs";

test("slugs: only real ones, once, capped", () => {
  assert.deepEqual(parseSlugs("a-b,a-b, c ,BAD SLUG,,<x>"), ["a-b", "c"]);
  assert.equal(parseSlugs(Array.from({ length: 99 }, (_, i) => `s${i}`)).length, MAX_SLUGS);
  assert.deepEqual(parseSlugs(null), []);
});

test("rows become tallies; junk rows are dropped", () => {
  const t = talliesFrom([
    { article_slug: "a", reaction: "dakord", n: 3 },
    { article_slug: "a", reaction: "zemerim", n: "2" },
    { article_slug: "a", reaction: "love", n: 9 },
    { article_slug: "B!", reaction: "dakord", n: 1 },
    null,
  ]);
  assert.deepEqual(t, { a: { dakord: 3, zemerim: 2 } });
});

test("shares are whole percents adding to 100, most chosen first", () => {
  const { total, list } = shares({ dakord: 1, zemerim: 1, dyshim: 1 });
  assert.equal(total, 3);
  assert.equal(list.reduce((s, r) => s + r.pct, 0), 100);
  assert.ok(list[0].n >= list[1].n);
  assert.equal(shares({}).total, 0);
  assert.equal(shares({ dakord: -4 }).total, 0);
});

test("no boasting about a top reaction with too few votes", () => {
  assert.equal(topLine({ dakord: 2 }), null);
  const top = topLine({ dakord: 5, qesharake: 1 });
  assert.equal(top.key, "dakord");
  assert.equal(top.pct, 83);
  assert.equal(top.total, 6);
});

test("the reader's own reactions from storage are untrusted", () => {
  assert.deepEqual(normalizeMine({ ok: "dakord", "BAD SLUG": "dakord", other: "love" }), { ok: "dakord" });
  assert.deepEqual(normalizeMine("x"), {});
  assert.ok(isVoter("abcdef12-3456"));
  assert.ok(!isVoter("short"));
});
