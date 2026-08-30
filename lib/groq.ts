/* Server-only Groq helper — free tier, OpenAI-compatible endpoint. Used by 383 Tregu. */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/*
 * Groq's catalogue, read from GET /openai/v1/models on this key rather than
 * assumed: qwen3.6, gpt-oss, compound and allam — no Llama at all. The pinned
 * llama-3.3-70b-versatile was not revoked from the account, Groq retired it,
 * which is why this path ran for months and then 404'd on every call.
 *
 * qwen3.6 leads by choice: it is the stronger reasoner of what is on offer.
 * Each model needs different handling, and getting it wrong looks identical
 * from the outside — an empty completion or "Failed to validate JSON" — so the
 * per-model settings are recorded here with what they were measured against.
 */
type GroqModel = {
  id: string;
  /** Extra request fields this model needs. Sending them to a model that does
   *  not accept them is a 400, so they are never applied globally. */
  params?: Record<string, string>;
  /** Hard ceiling. qwen3.6 answers 413 "Request too large" above ~4k. */
  maxTokens?: number;
};

const MODELS: GroqModel[] = [
  {
    // reasoning_format is mandatory in JSON mode ("must be set to `hidden` or
    // `parsed` when json mode is enabled"), and this model's effort vocabulary
    // is none/default — `low` is a 400. Reasoning is billed against max_tokens
    // even when hidden, and at default effort it consumed the budget and left
    // the JSON unfinished, so the ladder below starts thinking and drops it
    // only when the model cannot finish.
    id: "qwen/qwen3.6-27b",
    params: { reasoning_format: "hidden", reasoning_effort: "none" },
    maxTokens: 4000,
  },
  {
    // Different vocabulary again: gpt-oss takes `low`, and without it a 5.5KB
    // prompt spent the whole budget reasoning — 563 characters of it, against
    // 64 at low.
    id: "openai/gpt-oss-120b",
    params: { reasoning_effort: "low" },
  },
  { id: "openai/gpt-oss-20b", params: { reasoning_effort: "low" } },
  { id: "groq/compound-mini" },
];

/** Reasoning needs headroom even dialled down, so a caller asking for a small
 *  completion still gets a budget the model can finish inside. */
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
    const budget = Math.min(
      Math.max(opts.maxTokens ?? 2000, MIN_TOKENS),
      model.maxTokens ?? Number.MAX_SAFE_INTEGER
    );

    // Strict json_object mode first, then plain: parseJSON already tolerates
    // prose and code fences, so a model that refuses the mode is retried
    // without it rather than written off as unavailable.
    for (const jsonMode of [true, false]) {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model.id,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.4,
          max_tokens: budget,
          ...(opts.json && jsonMode ? { response_format: { type: "json_object" } } : {}),
          ...(model.params ?? {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        failures.push(
          `${model.id}${jsonMode ? "" : " (plain)"} ${res.status}: ${body.slice(0, 140)}`
        );
        // Only a rejected request is worth retrying without the mode. A 404 is
        // a retired model, 429 a quota and 413 an oversized request — none of
        // them get better by asking the same model again.
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
          `${model.id}${jsonMode ? "" : " (plain)"}: empty content (${reasoning}ch reasoning)`
        );
        continue;
      }
      return content;
    }
  }

  throw new Error(`Groq API error — ${failures.join(" | ")}`);
}

/** Parse JSON while preserving model text and repairing only illegal string controls. */
export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let normalized = "";
  let inString = false;
  let escaped = false;
  for (const character of cleaned) {
    if (escaped) {
      normalized += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && inString) {
      normalized += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      normalized += character;
      inString = !inString;
      continue;
    }
    if (inString && character === "\n") { normalized += "\\n"; continue; }
    if (inString && character === "\r") { normalized += "\\r"; continue; }
    if (inString && character === "\t") { normalized += "\\t"; continue; }
    normalized += character;
  }
  return JSON.parse(normalized) as T;
}
