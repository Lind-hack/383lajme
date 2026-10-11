// How much one visit to an article says about the reader's taste.
//
// The article page used to count a click as half a read and ten seconds as a
// whole one, so eleven seconds and eleven minutes weighed the same. This turns
// what the page actually measured into one weight:
//
//   • engaged time: seconds the tab was visible and the reader had scrolled,
//     touched or moved within the last half minute (an open tab on the table
//     does not count — components/reading-affinity.tsx measures it);
//   • depth: how far down the story they got, 0..1;
//   • the story's length, so a two-minute read of a short story counts as
//     finishing it and two minutes on a long one as a skim.
//
// Promises, held by the tests:
//
//   1. Opening a story always counts a little (OPEN_WEIGHT), bouncing never
//      counts more than that.
//   2. More engaged time or more depth never gives less weight.
//   3. A full read lands at FULL_WEIGHT, and nothing goes above it.
//   4. Everything read back is untrusted: junk in, a number in range out.
//
// Pure, no storage. The affinity map in lib/interests.mjs stores the result.

/** Words per minute for Albanian news prose on a phone. */
export const READ_WPM = 200;
/** A tap that bounced: still a click on something the reader chose to open. */
export const OPEN_WEIGHT = 0.25;
/** Read to the end. Above lib/perty-learned PICK_MIN, so one real read can make a pick. */
export const FULL_WEIGHT = 1.8;
/** Below this many engaged seconds, a visit is a bounce whatever the depth says. */
export const BOUNCE_S = 8;
/** Counted as a real read for the ledger and Dardani's "Ta bëra gazetën". */
export const REAL_READ_S = 10;
/** Nobody needs more than this for one story; it also bounds a tab left scrolling. */
const MAX_ENGAGED_S = 30 * 60;
/** A story with no measurable body is read like a short one. */
const MIN_WORDS = 120;

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Seconds a reader needs for `words` words. */
export function expectedSeconds(words) {
  const w = Number.isFinite(words) && words > 0 ? words : MIN_WORDS;
  return (Math.max(w, MIN_WORDS) / READ_WPM) * 60;
}

/**
 * The weight one visit adds to every key the story carries (its topic, the
 * people and towns it names).
 *
 * @param {{ engagedS?: number, depth?: number, words?: number }} visit
 * @returns {number} between OPEN_WEIGHT and FULL_WEIGHT
 */
export function visitWeight(visit) {
  const engaged = Math.min(MAX_ENGAGED_S, Math.max(0, Number(visit?.engagedS) || 0));
  if (engaged < BOUNCE_S) return OPEN_WEIGHT;
  const time = clamp01(engaged / expectedSeconds(Number(visit?.words)));
  const depth = clamp01(Number(visit?.depth));
  // Time says more than depth: a fast scroll to the bottom is not a read.
  const quality = clamp01(0.65 * time + 0.35 * depth);
  return OPEN_WEIGHT + (FULL_WEIGHT - OPEN_WEIGHT) * quality;
}

/**
 * The tracker flushes more than once (tab hidden, then closed); each flush adds
 * only what the visit gained since the last one, so nothing counts twice.
 *
 * @param {number} credited  weight already given for this visit
 * @param {number} total     visitWeight() now
 */
export function weightToAdd(credited, total) {
  const c = Number.isFinite(credited) && credited > 0 ? credited : 0;
  const t = Number.isFinite(total) && total > 0 ? total : 0;
  return Math.max(0, t - c);
}

/** Words in a block of article text, for visitWeight. */
export function countWords(text) {
  if (typeof text !== "string") return 0;
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
