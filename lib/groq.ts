/* Server-only Groq helper — free tier, OpenAI-compatible endpoint. Used by 383 Tregu. */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/*
 * A list, for the same reason lib/llm.ts keeps one: llama-3.3-70b-versatile was
 * pinned here and Groq has retired it. A nightly draft run failed with
 * "The model `llama-3.3-70b-versatile` does not exist or you do not have access
 * to it", which is the primary provider being gone rather than rate-limited.
 * Tried in order; the first that answers wins.
 */
const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
];

export async function groqChat(
  system: string,
  user: string,
  opts: { json?: boolean; maxTokens?: number } = {}
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local (free key at console.groq.com)."
    );
  }
  const failures: string[] = [];
  for (const model of MODELS) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: opts.maxTokens ?? 2000,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    failures.push(`${model} ${res.status}: ${body.slice(0, 140)}`);
    continue;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    failures.push(`${model}: empty response`);
    continue;
  }
  return content;
  }

  throw new Error(`Groq API error — ${failures.join(" | ")}`);
}

/** Parse a JSON response, tolerating stray code fences. */
export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
