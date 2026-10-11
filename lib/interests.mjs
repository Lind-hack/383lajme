// The reader's chosen topics, stored on their own device.
//
// "Për ty" is guest-first by design: picking interests and seeing the result
// never requires an account. Signing in later syncs the same choices across
// devices — it is not the price of entry. This mirrors how `bookmarks` already
// works in components/article-sidebar.tsx, so the site has one answer to
// "guest or account", not two.
//
// Two rules this module exists to enforce:
//
//   1. Everything read back is treated as untrusted. It was written by an older
//      version of this code, or hand-edited, or is from a different site on the
//      same origin. A stored value never reaches a query unnormalised.
//   2. Every storage call is wrapped. Safari in private mode throws on setItem,
//      and a reader whose browser refuses storage must still get a working page.

import {
  NAV_CATEGORIES,
  normalizeCategory,
  categoryQueryValues,
} from "./category-map.ts";
import { isPersonId } from "./people.mjs";
import { isCityId } from "./cities.mjs";

export const INTERESTS_KEY = "383:interests";

/** Bumped when the stored shape changes. Unknown versions are discarded, not
 * guessed at — a wrong migration is worse than a clean default. */
export const INTERESTS_VERSION = 1;

const VALID_CATEGORIES = new Set(NAV_CATEGORIES.map((c) => c.label));

