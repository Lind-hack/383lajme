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
//   2. A named person is the strongest signal, then a city, then a category —
//      from most specific to least.
//   3. Personalisation never hides the day. A few of the top general stories
//      are always mixed in, labelled as such.

import { mentions, surfaceForms } from "./entities.mjs";
import { PEOPLE, personById } from "./people.mjs";
import { CITIES, cityById } from "./cities.mjs";
import { normalizeInterests, decayedWeight } from "./interests.mjs";

export const WEIGHTS = {
  person: 100,
  city: 70,
  category: 40,
  /** Per unit of decayed read-weight. */
  affinityScale: 4,
  /** Hard ceiling, kept below `category` so rule 1 holds after tie-breakers. */
  affinityCap: 20,
  recencyMax: 10,
  engagementMax: 5,
};

/** Older than this and a story is not "today" in any sense a reader means. */
const MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000;
/** A top story mixed in must be from roughly the last day and a half. */
const TOP_MAX_AGE_MS = 36 * 60 * 60 * 1000;
/** Where the mixed-in top stories land in the list. */
const TOP_SLOTS = [1, 5, 9];

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

function matchesCity(article, city) {
  // The pipeline's own field wins when it is set.
  if (article?.city) {
    const [field] = surfaceForms({ name: String(article.city) });
    if (field && (cityForms.get(city.id) ?? []).includes(field)) return true;
  }
  return mentions(textOf(article), cityForms.get(city.id) ?? []);
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
    if (mentions(text, formsForPerson(person))) keys.push(`person:${person.id}`);
  }
  for (const city of CITIES) {
    if (matchesCity(article, city)) keys.push(`city:${city.id}`);
  }
  return keys;
}

function ageOf(article, now) {
  const t = Date.parse(article?.publishedAt ?? "");
  return Number.isFinite(t) ? Math.max(0, now - t) : Infinity;
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
 * @returns {{ article: A, reason: string, kind: "person" | "city" | "category" | "learned" | "top" }[]}
 */
export function rankFeed(pool, rawInterests, opts = {}) {
  const now = opts.now ?? Date.now();
  const limit = opts.limit ?? 40;
  const topCount = opts.topCount ?? 3;
  const interests = normalizeInterests(rawInterests);

  const people = interests.people.map(personById).filter(Boolean);
  const cities = interests.cities.map(cityById).filter(Boolean);
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

    const person = people.find((p) => mentions(text, formsForPerson(p)));
    if (person) {
      score += WEIGHTS.person;
      reason = `Sepse ndjek ${person.name}`;
      kind = "person";
    }

    const city = cities.find((c) => matchesCity(article, c));
    if (city) {
      score += WEIGHTS.city;
      if (!reason) {
        reason = city.from;
        kind = "city";
      }
    }

    if (article.category && categories.has(article.category)) {
      score += WEIGHTS.category;
      if (!reason) {
        reason = `Sepse ndjek ${article.category}`;
        kind = "category";
      }
    }

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
    }

    scored.push({ article, reason, kind, score: score + boost + tieBreak(article, age) });
  }

  scored.sort((a, b) => b.score - a.score);
  const personal = scored.slice(0, limit).map(({ article, reason, kind }) => ({ article, reason, kind }));

  const taken = new Set(personal.map((item) => item.article.slug));
  const top = [...(pool ?? [])]
    .filter((a) => a?.slug && !taken.has(a.slug) && ageOf(a, now) <= TOP_MAX_AGE_MS)
    .sort((a, b) => (Number(b.engagementScore) || 0) - (Number(a.engagementScore) || 0))
    .slice(0, topCount);

  const result = [...personal];
  top.forEach((article, i) => {
    const at = Math.min(TOP_SLOTS[i] ?? result.length, result.length);
    result.splice(at, 0, { article, reason: TOP_REASON, kind: "top" });
  });
  return result;
}

/** How many of today's stories match these picks — the onboarding preview. */
export function countMatches(pool, rawInterests, now = Date.now()) {
  return rankFeed(pool, rawInterests, { now, limit: 500, topCount: 0 }).filter(
    (item) => item.kind !== "learned"
  ).length;
}
