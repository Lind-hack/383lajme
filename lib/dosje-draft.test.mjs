import test from "node:test";
import assert from "node:assert/strict";

import { validateMilestoneDraft, figuresIn, isTertiary, dateInText, displayDateSq } from "./dosje-draft.mjs";

/**
 * The refusal contract.
 *
 * Every test here is a way a wrong historical claim could otherwise reach a
 * reader. A reader cannot check a date or a death toll; they will simply
 * believe it. So each of these must refuse, and refuse for a named reason.
 *
 * The rule since 2026-11: every claim stands on verbatim quotes from at least
 * two different publishers, and every figure and the date are inside those
 * quotes — not somewhere else on the page, not in another claim's source.
 */

const reuters = {
  url: "https://www.reuters.com/world/kosovo-riots-2004",
  publisher: "Reuters",
  title: "Kosovo riots leave 19 dead",
  published_date: "2004-03-19",
  text:
    "Two days of ethnic violence in Kosovo that began on 17 March 2004 left 19 people dead, " +
    "including 11 Albanians and 8 Serbs, with more than 900 injured.",
};

const hrw = {
  url: "https://www.hrw.org/report/2004/07/25/failure-protect",
  publisher: "Human Rights Watch",
  title: "Failure to Protect: Anti-Minority Violence in Kosovo, March 2004",
  published_date: "2004-07-25",
  text:
    "The violence that started on March 17, 2004 killed 19 people and left more than 900 injured. " +
    "It displaced roughly 4,100. Some 550 homes and 27 Orthodox churches and monasteries were destroyed.",
};

const wiki = {
  url: "https://en.wikipedia.org/wiki/2004_unrest_in_Kosovo",
  publisher: "Wikipedia",
  title: "2004 unrest in Kosovo",
  published_date: "2024-01-01",
  text: "The 2004 unrest in Kosovo began on 17 March 2004 and left 19 dead.",
};

const Q = {
  r1: { source: 0, text: "Two days of ethnic violence in Kosovo that began on 17 March 2004" },
  h1: { source: 1, text: "The violence that started on March 17, 2004 killed 19 people" },
  r2: { source: 0, text: "left 19 people dead, including 11 Albanians and 8 Serbs, with more than 900 injured" },
  h2: { source: 1, text: "killed 19 people and left more than 900 injured" },
};

const good = {
  title: "Trazirat e marsit",
  summary:
    "Dy dite dhune ndëretnike shperthejne me 17 mars 2004. Vriten 19 veta dhe mbi 900 mbeten te plagosur.",
  why: "Ngjarja mbetet pika me e rende e sigurise ne Kosove.",
  event_date: "2004-03-17",
  date_precision: "day",
  claims: [
    { sentence: "Dy dite dhune ndëretnike shperthejne me 17 mars 2004.", quotes: [Q.r1, Q.h1] },
    { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", quotes: [Q.r2, Q.h2] },
  ],
};

const NOW = new Date("2026-08-28T00:00:00Z");
const check = (raw, sources = [reuters, hrw]) => validateMilestoneDraft(raw, { sources, now: NOW });
const reasons = (raw, sources) => check(raw, sources).reasons ?? [];

test("a moment with every claim quoted by two publishers passes", () => {
  const r = check(good);
  assert.equal(r.ok, true, "reasons: " + JSON.stringify(r.reasons));
  assert.equal(r.citations.length, 2);
  assert.equal(r.milestone.dedupe_key, "trazirat-e-marsit");
  // Every citation carries a quote that is really on its page.
  for (const c of r.citations) assert.ok(c.quote, `${c.publisher} should carry its quote`);
  // Each claim keeps its quotes with url and publisher, so the database can
  // count two publishers per claim on its own (migration 0119).
  for (const c of r.milestone.claims.sentences) {
    assert.deepEqual(new Set(c.quotes.map((q) => q.publisher)), new Set(["Reuters", "Human Rights Watch"]));
    assert.ok(c.quotes.every((q) => q.url.startsWith("https://")));
  }
});

test("the display date is written from event_date, never taken from the model", () => {
  const r = check({ ...good, display_date: "18 mars 2005" });
  assert.equal(r.ok, true, JSON.stringify(r.reasons));
  assert.equal(r.milestone.display_date, "17 mars 2004");
});

test("the wrong death toll is refused — the error that shipped", () => {
  const wrong = {
    ...good,
    summary: "Dy dite dhune ndëretnike shperthejne me 17 mars 2004. Vriten 20 veta dhe mbi 900 mbeten te plagosur.",
    claims: [good.claims[0], { sentence: "Vriten 20 veta dhe mbi 900 mbeten te plagosur.", quotes: [Q.r2, Q.h2] }],
  };
  const r = check(wrong);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("figure_not_in_quotes"), r.reasons.join(","));
  assert.ok(r.unsupportedFigures.includes("20"), "the offending figure should be named");
});

