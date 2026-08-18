/* Server-only Groq helper — free tier, OpenAI-compatible endpoint. Used by 383 Tregu. */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/*
 * Groq's catalogue, not a guess: GET /openai/v1/models on this key returns
 * qwen3.6, gpt-oss, compound and allam — and no Llama at all. The pinned
 * llama-3.3-70b-versatile was not revoked from the account, it was retired by
 * Groq, which is why this path worked for months and then returned 404 on every
 * call. qwen3.6 is excluded deliberately: it rejects json_object mode and emits
 * <think> blocks in plain mode.
 */
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound-mini"];

/** gpt-oss models reason before answering, and that reasoning is billed against
 *  max_tokens. Left at default, a 5.5KB prompt spent the budget thinking and
 *  constrained decoding then failed with "Failed to validate JSON" — measured:
 *  563 characters of reasoning at default, 64 at low. Only the OpenAI-authored
 *  models accept the parameter. */
function reasoningEffortFor(model: string): "low" | undefined {
  return model.startsWith("openai/") ? "low" : undefined;
}

/** Reasoning needs headroom even when it is dialled down, so a caller asking
 *  for a small completion still gets a budget the model can finish inside. */
const MIN_TOKENS = 1500;

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
    // Strict json_object mode first, then plain. parseJSON below already
    // tolerates prose and code fences, so a model that refuses the mode is
    // retried without it rather than written off as unavailable.
    for (const jsonMode of [true, false]) {
      const effort = reasoningEffortFor(model);
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
          max_tokens: Math.max(opts.maxTokens ?? 2000, MIN_TOKENS),
          ...(opts.json && jsonMode ? { response_format: { type: "json_object" } } : {}),
          ...(effort ? { reasoning_effort: effort } : {}),
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
        // Distinguishable from a refusal: the model answered, but spent the
        // whole budget reasoning and emitted nothing.
        const reasoning = data?.choices?.[0]?.message?.reasoning?.length ?? 0;
        failures.push(
          `${model}${jsonMode ? "" : " (plain)"}: empty content (${reasoning}ch reasoning)`
        );
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
