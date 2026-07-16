import assert from "node:assert/strict";
import test from "node:test";
import { configuredGeminiKeys, marketAiChat } from "./tregu-ai-provider.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("Gemini key candidates are nonempty and distinct across Google/Gemini aliases", () => {
  assert.deepEqual(configuredGeminiKeys({ GOOGLE_API_KEY: "one", GEMINI_API_KEY: "one", GOOGLE_API_KEY_2: "two", GEMINI_API_KEY_2: "" }), ["one", "two"]);
  assert.deepEqual(configuredGeminiKeys({ GOOGLE_AI_API_KEY: "one", GOOGLE_AI_API_KEY1: "two" }), ["one", "two"]);
});

test("a Groq 429 fails over to Gemini key one without exposing a key", async () => {
  const urls = [];
  const result = await marketAiChat("system", "user", { json: true }, {
    env: { GROQ_API_KEY: "groq", GOOGLE_API_KEY: "google-one", GOOGLE_API_KEY_2: "google-two" },
    fetchImpl: async (url) => {
      urls.push(String(url));
      return urls.length === 1 ? json({ error: { message: "rate limit" } }, 429) : json({ candidates: [{ content: { parts: [{ text: '{"probability":0.5}' }] } }] });
    },
  });
  assert.equal(result.provider, "gemini-1");
  assert.equal(result.fallback_index, 1);
  assert.equal(result.fallback_reason, "rate_limit_or_quota");
  assert.equal(urls.length, 2);
  assert.doesNotMatch(JSON.stringify(result), /google-one|google-two|groq/);
});

test("ordinary model output does not invoke fallback", async () => {
  let calls = 0;
  const result = await marketAiChat("system", "user", {}, {
    env: { GROQ_API_KEY: "groq", GOOGLE_API_KEY: "google-one" },
    fetchImpl: async () => { calls += 1; return json({ choices: [{ message: { content: '{"probability":0.5,"material_evidence":false}' } }] }); },
  });
  assert.equal(result.provider, "groq");
  assert.equal(calls, 1);
});
