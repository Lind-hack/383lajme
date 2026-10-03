import assert from "node:assert/strict";
import test from "node:test";

import { crowdLine, deckOrder, projectRank, projectionLabel, rivalLine, splitFor } from "./tregu-pick-play.mjs";

const standings = [
  { rank: 1, profit: 412, is_me: false },
  { rank: 2, profit: 398, is_me: false },
  { rank: 3, profit: 371, is_me: false },
  { rank: 4, profit: 330, is_me: false },
  { rank: 5, profit: 300, is_me: false },
  { rank: 6, profit: 284, is_me: true },
];

test("projectRank: points added, ties do not pass", () => {
  assert.deepEqual(projectRank(standings, 62), { from: 6, to: 4 });
  // 284 + 87 = 371 ties third: stays behind it. One more point passes.
  assert.deepEqual(projectRank(standings, 87), { from: 6, to: 4 });
  assert.deepEqual(projectRank(standings, 88), { from: 6, to: 3 });
  assert.deepEqual(projectRank(standings, 200), { from: 6, to: 1 });
  assert.equal(projectRank([{ rank: 1, profit: 10 }], 5), null, "not a member");
});

test("projectionLabel: a move, holding first, or nothing", () => {
  assert.equal(projectionLabel({ from: 6, to: 3 }), "#6 → #3");
  assert.equal(projectionLabel({ from: 1, to: 1 }), "mban #1");
  assert.equal(projectionLabel({ from: 6, to: 6 }), null);
  assert.equal(projectionLabel(null), null);
});

test("splitFor and crowdLine", () => {
  const rows = [
    { market_id: "m", outcome: "home", picks: 6 },
    { market_id: "m", outcome: "away", picks: 2 },
    { market_id: "x", outcome: "home", picks: 9 },
  ];
  const split = splitFor(rows, "m");
  assert.equal(split.total, 8);
  assert.deepEqual(split.by.home, { picks: 6, pct: 75 });
  assert.equal(crowdLine(split, "home", "Barcelonën"), "75% e ligës mendon si ti.");
  assert.equal(crowdLine(split, "away", "Realin"), "Vetëm 1 tjetër zgjodhi Realin. Nëse del, ia kalon shumicës.");
  assert.equal(crowdLine(splitFor([{ market_id: "m", outcome: "away", picks: 1 }, { market_id: "m", outcome: "home", picks: 4 }], "m"), "away", "Realin"),
    "Vetëm ti zgjodhe Realin. Nëse del, dallohesh nga gjithë liga.");
  assert.equal(crowdLine(splitFor([], "m"), "home", "X"), null);
});

test("rivalLine: same or split, ahead or behind", () => {
  const label = (key) => ({ home: "Barcelonën", away: "Realin" })[key] ?? key;
  assert.deepEqual(rivalLine({ rival_name: "Dea", rival_rank: 5, i_lead: false, market_id: "m", outcome: "away" }, "home", label), {
    tone: "split", text: "Dea (#5, para teje) zgjodhi Realin. Ti Barcelonën: kjo ndeshje vendos.",
  });
  assert.equal(rivalLine({ rival_name: "Dea", rival_rank: 2, i_lead: true, market_id: "m", outcome: "home" }, "home", label).tone, "same");
  assert.equal(rivalLine(null, "home", label), null);
});

test("deckOrder: open, unpicked, soonest first", () => {
  const now = Date.parse("2026-10-03T12:00:00Z");
  const rows = [
    { id: "late", result: "open", my_outcome: null, lock_at: "2026-10-03T20:00:00Z" },
    { id: "picked", result: "open", my_outcome: "PO", lock_at: "2026-10-03T13:00:00Z" },
    { id: "soon", result: "open", my_outcome: null, lock_at: "2026-10-03T13:30:00Z" },
    { id: "gone", result: "locked", my_outcome: null, lock_at: "2026-10-03T11:00:00Z" },
  ];
  assert.deepEqual(deckOrder(rows, now).map((row) => row.id), ["soon", "late"]);
});
