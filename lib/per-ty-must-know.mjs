// "Duhet ta dish": the one or two stories of the day every reader should know,
// whatever they follow, at the top of Për ty above their own seven.
//
// Personal is the point of Për ty, but a reader who follows Sport and Prizren
// should still hear that the government fell. Two signals say a story is that
// big: the newsroom's weight (engagementScore), and how many pieces the
// newsroom wrote about the same story (isSameStory, lib/front-page.mjs). Age
// costs much less than on the homepage: the reader opening Për ty at 07:00
// needs last night's big story, which the homepage's hourly decay has already
// buried under this morning's small ones.
//
// Pure. Promises, held by the tests:
//
//   1. At most two, often one: the second only when it is nearly as big as the
//      first (within SECOND_WITHIN), so a quiet day says so.
//   2. Only the last day, only hard news: no Sport, no Showbiz.
//   3. Never two tellings of one story, and never one the reader has read.

import { isSameStory } from "./front-page.mjs";

export const MAX_MUST_KNOW = 2;
/** How fresh a must-know story must be. */
export const MUST_KNOW_MS = 24 * 60 * 60 * 1000;
/** Points of weight the second story may trail the first by. */
export const SECOND_WITHIN = 0.3;
/** Below this newsroom weight a story is not big enough to put in front of everyone. */
export const MIN_SCORE = 7;
/** Weight lost per hour of age: a whole day costs about half a point. */
export const DECAY_PER_HOUR = 0.02;
/** Weight gained for every other piece the newsroom wrote on the same story (at most COVER_MAX). */
export const PER_PIECE = 0.4;
const COVER_MAX = 3;
const SOFT = new Set(["Sport", "Showbiz"]);

const ageHours = (a, now) => (now - Date.parse(a?.publishedAt ?? "")) / 3_600_000;

/**
 * @template {{ slug: string, title: string, category?: string, publishedAt?: string, engagementScore?: number }} A
 * @param {readonly A[]} pool
 * @param {{ now?: number, read?: ReadonlySet<string> }} [opts]
 * @returns {A[]}
 */
export function mustKnow(pool, opts = {}) {
  const now = opts.now ?? Date.now();
  const read = opts.read ?? new Set();
  const fresh = (pool ?? []).filter((a) => {
    if (!a?.slug || !a.title || SOFT.has(a.category ?? "")) return false;
    const h = ageHours(a, now);
    return Number.isFinite(h) && h >= 0 && h * 3_600_000 <= MUST_KNOW_MS;
  });

  const ranked = fresh
    .filter((a) => !read.has(a.slug) && (Number(a.engagementScore) || 0) >= MIN_SCORE)
    .map((a) => {
      const pieces = fresh.filter((b) => b !== a && isSameStory(a.title, b.title)).length;
      const weight = Number(a.engagementScore) - ageHours(a, now) * DECAY_PER_HOUR + Math.min(pieces, COVER_MAX) * PER_PIECE;
      return { a, weight };
    })
    .sort((x, y) => y.weight - x.weight);

  const out = [];
  for (const { a, weight } of ranked) {
    if (out.length >= MAX_MUST_KNOW) break;
    if (out.length === 1 && weight < ranked[0].weight - SECOND_WITHIN) break;
    if (out.some((o) => isSameStory(o.title, a.title))) continue;
    out.push(a);
  }
  return out;
}
