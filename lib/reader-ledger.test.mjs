import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyLedger,
  normalizeLedger,
  kosovoParts,
  recordVisit,
  recordRead,
  recordQuestion,
  daysWithUs,
  longestStreak,
  summarize,
  MAX_MONTHS,
  MAX_KEYS,
} from "./reader-ledger.mjs";

// 2 October 2026, 07:30 in Kosovo (UTC+2 in summer time).
const T = Date.parse("2026-10-02T05:30:00Z");
const DAY = 86400_000;
const KEYS = ["cat:Kosovë", "person:albin-kurti", "city:prishtine"];

test("days and hours are Kosovo's, not the reader's clock", () => {
  assert.deepEqual(kosovoParts(T), { month: "2026-10", day: 2, hour: 7, date: "2026-10-02" });
  // 23:30 UTC on 31 October is already 1 November in Kosovo (UTC+1 by then).
  assert.deepEqual(kosovoParts(Date.parse("2026-10-31T23:30:00Z")), { month: "2026-11", day: 1, hour: 0, date: "2026-11-01" });
});

test("a visit marks the day once and remembers the first one", () => {
  let l = recordVisit(emptyLedger(), T);
  l = recordVisit(l, T + 3600_000);
  assert.equal(l.firstSeen, "2026-10-02");
  assert.deepEqual(l.months["2026-10"].visitDays, [2]);
  l = recordVisit(l, T + DAY);
  assert.deepEqual(l.months["2026-10"].visitDays, [2, 3]);
  assert.equal(l.firstSeen, "2026-10-02");
});

test("a read counts once per story a month, with its hour and what it is about", () => {
  let l = recordRead(emptyLedger(), "kurti-takim", KEYS, T);
  l = recordRead(l, "kurti-takim", KEYS, T + 600_000); // the same story again
  l = recordRead(l, "sport-1", ["cat:Sport"], T + 13 * 3600_000); // 20:30
  const m = l.months["2026-10"];
  assert.equal(m.reads, 2);
  assert.equal(m.readHours[7], 1);
  assert.equal(m.readHours[20], 1);
  assert.deepEqual(m.people, { "albin-kurti": 1 });
  assert.deepEqual(m.cities, { prishtine: 1 });
  assert.deepEqual(m.categories, { "Kosovë": 1, Sport: 1 });
  // Reading is visiting.
  assert.deepEqual(m.visitDays, [2]);
});

test("the same story read in a new month counts in that month", () => {
  let l = recordRead(emptyLedger(), "kurti-takim", KEYS, T);
  l = recordRead(l, "kurti-takim", KEYS, T + 31 * DAY);
  assert.equal(l.months["2026-10"].reads, 1);
  assert.equal(l.months["2026-11"].reads, 1);
});

test("questions to Dardani are counted, not kept", () => {
  let l = recordQuestion(emptyLedger(), T);
  l = recordQuestion(l, T + 60_000);
  assert.equal(l.months["2026-10"].questions, 2);
  assert.equal(JSON.stringify(l).includes("?"), false);
});

test("anything read back is untrusted: junk becomes an empty ledger, never a crash", () => {
  for (const raw of [null, undefined, 5, "x", [], { v: 99 }, { v: 1, months: "no" }]) {
    assert.deepEqual(normalizeLedger(raw), emptyLedger());
  }
  const dirty = normalizeLedger({
    v: 1,
    firstSeen: "not a date",
    months: {
      "2026-10": {
        visitDays: [2, 2, 40, "3", -1, 5],
        reads: -4,
        readHours: [1, "x", 3],
        people: { "albin-kurti": 2, "": 5, bad: -1, nan: "7" },
        questions: 1.7,
        readIds: ["abc", 5, "abc"],
      },
      "junk-key": { reads: 9 },
    },
  });
  assert.equal(dirty.firstSeen, null);
  assert.deepEqual(Object.keys(dirty.months), ["2026-10"]);
  const m = dirty.months["2026-10"];
  assert.deepEqual(m.visitDays, [2, 5]);
  assert.equal(m.reads, 1); // the count follows the distinct stories actually kept
  assert.equal(m.readHours.length, 24);
  assert.equal(m.readHours[0], 1);
  assert.equal(m.readHours[1], 0);
  assert.deepEqual(m.people, { "albin-kurti": 2 });
  assert.equal(m.questions, 1);
});

test("it stays small: old months and long tails are dropped", () => {
  let l = emptyLedger();
  for (let i = 0; i < MAX_MONTHS + 6; i++) l = recordVisit(l, Date.parse("2024-01-15T10:00:00Z") + i * 31 * DAY);
  l = normalizeLedger(l);
  assert.equal(Object.keys(l.months).length, MAX_MONTHS);
  // The newest months are the ones kept.
  const kept = Object.keys(l.months).sort();
  assert.equal(kept.at(-1), kosovoParts(Date.parse("2024-01-15T10:00:00Z") + (MAX_MONTHS + 5) * 31 * DAY).month);

  let wide = emptyLedger();
  for (let i = 0; i < MAX_KEYS + 20; i++) wide = recordRead(wide, `s${i}`, [`person:p${i}`], T);
  wide = recordRead(wide, "again", ["person:p3"], T); // p3 now has 2 reads
  wide = normalizeLedger(wide);
  const people = wide.months["2026-10"].people;
  assert.equal(Object.keys(people).length, MAX_KEYS);
  assert.equal(people.p3, 2); // the most-read survive the cap
});

test("days with 383 and the longest streak run across months", () => {
  let l = emptyLedger();
  // 29, 30 Sep, 1, 2, 3 Oct (5 in a row), then 6 and 7 Oct.
  for (const d of ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-06", "2026-10-07"]) {
    l = recordVisit(l, Date.parse(`${d}T09:00:00Z`));
  }
  assert.equal(daysWithUs(l), 7);
  assert.equal(longestStreak(l), 5);
  assert.equal(longestStreak(emptyLedger()), 0);
});

test("a summary is what a wrapped card needs, over any span of months", () => {
  let l = emptyLedger();
  l = recordRead(l, "a", KEYS, T); // 07:30
  l = recordRead(l, "b", ["cat:Kosovë", "person:albin-kurti"], T + 3600_000); // 08:30
  l = recordRead(l, "c", ["cat:Sport", "person:vedat-muriqi"], T + 12 * 3600_000); // 19:30
  l = recordQuestion(l, T);
  l = recordRead(l, "d", ["cat:Botë"], Date.parse("2026-11-05T09:00:00Z"));

  const oct = summarize(l, { from: "2026-10", to: "2026-10" });
  assert.equal(oct.reads, 3);
  assert.equal(oct.questions, 1);
  assert.equal(oct.days, 1);
  assert.deepEqual(oct.topPeople[0], ["albin-kurti", 2]);
  assert.deepEqual(oct.topCities[0], ["prishtine", 1]);
  assert.deepEqual(oct.topCategories[0], ["Kosovë", 2]);
  assert.equal(oct.beforeNine, 2 / 3);

  const year = summarize(l, { from: "2026-01", to: "2026-12" });
  assert.equal(year.reads, 4);
  assert.equal(year.days, 2);

  const nothing = summarize(emptyLedger(), { from: "2026-01", to: "2026-12" });
  assert.equal(nothing.reads, 0);
  assert.equal(nothing.beforeNine, null); // no reads, no share to claim
});
