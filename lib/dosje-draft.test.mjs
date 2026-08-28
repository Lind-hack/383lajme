import test from "node:test";
import assert from "node:assert/strict";

import { validateMilestoneDraft, figuresIn, isTertiary } from "./dosje-draft.mjs";

/**
 * The refusal contract.
 *
 * Every test here is a way a wrong historical claim could otherwise reach a
 * reader. A reader cannot check a date or a death toll; they will simply
 * believe it. So each of these must refuse, and refuse for a named reason.
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
  title: "Failure to Protect: Anti-Minority Violence in Kosovo, March 2004",
  published_date: "2004-07-25",
  text:
    "The March 2004 violence killed 19 people and displaced roughly 4,100. " +
    "Some 550 homes and 27 Orthodox churches and monasteries were destroyed.",
};

const wiki = {
  url: "https://en.wikipedia.org/wiki/2004_unrest_in_Kosovo",
  publisher: "Wikipedia",
  title: "2004 unrest in Kosovo",
  published_date: "2024-01-01",
  text: "The 2004 unrest in Kosovo left 19 dead.",
};

const good = {
  title: "Trazirat e marsit",
  summary:
    "Dy dite dhune ndëretnike shperthejne ne mars 2004. Vriten 19 veta dhe mbi 900 mbeten te plagosur.",
  why: "Ngjarja mbetet pika me e rende e sigurise pas 1999.",
  event_date: "2004-03-17",
  date_precision: "day",
  display_date: "17-18 mars 2004",
  claims: [
    { sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.", source_indexes: [0] },
    { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", source_indexes: [0, 1] },
  ],
};

const NOW = new Date("2026-08-28T00:00:00Z");
const check = (raw, sources) => validateMilestoneDraft(raw, { sources, now: NOW });

test("a properly sourced moment passes", () => {
  const r = check(good, [reuters, hrw]);
  assert.equal(r.ok, true, "reasons: " + JSON.stringify(r.reasons));
  assert.equal(r.citations.length, 2);
  assert.equal(r.milestone.dedupe_key, "trazirat-e-marsit");
});

test("the wrong death toll is refused — the error that shipped", () => {
  // The hand-written entry said twenty. Nineteen were killed. No source says
  // twenty, so the figure rule catches it. This is the whole point of the file.
  const wrong = {
    ...good,
    summary:
      "Dy dite dhune ndëretnike shperthejne ne mars 2004. Vriten 20 veta dhe mbi 900 mbeten te plagosur.",
    claims: [
      { sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.", source_indexes: [0] },
      { sentence: "Vriten 20 veta dhe mbi 900 mbeten te plagosur.", source_indexes: [0, 1] },
    ],
  };
  const r = check(wrong, [reuters, hrw]);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("figure_not_in_sources"), r.reasons.join(","));
  assert.ok(r.unsupportedFigures.includes("20"), "the offending figure should be named");
});

test("a fabricated source index is refused", () => {
  const r = check({ ...good, claims: [{ sentence: "x", source_indexes: [7] }] }, [reuters, hrw]);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("citation_index_invalid"));
});

test("one publisher is not enough, even cited twice", () => {
  const r = check(
    {
      ...good,
      claims: [
        { sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.", source_indexes: [0] },
        { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", source_indexes: [0] },
      ],
    },
    [reuters, hrw]
  );
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("insufficient_publishers"));
});

test("an encyclopaedia cannot be the evidence", () => {
  assert.equal(isTertiary("https://en.wikipedia.org/wiki/X"), true);
  const r = check(
    {
      ...good,
      claims: [
        { sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.", source_indexes: [0] },
        { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", source_indexes: [0] },
      ],
    },
    [wiki]
  );
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("tertiary_sources_only"));
});

test("an uncited sentence in a sourced paragraph is refused", () => {
  // The dangerous case: most of the paragraph is backed, and one clause is not.
  const r = check(
    {
      ...good,
      summary:
        "Dy dite dhune ndëretnike shperthejne ne mars 2004. Vriten 19 veta dhe mbi 900 mbeten te plagosur. " +
        "Qeveria e kohes dha doreheqje te menjehershme.",
    },
    [reuters, hrw]
  );
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("uncited_sentence"));
});

test("an invented or future date is refused", () => {
  assert.ok(check({ ...good, event_date: "2004-13-45" }, [reuters, hrw]).reasons.includes("event_date_invalid"));
  assert.ok(check({ ...good, event_date: "2004-02-30" }, [reuters, hrw]).reasons.includes("event_date_invalid"));
  assert.ok(check({ ...good, event_date: "2030-01-01" }, [reuters, hrw]).reasons.includes("event_date_in_future"));
});

test("a real event moved to the wrong year is refused", () => {
  // Nothing in either source mentions 1998; the date does not belong to them.
  const r = check({ ...good, event_date: "1998-03-17" }, [reuters, hrw]);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("event_date_unsupported"));
});

test("a draft with no citations at all is refused", () => {
  const r = check({ ...good, claims: [] }, [reuters, hrw]);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("no_citations"));
});

test("figures are read as a reader would read them", () => {
  const f = figuresIn("Vriten 19 veta, mbi 900 te plagosur, njezet mije te zhvendosur");
  assert.ok(f.has("19"));
  assert.ok(f.has("900"));
  // Number words reduce to the digits they mean, so an Albanian claim can be
  // checked against an English source without either being weakened.
  assert.ok(f.has("20"), "njezet should read as 20");
  assert.ok(f.has("1000"), "mije should read as 1000");
  assert.ok(figuresIn("Two days left 19 dead").has("2"), "and English the same way");
  assert.ok(figuresIn("displaced roughly 4,100 people").has("4100"), "separators are noise");
});

test("refusal reasons are stable strings the queue can key on", () => {
  const r = check({ title: "", summary: "", claims: [] }, []);
  assert.equal(r.ok, false);
  for (const reason of r.reasons) {
    assert.match(reason, /^[a-z_]+$/, "reason should be a stable slug: " + reason);
  }
});

test("trivial drift between claim and summary is tolerated", () => {
  // A model reproducing its own prose drifts by a comma or a dash. That says
  // nothing about whether the claim is sourced, and refusing it refused every
  // real draft the pipeline produced.
  const drifted = {
    ...good,
    claims: [
      { sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004", source_indexes: [0] },
      { sentence: "Vriten 19 veta dhe mbi 900 mbeten të plagosur.", source_indexes: [0, 1] },
    ],
  };
  const r = check(drifted, [reuters, hrw]);
  assert.equal(r.ok, true, "reasons: " + JSON.stringify(r.reasons));
});

test("a sentence the model never pointed at is still refused", () => {
  // The rule that matters. This sentence shares almost no words with any claim.
  const smuggled = {
    ...good,
    summary:
      "Dy dite dhune ndëretnike shperthejne ne mars 2004. Vriten 19 veta dhe mbi 900 mbeten te plagosur. " +
      "Ambasadori amerikan kerkoi doreheqjen e ministrit te brendshem.",
  };
  const r = check(smuggled, [reuters, hrw]);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("uncited_sentence"), r.reasons.join(","));
});

test("a near-miss paraphrase does not count as a citation", () => {
  // Sharing a few words is not the same as having been cited. Below the
  // overlap threshold this must still refuse.
  const paraphrased = {
    ...good,
    summary: "Dy dite dhune ndëretnike shperthejne ne mars 2004. Policia nderkombetare humbi kontrollin ne shume komuna.",
    claims: [
      { sentence: "Dy dite dhune ndëretnike shperthejne ne mars 2004.", source_indexes: [0] },
      { sentence: "Vriten 19 veta.", source_indexes: [1] },
    ],
  };
  const r = check(paraphrased, [reuters, hrw]);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("uncited_sentence"), r.reasons.join(","));
});
