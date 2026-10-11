export interface CoverIndex {
  v: number;
  updatedAt: string | null;
  day: string | null;
  made: number;
  items: Record<string, { path: string; at: string }>;
}
export declare const COVER_BUCKET: string;
export declare const INDEX_PATH: string;
export declare const INDEX_VERSION: number;
export declare const MAX_PER_DAY: number;
export declare const PER_RUN: number;
export declare const RUN_EVERY_MS: number;
export declare const FRESH_MS: number;
export function emptyIndex(): CoverIndex;
export function normalizeIndex(raw: unknown, now?: number): CoverIndex;
export function isSombre(article: { title?: string; excerpt?: string } | null | undefined): boolean;
export function coverPrompt(article: { title?: string; excerpt?: string } | null | undefined): string;
export function pickCoverStories<A extends { slug?: string; imageUrl?: string; publishedAt?: string; engagementScore?: number }>(
  articles: readonly A[] | null | undefined,
  index: unknown,
  opts?: { now?: number; max?: number }
): A[];
export function runBudget(index: unknown, today: string, now?: number): number;
export function withPlates(index: unknown, today: string, plates: readonly { slug: string; path: string }[], now?: number): CoverIndex;
export function platePath(today: string, slug: string): string;
export function coverArtMap(index: unknown, publicBase: string, now?: number): Record<string, string>;
