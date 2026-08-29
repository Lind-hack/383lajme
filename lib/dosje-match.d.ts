export interface MatchTopicInput {
  slug: string;
  anchors?: string[] | null;
  signals?: string[] | null;
  excludes?: string[] | null;
  [key: string]: unknown;
}

export interface MatchReasons {
  anchors: string[];
  signals: string[];
  excludes: string[];
}

export declare const MIN_TOPIC_SCORE: number;
export declare const MIN_SUBJECT_ARTICLES: number;
export declare const MIN_SUBJECT_DAYS: number;
export declare function fold(text: unknown): string;
export declare function scoreTopic(
  article: unknown,
  topic: MatchTopicInput
): { score: number; vetoed: boolean; reasons: MatchReasons };
export declare function matchTopic<T extends MatchTopicInput>(
  article: unknown,
  topics: T[]
): { topic: T; score: number; reasons: MatchReasons } | null;
export declare function isStandingSubject(
  matches: Array<{ articleSlug?: string; publishedAt?: string }>
): boolean;
