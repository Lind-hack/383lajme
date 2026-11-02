/**
 * The second reader of a dossier moment.
 *
 * lib/dosje-draft.mjs proves, in code, that every quote is on its live page,
 * that two publishers carry each claim, and that the figures and the date are
 * inside the quotes. What code cannot prove is that the Albanian sentence says
 * what the English quotes say — "convicted" against a quote about an
 * indictment passes every one of those rules.
 *
 * So a model that did not write the moment reads each claim beside its own
 * quotes and answers, per claim, whether the quotes state all of it. It is a
 * refusal-only gate: its "yes" adds nothing on its own, its "no" — or its
 * silence — keeps the moment off the site.
 *
 * Pure. The call itself happens in the publish route.
 */

export const JUDGE_SYSTEM = `You check a history timeline before publication. Each numbered claim is one Albanian sentence followed by quotes copied from news sources.

The moment happened on the date given. For EACH claim decide: do the quotes, taken together, state EVERYTHING the sentence says — the same people, institutions, places, the same event (e.g. charged is not convicted, proposed is not adopted, started is not finished), the same date and the same numbers? A sentence that adds anything the quotes do not say, or says it more strongly, is NOT supported. Translation differences are fine; changed meaning is not.

Time matters. Each quote shows when its article was published. If a quote describes something that happened at a different time than the moment's date (for example "on Monday" in an article published years later, or a later stage of the same story), the claim is NOT supported for this moment.

Answer only JSON: {"claims":[{"i":0,"supported":true,"problem":""}]} with one entry per claim. When not supported, "problem" says in a few English words what the quotes do not state.`;

/** @param {{ title?: string, event_date?: string, display_date?: string, claims?: { sentences?: Array<{ sentence?: string, quotes?: Array<{ text?: string, published?: string | null }> }> } }} milestone */
export function judgePrompt(milestone) {
  const claims = milestone?.claims?.sentences ?? [];
  const body = claims
    .map((c, i) => {
      const quotes = (c?.quotes ?? [])
        .map((q) => `   - "${String(q?.text ?? "")}" (published ${q?.published ? String(q.published).slice(0, 10) : "date unknown"})`)
        .join("\n");
      return `[${i}] ${String(c?.sentence ?? "")}\n${quotes}`;
    })
    .join("\n\n");
  const when = milestone?.event_date
    ? ` — date: ${milestone.event_date}${milestone.display_date ? ` (${milestone.display_date})` : ""}`
    : "";
  return { system: JUDGE_SYSTEM, prompt: `Moment: ${String(milestone?.title ?? "")}${when}\n\n${body}` };
}

/**
 * Turn the judge's answer into a verdict. Anything but an explicit boolean
 * true for every claim index is a refusal.
 *
 * @param {unknown} json
 * @param {number} count
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function readJudgement(json, count) {
  const list = /** @type {any} */ (json)?.claims;
  if (!Array.isArray(list)) return { ok: false, problems: ["judge gave no answer"] };
  const problems = [];
  for (let i = 0; i < count; i++) {
    const entry = list.find((e) => e?.i === i);
    if (!entry) {
      problems.push(`[${i}] not judged`);
    } else if (entry.supported !== true) {
      problems.push(`[${i}] ${String(entry.problem || "not supported").slice(0, 160)}`);
    }
  }
  return { ok: problems.length === 0, problems };
}
