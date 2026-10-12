// The reader's paper cut into pages you turn, like a real one.
//
// Every page holds only what fits on one screen, so a page is read whole and
// then turned — never scrolled down forever:
//
//   Faqja 1    the front page: nameplate, the lead, and the next FRONT_STORIES
//   Faqja 2    "Në këtë numër": every page after it (tap to turn there), and
//              the small boxes — Dardani's thirty seconds, the town, numbers
//   then       "Më shumë nga sot", MORE_PER_PAGE stories a page, only when the
//              edition is longer than the front page holds
//   then       one page per thing the reader follows that has stories, in
//              their order (lib/per-ty-paper.mjs sections), SECTION_STORIES at
//              most, with a link to all of them
//   last       "Kaq për sot", and "Si funksionon" — on one page, or on two so
//              the paper always has an even number of pages: on a wide screen
//              it opens as spreads of two, like a paper held open
//
// Pure. Promises, held by the tests:
//
//   1. There is always a front page, the contents page and a back page; any
//      other page exists only when it has stories to show.
//   2. The count is even, so the last spread is never half empty.
//   3. No story appears on two pages.
//   4. Pages are numbered from 1 in reading order, and the contents page names
//      every page after it.

/** Stories on the front page after the lead. */
export const FRONT_STORIES = 3;
/** Stories on each "Më shumë nga sot" page. */
export const MORE_PER_PAGE = 4;
/** Stories on a follow's page; the rest are one tap away. */
export const SECTION_STORIES = 4;

/**
 * @template T
 * @param {{ edition: readonly T[], sections: readonly { key: string, title: string, kind: string, empty: boolean, items?: readonly any[] }[] } | null | undefined} paper
 */
export function paperPages(paper) {
  const edition = Array.isArray(paper?.edition) ? paper.edition : [];
  const sections = Array.isArray(paper?.sections) ? paper.sections : [];

  /** @type {any[]} */
  const pages = [];
  pages.push({ kind: "front", key: "front", title: "Faqja e parë", lead: edition[0] ?? null, stories: edition.slice(1, 1 + FRONT_STORIES) });
  pages.push({ kind: "index", key: "index", title: "Në këtë numër" });

  const more = edition.slice(1 + FRONT_STORIES);
  for (let i = 0; i < more.length; i += MORE_PER_PAGE) {
    pages.push({ kind: "more", key: `more-${i / MORE_PER_PAGE + 1}`, title: i === 0 ? "Më shumë nga sot" : "Më shumë nga sot (vazhdim)", stories: more.slice(i, i + MORE_PER_PAGE), from: 2 + FRONT_STORIES + i });
  }

  for (const section of sections) {
    if (section?.empty) continue;
    const items = Array.isArray(section.items) ? section.items : [];
    pages.push({ kind: "section", key: section.key, title: section.title, section, items: items.slice(0, SECTION_STORIES), hidden: Math.max(0, items.length - SECTION_STORIES) });
  }

  const quiet = sections.filter((s) => s?.empty);
  // Back and "how it works" share a page when that already makes the count even.
  if ((pages.length + 1) % 2 === 0) {
    pages.push({ kind: "back", key: "back", title: "Kaq për sot", quiet, about: true });
  } else {
    pages.push({ kind: "back", key: "back", title: "Kaq për sot", quiet, about: false });
    pages.push({ kind: "about", key: "about", title: "Si funksionon", quiet });
  }

  pages.forEach((page, i) => {
    page.n = i + 1;
  });
  const stories = (p) => (p.kind === "front" ? (p.lead ? 1 : 0) + p.stories.length : p.kind === "more" ? p.stories.length : p.kind === "section" ? p.items.length : 0);
  pages[1].contents = pages.filter((p) => p.kind !== "index" && p.kind !== "about").map((p) => ({ n: p.n, title: p.title, key: p.key, count: stories(p) }));
  return pages;
}

/** "#faqja-3" → 2 (an index), clamped to the pages there are; 0 for anything else. */
export function pageFromHash(hash, count) {
  const m = /^#?faqja-(\d{1,3})$/.exec(typeof hash === "string" ? hash : "");
  if (!m || !(count > 0)) return 0;
  return Math.min(Math.max(Number(m[1]) - 1, 0), count - 1);
}

export function hashForPage(index) {
  return `#faqja-${Math.max(0, Math.floor(Number(index) || 0)) + 1}`;
}

/** The first page of the spread a page is on: spreads are (1,2), (3,4)… */
export function spreadStart(index, perView) {
  const i = Math.max(0, Math.floor(Number(index) || 0));
  return perView === 2 ? i - (i % 2) : i;
}
