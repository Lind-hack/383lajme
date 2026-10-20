import test from "node:test";
import assert from "node:assert/strict";
import { rankRelated } from "./related-articles.mjs";

const NOW = Date.parse("2026-10-21T08:00:00Z");
const daysAgo = (d) => new Date(NOW - d * 86_400_000).toISOString();

const reading = {
  id: "a",
  slug: "kurti-samit-be",
  title: "Kosovë: Kurti e Rama marrin pjesë në samit për BE-në në Mal të Zi",
  excerpt: "Takimi në Mal të Zi përfshin bisedime për integrimin evropian të Ballkanit Perëndimor.",
  category: "Kosovë",
  publishedAt: daysAgo(0),
  imageUrl: "/a.jpg",
};

const article = (id, title, excerpt, extra = {}) => ({
  id,
  slug: id,
  title,
  excerpt,
  category: "Botë",
  publishedAt: daysAgo(1),
  imageUrl: `/${id}.jpg`,
  ...extra,
});

test("a story naming the same people outranks a same-category story about something else", () => {
  const onTopic = article("b", "Kurti kërkon nga Brukseli statusin e kandidatit", "Albin Kurti takoi Ursula von der Leyen.", { category: "Kosovë" });
  const sameSectionOnly = article("c", "Prishtinë: Hapet tregu i ri i frutave", "Komuna njofton orarin e ri.", { category: "Kosovë" });
  const ranked = rankRelated(reading, [sameSectionOnly, onTopic], { now: NOW });
  assert.deepEqual(ranked.map((a) => a.id), ["b"]);
});

test("weak matches are dropped rather than padded in", () => {
  const unrelated = article("d", "Brighton fiton derbin 5-0", "Ndeshja u luajt të shtunën.");
  assert.deepEqual(rankRelated(reading, [unrelated], { now: NOW }), []);
});

test("a second write-up of the same story is not offered as related", () => {
  const duplicate = article("e", "Kurti e Rama marrin pjesë në samitin për BE-në", "Samit në Mal të Zi.");
  assert.deepEqual(rankRelated(reading, [duplicate], { now: NOW }).map((a) => a.id), []);
});

test("fresher beats older when the match is equal", () => {
  const old = article("f", "Rama flet për integrimin evropian", "Edi Rama në Bruksel.", { publishedAt: daysAgo(20) });
  const fresh = article("g", "Rama flet për integrimin evropian sot", "Edi Rama në Tiranë.", { publishedAt: daysAgo(1) });
  const ranked = rankRelated(reading, [old, fresh], { now: NOW, minScore: 0.1 });
  assert.equal(ranked[0].id, "g");
});

test("exclude, requireImage and limit are honoured, and picks never repeat a story", () => {
  const pool = [
    article("h", "Kurti takon Ramën në Podgoricë", "Kurti dhe Rama diskutojnë.", { imageUrl: null }),
    article("i", "Kurti takon Ramën në Podgoricë për BE-në", "Kurti dhe Rama diskutojnë BE-në."),
    article("j", "Kurti takon Ramën në Podgoricë për BE-në sërish", "Kurti dhe Rama diskutojnë BE-në."),
    article("k", "Rama: Ballkani Perëndimor gati për BE", "Rama foli në Mal të Zi."),
  ];
  const ranked = rankRelated(reading, pool, { now: NOW, requireImage: true, exclude: ["k"], limit: 5 });
  assert.ok(!ranked.some((a) => a.id === "h"), "imageless story kept");
  assert.ok(!ranked.some((a) => a.id === "k"), "excluded story kept");
  assert.equal(ranked.filter((a) => a.id === "i" || a.id === "j").length, 1, "same story offered twice");
});

test("shared generic words and the same section do not make two stories related", () => {
  const a = { ...reading, id: "x", slug: "x", title: "Kosovë: Ministria e Financave njofton buxhetin e ri", excerpt: "Ministria publikon draftin e buxhetit." };
  const b = article("y", "Ministri i Shëndetësisë shpall rregulla të reja", "Ministria publikon udhëzimin.", { category: "Kosovë" });
  assert.deepEqual(rankRelated(a, [b], { now: NOW }), []);
});

test("a speaker before the colon is kept as a name", () => {
  const quote = { ...reading, id: "q", slug: "q", title: "Kurti: Nuk ka marrëveshje pa njohje", excerpt: "Kryeministri foli pas takimit." };
  const other = article("r", "Opozita sulmon Kurtin për dialogun", "Deputetët kërkojnë seancë.", { category: "Kosovë" });
  assert.deepEqual(rankRelated(quote, [other], { now: NOW }).map((x) => x.id), ["r"]);
});

test("declined names meet their base form", () => {
  const declined = article("s", "Kurtit i kërkohet dorëheqja nga opozita", "Seanca e Kuvendit vazhdon.", { category: "Kosovë" });
  assert.deepEqual(rankRelated(reading, [declined], { now: NOW }).map((x) => x.id), ["s"]);
});

test("an all-caps headline contributes no names", () => {
  const shouty = article("t", "LAJM I FUNDIT: SAMIT NË MAL TË ZI", "", { category: "Kosovë" });
  assert.deepEqual(rankRelated(reading, [shouty], { now: NOW }), []);
});

test("articles in the same dosje get a bonus", () => {
  const plain = article("l", "Kurti flet për dialogun", "Kurti në Prishtinë.");
  const inTopic = article("m", "Kurti flet për dialogun sërish", "Kurti në Prishtinë.", { publishedAt: daysAgo(3) });
  const ranked = rankRelated(reading, [plain, inTopic], { now: NOW, topicSlugs: ["m"], minScore: 0.1 });
  assert.equal(ranked[0].id, "m");
});
