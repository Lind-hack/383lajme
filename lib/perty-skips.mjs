// Stories the reader was shown and passed over.
//
// A click teaches the paper what the reader likes; never clicking teaches it
// too. A story counts as shown once it sat on screen for a second on the page
// the reader was looking at (app/per-ty/paper/newspaper.tsx). It is not judged
// then — the reader may still open it — but on their next day's paper: every
// story shown before today and never opened takes SKIP_PENALTY off the learned
// weight of the follow it was filed under.
//
// Only learned weight moves (lib/interests.mjs nudgeAffinity never goes below
// nothing), so a follow the reader picked stays followed however often they
// skip it; it just stops being helped along by reading.
//
// Device-only and bounded like the rest of Për ty. Pure, apart from the two
// storage helpers at the bottom.

export const SHOWN_KEY = "383:paper-shown";
/** About five stories passed over undo one full read (lib/reading-engagement FULL_WEIGHT). */
export const SKIP_PENALTY = 0.35;
const MAX_ITEMS = 80;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9-]{1,120}$/;
const KEY = /^(cat|person|city):.{1,80}$/;

export function normalizeShown(raw) {
  if (!raw || typeof raw !== "object" || !DATE.test(raw.date ?? "")) return null;
  const items = [];
  const seen = new Set();
  for (const item of Array.isArray(raw.items) ? raw.items : []) {
    if (!item || !SLUG.test(item.slug ?? "") || !KEY.test(item.key ?? "") || seen.has(item.slug)) continue;
    seen.add(item.slug);
    items.push({ slug: item.slug, key: item.key });
    if (items.length >= MAX_ITEMS) break;
  }
  return { date: raw.date, items };
}

/**
 * Add stories shown today. A key that is not a follow ("top", "learned") is
 * not a taste to learn about, so those stories are not logged.
 *
 * @param {unknown} log
 * @param {string} today   Kosovo date
 * @param {readonly { slug: string, key?: string }[]} items
 */
export function noteShown(log, today, items) {
  const current = normalizeShown(log);
  const base = current && current.date === today ? current.items : [];
  return normalizeShown({ date: today, items: [...base, ...(items ?? [])] }) ?? { date: today, items: [] };
}

/**
 * Settle an earlier day's log: what each follow loses for stories shown and
 * never opened. Today's log is left alone.
 *
 * @param {unknown} log
 * @param {Iterable<string>} readSlugs  every story the reader ever opened (perty-visits)
 * @param {string} today
 * @returns {{ penalties: Record<string, number>, log: { date: string, items: { slug: string, key: string }[] } | null }}
 */
export function settleSkips(log, readSlugs, today) {
  const current = normalizeShown(log);
  if (!current || current.date >= today) return { penalties: {}, log: current };
  const read = new Set(readSlugs ?? []);
  const penalties = {};
  for (const item of current.items) {
    if (read.has(item.slug)) continue;
    penalties[item.key] = (penalties[item.key] ?? 0) + SKIP_PENALTY;
  }
  return { penalties, log: null };
}

/** @param {Storage} [storage] */
export function readShown(storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    return normalizeShown(JSON.parse(store?.getItem(SHOWN_KEY) ?? "null"));
  } catch {
    return null;
  }
}

/** @param {Storage} [storage] */
export function writeShown(log, storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    if (log) store.setItem(SHOWN_KEY, JSON.stringify(normalizeShown(log)));
    else store.removeItem(SHOWN_KEY);
    return true;
  } catch {
    return false;
  }
}
