import { test } from "node:test";
import assert from "node:assert/strict";
import { MUST_KNOW_MS, mustKnow } from "./per-ty-must-know.mjs";

const NOW = Date.parse("2026-10-24T07:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3600_000).toISOString();
const story = (slug, score, h, extra = {}) => ({
  slug,
  title: `Titull i lajmit ${slug} për qeverinë`,
  category: "Kosovë",
  publishedAt: hoursAgo(h),
  engagementScore: score,
  ...extra,
});

test("the biggest fresh hard-news story leads", () => {
  const pool = [story("a", 8.0, 2), story("b", 9.0, 1, { title: "Qeveria bie pas votimit në Kuvend" })];
  assert.deepEqual(mustKnow(pool, { now: NOW }).map((a) => a.slug)[0], "b");
});

test("a second only when nearly as big, so a quiet day gets one", () => {
  const close = [story("a", 9.0, 1, { title: "Qeveria bie pas votimit" }), story("b", 8.8, 1, { title: "Çmimi i rrymës rritet nga janari" })];
  assert.equal(mustKnow(close, { now: NOW }).length, 2);
  const far = [story("a", 9.0, 1, { title: "Qeveria bie pas votimit" }), story("b", 7.6, 1, { title: "Çmimi i rrymës rritet nga janari" })];
  assert.equal(mustKnow(far, { now: NOW }).length, 1);
});

test("no sport, no showbiz, nothing older than a day, nothing small", () => {
  const pool = [
    story("sport", 9.5, 1, { category: "Sport" }),
    story("show", 9.5, 1, { category: "Showbiz" }),
    story("old", 9.5, MUST_KNOW_MS / 3600_000 + 1),
    story("small", 6.5, 1),
  ];
  assert.deepEqual(mustKnow(pool, { now: NOW }), []);
});

test("two tellings of one story count once", () => {
  const pool = [
    story("a", 9.0, 1, { title: "Kosovë: Kuvendi rrëzon qeverinë Kurti" }),
    story("b", 8.9, 1, { title: "Kuvendi rrëzon qeverinë e Kurtit me votë" }),
  ];
  assert.equal(mustKnow(pool, { now: NOW }).length, 1);
});

test("a story already read is skipped", () => {
  const pool = [story("a", 9.0, 1, { title: "Qeveria bie pas votimit" })];
  assert.deepEqual(mustKnow(pool, { now: NOW, read: new Set(["a"]) }), []);
});

test("last night's big story beats this morning's small one", () => {
  const pool = [
    story("night", 7.9, 14, { title: "Kuvendi kthen ligjin për Gjykatën Speciale" }),
    story("morning", 7.6, 1, { title: "Gjobë për drejtorinë e inspeksionit" }),
  ];
  assert.equal(mustKnow(pool, { now: NOW })[0].slug, "night");
});

test("a story the newsroom wrote several pieces on counts as bigger", () => {
  const pool = [
    story("one", 7.6, 2, { title: "Gjobë për drejtorinë e inspeksionit" }),
    story("fsk", 7.2, 2, { title: "Betimi i 515 ushtarëve të rinj të FSK-së" }),
    story("fsk2", 7.1, 3, { title: "Kurti në betimin e 515 ushtarëve të FSK-së" }),
    story("fsk3", 6.5, 4, { title: "Maqedonci: betimi i 515 ushtarëve të FSK-së sot" }),
  ];
  assert.equal(mustKnow(pool, { now: NOW })[0].slug, "fsk");
});
