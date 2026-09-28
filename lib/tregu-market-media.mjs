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

const CURATED_SUBJECT_IMAGES = [
  {
    matches: (value) => /\b(?:levizja\s+)?vetevendosje\b/.test(value),
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Logo_of_Vet%C3%ABvendosje.svg?width=800",
    source: "https://commons.wikimedia.org/wiki/File:Logo_of_Vet%C3%ABvendosje.svg",
    alt: "Logo e Lëvizjes Vetëvendosje",
    credit: "Lëvizja VETËVENDOSJE! · CC BY-SA 4.0",
  },
  {
    matches: (value) => /\balbin\s+kurti\b/.test(value),
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Albin_Kurti_2024.jpg?width=800",
    source: "https://commons.wikimedia.org/wiki/File:Albin_Kurti_2024.jpg",
    alt: "Albin Kurti gjatë vizitës në Komisionin Evropian",
    credit: "Xavier Lejeune / European Union · CC BY 4.0",
  },
];

/** Prefer an image attached to cited coverage that actually names the market subject. */
export function selectMarketIdentityImage(candidate, articles = [], usedUrls = new Set()) {
  const namedSubjects = (candidate?.proposition?.entities ?? []).map(plain);
  if (!namedSubjects.length) namedSubjects.push(plain(candidate?.question));
  for (const subject of namedSubjects) {
    const curated = CURATED_SUBJECT_IMAGES.find((asset) => asset.matches(subject) && !usedUrls.has(asset.url));
    if (curated) {
      usedUrls.add(curated.url);
      return {
        market_image_url: curated.url, market_image_alt: curated.alt,
        market_image_source_url: curated.source, market_image_credit: curated.credit,
      };
    }
  }
  const slugs = new Set((candidate?.source_slugs ?? []).map(String));
  const entities = (candidate?.proposition?.entities ?? [])
    .map(plain)
    .filter((entity) => entity.length >= 5 && !["kosovo", "shqiperi", "government", "qeveria"].includes(entity));
  const selected = (articles ?? []).find((article) => {
    const image = safeImageUrl(article?.imageUrl ?? article?.image_url);
    const sourcePage = safeImageUrl(article?.url);
    const title = plain(article?.title);
    return slugs.has(String(article?.slug)) && image?.startsWith("https://") && sourcePage?.startsWith("https://") && !usedUrls.has(image)
      && entities.some((entity) => title.includes(entity));
  });
  if (!selected) return null;
  const imageUrl = safeImageUrl(selected.imageUrl ?? selected.image_url);
  usedUrls.add(imageUrl);
  return { market_image_url: imageUrl, market_image_alt: String(selected.title ?? candidate.question), market_image_source_url: safeImageUrl(selected.url), market_image_credit: null };
}

export function marketContext(market, article) {
  if (plain(market?.category) === "ekonomi") return "economy";
  const propositionGeography = plain(market?.pre_match_analysis?.news_geography ?? market?.pre_match_analysis?.proposition?.geography);
  if (propositionGeography === "albania" || propositionGeography === "shqiperi") return "albania";
  if (propositionGeography === "world" || propositionGeography === "bote") return "world";
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

  const identityImage = safeImageUrl(market?.market_image_url);
  if (identityImage) {
    const context = marketContext(market);
    const isArt = identityImage.startsWith("/api/tregu/market-art/");
    return {
      src: identityImage, fallbackSrc: TREGU_CONTEXT_FALLBACKS[context], kind: isArt ? "market_art" : "market_identity",
      context, articleSlug: null, title: String(market?.market_image_alt ?? market?.question ?? ""),
      source: String(market?.market_image_source_url ?? ""), credit: String(market?.market_image_credit ?? ""),
    };
  }

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
    src: sourceSrc ?? (market?.slug ? `/api/tregu/market-art/${encodeURIComponent(String(market.slug))}` : fallbackSrc),
    fallbackSrc,
    kind: sourceSrc ? "source_article" : market?.slug ? "market_art" : "category_fallback",
    context,
    articleSlug: selected?.slug ? String(selected.slug) : null,
    title: selected?.title ? String(selected.title) : null,
    source: selected?.source ? String(selected.source) : null, credit: null,
  };
}
