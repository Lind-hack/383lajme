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

test("the home city outranks the other picked cities, but not a person", () => {
  const pool = [
    a("other", "Rrugë e re në Gjilan", { engagementScore: 10, publishedAt: hoursAgo(0) }),
    a("home", "Festival në Prizren", { engagementScore: 0, publishedAt: hoursAgo(30) }),
    a("person", "Osmani takon ambasadorët", { engagementScore: 0, publishedAt: hoursAgo(40) }),
  ];
  const got = rankFeed(
    pool,
    { v: 1, cities: ["gjilan"], home: "prizren", people: ["vjosa-osmani"] },
    { now: NOW, topCount: 0 }
  );
  assert.deepEqual(got.map((i) => i.article.slug), ["person", "home", "other"]);
  assert.equal(got[1].reason, "Nga Prizreni");
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

test("stories older than a week are left out; within the week they stay", () => {
  const pool = [
    a("old", "Sport", { category: "Sport", publishedAt: hoursAgo(24 * 8) }),
    a("week", "Sport", { category: "Sport", publishedAt: hoursAgo(24 * 5) }),
  ];
  const got = rankFeed(pool, { v: 1, categories: ["Sport"] }, { now: NOW, topCount: 0 });
  assert.deepEqual(got.map((i) => i.article.slug), ["week"]);
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

test("each item names its primary follow and every follow it matches", () => {
  const pool = [a("ks", "Kurti në Prizren për ndeshjen e Kosovës", { category: "Sport" })];
  const interests = { v: 1, people: ["albin-kurti"], cities: ["prizren"], categories: ["Sport"] };
  const [item] = rankFeed(pool, interests, { now: NOW, topCount: 0 });
  assert.equal(item.primaryKey, "person:albin-kurti");
  assert.deepEqual(item.keys, ["person:albin-kurti", "city:prizren", "cat:Sport"]);
});

test("keys hold followed keys only, never every name the story mentions", () => {
  const pool = [a("p", "Osmani dhe Kurti në Prizren", { category: "Kosovë" })];
  const [item] = rankFeed(pool, { v: 1, people: ["albin-kurti"] }, { now: NOW, topCount: 0 });
  assert.deepEqual(item.keys, ["person:albin-kurti"]);
});

test("top mix-ins and learned items carry no section keys", () => {
  const pool = [a("t", "Lajm i madh i ditës", { engagementScore: 50 }), a("l", "Teknologji e re", { category: "Teknologji" })];
  const interests = recordRead({}, ["cat:Teknologji"], NOW, 3);
  const got = rankFeed(pool, { v: 1, people: ["albin-kurti"], affinity: interests }, { now: NOW });
  const top = got.find((i) => i.kind === "top");
  const learned = got.find((i) => i.kind === "learned");
  assert.deepEqual([top?.primaryKey, top?.keys], ["top", []]);
  assert.deepEqual([learned?.primaryKey, learned?.keys], ["learned", []]);
});
