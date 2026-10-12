// Readers' reactions to a single story in Për ty, and the live results shown
// after reacting (app/api/per-ty/reactions, table story_reactions).
//
// The vocabulary is Reagimi i Ditës's (lib/reagimi-data.ts REACTIONS), so a
// reader learns one set of five feelings across 383.
//
// Pure. Promises, held by the tests:
//
//   1. Only real slugs and known reactions get through; junk in, nothing out.
//   2. Shares are whole percentages that add up to exactly 100.
//   3. A story with too few reactions has no "top" to boast about.

export const STORY_REACTIONS = [
  { key: "zemerim", emoji: "😠", label: "Zemërim" },
  { key: "dyshim", emoji: "🤔", label: "Dyshim" },
  { key: "qesharake", emoji: "😂", label: "Qesharake" },
  { key: "dakord", emoji: "👍", label: "Dakord" },
  { key: "shprese", emoji: "✨", label: "Shpresë" },
];
const KEYS = STORY_REACTIONS.map((r) => r.key);

/** Most stories one request may ask about. */
export const MAX_SLUGS = 60;
/** Below this many reactions a story shows no "top reaction" line. */
export const TOP_MIN = 3;
/** Where the reader's own reactions are remembered on the device. */
export const MINE_KEY = "383:story-reactions";

const SLUG = /^[a-z0-9-]{1,160}$/;
const VOTER = /^[A-Za-z0-9_-]{8,64}$/;

export const isReaction = (v) => typeof v === "string" && KEYS.includes(v);
export const isStorySlug = (v) => typeof v === "string" && SLUG.test(v);
export const isVoter = (v) => typeof v === "string" && VOTER.test(v);

/** "a,b,c" or an array → distinct valid slugs, at most MAX_SLUGS. */
export function parseSlugs(input) {
  const list = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  return [...new Set(list.map((s) => String(s).trim()).filter(isStorySlug))].slice(0, MAX_SLUGS);
}

/** Rows {article_slug, reaction, n} → { slug: { reaction: count } }. */
export function talliesFrom(rows) {
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const slug = row?.article_slug;
    const n = Number(row?.n);
    if (!isStorySlug(slug) || !isReaction(row?.reaction) || !Number.isFinite(n) || n <= 0) continue;
    out[slug] ??= {};
    out[slug][row.reaction] = (out[slug][row.reaction] ?? 0) + Math.floor(n);
  }
  return out;
}

/**
 * Every reaction with its whole-percent share (largest remainder, so they sum
 * to 100), most chosen first; and the total.
 *
 * @param {Record<string, number> | null | undefined} tally
 */
export function shares(tally) {
  const counts = STORY_REACTIONS.map((r) => ({ ...r, n: Math.max(0, Math.floor(Number(tally?.[r.key]) || 0)) }));
  const total = counts.reduce((s, r) => s + r.n, 0);
  if (!total) return { total: 0, list: counts.map((r) => ({ ...r, pct: 0 })) };
  const raw = counts.map((r) => ({ ...r, exact: (r.n * 100) / total }));
  const floors = raw.map((r) => ({ ...r, pct: Math.floor(r.exact) }));
  let left = 100 - floors.reduce((s, r) => s + r.pct, 0);
  [...floors]
    .sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))
    .forEach((r) => {
      if (left > 0 && r.n > 0) {
        r.pct += 1;
        left -= 1;
      }
    });
  return { total, list: floors.sort((a, b) => b.n - a.n).map(({ exact: _exact, ...r }) => r) };
}

/** The line a story shows before the reader reacts, or null when too few have. */
export function topLine(tally) {
  const { total, list } = shares(tally);
  if (total < TOP_MIN) return null;
  return { ...list[0], total };
}

/** The reader's own reactions, from storage (untrusted). */
export function normalizeMine(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [slug, key] of Object.entries(raw)) if (isStorySlug(slug) && isReaction(key)) out[slug] = key;
  return out;
}
