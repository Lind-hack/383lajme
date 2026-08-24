import { test } from "node:test";
import assert from "node:assert/strict";

import { shortCode, shortUrl } from "./short-link.mjs";

test("a slug always produces the same code", () => {
  assert.equal(shortCode("buxheti-2026"), shortCode("buxheti-2026"));
  assert.match(shortCode("buxheti-2026"), /^[0-9a-z]{7}$/);
});

test("near-identical slugs do not share a code", () => {
  const codes = new Set([
    shortCode("kuvendi-aprovon-buxhetin"),
    shortCode("kuvendi-aprovon-buxhetin-2"),
    shortCode("kuvendi-aprovon-buxhetit"),
    shortCode("Kuvendi-aprovon-buxhetin"),
    shortCode("kuvendi-aprovon-buxhetin-"),
  ]);
  assert.equal(codes.size, 5);
});

test("codes stay unique well past the size of the archive", () => {
  // Fixed inputs, so this is deterministic rather than a probabilistic spot
  // check. 5,000 is roughly thirty times the live archive; the retention job
  // keeps it far below that. If this ever fails, the hash needs more bits
  // before the redirect starts serving the wrong story.
  const seen = new Map();
  for (let i = 0; i < 5000; i += 1) {
    const slug = `lajm-${i}-nga-kosova-per-ngjarjen-e-dites-${i * 7}`;
    const code = shortCode(slug);
    assert.ok(!seen.has(code), `collision: ${slug} and ${seen.get(code)} share ${code}`);
    seen.set(code, slug);
  }
});

test("the short URL is dramatically shorter than the canonical one", () => {
  const slug = "gjykata-us-heq-ndalimin-e-vizave-emigrante-per-75-vende-ne-to-kosova";
  const short = shortUrl(slug);
  assert.match(short, /^https:\/\/383ks\.com\/a\/[0-9a-z]{7}$/);
  assert.ok(short.length < `https://www.383ks.com/article/${slug}`.length / 3);
});

test("a missing slug still yields a usable code rather than throwing", () => {
  assert.match(shortCode(undefined), /^[0-9a-z]{7}$/);
  assert.match(shortCode(""), /^[0-9a-z]{7}$/);
});
