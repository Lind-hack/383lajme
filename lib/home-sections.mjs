// Fills the homepage below the front block from one shared pool.
//
// The page used to take a small fixed slice per section from a 60-article
// fetch, each section reading the pool on its own. The same story then turned
// up in the lead, the video reaction, the Dosje index and the category bands,
// while 30-odd of the day's articles appeared nowhere. Here every section
// claims from one pool through one `used` set, so a story is shown once, and
// the page reaches as deep into the day as the pool allows.
import { frontRank, isSameStory } from "./front-page.mjs";

/** Below this, a category block is skipped rather than shown half-empty. */
export const MIN_CATEGORY_BLOCK = 3;

/**
 * The page's claim ledger: ids, and the titles behind them so a second write-up
 * of an already-shown story is skipped too.
 */
export function createLedger(articles = []) {
  const ledger = { ids: new Set(), titles: [] };
  for (const article of articles) mark(ledger, article);
  return ledger;
}

function mark(ledger, article) {
  if (!article?.id || ledger.ids.has(article.id)) return;
  ledger.ids.add(article.id);
  if (article.title) ledger.titles.push(article.title);
}

function isClaimed(ledger, article) {
  if (!article?.id || ledger.ids.has(article.id)) return true;
  return ledger.titles.some((title) => isSameStory(title, article.title));
}

function publishedTime(article) {
  const t = Date.parse(article?.publishedAt ?? article?.createdAt ?? "");
  return Number.isFinite(t) ? t : 0;
}

/**
 * Up to `count` unclaimed articles matching `predicate`, in the given order,
 * marked as claimed. With `min`, nothing is claimed unless at least `min`
 * qualify, so a thin section gives its stories back instead of rendering two.
 */
export function claim(ledger, ordered, count, { predicate = () => true, min = 0 } = {}) {
  const picked = [];
  const local = createLedger();
  for (const article of ordered ?? []) {
    if (picked.length >= count) break;
    if (!predicate(article) || isClaimed(ledger, article) || isClaimed(local, article)) continue;
    picked.push(article);
    mark(local, article);
  }
  if (picked.length < min) return [];
  for (const article of picked) mark(ledger, article);
  return picked;
}

export function newestFirst(pool) {
  return [...(pool ?? [])].sort((a, b) => publishedTime(b) - publishedTime(a));
}

export function rankedFirst(pool, now = Date.now()) {
  return [...(pool ?? [])].sort((a, b) => frontRank(b, now) - frontRank(a, now));
}

/**
 * Every news section below the front block, claimed in page order.
 *
 * `plan` lists the sections: `{ key, count, category? }`. A section with a
 * category takes the category's best-ranked stories and needs at least
 * MIN_CATEGORY_BLOCK of them; one without takes the newest.
 * `categoryOf` maps an article to its canonical section name.
 */
export function buildHomeSections(pool, ledger, plan, { categoryOf = (a) => a?.category, now = Date.now() } = {}) {
  const unique = [];
  const seen = new Set();
  for (const article of pool ?? []) {
    if (!article?.id || seen.has(article.id)) continue;
    seen.add(article.id);
    unique.push(article);
  }
  const byTime = newestFirst(unique);
  const byRank = rankedFirst(unique, now);

  const sections = {};
  for (const { key, count, category } of plan) {
    sections[key] = category
      ? claim(ledger, byRank, count, { predicate: (a) => categoryOf(a) === category, min: MIN_CATEGORY_BLOCK })
      : claim(ledger, byTime, count);
  }
  return sections;
}

/**
 * The Dosje index, one row per dossier.
 *
 * It listed every article that belonged to a dossier, so a busy file filled
 * the index with five near-identical headlines about one story. Each dossier
 * now gets its newest headline — preferring one the page has not already
 * shown — and a count of the rest.
 */
export function groupDosjeEntries(entries, shownSlugs = new Set()) {
  const groups = new Map();
  for (const entry of entries ?? []) {
    if (!entry?.dossierSlug) continue;
    const group = groups.get(entry.dossierSlug);
    if (group) group.push(entry);
    else groups.set(entry.dossierSlug, [entry]);
  }
  return [...groups.values()].map((group) => {
    const lead = group.find((entry) => !shownSlugs.has(entry.articleSlug)) ?? group[0];
    return { ...lead, moreCount: group.length - 1 };
  });
}
