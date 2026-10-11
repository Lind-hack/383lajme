// The clay cover plates of Për ty: the day's biggest stories, their own photo
// restyled as a handmade claymation scene, for the front page of every
// reader's paper whose lead they are (app/per-ty/paper/pages.tsx FrontSheet).
//
// Art is made per story, never per reader: a dozen or so a day covers the
// leads of almost every paper, and nothing about a reader is ever sent to
// make it. lib/cover-art-server.ts runs it from the two-minute heartbeat
// through Cloudflare Workers AI (FLUX.2 klein, ~100 neurons an image, well
// inside the free 10,000 a day) and keeps the results in a public bucket with
// one small index.json beside them.
//
// Editorial rules, decided 2026-10-03 and held by the tests:
//
//   • public figures may be shown, affectionately — the page labels every
//     plate "Ilustrim me AI";
//   • a story about death, violence, crime or disaster never gets people in
//     clay: its plate is a quiet symbolic scene of the place instead;
//   • only a story with its own photo is restyled; nothing is invented from
//     a headline.
//
// Pure. The word list for sombre stories errs wide on purpose: a court or
// arrest story losing its clay people costs nothing; a victim drawn in clay
// would cost a lot.

export const COVER_BUCKET = "perty-cover-art";
export const INDEX_PATH = "index.json";
export const INDEX_VERSION = 1;
/** Plates made per Kosovo day, at most. */
export const MAX_PER_DAY = 16;
/** Plates made per heartbeat run (each takes ~7 s). */
export const PER_RUN = 2;
/** Between runs that make anything. */
export const RUN_EVERY_MS = 10 * 60 * 1000;
/** Only stories this fresh get a plate. */
export const FRESH_MS = 30 * 60 * 60 * 1000;
/** Plates older than this drop out of the index (the files expire with the bucket's lifecycle). */
const KEEP_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 400;

const SLUG = /^[a-z0-9-]{1,120}$/;
const PATH = /^\d{4}-\d{2}-\d{2}\/[a-z0-9-]{1,120}\.webp$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Words that make a story one whose people must not be turned into clay. */
const SOMBRE = [
  "vdek", "vdiq", "vrasje", "vra", "vrau", "vrare", "plagos", "aksident", "përplas", "sulm", "luft", "bomb",
  "terror", "dhun", "abuz", "përdhun", "vetëvras", "trup i pajetë", "zhduk", "rrëmbim", "arrest", "burg",
  "tërmet", "përmbytje", "zjarr", "shpërthim", "viktim", "tragjedi", "fatkeqësi", "funeral", "varrim", "kufom",
  "therje", "thikë", "armë", "gjykat", "akuz",
];

export function emptyIndex() {
  return { v: INDEX_VERSION, updatedAt: null, day: null, made: 0, items: {} };
}

/**
 * Coerce a stored index into a valid one, dropping old and malformed entries.
 * @param {unknown} raw
 */
export function normalizeIndex(raw, now = Date.now()) {
  const base = emptyIndex();
  if (!raw || typeof raw !== "object" || raw.v !== INDEX_VERSION) return base;
  const items = [];
  for (const [slug, entry] of Object.entries(raw.items ?? {})) {
    const at = Date.parse(entry?.at ?? "");
    if (!SLUG.test(slug) || !PATH.test(entry?.path ?? "") || !Number.isFinite(at) || now - at > KEEP_MS) continue;
    items.push([slug, { path: entry.path, at: entry.at }]);
  }
  items.sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at));
  const updatedAt = typeof raw.updatedAt === "string" && Number.isFinite(Date.parse(raw.updatedAt)) ? raw.updatedAt : null;
  const day = typeof raw.day === "string" && DATE.test(raw.day) ? raw.day : null;
  const made = Number.isInteger(raw.made) && raw.made > 0 ? raw.made : 0;
  return { v: INDEX_VERSION, updatedAt, day, made, items: Object.fromEntries(items.slice(0, MAX_ITEMS)) };
}

