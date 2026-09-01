import test from "node:test";
import assert from "node:assert/strict";

import { fold, scoreTopic, matchTopic, isStandingSubject, MIN_TOPIC_SCORE } from "./dosje-match.mjs";

/**
 * Eligibility.
 *
 * The rule this replaces attached a full Kosovo KFOR dossier to anything
 * containing "nato". These tests hold the line where it belongs: a topic needs
 * one of its own anchors, a veto beats everything, and a tie means the matcher
 * does not know and shows nothing.
 */

const KFOR = {
  slug: "kfor",
  anchors: ["kfor", "kosove", "mitrovice", "iber"],
  signals: ["nato", "trupa", "paqeruajtes", "siguri"],
  excludes: ["turqi", "stervitje", "ukraine", "afganistan"],
};

const BE = {
  slug: "anetaresimi-ne-be",
  anchors: ["anetaresim", "kandidat", "acquis", "kosove"],
  signals: ["bruksel", "komisioni", "raport"],
  excludes: [],
};

const article = (title, extra = {}) => ({
  slug: "s",
  title,
  excerpt: "",
  category: "Botë",
  publishedAt: "2026-08-20",
  ...extra,
});

test("a NATO exercise in Turkey gets no Kosovo dossier", () => {
  // The named bug. "nato" is present, but it is only a signal, there is no
  // Kosovo anchor, and "turqi" vetoes outright.
  const a = article("Stërvitje të mëdha të NATO-s nisin në Turqi këtë javë");
  const r = scoreTopic(a, KFOR);
  assert.equal(r.vetoed, true, "the exclude term should veto");
  assert.equal(r.score, 0);
  assert.equal(matchTopic(a, [KFOR, BE]), null);
});

test("NATO alone never carries a match", () => {
  const a = article("NATO diskuton buxhetin e ri të mbrojtjes");
  const r = scoreTopic(a, KFOR);
  assert.deepEqual(r.reasons.anchors, [], "no anchor is present");
  assert.equal(r.score, 0, "signals alone must score nothing");
  assert.equal(matchTopic(a, [KFOR]), null);
});

test("a real KFOR story matches, with its reasons", () => {
  const a = article("KFOR-i rrit patrullat te ura mbi Ibër në Mitrovicë", {
    excerpt: "Trupat e NATO-s vlerësojnë sigurinë në veri.",
  });
  const m = matchTopic(a, [KFOR, BE]);
  assert.ok(m, "a genuine KFOR story should match");
  assert.equal(m.topic.slug, "kfor");
  assert.ok(m.score >= MIN_TOPIC_SCORE);
  assert.ok(m.reasons.anchors.includes("kfor"), "the anchor should be recorded");
  assert.ok(m.reasons.signals.length >= 1, "supporting signals should be recorded");
});

test("a hyphenated headline form still matches its bare anchor", () => {
  // "KFOR-it" used to fold to "kfor-it", which the bare form "kfor" could not
  // match, so matches were being made by accident on other words.
  const m = matchTopic(article("Mandati i KFOR-it në Kosovë mbetet i pandryshuar"), [KFOR]);
  assert.ok(m, "KFOR-it should match the anchor kfor");
  assert.equal(m.topic.slug, "kfor");
});

test("an exclude beats any number of signals", () => {
  const a = article("KFOR-i dërgon trupa në stërvitje në Ukrainë", {
    excerpt: "NATO, trupa, siguri, paqeruajtës.",
  });
  assert.equal(scoreTopic(a, KFOR).vetoed, true);
  assert.equal(matchTopic(a, [KFOR]), null);
});

test("a tie abstains rather than picking the first topic", () => {
  // "kosove" is an anchor for both files and nothing else tips the balance.
  // Array order must not decide which dossier a reader is shown.
  const a = article("Kosova nis procedurat e reja administrative");
  const both = matchTopic(a, [KFOR, BE]);
  assert.equal(both, null, "an even match must show no dossier at all");
});

