/* Server-only LLM helper with provider failover.
 *
 * Order: Groq (llama-3.3-70b) → Gemini key #1 → Gemini key #2.
 * Every tregu AI call goes through llmJSON so a Groq rate-limit or outage
 * never silences the news→odds refresh pipeline — it degrades to the free
 * Gemini keys instead of failing. Env: GROQ_API_KEY, GOOGLE_AI_API_KEY,
 * GOOGLE_AI_API_KEY_2 (both Gemini keys optional).
 */

import { groqChat, parseJSON } from "./groq";

const GEMINI_MODEL = "gemini-2.0-flash";

async function geminiChat(
  key: string,
  system: string,
  user: string,
  opts: { maxTokens?: number } = {}
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: opts.maxTokens ?? 2000,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini returned an empty response.");
  return content;
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