/** True when a story is one whose people must not be drawn. */
export function isSombre(article) {
  const text = `${article?.title ?? ""} ${article?.excerpt ?? ""}`.toLocaleLowerCase("sq");
  return SOMBRE.some((w) => text.includes(w));
}

/** The instruction for restyling the story's own photo (input image 0). */
export function coverPrompt(article) {
  const finish =
    "Clean smooth surfaces with no stains, no red marks, no smears. Warm soft studio light, shallow depth of field, rich but natural colours. " +
    "No text, no letters, no logos, no watermarks.";
  if (isSombre(article)) {
    return (
      "Turn image 0 into a quiet handmade claymation diorama of the place only: the buildings, street or landscape sculpted from plasticine. " +
      "Remove every person; no faces, no figures, no bodies, no weapons, no vehicles in wreckage. Calm, respectful, symbolic, a little melancholic. " +
      finish
    );
  }
  return (
    "Restyle image 0 as a handmade claymation scene: the same people, poses, clothes and setting, sculpted from plasticine with soft rounded features " +
    "and faint fingerprints. Keep every person recognisable and dignified; affectionate, never mocking or grotesque. " +
    finish
  );
}

/**
 * The stories to make plates for now, best first.
 *
 * @template {{ slug?: string, imageUrl?: string, publishedAt?: string, engagementScore?: number }} A
 * @param {readonly A[]} articles   the day's top stories, any order
 * @param {unknown} index           the stored index
 * @param {{ now?: number, max?: number }} [opts]
 * @returns {A[]}
 */
export function pickCoverStories(articles, index, opts = {}) {
  const now = opts.now ?? Date.now();
  const max = opts.max ?? PER_RUN;
  const done = normalizeIndex(index, now).items;
  return (articles ?? [])
    .filter((a) => {
      const t = Date.parse(a?.publishedAt ?? "");
      return (
        a?.slug && SLUG.test(a.slug) && !done[a.slug] &&
        typeof a.imageUrl === "string" && /^https:\/\//.test(a.imageUrl) &&
        Number.isFinite(t) && now - t <= FRESH_MS
      );
    })
    .sort((a, b) => (Number(b.engagementScore) || 0) - (Number(a.engagementScore) || 0))
    .slice(0, max);
}

/**
 * Whether this run may make plates, and how many: not more often than
 * RUN_EVERY_MS, never past MAX_PER_DAY for the Kosovo day.
 */
export function runBudget(index, today, now = Date.now()) {
  const clean = normalizeIndex(index, now);
  const last = clean.updatedAt ? Date.parse(clean.updatedAt) : 0;
  if (now - last < RUN_EVERY_MS) return 0;
  const made = clean.day === today ? clean.made : 0;
  return Math.max(0, Math.min(PER_RUN, MAX_PER_DAY - made));
}

/** Record plates made in this run; also stamps the run, made or not. */
export function withPlates(index, today, plates, now = Date.now()) {
  const clean = normalizeIndex(index, now);
  const stamp = new Date(now).toISOString();
  const items = { ...clean.items };
  for (const { slug, path } of plates ?? []) {
    if (SLUG.test(slug ?? "") && PATH.test(path ?? "")) items[slug] = { path, at: stamp };
  }
  const made = (clean.day === today ? clean.made : 0) + (plates ?? []).length;
  return normalizeIndex({ v: INDEX_VERSION, updatedAt: stamp, day: today, made, items }, now);
}

/** "2026-10-11/kurti-ne-bruksel.webp" */
export function platePath(today, slug) {
  return `${today}/${slug}.webp`;
}

/**
 * slug → public URL for every plate in the index.
 * @param {unknown} index
 * @param {string} publicBase  ".../storage/v1/object/public/perty-cover-art"
 */
export function coverArtMap(index, publicBase, now = Date.now()) {
  const out = {};
  if (!publicBase) return out;
  for (const [slug, entry] of Object.entries(normalizeIndex(index, now).items)) out[slug] = `${publicBase}/${entry.path}`;
  return out;
}
