// "Për ty sot": the reader's morning edition — a short list with an end.
//
// Për ty is meant to be read over one coffee and then closed. A ranked feed
// has no end, so this cuts it into an edition of a fixed size and files the
// rest away under "Më shumë", where a reader who wants more can open it.
//
// Three promises, held by the tests:
//
//   1. The edition is short: at most `size` stories, and no single reason
//      ("Sepse ndjek Albin Kurti", "Kryesoret e ditës") may take more than
//      `perReason` of them, so one busy name cannot fill the morning. Two, not
//      three: measured on a real day with three, a reader following Kurti,
//      Prishtina and three topics got 3 Kurti + 3 general top stories + 1
//      Prishtina, and nothing from their topics.
//   2. It keeps rank order, read stories included. A story the reader has
//      opened stays where it was, so "3 / 7 lexuar" can move and the list does
//      not reshuffle under their thumb while they work down it.
//   3. Nothing appears twice: a story in the edition is never also in "Më
//      shumë".

const PERSON_PREFIX = /^Sepse ndjek /;

/** About how long the edition page takes to read: titles and summaries. */
export const WORDS_PER_MINUTE = 200;
export const MIN_MINUTES = 2;

/**
 * Minutes to read the given items' titles and excerpts, rounded up, never
 * below MIN_MINUTES. It describes this page, not the full articles.
 *
 * @param {readonly { article: { title?: string, excerpt?: string } }[]} items
 */
export function readingMinutes(items) {
  let words = 0;
  for (const item of items ?? []) {
    const text = `${item?.article?.title ?? ""} ${item?.article?.excerpt ?? ""}`.trim();
    if (text) words += text.split(/\s+/).length;
  }
  return Math.max(MIN_MINUTES, Math.ceil(words / WORDS_PER_MINUTE));
}

/**
 * @template {{ article: { slug: string, title?: string, excerpt?: string }, reason: string, kind: string }} I
 * @param {readonly I[]} feed   rankFeed() output, best first
 * @param {{ size?: number, perReason?: number, homeFrom?: string | null }} [opts]
 *   homeFrom: the home city's reason label ("Nga Prishtina"), filed first
 * @returns {{
 *   edition: I[],
 *   more: { key: string, title: string, kind: "person" | "city" | "topics", items: I[] }[],
 *   minutes: number,
 * }}
 */
export function buildEdition(feed, opts = {}) {
  const size = opts.size ?? 7;
  const perReason = opts.perReason ?? 2;
  const homeFrom = opts.homeFrom ?? null;

  const seen = new Set();
  const unique = [];
  for (const item of feed ?? []) {
    const slug = item?.article?.slug;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    unique.push(item);
  }

  const edition = [];
  const taken = new Set();
  const perReasonCount = new Map();
  for (const item of unique) {
    if (edition.length >= size) break;
    const used = perReasonCount.get(item.reason) ?? 0;
    if (used >= perReason) continue;
    perReasonCount.set(item.reason, used + 1);
    edition.push(item);
    taken.add(item.article.slug);
  }

  // The rest, filed the way the reader picked them: people, then cities (their
  // own town first), then their topics. The day's general top stories that did
  // not make the edition are left to Kryesoret, one tap away.
  const rest = unique.filter((item) => !taken.has(item.article.slug));
  const grouped = (kind) => {
    const groups = new Map();
    for (const item of rest.filter((i) => i.kind === kind)) {
      groups.set(item.reason, [...(groups.get(item.reason) ?? []), item]);
    }
    return [...groups.entries()];
  };

  const more = [];
  for (const [reason, items] of grouped("person")) {
    more.push({ key: `person:${reason}`, title: reason.replace(PERSON_PREFIX, ""), kind: "person", items });
  }
  const cities = grouped("city").sort(([a], [b]) => Number(b === homeFrom) - Number(a === homeFrom));
  for (const [reason, items] of cities) {
    more.push({ key: `city:${reason}`, title: reason, kind: "city", items });
  }
  const topics = rest.filter((i) => i.kind === "category" || i.kind === "learned");
  if (topics.length) more.push({ key: "topics", title: "Temat e tua", kind: "topics", items: topics });

  return { edition, more, minutes: readingMinutes(edition) };
}
