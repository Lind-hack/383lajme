import test from "node:test";
import assert from "node:assert/strict";
import { buildDosjeReport, buildChangeEmail, shouldSendReport } from "./dosje-report.mjs";

const receipt = {
  topic: { slug: "kosova-ne-sepa", title: "Kosova në SEPA", was: "draft", now: "approved" },
  model: "gpt-6-luna",
  published: [
    {
      title: "Kosova aplikon për SEPA",
      display_date: "12 maj 2025",
      event_date: "2025-05-12",
      summary: "Banka Qendrore dorëzon aplikimin.",
      why: "Hapi i parë drejt pagesave më të lira.",
      citations: [
        { url: "https://www.reuters.com/a", publisher: "reuters.com", live: true },
        { url: "https://www.dw.com/b", publisher: "dw.com", live: false },
      ],
    },
  ],
  refused: [{ title: "Moment pa burim", reasons: ["insufficient_publishers"] }],
  primer: { text: "Kosova po hyn në sistemin evropian të pagesave." },
  videos: [{ id: "abcdefghijk", status: "added", channel: "DW News", title: "SEPA explained" }],
  photos: [],
  showingOn: [{ slug: "sepa-mars", title: "Kosova hyn në SEPA nga marsi" }],
};

test("names every published moment with its sources, the articles showing it, and what failed", () => {
  const { subject, html, text } = buildDosjeReport({
    date: "2026-10-21T03:00:00Z",
    mode: "daily",
    calls: { luna: 4, gemini: 0 },
    topics: { accepted: [{ slug: "kosova-ne-sepa", title: "Kosova në SEPA", ownMatches: 3, falseRate: 0.02 }], rejected: [] },
    subjects: [{ slug: "kosova-ne-sepa", title: "Kosova në SEPA", receipt }],
    mapping: { ok: true, matched: 12 },
  });
  assert.equal(subject, "383 Dosje · 21 Tetor — 1 moment i ri në 1 dosje");
  for (const needle of ["Kosova aplikon për SEPA", "reuters.com", "vetëm arkiv", "Kosova hyn në SEPA nga marsi", "SEPA explained", "DW News", "insufficient_publishers", "gpt-6-luna", "dosje e re, tani publike", "pa licencë"]) {
    assert.ok(text.includes(needle), `text missing ${needle}`);
    assert.ok(html.includes(needle.replace(/&/g, "&amp;")), `html missing ${needle}`);
  }
});

test("a quiet day says so in the subject", () => {
  const { subject } = buildDosjeReport({ date: "2026-10-21T03:00:00Z", subjects: [{ slug: "x", title: "X", skipped: "no_sources" }] });
  assert.equal(subject, "383 Dosje · 21 Tetor — asgjë e re sot");
});

test("escapes untrusted text", () => {
  const { html } = buildDosjeReport({
    date: "2026-10-21T03:00:00Z",
    subjects: [{ slug: "x", title: "<script>alert(1)</script>", receipt: { ...receipt, published: [{ ...receipt.published[0], title: "<b>x</b>" }] } }],
  });
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"));
});

// ── changes (dosje_changes, migration 0119) ─────────────────────────────────

