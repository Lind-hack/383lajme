/**
 * Pyet 383 — retrieval.
 *
 * The rule this file exists to enforce: the bot answers from published 383
 * articles or it does not answer. There is no web grounding and no fallback to
 * model memory, and neither is prevented by asking the model nicely. It is
 * prevented structurally, in three gates, of which this file is the first:
 *
 *   1. Retrieval (here). Nothing relevant in the archive means the request is
 *      refused before any model is called. The refusal path costs no tokens
 *      and cannot hallucinate, because nothing generative runs on it.
 *   2. The prompt (lib/pyet-prompt.mjs) hands over numbered sources and
 *      forbids everything else.
 *   3. Citation validation (also there) rejects an answer that cites nothing,
 *      or cites a source index that was never sent.
 *
 * The failure this is built against is specific: a Kosovo story breaks an hour
 * ago, is not in the archive yet, and a reader asks about it. A bot that
 * improvises from training data on a developing story is worse than no bot.
 * The correct output is "Nuk kam artikull për këtë" and a pointer at
 * LAJMET E FUNDIT.
 */

import { fold, terms } from "./search-match.mjs";
// The same word-matching rule the site search uses, rather than a second one.
// It carries the Albanian declension handling — "Hëna" has to match "Hënës",
// which no prefix rule derives — and the regression cases that came with it
// ("rama" must not match "Ramallahut"). Two matchers would drift apart.
import { wordMatchesForm } from "./entities.mjs";

/** Short enough to be a slip, long enough to be an essay. */
export const MIN_QUESTION = 6;
export const MAX_QUESTION = 280;

/**
 * The score an article must reach to count as grounding.
 *
 * Calibrated so one title hit (12) clears it and one stray body mention (3)
 * does not. It is deliberately not strict: retrieval being slightly generous
 * is safe here because two further gates follow, and a false negative is a
 * refusal the reader feels while a false positive is caught downstream.
 */
export const RELEVANCE_FLOOR = 10;

const TITLE_TERM = 12;
const BODY_TERM = 3;
const ENTITY_BONUS = 20;

/** How much article text one source contributes to the prompt. */
export const SOURCE_CHARS = 1400;
/** How many sources the model is allowed to see. */
export const MAX_SOURCES = 6;
/**
 * How many it may see when the reader is on an article.
 *
 * Tighter on purpose. Chip questions carry generic words — "rezultat",
 * "qytetarët", "rëndësi" — that match widely and pull in pieces related only by
 * vocabulary. Five such neighbours around one relevant article is a prompt that
 * mostly does not answer the question, and the model reads that as grounds to
 * decline. The reader then gets "383 has nothing on this" while looking at the
 * article that does.
 */
export const PINNED_SOURCES = 3;

/**
 * Albanian function and question words.
 *
 * Without this "Pse ndodhi kjo?" retrieves on "pse", which appears in a large
 * share of the archive and would ground the answer in whatever happened to
 * rank first — the exact failure mode the citation gate is meant to catch, but
 * arriving with a plausible-looking article attached.
 *
 * Folded (no diacritics) because that is the form terms() produces.
 */
const STOPWORDS = new Set(
  (
    "a ai ajo ata ato as at ashtu behet bej ben beri bie by ca cdo cfare cila cilat cili cilet " +
    "csh deri dhe dic dicka disa do dot duke e edhe eshte fare ge gjate gjith gjitha gjithe " +
    "i ia ishin ishte ja jane je jam jo ju kam kane kemi keni kesaj keshtu ketij keto ketu ky " +
    "kjo kur kush ku ka kane keta kete kishte kishin la le lloj me mi mos mund na ne nga nje " +
    "njeri nuk pa par pas pasi per perse pra prej pse qe qofte sa se secili sepse si sic sipas " +
    "sh shume te ti tij tille tjeter tjera tu tyre u une vet vete ve vjen ishe do jete behen " +
    // Generic verbs. "Pse ndodhi kjo?" must retrieve on nothing, so that the
    // article being read is what answers it rather than whichever piece in the
    // archive happens to use the word "ndodhi" most often.
    // Words about the asking rather than the subject. A chip that says "sipas
    // artikullit" would otherwise retrieve every piece containing "artikull",
    // burying the pinned article among five unrelated ones and leaving the
    // model looking at mostly-irrelevant sources — at which point it declines,
    // and the reader is told 383 has nothing on the story they are reading.
    "artikull artikulli artikullit artikujt shkrim shkrimi lajm lajmi lajmin lajmet " +
    "tema temes temen pyetje pyetja pyetjen shkak shkaku shkakun arsye arsyeja " +
    "rendesi rendesia rendesie rendesine kuptim kuptimi kuptimin ndikim ndikimi " +
    "ndikimin arsye arsyen arsyet shkaqet temat pyetjet lajme artikuj shkrimet " +
    "ndodh ndodhi ndodhur ndodhin thote tha thane thone behet beri bere bejne del dolen " +
    "mori marre kishin quhet ka kane pati paten vazhdon vazhdoi ndersa por dhe apo " +
    "there what why how who when where the a an of to in on is are was were and or for"
  ).split(" "),
);

