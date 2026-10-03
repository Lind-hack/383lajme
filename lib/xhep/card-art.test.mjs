import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { cardArt, normalizeCardProfile } from "./card-art.mjs";
import { FIXTURE_PROFILES } from "./fixtures/profiles.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");

test("the same inputs give byte-identical SVG", () => {
  for (const profile of FIXTURE_PROFILES) {
    assert.equal(cardArt(profile, { seed: "s1" }), cardArt({ ...profile }, { seed: "s1" }));
  }
});

test("every fixture gets a different card", () => {
  const hashes = new Set(FIXTURE_PROFILES.map((profile) => hash(cardArt(profile))));
  assert.equal(hashes.size, FIXTURE_PROFILES.length);
});

test("seed, stamps and the QR target change the card", () => {
  const profile = FIXTURE_PROFILES[0];
  const base = cardArt(profile, { seed: "a" });
  assert.notEqual(base, cardArt(profile, { seed: "b" }));
  assert.notEqual(base, cardArt(profile, { seed: "a", stamps: ["prizren-fortress"] }));
  assert.notEqual(base, cardArt(profile, { seed: "a", qrUrl: "https://383ks.com/visit/t/abc" }));
});

test("cards carry the headline, the 383 mark and a real woven QR", () => {
  const svg = cardArt(FIXTURE_PROFILES[0]);
  assert.match(svg, /^<svg [^>]*viewBox="0 0 600 900"/);
  assert.match(svg, /Lena’s Kosovo/);
  assert.match(svg, /383 · KOSOVA NË XHEP/);
  assert.match(svg, /data-zone="qr" data-modules="\d+"/);
  assert.doesNotMatch(svg, /placeholder/);
});

test("a typical trip link keeps one QR module per woven cell", () => {
  const svg = cardArt(FIXTURE_PROFILES[0], { qrUrl: "https://383ks.com/visit/t/AbCdEfGhIjKlMnOpQrStUv" });
  const modules = Number(svg.match(/data-modules="(\d+)"/)[1]);
  assert.ok(modules <= 37, `expected version ≤5, got ${modules} modules`);
});

test("Albanian text renders when asked", () => {
  const svg = cardArt(FIXTURE_PROFILES[0], { lang: "sq" });
  assert.match(svg, /Kosova · Lena/);
  assert.match(svg, /maj/);
});

test("names ending in s take a bare apostrophe", () => {
  assert.match(cardArt({ name: "The Kowalskis" }), /The Kowalskis’ Kosovo/);
  assert.match(cardArt({ name: "Lena" }), /Lena’s Kosovo/);
});

test("hostile or stale profile data never breaks the SVG", () => {
  for (const raw of [null, undefined, "x", 42, [], { name: "<script>alert(1)</script>&", interests: "food", cities: [1, "atlantis"], days: "abc", month: 13 }]) {
    const svg = cardArt(raw);
    assert.doesNotMatch(svg, /<script/);
    assert.match(svg, /<\/svg>$/);
  }
  const normalized = normalizeCardProfile({ days: 400, interests: ["food", "food", "zzz"], cities: ["prizren", "prizren"] });
  assert.equal(normalized.days, 30);
  assert.deepEqual(normalized.interests, ["food"]);
  assert.deepEqual(normalized.cities, ["prizren"]);
});

test("cards define no SVG ids, so any number can share a page", () => {
  for (const profile of FIXTURE_PROFILES) assert.doesNotMatch(cardArt(profile), / id="/);
});
