export declare const FRESHNESS_DECAY: number;

interface RankableArticle {
  id: string;
  title: string;
  publishedAt?: string;
  createdAt?: string;
  engagementScore?: number;
}

export declare function frontRank(article: RankableArticle, now?: number): number;
export declare function storyStems(title: string): Set<string>;
export declare function isSameStory(titleA: string, titleB: string): boolean;
export declare function pickFrontPage<T extends RankableArticle>(
  pool: readonly T[],
  count: number,
  now?: number
): T[];
