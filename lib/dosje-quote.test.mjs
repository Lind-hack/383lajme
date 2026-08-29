import test from "node:test";
import assert from "node:assert/strict";

import { validateMilestoneDraft } from "./dosje-draft.mjs";

/**
 * Quotes.
 *
 * A link alone makes approval an act of trust: the reviewer either opens every
 * source and hunts for the sentence, or waves it through. The quote is what
 * turns the link into evidence sitting next to the claim.
 *
 * But a quote is also a new way to lie — a convincing sentence attributed to
 * Reuters that Reuters never wrote is worse than no quote at all, because it
 * looks like the very thing that makes the claim checkable. So every quote is
 * matched against the text that was actually fetched. Absent is fine. Invented
 * is dropped.
 */

const reuters = {
  url: "https://www.reuters.com/world/kosovo-riots-2004",
  publisher: "Reuters",
  title: "Kosovo riots leave 19 dead",
  published_date: "2004-03-19",
  text:
    "Two days of ethnic violence in Kosovo in March 2004 left 19 people dead, " +
    "including 11 Albanians and 8 Serbs, with more than 900 injured.",
};

const hrw = {
  url: "https://www.hrw.org/report/2004/07/25/failure-protect",
  publisher: "Human Rights Watch",
  title: "Failure to Protect",
  published_date: "2004-07-25",
  text:
    "The March 2004 violence killed 19 people and displaced roughly 4,100. " +
    "Some 550 homes and 27 Orthodox churches and monasteries were destroyed.",
};

const base = {
  title: "Trazirat e marsit",
  summary:
    "Dy dite dhune ndëretnike shperthejne ne mars 2004. Vriten 19 veta dhe mbi 900 mbeten te plagosur.",
  event_date: "2004-03-17",
  date_precision: "day",
  display_date: "17-18 mars 2004",
};

const NOW = new Date("2026-08-29T00:00:00Z");
const run = (claims) =>
  validateMilestoneDraft({ ...base, claims }, { sources: [reuters, hrw], now: NOW });

test("a quote found in the source is kept and attached to it", () => {
  const r = run([
    {
      sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.",
      source_indexes: [0],
      quote: "Two days of ethnic violence in Kosovo in March 2004 left 19 people dead",
    },
    {
      sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.",
      source_indexes: [1],
      quote: "The March 2004 violence killed 19 people and displaced roughly 4,100.",
    },
  ]);
  assert.equal(r.ok, true, "reasons: " + JSON.stringify(r.reasons));
  const withQuotes = r.citations.filter((c) => c.quote);
  assert.equal(withQuotes.length, 2, "both citations should carry their quote");
  assert.ok(
    r.citations.find((c) => c.publisher === "Reuters").quote.includes("Two days of ethnic violence")
  );
});

test("an invented quote is dropped, not stored", () => {
  // The dangerous case: the claim is true and sourced, but the sentence in
  // quotation marks was composed by the model. Reuters never wrote it.
  const r = run([
    {
      sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.",
      source_indexes: [0],
      quote: "Reuters described the March events as the gravest failure of the mission to date.",
    },
    {
      sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.",
      source_indexes: [1],
      quote: "The March 2004 violence killed 19 people and displaced roughly 4,100.",
    },
  ]);
  assert.equal(r.ok, true, "the milestone itself is still properly sourced");
  const reutersCite = r.citations.find((c) => c.publisher === "Reuters");
  assert.equal(reutersCite.quote, null, "a quote absent from the fetched text must not be stored");
  const hrwCite = r.citations.find((c) => c.publisher === "Human Rights Watch");
  assert.ok(hrwCite.quote, "the genuine quote is unaffected");
});

test("a quote attributed to the wrong source is refused for that source", () => {
  // Real sentence, wrong publisher. It appears in HRW's text, not Reuters'.
  const r = run([
    {
      sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.",
      source_indexes: [0],
      quote: "Some 550 homes and 27 Orthodox churches and monasteries were destroyed.",
    },
    {
      sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.",
      source_indexes: [1],
      quote: "The March 2004 violence killed 19 people",
    },
  ]);
  assert.equal(r.citations.find((c) => c.publisher === "Reuters").quote, null);
});

test("no quote at all is acceptable", () => {
  // Absence is honest. The citation still stands on the link.
  const r = run([
    { sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.", source_indexes: [0] },
    { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", source_indexes: [1] },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.citations.every((c) => c.quote === null), true);
});

test("a scrap too short to prove anything is not treated as a quote", () => {
  const r = run([
    { sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.", source_indexes: [0], quote: "March 2004" },
    { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", source_indexes: [1] },
  ]);
  assert.equal(r.citations.find((c) => c.publisher === "Reuters").quote, null);
});
