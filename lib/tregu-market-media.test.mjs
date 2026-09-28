import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TREGU_CONTEXT_FALLBACKS,
  resolveMarketMedia,
  selectMarketIdentityImage,
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

test("cited subject image is persisted before generic category art", () => {
  const candidate = { question: "Çfarë vendos Vjosa Osmani?", source_slugs: ["osmani", "other"], proposition: { entities: ["Vjosa Osmani"] } };
  const articles = [
    { slug: "other", title: "Other story", imageUrl: "https://images.example/other.jpg" },
    { slug: "osmani", title: "Vjosa Osmani flet për vendimin", imageUrl: "https://images.example/osmani.jpg", url: "https://news.example/osmani" },
  ];
  const used = new Set();
  const identity = selectMarketIdentityImage(candidate, articles, used);
  assert.equal(identity?.market_image_url, "https://images.example/osmani.jpg");
  assert.equal(identity?.market_image_source_url, "https://news.example/osmani");
  assert.equal(resolveMarketMedia({ category: "politike", slug: "osmani", ...identity }, articles)?.kind, "market_identity");
  assert.equal(selectMarketIdentityImage(candidate, articles, used), null);
});

test("named Kosovo party and politician use attributed subject assets", () => {
  const used = new Set();
  const party = selectMarketIdentityImage({ proposition: { entities: ["Lëvizja Vetëvendosje"] }, source_slugs: [] }, [], used);
  const person = selectMarketIdentityImage({ proposition: { entities: ["Albin Kurti"] }, source_slugs: [] }, [], used);
  assert.match(party.market_image_url, /Logo_of_Vet%C3%ABvendosje/);
  assert.match(party.market_image_credit, /CC BY-SA 4\.0/);
  assert.match(person.market_image_url, /Albin_Kurti_2024/);
  assert.match(person.market_image_credit, /Xavier Lejeune/);
  assert.notEqual(party.market_image_url, person.market_image_url);
  assert.equal(selectMarketIdentityImage({ proposition: { entities: ["Albin Kurti"] }, source_slugs: [] }, [], used), null);
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
