// The reader's paper as a reel: one full screen at a time, swiped up like
// TikTok, each screen set like an Apple News story.
//
//   cover      the paper's name, the date, how much is in it today
//   brief      Dardani's thirty seconds, the town and the numbers (when the
//              reader keeps those boxes on)
//   story…     the day's edition, one story a screen
//   section    for each follow with stories: a full-colour screen saying what
//              it is and why it is here, then its stories (SECTION_STORIES at
//              most, the rest one tap away)
//   end        "Kaq për sot": sharing, tomorrow, how it works, follows that
//              had nothing this week
//
// Pure. Promises, held by the tests:
//
//   1. The cover is first and the end is last, always.
//   2. No story is on two screens.
//   3. Every story knows its group (the edition or a follow), its place in it
//      and the group's size, for the progress bars at the top.
//   4. A follow with nothing this week has no screens; it is named on the end.

/** Stories shown under one follow; the rest are on its own page. */
export const SECTION_STORIES = 5;

/**
 * @param {{ edition?: readonly any[], sections?: readonly { key: string, title: string, kind: string, empty?: boolean, items?: readonly any[] }[] } | null | undefined} paper
 * @param {{ brief?: boolean }} [opts]
 */
export function reelSlides(paper, opts = {}) {
  const edition = Array.isArray(paper?.edition) ? paper.edition : [];
  const sections = Array.isArray(paper?.sections) ? paper.sections : [];
  const seen = new Set();
  const slug = (item) => item?.article?.slug;

  /** @type {any[]} */
  const slides = [{ kind: "cover", key: "cover", title: "Kopertina" }];
  if (opts.brief) slides.push({ kind: "brief", key: "brief", title: "Shkurt, për sot" });

  const fresh = edition.filter((item) => slug(item) && !seen.has(slug(item)) && seen.add(slug(item)));
  fresh.forEach((item, i) => {
    slides.push({ kind: "story", key: `s:${slug(item)}`, title: item.article.title, item, group: "edition", groupTitle: "Sot për ty", pos: i, of: fresh.length });
  });

  for (const section of sections) {
    if (section?.empty) continue;
    const all = (Array.isArray(section.items) ? section.items : []).filter((item) => slug(item) && !seen.has(slug(item)));
    const items = all.slice(0, SECTION_STORIES);
    if (!items.length) continue;
    items.forEach((item) => seen.add(slug(item)));
    slides.push({ kind: "section", key: `h:${section.key}`, title: section.title, section, count: items.length, hidden: all.length - items.length });
    items.forEach((item, i) => {
      slides.push({ kind: "story", key: `s:${slug(item)}`, title: item.article.title, item, group: section.key, groupTitle: section.title, section, pos: i, of: items.length });
    });
  }

  slides.push({ kind: "end", key: "end", title: "Kaq për sot", quiet: sections.filter((s) => s?.empty) });
  slides.forEach((s, i) => {
    s.n = i;
  });
  return slides;
}

/** "#lajmi-4" → 3 (an index), clamped to the screens there are; 0 for anything else. */
export function slideFromHash(hash, count) {
  const m = /^#?lajmi-(\d{1,3})$/.exec(typeof hash === "string" ? hash : "");
  if (!m || !(count > 0)) return 0;
  return Math.min(Math.max(Number(m[1]) - 1, 0), count - 1);
}

export function hashForSlide(index) {
  return `#lajmi-${Math.max(0, Math.floor(Number(index) || 0)) + 1}`;
}
