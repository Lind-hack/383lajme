import assert from "node:assert/strict";
import test from "node:test";
import { parseMarketResearchEvidence } from "./tregu-research-evidence-validated.mjs";

const now = new Date("2026-09-28T00:00:00Z");
const article = (url, overrides = {}) => ({
  slug: `research-${url.split("/").at(-1)}`, title: "Parliament schedules a consequential budget vote",
  excerpt: "Original reporting", body: "Original reporting ".repeat(90),
  source: new URL(url).hostname, url, discovery_url: url,
  publishedAt: "2026-09-27T23:00:00Z", fetchedAt: "2026-09-27T23:55:00Z",
  verification: "original_page_extracted", truncated: false, ...overrides,
});

test("only fresh original-page evidence is returned for its market", () => {
  const payload = { generated_at: "2026-09-27T23:55:00Z", markets: {
    first: [article("https://example.org/vote"), article("https://example.org/vote"),
      article("https://other.org/short", { body: "Headline only" }),
      article("https://third.org/copy", { source: "example.org" })],
    other: [article("https://other.org/decision")],
  } };
  const result = parseMarketResearchEvidence(payload, ["first"], now);
  assert.deepEqual(result.get("first").map((row) => row.url), ["https://example.org/vote"]);
  assert.equal(result.has("other"), false);
});

test("stale research and preview-only pages cannot move odds", () => {
  assert.throws(() => parseMarketResearchEvidence({ generated_at: "2026-09-27T23:00:00Z", markets: {} }, ["first"], now), /stale/);
  const result = parseMarketResearchEvidence({ generated_at: "2026-09-27T23:55:00Z", markets: {
    first: [article("https://example.org/vote", { truncated: true }), article("https://example.org/preview", { verification: "feed_snippet" })],
  } }, ["first"], now);
  assert.deepEqual(result.get("first"), []);
});
