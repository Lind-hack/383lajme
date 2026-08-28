import test from "node:test";
import assert from "node:assert/strict";

import { scoreTopic, matchTopic, isStandingSubject, MIN_TOPIC_SCORE } from "./dosje-match.mjs";

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
