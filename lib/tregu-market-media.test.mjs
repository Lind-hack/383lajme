import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveMarketMedia,
  selectMarketIdentityImage,
} from "./tregu-market-media.mjs";

test("first safe pinned article wins in stored source order", () => {
  const market = { category: "politike", source_article_slugs: ["first", "second"] };
  const media = resolveMarketMedia(market, [
    { slug: "second", image_url: "https://images.example/second.jpg", url: "https://news.example/second", category: "Botë", title: "Second" },
    { slug: "first", image_url: "https://images.example/first.jpg", url: "https://news.example/first", category: "Shqipëri", title: "First" },
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

test("named politician uses an attributed subject photo", () => {
  const used = new Set();
  const person = selectMarketIdentityImage({ proposition: { entities: ["Albin Kurti"] }, source_slugs: [] }, [], used);
  assert.match(person.market_image_url, /Albin_Kurti_2024/);
  assert.match(person.market_image_credit, /Xavier Lejeune/);
  assert.equal(selectMarketIdentityImage({ proposition: { entities: ["Albin Kurti"] }, source_slugs: [] }, [], used), null);
});

test("unsafe source images do not produce market art", () => {
  const media = resolveMarketMedia(
    { category: "bote", source_article_slugs: ["bad"] },
    [{ slug: "bad", image_url: "http://insecure.example/a.jpg", category: "Botë" }]
  );
  assert.equal(media, null);
  const protocolRelative = resolveMarketMedia(
    { category: "bote", source_article_slugs: ["bad"] },
    [{ slug: "bad", image_url: "//evil.example/a.jpg", category: "Botë" }]
  );
  assert.equal(protocolRelative, null);
});

test("Albania newsroom aliases keep Tirana stories in the Albania context", () => {
  for (const category of ["Tiranë", "Tirana", "Albania"]) {
    const media = resolveMarketMedia(
      { category: "politike", source_article_slugs: ["story"] },
      [{ slug: "story", image_url: "https://images.example/story.jpg", url: "https://news.example/story", category }]
    );
    assert.equal(media?.context, "albania", category);
  }
});

test("missing news photos are omitted while sport opts out", () => {
  assert.equal(resolveMarketMedia({ category: "ekonomi" }), null);
  assert.equal(resolveMarketMedia({ category: "politike" }), null);
  assert.equal(resolveMarketMedia({ category: "sport" }), null);
  assert.equal(resolveMarketMedia({ category: "politike", market_classification: "live_football" }), null);
});

test("generated art is replaced by a sourced subject photo", () => {
  const market = { question: "Zgjedh Kuvendi i Kosovës president deri më 13 tetor?", category: "politike", market_image_url: "/api/tregu/market-art/old" };
  const media = resolveMarketMedia(market);
  assert.match(media?.src ?? "", /Parliament_of_the_Republic_of_Kosovo/);
  assert.match(media?.source ?? "", /commons.wikimedia.org/);
});
