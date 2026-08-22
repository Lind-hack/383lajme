import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPrompt,
  validateAnswer,
  SYSTEM_PROMPT,
  REFUSAL,
  REFUSAL_THIN,
} from "./pyet-prompt.mjs";

const SOURCES = [
  {
    pinned: true,
    article: { slug: "a", title: "Kurti prezanton buxhetin", body: "Teksti i plotë.", meta: "20 gusht" },
  },
  { pinned: false, article: { slug: "b", title: "Reagimet e opozitës", body: "Teksti tjetër.", meta: "19 gusht" } },
];

test("the system prompt forbids outside knowledge and offers a refusal path", () => {
  assert.ok(/VETËM/.test(SYSTEM_PROMPT));
  assert.ok(/Nuk ke qasje në internet/.test(SYSTEM_PROMPT));
  assert.ok(/"enough": false/.test(SYSTEM_PROMPT));
});

test("sources are numbered from 1", () => {
  const prompt = buildPrompt("Pse?", SOURCES);
  assert.ok(prompt.includes("[1] Kurti prezanton buxhetin"));
  assert.ok(prompt.includes("[2] Reagimet e opozitës"));
  assert.ok(!prompt.includes("[0]"));
});

test("the article being read is marked as such", () => {
  const prompt = buildPrompt("Pse?", SOURCES);
  assert.ok(prompt.includes("← artikulli që po lexon përdoruesi"));
});

// ── The gate ────────────────────────────────────────────────────────────────

test("an answer citing nothing is refused however fluent it reads", () => {
  const out = validateAnswer(
    { enough: true, answer: "Kjo ndodhi sepse qeveria vendosi kështu pas negociatave." },
    2,
  );
  assert.equal(out.grounded, false);
  assert.equal(out.reason, "no-valid-citation");
});

test("an answer citing a source that was never sent is refused", () => {
  const out = validateAnswer({ enough: true, answer: "Një përgjigje e gjatë sa duhet.", sources: [7] }, 2);
  assert.equal(out.grounded, false);
  assert.equal(out.reason, "no-valid-citation");
});

test("the model declining is honoured, not overridden", () => {
  const out = validateAnswer({ enough: false }, 2);
  assert.equal(out.grounded, false);
  assert.equal(out.reason, "model-declined");
});

test("malformed output is refused rather than guessed at", () => {
  assert.equal(validateAnswer(null, 2).grounded, false);
  assert.equal(validateAnswer("po", 2).grounded, false);
  assert.equal(validateAnswer({ enough: true, answer: "shkurt", sources: [1] }, 2).grounded, false);
});

test("a runaway answer is refused even with a valid citation", () => {
  const out = validateAnswer({ enough: true, answer: "x".repeat(2000), sources: [1] }, 2);
  assert.equal(out.grounded, false);
  assert.equal(out.reason, "runaway-answer");
});

test("a properly cited answer passes, with citations deduped and coerced", () => {
  const out = validateAnswer(
    { enough: true, answer: "Buxheti u rrit sepse pagat publike u ngritën.", sources: [1, "1", 2, 9] },
    2,
  );
  assert.equal(out.grounded, true);
  assert.deepEqual(out.sources, [1, 2]);
});

test("the refusal copy points at the latest news rather than dead-ending", () => {
  assert.equal(REFUSAL.headline, "Nuk kam artikull për këtë.");
  assert.ok(REFUSAL.ctaHref.includes("lajmet-e-fundit"));
  // It must not claim the event did not happen — only that the archive lacks it.
  assert.ok(/arkiv/.test(REFUSAL.detail));
});

test("the two refusals say different things", () => {
  // "Nuk kam artikull për këtë" under the article being read would be false.
  assert.notEqual(REFUSAL.headline, REFUSAL_THIN.headline);
  assert.ok(/nuk e thonë/.test(REFUSAL_THIN.headline));
  assert.ok(/hamendësoj/.test(REFUSAL_THIN.detail));
});

test("the prompt tells the model that thin coverage is still an answer", () => {
  // Without this the model declines on any short or unofficial report, which
  // reads to the reader as the archive missing a story it carries in full.
  assert.ok(/thashetheme/.test(SYSTEM_PROMPT));
  assert.ok(/pjesërisht/.test(SYSTEM_PROMPT));
});

test("the prompt makes 'pse' mean cause, not scale", () => {
  // A reader asked why an Ebola outbreak was happening and got a summary of how
  // deadly it was: grounded, cited, and not the question.
  assert.ok(/kërkon shkakun/.test(SYSTEM_PROMPT));
  assert.ok(/nga fundi/.test(SYSTEM_PROMPT));
  assert.ok(/Artikulli nuk e shpjegon pse/.test(SYSTEM_PROMPT));
});

test("earlier turns are carried into the prompt", () => {
  const p = buildPrompt("Po pse?", SOURCES, {
    history: [{ question: "Sa viktima ka?", answer: "2325." }],
  });
  assert.ok(p.includes("BISEDA DERI TANI"));
  assert.ok(p.includes("Sa viktima ka?"));
  assert.ok(p.indexOf("BISEDA") < p.indexOf("PYETJA E LEXUESIT"));
});

test("a lone source may be read far past the old fixed cut", () => {
  const long = { pinned: true, article: { title: "T", body: "x".repeat(6000), meta: "m" } };
  const one = buildPrompt("Pse?", [long]);
  const six = buildPrompt("Pse?", [long, ...SOURCES, ...SOURCES, ...SOURCES]);
  assert.ok(one.length > 5000, `one source got only ${one.length}`);
  assert.ok(one.length > six.length, "one source should be read more fully than six");
});