test("a figure that is on the page but not in that claim's quotes is refused", () => {
  // 4,100 is in HRW's text, but the claim's quotes do not say it. Pooling all
  // the text of all sources is how a number gets borrowed from the wrong place.
  const borrowed = {
    ...good,
    summary: "Dy dite dhune ndëretnike shperthejne me 17 mars 2004. Vriten 19 veta dhe 4100 zhvendosen.",
    claims: [good.claims[0], { sentence: "Vriten 19 veta dhe 4100 zhvendosen.", quotes: [Q.r2, Q.h2] }],
  };
  assert.ok(reasons(borrowed).includes("figure_not_in_quotes"));
});

test("a claim quoted by only one publisher is refused, even if the moment has two", () => {
  const oneSided = {
    ...good,
    claims: [good.claims[0], { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", quotes: [Q.r2] }],
  };
  assert.ok(reasons(oneSided).includes("claim_needs_two_publishers"));
});

test("a claim with no quotes at all is refused", () => {
  const bare = {
    ...good,
    claims: [good.claims[0], { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", source_indexes: [0, 1] }],
  };
  assert.ok(reasons(bare).includes("claim_needs_two_publishers"));
});

test("an invented quote does not count", () => {
  const invented = {
    ...good,
    claims: [
      good.claims[0],
      {
        sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.",
        quotes: [Q.r2, { source: 1, text: "Human Rights Watch counted 19 dead and over 900 wounded in two days" }],
      },
    ],
  };
  const r = check(invented);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("quote_not_in_source"), r.reasons.join(","));
});

test("a real sentence attributed to the wrong source does not count", () => {
  const misattributed = {
    ...good,
    claims: [good.claims[0], { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", quotes: [Q.r2, { ...Q.r2, source: 1 }] }],
  };
  assert.ok(reasons(misattributed).includes("quote_not_in_source"));
});

test("a quote from an archive copy does not count as a live publisher", () => {
  const archived = { ...hrw, live: false };
  assert.ok(reasons(good, [reuters, archived]).includes("claim_needs_two_publishers"));
});

test("a fabricated source index is refused", () => {
  const r = check({ ...good, claims: [{ sentence: "x", quotes: [{ source: 7, text: "anything at all here ok" }] }] });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("citation_index_invalid"));
});

test("an encyclopaedia cannot be the evidence", () => {
  assert.equal(isTertiary("https://en.wikipedia.org/wiki/X"), true);
  const onlyWiki = {
    ...good,
    claims: good.claims.map((c) => ({ ...c, quotes: [{ source: 0, text: "The 2004 unrest in Kosovo began on 17 March 2004" }] })),
  };
  const r = check(onlyWiki, [wiki]);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("tertiary_sources_only"));
});

test("an uncited sentence in a sourced paragraph is refused", () => {
  const r = check({
    ...good,
    summary: good.summary + " Qeveria e kohes dha doreheqje te menjehershme.",
  });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("uncited_sentence"));
});

test("an invented or future date is refused", () => {
  assert.ok(reasons({ ...good, event_date: "2004-13-45" }).includes("event_date_invalid"));
  assert.ok(reasons({ ...good, event_date: "2004-02-30" }).includes("event_date_invalid"));
  assert.ok(reasons({ ...good, event_date: "2030-01-01" }).includes("event_date_in_future"));
});

test("the right year with the wrong day is refused", () => {
  // The old rule compared only the year: 2004-03-21 passed because the source
  // said 2004. The quotes say 17 March.
  const r = check({ ...good, event_date: "2004-03-21" });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("event_date_not_in_quotes"), r.reasons.join(","));
});

test("the right day in the wrong month is refused", () => {
  assert.ok(reasons({ ...good, event_date: "2004-04-17" }).includes("event_date_not_in_quotes"));
});

test("a month-precision moment needs the month and year in a quote, not a day", () => {
  const monthOnly = {
    ...good,
    summary: "Dhuna ndëretnike shperthen ne mars 2004. Vriten 19 veta dhe mbi 900 mbeten te plagosur.",
    event_date: "2004-03-01",
    date_precision: "month",
    claims: [
      {
        sentence: "Dhuna ndëretnike shperthen ne mars 2004.",
        quotes: [
          { source: 0, text: "Two days of ethnic violence in Kosovo that began on 17 March 2004" },
          { source: 1, text: "The violence that started on March 17, 2004" },
        ],
      },
      good.claims[1],
    ],
  };
  const r = check(monthOnly);
  assert.equal(r.ok, true, JSON.stringify(r.reasons));
  assert.equal(r.milestone.display_date, "mars 2004");
});

test("a why with a fact of its own is dropped, not published", () => {
  const r = check({ ...good, why: "Pas kesaj UNMIK-u shkarkon 300 policë." });
  assert.equal(r.ok, true, JSON.stringify(r.reasons));
  assert.equal(r.milestone.why, null);
});

test("a title with a figure nobody quoted is refused", () => {
  assert.ok(reasons({ ...good, title: "Trazirat e marsit: 25 të vrarë" }).includes("figure_not_in_quotes"));
});

test("a draft with no claims at all is refused", () => {
  const r = check({ ...good, claims: [] });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("no_citations"));
});

