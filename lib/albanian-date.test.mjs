import test from "node:test";
import assert from "node:assert/strict";

import { albanianDate, entryDate } from "./albanian-date.mjs";

test("an ISO timestamp becomes a date a reader would write", () => {
  assert.equal(albanianDate("2026-08-25T20:09:00+00:00"), "25 gusht 2026");
  assert.equal(albanianDate("2023-09-24T00:00:00Z"), "24 shtator 2023");
  assert.equal(albanianDate("2013-04-19"), "19 prill 2013");
});

test("no ISO string ever survives into the rendered date", () => {
  // The defect this replaced: "2026-08-25T20:09:00+00:00 - zgjero +".
  for (const iso of ["2026-01-01T00:00:00Z", "2026-12-31T23:59:59+02:00"]) {
    const out = albanianDate(iso);
    assert.ok(out && !out.includes("T"), `${out} still looks like a timestamp`);
    assert.ok(!out.includes(":"), `${out} still carries a clock`);
  }
});

test("every month is named, so no date renders as undefined", () => {
  const names = [];
  for (let m = 0; m < 12; m += 1) {
    const out = albanianDate(new Date(Date.UTC(2026, m, 15)).toISOString());
    assert.ok(out && !out.includes("undefined"), `month ${m} produced ${out}`);
    names.push(out.split(" ")[1]);
  }
  assert.equal(new Set(names).size, 12, "month names must all differ");
});

test("unusable input degrades to nothing rather than throwing", () => {
  assert.equal(albanianDate(null), null);
  assert.equal(albanianDate(undefined), null);
  assert.equal(albanianDate(""), null);
  assert.equal(albanianDate("jo-nje-date"), null);
});

test("an article uses its published date, a milestone keeps its written label", () => {
  assert.equal(entryDate({ publishedAt: "2026-08-25T20:09:00+00:00", date: "x" }), "25 gusht 2026");
  assert.equal(entryDate({ date: "Qershor 1999" }), "Qershor 1999");
  assert.equal(entryDate({ publishedAt: "broken", date: "Mars 2011" }), "Mars 2011");
  assert.equal(entryDate({}), null);
  assert.equal(entryDate(null), null);
});

test("the date is Kosovo's, whatever clock the server or reader runs on", () => {
  // 23:30 UTC on 31 Oct is already 1 Nov in Prishtina. A server on UTC used to
  // print 31 tetor, a reader's browser 1 nëntor: two dates for one article.
  assert.equal(albanianDate("2026-10-31T23:30:00Z"), "1 nëntor 2026");
  // A plain calendar date is that day everywhere, never shifted back a day.
  assert.equal(albanianDate("2004-03-17"), "17 mars 2004");
});
