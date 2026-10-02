import { test } from "node:test";
import assert from "node:assert/strict";
import { absence, followUp } from "./perty-dardani-line.mjs";
import { emptyLedger, recordVisit } from "./reader-ledger.mjs";

const visit = (l, date) => recordVisit(l, Date.parse(`${date}T09:00:00Z`));

test("absence counts the whole days skipped since the last visit", () => {
  let l = visit(emptyLedger(), "2026-09-28");
  l = visit(l, "2026-10-02"); // today is already in the ledger
  assert.deepEqual(absence(l, "2026-10-02"), { missed: 3, last: "2026-09-28" });
});

test("no line for a first visit, a daily reader, or a single skipped day", () => {
  assert.equal(absence(emptyLedger(), "2026-10-02"), null);
  assert.equal(absence(visit(emptyLedger(), "2026-10-02"), "2026-10-02"), null);
  assert.equal(absence(visit(emptyLedger(), "2026-10-01"), "2026-10-02"), null);
  assert.equal(absence(visit(emptyLedger(), "2026-09-30"), "2026-10-02"), null); // missed 1
});

test("absence works across a month boundary", () => {
  const l = visit(emptyLedger(), "2026-09-29");
  assert.deepEqual(absence(l, "2026-10-03"), { missed: 3, last: "2026-09-29" });
});

const art = (slug, title, publishedAt, extra = {}) => ({ slug, title, excerpt: "", category: "Kosovë", publishedAt, ...extra });
const read1 = art("kurti-1", "Kurti takon von der Leyen", "2026-10-01T10:00:00Z");
const next1 = art("kurti-2", "Kurti: BE-ja hap kandidaturën", "2026-10-02T08:00:00Z");
const sport = art("sport-1", "Kombëtarja fiton", "2026-10-02T09:00:00Z", { category: "Sport" });

test("a newer story about the same person follows one already read", () => {
  const out = followUp([{ article: sport }, { article: next1 }], [read1, next1, sport], new Set(["kurti-1"]));
  assert.equal(out.before.slug, "kurti-1");
  assert.equal(out.after.slug, "kurti-2");
});

test("no follow-up when nothing was read, the match is older, or it is already read", () => {
  assert.equal(followUp([{ article: next1 }], [read1, next1], new Set()), null);
  const older = art("kurti-0", "Kurti më herët", "2026-09-30T08:00:00Z");
  assert.equal(followUp([{ article: older }], [read1, older], new Set(["kurti-1"])), null);
  assert.equal(followUp([{ article: next1 }], [read1, next1], new Set(["kurti-1", "kurti-2"])), null);
});

test("a shared topic alone is not a follow-up: it needs the same person or town", () => {
  const a = art("a", "Qeveria miraton buxhetin", "2026-10-01T08:00:00Z");
  const b = art("b", "Inflacioni bie në shtator", "2026-10-02T08:00:00Z");
  assert.equal(followUp([{ article: b }], [a, b], new Set(["a"])), null);
});

test("a town counts as well as a person", () => {
  const a = art("p1", "Prishtinë: protestë në shesh", "2026-10-01T08:00:00Z");
  const b = art("p2", "Prishtinë: protesta mbyllet pa incidente", "2026-10-02T08:00:00Z");
  assert.equal(followUp([{ article: b }], [a, b], new Set(["p1"]))?.after.slug, "p2");
});
