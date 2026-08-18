/* Server-only LLM helper with provider failover.
 *
 * Order: Groq (llama-3.3-70b) → Gemini key #1 → Gemini key #2, and each
 * Gemini key tries every model in GEMINI_MODELS before giving up.
 * Every tregu AI call goes through llmJSON so a Groq rate-limit or outage
 * never silences the news→odds refresh pipeline — it degrades to the free
 * Gemini keys instead of failing. Env: GROQ_API_KEY, GOOGLE_AI_API_KEY,
 * GOOGLE_AI_API_KEY_2 (both Gemini keys optional).
 */

import { groqChat, parseJSON } from "./groq";

/*
 * A list, not one hardcoded name. `gemini-2.0-flash` was pinned here and has
 * since been retired, so every Gemini call in the repo returned 404 — silently,
 * because llmJSON only reports failure when *every* provider fails and Groq was
 * still answering. Pinning a replacement would repeat that in a year, and the
 * floating alias alone is not enough either: it answers 503 under load.
 *
 * So: the alias first, a concrete recent version behind it. One retirement or
 * one demand spike no longer takes the whole fallback path down.
 */
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.5-flash"] as const;

async function geminiChat(
  key: string,
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const failures: string[] = [];

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.4,
            maxOutputTokens: opts.maxTokens ?? 2000,
            responseMimeType: "application/json",
            // Current Flash models reason before answering, and that reasoning
            // is billed against maxOutputTokens. At the budgets used here it
            // consumed the entire allowance: the call returned 200 with an
            // empty candidate and no usage metadata, which surfaced downstream
            // as a JSON parse error rather than as a model failure. None of
            // these calls are extraction tasks that benefit from thinking.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("empty response");
      return content;
    } catch (err) {
      failures.push(`${model} ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`Gemini API error — ${failures.join(" | ")}`);
}

/** JSON completion with automatic provider failover. Throws only when every provider fails. */
export async function llmJSON<T>(
  system: string,
  user: string,
  opts: { maxTokens?: number } = {}
): Promise<T> {
  const failures: string[] = [];

  if (process.env.GROQ_API_KEY) {
    try {
      return parseJSON<T>(await groqChat(system, user, { json: true, maxTokens: opts.maxTokens }));
    } catch (err) {
      failures.push(`groq: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    failures.push("groq: GROQ_API_KEY not set");
  }

  for (const envName of ["GOOGLE_AI_API_KEY", "GOOGLE_AI_API_KEY_2"] as const) {
    const key = process.env[envName];
    if (!key) continue;
    try {
      return parseJSON<T>(await geminiChat(key, system, user, opts));
    } catch (err) {
      failures.push(`${envName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`All LLM providers failed — ${failures.join(" | ")}`);
}
