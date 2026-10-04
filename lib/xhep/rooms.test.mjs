import test from "node:test";
import assert from "node:assert/strict";
import { ROOM_CODE_RE, cleanText, newRoomCode, normalizeProgress, progressEvents, progressOf, score } from "./rooms.mjs";
import { packPlaces } from "./packs.mjs";

test("room codes are six unambiguous characters", () => {
  for (let i = 0; i < 200; i++) {
    const code = newRoomCode();
    assert.match(code, ROOM_CODE_RE);
    assert.doesNotMatch(code, /[01ilo]/);
  }
});

test("cleanText strips control and direction characters and caps length", () => {
  assert.equal(cleanText("  Ana‮\n  e  Lindi ", 18), "Ana e Lindi");
  assert.equal(cleanText("x".repeat(50), 18).length, 18);
  assert.equal(cleanText(42, 18), "");
});

test("progressOf reads opened packs, stamps and finished paintings", () => {
  const prizren = packPlaces("prizren").map((p) => p.id);
  const profile = { packs: { prizren: "2026-10-01", peje: "2026-10-02" }, handStamps: [...prizren, packPlaces("peje")[0].id] };
  const p = progressOf(profile);
  assert.deepEqual(p.opened.sort(), ["peje", "prizren"]);
  assert.deepEqual(p.painted, ["prizren"]);
  assert.equal(p.cities.prizren, 7);
  assert.equal(p.cities.peje, 1);
  assert.equal(p.stamps, 8);
  assert.equal(score(p), 13);
});

test("normalizeProgress drops unknown cities and unearned paintings", () => {
  const p = normalizeProgress({ opened: ["prizren", "paris", "prizren"], painted: ["prizren", "peje"], cities: { prizren: 7, peje: 3, paris: 9, gjilan: 12 } });
  assert.deepEqual(p.opened, ["prizren"]);
  assert.deepEqual(p.painted, ["prizren"]);
  assert.deepEqual(p.cities, { prizren: 7, peje: 3 });
  assert.equal(p.stamps, 10);
  assert.deepEqual(normalizeProgress(null), { opened: [], painted: [], cities: {}, stamps: 0 });
});

test("progressEvents reports only what is new", () => {
  const before = { opened: ["prizren"], painted: [] };
  const after = { opened: ["prizren", "peje"], painted: ["prizren"] };
  assert.deepEqual(progressEvents(before, after), [
    { kind: "pack", cityId: "peje" },
    { kind: "complete", cityId: "prizren" },
  ]);
  assert.deepEqual(progressEvents(after, after), []);
});
