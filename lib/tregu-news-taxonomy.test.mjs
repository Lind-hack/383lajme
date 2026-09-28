import assert from "node:assert/strict";
import test from "node:test";
import { candidateNewsTaxonomy, marketNewsTaxonomy, matchesNewsFilter } from "./tregu-news-taxonomy.mjs";
import { evaluateDailyMarketCandidate } from "./tregu-daily-market-quality.mjs";

test("news markets keep geography and topic independently", () => {
  const candidate = { category: "ekonomi", news_topic: "Ekonomi", proposition: { geography: "Kosovo" } };
  assert.deepEqual(candidateNewsTaxonomy(candidate), { geography: "kosove", topic: "ekonomi" });
  const market = { category: "ekonomi", pre_match_analysis: { news_geography: "kosove", news_topic: "ekonomi" } };
  assert.deepEqual(marketNewsTaxonomy(market), { geography: "kosove", topic: "ekonomi" });
  assert.equal(matchesNewsFilter(market, "kosove"), true);
  assert.equal(matchesNewsFilter(market, "ekonomi"), true);
  assert.equal(matchesNewsFilter(market, "shqiperi"), false);
});

test("world geography does not overwrite a market's topic", () => {
  const market = { category: "bote", pre_match_analysis: { proposition: { geography: "World" }, news_topic: "teknologji" } };
  assert.equal(matchesNewsFilter(market, "bote"), true);
  assert.equal(marketNewsTaxonomy(market).topic, "teknologji");
  assert.equal(matchesNewsFilter({ category: "bote" }, "bote"), true);
});

test("a new world event contract cannot omit its topic", () => {
  const candidate = {
    category: "bote", contract_version: "news-event-v3",
    proposition: { geography: "World" },
  };
  const result = evaluateDailyMarketCandidate(candidate, { sourceArticles: [], existingMarkets: [], now: new Date("2026-09-28T00:00:00Z") });
  assert.ok(result.reasons.includes("missing_news_topic"));
  assert.ok(!result.reasons.includes("missing_news_geography"));
});
