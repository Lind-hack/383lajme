// How the reader has arranged and dressed their own paper ("Rregullo gazetën").
//
// Device-only, like everything else in Për ty: never synced (the account sync
// carries cities only) and never sent anywhere. Stored data may predate this
// shape or be hand-edited, so every read goes through normalizePrefs, which
// accepts anything and returns something safe to render.

export const PREFS_KEY = "383:paper";
export const PREFS_VERSION = 1;

export const STYLES = ["klasike", "moderne", "nate"];
export const ACCENTS = ["portokalli", "blu", "gjelber", "vjollce", "kuqe"];
export const LENGTHS = [5, 7, 10];
export const BOXES = ["brief", "city", "tregu", "numbers"];

/** A section key: a followed category, person or city (see lib/per-ty-rank.mjs). */
const SECTION_KEY = /^(cat|person|city):[^\s:][^:]{0,60}$/;
const MAX_KEYS = 60;

export function defaultPrefs() {
  return {
    v: PREFS_VERSION,
    style: "klasike",
    accent: "portokalli",
    length: 7,
    order: [],
    hidden: [],
    boxes: { brief: true, city: true, tregu: true, numbers: true },
  };
}

function keyList(raw) {
  const out = [];
  for (const value of Array.isArray(raw) ? raw : []) {
    if (typeof value === "string" && SECTION_KEY.test(value) && !out.includes(value)) out.push(value);
    if (out.length >= MAX_KEYS) break;
  }
  return out;
}

/** Coerce anything into valid prefs; unknown values fall back to the defaults. */
export function normalizePrefs(raw) {
  const base = defaultPrefs();
  if (!raw || typeof raw !== "object" || raw?.v !== PREFS_VERSION) return base;
  const boxes = { ...base.boxes };
  for (const box of BOXES) {
    if (typeof raw?.boxes?.[box] === "boolean") boxes[box] = raw.boxes[box];
  }
  return {
    v: PREFS_VERSION,
    style: STYLES.includes(raw?.style) ? raw.style : base.style,
    accent: ACCENTS.includes(raw?.accent) ? raw.accent : base.accent,
    length: LENGTHS.includes(raw?.length) ? raw.length : base.length,
    order: keyList(raw?.order),
    hidden: keyList(raw?.hidden),
    boxes,
  };
}

/**
 * The reader's sections in their chosen order: keys they placed come first, in
 * their order; anything followed but never placed keeps `fallback` order after
 * them. Keys no longer followed are dropped.
 *
 * @param {readonly string[]} order    prefs.order
 * @param {readonly string[]} fallback the default order of every followed key
 */
export function orderedKeys(order, fallback) {
  const followed = new Set(fallback ?? []);
  const placed = (order ?? []).filter((k) => followed.has(k));
  return [...placed, ...(fallback ?? []).filter((k) => !placed.includes(k))];
}

/** Move one key up (-1) or down (+1) within the full ordered list. */
export function moveKey(keys, key, step) {
  const list = [...(keys ?? [])];
  const at = list.indexOf(key);
  const to = at + step;
  if (at < 0 || to < 0 || to >= list.length) return list;
  [list[at], list[to]] = [list[to], list[at]];
  return list;
}

/** @param {Storage} [storage] */
export function readPrefs(storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    return normalizePrefs(JSON.parse(store?.getItem(PREFS_KEY) ?? "null"));
  } catch {
    return defaultPrefs();
  }
}

/** @returns {boolean} false when the browser refused the write */
export function writePrefs(prefs, storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    store.setItem(PREFS_KEY, JSON.stringify(normalizePrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}
