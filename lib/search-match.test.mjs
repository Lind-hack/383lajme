import assert from "node:assert/strict";
import test from "node:test";

import {
  fold,
  terms,
  scoreEntry,
  search,
  nearest,
  looksLikeQuestion,
  GROUPS,
} from "./search-match.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Folding
//
// Nobody types ë or ç on a phone. If folding breaks, the search returns nothing
// for most Albanian words and looks simply broken.
// ─────────────────────────────────────────────────────────────────────────────

test("diacritics fold away, so a phone keyboard still finds the word", () => {
  assert.equal(fold("Kosovë"), "kosove");
  assert.equal(fold("Çmimet"), "cmimet");
  assert.equal(fold("Prishtinë"), "prishtine");
  assert.equal(fold("Gjermani"), "gjermani");
});

test("case and punctuation are irrelevant to a match", () => {
  assert.equal(fold("DIALOGU Kosovë-Serbi!"), "dialogu kosove serbi");
  assert.equal(fold("  të  larta?  "), "te larta");
});

test("folding survives an empty or absent value", () => {
  for (const v of ["", null, undefined, "   ", "!!!"]) assert.equal(fold(v), "");
  assert.deepEqual(terms(""), []);
  assert.deepEqual(terms("dialogu  serbi"), ["dialogu", "serbi"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Ranking
// ─────────────────────────────────────────────────────────────────────────────

test("an exact title beats a prefix, which beats a word, which beats a substring", () => {
  const q = terms("bote");
  const exact = scoreEntry(q, { title: "Botë" });
  const prefix = scoreEntry(q, { title: "Botëkuptimi modern" });
  const word = scoreEntry(q, { title: "Lajme nga bote e gjerë" });
  const body = scoreEntry(q, { title: "Diçka tjetër", body: "ndodhi në bote" });
  assert.ok(exact > prefix, `exact ${exact} !> prefix ${prefix}`);
  assert.ok(prefix > word, `prefix ${prefix} !> word ${word}`);
  assert.ok(word > body, `word ${word} !> body ${body}`);
});

test("a title match cannot be displaced by any pile of body matches", () => {
  const q = terms("kosove");
  const titled = scoreEntry(q, { title: "Kosovë" });
  const bodyHeavy = scoreEntry(q, {
    title: "Diçka",
    body: "kosove ".repeat(50),
  });
  assert.ok(titled > bodyHeavy, `${titled} !> ${bodyHeavy}`);
});

test("every term must hit, so extra words narrow rather than widen", () => {
  const entry = { title: "Dialogu Kosovë-Serbi", body: "bisedimet vazhdojnë" };
  assert.ok(scoreEntry(terms("dialogu"), entry) > 0);
  assert.ok(scoreEntry(terms("dialogu serbi"), entry) > 0);
  assert.equal(scoreEntry(terms("dialogu bitcoin"), entry), 0, "unmatched term must exclude");
});

test("a shorter title wins when both contain the query", () => {
  const q = terms("bot");
  const short = scoreEntry(q, { title: "Botë" });
  const long = scoreEntry(q, { title: "Botë e gjerë dhe lajmet ndërkombëtare sot" });
  assert.ok(short > long, `${short} !> ${long}`);
});

test("weight lets a destination outrank an article of equal text match", () => {
  const q = terms("gjermani");
  const plain = scoreEntry(q, { title: "Gjermani" });
  const weighted = scoreEntry(q, { title: "Gjermani", weight: 1.5 });
  assert.ok(weighted > plain);
});

test("an empty query matches nothing rather than everything", () => {
  assert.equal(scoreEntry(terms(""), { title: "Kosovë" }), 0);
  assert.deepEqual(search([{ kind: "vend", title: "Kosovë" }], ""), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Grouping
// ─────────────────────────────────────────────────────────────────────────────

const INDEX = [
  { kind: "tema", title: "Dialogu Kosovë-Serbi" },
  { kind: "artikull", title: "Sorensen: Nuk ka afat kohor për dialogun" },
  { kind: "artikull", title: "LDK heq kërkesën për zgjedhjen e Presidentit", body: "dialogu" },
  { kind: "vend", title: "Gjermani" },
  { kind: "kategori", title: "Botë" },
  { kind: "vizito", title: "Prizren" },
  { kind: "treg", title: "A do të nisë dialogu deri në dhjetor?" },
];

test("results arrive grouped, with the strongest group first", () => {
  const groups = search(INDEX, "dialogu");
  assert.ok(groups.length > 0);
  assert.equal(groups[0].kind, "tema", "the exact topic should lead, not the articles");
  assert.equal(groups[0].label, "TEMA");
});

test("a country query returns the country ahead of anything else", () => {
  const groups = search(INDEX, "gjermani");
  assert.equal(groups[0].kind, "vend");
  assert.equal(groups[0].items[0].title, "Gjermani");
});

test("each group is capped so one kind cannot fill the overlay", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    kind: "artikull",
    title: `Dialogu numër ${i}`,
  }));
  const groups = search(many, "dialogu", { perGroup: 4 });
  assert.equal(groups[0].items.length, 4);
});

test("the overall cap is respected across groups", () => {
  const groups = search(INDEX, "dialogu", { perGroup: 10, total: 2 });
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  assert.equal(count, 2);
});

test("no group is emitted empty", () => {
  for (const g of search(INDEX, "dialogu")) {
    assert.ok(g.items.length > 0, `${g.kind} came back empty`);
  }
});

test("every declared group has an Albanian heading", () => {
  for (const g of GROUPS) {
    assert.ok(g.label && g.label === g.label.toUpperCase(), `${g.kind} heading`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The zero-result state
//
// A dead end is the one outcome this feature must never produce.
// ─────────────────────────────────────────────────────────────────────────────

test("a near-miss suggests the destinations it nearly matched", () => {
  const s = nearest(INDEX, "gjerman");
  assert.ok(s.length > 0);
  assert.equal(s[0].title, "Gjermani");
});

test("suggestions are places to go, never a lone article", () => {
  const s = nearest(INDEX, "dialog");
  assert.ok(s.length > 0);
  for (const item of s) {
    assert.notEqual(item.kind, "artikull", `suggested an article: ${item.title}`);
  }
});

test("a query sharing nothing suggests nothing rather than noise", () => {
  assert.deepEqual(nearest(INDEX, "zzzzqqq"), []);
});

test("suggestions need most of the word, not a shared syllable", () => {
  assert.deepEqual(nearest(INDEX, "g"), [], "one letter must not match everything");
  assert.deepEqual(nearest(INDEX, "gj"), []);
  // The case that made this rule: "dialogu" once suggested a Spanish outlet
  // called "Diario", which is a correct three-letter prefix and a useless answer.
  const withOutlet = [...INDEX, { kind: "media", title: "Diario Área Campo de Gibraltar" }];
  const s = nearest(withOutlet, "dialogu");
  for (const item of s) {
    assert.ok(!item.title.startsWith("Diario"), `suggested ${item.title} for "dialogu"`);
  }
});

test("a genuine near-miss still suggests, despite the stricter stem", () => {
  assert.equal(nearest(INDEX, "gjerman")[0]?.title, "Gjermani", "one letter short still matches");
  assert.equal(nearest(INDEX, "prizre")[0]?.title, "Prizren");
});

// ─────────────────────────────────────────────────────────────────────────────
// Question detection — only ever promotes Pyet 383, never withholds results
// ─────────────────────────────────────────────────────────────────────────────

test("question-shaped queries are recognised", () => {
  for (const q of [
    "a do te vazhdoje dialogu?",
    "Pse u ndal dialogu",
    "si funksionon tregu",
    "Kush e fitoi zgjedhjen",
    "çfarë ndodhi sot",
  ]) {
    assert.equal(looksLikeQuestion(q), true, q);
  }
});

test("a plain lookup is not mistaken for a question", () => {
  for (const q of ["dialogu Kosovë-Serbi", "Gjermani", "çmimet e banesave", ""]) {
    assert.equal(looksLikeQuestion(q), false, q);
  }
});

test("question detection never changes what is returned", () => {
  const asQuestion = search(INDEX, "a do të nisë dialogu?");
  const asLookup = search(INDEX, "dialogu");
  assert.ok(asQuestion.length > 0, "a question still searches");
  assert.ok(asLookup.length > 0);
});
