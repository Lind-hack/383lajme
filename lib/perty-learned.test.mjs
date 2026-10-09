import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HOME_MIN,
  OFFER_PAUSE_MS,
  REVEAL_READS,
  hasLearnedPaper,
  learnedPicks,
  pickChips,
  shouldOffer,
  totalReads,
  withoutChips,
} from "./perty-learned.mjs";
import { emptyLedger, recordRead } from "./reader-ledger.mjs";

const NOW = Date.parse("2026-10-09T09:00:00Z");
const fresh = (w) => ({ w, t: new Date(NOW).toISOString() });

test("picks come from what was read about at least once, strongest first", () => {
  const picks = learnedPicks(
    {
      "cat:Kosovë": fresh(1.5),
      "cat:Sport": fresh(3),
      "cat:Showbiz": fresh(0.5), // a click, never read
      "person:memli-krasniqi": fresh(1.5),
      "city:prizren": fresh(3),
      "city:peje": fresh(1),
    },
    NOW
  );
  assert.deepEqual(picks.categories, ["Sport", "Kosovë"]);
  assert.deepEqual(picks.people, ["memli-krasniqi"]);
  assert.deepEqual(picks.cities, ["prizren", "peje"]);
  assert.equal(picks.home, "prizren");
});

test("a town read about once is followed, not called home", () => {
  const picks = learnedPicks({ "cat:Kosovë": fresh(1.5), "city:ferizaj": fresh(HOME_MIN - 0.5) }, NOW);
  assert.deepEqual(picks.cities, ["ferizaj"]);
  assert.equal(picks.home, null);
});

test("old reads fade below a pick, and junk keys are ignored", () => {
  const month = 30 * 24 * 3600_000;
  const picks = learnedPicks(
    {
      "cat:Sport": { w: 1.5, t: new Date(NOW - month).toISOString() },
      "cat:Nope": fresh(5),
      "person:not-a-person": fresh(5),
      "city:atlantis": fresh(5),
      junk: fresh(5),
    },
    NOW
  );
  assert.deepEqual(picks, { categories: [], people: [], cities: [], home: null });
  assert.equal(hasLearnedPaper(picks), false);
  assert.deepEqual(learnedPicks(null, NOW), picks);
  assert.deepEqual(learnedPicks("garbage", NOW), picks);
});

test("diaspora is never guessed as a home town", () => {
  const picks = learnedPicks({ "cat:Kosovë": fresh(2), "city:diaspora": fresh(4) }, NOW);
  assert.deepEqual(picks.cities, ["diaspora"]);
  assert.equal(picks.home, null);
});

test("the offer waits for enough reads, a topic, no paper yet, and a week since the last", () => {
  const picks = { categories: ["Sport"], people: [], cities: [], home: null };
  const base = { reads: REVEAL_READS, picks, chosen: false, lastOffer: null, now: NOW };
  assert.equal(shouldOffer(base), true);
  assert.equal(shouldOffer({ ...base, reads: REVEAL_READS - 1 }), false);
  assert.equal(shouldOffer({ ...base, chosen: true }), false);
  assert.equal(shouldOffer({ ...base, picks: { ...picks, categories: [] } }), false);
  assert.equal(shouldOffer({ ...base, lastOffer: NOW - 1000 }), false);
  assert.equal(shouldOffer({ ...base, lastOffer: NOW - OFFER_PAUSE_MS }), true);
});

test("reads are counted across months", () => {
  let l = emptyLedger();
  l = recordRead(l, "a", ["cat:Sport"], Date.parse("2026-09-30T10:00:00Z"));
  l = recordRead(l, "b", ["cat:Sport"], Date.parse("2026-10-01T10:00:00Z"));
  l = recordRead(l, "b", ["cat:Sport"], Date.parse("2026-10-01T11:00:00Z")); // same story again
  assert.equal(totalReads(l), 2);
  assert.equal(totalReads(null), 0);
});

test("chips name the picks, and switching one off drops it (and home with its town)", () => {
  const picks = { categories: ["Sport"], people: ["memli-krasniqi"], cities: ["prizren"], home: "prizren" };
  assert.deepEqual(pickChips(picks), [
    { key: "cat:Sport", label: "Sport" },
    { key: "person:memli-krasniqi", label: "Memli Krasniqi" },
    { key: "city:prizren", label: "Prizren" },
  ]);
  assert.deepEqual(withoutChips(picks, ["city:prizren"]), {
    categories: ["Sport"],
    people: ["memli-krasniqi"],
    cities: [],
    home: null,
  });
  assert.deepEqual(withoutChips(picks, []), picks);
});
