export type MarketContext = "kosovo" | "albania" | "world" | "economy";
export type MarketMedia = {
  src: string;
  fallbackSrc: string;
  kind: "source_article" | "category_fallback" | "market_identity" | "market_art";
  context: MarketContext;
  articleSlug: string | null;
  title: string | null;
  source: string | null;
  credit?: string | null;
};
export const TREGU_CONTEXT_FALLBACKS: Readonly<Record<MarketContext, string>>;
export function marketContext(market: unknown, article?: unknown): MarketContext;
export function resolveMarketMedia(market: unknown, articles?: unknown[]): MarketMedia | null;
export function selectMarketIdentityImage(candidate: unknown, articles?: unknown[], usedUrls?: Set<string>): { market_image_url: string; market_image_alt: string; market_image_source_url: string | null; market_image_credit: string | null } | null;
