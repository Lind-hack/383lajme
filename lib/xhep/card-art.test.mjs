import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { CARD_STRUCTURES, cardArt, normalizeCardProfile } from "./card-art.mjs";
import { FIXTURE_PROFILES } from "./fixtures/profiles.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");

test("the same inputs give byte-identical SVG", () => {
  for (const structure of CARD_STRUCTURES) {
    for (const profile of FIXTURE_PROFILES) {
      assert.equal(cardArt(profile, { structure, seed: "s1" }), cardArt({ ...profile }, { structure, seed: "s1" }));
    }
  }
});

test("every fixture gets a different card in every structure", () => {
  for (const structure of CARD_STRUCTURES) {
    const hashes = new Set(FIXTURE_PROFILES.map((profile) => hash(cardArt(profile, { structure }))));
    assert.equal(hashes.size, FIXTURE_PROFILES.length, structure);
  }
});

test("seed and stamps change the card; structures differ from each other", () => {
  const profile = FIXTURE_PROFILES[0];
  const base = cardArt(profile, { structure: "qilim", seed: "a" });
  assert.notEqual(base, cardArt(profile, { structure: "qilim", seed: "b" }));
  assert.notEqual(base, cardArt(profile, { structure: "qilim", seed: "a", stamps: ["prizren-fortress"] }));
  assert.equal(new Set(CARD_STRUCTURES.map((structure) => cardArt(profile, { structure }))).size, CARD_STRUCTURES.length);
});

test("cards carry the headline, the 383 mark and a QR zone", () => {
  for (const structure of CARD_STRUCTURES) {
    const svg = cardArt(FIXTURE_PROFILES[0], { structure });
    assert.match(svg, /^<svg [^>]*viewBox="0 0 600 900"/);
    assert.match(svg, /Lena’s Kosovo/);
    assert.match(svg, /383/);
    assert.match(svg, /data-zone="qr-placeholder"/);
  }
});

test("Albanian text renders when asked", () => {
  const svg = cardArt(FIXTURE_PROFILES[0], { structure: "ticket", lang: "sq" });
  assert.match(svg, /Kosova · Lena/);
  assert.match(svg, /maj/);
});

test("hostile or stale profile data never breaks the SVG", () => {
  for (const raw of [null, undefined, "x", 42, [], { name: "<script>alert(1)</script>&", interests: "food", cities: [1, "atlantis"], days: "abc", month: 13 }]) {
    for (const structure of CARD_STRUCTURES) {
      const svg = cardArt(raw, { structure });
      assert.doesNotMatch(svg, /<script/);
      assert.match(svg, /<\/svg>$/);
    }
  }
  const normalized = normalizeCardProfile({ days: 400, interests: ["food", "food", "zzz"], cities: ["prizren", "prizren"] });
  assert.equal(normalized.days, 30);
  assert.deepEqual(normalized.interests, ["food"]);
  assert.deepEqual(normalized.cities, ["prizren"]);
});

test("two cards on one page never share an SVG id", () => {
  for (const structure of CARD_STRUCTURES) {
    const ids = FIXTURE_PROFILES.flatMap((profile) => [...cardArt(profile, { structure }).matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    assert.equal(new Set(ids).size, ids.length, structure);
  }
});

test("names ending in s take a bare apostrophe", () => {
  assert.match(cardArt({ name: "The Kowalskis" }, { structure: "ticket" }), /The Kowalskis’ Kosovo/);
  assert.match(cardArt({ name: "Lena" }, { structure: "ticket" }), /Lena’s Kosovo/);
});