function foldLabel(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// normalizeCategory() never fails — it answers DEFAULT_CATEGORY ("Kosovë") for
// anything it does not recognise. That is right when labelling an article and
// wrong when validating a reader's stored choice: without this gate, a junk or
// hand-edited value silently becomes a real interest in Kosovë, and the reader
// gets a feed they never asked for. So membership is checked BEFORE normalising.
//
// The accepted set is every canonical label plus every alias that resolves to
// one, taken from categoryQueryValues so it cannot drift from the map itself.
const ACCEPTED_CATEGORY_FORMS = new Set(
  NAV_CATEGORIES.flatMap((c) => categoryQueryValues(c.label)).map(foldLabel)
);

function toValidCategory(value) {
  if (typeof value !== "string") return null;
  if (!ACCEPTED_CATEGORY_FORMS.has(foldLabel(value))) return null;
  const label = normalizeCategory(value);
  return VALID_CATEGORIES.has(label) ? label : null;
}

function emptyInterests() {
  return {
    v: INTERESTS_VERSION,
    categories: [],
    topics: [],
    people: [],
    cities: [],
    home: null,
    affinity: {},
    updatedAt: null,
  };
}

/** Keep the entries of `list` that pass `valid`, once each, in order. */
function uniqueValid(list, valid) {
  const out = [];
  for (const value of Array.isArray(list) ? list : []) {
    if (valid(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

// ── Learned affinity ────────────────────────────────────────────────────────
// What the reader opens nudges the feed. It lives on the device only, decays so
// last month's binge does not define this week, and is capped so the stored
// object cannot grow without bound.

/** A read counts half as much after this long. */
export const AFFINITY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
const AFFINITY_MAX_KEYS = 50;
const AFFINITY_MAX_WEIGHT = 5;
const AFFINITY_KEY = /^(cat|person|city):.{1,80}$/;

/** A stored weight, decayed to `now`. */
export function decayedWeight(entry, now = Date.now()) {
  const w = Number(entry?.w);
  const t = Date.parse(entry?.t ?? "");
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(t)) return 0;
  const age = Math.max(0, now - t);
  return w * Math.pow(0.5, age / AFFINITY_HALF_LIFE_MS);
}

/** Bounds for the optional tallies behind "lexove 4 lajme, 12 min" (see readingStats). */
const MAX_SECONDS = 50 * 3600;
const MAX_READS = 500;

function normalizeAffinity(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entries = [];
  for (const [key, entry] of Object.entries(raw)) {
    if (!AFFINITY_KEY.test(key)) continue;
    const w = Number(entry?.w);
    const t = typeof entry?.t === "string" && Number.isFinite(Date.parse(entry.t)) ? entry.t : null;
    if (!Number.isFinite(w) || w <= 0 || !t) continue;
    const out = { w: Math.min(w, AFFINITY_MAX_WEIGHT), t };
    // Engaged seconds and real reads, decayed like the weight. Older stored maps
    // have neither; they simply start counting from now.
    const s = Number(entry?.s);
    const n = Number(entry?.n);
    if (Number.isFinite(s) && s > 0) out.s = Math.min(s, MAX_SECONDS);
    if (Number.isFinite(n) && n > 0) out.n = Math.min(n, MAX_READS);
    entries.push([key, out]);
  }
  entries.sort((a, b) => b[1].w - a[1].w);
  return Object.fromEntries(entries.slice(0, AFFINITY_MAX_KEYS));
}

/** The decay factor from a stored stamp to `now`. */
function decayFactor(entry, now) {
  const t = Date.parse(entry?.t ?? "");
  if (!Number.isFinite(t)) return 0;
  return Math.pow(0.5, Math.max(0, now - t) / AFFINITY_HALF_LIFE_MS);
}

/**
 * What the reader recently gave one key: decayed engaged minutes and real
 * reads, for the plain "why this is here" line. Zeros when nothing is known.
 *
 * @param {unknown} affinity
 * @param {string} key
 * @returns {{ minutes: number, reads: number, weight: number }}
 */
export function readingStats(affinity, key, now = Date.now()) {
  const entry = normalizeAffinity(affinity)[key];
  if (!entry) return { minutes: 0, reads: 0, weight: 0 };
  const f = decayFactor(entry, now);
  return { minutes: ((entry.s ?? 0) * f) / 60, reads: (entry.n ?? 0) * f, weight: entry.w * f };
}

/**
 * "Më shumë si kjo" / "Më pak si kjo": move one key's learned weight by
 * `delta`. Down to nothing, never below — a key the reader explicitly follows
 * stays followed; "less" only stops reading from adding to it.
 *
 * @param {unknown} affinity
 * @param {string} key
 * @param {number} delta
 */
export function nudgeAffinity(affinity, key, delta, now = Date.now()) {
  const current = normalizeAffinity(affinity);
  if (typeof key !== "string" || !AFFINITY_KEY.test(key) || !Number.isFinite(delta)) return current;
  const entry = current[key];
  const f = entry ? decayFactor(entry, now) : 0;
  const w = (entry ? entry.w * f : 0) + delta;
  const next = { ...current };
  if (w < 0.05) delete next[key];
  else next[key] = { ...entry, w: Math.min(w, AFFINITY_MAX_WEIGHT), t: new Date(now).toISOString(), ...(entry?.s ? { s: entry.s * f } : {}), ...(entry?.n ? { n: entry.n * f } : {}) };
  return normalizeAffinity(next);
}

/**
 * Fold one opened article into the affinity map.
 *
 * @param {object} affinity   the current map (untrusted; normalised here)
 * @param {string[]} keys     e.g. ["cat:Sport", "person:albin-kurti", "city:prizren"]
 * @param {number} [now]
 * @param {number} [weight]   1 for a real read; less for a lighter signal, such as
 *                            opening an article without staying
 */
export function recordRead(affinity, keys, now = Date.now(), weight = 1, extra = {}) {
  const current = normalizeAffinity(affinity);
  const stamp = new Date(now).toISOString();
  const next = {};
  for (const [key, entry] of Object.entries(current)) {
    const f = decayFactor(entry, now);
    const w = entry.w * f;
    if (w < 0.05) continue;
    next[key] = { w, t: stamp };
    if (entry.s) next[key].s = entry.s * f;
    if (entry.n) next[key].n = entry.n * f;
  }
  // `extra`: engaged seconds this visit added, and whether it just became a real read.
  const seconds = Number.isFinite(extra?.seconds) && extra.seconds > 0 ? extra.seconds : 0;
  const reads = extra?.read ? 1 : 0;
  for (const key of Array.isArray(keys) ? keys : []) {
    if (typeof key !== "string" || !AFFINITY_KEY.test(key)) continue;
    // 0 is allowed: a flush that only adds engaged seconds to a story already counted.
    const w = (next[key]?.w ?? 0) + (Number.isFinite(weight) && weight >= 0 ? weight : 1);
    next[key] = { ...next[key], w: Math.min(w, AFFINITY_MAX_WEIGHT), t: stamp };
    if (seconds) next[key].s = (next[key].s ?? 0) + seconds;
    if (reads) next[key].n = (next[key].n ?? 0) + reads;
  }
  return normalizeAffinity(next);
}

/**
 * Coerce anything at all into a valid interests object.
 * Accepts junk; returns something safe to query with.
 */
export function normalizeInterests(raw) {
  if (!raw || typeof raw !== "object") return emptyInterests();
  if (raw.v !== INTERESTS_VERSION) return emptyInterests();

  const categories = [];
  for (const value of Array.isArray(raw.categories) ? raw.categories : []) {
    // Retired labels (Politikë, Siguri, Shoqëri…) fold onto their live category,
    // so a selection saved before a category was retired still works. Anything
    // the map does not know is dropped.
    const label = toValidCategory(value);
    if (label && !categories.includes(label)) categories.push(label);
  }

  const topics = uniqueValid(raw.topics, (v) => typeof v === "string" && v !== "");
  // People and cities are checked against the lists that define them, so a
  // name removed from lib/people.mjs stops matching instead of lingering.
  const people = uniqueValid(raw.people, isPersonId);
  const cities = uniqueValid(raw.cities, isCityId);
  // The reader's own city. Stored data from before it existed has none. It is
  // always one of `cities` too: account sync carries `cities` only, so another
  // device still gets the city, just not which one is home.
  const home = isCityId(raw.home) ? raw.home : null;
  if (home && !cities.includes(home)) cities.unshift(home);

  return {
    v: INTERESTS_VERSION,
    categories,
    topics,
    people,
    cities,
    home,
    affinity: normalizeAffinity(raw.affinity),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read the reader's interests. Always returns a usable object. */
export function readInterests(storage) {
  const store = resolveStorage(storage);
  if (!store) return emptyInterests();
  try {
    const raw = store.getItem(INTERESTS_KEY);
    if (!raw) return emptyInterests();
    return normalizeInterests(JSON.parse(raw));
  } catch {
    // Malformed JSON, a quota error, or storage disabled entirely. A reader
    // with broken storage gets the default, never a crash.
    return emptyInterests();
  }
}

/** Persist interests. Returns false when storage refused the write. */
export function writeInterests(interests, storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  const next = {
    ...normalizeInterests({ ...interests, v: INTERESTS_VERSION }),
    updatedAt: new Date().toISOString(),
  };
  try {
    store.setItem(INTERESTS_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/** Add or remove one category, returning a new array. */
export function toggleCategory(categories, rawLabel) {
  const label = toValidCategory(rawLabel);
  const current = Array.isArray(categories) ? categories : [];
  if (!label) return [...current];
  return current.includes(label)
    ? current.filter((c) => c !== label)
    : [...current, label];
}

/** Add or remove one value from a list, returning a new array. */
export function toggleValue(list, value) {
  const current = Array.isArray(list) ? list : [];
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
}

/**
 * Whether the reader has picked anything yet. Drives onboarding: learned
 * affinity alone does not count, because nobody chose it.
 */
export function hasInterests(interests) {
  const safe = normalizeInterests(interests);
  return (
    safe.categories.length > 0 ||
    safe.topics.length > 0 ||
    safe.people.length > 0 ||
    safe.cities.length > 0
  );
}

/**
 * Filter an in-memory pool of already-sanitised articles.
 *
 * Deliberately a plain `includes` on the category label. Every article has been
 * through sanitizeArticle() -> normalizeCategory(), so its category is already
 * one of the canonical labels. categoryQueryValues() is required when querying
 * the STORE, where legacy labels still exist on old rows — it is not needed
 * here, and using it would be a slower way to get the same answer.
 */
export function matchArticles(articles, interests, limit = 3) {
  const safe = normalizeInterests(interests);
  if (safe.categories.length === 0) return [];
  const wanted = new Set(safe.categories);
  const out = [];
  for (const article of articles ?? []) {
    if (out.length >= limit) break;
    if (article?.category && wanted.has(article.category)) out.push(article);
  }
  return out;
}
