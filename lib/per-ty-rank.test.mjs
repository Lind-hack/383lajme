import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFeed, articleKeys, countMatches, TOP_REASON, LEARNED_REASON } from "./per-ty-rank.mjs";
import { recordRead } from "./interests.mjs";

const NOW = Date.parse("2026-09-24T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3600_000).toISOString();

function a(slug, title, extra = {}) {
  return { slug, title, excerpt: "", category: "Botë", publishedAt: hoursAgo(2), engagementScore: 5, ...extra };
}

test("a followed person matches through Albanian declension", () => {
  const pool = [a("k", "Opozita i kërkon Kurtit dorëheqjen", { category: "Kosovë" })];
  const [item] = rankFeed(pool, { v: 1, people: ["albin-kurti"] }, { now: NOW, topCount: 0 });
  assert.equal(item.reason, "Sepse ndjek Albin Kurti");
});

test("a city matches from the headline when the article has no city field", () => {
  const pool = [a("p", "Festival i ri në Prizren këtë fundjavë")];
  const [item] = rankFeed(pool, { v: 1, cities: ["prizren"] }, { now: NOW, topCount: 0 });
  assert.equal(item.reason, "Nga Prizreni");
});

test("the pipeline's city field counts even when the text never names the city", () => {
  const pool = [a("p", "Komuna hap tenderin për rrugët", { city: "Pejë" })];
  const [item] = rankFeed(pool, { v: 1, cities: ["peje"] }, { now: NOW, topCount: 0 });
  assert.equal(item.reason, "Nga Peja");
});

test("common words and look-alike names do not trigger a follow", () => {
  const pool = [
    a("ora", "Ora e punës ndryshon nga tetori"),
    a("rexhep", "Rexhep Meidani flet për Kosovën"),
    a("lipjan", "Lipjani merr fonde për shkollat"),
  ];
  const got = rankFeed(pool, { v: 1, people: ["rita-ora", "bebe-rexha", "dua-lipa"] }, { now: NOW, topCount: 0 });
  assert.deepEqual(got, []);
});

test("person outranks city outranks category", () => {
  const pool = [
    a("cat", "Ndeshja e mbrëmjes", { category: "Sport", engagementScore: 10, publishedAt: hoursAgo(0) }),
    a("city", "Rrugë e re në Gjilan", { engagementScore: 0, publishedAt: hoursAgo(20) }),
    a("person", "Osmani takon ambasadorët", { engagementScore: 0, publishedAt: hoursAgo(30) }),
  ];
  const got = rankFeed(
    pool,
    { v: 1, categories: ["Sport"], cities: ["gjilan"], people: ["vjosa-osmani"] },
    { now: NOW, topCount: 0 }
  );
  assert.deepEqual(got.map((i) => i.article.slug), ["person", "city", "cat"]);
});

test("learned affinity never outranks an explicit pick", () => {
  let affinity = {};
  for (let i = 0; i < 30; i++) affinity = recordRead(affinity, ["cat:Showbiz"], NOW);
  const pool = [
    a("picked", "Një lajm i vjetër sporti", { category: "Sport", engagementScore: 0, publishedAt: hoursAgo(90) }),
    a("learned", "Lajmi më i ri showbiz", { category: "Showbiz", engagementScore: 10, publishedAt: hoursAgo(0) }),
  ];
  const got = rankFeed(pool, { v: 1, categories: ["Sport"], affinity }, { now: NOW, topCount: 0 });
  assert.deepEqual(got.map((i) => i.article.slug), ["picked", "learned"]);
  assert.equal(got[1].reason, LEARNED_REASON);
});

test("a faded trace of an old read is not a reason to show a story", () => {
  const long = NOW - 120 * 24 * 3600_000;
  const affinity = recordRead({}, ["cat:Showbiz"], long);
  const pool = [a("s", "Lajm showbiz", { category: "Showbiz" })];
  assert.deepEqual(rankFeed(pool, { v: 1, categories: ["Sport"], affinity }, { now: NOW, topCount: 0 }), []);
});

test("top stories are mixed in, labelled, and never duplicated", () => {
  const pool = [
    a("s1", "Sport 1", { category: "Sport" }),
    a("s2", "Sport 2", { category: "Sport" }),
    a("big", "Lajmi i madh i ditës", { category: "Kosovë", engagementScore: 10 }),
    a("old", "Lajm i vjetër", { category: "Kosovë", engagementScore: 10, publishedAt: hoursAgo(60) }),
  ];
  const got = rankFeed(pool, { v: 1, categories: ["Sport"] }, { now: NOW, topCount: 1 });
  assert.deepEqual(got.map((i) => i.article.slug), ["s1", "big", "s2"]);
  assert.equal(got[1].reason, TOP_REASON);
});

test("stories older than four days are left out", () => {
  const pool = [a("old", "Sport", { category: "Sport", publishedAt: hoursAgo(24 * 5) })];
  assert.deepEqual(rankFeed(pool, { v: 1, categories: ["Sport"] }, { now: NOW, topCount: 0 }), []);
});

test("junk interests and a junk pool do not throw", () => {
  assert.deepEqual(rankFeed(null, "nope", { now: NOW }), []);
  assert.deepEqual(rankFeed([null, {}, { slug: "x" }], { v: 1, categories: ["Sport"] }, { now: NOW, topCount: 0 }), []);
});

test("articleKeys lists category, people and cities for learning", () => {
  const keys = articleKeys({ title: "Kurti viziton Prizrenin", excerpt: "", category: "Kosovë" });
  assert.deepEqual(keys, ["cat:Kosovë", "person:albin-kurti", "city:prizren"]);
});

test("countMatches ignores learned-only items and top mix-ins", () => {
  const pool = [a("s", "Sport", { category: "Sport" }), a("b", "Botë")];
  assert.equal(countMatches(pool, { v: 1, categories: ["Sport"] }, NOW), 1);
});