test("figures are read as a reader would read them", () => {
  const f = figuresIn("Vriten 19 veta, mbi 900 te plagosur, njezet mije te zhvendosur");
  assert.ok(f.has("19"));
  assert.ok(f.has("900"));
  assert.ok(f.has("20"), "njezet should read as 20");
  assert.ok(f.has("1000"), "mije should read as 1000");
  assert.ok(figuresIn("Two days left 19 dead").has("2"), "and English the same way");
  assert.ok(figuresIn("displaced roughly 4,100 people").has("4100"), "separators are noise");
});

test("dates are found the way publishers write them", () => {
  assert.ok(dateInText("began on 17 March 2004", "2004-03-17", "day"));
  assert.ok(dateInText("on March 17, 2004 the", "2004-03-17", "day"));
  assert.ok(dateInText("më 17 mars 2004", "2004-03-17", "day"));
  assert.ok(dateInText("on 17.03.2004", "2004-03-17", "day"));
  assert.ok(dateInText("dated 2004-03-17", "2004-03-17", "day"));
  assert.ok(dateInText("on 17th of March, 2004", "2004-03-17", "day"));
  assert.ok(!dateInText("on 7 March 2004", "2004-03-17", "day"), "7 is not 17");
  assert.ok(!dateInText("on 17 March 2005", "2004-03-17", "day"));
  assert.ok(!dateInText("in 2004", "2004-03-17", "day"));
  assert.ok(dateInText("in March 2004", "2004-03-17", "month"));
  assert.ok(dateInText("in 2004", "2004-03-17", "year"));
  assert.ok(!dateInText("in 12004", "2004-03-17", "year"));
});

test("display dates are Albanian and as precise as the evidence", () => {
  assert.equal(displayDateSq("2021-09-15", "day"), "15 shtator 2021");
  assert.equal(displayDateSq("2008-11-01", "month"), "nëntor 2008");
  assert.equal(displayDateSq("1999-06-12", "year"), "1999");
});

test("refusal reasons are stable strings the queue can key on", () => {
  const r = check({ title: "", summary: "", claims: [] }, []);
  assert.equal(r.ok, false);
  for (const reason of r.reasons) assert.match(reason, /^[a-z_]+$/, "reason should be a stable slug: " + reason);
});

test("trivial drift between claim and summary is tolerated", () => {
  const drifted = {
    ...good,
    claims: [
      { ...good.claims[0], sentence: "Dy dite dhune ndëretnike shperthejne me 17 mars 2004" },
      { ...good.claims[1], sentence: "Vriten 19 veta dhe mbi 900 mbeten të plagosur." },
    ],
  };
  const r = check(drifted);
  assert.equal(r.ok, true, "reasons: " + JSON.stringify(r.reasons));
});

test("a near-miss paraphrase does not count as a citation", () => {
  const paraphrased = {
    ...good,
    summary: "Dy dite dhune ndëretnike shperthejne me 17 mars 2004. Policia nderkombetare humbi kontrollin ne shume komuna.",
  };
  assert.ok(reasons(paraphrased).includes("uncited_sentence"));
});

import { revalidateStored } from "./dosje-draft.mjs";

test("an edited moment is re-checked against its stored quotes, not waved through", () => {
  const published = check(good);
  assert.equal(published.ok, true);
  const row = { ...published.milestone };
  // A harmless edit: same facts, same figures.
  assert.equal(revalidateStored({ ...row, why: "Ngjarja mbetet pika me e rende e sigurise." }, NOW).ok, true);
  // An edit that changes a figure is refused, though nobody re-fetched a page.
  const changed = { ...row, summary: row.summary.replace("19", "21") };
  const r = revalidateStored(changed, NOW);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("figure_not_in_quotes"), r.reasons.join(","));
  // An edit that moves the date is refused.
  assert.ok(revalidateStored({ ...row, event_date: "2004-03-18" }, NOW).reasons.includes("event_date_not_in_quotes"));
});

test("the year has to belong to the day, not sit elsewhere in the quote", () => {
  assert.ok(!dateInText("on 17 March 2005; the 2004 deal", "2004-03-17", "day"));
  assert.ok(!dateInText("signed in March 2005, after the 2004 talks", "2004-03-01", "month"));
  assert.ok(dateInText("17 March, 2004", "2004-03-17", "day"));
});

test("a summary figure must come from the quotes of the claim that says it", () => {
  // 11 is in the second claim's quotes (r2) but the first sentence says it.
  const swapped = {
    ...good,
    summary: "Dy dite dhune ndëretnike shperthejne me 17 mars 2004, 11 vriten. Vriten 19 veta dhe mbi 900 mbeten te plagosur.",
    claims: [
      // The claim omits the number; only the summary sentence carries it.
      { sentence: "Dy dite dhune ndëretnike shperthejne me 17 mars 2004", quotes: [Q.r1, Q.h1] },
      { sentence: "Vriten 19 veta dhe mbi 900 mbeten te plagosur.", quotes: [{ ...Q.r2 }, Q.h2] },
    ],
  };
  assert.ok(reasons(swapped).includes("figure_not_in_quotes"));
});
