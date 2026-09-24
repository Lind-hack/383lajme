import type { NavCategory } from "./category-map";

export declare const INTERESTS_KEY: string;
export declare const INTERESTS_VERSION: number;

export interface Interests {
  v: number;
  categories: NavCategory[];
  topics: string[];
  /** Ids from lib/people.mjs, or "derived:<Full Name>". */
  people: string[];
  /** Ids from lib/cities.mjs. */
  cities: string[];
  /** Learned from reading, device-only. Keys: "cat:…", "person:…", "city:…". */
  affinity: Record<string, AffinityEntry>;
  updatedAt: string | null;
}

export interface AffinityEntry {
  w: number;
  t: string;
}

export declare const AFFINITY_HALF_LIFE_MS: number;
export function decayedWeight(entry: AffinityEntry | null | undefined, now?: number): number;
export function recordRead(
  affinity: unknown,
  keys: readonly string[],
  now?: number
): Record<string, AffinityEntry>;
export function toggleValue<T>(list: readonly T[] | null | undefined, value: T): T[];

/** Minimal shape of Storage, so callers can pass a fake in tests. */
export interface InterestsStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MatchableArticle {
  category?: string;
}

export function normalizeInterests(raw: unknown): Interests;
export function readInterests(storage?: InterestsStore | null): Interests;
export function writeInterests(
  interests: Partial<Interests>,
  storage?: InterestsStore | null
): boolean;
export function toggleCategory(
  categories: readonly string[] | null | undefined,
  rawLabel: string
): NavCategory[];
export function hasInterests(interests: unknown): boolean;
export function matchArticles<T extends MatchableArticle>(
  articles: readonly T[] | null | undefined,
  interests: unknown,
  limit?: number
): T[];
