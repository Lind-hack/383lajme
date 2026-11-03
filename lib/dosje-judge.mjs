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

Then judge the moment as a whole:
- is_event_on_date: do the sentences say what happened on the moment's date (an act, a decision, a vote, a trial, an attack, an agreement)? Sentences that only describe who someone is or what something is, with no event on that date, are false.
- belongs_to_dossier: is this event part of the history of the dossier's subject (given as "Dossier")? An event that only appears in the background of an unrelated article (a football riot for an election topic, a different person with the same surname) is false.

Answer only JSON: {"claims":[{"i":0,"supported":true,"problem":""}],"moment":{"is_event_on_date":true,"belongs_to_dossier":true,"problem":""}} with one entry per claim. When something fails, "problem" says in a few English words what is wrong.`;

/** @param {{ title?: string, topic?: string, event_date?: string, display_date?: string, claims?: { sentences?: Array<{ sentence?: string, quotes?: Array<{ text?: string, published?: string | null }> }> } }} milestone */
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
  const dossier = milestone?.topic ? `Dossier: ${milestone.topic}\n` : "";
  return { system: JUDGE_SYSTEM, prompt: `${dossier}Moment: ${String(milestone?.title ?? "")}${when}\n\n${body}` };
}

/**
 * The full verdict for a timeline moment: every claim supported (readJudgement)
 * AND the moment is an event on its date AND it belongs to the dossier. A
 * missing or non-boolean moment verdict is a refusal.
 *
 * @param {unknown} json
 * @param {number} count
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function readMomentJudgement(json, count) {
  const claims = readJudgement(json, count);
  const m = /** @type {any} */ (json)?.moment;
  const problems = [...claims.problems];
  if (m?.is_event_on_date !== true) problems.push(`moment: not an event on its date${m?.problem ? ` (${String(m.problem).slice(0, 120)})` : ""}`);
  if (m?.belongs_to_dossier !== true) problems.push(`moment: not part of this dossier${m?.problem ? ` (${String(m.problem).slice(0, 120)})` : ""}`);
  return { ok: problems.length === 0, problems };
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

// ── article links ───────────────────────────────────────────────────────────

export const LINK_JUDGE_SYSTEM = `You decide which news articles belong in a dossier about one subject. A dossier shows the history of that subject under articles about it.

For EACH article decide "about": is the article actually about the dossier's subject (the same person, institution, process or conflict)? Sharing a surname is not enough (a footballer called Berisha is not Sali Berisha). An article that only quotes or mentions the subject in passing while being about something else is false.

Answer only JSON: {"articles":[{"slug":"...","about":true}]} with one entry per article.`;

/**
 * @param {{ title?: string, blurb?: string }} topic
 * @param {Array<{ slug: string, title?: string, excerpt?: string }>} articles
 */
export function linkJudgePrompt(topic, articles) {
  const list = articles
    .map((a) => `- ${a.slug}: ${String(a.title ?? "")}${a.excerpt ? ` — ${String(a.excerpt).slice(0, 240)}` : ""}`)
    .join("\n");
  return {
    system: LINK_JUDGE_SYSTEM,
    prompt: `Dossier: ${String(topic?.title ?? "")}\nAbout: ${String(topic?.blurb ?? "")}\n\nArticles:\n${list}`,
  };
}

/**
 * The slugs the judge explicitly accepted (about === true). Anything else —
 * no answer, a malformed one, a slug it was not asked about — is not linked.
 *
 * @param {unknown} json
 * @param {string[]} asked
 * @returns {Set<string>}
 */
export function readLinkJudgement(json, asked) {
  const allowed = new Set(asked);
  const list = /** @type {any} */ (json)?.articles;
  const out = new Set();
  if (!Array.isArray(list)) return out;
  for (const e of list) if (e?.about === true && allowed.has(String(e?.slug))) out.add(String(e.slug));
  return out;
}
