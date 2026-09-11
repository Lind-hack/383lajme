import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateDailyMarkets, shortlistDailyTopics } from "./tregu-daily-generation.mjs";

const dependency = content => ({ env: { GROQ_API_KEY: "test-only" }, fetchImpl: async (url, init) => {
  assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
  assert.ok(init.signal);
  assert.equal(JSON.parse(init.body).response_format.type, "json_object");
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
} });

test("daily generation uses the configured Groq service and preserves an empty qualified batch", async () => {
  const result = await generateDailyMarkets("Select qualified markets", dependency('{"markets":[]}'));
  assert.deepEqual(result, { candidates: [], provider: "groq", fallback_reason: null });
});
test("daily generation rejects malformed and oversized provider output", async () => {
  for (const content of ["not json", "{}", JSON.stringify({ markets: Array(7).fill({}) })]) {
    await assert.rejects(generateDailyMarkets("Select qualified markets", dependency(content)));
  }
});

// Two-stage generation. The existing `dependency` helper above asserts the Groq
// request shape, so these reuse it rather than defining a second fake client.
test("the shortlist stage returns named topics without any publishable contract field", async () => {
  const { topics, provider } = await shortlistDailyTopics("p", dependency(JSON.stringify({
    topics: [{ topic_key: "kosovo-budget-vote", decision: "approve or reject", source_slugs: ["a", "b"] }],
  })));
  assert.equal(provider, "groq");
  assert.equal(topics.length, 1);
  assert.equal(topics[0].topic_key, "kosovo-budget-vote");
  // Stage one must not be able to steer draftViolation onto the laxer event-contract
  // branch; only stage two may set contract_version.
  assert.equal(topics[0].contract_version, undefined);
});

test("the shortlist is capped so one bad reply cannot fan out into stage two", async () => {
  const { topics } = await shortlistDailyTopics("p", dependency(JSON.stringify({
    topics: Array.from({ length: 40 }, (_, index) => ({ topic_key: `t-${index}` })),
  })));
  assert.equal(topics.length, 10);
});

test("a shortlist reply missing its topics array fails loudly rather than silently yielding zero", async () => {
  await assert.rejects(() => shortlistDailyTopics("p", dependency(JSON.stringify({ markets: [] }))), /requires a topics array/);
});

test("the runner shortlists first and skips the contract call on an empty shortlist", () => {
  const source = readFileSync(new URL("../scripts/run-tregu-daily-drafts.mjs", import.meta.url), "utf8");
  // Stage one must run before the contract prompt is built, and an empty shortlist
  // must not spend a second provider call to confirm it found nothing.
  assert.ok(source.indexOf("shortlistDailyTopics(shortlistPrompt)") < source.indexOf("const prompt ="));
  assert.match(source, /shortlist\.topics\.length\s*\n?\s*\?\s*await generateDailyMarkets\(prompt\)/);
  assert.match(source, /fallback_reason: "empty_shortlist"/);
});