test("an off-topic story matches nothing", () => {
  for (const t of ["Bitcoin bie nën 90 mijë dollarë", "Tesla prezanton modelin e ri"]) {
    assert.equal(matchTopic(article(t), [KFOR, BE]), null, t);
  }
});

test("standing is measured by when the news happened, not when we looked", () => {
  // The bug this pins: the SQL selector counted the mapping job's own run
  // timestamp as "days". One run stamps every row identically, so the count
  // was always one, the threshold was two, and the nightly research job
  // answered no_candidate forever — on schedule, looking like a quiet week.
  //
  // Two implementations of one rule drifted. This asserts the JS side reads
  // the article's publication date; dosje_next_subject in migration 0056
  // asserts the same thing on the SQL side, with the same fixture shape.
  const oneRunThreeDays = [
    { articleSlug: "d1", publishedAt: "2026-08-20T09:00:00Z" },
    { articleSlug: "d2", publishedAt: "2026-08-21T09:00:00Z" },
    { articleSlug: "d3", publishedAt: "2026-08-22T09:00:00Z" },
  ];
  assert.equal(
    isStandingSubject(oneRunThreeDays),
    true,
    "articles published across three days are a standing subject, however few times we looked"
  );

  const oneBusyDay = [
    { articleSlug: "s1", publishedAt: "2026-08-20T07:00:00Z" },
    { articleSlug: "s2", publishedAt: "2026-08-20T13:00:00Z" },
    { articleSlug: "s3", publishedAt: "2026-08-20T19:00:00Z" },
  ];
  assert.equal(isStandingSubject(oneBusyDay), false, "one busy day is one story");
});

test("a subject must recur across days before it earns a dossier", () => {
  const day = (slug, d) => ({ articleSlug: slug, publishedAt: `2026-08-${d}` });

  assert.equal(isStandingSubject([day("a", "20"), day("b", "20")]), false, "two articles is not a subject");
  assert.equal(
    isStandingSubject([day("a", "20"), day("b", "20"), day("c", "20")]),
    false,
    "three articles on one day is one story, not a standing subject"
  );
  assert.equal(
    isStandingSubject([day("a", "20"), day("b", "21"), day("c", "23")]),
    true,
    "three articles across three days is a subject"
  );
});

/**
 * Inflection.
 *
 * Albanian declines its nouns, and the matcher compares whole words. A topic
 * that lists "kosove" therefore saw nothing in a headline reading "për
 * Kosovën" — and that is not a rare shape, it is the ordinary accusative. Run
 * across the live archive the matcher attached a dossier to none of its 105
 * articles, and this was the largest reason why.
 *
 * The variants are spellings of subjects a topic already names. They must not
 * become a way for a topic to acquire a subject it never claimed.
 */

test("a subject counts in the cases Albanian actually declines it into", () => {
  const topic = { slug: "t", matchGroups: [["kosove"]], context: [], signals: [], excludes: [] };

  for (const form of ["Kosovë", "Kosova", "Kosovës", "Kosovën", "Kosovo"]) {
    assert.ok(
      scoreTopic(article(`Raport për ${form} sot`), topic).score >= MIN_TOPIC_SCORE,
      `"${form}" is the same subject as the form the topic lists`
    );
  }
});

test("both transliterations of a Serbian name are the same person", () => {
  // 383 publishes "Vuçiq" and "Vučić" in the same week. The topics carried
  // only the Serbian spelling, so the Albanian one matched nothing.
  const topic = { slug: "t", matchGroups: [["vucic"]], context: [], signals: [], excludes: [] };

  for (const form of ["Vuçiq", "Vučić", "Vuçiqi", "Vuçiqit"]) {
    assert.ok(
      scoreTopic(article(`${form} flet për veriun`), topic).score >= MIN_TOPIC_SCORE,
      `"${form}" is the same subject as "vucic"`
    );
  }
});

