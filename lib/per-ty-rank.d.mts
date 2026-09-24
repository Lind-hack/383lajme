export interface RankableArticle {
  slug: string;
  title: string;
  excerpt?: string;
  category?: string;
  city?: string;
  publishedAt?: string;
  engagementScore?: number;
}
export type RankKind = "person" | "city" | "category" | "learned" | "top";
export interface RankedItem<A> {
  article: A;
  reason: string;
  kind: RankKind;
}
export declare const WEIGHTS: Record<string, number>;
export declare const TOP_REASON: string;
export declare const LEARNED_REASON: string;
export function articleKeys(
  article: (Omit<RankableArticle, "slug"> & { slug?: string }) | null | undefined
): string[];
export function rankFeed<A extends RankableArticle>(
  pool: readonly A[] | null | undefined,
  interests: unknown,
  opts?: { now?: number; limit?: number; topCount?: number }
): RankedItem<A>[];
export function countMatches(
  pool: readonly RankableArticle[] | null | undefined,
  interests: unknown,
  now?: number
): number;
