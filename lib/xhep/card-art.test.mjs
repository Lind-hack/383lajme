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

test("prototype keys, emoji cuts, control characters and loose numbers are all neutralised", () => {
  const p = normalizeCardProfile({
    name: "AAAAAAAAAAAAAAAAA😀😀\u0001",
    cities: ["constructor", "__proto__", "toString", "peje"],
    days: null,
    month: true,
  });
  assert.deepEqual(p.cities, ["peje"]);
  assert.equal([...p.name].length, 18);
  assert.doesNotMatch(p.name, /[\u0000-\u001F]/);
  assert.equal(p.days, 5);
  assert.equal(p.month, null);
  assert.equal(normalizeCardProfile({ name: "Ana Maria Ferizaj Mitro" }).name.endsWith(" "), false);
  // The full SVG survives being turned into a data URI (a lone surrogate would throw).
  encodeURIComponent(cardArt({ name: "AAAAAAAAAAAAAAAAA😀" }));
});

test("the route line never runs past the label, in either language", () => {
  const busy = {
    name: "WWWWWWWWWWWWWWWWWW",
    cities: ["peje", "mitrovice", "prishtine", "gjilan", "ferizaj", "prizren"],
    interests: ["nature", "history", "food", "coffee"],
  };
  for (const lang of ["en", "sq"]) {
    const svg = cardArt(busy, { lang, stamps: Array.from({ length: 12 }, (_, i) => `s${i}`) });
    for (const [, size, body] of svg.matchAll(/font-size="(\d+)" font-weight="800" fill="[^"]+">([^<]+)<\/text>/g)) {
      const chars = [...body.replace(/&[a-z#0-9]+;/g, "x")];
      const caps = chars.filter((ch) => ch !== ch.toLowerCase()).length;
      const width = (chars.length * 0.6 + caps * 0.14) * Number(size);
      assert.ok(width <= 600 - 2 * 56 - 52 + 1, `${lang}: "${body}" ≈${Math.round(width)}px`);
    }
  }
});

test("duplicate stamps count once", () => {
  assert.equal(cardArt(FIXTURE_PROFILES[0], { stamps: ["a", "a"] }), cardArt(FIXTURE_PROFILES[0], { stamps: ["a"] }));
});

test("the QR sits on whole weave cells, and long or bad targets fail loudly", () => {
  const svg = cardArt(FIXTURE_PROFILES[0], { qrUrl: "https://383ks.com/visit/t/AbCdEfGhIjKlMnOpQrStUv" });
  const x = Number(svg.match(/data-zone="qr"[^>]*><rect x="([\d.]+)"/)[1]);
  assert.equal(x % 10, 0);
  const longish = cardArt(FIXTURE_PROFILES[0], { qrUrl: `https://383ks.com/visit/t/${"a".repeat(150)}` });
  assert.match(longish, /<rect x="\d+" y="\d+" width="\d+"/); // integer pixels even when modules shrink
  assert.throws(() => cardArt(FIXTURE_PROFILES[0], { qrUrl: `https://383ks.com/${"a".repeat(400)}` }), Error);
  assert.throws(() => cardArt(FIXTURE_PROFILES[0], { qrUrl: "javascript:alert(1)" }), /http/);
});