test("a variant is a spelling, not a new subject", () => {
  // The point of the table is recall on names a topic already claims. It must
  // not widen what the topic is about: an unrelated word stays unrelated, and
  // a veto still beats a variant that matched.
  const topic = { slug: "t", matchGroups: [["kosove"]], context: [], signals: [], excludes: ["turqi"] };

  assert.equal(scoreTopic(article("Kosovari fiton çmimin"), topic).score, 0,
    "'kosovari' describes a person, and is not a form of the place the topic names");
  assert.equal(scoreTopic(article("Stërvitje në Kosovën veriore dhe në Turqi"), topic).score, 0,
    "a veto still beats a subject matched through a variant");
});

test("an inflected subject still cannot carry a story that fails the context gate", () => {
  // Recall must not cost precision: North Macedonia's EU path shares the
  // vocabulary of Kosovo's file and must still be refused.
  const topic = {
    slug: "anetaresimi-ne-be",
    matchGroups: [["anetaresim"]],
    context: ["kosove", "prishtina"],
    signals: [],
    excludes: [],
  };

  assert.equal(
    scoreTopic(article("Maqedonia e Veriut rinis bisedimet për anëtarësim në BE"), topic).score,
    0,
    "the group matches, but nothing in the story names the subject of this file"
  );
  assert.ok(
    scoreTopic(article("Kosovën e pret një vit vendimtar për anëtarësim në BE"), topic).score >= MIN_TOPIC_SCORE,
    "the same group on a story that does name it"
  );
});

test("a Gaj diacritic no longer shatters the word that carries it", () => {
  // Not a matching preference — a correctness bug. Everything outside a-z was
  // replaced by a space, so "Pogačar" folded to the two fragments "poga ar"
  // and the name was gone before any topic got to see it.
  assert.equal(fold("Pogačar"), "pogacar");
  assert.equal(fold("Vučić"), "vucic");
  assert.equal(fold("Đoković"), "dokovic");
  assert.equal(fold("Kosovë"), "kosove", "the Albanian letters still fold as they did");
  assert.equal(fold("Vuçiq"), "vuciq");
});

/**
 * The context gate and the category.
 *
 * lib/category-map.ts sets DEFAULT_CATEGORY to "Kosovë", and the retired
 * "Politikë" resolves there too — so an uncategorised international story
 * reaches the matcher already labelled Kosovo. While the context gate read the
 * category, that label was accepted as evidence the story was about Kosovo:
 * Montenegro's EU path took Kosovo's EU file, and Serbia's early elections
 * took Kosovo's institutional deadlock file, each on the strength of having
 * had no category of its own.
 *
 * The category still vetoes, because a veto is not evidence for anything.
 */

test("a default category is not evidence that a story is about Kosovo", () => {
  const topic = {
    slug: "anetaresimi-ne-be",
    matchGroups: [["komisioni", "evropian"]],
    context: ["kosove", "prishtina"],
    signals: [],
    excludes: [],
  };

  const montenegro = article(
    "Komisioni Evropian: çdo ndërhyrje në rrugën e Malit të Zi drejt BE-së është e papranueshme",
    { excerpt: "Komisioni thotë se po mbështet Podgoricën kundër kërcënimeve.", category: "Kosovë" }
  );
  assert.equal(scoreTopic(montenegro, topic).score, 0, "the label is a feed bucket, not a claim about the story");

  const kosovo = article("Komisioni Evropian flet për rrugën e Kosovës drejt BE-së", { category: "Botë" });
  assert.ok(
    scoreTopic(kosovo, topic).score >= MIN_TOPIC_SCORE,
    "a story that names the subject matches whatever it happens to be filed under"
  );
});

test("a category still vetoes, because a veto is not evidence for anything", () => {
  const topic = { slug: "kfor", matchGroups: [["kfor"]], context: [], signals: [], excludes: ["sport"] };
  assert.equal(scoreTopic(article("KFOR-i zhvillon aktivitet"), topic).score >= MIN_TOPIC_SCORE, true);
  assert.equal(scoreTopic(article("KFOR-i zhvillon aktivitet", { category: "Sport" }), topic).score, 0);
});
