import { isSameStory } from "./front-page.mjs";

/**
 * Which stories are actually about the same thing as the one being read.
 *
 * "Related" used to mean "the most-engaged stories in the same category, ever":
 * the page took the top fifty by engagement_score and kept the first three that
 * shared the section. A reader of a Kosovo–EU summit story was offered a
 * three-week-old Botë piece about the Channel because both were filed under
 * Botë. Nothing compared what the stories said.
 *
 * Here the comparison is the point. Two stories are related when they name the
 * same people, places and institutions, and when their headlines and standfirsts
 * share content words. Names weigh most: "Kurti" and "Bruksel" in both is a far
 * stronger signal than "takim" in both. Freshness breaks ties, because a reader
 * wants the latest on a subject, not the oldest. A story below the threshold is
 * dropped rather than padded in — an empty slot is honest, a wrong one is not.
 *
 * Pure and dependency-light so it runs per render on a few hundred cards and is
 * testable without a database.
 */

const NAME_WEIGHT = 3;
const TITLE_WEIGHT = 1.5;
const TEXT_WEIGHT = 1;
const CATEGORY_BONUS = 1;
const TOPIC_BONUS = 4;
/** Score floor; a match also needs a shared name or three shared headline words. */
export const MIN_RELATED_SCORE = 3;
const MIN_TITLE_STEMS_WITHOUT_NAME = 3;

// Albanian function words, newsroom filler, and the datelines nearly every
// headline opens with ("Kosovë:", "Prishtinë:") — they say where, not what.
const STOP = new Set(
  (
    "kosove kosoves kosova shqipe shqiperi shqiperise eshte jane kane kishte mund duhet sipas " +
    "pasi gjate ndaj edhe por qe nga per tek deri pas para mbi nen dhe ose nese kur ky kjo keto " +
    "ata ato tani sot dje neser vitit viti javes muajit thote tha deklaroi njofton njoftoi " +
    "lajme lajmet sipas rreth shume pak disa gjithe cdo tjeter tjera nje dy tre " +
    "prishtine prishtines tirane tiranes prizren peje gjakove mitrovice ferizaj gjilan shkup bote"
  ).split(" ")
);

const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/**
 * A name's stem with its case ending taken off first, so "Kurtit" meets
 * "Kurti" and "Ramës" meets "Rama" — six letters alone only joins declensions
 * of long words.
 */
const nameStem = (word) => {
  const w = fold(word);
  const bare = w.length > 4 ? w.replace(/(it|in|es|ut|un|en|ve|s|i|a|e|u)$/u, "") : w;
  return bare.slice(0, 6);
};

// Institutions every other headline opens with. Capitalised, but naming the
// office rather than the subject: two ministry stories are not related because
// both begin with "Ministria".
const GENERIC_NAME_STEMS = new Set(
  (
    "ministria ministri ministrja qeveria policia kuvendi komuna gjykata prokuroria presidenti " +
    "presidentja kryeministri opozita partia deputeti zyrtari autoritetet shteti"
  )
    .split(" ")
    .map(nameStem)
);

/** Content-word stems of a text, cut to six letters so long declensions meet. */
function stems(text) {
  const out = new Set();
  for (const word of fold(text).split(/[^\p{L}\p{N}]+/u)) {
    if (word.length < 5 || STOP.has(word)) continue;
    out.add(word.slice(0, 6));
  }
  return out;
}

/**
 * Proper-noun stems: capitalised words that do not open a sentence. An
 * all-caps or title-case line (over 80% capitalised) carries no such signal — every word is
 * capitalised — so it contributes no names at all.
 */
function names(text, initials) {
  const out = new Set();
  const all = String(text ?? "").split(/[^\p{L}\p{N}-]+/u).filter((w) => /\p{L}/u.test(w));
  const capitalised = all.filter((w) => /^\p{Lu}/u.test(w)).length;
  if (!all.length || !/\p{Ll}/u.test(String(text)) || (all.length >= 5 && capitalised / all.length > 0.8)) return out;

  for (const sentence of String(text).split(/(?<=[.!?:])\s+/u)) {
    const words = sentence.split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
    words.forEach((word, i) => {
      if (word.length < 3 || !/^\p{Lu}/u.test(word) || STOP.has(fold(word)) || GENERIC_NAME_STEMS.has(nameStem(word))) return;
      // Sentence case capitalises every opening word, so an opener is only a
      // possible name — confirmed when the other story uses it as one. The
      // split above treats a headline's "Kurti:" as its own opener.
      if (i === 0) {
        initials?.add(nameStem(word));
        return;
      }
      const stem = nameStem(word);
      if (stem.length >= 3) out.add(stem);
    });
    // An all-caps acronym opening a sentence is clearly a name (NATO, KFOR).
    if (words[0] && words[0].length >= 2 && words[0] === words[0].toUpperCase() && /\p{L}/u.test(words[0]) && !STOP.has(fold(words[0]))) {
      out.add(nameStem(words[0]));
    }
  }
  return out;
}

