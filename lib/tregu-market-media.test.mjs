import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TREGU_CONTEXT_FALLBACKS,
  resolveMarketMedia,
} from "./tregu-market-media.mjs";

test("first safe pinned article wins in stored source order", () => {
  const market = { category: "politike", source_article_slugs: ["first", "second"] };
  const media = resolveMarketMedia(market, [
    { slug: "second", image_url: "https://images.example/second.jpg", category: "Botë", title: "Second" },
    { slug: "first", image_url: "https://images.example/first.jpg", category: "Shqipëri", title: "First" },
  ]);
  assert.equal(media?.src, "https://images.example/first.jpg");
  assert.equal(media?.context, "albania");
  assert.equal(media?.articleSlug, "first");
});

test("unsafe source images fall back to the stable owned category image", () => {
  const media = resolveMarketMedia(
    { category: "bote", source_article_slugs: ["bad"] },
    [{ slug: "bad", image_url: "http://insecure.example/a.jpg", category: "Botë" }]
  );
  assert.equal(media?.kind, "category_fallback");
  assert.equal(media?.src, TREGU_CONTEXT_FALLBACKS.world);
  const protocolRelative = resolveMarketMedia(
    { category: "bote", source_article_slugs: ["bad"] },
    [{ slug: "bad", image_url: "//evil.example/a.jpg", category: "Botë" }]
  );
  assert.equal(protocolRelative?.kind, "category_fallback");
});

test("Albania newsroom aliases keep Tirana stories in the Albania context", () => {
  for (const category of ["Tiranë", "Tirana", "Albania"]) {
    const media = resolveMarketMedia(
      { category: "politike", source_article_slugs: ["story"] },
      [{ slug: "story", image_url: "https://images.example/story.jpg", category }]
    );
    assert.equal(media?.context, "albania", category);
  }
});

test("economy and Kosovo fallbacks are deterministic while sport opts out", () => {
  assert.equal(resolveMarketMedia({ category: "ekonomi" })?.context, "economy");
  assert.equal(resolveMarketMedia({ category: "politike" })?.context, "kosovo");
  assert.equal(resolveMarketMedia({ category: "sport" }), null);
  assert.equal(resolveMarketMedia({ category: "politike", market_classification: "live_football" }), null);
});

test("every owned context fallback exists in the public tree", () => {
  for (const src of Object.values(TREGU_CONTEXT_FALLBACKS)) {
    assert.equal(fs.existsSync(path.join(process.cwd(), "public", src.replace(/^\//, ""))), true, src);
  }
});
