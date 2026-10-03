import type { RankedItem, RankableArticle } from "./per-ty-rank.mjs";

export declare const SECTION_SIZE: number;
export declare const SHELF_BELOW: number;

export type SectionKind = "person" | "city" | "category";

export interface SectionInfo {
  key: string;
  kind: SectionKind;
  title: string;
  href: string;
}

export interface SectionItem<A> {
  article: A;
  reason: string;
  /** From the 30-day category shelf rather than this week's ranked feed. */
  fromShelf: boolean;
}

export interface PaperSection<A> extends SectionInfo {
  items: SectionItem<A>[];
  empty: boolean;
}

export interface Paper<A> {
  lead: RankedItem<A> | null;
  edition: RankedItem<A>[];
  sections: PaperSection<A>[];
  allKeys: string[];
  allHidden: boolean;
  minutes: number;
}

export function defaultSectionKeys(interests: unknown): string[];
export function describeSection(key: unknown): SectionInfo | null;
export function buildPaper<A extends RankableArticle>(
  feed: readonly RankedItem<A>[] | null | undefined,
  interests: unknown,
  prefs: unknown,
  opts?: { homeFrom?: string | null; shelf?: Record<string, readonly A[]> | null }
): Paper<A>;
