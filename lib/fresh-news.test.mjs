import { test } from "node:test";
import assert from "node:assert/strict";
import { freshNews } from "./fresh-news.mjs";
import { frontRank } from "./front-page.mjs";
const now = Date.parse("2026-10-08T18:00:00Z");
const article = (id, score, age, category = id) => ({ id, category, title: ({old:"Ministri ndryshon transportin publik",breaking:"Termeti shkaterron banesa",stocks:"Bitcoin fundos tregjet financiare",ai:"OpenAI prezanton modelin Orion"}[id] ?? id), engagementScore: score, publishedAt: new Date(now - age * 3_600_000).toISOString() });
test("exactly 0.2 points decay per hour with published time as anchor", () => {
  const a = { ...article("one", 9, 4), createdAt: new Date(now - 50 * 3_600_000).toISOString() };
  assert.equal(frontRank(a, now), 8.2);
  assert.equal(frontRank(a, now + 3_600_000), 8);
});
test("days-old high scores and undated stories cannot crowd fresh notices", () => {
  const pool = [article("archive", 10, 72), article("fresh", 6, 1), { ...article("unknown", 10, 1), publishedAt: undefined }];
  assert.deepEqual(freshNews(pool, { now }).map(a => a.id), ["fresh"]);
});
test("fresh breaking stories rank first and Top 5 includes all topics", () => {
  const pool = [article("old", 9, 20, "Kosovë"), article("breaking", 8, 0.5, "Kosovë"), article("stocks", 8.5, 1, "Ekonomi"), article("ai", 7.5, 0.5, "Teknologji")];
  assert.deepEqual(freshNews(pool, { now, diverse: true, count: 5 }).map(a => a.id), ["stocks", "breaking", "ai"]);
  assert.equal(freshNews(pool, { now, exclude: new Set(["stocks"]), count: 1 })[0].id, "breaking");
});