const changes = [
  { kind: "topic_new", topic_slug: "dhomat-e-specializuara", topic_title: "Dhomat e Specializuara", after: { title: "Dhomat e Specializuara", status: "draft" } },
  {
    kind: "moment_new", topic_slug: "dhomat-e-specializuara", topic_title: "Dhomat e Specializuara",
    after: { title: "Kuvendi miraton ndryshimin kushtetues", display_date: "3 gusht 2015", summary: "Kuvendi voton me 82 vota." },
  },
  {
    kind: "moment_text", topic_slug: "dhomat-e-specializuara", topic_title: "Dhomat e Specializuara", actor: "admin",
    before: { title: "Gjyqi i parë", display_date: "15 shtator 2021", summary: "Fillon gjyqi.", why: null },
    after: { title: "Gjyqi i parë", display_date: "15 shtator 2021", summary: "Fillon gjyqi i parë kundër Salih Mustafës.", why: null },
  },
  { kind: "moment_hidden", topic_slug: "dhomat-e-specializuara", topic_title: "Dhomat e Specializuara", before: { title: "Moment i vjetër", display_date: "2020" } },
  { kind: "video", topic_slug: "dhomat-e-specializuara", topic_title: "Dhomat e Specializuara", after: { url: "https://www.youtube.com/watch?v=abcdefghijk", credit: "DW News", approved: false } },
  { kind: "image", topic_slug: "dhomat-e-specializuara", topic_title: "Dhomat e Specializuara", before: { url: "https://x/img.jpg", approved: false }, after: { url: "https://x/img.jpg", credit: "BIRN", approved: true } },
  { kind: "article_link", topic_slug: "dhomat-e-specializuara", topic_title: "Dhomat e Specializuara", after: { article_slug: "thaci-aktgjykimi" }, article_title: "Aktgjykimi për Thaçin" },
  { kind: "article_unlink", topic_slug: "dhomat-e-specializuara", topic_title: "Dhomat e Specializuara", before: { article_slug: "zgjedhjet" }, article_title: "Zgjedhjet lokale" },
  { kind: "topic_status", topic_slug: "ligji-per-dhomat-e-specializuara-kosove", topic_title: "Dekretimi i Ligjit", before: { status: "approved" }, after: { status: "retired" } },
];

test("the run email lists every change with before and after, and the articles", () => {
  const { text, html } = buildDosjeReport({ date: "2026-11-03T04:00:00Z", subjects: [], mapping: { ok: true, matched: 3 }, changes });
  for (const needle of [
    "Dosje e re", "Dhomat e Specializuara",
    "Moment i ri", "3 gusht 2015", "Kuvendi miraton ndryshimin kushtetues",
    "Para:", "Fillon gjyqi.", "Tani:", "Fillon gjyqi i parë kundër Salih Mustafës.", "admin",
    "U hoq", "Moment i vjetër",
    "Video", "në pritje të miratimit", "abcdefghijk",
    "Foto", "u miratua",
    "Shfaqet tani te", "Aktgjykimi për Thaçin", "/article/thaci-aktgjykimi",
    "Nuk shfaqet më te", "Zgjedhjet lokale",
    "u tërhoq nga faqja", "Dekretimi i Ligjit",
  ]) {
    assert.ok(text.includes(needle), `text missing ${needle}`);
    assert.ok(html.includes(needle.replace(/&/g, "&amp;")), `html missing ${needle}`);
  }
});

test("the subject counts changes when there are any", () => {
  const { subject } = buildDosjeReport({ date: "2026-11-03T04:00:00Z", subjects: [], mapping: { ok: true }, changes });
  assert.match(subject, /9 ndryshime/);
});

test("a healthy run with nothing changed sends nothing; anything else sends", () => {
  const quiet = { date: "2026-11-03T04:00:00Z", subjects: [], mapping: { ok: true, matched: 0 }, changes: [] };
  assert.equal(shouldSendReport(quiet), false);
  assert.equal(shouldSendReport({ ...quiet, changes: [changes[0]] }), true);
  assert.equal(shouldSendReport({ ...quiet, errors: ["topics: boom"] }), true, "a failure always sends");
  assert.equal(shouldSendReport({ ...quiet, mapping: { ok: false, error: "fetch failed" } }), true, "a broken mapping always sends");
  assert.equal(shouldSendReport({ ...quiet, subjects: [{ slug: "x", title: "X", error: "luna failed" }] }), true);
  assert.equal(shouldSendReport({ ...quiet, subjects: [{ slug: "x", title: "X", receipt: { refused: [{ title: "m", reasons: ["judge_refused"] }] } }] }), true, "refusals are worth reading");
});

test("an admin edit gets its own short email", () => {
  const { subject, text } = buildChangeEmail([changes[2]]);
  assert.match(subject, /^383 Dosje · ndryshim nga admin/);
  assert.ok(text.includes("Para:") && text.includes("Tani:"));
  assert.ok(text.includes("https://www.383ks.com/dosje/dhomat-e-specializuara"));
});

test("a run with Luna switched off does not claim Luna hit its limit", () => {
  const { text } = buildDosjeReport({ date: "2026-11-02T22:00:00Z", subjects: [], lunaLimited: true, lunaOff: true });
  assert.ok(!text.includes("arriti limitin"));
  assert.ok(text.includes("Luna e fikur"));
});
