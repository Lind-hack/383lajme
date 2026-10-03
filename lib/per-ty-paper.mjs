// The reader's own front page: the numbered edition, then one open section per
// thing they follow — a newspaper, not a list.
//
// Built on the device from rankFeed() output (lib/per-ty-rank.mjs) and the
// reader's layout (lib/paper-prefs.mjs). Promises, held by the tests:
//
//   1. The edition keeps every promise of lib/per-ty-edition.mjs (size, at most
//      two per reason, rank order, read stories stay in place), at the length
//      the reader chose. Its first story is the lead, shown big, never twice.
//   2. Sections follow the reader's order and hide what they hid. A section
//      takes stories whose `keys` include it, so a Kurti story that is also
//      Sport can fill Sport when Kurti did not take it.
//   3. Nothing appears twice on the page: not in two sections, not in the
//      edition and a section — and not as a second outlet's write-up of a
//      story already shown (the homepage's same-story test, lib/home-sections).
//   4. A category with little this week is topped up from the 30-day shelf
//      (`shelf`, never ranked, never part of the edition). A section with
//      nothing at all is still returned, marked empty, so the page can say so
//      honestly instead of padding it.

import { buildEdition } from "./per-ty-edition.mjs";
import { normalizeInterests } from "./interests.mjs";
import { personById } from "./people.mjs";
import { cityById } from "./cities.mjs";
import { CATEGORY_TO_SLUG, normalizeCategory } from "./category-map.ts";
import { normalizePrefs, orderedKeys } from "./paper-prefs.mjs";
import { isSameStory } from "./front-page.mjs";
import { sameStoryByNames } from "./home-sections.mjs";

/** Stories per section. */
export const SECTION_SIZE = 4;
/** Below this many stories from the week, a category tops up from the shelf. */
export const SHELF_BELOW = 2;

/**
 * Every followed key in the default order: home city, people, the other cities,
 * then categories — most personal first, as in the ranking.
 */
export function defaultSectionKeys(rawInterests) {
  const interests = normalizeInterests(rawInterests);
  const home = interests.home ? [`city:${interests.home}`] : [];
  return [
    ...home,
    ...interests.people.map((id) => `person:${id}`),
    ...interests.cities.filter((id) => id !== interests.home).map((id) => `city:${id}`),
    ...interests.categories.map((label) => `cat:${label}`),
  ];
}

/**
 * Title, kind and link for a section key; null for a key that no longer names
 * a known person, city or category. Shared with the public snapshot, which
 * derives every title from here rather than trusting text in a URL.
 *
 * @param {string} key
 */
export function describeSection(key) {
  const at = typeof key === "string" ? key.indexOf(":") : -1;
  if (at < 0) return null;
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
  if (kind === "person") {
    const person = personById(id);
    return person ? { key, kind, title: person.name, href: `/kerko?q=${encodeURIComponent(person.name)}` } : null;
  }
  if (kind === "city") {
    const city = cityById(id);
    if (!city) return null;
    const href = city.id === "diaspora" ? "/visit" : `/kerko?q=${encodeURIComponent(city.name)}`;
    return { key, kind, title: city.name, href };
  }
  if (kind === "cat") {
    const label = normalizeCategory(id);
    const slug = label ? CATEGORY_TO_SLUG[label] : null;
    return label === id && slug ? { key, kind: "category", title: label, href: `/kategori/${slug}` } : null;
  }
  return null;
}

/**
 * @template {{ article: { slug: string, title?: string, excerpt?: string }, reason: string, kind: string,
 *   primaryKey?: string, keys?: string[] }} I
 * @template {{ slug: string }} S
 * @param {readonly I[]} feed      rankFeed() output, best first
 * @param {unknown} rawInterests
 * @param {unknown} rawPrefs
 * @param {{ homeFrom?: string | null, shelf?: Record<string, readonly S[]> | null }} [opts]
 */
export function buildPaper(feed, rawInterests, rawPrefs, opts = {}) {
  const prefs = normalizePrefs(rawPrefs);
  const list = Array.isArray(feed) ? feed.filter((i) => i?.article?.slug) : [];
  const { edition, minutes } = buildEdition(list, { size: prefs.length, perReason: 2, homeFrom: opts.homeFrom ?? null });

  const placed = new Set(edition.map((i) => i.article.slug));
  const shownTitles = edition.map((i) => i.article.title ?? "");
  const repeats = (article) =>
    shownTitles.some((t) => t && article?.title && (isSameStory(t, article.title) || sameStoryByNames(t, article.title)));
  const place = (article) => {
    placed.add(article.slug);
    shownTitles.push(article.title ?? "");
  };
  const keys = orderedKeys(prefs.order, defaultSectionKeys(rawInterests));
  const hidden = new Set(prefs.hidden);

  const sections = [];
  for (const key of keys) {
    if (hidden.has(key)) continue;
    const about = describeSection(key);
    if (!about) continue;

    const items = [];
    for (const item of list) {
      if (items.length >= SECTION_SIZE) break;
      if (placed.has(item.article.slug)) continue;
      if (!(item.keys ?? []).includes(key)) continue;
      if (repeats(item.article)) continue;
      items.push({ article: item.article, reason: item.reason, fromShelf: false });
      place(item.article);
    }

    if (about.kind === "category" && items.length < SHELF_BELOW) {
      for (const article of opts.shelf?.[about.title] ?? []) {
        if (items.length >= SHELF_BELOW + 1) break;
        if (!article?.slug || placed.has(article.slug) || repeats(article)) continue;
        items.push({ article, reason: `Nga ${about.title}`, fromShelf: true });
        place(article);
      }
    }

    sections.push({ ...about, items, empty: items.length === 0 });
  }

  return {
    lead: edition[0] ?? null,
    edition,
    sections,
    /** Every key the reader follows, in their order — for the customise sheet. */
    allKeys: keys,
    allHidden: keys.length > 0 && keys.every((k) => hidden.has(k)),
    minutes,
  };
}
