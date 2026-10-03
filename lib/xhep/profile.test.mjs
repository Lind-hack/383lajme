import assert from "node:assert/strict";
import test from "node:test";
import { PROFILE_KEY, clearProfile, newSeed, normalizeProfile, readProfile, suggestCities, writeProfile } from "./profile.mjs";

function memoryStore() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}

test("profiles round-trip through storage", () => {
  const store = memoryStore();
  assert.equal(readProfile(store), null);
  assert.equal(writeProfile({ name: "Lena", interests: ["food"], cities: ["prizren"], seed: "abc123def", completed: true }, store), true);
  const p = readProfile(store);
  assert.equal(p.name, "Lena");
  assert.deepEqual(p.cities, ["prizren"]);
  assert.equal(p.completed, true);
  assert.ok(p.updatedAt);
});

test("corrupt or stale stored data never crashes", () => {
  const store = memoryStore();
  store.setItem(PROFILE_KEY, "{not json");
  assert.equal(readProfile(store), null);
  store.setItem(PROFILE_KEY, JSON.stringify({ stamps: "x", seed: "<script>", startDate: "2026-13-45", completed: "yes" }));
  const p = readProfile(store);
  assert.deepEqual(p.stamps, []);
  assert.equal(p.seed, null);
  assert.equal(p.startDate, null);
  assert.equal(p.completed, false);
});

test("a storage that throws degrades to an in-memory profile", () => {
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("denied"); } };
  assert.equal(writeProfile({ name: "Maya" }, broken), false);
  assert.equal(readProfile(broken).name, "Maya");
  clearProfile(broken);
  assert.equal(readProfile(broken), null);
});

test("a start date sets the month", () => {
  assert.equal(normalizeProfile({ startDate: "2026-12-20", month: 3 }).month, 12);
});

test("seeds are short lowercase base36 and deterministic for a given random source", () => {
  let i = 0;
  const seq = () => (i++ % 10) / 10;
  assert.match(newSeed(seq), /^[a-z0-9]{12}$/);
});

test("city suggestions follow interests", () => {
  assert.equal(suggestCities(["nature"])[0], "peje");
  assert.equal(suggestCities(["nightlife"])[0], "prishtine");
  assert.equal(suggestCities([]).length, 7);
});
