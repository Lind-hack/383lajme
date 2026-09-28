const clipped = (value, limit) => String(value ?? "").trim().slice(0, limit);

/** Keep provider prompts bounded while retaining source identity and evidence. */
export function dailySourcePacket(articles, { citedSlugs = null } = {}) {
  const cited = citedSlugs ? new Set(citedSlugs) : null;
  return (Array.isArray(articles) ? articles : [])
    .filter((article) => !cited || cited.has(article?.slug))
    .slice(0, 24)
    .map((article) => ({
      slug: article.slug,
      source: clipped(article.source, 120),
      url: clipped(article.url, 500),
      publishedAt: article.publishedAt,
      category: article.category,
      title: clipped(article.title, 240),
      excerpt: clipped(article.excerpt, 400),
      body: clipped(article.body, cited ? 1500 : 350),
    }));
}

export function shortlistedSourceSlugs(topics) {
  return [...new Set((Array.isArray(topics) ? topics : []).flatMap((topic) =>
    Array.isArray(topic?.source_slugs) ? topic.source_slugs.filter((slug) => typeof slug === "string") : []))];
}
