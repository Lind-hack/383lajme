// Ranking for "Për ty": which of today's stories this reader sees, in what
// order, and why.
//
// Runs in the browser. The server hands every reader the same public pool; the
// reader's choices never leave the device to be ranked, so no personalised page
// can land in a shared cache.
//
// The weights encode three promises, and the tests hold them:
//
//   1. An explicit pick always beats what was only learned from reading. The
//      affinity boost is capped below the smallest pick, so an article the
//      reader merely clicked on can never push out one they asked for.
//   2. A named person is the strongest signal, then the reader's own city, then
//      the other cities, then a category — from most specific to least.
//   3. Personalisation never hides the day. A few of the top general stories
//      are always mixed in, labelled as such.
//   4. Today comes first. Për ty is a daily paper: a story about a category the
//      reader follows from this morning beats a story about a followed person
//      from three days ago. Freshness sorts in tiers (FRESH_TIERS_MS) before
//      the weights, so the weights still order everything inside one tier, and
//      an older match still fills in when a follow had nothing new.
//
// Each item also says which of the reader's follows it belongs to: `primaryKey`
// is the follow behind the reason shown ("person:albin-kurti", "city:prishtine",
// "cat:Sport"; "learned" and "top" for the rest), and `keys` is every follow the
// story matches, so a Kurti story that is also Sport can fill the Sport section
// of the paper (lib/per-ty-paper.mjs). Only followed keys, never every name the
// story happens to mention.

import { mentions, surfaceForms } from "./entities.mjs";
import { PEOPLE, personById } from "./people.mjs";
import { CITIES, cityById } from "./cities.mjs";
import { normalizeInterests, decayedWeight } from "./interests.mjs";

export const WEIGHTS = {
  person: 100,
  /** The reader's own city: above the other cities they picked. */
  home: 85,
  city: 70,
  category: 40,
  /** Per unit of decayed read-weight. */
  affinityScale: 4,
  /** Hard ceiling, kept below `category` so rule 1 holds after tie-breakers. */
  affinityCap: 20,
  recencyMax: 10,
  engagementMax: 5,
};

/**
 * Older than this and a story is out. A week, not a day: the newsroom writes
 * about most towns and many people once or twice a week, and a feed that only
 * looked at today would be empty for them. Recency still orders within a pick.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Freshness tiers, newest first: roughly today (an evening story still counts
 * the next morning), the last few days, then the rest of the week.
 */
const FRESH_TIERS_MS = [36 * 60 * 60 * 1000, 96 * 60 * 60 * 1000];
/** A top story mixed in must be from roughly the last day and a half. */
const TOP_MAX_AGE_MS = 36 * 60 * 60 * 1000;
/**
 * Where the mixed-in top stories land in the list: after the reader's own first
 * three, so the paper opens on what they follow and only then on the day's news.
 */
const TOP_SLOTS = [3, 7, 11];

export const TOP_REASON = "Kryesoret e ditës";
export const LEARNED_REASON = "Sipas asaj që lexon";

const personForms = new Map(
  PEOPLE.map((p) => [p.id, surfaceForms({ name: p.name, match: p.match })])
);
const cityForms = new Map(
  CITIES.map((c) => [c.id, surfaceForms({ name: c.name, match: c.forms })])
);

function formsForPerson(person) {
  return personForms.get(person.id) ?? surfaceForms({ name: person.name, match: person.match });
}

/** The title and summary are what an article is about; mentions() reads `body`. */
function textOf(article) {
  return { title: article?.title ?? "", body: article?.excerpt ?? "" };
}

const TAG = /^(person|city):[a-z0-9-]+$/;

/** The server's tags for this story (storyTags), cleaned: they ride in the public pool. */
function tagsOf(article) {
  return new Set(Array.isArray(article?.tags) ? article.tags.filter((t) => typeof t === "string" && TAG.test(t)) : []);
}

function matchesPerson(article, person, text = textOf(article)) {
  return tagsOf(article).has(`person:${person.id}`) || mentions(text, formsForPerson(person));
}

/**
 * Every listed person and town a story names anywhere in its text, as
 * "person:<id>" / "city:<id>". Runs on the server over the full body when the
 * pool is built (app/per-ty/page.tsx), so the phone gets the tags and never the
 * body: a name in the fifth paragraph still reaches the reader who follows it.
 *
 * @param {{ title?: string, body?: string, excerpt?: string, city?: string } | null | undefined} article
 * @returns {string[]}
 */
export function storyTags(article) {
  if (!article) return [];
  const text = { title: article.title ?? "", body: article.body ?? article.excerpt ?? "" };
  const tags = [];
  for (const person of PEOPLE) {
    if (mentions(text, formsForPerson(person))) tags.push(`person:${person.id}`);
  }
  for (const city of CITIES) {
    if (matchesCity({ ...article, tags: undefined }, city, text)) tags.push(`city:${city.id}`);
  }
  return tags;
}

function matchesCity(article, city, text = textOf(article)) {
  if (tagsOf(article).has(`city:${city.id}`)) return true;
  // The pipeline's own field wins when it is set.
  if (article?.city) {
    const [field] = surfaceForms({ name: String(article.city) });
    if (field && (cityForms.get(city.id) ?? []).includes(field)) return true;
  }
  return mentions(text, cityForms.get(city.id) ?? []);
}

/**
 * The affinity keys an article carries: its category, and every listed person
 * and city it mentions. Used both to learn from a read and to score with it.
 */
