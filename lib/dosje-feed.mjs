import { topicForArticle } from "./topics.mjs";

/**
 * The single public-feed answer to "does this article have a Dosje?".
 * It delegates to the same matcher used by the article detail page and the
 * subjects cron, so a chip can never advertise a dossier the article page
 * would not render.
 */
export function dosjeLinkForArticle(article, universe) {
  const topic = topicForArticle(article, universe);
  if (!topic?.slug) return null;
  return {
    slug: String(topic.slug),
    title: String(topic.title ?? topic.slug),
    href: `/dosje/${topic.slug}`,
  };
}

export function isDosjeActivationKey(key) {
  return key === "Enter" || key === " ";
}


export function dosjeFeedEntries(articles, universe) {
  return (Array.isArray(articles) ? articles : [])
    .map((article) => {
      const link = dosjeLinkForArticle(article, universe);
      if (!link || !article?.slug || !article?.title) return null;
      return {
        articleSlug: String(article.slug),
        articleTitle: String(article.title),
        dossierSlug: link.slug,
        dossierTitle: link.title,
        articleHref: `/article/${article.slug}`,
        dossierHref: link.href,
      };
    })
    .filter(Boolean);
}
