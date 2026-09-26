import { test } from "node:test";
import assert from "node:assert/strict";
import { kosovoDateKey, pickDailyMarkets } from "./home-tregu.mjs";

const NOW = Date.parse("2026-09-25T13:00:00Z");
const row = (slug, category, { status = "open", hours = 48 } = {}) => ({
  slug,
  category,
  status,
  closes_at: new Date(NOW + hours * 3_600_000).toISOString(),
});
const pool = [
  row("a", "sport"), row("b", "sport"), row("c", "sport"), row("d", "sport"),
  row("e", "politike"), row("f", "politike"), row("g", "ekonomi"), row("h", "bote"),
  row("closed", "bote", { status: "resolved" }), row("closing", "bote", { hours: 0.1 }),
];

test("the same day gives the same markets, another day a different set", () => {
  const today = pickDailyMarkets(pool, { dateKey: "2026-09-25", now: NOW }).map((r) => r.slug);
  assert.deepEqual(pickDailyMarkets(pool, { dateKey: "2026-09-25", now: NOW }).map((r) => r.slug), today);
  const days = new Set(
    ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"].map((d) =>
      pickDailyMarkets(pool, { dateKey: d, now: NOW }).map((r) => r.slug).join()
    )
  );
  assert.ok(days.size > 1, "the selection never changed across four days");
});

test("only open books with time left, at most two per category", () => {
  const picked = pickDailyMarkets(pool, { dateKey: "2026-09-25", now: NOW, count: 4 });
  assert.equal(picked.length, 4);
  assert.ok(picked.every((r) => r.slug !== "closed" && r.slug !== "closing"));
  assert.ok(picked.filter((r) => r.category === "sport").length <= 2);
});

test("a one-category day still fills the band", () => {
  const sportOnly = pool.slice(0, 4);
  assert.equal(pickDailyMarkets(sportOnly, { dateKey: "2026-09-25", now: NOW, count: 4 }).length, 4);
});

test("the day turns over at midnight in Kosovo, not UTC", () => {
  assert.equal(kosovoDateKey(new Date("2026-09-25T22:30:00Z")), "2026-09-26");
  assert.equal(kosovoDateKey(new Date("2026-09-25T21:30:00Z")), "2026-09-25");
});

test("competitions with their own card design lead, two different ones when possible", () => {
  const league = (slug, lg, extra = {}) => ({ ...row(slug, "sport"), live_event: { league: lg }, ...extra });
  const special = [
    league("n1", "uefa.nations"), league("n2", "uefa.nations"), league("n3", "uefa.nations"),
    league("k1", "fbk.kosovo"),
    { ...row("f1race", "sport"), market_type: "f1_race_winner" },
  ];
  const plain = [row("p1", "politike"), row("p2", "ekonomi"), league("l1", "esp.1")];
  for (const day of ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"]) {
    const picked = pickDailyMarkets([...plain, ...special], { dateKey: day, now: NOW });
    assert.equal(picked.length, 2);
    assert.ok(picked.every((r) => special.includes(r)), `${day}: a plain market beat a special one`);
    const leagues = picked.map((r) => r.market_type === "f1_race_winner" ? "f1" : r.live_event.league);
    assert.notEqual(leagues[0], leagues[1], `${day}: both cards were the same competition`);
  }
});

test("with no special competition open, plain markets still fill the band", () => {
  assert.equal(pickDailyMarkets(pool, { dateKey: "2026-09-25", now: NOW }).length, 2);
});
