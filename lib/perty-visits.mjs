// What "Për ty" remembers between visits, on the device only:
//
//   - when the reader was last here, so the feed can say "7 të reja që nga
//     vizita e fundit" and mark those stories;
//   - which stories they have opened, so a story already read sinks below the
//     ones they have not seen.
//
// Both are read back as untrusted (older code, hand edits, another site on the
// same origin) and both are bounded, so neither can grow without limit.

export const VISIT_KEY = "383:perty-visit";
export const READ_KEY = "383:perty-read";

/** Coming back within this long is the same visit, not a new one. */
export const SAME_VISIT_MS = 30 * 60 * 1000;
const MAX_READ = 300;
const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/i;

function validTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

/**
 * Fold this visit into the stored record (untrusted) and return the new one.
 *
 * `since` is the start of the previous visit — the line "new" is measured
 * from. A reload or a return within SAME_VISIT_MS keeps the same line, so the
 * "new" marks do not vanish because the reader opened a story and came back.
 *
 * @returns {{ last: string, since: string | null }}
 */
export function nextVisit(stored, now = Date.now()) {
  const last = validTime(stored?.last);
  const since = validTime(stored?.since);
  const stamp = new Date(now).toISOString();
  if (last && now - Date.parse(last) < SAME_VISIT_MS && now >= Date.parse(last)) {
    return { last: stamp, since };
  }
  return { last: stamp, since: last };
}

/** Published after the previous visit began. Nothing is new on a first visit. */
export function isNewSince(article, since) {
  if (!since) return false;
  const t = Date.parse(article?.publishedAt ?? "");
  return Number.isFinite(t) && t > Date.parse(since);
}

/** The stored read list (untrusted), cleaned: valid slugs, once each, bounded. */
export function normalizeRead(raw) {
  const out = [];
  for (const slug of Array.isArray(raw) ? raw : []) {
    if (typeof slug === "string" && SLUG.test(slug) && !out.includes(slug)) out.push(slug);
    if (out.length >= MAX_READ) break;
  }
  return out;
}

/** Record one opened story, newest first. */
export function markRead(raw, slug) {
  const list = normalizeRead(raw);
  if (typeof slug !== "string" || !SLUG.test(slug)) return list;
  return [slug, ...list.filter((s) => s !== slug)].slice(0, MAX_READ);
}

function store() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readJSON(key) {
  try {
    return JSON.parse(store()?.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage refused: the feed still works, it just forgets between visits.
  }
}

/** Count this visit and return the line "new" is measured from. */
export function recordVisit(now = Date.now()) {
  const next = nextVisit(readJSON(VISIT_KEY), now);
  writeJSON(VISIT_KEY, next);
  return next.since;
}

/** The slugs this device has opened. */
export function readSlugs() {
  return normalizeRead(readJSON(READ_KEY));
}

/** Remember that this device opened `slug`. */
export function rememberRead(slug) {
  writeJSON(READ_KEY, markRead(readJSON(READ_KEY), slug));
}

/** Forget both, alongside "Harro historikun e leximit". */
export function forgetVisits() {
  try {
    store()?.removeItem(READ_KEY);
    store()?.removeItem(VISIT_KEY);
  } catch {
    // Nothing to do; a reader whose storage is blocked has nothing stored.
  }
}
