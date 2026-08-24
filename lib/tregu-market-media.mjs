export const TREGU_CONTEXT_FALLBACKS = Object.freeze({
  kosovo: "/tregu/context/kosovo.webp",
  albania: "/tregu/context/albania.webp",
  world: "/tregu/context/world.webp",
  economy: "/tregu/context/economy.webp",
});

function plain(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function safeImageUrl(value) {
  const url = String(value ?? "").trim();
  return (url.startsWith("/") && !url.startsWith("//")) || /^https:\/\//i.test(url) ? url : null;
}

export function marketContext(market, article) {
  if (plain(market?.category) === "ekonomi") return "economy";
  const category = plain(article?.category);
  if (/shqip|alban|tiran/.test(category)) return "albania";
  if (category.includes("bote") || category.includes("world") || category.includes("diaspor")) return "world";
  if (category.includes("ekonomi")) return "economy";
  if (/kosov|politik|siguri|shoqeri/.test(category)) return "kosovo";
  const marketCategory = plain(market?.category);
  if (marketCategory === "bote") return "world";
  if (marketCategory === "ekonomi") return "economy";
  return "kosovo";
}

/**
 * Resolve only editorial markets. Sport keeps its league, club and driver
 * identity instead of borrowing unrelated news photography.
 */
export function resolveMarketMedia(market, articles = []) {
  const category = plain(market?.category);
  const classification = plain(market?.market_classification);
  if (category === "sport" || classification.startsWith("live_")) return null;

  const bySlug = new Map(
    (Array.isArray(articles) ? articles : [])
      .filter((article) => article?.slug)
      .map((article) => [String(article.slug), article])
  );
  const selected = (Array.isArray(market?.source_article_slugs) ? market.source_article_slugs : [])
    .map((slug) => bySlug.get(String(slug)))
    .find((article) => safeImageUrl(article?.image_url ?? article?.imageUrl));
  const context = marketContext(market, selected);
  const fallbackSrc = TREGU_CONTEXT_FALLBACKS[context];
  const sourceSrc = safeImageUrl(selected?.image_url ?? selected?.imageUrl);

  return {
    src: sourceSrc ?? fallbackSrc,
    fallbackSrc,
    kind: sourceSrc ? "source_article" : "category_fallback",
    context,
    articleSlug: selected?.slug ? String(selected.slug) : null,
    title: selected?.title ? String(selected.title) : null,
    source: selected?.source ? String(selected.source) : null,
  };
}
