export interface SummaryIndex {
  v: number;
  last: string | null;
  items: Record<string, { t: string; at: string; by: "dardani" | "own" }>;
}
type StoryText = { slug?: string; title?: string; excerpt?: string | null; body?: string | null };
export declare const SUMMARY_BUCKET: string;
export declare const INDEX_PATH: string;
export declare const INDEX_VERSION: number;
export declare const PER_RUN: number;
export declare const SUMMARY_HOUR: number;
export declare const FRESH_MS: number;
export declare const MIN_WORDS: number;
export declare const MAX_WORDS: number;
export declare const SUMMARY_SYSTEM: string;
export function noDashes(text: unknown): string;
export function checkSummary(raw: unknown, article: StoryText): string | null;
export function buildSummaryPrompt(articles: readonly StoryText[]): string;
export function cleanSummaries(raw: unknown, articles: readonly (StoryText & { slug: string })[]): Map<string, string>;
export function ownSummary(article: StoryText): string;
export function normalizeIndex(raw: unknown): SummaryIndex;
export function isSummaryHour(now?: number): boolean;
export function pickStories<A extends { slug?: string; title?: string; publishedAt?: string }>(
  recent: readonly A[] | null | undefined,
  index: SummaryIndex,
  opts?: { now?: number; max?: number }
): A[];
export function withSummaries(
  index: SummaryIndex,
  made: readonly { slug: string; text: string; by: "dardani" | "own" }[],
  now?: number
): SummaryIndex;
export function summaryMap(raw: unknown): Record<string, { text: string; byDardani: boolean }>;
