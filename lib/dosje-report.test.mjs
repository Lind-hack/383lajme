import test from "node:test";
import assert from "node:assert/strict";
import { buildDosjeReport } from "./dosje-report.mjs";

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
