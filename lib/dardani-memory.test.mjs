import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMemory,
  recordQuestion,
  questionKeys,
  personalStarters,
  personalArticleQuestions,
} from "./dardani-memory.mjs";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3600_000).toISOString();
const a = (slug, title, extra = {}) => ({
  slug,
  title,
  excerpt: "",
  category: "Botë",
  publishedAt: hoursAgo(2),
  engagementScore: 5,
  ...extra,
});

test("stored memory is untrusted: junk becomes an empty memory", () => {
  assert.deepEqual(normalizeMemory(null), { v: 1, asked: [] });
  assert.deepEqual(normalizeMemory({ v: 9, asked: [{ q: "x", t: "2026-01-01" }] }), { v: 1, asked: [] });
  assert.deepEqual(normalizeMemory({ v: 1, asked: [{ q: 3 }, { q: "ok?", t: "nope" }] }).asked, []);
});

test("questions are remembered newest first, once each, and capped", () => {
  let m = recordQuestion(null, "Pse ndodhi kjo?", NOW);
  m = recordQuestion(m, "Kush është Kurti?", NOW + 1);
  m = recordQuestion(m, "Pse ndodhi kjo?", NOW + 2);
  assert.deepEqual(m.asked.map((x) => x.q), ["Pse ndodhi kjo?", "Kush është Kurti?"]);
  assert.deepEqual(m.asked.map((x) => x.n), [2, 1]);
  for (let i = 0; i < 30; i++) m = recordQuestion(m, `Pyetja ${i}`, NOW + i);
  assert.equal(m.asked.length, 20);
});

test("a question's people and cities become affinity keys, categories do not", () => {
  const keys = questionKeys("Si luajti Vedat Muriqi në Prizren?");
  assert.ok(keys.includes("person:vedat-muriqi"));
  assert.ok(keys.includes("city:prizren"));
  assert.ok(!keys.some((k) => k.startsWith("cat:")));
});

test("starters follow the reader: a followed person comes first, named in the label", () => {
  const pool = [
    a("x", "Qeveria miraton buxhetin për vitin e ardhshëm", { category: "Ekonomi" }),
    a("m", "Muriqi shënon dy gola në fitoren e Mallorcës", { category: "Sport" }),
  ];
  const [first] = personalStarters(pool, { v: 1, categories: ["Ekonomi"], people: ["vedat-muriqi"] }, null, 3, NOW);
  assert.match(first.label, /^Vedat Muriqi:/);
  assert.match(first.question, /Muriqi shënon dy gola/);
  assert.equal(first.reason, "Sepse ndjek Vedat Muriqi");
});

test("starters never repeat a question the reader already asked", () => {
  const pool = [a("x", "Qeveria miraton buxhetin për vitin e ardhshëm", { category: "Ekonomi" })];
  const interests = { v: 1, categories: ["Ekonomi"] };
  const [s] = personalStarters(pool, interests, null, 3, NOW);
  const memory = recordQuestion(null, s.question, NOW);
  assert.deepEqual(personalStarters(pool, interests, memory, 3, NOW), []);
});

test("no interests and no history means no personal starters", () => {
  assert.deepEqual(personalStarters([a("x", "Një lajm i zakonshëm për sot")], null, null, 3, NOW), []);
});

test("an article that names a followed person gets a question about them", () => {
  const article = { title: "Muriqi kthehet te Kombëtarja", excerpt: "", category: "Sport" };
  const [q] = personalArticleQuestions(article, { people: ["vedat-muriqi"] });
  assert.equal(q.question, "Çfarë roli ka Vedat Muriqi në këtë ngjarje?");
  assert.deepEqual(personalArticleQuestions(article, { people: [] }), []);
});
