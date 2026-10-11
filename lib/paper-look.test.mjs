import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOOK_IDS,
  MIN_STAND_MS,
  editionName,
  normalizeLookState,
  readingMix,
  readingPace,
  resolveLook,
} from "./paper-look.mjs";

const NOW = Date.parse("2026-10-11T08:00:00Z");
const iso = (t) => new Date(t).toISOString();

test("a new reader's paper comes straight from their picks", () => {
  const sport = readingMix({ v: 1, categories: ["Sport"], people: [], cities: [] }, NOW);
  assert.equal(resolveLook(sport, null, { now: NOW }).look, "sporti");
  const show = readingMix({ v: 1, categories: ["Showbiz"], people: [], cities: [] }, NOW);
  assert.equal(resolveLook(show, null, { now: NOW }).look, "tabloid");
  const money = readingMix({ v: 1, categories: ["Ekonomi", "Teknologji"], people: [], cities: [] }, NOW);
  assert.equal(resolveLook(money, null, { now: NOW }).look, "biznes");
});

test("people count for their own section, towns for Kosovë", () => {
  const mix = readingMix({ v: 1, categories: [], people: ["albin-kurti"], cities: ["prizren"] }, NOW);
  assert.equal(resolveLook(mix, null, { now: NOW }).look, "e-perditshme");
});

test("the mix sums to one, and to nothing for a blank reader", () => {
  const mix = readingMix({ v: 1, categories: ["Sport", "Botë"], people: [], cities: [] }, NOW);
  assert.ok(Math.abs(Object.values(mix).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(Object.values(readingMix(null, NOW)).every((v) => v === 0));
  assert.equal(resolveLook(readingMix(null, NOW), null, { now: NOW }).look, "e-perditshme");
});

test("reading minutes move the mix, not just picks", () => {
  const affinity = { "cat:Sport": { w: 5, t: iso(NOW), s: 3000, n: 10 } };
  const mix = readingMix({ v: 1, categories: ["Kosovë"], people: [], cities: [], affinity }, NOW);
  assert.ok(mix.sporti > mix["e-perditshme"]);
});

test("it does not flicker: a new leader must lead by the margin, after a week", () => {
  const state = { look: "e-perditshme", since: iso(NOW - 2 * 24 * 3600_000) };
  const mix = { "e-perditshme": 0.3, sporti: 0.6, tabloid: 0.1, bota: 0, biznes: 0 };
  assert.equal(resolveLook(mix, state, { now: NOW }).look, "e-perditshme", "too soon");

  const old = { look: "e-perditshme", since: iso(NOW - MIN_STAND_MS - 1) };
  const close = { "e-perditshme": 0.4, sporti: 0.5, tabloid: 0.1, bota: 0, biznes: 0 };
  assert.equal(resolveLook(close, old, { now: NOW }).look, "e-perditshme", "not by enough");

  const r = resolveLook(mix, old, { now: NOW });
  assert.equal(r.look, "sporti");
  assert.deepEqual(r.changed, { from: "e-perditshme", to: "sporti", share: 60 });
  assert.equal(r.state?.since, iso(NOW));
});

test("a look the reader chose is kept", () => {
  const mix = { "e-perditshme": 0, sporti: 1, tabloid: 0, bota: 0, biznes: 0 };
  assert.equal(resolveLook(mix, null, { now: NOW, locked: "bota" }).look, "bota");
  assert.equal(resolveLook(mix, null, { now: NOW, locked: "nope" }).look, "sporti");
});

test("stored state is untrusted", () => {
  for (const junk of [null, 1, "x", {}, { look: "gazeta" }, { look: ["sporti"] }]) assert.equal(normalizeLookState(junk), null);
  assert.equal(normalizeLookState({ look: "sporti", since: "garbage" })?.look, "sporti");
  for (const id of LOOK_IDS) assert.equal(normalizeLookState({ look: id, since: iso(NOW) })?.look, id);
});

test("edition name follows the hours the reader reads at", () => {
  const hours = (from, to, n) => Array.from({ length: 24 }, (_, h) => (h >= from && h < to ? n : 0));
  assert.equal(editionName({ months: { "2026-10": { readHours: hours(19, 23, 3) } } }), "Botimi i mbrëmjes");
  assert.equal(editionName({ months: { "2026-10": { readHours: hours(6, 10, 3) } } }), "Botimi i mëngjesit");
  assert.equal(editionName({ months: { "2026-10": { readHours: hours(20, 21, 2) } } }), "Botimi i mëngjesit", "too little to tell");
  assert.equal(editionName(null), "Botimi i mëngjesit");
});

test("pace: long readers get long excerpts, skimmers headlines", () => {
  const with_ = (s, n) => ({ v: 1, categories: ["Sport"], affinity: { "cat:Sport": { w: 3, t: iso(NOW), s, n } } });
  assert.equal(readingPace(with_(10 * 120, 10), NOW), "long");
  assert.equal(readingPace(with_(10 * 20, 10), NOW), "short");
  assert.equal(readingPace(with_(10 * 50, 10), NOW), "medium");
  assert.equal(readingPace(with_(100, 1), NOW), "medium", "too few reads");
});
