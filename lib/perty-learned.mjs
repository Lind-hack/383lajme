// "Ta bëra gazetën": the paper a guest never had to set up.
//
// 383 already learns from what a reader stays to read (components/
// reading-affinity.tsx → the `affinity` map in lib/interests.mjs). Until now
// that only nudged a feed the reader had to set up first, so the best thing the
// site does was invisible. This module turns the learned map into the same
// picks onboarding would have asked for — topics, people, towns, a home town —
// so Dardani can say "I noticed, here is your paper", and the three questions
// become an edit instead of a gate.
//
// Everything here is pure; the device reads and writes sit at the bottom and,
// like the rest of Për ty, are wrapped so a browser that refuses storage still
// gets a working page.

import { decayedWeight } from "./interests.mjs";
import { NAV_CATEGORIES } from "./category-map.ts";
import { isPersonId, personById } from "./people.mjs";
import { cityById, isCityId } from "./cities.mjs";
import { summarize } from "./reader-ledger.mjs";

/** Real reads (10 s or more) before Dardani offers the paper on an article. */
export const REVEAL_READS = 3;
/** A pick has to add up to about one real read; a stray click is not a taste. */
export const PICK_MIN = 1;
/** A home town is a stronger claim than "reads about it": more than one story. */
export const HOME_MIN = 2;
const MAX = { categories: 3, people: 3, cities: 2 };

/** When the offer was last shown; it waits this long before showing again. */
export const OFFER_KEY = "383:paper-offer";
export const OFFER_PAUSE_MS = 7 * 24 * 60 * 60 * 1000;
/** Set when the reader took a paper Dardani built; cleared once they confirm or edit it. */
export const LEARNED_KEY = "383:paper-learned";

const CATEGORY_LABELS = new Set(NAV_CATEGORIES.map((c) => c.label));

/**
 * The picks the reader's reading implies, strongest first.
 *
 * @param {unknown} affinity  the stored map (untrusted)
 * @param {number} [now]
 * @returns {{ categories: string[], people: string[], cities: string[], home: string | null }}
 */
export function learnedPicks(affinity, now = Date.now()) {
  const weighed = [];
  if (affinity && typeof affinity === "object" && !Array.isArray(affinity)) {
    for (const [key, entry] of Object.entries(affinity)) {
      const w = decayedWeight(entry, now);
      if (w >= PICK_MIN) weighed.push([key, w]);
    }
  }
  weighed.sort((a, b) => b[1] - a[1]);

  const picks = { categories: [], people: [], cities: [], home: null };
  let homeWeight = 0;
  for (const [key, w] of weighed) {
    const at = key.indexOf(":");
    const kind = key.slice(0, at);
    const value = key.slice(at + 1);
    if (kind === "cat" && CATEGORY_LABELS.has(value) && picks.categories.length < MAX.categories) {
      picks.categories.push(value);
    } else if (kind === "person" && isPersonId(value) && picks.people.length < MAX.people) {
      picks.people.push(value);
    } else if (kind === "city" && isCityId(value) && picks.cities.length < MAX.cities) {
      if (picks.cities.length === 0) homeWeight = w;
      picks.cities.push(value);
    }
  }
  // The town read about most, if it was read about more than once. Diaspora is
  // a reader, not a place one reads about by accident, so it is never guessed.
  const top = picks.cities[0];
  if (top && top !== "diaspora" && homeWeight >= HOME_MIN) picks.home = top;
  return picks;
}

/** A learned paper needs at least one topic: every story has one, so it always fills. */
export function hasLearnedPaper(picks) {
  return Array.isArray(picks?.categories) && picks.categories.length > 0;
}

/** Every real read this device has kept, across all months. */
export function totalReads(ledger) {
  return summarize(ledger, { from: "0000-00", to: "9999-99" }).reads;
}

/**
 * Whether the article page should offer the paper now.
 *
 * @param {{ reads: number, picks: ReturnType<typeof learnedPicks>, chosen: boolean,
 *   lastOffer: number | null, now?: number }} state
 */
export function shouldOffer({ reads, picks, chosen, lastOffer, now = Date.now() }) {
  if (chosen) return false;
  if (!(reads >= REVEAL_READS)) return false;
  if (!hasLearnedPaper(picks)) return false;
  return lastOffer === null || !Number.isFinite(lastOffer) || now - lastOffer >= OFFER_PAUSE_MS;
}

/**
 * The picks as the chips Dardani shows, topics first, then people, then towns.
 * `key` is the affinity key, so a chip can be switched off.
 */
export function pickChips(picks) {
  const chips = [];
  for (const label of picks?.categories ?? []) chips.push({ key: `cat:${label}`, label });
  for (const id of picks?.people ?? []) {
    const person = personById(id);
    if (person) chips.push({ key: `person:${id}`, label: person.name });
  }
  for (const id of picks?.cities ?? []) {
    const city = cityById(id);
    if (city) chips.push({ key: `city:${id}`, label: city.name });
  }
  return chips;
}

/** The picks without the chips the reader switched off. */
export function withoutChips(picks, off) {
  const drop = new Set(off ?? []);
  const cities = (picks?.cities ?? []).filter((id) => !drop.has(`city:${id}`));
  return {
    categories: (picks?.categories ?? []).filter((label) => !drop.has(`cat:${label}`)),
    people: (picks?.people ?? []).filter((id) => !drop.has(`person:${id}`)),
    cities,
    home: picks?.home && cities.includes(picks.home) ? picks.home : null,
  };
}

// ── On the device ──────────────────────────────────────────────────────────

function store() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** When the offer was last shown, or null. */
export function readLastOffer() {
  try {
    const t = Number(store()?.getItem(OFFER_KEY));
    return Number.isFinite(t) && t > 0 ? t : null;
  } catch {
    return null;
  }
}

export function noteOffer(now = Date.now()) {
  try {
    store()?.setItem(OFFER_KEY, String(now));
  } catch {
    // Not remembered: the offer may come back on the next read.
  }
}

export function isLearnedPaper() {
  try {
    return store()?.getItem(LEARNED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLearnedPaper(on) {
  try {
    if (on) store()?.setItem(LEARNED_KEY, "1");
    else store()?.removeItem(LEARNED_KEY);
  } catch {
    // Without storage the "A e kam qëlluar?" line simply does not show.
  }
}
