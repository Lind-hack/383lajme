import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMonth,
  monthLabel,
  monthRange,
  isMonthOver,
  lastMonth,
  kosovoDate,
  buildMonthWrapped,
  cardsFor,
} from "./monthly-wrapped.mjs";

let n = 0;
const art = (category, publishedAt, title = `Lajm ${++n}`, extra = {}) => ({
  slug: `s${++n}`,
  title,
  excerpt: "",
  category,
  publishedAt,
  ...extra,
});

test("months parse, name themselves, and bound a Kosovo month", () => {
  assert.deepEqual(parseMonth("2026-10"), { year: 2026, month: 10 });
  for (const bad of ["2026-13", "2026-1", "26-10", "", null, "2026-10-01"]) assert.equal(parseMonth(bad), null, String(bad));
  assert.deepEqual(monthLabel("2026-10"), { definite: "Tetori", name: "tetor", year: 2026 });
  assert.deepEqual(monthLabel("2026-11"), { definite: "Nëntori", name: "nëntor", year: 2026 });
  const r = monthRange("2026-12");
  assert.equal(r.from, "2026-11-30T00:00:00.000Z");
  assert.equal(r.to, "2027-01-02T00:00:00.000Z");
});

test("a month is over at midnight in Kosovo, and last month rolls over the year", () => {
  assert.equal(isMonthOver("2026-10", new Date("2026-10-31T21:00:00Z")), false); // 22:00 on the 31st
  assert.equal(isMonthOver("2026-10", new Date("2026-10-31T23:30:00Z")), true); // 00:30 on 1 Nov
  assert.equal(isMonthOver("2026-12", new Date("2027-01-01T00:00:00Z")), true);
  assert.equal(lastMonth(new Date("2026-11-01T08:00:00Z")), "2026-10");
  assert.equal(lastMonth(new Date("2027-01-05T08:00:00Z")), "2026-12");
});

test("a story counts in its Kosovo month, not its UTC one", () => {
  // 23:30 UTC on 31 October is 00:30 on 1 November in Kosovo.
  assert.equal(kosovoDate("2026-10-31T23:30:00Z"), "2026-11-01");
  const w = buildMonthWrapped([art("Kosovë", "2026-10-31T23:30:00Z"), art("Kosovë", "2026-10-31T20:00:00Z")], "2026-10");
  assert.equal(w.total, 1);
});

test("the month is told through Kosovo, Albania and the world, each with its biggest story", () => {
  const articles = [
    art("Kosovë", "2026-10-02T08:00:00Z", "Kosova A", { engagementScore: 3 }),
    art("Kosovë", "2026-10-03T08:00:00Z", "Kosova B", { engagementScore: 9, imageUrl: "https://x/k.jpg" }),
    art("Shqipëri", "2026-10-04T08:00:00Z", "Shqipëria A"),
    art("Botë", "2026-10-05T08:00:00Z", "Bota A", { engagementScore: 1 }),
    art("Botë", "2026-10-06T08:00:00Z", "Bota B", { engagementScore: 1 }),
    art("Sport", "2026-10-06T09:00:00Z", "Sporti"),
  ];
  const w = buildMonthWrapped(articles, "2026-10");
  assert.equal(w.title, "Tetori në 383");
  assert.equal(w.total, 6);
  const [ks, al, wo] = w.regions;
  assert.deepEqual([ks.label, ks.count, ks.top.title, ks.top.imageUrl], ["Kosova", 2, "Kosova B", "https://x/k.jpg"]);
  assert.deepEqual([al.label, al.count, al.top.title], ["Shqipëria", 1, "Shqipëria A"]);
  // A tie in readership goes to the newer story.
  assert.deepEqual([wo.label, wo.count, wo.top.title], ["Bota", 2, "Bota B"]);
});

test("the name of the month is the person most in the news, by the vetted forms", () => {
  const articles = [
    art("Kosovë", "2026-10-02T08:00:00Z", "Kurti takon von der Leyen"),
    art("Kosovë", "2026-10-03T08:00:00Z", "Albin Kurti: zgjedhjet më 6 tetor"),
    art("Kosovë", "2026-10-04T08:00:00Z", "Kurtin e pret Brukseli"),
    art("Shqipëri", "2026-10-04T09:00:00Z", "Rama në Tiranë"),
  ];
  const w = buildMonthWrapped(articles, "2026-10");
  assert.equal(w.person.id, "albin-kurti");
  assert.equal(w.person.name, "Albin Kurti");
  assert.equal(w.person.count, 3);
});

test("the busiest day names its weekday and its date", () => {
  const articles = [
    art("Kosovë", "2026-10-14T08:00:00Z"),
    art("Botë", "2026-10-14T12:00:00Z"),
    art("Botë", "2026-10-15T12:00:00Z"),
  ];
  const w = buildMonthWrapped(articles, "2026-10");
  assert.deepEqual([w.busiest.date, w.busiest.count, w.busiest.label], ["2026-10-14", 2, "e mërkurë, 14 tetor"]);
  assert.equal(w.days, 2);
});

test("a duplicate slug counts once", () => {
  const a = art("Kosovë", "2026-10-02T08:00:00Z");
  assert.equal(buildMonthWrapped([a, { ...a }], "2026-10").total, 1);
});

test("a quiet month skips the cards it has nothing for", () => {
  const w = buildMonthWrapped([art("Botë", "2026-10-02T08:00:00Z")], "2026-10");
  assert.deepEqual(cardsFor(w), ["hyrje", "bote", "dita"]);
  assert.deepEqual(cardsFor(buildMonthWrapped([], "2026-10")), []);
  assert.equal(buildMonthWrapped([], "not-a-month"), null);
});
