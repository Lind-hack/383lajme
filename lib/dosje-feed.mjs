import { topicForArticle } from "./topics.mjs";

/**
 * The single public-feed answer to "does this article have a Dosje?".
 * It delegates to the same matcher used by the article detail page and the
 * subjects cron, so a chip can never advertise a dossier the article page
 * would not render.
 */
export function dosjeLinkForArticle(article) {
  const topic = topicForArticle(article);
  if (!topic?.slug) return null;
  return {
    slug: String(topic.slug),
    title: String(topic.title ?? topic.slug),
    href: `/dosje/${topic.slug}`,
  };
}
