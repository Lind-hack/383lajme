import { pickFrontPage } from "./front-page.mjs";

/** Never label a days-old or undated archive item as today's news. */
export function freshNews(pool, { now = Date.now(), exclude = new Set(), count = 12, diverse = false } = {}) {
  const fresh = (pool ?? []).filter((article) => {
    const time = Date.parse(article?.publishedAt ?? article?.createdAt ?? "");
    return Number.isFinite(time) && time <= now + 300_000 && now - time <= 24 * 3_600_000 && !exclude.has(article.id);
  });
  const ranked = pickFrontPage(fresh, fresh.length, now);
  if (!diverse) return ranked.slice(0, count);
  const categories = new Set();
  return ranked.filter((article) => {
    if (categories.has(article.category)) return false;
    categories.add(article.category);
    return true;
  }).slice(0, count);
}
