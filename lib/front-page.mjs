// Picks the homepage's front block (Kryesore: the lead, the stack beside it
// and the two-up below).
//
// getArticles() orders by featured, then engagement score, with no clock, so
// a day-old 9.0 outranked everything published this morning for as long as it
// stayed in the pool — the news bar above showed "1h" while every Kryesore card
// said "1d". Here each hour of age costs FRESHNESS_DECAY points. Scores sit
// between ~6.2 and ~9.0 (p10–p99 of the committed batches), so a full day costs
// well over the whole spread: a 9.0 keeps the lead over a fresh 7.0 for about
// ten hours, then gives way.
export const FRESHNESS_DECAY = 0.2;

// An article with no usable date is treated as two days old rather than new.
const UNDATED_AGE_HOURS = 48;

export function frontRank(article, now = Date.now()) {
  const anchor = article?.publishedAt ?? article?.createdAt;
  const time = anchor ? new Date(anchor).getTime() : NaN;
  const ageHours = Number.isFinite(time)
    ? Math.max(0, (now - time) / 3_600_000)
    : UNDATED_AGE_HOURS;
  return (article?.engagementScore ?? 0) - ageHours * FRESHNESS_DECAY;
}

// Stems too common in this feed to say two titles share a story.
const STOP_STEMS = new Set([
  "është", "kundër", "lidhur", "gjatë", "duhet", "thotë", "sipas", "pranë",
  "kosovë", "kosova", "kosove", "shqipë", "shqipt", "qeveri", "prisht",
]);

/**
 * The words that identify a title's story, cut to six-letter stems so
 * "president" and "presidentit" meet. The leading "Kosovë:" / "Tiranë:" names
 * the place, not the story, and nearly every title has one, so it is dropped.
 * Splitting is Unicode-aware: a plain \W split cuts "kërkon" at the ë.
 */
export function storyStems(title) {
  const key = String(title ?? "");
  const cached = STEM_CACHE.get(key);
  if (cached) return cached;
  const stems = computeStems(key);
  // Bounded: the homepage compares a few hundred titles per render, and a
  // long-lived server should not keep every headline it has ever seen.
  if (STEM_CACHE.size >= 2000) STEM_CACHE.clear();
  STEM_CACHE.set(key, stems);
  return stems;
}

// Every section on the homepage checks each candidate against every story
// already shown, so the same title is split thousands of times per render.
const STEM_CACHE = new Map();

function computeStems(title) {
  const body = String(title ?? "").replace(/^[^:]{1,24}:\s*/u, "");
  const stems = new Set();
  for (const word of body.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word.length < 5) continue;
    const stem = word.slice(0, 6);
    if (!STOP_STEMS.has(stem)) stems.add(stem);
  }
  return stems;
}

/**
 * Two titles are one story when they share at least two stems and those make
 * up a good part of the shorter title — "Hargreaves shpreson për president…"
 * and "Hargreaves uron Kurtin, kërkon zgjedhjen e presidentit" share
 * hargre + presid out of four.
 */
export function isSameStory(titleA, titleB) {
  const a = storyStems(titleA);
  const b = storyStems(titleB);
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const stem of a) if (b.has(stem)) shared++;
  return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.4;
}

/**
 * Up to `count` articles, freshest-weighted first, with no story twice.
 * Order of the result is the order of the block: [lead, ...stack, ...secondary].
 */
export function pickFrontPage(pool, count, now = Date.now()) {
  const seen = new Set();
  const ranked = [];
  for (const article of pool ?? []) {
    if (!article?.id || seen.has(article.id)) continue;
    seen.add(article.id);
    ranked.push({ article, rank: frontRank(article, now) });
  }
  ranked.sort((x, y) => y.rank - x.rank);

  const picked = [];
  for (const { article } of ranked) {
    if (picked.some((p) => isSameStory(p.title, article.title))) continue;
    picked.push(article);
    if (picked.length >= count) break;
  }
  return picked;
}