export function articleKeys(article) {
  if (!article) return [];
  const keys = [];
  if (article.category) keys.push(`cat:${article.category}`);
  const text = textOf(article);
  for (const person of PEOPLE) {
    if (matchesPerson(article, person, text)) keys.push(`person:${person.id}`);
  }
  for (const city of CITIES) {
    if (matchesCity(article, city, text)) keys.push(`city:${city.id}`);
  }
  return keys;
}

function ageOf(article, now) {
  const t = Date.parse(article?.publishedAt ?? "");
  return Number.isFinite(t) ? Math.max(0, now - t) : Infinity;
}

/** 0 for roughly today, then 1, 2 (FRESH_TIERS_MS). */
function tierOf(age) {
  const i = FRESH_TIERS_MS.findIndex((limit) => age <= limit);
  return i === -1 ? FRESH_TIERS_MS.length : i;
}

function tieBreak(article, age) {
  const recency = Number.isFinite(age)
    ? WEIGHTS.recencyMax * Math.exp(-age / (24 * 60 * 60 * 1000))
    : 0;
  const engagement = Math.min(
    WEIGHTS.engagementMax,
    Math.max(0, Number(article?.engagementScore) || 0) / 2
  );
  return recency + engagement;
}

/**
 * @template {{ slug: string, title: string, excerpt?: string, category?: string,
 *   city?: string, publishedAt?: string, engagementScore?: number }} A
 * @param {readonly A[]} pool
 * @param {unknown} rawInterests
 * @param {{ now?: number, limit?: number, topCount?: number }} [opts]
 * @returns {{ article: A, reason: string, kind: "person" | "city" | "category" | "learned" | "top",
 *   primaryKey: string, keys: string[] }[]}
 */
export function rankFeed(pool, rawInterests, opts = {}) {
  const now = opts.now ?? Date.now();
  const limit = opts.limit ?? 40;
  const topCount = opts.topCount ?? 3;
  const interests = normalizeInterests(rawInterests);

  const people = interests.people.map(personById).filter(Boolean);
  const cities = interests.cities.map(cityById).filter(Boolean);
  const home = cityById(interests.home);
  const categories = new Set(interests.categories);

  const scored = [];
  const seen = new Set();

  for (const article of pool ?? []) {
    if (!article?.slug || seen.has(article.slug)) continue;
    seen.add(article.slug);
    const age = ageOf(article, now);
    if (age > MAX_AGE_MS) continue;

    const text = textOf(article);
    let score = 0;
    let reason = null;
    let kind = null;
    let primaryKey = null;

    const matchedPeople = people.filter((p) => matchesPerson(article, p, text));
    const person = matchedPeople[0];
    if (person) {
      score += WEIGHTS.person;
      reason = `Sepse ndjek ${person.name}`;
      kind = "person";
      primaryKey = `person:${person.id}`;
    }

    // Home is tried first, so a story naming two picked cities is filed under home.
    const matchedCities = cities.filter((c) => matchesCity(article, c, text));
    const city = (home && matchedCities.includes(home) ? home : null) ?? matchedCities[0];
    if (city) {
      score += city === home ? WEIGHTS.home : WEIGHTS.city;
      if (!reason) {
        reason = city.from;
        kind = "city";
        primaryKey = `city:${city.id}`;
      }
    }

    const followsCategory = Boolean(article.category && categories.has(article.category));
    if (followsCategory) {
      score += WEIGHTS.category;
      if (!reason) {
        reason = `Sepse ndjek ${article.category}`;
        kind = "category";
        primaryKey = `cat:${article.category}`;
      }
    }

    const keys = [
      ...matchedPeople.map((p) => `person:${p.id}`),
      ...matchedCities.map((c) => `city:${c.id}`),
      ...(followsCategory ? [`cat:${article.category}`] : []),
    ];

    let learned = 0;
    for (const key of articleKeys(article)) {
      learned += decayedWeight(interests.affinity[key], now);
    }
    const boost = Math.min(WEIGHTS.affinityCap, learned * WEIGHTS.affinityScale);

    // Something learned only earns a place once it amounts to about one real
    // read; a faded trace of an old click is not a reason to show a story.
    if (!reason) {
      if (learned < 1) continue;
      reason = LEARNED_REASON;
      kind = "learned";
      primaryKey = "learned";
    }

    scored.push({
      article,
      reason,
      kind,
      primaryKey,
      keys,
      // Learned-only stories always come after every explicit pick (promise 1).
      rank: kind === "learned" ? 1 : 0,
      tier: tierOf(age),
      score: score + boost + tieBreak(article, age),
    });
  }

  scored.sort((a, b) => a.rank - b.rank || a.tier - b.tier || b.score - a.score);
  const personal = scored
    .slice(0, limit)
    .map(({ article, reason, kind, primaryKey, keys }) => ({ article, reason, kind, primaryKey, keys }));

  const taken = new Set(personal.map((item) => item.article.slug));
  const top = [...(pool ?? [])]
    .filter((a) => a?.slug && !taken.has(a.slug) && ageOf(a, now) <= TOP_MAX_AGE_MS)
    .sort((a, b) => (Number(b.engagementScore) || 0) - (Number(a.engagementScore) || 0))
    .slice(0, topCount);

  const result = [...personal];
  top.forEach((article, i) => {
    const at = Math.min(TOP_SLOTS[i] ?? result.length, result.length);
    result.splice(at, 0, { article, reason: TOP_REASON, kind: "top", primaryKey: "top", keys: [] });
  });
  return result;
}

/** How many of today's stories match these picks — the onboarding preview. */
export function countMatches(pool, rawInterests, now = Date.now()) {
  return rankFeed(pool, rawInterests, { now, limit: 500, topCount: 0 }).filter(
    (item) => item.kind !== "learned"
  ).length;
}
