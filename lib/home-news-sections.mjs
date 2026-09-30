/** Keep eight stories for the lower sections, even with a small fallback batch. */
export function njoftimeBudget(unclaimedCount) {
  return Math.max(0, Math.min(16, unclaimedCount - 8));
}

/** Recency is independent of placement; only the archive remains exclusive. */
export function selectHomeTail(articles, latest, claimed) {
  const recent = latest.slice(0, 4);
  const used = new Set([...claimed, ...recent.map((article) => article.id)]);
  const story = articles.find((article) => !used.has(article.id));
  if (story) used.add(story.id);
  return {
    recent,
    story,
    archive: articles.filter((article) => !used.has(article.id)).slice(0, 12),
  };
}
