interface ClaimableArticle {
  id: string;
  title: string;
  category?: string;
  publishedAt?: string;
  createdAt?: string;
  engagementScore?: number;
}

export interface Ledger {
  ids: Set<string>;
  titles: string[];
}

export interface SectionPlan {
  key: string;
  count: number;
  category?: string;
}

export interface DosjeEntry {
  articleSlug: string;
  articleTitle: string;
  dossierSlug: string;
  dossierTitle: string;
  articleHref: string;
  dossierHref: string;
}

export declare const MIN_CATEGORY_BLOCK: number;
export declare function createLedger(articles?: readonly ClaimableArticle[]): Ledger;
export declare function claim<T extends ClaimableArticle>(
  ledger: Ledger,
  ordered: readonly T[],
  count: number,
  options?: { predicate?: (article: T) => boolean; min?: number }
): T[];
export declare function newestFirst<T extends ClaimableArticle>(pool: readonly T[]): T[];
export declare function rankedFirst<T extends ClaimableArticle>(pool: readonly T[], now?: number): T[];
export declare function buildHomeSections<T extends ClaimableArticle>(
  pool: readonly T[],
  ledger: Ledger,
  plan: readonly SectionPlan[],
  options?: { categoryOf?: (article: T) => string | undefined; now?: number }
): Record<string, T[]>;
export declare function groupDosjeEntries<E extends DosjeEntry>(
  entries: readonly E[],
  shownSlugs?: ReadonlySet<string>
): (E & { moreCount: number })[];
