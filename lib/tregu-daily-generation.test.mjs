import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDailyMarkets } from "./tregu-daily-generation.mjs";

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
