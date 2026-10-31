// "Gazeta jote e sotme": one edition per day, and what arrived since.
//
// Për ty used to rank the whole pool afresh on every visit, so a reader who
// came back saw the same handful of stories (a followed name outscored
// anything new) and a reader who opened one saw the list reshuffle. Now:
//
//   1. Once a Kosovo day (turning at 05:00, so a late-night reader is not handed
//      an empty paper at 00:30) the edition is built from the ranking and stored
//      on the device. Stories read before that moment are left out: yesterday's
//      reads never come back as today's news.
//   2. All day, the same edition in the same order, read ones included, so
//      "3 / 7 lexuar" fills and nothing moves under the reader's thumb.
//   3. Stories that arrive after the edition was built and match a follow come
//      in on top as "fresh" (newest first, at most FRESH_MAX): every visit has
//      something new when the newsroom wrote something for this reader.
//   4. Changing follows rebuilds today's edition at once.
//
// Device-only, like every other Për ty memory (lib/perty-visits).

import { isNewSince } from "./perty-visits.mjs";

export const DAILY_KEY = "383:perty-daily";
/** The paper's day turns at this Kosovo hour. */
export const DAY_TURNS_AT_HOUR = 5;
/** At most this many late arrivals above the edition. */
export const FRESH_MAX = 3;

const SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" of the paper in force at `now`, by the Kosovo clock. */
export function editionDay(now = Date.now()) {
  const shifted = new Date(now - DAY_TURNS_AT_HOUR * 3600_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/** What the edition was built for: the explicit follows, order-free. Learned taste does not count. */
export function followSignature(interests) {
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").sort() : []);
  return JSON.stringify([
    list(interests?.people),
    list(interests?.cities),
    list(interests?.categories),
    typeof interests?.home === "string" ? interests.home : null,
  ]);
}

/** The stored record (untrusted), or null. */
export function normalizeDaily(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== 1) return null;
  if (typeof raw.day !== "string" || !DAY.test(raw.day)) return null;
  if (typeof raw.sig !== "string") return null;
  if (typeof raw.at !== "string" || !Number.isFinite(Date.parse(raw.at))) return null;
  if (!Array.isArray(raw.slugs)) return null;
  const slugs = [];
  for (const s of raw.slugs) {
    if (typeof s === "string" && SLUG.test(s) && !slugs.includes(s)) slugs.push(s);
    if (slugs.length >= 20) break;
  }
  return { v: 1, day: raw.day, sig: raw.sig, at: raw.at, slugs };
}

/**
 * @template {{ article: { slug: string, publishedAt?: string }, kind: string }} I
 * @param {unknown} stored   the record from DAILY_KEY
 * @param {{
 *   day: string, signature: string, ranked: readonly I[], read: ReadonlySet<string>,
 *   now?: number, build: (candidates: I[]) => I[], freshMax?: number,
 * }} opts
 *   ranked: rankFeed() output, best first
 *   build:  picks the edition from candidates (lib/per-ty-edition buildEdition)
 * @returns {{ record: { v: 1, day: string, sig: string, at: string, slugs: string[] }, edition: I[], fresh: I[], rebuilt: boolean }}
 */
export function pickDaily(stored, opts) {
  const { day, signature, ranked, read, build } = opts;
  const now = opts.now ?? Date.now();
  const freshMax = opts.freshMax ?? FRESH_MAX;
  const bySlug = new Map();
  for (const item of ranked ?? []) {
    const slug = item?.article?.slug;
    if (slug && !bySlug.has(slug)) bySlug.set(slug, item);
  }

  const current = normalizeDaily(stored);
  // Kept as the very object passed in when nothing changed, so a caller can
  // skip writing storage.
  // An empty paper is not kept: whatever arrives later becomes the edition.
  const keep = current && current.day === day && current.sig === signature && current.slugs.length > 0;

  let record;
  let edition;
  if (keep) {
    record = stored;
    edition = current.slugs.map((s) => bySlug.get(s)).filter(Boolean);
  } else {
    const candidates = [...bySlug.values()].filter((i) => !read.has(i.article.slug));
    edition = build(candidates);
    record = { v: 1, day, sig: signature, at: new Date(now).toISOString(), slugs: edition.map((i) => i.article.slug) };
  }

  const builtAt = Date.parse(record.at);
  const inEdition = new Set(edition.map((i) => i.article.slug));
  const fresh = keep
    ? [...bySlug.values()]
        .filter(
          (i) =>
            !inEdition.has(i.article.slug) &&
            !read.has(i.article.slug) &&
            i.kind !== "top" &&
            i.kind !== "learned" &&
            Date.parse(i.article.publishedAt ?? "") > builtAt
        )
        .sort((a, b) => Date.parse(b.article.publishedAt ?? "") - Date.parse(a.article.publishedAt ?? ""))
        .slice(0, freshMax)
    : [];

  return { record, edition, fresh, rebuilt: !keep };
}

/** How many of these the reader has not read and that came out since their last visit. */
export function newForYou(items, since, read) {
  let n = 0;
  for (const item of items ?? []) {
    if (!item?.article || read.has(item.article.slug)) continue;
    if (isNewSince(item.article, since)) n += 1;
  }
  return n;
}

function store() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The stored edition record, raw (pickDaily cleans it). */
export function readDaily() {
  try {
    return JSON.parse(store()?.getItem(DAILY_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function writeDaily(record) {
  try {
    if (record) store()?.setItem(DAILY_KEY, JSON.stringify(record));
    else store()?.removeItem(DAILY_KEY);
  } catch {
    // No storage: the edition is rebuilt on every visit, as before.
  }
}
