export type MarketContext = "kosovo" | "albania" | "world" | "economy";
export type MarketMedia = {
  src: string;
  fallbackSrc: string;
  kind: "source_article" | "category_fallback";
  context: MarketContext;
  articleSlug: string | null;
  title: string | null;
  source: string | null;
};
export const TREGU_CONTEXT_FALLBACKS: Readonly<Record<MarketContext, string>>;
export function marketContext(market: unknown, article?: unknown): MarketContext;
export function resolveMarketMedia(market: unknown, articles?: unknown[]): MarketMedia | null;
