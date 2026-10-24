// "Gazeta jote ndjek": what the reader's paper follows, shown at the top of
// Për ty, and the few follows Dardani would add next.
//
// The paper felt generic because most readers follow broad topics (Kosovë,
// Sport) and nothing narrower, and what they followed was one small line at
// the bottom. This puts the follows where they can be seen and dropped in one
// tap, and offers narrower ones in two kinds, in this order:
//
//   1. "learned": what the reader keeps reading but never picked
//      (lib/perty-learned, the same picks the paper offer uses);
//   2. "trending": people and towns that are in several of the last day and a
//      half's stories, so a reader with no history still meets a name to follow.
//
// Pure, device-side and tested: nothing here leaves the browser.

import { normalizeInterests } from "./interests.mjs";
import { learnedPicks } from "./perty-learned.mjs";
import { keyLabel } from "./perty-why.mjs";

/** At most this many suggestions are offered at once. */
export const MAX_SUGGESTIONS = 4;
/** "In the news" means in at least this many stories... */
export const TRENDING_MIN = 3;
/** ...from roughly the last day and a half. */
export const TRENDING_MS = 36 * 60 * 60 * 1000;

/**
 * Every follow as a key, most specific first: the home town, people, other
 * towns, then topics.
 *
 * @param {unknown} rawInterests
 * @returns {string[]}
 */
export function followKeys(rawInterests) {
  const i = normalizeInterests(rawInterests);
  const cities = i.home ? [i.home, ...i.cities.filter((c) => c !== i.home)] : i.cities;
  return [
    ...cities.map((id) => `city:${id}`),
    ...i.people.map((id) => `person:${id}`),
    ...i.categories.map((label) => `cat:${label}`),
  ].filter((key) => keyLabel(key));
}

/**
 * Follows worth offering, best first.
 *
 * @param {readonly { keys: readonly string[], publishedAt?: string }[]} pool
 *   each story's affinity keys (lib/per-ty-rank articleKeys)
 * @param {unknown} rawInterests
 * @param {{ now?: number, skip?: Iterable<string> }} [opts] skip: keys turned down this visit
 * @returns {{ key: string, label: string, why: "learned" | "trending" }[]}
 */
export function suggestFollows(pool, rawInterests, opts = {}) {
  const now = opts.now ?? Date.now();
  const interests = normalizeInterests(rawInterests);
  const taken = new Set([...followKeys(interests), ...(opts.skip ?? [])]);
  const out = [];
  const offer = (key, why) => {
    if (out.length >= MAX_SUGGESTIONS || taken.has(key)) return;
    const label = keyLabel(key);
    if (!label) return;
    taken.add(key);
    out.push({ key, label, why });
  };

  const learned = learnedPicks(interests.affinity, now);
  for (const id of learned.people) offer(`person:${id}`, "learned");
  for (const id of learned.cities) if (id !== "diaspora") offer(`city:${id}`, "learned");
  for (const label of learned.categories) offer(`cat:${label}`, "learned");

  // Only people and towns trend: a topic is always "in the news".
  const counts = new Map();
  for (const story of pool ?? []) {
    const t = Date.parse(story?.publishedAt ?? "");
    if (!(now - t <= TRENDING_MS)) continue;
    for (const key of story?.keys ?? []) {
      if (key.startsWith("person:") || (key.startsWith("city:") && key !== "city:diaspora")) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const trending = [...counts.entries()]
    .filter(([, n]) => n >= TRENDING_MIN)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [key] of trending) offer(key, "trending");

  return out;
}

/**
 * The interests with `key` followed. Unknown keys change nothing.
 *
 * @template {object} I
 * @param {I} rawInterests
 * @param {string} key
 */
export function addFollow(rawInterests, key) {
  const i = normalizeInterests(rawInterests);
  const at = key.indexOf(":");
  const kind = key.slice(0, at);
  const value = key.slice(at + 1);
  if (!keyLabel(key)) return i;
  if (kind === "person" && !i.people.includes(value)) return { ...i, people: [...i.people, value] };
  if (kind === "city" && !i.cities.includes(value)) return { ...i, cities: [...i.cities, value] };
  if (kind === "cat" && !i.categories.includes(value)) return { ...i, categories: [...i.categories, value] };
  return i;
}

/**
 * The interests without `key`. Dropping the home town also clears `home`.
 *
 * @param {unknown} rawInterests
 * @param {string} key
 */
export function removeFollow(rawInterests, key) {
  const i = normalizeInterests(rawInterests);
  const at = key.indexOf(":");
  const kind = key.slice(0, at);
  const value = key.slice(at + 1);
  if (kind === "person") return { ...i, people: i.people.filter((v) => v !== value) };
  if (kind === "city") {
    return { ...i, cities: i.cities.filter((v) => v !== value), home: i.home === value ? null : i.home };
  }
  if (kind === "cat") return { ...i, categories: i.categories.filter((v) => v !== value) };
  return i;
}