function profile(article) {
  const title = String(article?.title ?? "");
  const excerpt = String(article?.excerpt ?? "");
  const initials = new Set();
  return {
    names: new Set([...names(title, initials), ...names(excerpt, initials)]),
    initials,
    titleStems: stems(title),
    textStems: stems(`${title} ${excerpt}`),
  };
}

function overlap(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function ageDays(article, now) {
  const t = Date.parse(article?.publishedAt ?? "");
  return Number.isFinite(t) ? Math.max(0, (now - t) / 86_400_000) : 30;
}

/**
 * Score one candidate against the story being read.
 *
 * @param {{ names: Set<string>, initials: Set<string>, titleStems: Set<string>, textStems: Set<string> }} base
 * @param {object} candidate
 * @param {{ category?: string, topicSlugs?: Set<string>, now: number }} ctx
 */
function scoreCandidate(base, candidate, ctx) {
  const p = profile(candidate);
  // An opener counts as a name when the other story uses it as one, or opens
  // with it too — news headlines lead with their subject ("Kurti …", "Kurtit
  // …"). A shared opening verb still has to clear the score floor on its own.
  const isName = (s, other) => other.names.has(s) || other.initials.has(s);
  const confirmed = new Set([...base.names, ...[...base.initials].filter((s) => isName(s, p))]);
  const theirs = new Set([...p.names, ...[...p.initials].filter((s) => isName(s, base))]);
  const sharedNames = overlap(confirmed, theirs);
  const sharedTitle = overlap(base.titleStems, p.titleStems);
  // Text stems that are not already names or title stems, so one word is not
  // counted three times.
  let sharedText = 0;
  for (const s of base.textStems) {
    if (p.textStems.has(s) && !confirmed.has(s) && !(base.titleStems.has(s) && p.titleStems.has(s))) sharedText++;
  }
  // Shared vocabulary alone ("ministri", "buxhet") is how two unrelated
  // government stories end up paired; without a shared name it takes three
  // shared headline words to count as the same subject.
  if (sharedNames === 0 && sharedTitle < MIN_TITLE_STEMS_WITHOUT_NAME) return 0;
  let score = sharedNames * NAME_WEIGHT + sharedTitle * TITLE_WEIGHT + sharedText * TEXT_WEIGHT;
  if (score <= 0) return 0;
  if (ctx.topicSlugs?.has(candidate.slug)) score += TOPIC_BONUS;
  if (ctx.category && candidate.category === ctx.category) score += CATEGORY_BONUS;
  // Halves over two weeks: last week's story still beats a weak match today.
  return score / (1 + ageDays(candidate, ctx.now) / 14);
}

/**
 * Candidates ranked by how closely they relate to `article`, best first.
 *
 * @template {{ id: string, slug: string, title: string, excerpt?: string, category?: string, publishedAt?: string | null, imageUrl?: string | null }} A
 * @param {A} article The story being read.
 * @param {readonly A[]} pool Candidates; duplicates by id are ignored.
 * @param {{ limit?: number, exclude?: Iterable<string>, topicSlugs?: Iterable<string>, requireImage?: boolean, now?: number, minScore?: number }} [opts]
 * @returns {A[]}
 */
export function rankRelated(article, pool, opts = {}) {
  const now = opts.now ?? Date.now();
  const limit = opts.limit ?? 6;
  const minScore = opts.minScore ?? MIN_RELATED_SCORE;
  const exclude = new Set(opts.exclude ?? []);
  exclude.add(article.id);
  const ctx = { category: article.category, topicSlugs: new Set(opts.topicSlugs ?? []), now };
  const base = profile(article);

  const seen = new Set();
  const scored = [];
  for (const candidate of pool ?? []) {
    if (!candidate || seen.has(candidate.id) || exclude.has(candidate.id) || candidate.slug === article.slug) continue;
    seen.add(candidate.id);
    if (opts.requireImage && !candidate.imageUrl) continue;
    // A second write-up of the very story being read is a duplicate, not a
    // related story.
    if (isSameStory(article.title, candidate.title)) continue;
    // The decay is applied before the floor, so an old story needs a stronger
    // match than a fresh one to clear it.
    const score = scoreCandidate(base, candidate, ctx);
    if (score >= minScore) scored.push({ candidate, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const picked = [];
  for (const { candidate } of scored) {
    if (picked.length >= limit) break;
    if (picked.some((p) => isSameStory(p.title, candidate.title))) continue;
    picked.push(candidate);
  }
  return picked;
}

/**
 * How strongly `candidate` relates to `article`, on the same scale as
 * rankRelated but with no same-story exclusion and no floor — for matching
 * things that are not articles, such as a Tregu market question, where a
 * near-identical wording is the best match rather than a duplicate.
 */
export function relationScore(article, candidate, now = Date.now()) {
  return scoreCandidate(profile(article), candidate, { category: article.category, topicSlugs: new Set(), now });
}

/**
 * What a story is about, as the scorer sees it: its name stems (confirmed
 * names plus sentence openers) and its headline stems. Used to group stories
 * into standing subjects (lib/dosje-discover.mjs).
 */
export function storyKeys(article) {
  const p = profile(article);
  return { names: new Set([...p.names, ...p.initials]), titleStems: p.titleStems };
}
