/**
 * Which dossier an article belongs to — and, far more often, none.
 *
 * The old rule was a flat list of surface forms per topic, scored by counting
 * hits. It attached a full Kosovo KFOR dossier to any story containing the word
 * "nato", so a NATO exercise in Turkey qualified. The failure is structural: a
 * bag of words has no way to express "this term only counts alongside that one".
 *
 * Three layers replace it, in order of authority:
 *
 *   excludes  veto outright, whatever else matched
 *   anchors   are required; without one the topic cannot match at all
 *   signals   only support, and can never carry a match by themselves
 *
 * "kosove" is an anchor for KFOR. "nato" is a signal. "turqi" is an exclude.
 * A Turkish exercise then has a signal, no anchor and a veto, and scores
 * nothing — which is the whole point.
 *
 * Pure and synchronous. No database, no model, no network: this runs on every
 * article and has to be cheap and predictable.
 */

/** Comparison key: lowercase, Albanian diacritics folded, punctuation to space. */
export function fold(text) {
  return String(text ?? "")
    .toLowerCase()
    .replaceAll("ë", "e")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whole-word containment.
 *
 * The previous implementation kept hyphens inside the folded text, so the form
 * "kfor" did not match the headline word "KFOR-it" and matches were being made
 * by accident on other words. Hyphens now fold to spaces, which makes "KFOR-it"
 * two tokens and lets the bare form match the first of them.
 */
function hasTerm(haystack, term) {
  const t = fold(term);
  if (t.length < 3) return false;
  return ` ${haystack} `.includes(` ${t} `);
}

/** Title, excerpt and category — the fields a headline actually lives in. */
function haystackFor(article) {
  return fold(
    `${article?.title ?? ""} ${article?.excerpt ?? ""} ${article?.category ?? ""}`
  );
}

export const MIN_TOPIC_SCORE = 2;

/**
 * Score one article against one topic.
 *
 * Returns the score and the reasons behind it. The reasons are not decoration:
 * they are what makes a match defensible in the review queue instead of a
 * number nobody can argue with.
 */
export function scoreTopic(article, topic) {
  const hay = haystackFor(article);
  const reasons = { anchors: [], signals: [], excludes: [] };

  for (const term of topic?.excludes ?? []) {
    if (hasTerm(hay, term)) reasons.excludes.push(term);
  }
  if (reasons.excludes.length) return { score: 0, vetoed: true, reasons };

  for (const term of topic?.anchors ?? []) {
    if (hasTerm(hay, term)) reasons.anchors.push(term);
  }
  // No anchor, no match. A signal alone is never enough, however many there are.
  if (!reasons.anchors.length) return { score: 0, vetoed: false, reasons };

  for (const term of topic?.signals ?? []) {
    if (hasTerm(hay, term)) reasons.signals.push(term);
  }

  // An anchor is worth more than a signal because it is the thing that makes
  // the story about this subject rather than merely adjacent to it.
  const score = reasons.anchors.length * 2 + reasons.signals.length;
  return { score, vetoed: false, reasons };
}

/**
 * The best topic for an article, or null.
 *
 * Ties abstain. The old implementation used `score > best`, which silently
 * preferred whichever topic happened to be first in the array — a coin flip
 * dressed as a decision. When two subjects fit equally well the honest answer
 * is that the matcher does not know, and no dossier is shown.
 */
export function matchTopic(article, topics) {
  let best = null;
  let bestScore = 0;
  let tied = false;

  for (const topic of topics ?? []) {
    const { score, vetoed } = scoreTopic(article, topic);
    if (vetoed || score < MIN_TOPIC_SCORE) continue;
    if (score > bestScore) {
      best = topic;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && best && topic.slug !== best.slug) {
      tied = true;
    }
  }

  if (!best || tied) return null;
  const { reasons } = scoreTopic(article, best);
  return { topic: best, score: bestScore, reasons };
}

/**
 * Is this a standing subject, or just a story?
 *
 * A dossier is only warranted where there is history to explain, so a subject
 * has to keep coming back before it earns one: several articles, spread across
 * more than a single day's news cycle. One busy day is one story.
 */
export const MIN_SUBJECT_ARTICLES = 3;
export const MIN_SUBJECT_DAYS = 2;

export function isStandingSubject(matches) {
  const rows = (matches ?? []).filter((m) => m?.articleSlug && m?.publishedAt);
  if (rows.length < MIN_SUBJECT_ARTICLES) return false;
  const days = new Set(rows.map((r) => String(r.publishedAt).slice(0, 10)));
  return days.size >= MIN_SUBJECT_DAYS;
}
