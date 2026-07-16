const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_MODEL = "gemini-2.5-flash";

function providerError(provider, response, body = "") {
  const error = new Error(`${provider} API error ${response.status}: ${String(body).slice(0, 300)}`);
  error.provider = provider;
  error.status = response.status;
  error.body = String(body);
  error.error_class = classifyProviderFailure(response.status, body);
  return error;
}

export function classifyProviderFailure(status, body = "") {
  const text = String(body).toLowerCase();
  if (Number(status) === 429 || /resource_exhausted|quota|rate.?limit|too many requests/.test(text)) return "rate_limit_or_quota";
  if (Number(status) >= 500 || Number(status) === 0) return "provider_unavailable";
  return "provider_error";
}

export function isFallbackEligible(error) {
  return error?.error_class === "rate_limit_or_quota" || error?.error_class === "provider_unavailable";
}

/** Returns distinct configured Gemini keys without exposing their values or names to callers. */
export function configuredGeminiKeys(env = process.env) {
  const keyOne = env.GOOGLE_API_KEY ?? env.GOOGLE_AI_API_KEY ?? env.GEMINI_API_KEY;
  const keyTwo = env.GOOGLE_API_KEY_2 ?? env.GOOGLE_AI_API_KEY1 ?? env.GEMINI_API_KEY_2;
  return [keyOne, keyTwo]
    .map((value) => String(value ?? "").trim())
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
}

async function callGroq(system, user, opts, fetchImpl, env) {
  const key = String(env.GROQ_API_KEY ?? "").trim();
  if (!key) {
    const error = new Error("GROQ_API_KEY is not configured.");
    error.provider = "groq";
    error.error_class = "provider_error";
    throw error;
  }
  let response;
  try {
    response = await fetchImpl(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.4,
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (cause) {
    const error = new Error(`Groq provider request failed: ${String(cause?.message ?? cause)}`);
    error.provider = "groq";
    error.error_class = "provider_unavailable";
    throw error;
  }
  if (!response.ok) throw providerError("Groq", response, await response.text());
  const content = (await response.json())?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty response.");
  return String(content);
}

async function callGemini(system, user, opts, key, fetchImpl) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: opts.maxTokens ?? 2000, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
      }),
    });
  } catch (cause) {
    const error = new Error(`Gemini provider request failed: ${String(cause?.message ?? cause)}`);
    error.provider = "gemini";
    error.error_class = "provider_unavailable";
    throw error;
  }
  if (!response.ok) throw providerError("Gemini", response, await response.text());
  const content = (await response.json())?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!content) throw new Error("Gemini returned an empty response.");
  return String(content);
}

/** Groq is always first. Gemini keys are attempted only after an eligible Groq/provider failure. */
export async function marketAiChat(system, user, opts = {}, { fetchImpl = fetch, env = process.env } = {}) {
  try {
    return { content: await callGroq(system, user, opts, fetchImpl, env), provider: "groq", fallback_index: 0, fallback_reason: null };
  } catch (groqError) {
    if (!isFallbackEligible(groqError)) throw groqError;
    const keys = configuredGeminiKeys(env);
    if (!keys.length) throw groqError;
    let lastError = groqError;
    for (const [index, key] of keys.entries()) {
      try {
        return { content: await callGemini(system, user, opts, key, fetchImpl), provider: `gemini-${index + 1}`, fallback_index: index + 1, fallback_reason: groqError.error_class };
      } catch (geminiError) {
        lastError = geminiError;
        if (!isFallbackEligible(geminiError)) throw geminiError;
      }
    }
    throw lastError;
  }
}
