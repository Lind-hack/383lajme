/** Retry the same OAuth model without accepting or repairing ambiguous JSON. */
export function requestDailyCodex({ prompt, key, maximum, timeoutMs, execute, now = Date.now, onRetry = () => {} }) {
  const deadline = now() + timeoutMs;
  let reason = "invalid_json";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const remaining = deadline - now();
    if (remaining <= 0) break;
    const request = attempt === 1 ? prompt : `${prompt}\n\nYour previous response failed ${reason}. Return a complete, valid JSON object with the ${key} array only. Check matching brackets, no trailing characters, and at most ${maximum} entries. Do not invent additional facts.`;
    let output;
    try { output = execute(request, remaining); }
    catch (error) {
      reason = "provider_request";
      if (error?.code === "ETIMEDOUT" || error?.signal) break;
      onRetry({ stage: key, attempt, reason });
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    } catch {
      reason = "invalid_json";
      onRetry({ stage: key, attempt, reason });
      continue;
    }
    if (!Array.isArray(parsed?.[key]) || parsed[key].length > maximum || parsed[key].some(item => !item || typeof item !== "object" || Array.isArray(item))) {
      reason = "invalid_shape";
      onRetry({ stage: key, attempt, reason });
      continue;
    }
    return parsed[key];
  }
  // Never expose the child command, article prompt, or raw provider response.
  throw new Error(`Daily GPT-6 Luna xhigh ${key} failed after bounded retries (${reason}).`);
}
