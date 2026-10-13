// The reader's paper as a reel: one full screen at a time, swiped up like
// TikTok, each screen set like an Apple News story.
//
//   cover      the paper's name, the date, how much is in it today
//   brief…     Dardani's thirty seconds, the town, the numbers, the markets —
//              each box the reader keeps on is a screen of its own, swiped
//              like a story (never a panel that scrolls inside the reel)
//   story…     the day's edition, one story a screen
//   section    for each follow with stories: a full-colour screen saying what
//              it is and why it is here, then its stories (SECTION_STORIES at
//              most, the rest one tap away)
//   end        the checkpoint, "Kaq ishte gazeta jote e sotme": the reader's
//              own paper ends here, and says so
//
// After the checkpoint the reel goes on without end (moreStories): more of
// what the reader follows, then the most read on 383, then older stories —
// none already on a screen, none already read.
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
 * @param {{ boxes?: readonly string[] }} [opts]
 */
export function reelSlides(paper, opts = {}) {
  const edition = Array.isArray(paper?.edition) ? paper.edition : [];
  const sections = Array.isArray(paper?.sections) ? paper.sections : [];
  const seen = new Set();
  const slug = (item) => item?.article?.slug;

  /** @type {any[]} */
  const slides = [{ kind: "cover", key: "cover", title: "Kopertina" }];
  const boxes = [...new Set((Array.isArray(opts.boxes) ? opts.boxes : []).filter((b) => typeof b === "string" && b))];
  boxes.forEach((box, i) => {
    slides.push({ kind: "brief", key: `b:${box}`, title: "Shkurt, për sot", box, group: "brief", groupTitle: "Shkurt, për sot", pos: i, of: boxes.length });
  });

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

/**
 * The next `n` stories after the checkpoint: the rest of the reader's own
 * ranking first, then the week's most read, then `older` (fetched page by page,
 * newest first). Never one in `taken` (already on a screen) or `read`.
 *
 * @template A
 * @param {{ ranked?: readonly any[], pool?: readonly any[], older?: readonly any[], taken?: ReadonlySet<string>, read?: ReadonlySet<string>, n?: number }} from
 * @returns {{ article: any, kind: string, primaryKey?: string }[]}
 */
export function moreStories({ ranked = [], pool = [], older = [], taken = new Set(), read = new Set(), n = 6 } = {}) {
  const out = [];
  const used = new Set();
  const take = (item) => {
    const slug = item?.article?.slug;
    if (out.length >= n || typeof slug !== "string" || !slug || taken.has(slug) || read.has(slug) || used.has(slug)) return;
    used.add(slug);
    out.push(item);
  };
  for (const item of Array.isArray(ranked) ? ranked : []) take(item);
  const top = (Array.isArray(pool) ? pool : []).slice().sort((a, b) => (Number(b?.engagementScore) || 0) - (Number(a?.engagementScore) || 0));
  for (const article of top) take({ article, kind: "top" });
  for (const article of Array.isArray(older) ? older : []) take({ article, kind: "older" });
  return out;
}

/** "#lajmi-4" → 3 (an index), clamped to the screens there are; 0 for anything else. */
export function slideFromHash(hash, count) {
  const m = /^#?lajmi-(\d{1,4})$/.exec(typeof hash === "string" ? hash : "");
  if (!m || !(count > 0)) return 0;
  return Math.min(Math.max(Number(m[1]) - 1, 0), count - 1);
}

export function hashForSlide(index) {
  return `#lajmi-${Math.max(0, Math.floor(Number(index) || 0)) + 1}`;
}