/** The question's content words: what it is actually about. */
export function contentTerms(question) {
  const seen = new Set();
  const out = [];
  for (const t of terms(question)) {
    // Single letters survive fold() from things like "e" and "i" and carry no
    // retrieval signal of their own.
    if (t.length < 3 || STOPWORDS.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Score one article against a question.
 *
 * Title matches dominate because a term in a headline is what the piece is
 * about, while the same term in the body may be a passing mention. Each
 * distinct term counts once: repeating a word in a long article says more
 * about the article's length than its relevance.
 */
export function scoreArticle(article, contentWords, mentionsEntity = false) {
  const title = fold(article.title ?? "");
  const body = fold(article.body ?? "");
  let score = 0;
  let matched = 0;

  for (const term of contentWords) {
    // Word-boundary-ish: a padded search so "rama" does not match "ramallah".
    // Prefix rather than exact, because Albanian declines heavily and the
    // archive will carry "Kosovës" where the reader typed "Kosove".
    const inTitle = hasTerm(title, term);
    const inBody = hasTerm(body, term);
    if (inTitle) {
      score += TITLE_TERM;
      matched += 1;
    } else if (inBody) {
      score += BODY_TERM;
      matched += 1;
    }
  }

  if (mentionsEntity) score += ENTITY_BONUS;
  return { score, matched };
}

/**
 * How far two forms of the same word may drift in length and still be one word.
 * This is what keeps "rama" away from "Ramallahut" (gap 6) and "Ramazani"
 * (gap 4) while letting "Kosovën" reach "Kosovës" (gap 0).
 */
const MAX_LEN_GAP = 3;
const MIN_SHARED = 4;

/**
 * Do these two share enough of a stem to be the same word declined?
 *
 * wordMatchesForm covers a query form that is a prefix of the text, plus one
 * stripped trailing vowel. That is not enough here, because search queries
 * arrive inflected too: a reader types "Kosovën" and the archive says
 * "Kosovës". Neither is a prefix of the other — they diverge at the last
 * letter — so a prefix rule in either direction finds nothing, and the whole
 * question is refused for having no sources.
 *
 * Comparing shared stems handles both sides being inflected. The length gap is
 * what keeps it honest: unrelated words that happen to start alike are almost
 * always of different lengths, and the requirement tightens as words get
 * longer.
 */
function sharesStem(word, term) {
  if (Math.abs(word.length - term.length) > MAX_LEN_GAP) return false;
  const shortest = Math.min(word.length, term.length);
  const need = Math.max(MIN_SHARED, shortest - 3);
  if (shortest < need) return false;
  let i = 0;
  while (i < shortest && word[i] === term[i]) i += 1;
  return i >= need;
}

/** Whole-word, declension-aware match inside folded text. */
function hasTerm(haystack, term) {
  if (!haystack || !term) return false;
  for (const word of haystack.split(" ")) {
    if (wordMatchesForm(word, term) || sharesStem(word, term)) return true;
  }
  return false;
}

/**
 * Choose the articles that will be allowed to answer.
 *
 * `pinnedSlug` is the article the reader is reading. It is always source #1
 * regardless of score: on an article page "Pse ndodhi kjo?" has no content
 * terms at all, and the thing it refers to is the page itself.
 */
export function retrieve(articles, question, opts = {}) {
  const { entityForms = null, mentionsFn = null, pinnedSlug = null, limit = MAX_SOURCES } = opts;
  const words = contentTerms(question);

  const pinned = pinnedSlug ? articles.find((a) => a.slug === pinnedSlug) : null;

  // "Pse ndodhi kjo?" names no subject, so there is nothing to widen to. Every
  // other article would arrive on a coincidence, and six coincidences read to
  // the model as a set of sources that mostly do not answer the question.
  if (pinned && words.length === 0) {
    return {
      sources: [{ article: pinned, score: Number.POSITIVE_INFINITY, pinned: true }],
      grounded: true,
      contentWords: words,
    };
  }

  const scored = [];
  for (const article of articles) {
    if (pinned && article.slug === pinned.slug) continue;
    const hasEntity = Boolean(entityForms && mentionsFn && mentionsFn(article, entityForms));
    const { score, matched } = scoreArticle(article, words, hasEntity);
    // A score with no matched term is an entity bonus alone, which is enough:
    // "Kush është Edi Rama?" has one content term that may appear nowhere in
    // the title, but the entity match is a stronger signal than either.
    if (score >= RELEVANCE_FLOOR && (matched > 0 || hasEntity)) {
      scored.push({ article, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || recency(b.article) - recency(a.article));

  const room = pinned ? Math.min(limit, PINNED_SOURCES) : limit;
  const sources = [];
  if (pinned) sources.push({ article: pinned, score: Number.POSITIVE_INFINITY, pinned: true });
  for (const hit of scored) {
    if (sources.length >= room) break;
    sources.push({ article: hit.article, score: hit.score, pinned: false });
  }

  return {
    sources,
    /** Whether anything at all can ground an answer. */
    grounded: sources.length > 0,
    contentWords: words,
  };
}

function recency(article) {
  const t = Date.parse(article.publishedAt ?? article.meta ?? "");
  return Number.isFinite(t) ? t : 0;
}

/** Trim an article to what the model needs without spending the budget on one. */
export function trimSource(article, chars = SOURCE_CHARS) {
  // Bodies are stored as HTML. Tags are noise the model has to read past, and
  // they spend the character budget on markup instead of reporting.
  const body = String(article.body ?? "")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (body.length <= chars) return body;
  // Cut on a sentence end where one is near, so the model is not handed a
  // fragment that stops mid-clause and invites it to complete the thought.
  const slice = body.slice(0, chars);
  const stop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  return (stop > chars * 0.6 ? slice.slice(0, stop + 1) : slice).trim() + " […]";
}

export function validQuestion(raw) {
  const q = String(raw ?? "").trim();
  if (q.length < MIN_QUESTION) return { ok: false, reason: "short" };
  if (q.length > MAX_QUESTION) return { ok: false, reason: "long" };
  return { ok: true, question: q };
}
