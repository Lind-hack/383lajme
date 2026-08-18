/* Server-only Groq helper — free tier, OpenAI-compatible endpoint. Used by 383 Tregu. */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/*
 * A list, for the same reason lib/llm.ts keeps one: llama-3.3-70b-versatile was
 * pinned here and Groq has retired it — a nightly run failed with "does not
 * exist or you do not have access to it", which is the primary provider being
 * gone rather than rate-limited. llama-3.1-8b-instant turned out to be retired
 * too; gpt-oss-120b answered, so it leads. The old name stays behind it in case
 * an account still has access.
 */
const MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"];

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
    // Strict json_object mode first, then plain. gpt-oss-120b answers but
    // rejected the request outright with "Failed to validate JSON" when the
    // mode was on; parseJSON below already tolerates prose and code fences, so
    // a model that refuses the mode is retried without it rather than written
    // off as unavailable.
    for (const jsonMode of [true, false]) {
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
          ...(opts.json && jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        failures.push(
          `${model}${jsonMode ? "" : " (plain)"} ${res.status}: ${body.slice(0, 140)}`
        );
        // Only a rejected request is worth retrying without the mode. A 404 is
        // a retired model and a 429 is a quota — both mean move on.
        if (res.status === 400 && jsonMode) continue;
        break;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        failures.push(`${model}${jsonMode ? "" : " (plain)"}: empty response`);
        continue;
      }
      return content;
    }
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
