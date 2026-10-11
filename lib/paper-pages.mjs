// The reader's paper cut into pages you turn, like a real one.
//
//   Faqja 1    the front page: nameplate, the lead under its giant word, and
//              the next FRONT_STORIES stories in columns, plus "Në këtë numër"
//   Faqja 2    "Më shumë nga sot", only when the edition is longer than the
//              front page holds
//   Faqja 3…   one page per thing the reader follows that has stories, in
//              their order (lib/per-ty-paper.mjs sections)
//   last       the back page: "Kaq për sot", sharing, tomorrow's edition, and
//              a short honest note for every follow with nothing this week
//
// Pure. Promises, held by the tests:
//
//   1. There is always a front page and a back page, and nothing else is
//      empty: a page exists only when it has stories to show.
//   2. No story appears on two pages (buildPaper already guarantees it across
//      edition and sections; the split never duplicates).
//   3. Pages are numbered from 1 in reading order, and the contents list on the
//      front page names every page after it.

/** Stories on the front page after the lead. */
export const FRONT_STORIES = 5;

/**
 * @template T
 * @param {{ edition: readonly T[], sections: readonly { key: string, title: string, kind: string, empty: boolean }[] } | null | undefined} paper
 */
export function paperPages(paper) {
  const edition = Array.isArray(paper?.edition) ? paper.edition : [];
  const sections = Array.isArray(paper?.sections) ? paper.sections : [];

  /** @type {any[]} */
  const pages = [];
  pages.push({ kind: "front", key: "front", title: "Faqja e parë", lead: edition[0] ?? null, stories: edition.slice(1, 1 + FRONT_STORIES) });

  const more = edition.slice(1 + FRONT_STORIES);
  if (more.length) pages.push({ kind: "more", key: "more", title: "Më shumë nga sot", stories: more });

  for (const section of sections) {
    if (section?.empty) continue;
    pages.push({ kind: "section", key: section.key, title: section.title, section });
  }

  pages.push({ kind: "back", key: "back", title: "Kaq për sot", quiet: sections.filter((s) => s?.empty) });

  pages.forEach((page, i) => {
    page.n = i + 1;
  });
  const contents = pages.slice(1).map((p) => ({ n: p.n, title: p.title, key: p.key }));
  pages[0].contents = contents;
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
