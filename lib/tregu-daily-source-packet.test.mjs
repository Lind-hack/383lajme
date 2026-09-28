import { test } from "node:test";
import assert from "node:assert/strict";
import { dailySourcePacket, shortlistedSourceSlugs } from "./tregu-daily-source-packet.mjs";

test("daily source packets preserve citation identity while bounding long article bodies", () => {
  const articles = Array.from({ length: 30 }, (_, index) => ({
    slug: `story-${index}`, source: `publisher-${index % 3}`, url: `https://example.com/${index}`,
    title: `Story ${index}`, excerpt: "summary".repeat(100), body: "e".repeat(5000),
  }));
  const shortlist = dailySourcePacket(articles);
  assert.equal(shortlist.length, 24);
  assert.equal(shortlist[0].body.length, 350);
  assert.equal(shortlist[0].excerpt.length, 400);
  assert.ok(JSON.stringify(shortlist).length < 30_000);

  const cited = shortlistedSourceSlugs([{ source_slugs: ["story-2", "story-3", "story-2"] }]);
  assert.deepEqual(cited, ["story-2", "story-3"]);
  const contracts = dailySourcePacket(articles, { citedSlugs: cited });
  assert.deepEqual(contracts.map((article) => article.slug), cited);
  assert.equal(contracts[0].body.length, 1500);
});
