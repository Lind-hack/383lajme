/** Override only the lead, without allowing duplicate cards or changing ranks. */
export function applyHomepagePlacement(ranked, article, placement, now = Date.now()) {
  const start = Date.parse(placement?.starts_at);
  const end = Date.parse(placement?.ends_at);
  if (!article || article.id !== placement?.article_id ||
      !Number.isFinite(start) || !Number.isFinite(end) ||
      !(start <= now && now < end)) return ranked;
  return [article, ...ranked.filter((item) => item.id !== article.id)].slice(0, 7);
}
